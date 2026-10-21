"use strict";
const { taskMetadata } = require("../domain/task-planning");
const { normalizedTaskText } = require("../domain/tasks");
const { legacyTaskHandle, validPath } = require("./task-service-legacy-values");

// Projection only: no source reads, identities, metadata writes or shadow index.
// Counts live only for this query; the existing task-data service is authoritative.
function legacyDisplayQuery(tasks, { owner, file }) {
    const ids = new Map(), titles = new Map();
    const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
    for (const task of tasks) {
        try {
            if (!task || typeof task !== "object") continue;
            for (const item of [task, ...(Array.isArray(task.steps) ? task.steps : [])]) {
                if (typeof item?.hubTaskId === "string") increment(ids, item.hubTaskId);
            }
            if (typeof task.path === "string" && typeof task.text === "string") increment(titles, JSON.stringify([task.path, normalizedTaskText(task.text)]));
        } catch (_) { /* The row below carries the conversion diagnostic. */ }
    }
    const diagnostics = [];
    const rows = tasks.map((task, rowIndex) => {
        const rowDiagnostics = [];
        const issue = (code, message) => {
            let sourcePath = null;
            try { if (validPath(task?.path)) sourcePath = task.path; } catch (_) { /* No trustworthy source evidence. */ }
            const diagnostic = { code, level: "row", rowIndex, sourcePath, message };
            rowDiagnostics.push(diagnostic); diagnostics.push(diagnostic);
        };
        try {
            if (!task || typeof task.text !== "string" || !validPath(task.path)) {
                issue("ROW_CONVERSION_FAILED", "The indexed task has no trustworthy display text or source path.");
                return { state: "invalid", view: null, diagnostics: rowDiagnostics };
            }
            let handle = null;
            try { handle = legacyTaskHandle(task); }
            catch (_) { issue("INVALID_REFERENCE", "The indexed task has no usable source locator."); }
            const parentConflict = !!task.identityConflict || !!task.hubTaskId && ids.get(task.hubTaskId) > 1;
            const stepConflict = Array.isArray(task.steps) && task.steps.some(step => step?.hubTaskId && ids.get(step.hubTaskId) > 1);
            const locatorConflict = !task.hubTaskId && titles.get(JSON.stringify([task.path, normalizedTaskText(task.text)])) > 1;
            const ambiguous = parentConflict || stepConflict || locatorConflict;
            if (ambiguous) issue("AMBIGUOUS_REFERENCE", "The indexed task or a Step has an ambiguous identity or source locator.");
            const available = file(task.path)?.extension?.toLowerCase() === "md";
            if (!available) issue("SOURCE_MISSING", "The indexed task source is no longer available.");
            if (task.metadataUnavailable) issue("METADATA_UNAVAILABLE", "The task's effective metadata could not be read.");
            const metadata = taskMetadata(parentConflict ? {} : task);
            const view = { handle, title: normalizedTaskText(task.text), completed: !!task.completed,
                owner: owner(task.path), due: metadata.dueDate ? { date: metadata.dueDate, time: metadata.dueTime ?? null } : null,
                description: metadata.description ?? "", source: { kind: "legacy-indexed-source", path: task.path },
                compatibility: { kind: "legacy-indexed-text", displayText: task.text, searchText: task.text },
                capabilities: { edit: false, attemptReveal: !!handle && !ambiguous && available && !task.metadataUnavailable } };
            return { state: ambiguous ? "ambiguous" : !available || task.metadataUnavailable ? "unresolved" : !handle ? "invalid" : "indexed", view, diagnostics: rowDiagnostics };
        } catch (_) {
            issue("ROW_CONVERSION_FAILED", "The indexed task could not be converted to portable display data.");
            return { state: "invalid", view: null, diagnostics: rowDiagnostics };
        }
    });
    return { consistency: "legacy-index", rows, diagnostics };
}
module.exports = { legacyDisplayQuery };
