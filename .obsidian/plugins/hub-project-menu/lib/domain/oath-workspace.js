"use strict";

function workspaceRef(context) {
    if (!context) return null;
    const type = context.contextKind === "resource" ? "resource" : "project";
    const id = type === "resource" ? context.resourceType ?? context.id : context.projectId;
    return typeof id === "string" && id.trim() ? { type, id, name: context.name ?? context.label } : null;
}
function validWorkspace(ref) {
    return !!ref && ["project", "resource"].includes(ref.type) && typeof ref.id === "string" && !!ref.id.trim();
}
function sameWorkspace(a, b) { return validWorkspace(a) && validWorkspace(b) && a.type === b.type && a.id === b.id; }
function taskKey(task) { return task.hubTaskId ?? `${task.path}:${task.line}:${task.text}`; }
module.exports = { workspaceRef, validWorkspace, sameWorkspace, taskKey };
