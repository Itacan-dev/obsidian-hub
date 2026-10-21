"use strict";
const { legacyReadView } = require("./task-service-legacy-read");
const { workspaceRef, sameWorkspace } = require("./task-service-legacy-values");
const { TaskServiceError } = require("./task-service-errors");

// Setup candidates only. This deliberately does not use the generic display
// policy's stronger Step-ID / same-title locator rejection. Oath commits parents.
function legacyOathCandidates(plugin, all, workspace) {
    const wizard = plugin.projectWizard;
    const context = workspace.type === "project" ? wizard.getProjectById(workspace.id) : wizard.getResourceById(workspace.id);
    if (!context || !sameWorkspace(workspaceRef(context), workspace) ||
        !plugin.app.vault.getAbstractFileByPath(context.path) || workspace.type === "project" && context.status !== "active")
        throw new TaskServiceError("REFERENCE_UNRESOLVED", "Choose an available Active Project or Resource.");
    const ids = new Map();
    for (const task of all) for (const item of [task, ...(task.steps ?? [])])
        if (item.hubTaskId) ids.set(item.hubTaskId, (ids.get(item.hubTaskId) ?? 0) + 1);
    const rows = [], diagnostics = [];
    let complete = true;
    for (const task of all) {
        if (task.completed || !(task.path === context.path || task.path?.startsWith(context.root + "/"))) continue;
        const rowDiagnostics = [], rowIndex = rows.length;
        const issue = (code, message) => {
            const diagnostic = { level: "row", rowIndex, sourcePath: task.path ?? null, code, message };
            rowDiagnostics.push(diagnostic); diagnostics.push(diagnostic);
        };
        let view = null;
        const conflict = !!task.identityConflict || !!task.hubTaskId && ids.get(task.hubTaskId) > 1;
        try {
            if (task.metadataUnavailable) throw new TaskServiceError("METADATA_UNAVAILABLE", "Task metadata is not available.");
            view = legacyReadView(task, workspaceRef(wizard.getContextForPath(task.path)), "indexed");
            view.capabilities.attemptReveal = !conflict;
            if (conflict) issue("AMBIGUOUS_REFERENCE", "This parent task has a copied identity.");
            if ((task.steps ?? []).some(step => step.hubTaskId && ids.get(step.hubTaskId) > 1))
                issue("OATH_STEP_ID_COPIED", "Recorded indexed Step ambiguity does not change the existing parent commitment policy.");
        } catch (error) {
            complete = false; issue(error.code ?? "ROW_CONVERSION_FAILED", "An Oath candidate cannot be read safely.");
        }
        rows.push({ state: !view ? "invalid" : conflict ? "ambiguous" : "indexed", view, diagnostics: rowDiagnostics });
    }
    return { consistency: "legacy-index", policy: "oath-candidates", candidateWorkspace: { ...workspace }, complete, rows, diagnostics };
}
module.exports = { legacyOathCandidates };
