"use strict";
const { validLocation } = require("./task-views");

const normalize = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
function nameScore(value, query) {
    const text = normalize(value), term = normalize(query).trim();
    if (!term) return null;
    if (text === term) return 0;
    if (text.startsWith(term)) return 1;
    if (text.includes(term)) return 2;
    if (term.split(/\s+/).every(word => text.includes(word))) return 3;
    if (term.length < 3) return null;
    let position = -1, first = -1;
    for (const character of term) {
        position = text.indexOf(character, position + 1);
        if (position < 0) return null;
        if (first < 0) first = position;
    }
    // Prefer tight subsequences; avoid noisy matches across long prose.
    return position - first < term.length * 3 ? 4 + (position - first) / Math.max(1, text.length) : null;
}
function ownerOf(path, workspaces) {
    return workspaces.filter(workspace => validLocation(path, workspace)).sort((a, b) => b.root.length - a.root.length)[0];
}
function inScope(entry, scope, workspaces) {
    if (!scope) return !!ownerOf(entry.path, workspaces);
    if (validLocation(entry.path, scope)) return true;
    return entry.kind === "tasks" && scope.contextKind !== "resource" && entry.task.linkedProjectId === scope.projectId &&
        workspaces.some(workspace => workspace.contextKind === "resource" && validLocation(entry.path, workspace));
}
function contextLabel(path, owner) {
    const relative = path.slice(owner.root.length).replace(/^\//, "").replace(/\.md$/i, "");
    return [owner.name ?? owner.label ?? owner.root.split("/").at(-1), ...relative.split("/").filter(Boolean)].join(" › ");
}
function groupResults(results, limit = 8) {
    const groups = new Map();
    results.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, undefined, { numeric: true }) || a.path.localeCompare(b.path));
    for (const result of results) {
        if (!groups.has(result.kind)) groups.set(result.kind, []);
        const group = groups.get(result.kind);
        if (group.length < limit) group.push(result);
    }
    return [...groups].map(([kind, items]) => ({ kind, items }));
}
module.exports = { normalize, nameScore, ownerOf, inScope, contextLabel, groupResults };
