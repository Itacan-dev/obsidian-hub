"use strict";
const { historyKind } = require("../domain/history");
const { workspaceRef, validPath } = require("./task-service-legacy-values");
const { TaskServiceError } = require("./task-service-errors");
const fields = ["id", "kind", "hubTaskId", "parentTaskId", "parentText", "text", "path", "line", "timestamp", "archivedAt",
    "projectId", "projectName", "project", "projectStatus", "projectPath", "projectRoot", "contextKind", "targetKind", "resourceType"];
// The Wizard/domain query remains authoritative for stored inclusion/order and
// owner filtering. This only detaches recorded evidence; no read deduplication,
// current-task lookup, historical reassignment or persistence belongs here.
function recordedHistoryQuery(records, taskId) {
    if (!Array.isArray(records)) throw new TaskServiceError("HISTORY_UNAVAILABLE", "Recorded task History is unavailable.");
    const rows = [], diagnostics = [];
    for (const [rowIndex, source] of records.entries()) {
        const rowDiagnostics = [], recorded = {}, unavailableFields = [];
        const issue = (code, message) => {
            const diagnostic = { level: "row", rowIndex, sourcePath: typeof recorded.path === "string" ? recorded.path : null, code, message };
            rowDiagnostics.push(diagnostic); diagnostics.push(diagnostic);
        };
        try {
            if (!source || typeof source !== "object" || Array.isArray(source)) throw Error("Invalid recorded History row.");
            for (const field of fields) {
                const descriptor = Object.getOwnPropertyDescriptor(source, field);
                if (!descriptor) continue;
                if (!Object.hasOwn(descriptor, "value")) { unavailableFields.push(field); issue("HISTORY_FIELD_UNAVAILABLE", "A recorded field is not a portable value: " + field); continue; }
                const value = descriptor.value;
                if (value === undefined) continue; // Absent in persisted JSON; explicit null is retained.
                if (value === null || ["string", "boolean"].includes(typeof value) || typeof value === "number" && Number.isFinite(value)) recorded[field] = value;
                else { unavailableFields.push(field); issue("HISTORY_FIELD_UNAVAILABLE", "A recorded field has unsupported evidence: " + field); }
            }
            if (typeof recorded.text !== "string" || typeof recorded.path !== "string") throw Error("Recorded History lacks trustworthy title or source evidence.");
            const step = recorded.kind === "step";
            if (taskId && (step ? recorded.parentTaskId : recorded.hubTaskId) !== taskId) continue;
            const recordedSource = validPath(recorded.path) ? { kind: "recorded-legacy-note", path: recorded.path,
                ...(Number.isInteger(recorded.line) && recorded.line >= 0 ? { line: recorded.line } : {}) } : null;
            if (!recordedSource) issue("HISTORY_SOURCE_UNAVAILABLE", "The recorded note path is not a usable navigation reference.");
            const ownerAtEvent = workspaceRef({ ...recorded, contextKind: historyKind(recorded),
                resourceType: recorded.resourceType ?? (typeof recorded.projectId === "string" && recorded.projectId.startsWith("resource:") ? recorded.projectId.slice(9) : undefined) });
            const identity = value => typeof value === "string" ? value : null;
            const fact = { kind: step ? "step" : "task", recordId: identity(recorded.id),
                taskIdentity: identity(step ? recorded.parentTaskId : recorded.hubTaskId), stepIdentity: step ? identity(recorded.hubTaskId) : null,
                title: recorded.text, parentTitle: typeof recorded.parentText === "string" ? recorded.parentText : null,
                timestamp: Number.isFinite(recorded.timestamp) ? recorded.timestamp : null, ownerAtEvent,
                source: recordedSource ? { kind: "legacy-source", path: recordedSource.path, ...(recordedSource.line !== undefined ? { line: recordedSource.line } : {}) } : null,
                recorded, recordedSource, consistency: "legacy-best-effort" };
            rows.push({ state: rowDiagnostics.length ? "partial" : "recorded", fact, diagnostics: rowDiagnostics,
                ...(unavailableFields.length ? { unavailableFields } : {}) });
        } catch (_) {
            issue("HISTORY_ROW_INVALID", "A recorded History row could not be projected safely.");
            // Statistics does not require a display title/navigation path. Keep
            // safe evidence without making this an eligible History UI row.
            rows.push({ state: "invalid", fact: null, diagnostics: rowDiagnostics, recorded,
                ...(unavailableFields.length ? { unavailableFields } : {}) });
        }
    }
    return { consistency: "legacy-recorded", rows, diagnostics };
}
module.exports = { recordedHistoryQuery };
