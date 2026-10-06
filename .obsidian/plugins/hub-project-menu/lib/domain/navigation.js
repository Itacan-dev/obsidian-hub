"use strict";

// Store native main-workspace trees, never sidebars or other window state.
// Missing files are pruned at restore time; markdown content always opens editable.
function browserViewState(view) {
    if (view?.type !== "webviewer" || typeof view.state?.url !== "string") return null;
    if (view.state.url === "about:blank" && view.state.atlasHome === true) return { url: "about:blank", atlasHome: true, title: "Atlas" };
    try {
        const url = new URL(view.state.url);
        if (!["http:", "https:"].includes(url.protocol)) return null;
        return { url: view.state.url, ...(typeof view.state.title === "string" ? { title: view.state.title } : {}) };
    } catch (_) { return null; }
}

/** @param {(type: string) => boolean} [canRestoreView] */
function prepareNoteLayout(snapshot, hubPath, exists, canRestoreView = () => true) {
    if (!snapshot?.main || !hubPath) return null;
    const leafIds = [];
    let hasHub = false;
    let notes = 0;
    function visit(node) {
        if (!node || typeof node !== "object") return null;
        if (node.type === "leaf") {
            if (node.state?.type === "webviewer") {
                const state = browserViewState(node.state);
                if (!state || !canRestoreView("webviewer")) return null;
                leafIds.push(node.id);
                notes++;
                return { ...node, state: { ...node.state, state } };
            }
            const path = node.state?.state?.file;
            if (!path || !exists(path)) return null;
            const copy = JSON.parse(JSON.stringify(node));
            // Prepared rails are a transient rendering host, never a new saved
            // layout format. Last File/Presets continue to store Markdown state.
            if (path === hubPath && copy.state.type === "hub-prepared-note-rail") {
                copy.state.type = "markdown";
                delete copy.state.state.hubPreparedRail;
            }
            leafIds.push(copy.id);
            if (path === hubPath) hasHub = true;
            else notes++;
            if (copy.state.type === "markdown") {
                copy.state.state.mode = path === hubPath ? "preview" : "source";
                copy.state.state.source = false;
            }
            return copy;
        }
        if (!["split", "tabs"].includes(node.type)) return null;
        const originalChildren = node.children ?? [];
        const selectedId = originalChildren[node.currentTab ?? 0]?.id;
        const children = originalChildren.map(visit).filter(Boolean);
        if (!children.length) return null;
        return { ...node, children, ...(node.type === "tabs" ? {
            currentTab: Math.max(0, children.findIndex(child => child.id === selectedId))
        } : {}) };
    }
    const main = visit(snapshot.main);
    return main && hasHub && notes ? {
        main,
        active: leafIds.includes(snapshot.active) ? snapshot.active : leafIds.at(-1)
    } : null;
}

function rewriteLayoutPaths(snapshot, rewrite) {
    if (!snapshot) return snapshot;
    const copy = JSON.parse(JSON.stringify(snapshot));
    function visit(node) {
        if (node?.state?.state?.file) node.state.state.file = rewrite(node.state.state.file);
        for (const child of node?.children ?? []) visit(child);
    }
    visit(copy.main);
    return copy;
}

module.exports = { prepareNoteLayout, rewriteLayoutPaths, browserViewState };
