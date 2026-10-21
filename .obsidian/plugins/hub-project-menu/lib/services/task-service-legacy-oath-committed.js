"use strict";
const { readTaskSnapshot, taskMetadata, taskBlockEnd } = require("../domain/task-planning");
const { taskIdentity, taskLineDetails, normalizedTaskText } = require("../domain/tasks");
const { workspaceRef, sameWorkspace } = require("../domain/oath-workspace");
const { legacyError } = require("./task-service-errors");

function sourceParents(lines) {
    const parents = new Set();
    let fence = null;
    for (let line = 0; line < lines.length; line++) {
        const token = lines[line].trim().match(/^(`{3,}|~{3,})/);
        if (token) { if (!fence) fence = token[1][0]; else if (fence === token[1][0]) fence = null; continue; }
        if (!fence && taskLineDetails(lines[line])) {
            parents.add(line);
            // Reuse the authoritative Markdown block boundary; its subordinate
            // tasks remain Steps, even if the global index has not imported yet.
            line = taskBlockEnd(lines, line) - 1;
        }
    }
    return parents;
}

// Separate from setup eligibility and strict editing locators. Saved titles and
// paths are historical; the unique current parent ID selects the source.
async function legacyOathCommitted(plugin, tasks, request) {
    const { workspace, references, awaitingIndex = [] } = request;
    const context = () => {
        if (!workspace) return null;
        const wizard = plugin.projectWizard;
        const value = workspace.type === "project" ? wizard.getProjectById(workspace.id) : wizard.getResourceById(workspace.id);
        return value && sameWorkspace(workspaceRef(value), workspace) && plugin.app.vault.getAbstractFileByPath(value.path) ? value : null;
    };
    const owns = path => { const owner = context(); return !!owner && (path === owner.path || path?.startsWith(owner.root + "/")); };
    const parents = new Map(), identities = new Map(), sources = new Map();
    for (const parent of tasks) {
        if (parent.hubTaskId) {
            const matches = parents.get(parent.hubTaskId) ?? [];
            matches.push(parent); parents.set(parent.hubTaskId, matches);
        }
        for (const item of [parent, ...(parent.steps ?? [])]) if (item.hubTaskId)
            identities.set(item.hubTaskId, (identities.get(item.hubTaskId) ?? 0) + 1);
    }
    const pending = new Map(awaitingIndex.map(item => [item.id, item]));
    const rows = [], diagnostics = [];
    for (const ref of references) {
        const matches = parents.get(ref.id) ?? [], fresh = pending.get(ref.id);
        const canonical = matches.length === 1 && !matches[0].identityConflict && identities.get(ref.id) === 1;
        const row = { reference: { ...ref }, state: "unavailable", task: null,
            indexed: canonical, retireAwaitingIndex: canonical, diagnostics: [] };
        const fail = (code, state = "unavailable") => {
            row.state = state;
            const diagnostic = { code, level: "row", rowIndex: rows.length, sourcePath: ref.path, message: "Committed task source is unavailable." };
            row.diagnostics.push(diagnostic); diagnostics.push(diagnostic);
        };
        let task = canonical ? matches[0] : null, bridged = false;
        if (matches.length > 1 || matches.length && !canonical) fail("AMBIGUOUS_REFERENCE", "ambiguous");
        else if (!task && fresh && !matches.length && tasks.some(item => !item.hubTaskId && item.path === fresh.path &&
            item.line === fresh.line && normalizedTaskText(item.text) === normalizedTaskText(fresh.text))) {
            // Enrollment origin is supplied only by Oath's existing operation-local
            // map. Both newly allocated and source-existing IDs may be in that map.
            if (identities.has(ref.id)) fail("AMBIGUOUS_REFERENCE", "ambiguous");
            else { task = { ...fresh, hubTaskId: ref.id }; bridged = true; }
        }
        if (task) {
            try {
                const file = plugin.app.vault.getAbstractFileByPath(task.path);
                if (!file) { fail("SOURCE_MISSING"); task = null; }
                else {
                    if (!sources.has(task.path)) sources.set(task.path, Promise.resolve().then(() => plugin.app.vault.read(file)).then(content => {
                        const lines = content.split(/\r?\n/);
                        return { content, lines, parents: sourceParents(lines) };
                    }));
                    const source = await sources.get(task.path), { content, lines } = source;
                    const line = lines.findIndex(value => taskIdentity(value) === ref.id && taskLineDetails(value));
                    if (line < 0) { fail("SOURCE_ID_MISSING"); task = null; }
                    else if (!source.parents.has(line)) { fail("SOURCE_NOT_PARENT"); task = null; }
                    else {
                        const snapshot = readTaskSnapshot(content, { path: task.path, line, text: taskLineDetails(lines[line]).text, hubTaskId: ref.id });
                        if (file.path !== task.path || !plugin.app.vault.getAbstractFileByPath(task.path)) {
                            fail("SOURCE_MOVED"); task = null;
                        } else if (!owns(task.path)) { fail("WRONG_PHYSICAL_OWNER"); task = null; }
                        else {
                            // Detached primitive source evidence, no Dataview objects,
                            // TFile, raw source block, editor token or new identity.
                            task = { path: snapshot.path, line: snapshot.line, end: snapshot.end, text: snapshot.text,
                                hubTaskId: snapshot.hubTaskId, completed: snapshot.completed, status: snapshot.status,
                                steps: snapshot.steps.map(step => ({ ...step })), identityConflict: false,
                                ...taskMetadata(bridged ? task.metadata : task), ...taskMetadata(plugin.taskEditor.metadata(ref.id)) };
                        }
                    }
                }
            } catch (error) {
                const ambiguous = legacyError(error).code === "AMBIGUOUS_REFERENCE";
                fail(ambiguous ? "AMBIGUOUS_REFERENCE" : error.code ?? "SOURCE_VALIDATION_FAILED", ambiguous ? "ambiguous" : "unavailable"); task = null;
            }
        } else if (!row.diagnostics.length) fail("ID_NOT_INDEXED");
        if (task) { row.state = bridged ? "awaiting-index" : "resolved"; row.task = task; }
        rows.push(row);
    }
    return { consistency: "legacy-source-checked", workspace: workspace ? { ...workspace } : null, rows, diagnostics };
}
module.exports = { legacyOathCommitted };
