"use strict";

// Historical kind/identity comes from the record, never the live registry/status.
function historyKind(record) {
    const kind = record.targetKind ?? record.contextKind;
    if (kind === "project" || kind === "resource") return kind;
    if (record.resourceType || String(record.projectId ?? "").startsWith("resource:")) return "resource";
    if (record.projectId) return "project";
    return String(record.path ?? "").startsWith("Resources/") ? "resource" : "project";
}
function queryHistory(records, { kind = null, workspaceId = null } = {}) {
    return (records ?? []).filter(record => record &&
        (!kind || historyKind(record) === kind) &&
        (!workspaceId || record.projectId === workspaceId)).map(record => ({ ...record }));
}
module.exports = { historyKind, queryHistory };
