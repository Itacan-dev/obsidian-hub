"use strict";
const sameOwner = (a, b) => !!a && !!b && a.type === b.type && a.id === b.id;
function relativePath(root, path) {
    const valid = value => typeof value === "string" && !!value && !/^[a-z]:/i.test(value) && !value.includes("\\") && !value.startsWith("/") && value.split("/").every(p => p && p !== "." && p !== "..");
    if (!valid(root) || !valid(path) || path !== root && !path.startsWith(root + "/")) throw Error("Location is outside its workspace.");
    return path === root ? "" : path.slice(root.length + 1);
}
function locationReference(owner, root, path, type) {
    if (!owner || !["project", "resource"].includes(owner.type) || typeof owner.id !== "string" || !owner.id || !["folder", "note"].includes(type)) throw Error("Invalid native location.");
    const relative = relativePath(root, path);
    if (!relative) { if (type !== "folder") throw Error("The workspace root must be a folder."); return null; }
    // Opaque schema references, salted by physical owner and relative path.
    // No device/vault path enters a portable Git command or receipt.
    const hash = require("node:crypto").createHash("sha256").update(JSON.stringify([[owner.type, owner.id], type, relative])).digest("hex");
    return { type, id: "workspace-location:v1:" + hash };
}
function resourceReference(owner, path, type) {
    if (owner.type !== "resource") return null;
    return { type, id: "resource-location:" + require("node:crypto").createHash("sha256").update(JSON.stringify([owner, type, path])).digest("hex") };
}
// null is a display-only omission marker; the original items remain navigable.
function compactPathSegments(parts) {
    return parts.length > 3
        ? { visible: [parts[0], null, ...parts.slice(-2)], omitted: parts.slice(1, -2) }
        : { visible: [...parts], omitted: [] };
}
function locationBreadcrumb(task, contextOwner = null) {
    const display = task.nativeLocationDisplay, owner = task.nativeReference?.owner ?? task.owner ?? task.nativeOwner;
    if (!display) return null;
    const inside = sameOwner(owner, contextOwner), name = display.workspaceName || (owner?.type === "resource" ? "Resource" : "Project");
    const route = display.available === false ? ["Location unavailable"] : display.segments;
    const full = [name, ...route].join(" / ");
    let parts = inside ? [...route] : [name, ...route];
    if (!parts.length) parts = ["Workspace root"];
    return { label: compactPathSegments(parts).visible.map(part => part ?? "\u2026").join(" / "), full, available: display.available !== false };
}
module.exports = { sameOwner, relativePath, locationReference, resourceReference, compactPathSegments, locationBreadcrumb };
