"use strict";

const { isFolderLike } = require("./files");
const displayName = file => file.extension === "md" ? file.basename : file.name;
const compareNames = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

// Nodes retain the original vault object and descriptor. Shared roots are views
// of Resource paths, never copied files or a second store of their metadata.
function workspaceTree(descriptors, getByPath, dashboardPath, { workspacePath = null, fullView = false } = {}) {
    if (fullView) descriptors = [
        { path: workspacePath, title: getByPath(workspacePath)?.name ?? "Workspace", isRoot: true },
        ...descriptors.filter(descriptor => descriptor.sharedResource && descriptor.path !== workspacePath)
    ];
    const byPath = new Map();
    function visit(item, descriptor, parent = null) {
        const folder = isFolderLike(item);
        const node = { path: item.path, name: parent ? displayName(item) : descriptor.title,
            item, descriptor, parent, folder, children: [] };
        byPath.set(node.path, node);
        if (folder) node.children = item.children
            .filter(child => child.path !== dashboardPath && !(!fullView && descriptor.isRoot && !parent && isFolderLike(child)))
            .map(child => visit(child, descriptor, node))
            .sort((a, b) => Number(b.folder) - Number(a.folder) || compareNames(a.name, b.name));
        return node;
    }
    const roots = descriptors.flatMap(descriptor => {
        const item = getByPath(descriptor.path);
        return isFolderLike(item) ? [visit(item, descriptor)] : [];
    });
    return { roots, byPath };
}

// Keep ancestors and the contents of matching folders visible. Search-driven
// expansion is transient; clearing the query restores the user's disclosures.
function filterWorkspaceTree(roots, query) {
    const needle = query.trim().toLocaleLowerCase(), visible = new Set(), matches = new Set();
    function visit(node, inherited = false) {
        const match = !needle || node.name.toLocaleLowerCase().includes(needle);
        if (needle && match) matches.add(node.path);
        let descendant = false;
        for (const child of node.children) descendant = visit(child, inherited || match) || descendant;
        if (match || inherited || descendant) visible.add(node.path);
        return match || inherited || descendant;
    }
    roots.forEach(node => visit(node));
    return { visible, matches };
}

function displayedPlanNodes(nodes, locations, { rootFilesOnly = false } = {}) {
    const roots = new Map(), displayed = new Map(), rootFiles = new Map();
    for (const node of nodes) {
        const root = node.parent ? roots.get(node.parent) : node;
        roots.set(node, root);
        if (!displayed.has(node.path)) displayed.set(node.path, []);
        displayed.get(node.path).push(node);
        if (rootFilesOnly && node === root && root.descriptor.isRoot) {
            // Note view lists root notes and top-level folders under separate roots.
            rootFiles.set(root, new Set(root.children.map(child => child.path)));
        }
    }
    const marked = new Set();
    for (const location of locations) {
        const represented = new Set();
        for (let path = location; path; path = path.slice(0, Math.max(0, path.lastIndexOf("/")))) {
            for (const node of displayed.get(path) ?? []) {
                const root = roots.get(node);
                if (represented.has(root)) continue;
                const files = rootFiles.get(root);
                if (files && location !== root.path && !files.has(location)) continue;
                marked.add(node);
                represented.add(root);
            }
        }
    }
    return marked;
}

function sortExplorerChildren(children, state = {}) {
    const key = ["name", "modified", "created"].includes(state.sortKey) ? state.sortKey : "modified";
    const direction = state.sortDirection === "asc" ? 1 : -1;
    return [...children].sort((a, b) => {
        if (a.folder !== b.folder) return a.folder ? -1 : 1;
        const name = compareNames(a.name, b.name);
        if (key === "name") return name * direction;
        if (a.folder) return name; // TFolder does not provide file timestamps.
        const field = key === "created" ? "ctime" : "mtime";
        return ((a.item.stat?.[field] ?? 0) - (b.item.stat?.[field] ?? 0)) * direction || name;
    });
}

function rewriteExplorerPaths(states, oldPath, newPath) {
    const rewrite = path => typeof path === "string" && (path === oldPath || path.startsWith(oldPath + "/"))
        ? newPath + path.slice(oldPath.length) : path;
    const entries = Object.entries(states);
    for (const [path] of entries) delete states[path];
    for (const [path, state] of entries) states[rewrite(path)] = { ...state, currentPath: rewrite(state.currentPath) };
}

module.exports = { workspaceTree, filterWorkspaceTree, displayedPlanNodes, sortExplorerChildren, rewriteExplorerPaths };
