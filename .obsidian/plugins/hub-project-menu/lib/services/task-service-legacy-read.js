"use strict";
const { taskMetadata, readTaskSnapshot } = require("../domain/task-planning");
const { normalizedTaskText } = require("../domain/tasks");
const { legacyDisplayQuery } = require("./task-service-legacy-display");
const { legacyTaskHandle, workspaceRef } = require("./task-service-legacy-values");
const { TaskServiceError } = require("./task-service-errors");

// Explicit legacy compatibility evidence: primitives only, never a file, source
// block, Dataview object, editor token or native source invented by a consumer.
function legacyReadDisplay(task, owner, validation = "source-checked", indexed = task) {
    const metadata = taskMetadata(task);
    let handle = null; try { handle = legacyTaskHandle(task); } catch (_) { /* Display never grants an action. */ }
    const steps = task.steps ?? [], handles = steps.map((step, ordinal) => ({ kind: "legacy-step",
        taskIdentity: task.hubTaskId ?? null, identity: step.hubTaskId ?? null, ordinal }));
    const byLine = new Map(steps.map((step, index) => [step.line, index])), parents = new Map(), seen = new Set();
    const collectParents = item => {
        if (!item || seen.has(item)) return; seen.add(item); parents.set(item.line, item.parent);
        for (const child of item.children ?? item.subtasks ?? []) collectParents(child);
    };
    if (steps.some(step => !Number.isInteger(step.end))) collectParents(task);
    const stack = [], orders = new Map();
    const portableSteps = steps.map((step, ordinal) => {
        while (stack.length && (Number.isInteger(stack.at(-1).end) ? step.line >= stack.at(-1).end :
            step.parent !== stack.at(-1).line)) stack.pop();
        let parent = stack.at(-1)?.ordinal ?? null;
        if (!Number.isInteger(step.end)) {
            let line = step.parent; const visited = new Set(); parent = null;
            while (line != null && line !== task.line && !visited.has(line)) {
                if (byLine.has(line)) { parent = byLine.get(line); break; }
                visited.add(line); line = parents.get(line);
            }
        }
        const order = orders.get(parent) ?? 0; orders.set(parent, order + 1);
        stack.push({ ordinal, end: step.end, line: step.line });
        return { handle: handles[ordinal], title: normalizedTaskText(step.text), completed: !!step.completed,
            parent: parent === null ? null : handles[parent], order };
    });
    return { handle, title: normalizedTaskText(task.text), completed: !!task.completed, owner,
        start: metadata.fromDate ? { date: metadata.fromDate, time: metadata.fromTime ?? null } : null,
        due: metadata.dueDate ? { date: metadata.dueDate, time: metadata.dueTime ?? null } : null,
        importance: metadata.necessity, description: metadata.description ?? "",
        phase: metadata.phaseId && owner?.type === "project" ? { projectId: owner.id, phaseId: metadata.phaseId } : null,
        steps: portableSteps, validation, ...(metadata.captureSource ? { captureSource: { ...metadata.captureSource } } : {}),
        source: { kind: "legacy-indexed-source", path: task.path },
        compatibility: { kind: "legacy-indexed-text", displayText: indexed.text, searchText: indexed.text },
        capabilities: { edit: false, attemptReveal: false } };
}
function legacyReadView(task, owner, validation = "source-checked", indexed = task) {
    const view = legacyReadDisplay(task, owner, validation, indexed);
    view.handle = legacyTaskHandle(task);
    const reference = item => {
        legacyTaskHandle({ ...item, path: task.path }); // Validate every locator, including Steps.
        return { path: task.path, line: item.line, text: item.text, hubTaskId: item.hubTaskId ?? null, completed: !!item.completed };
    };
    return { ...view, capabilities: { edit: false, attemptReveal: true },
        legacy: { kind: "legacy-task-read", ...reference({ ...task, text: indexed.text }),
            steps: (task.steps ?? []).map((step, ordinal) => ({ ...reference(step), parent: view.steps[ordinal].parent === null ? task.line :
                task.steps[view.steps[ordinal].parent.ordinal].line })) } };
}

