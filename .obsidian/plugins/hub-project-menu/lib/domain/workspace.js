"use strict";
function workspaceRef(context) {
    if (!context)
        return null;
    const type = context.contextKind === "resource" ? "resource" : "project", id = type === "resource" ? context.resourceType ?? context.id : context.projectId;
    return typeof id === "string" && id ? { type, id } : null;
}
const sameWorkspace = (a, b) => !!a && !!b && a.type === b.type && a.id === b.id;
module.exports = { workspaceRef, sameWorkspace };