async function legacyStructuredQuery(plugin, tasks, { validation = "indexed", selected = null, preserveDisplay = false } = {}) {
    const owner = path => workspaceRef(plugin.projectWizard.getContextForPath(path));
    const query = legacyDisplayQuery(tasks, { owner, file: path => plugin.app.vault.getAbstractFileByPath(path) });
    // Exactly one global index/identity context and at most one source read per
    // selected note. Existing source parser and metadata semantics are reused.
    const counts = new Map();
    if (validation === "source") for (const parent of tasks) for (const item of [parent, ...(parent.steps ?? [])]) {
        if (item.hubTaskId) counts.set(item.hubTaskId, (counts.get(item.hubTaskId) ?? 0) + 1);
    }
    const sources = new Map();
    const issue = (row, index, error) => {
        const diagnostic = { level: "row", rowIndex: index, sourcePath: row.view?.source?.path ?? null,
            code: error.code ?? "SOURCE_READ_FAILED", message: error.message ?? "Task source could not be validated." };
        row.diagnostics.push(diagnostic); query.diagnostics.push(diagnostic);
        row.state = error.code === "AMBIGUOUS_REFERENCE" ? "ambiguous" : "unresolved";
        if (row.view) row.view.capabilities.attemptReveal = false;
    };
    let cursor = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
        while (cursor < tasks.length) {
            const index = cursor++, task = tasks[index], row = query.rows[index];
            if (!row.view || selected && !selected.has(task)) continue;
            try {
                row.view = legacyReadView(task, row.view.owner, "indexed");
                row.view.capabilities.attemptReveal = row.state === "indexed";
                if (validation !== "source" || row.state !== "indexed") continue;
                const file = plugin.app.vault.getAbstractFileByPath(task.path);
                if (!file) throw new TaskServiceError("SOURCE_MISSING", "Task source is unavailable.");
                if (!sources.has(task.path)) sources.set(task.path, Promise.resolve().then(() => plugin.app.vault.read(file)));
                const snapshot = readTaskSnapshot(await sources.get(task.path), task);
                if (file.path !== task.path || plugin.app.vault.getAbstractFileByPath(task.path) !== file) {
                    throw new TaskServiceError("SOURCE_MISSING", "The source moved or was removed during validation.");
                }
                if (!task.hubTaskId && (snapshot.line !== task.line || snapshot.hubTaskId) ||
                    normalizedTaskText(snapshot.text) !== normalizedTaskText(task.text)) {
                    throw new TaskServiceError("STALE_REFERENCE", "The indexed task changed before source validation.");
                }
                const ids = [snapshot.hubTaskId, ...snapshot.steps.map(step => step.hubTaskId)].filter(Boolean);
                if (new Set(ids).size !== ids.length || ids.some(id => counts.get(id) > 1)) {
                    throw new TaskServiceError("AMBIGUOUS_REFERENCE", "A task or Step identity is copied.");
                }
                const enriched = { ...snapshot, ...taskMetadata(plugin.taskEditor.metadata(snapshot.hubTaskId)) };
                row.view = legacyReadView(enriched, owner(snapshot.path), "source-checked", task);
                row.state = "validated";
            } catch (error) {
                issue(row, index, error);
                if (!row.view?.legacy) {
                    if (preserveDisplay) try { row.display = legacyReadDisplay(task, row.view?.owner ?? null, "indexed"); } catch (_) { /* No trustworthy display evidence. */ }
                    row.view = null; row.state = "invalid";
                }
            }
        }
    }));
    return { ...query, consistency: validation === "source" ? "legacy-source-checked" : "legacy-index" };
}
module.exports = { legacyReadView, legacyStructuredQuery };
