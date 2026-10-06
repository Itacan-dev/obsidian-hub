"use strict";

// Hub mode state, live leaf ownership and native view types are the gate.
// Body classes, selected text and remembered workspace history are never used.
function canOpenAtlas(plugin, leaf, expectedMode = plugin.workspaceModes?.mode) {
    const modes = plugin.workspaceModes, mode = modes?.mode, active = plugin.app.workspace.activeLeaf;
    if (!mode || mode !== expectedMode || modes.destroyed || modes.internalDepth > 0 || modes.state.currentMode !== "note" ||
        plugin.settingsControl?.isOpen?.() || plugin.atlas?.isSettingsOpen?.()) return false;
    // Obsidian's Settings modal pushes its own live keymap scope. Native menus
    // may push another scope above it, so also inspect the previous scopes.
    const settingsScope = plugin.app.setting?.scope;
    const stack = plugin.app.keymap?.getWindowStack?.(mode.ownerDocument.defaultView);
    if (settingsScope && stack && [stack.scope, ...stack.prevScopes].includes(settingsScope)) return false;
    if (!modes.isMainLeaf(mode.projectLeaf) || !modes.isMainLeaf(leaf) || !modes.isMainLeaf(active) ||
        modes.leafDocument(leaf) !== mode.ownerDocument || modes.leafDocument(active) !== mode.ownerDocument) return false;
    const type = item => item.getViewState?.()?.type ?? item.view?.getViewType?.();
    const permitted = item => {
        const path = modes.leafPath(item);
        if (path === "Home.md" || !["markdown", "hub-prepared-note-rail", "webviewer"].includes(type(item))) return false;
        return item === mode.projectLeaf || type(item) === "webviewer" || modes.contextContainsFile(mode.project, path);
    };
    return permitted(leaf) && permitted(active) &&
        (leaf === mode.projectLeaf || modes.contentLeaves().includes(leaf)) &&
        (active === mode.projectLeaf || modes.contentLeaves().includes(active));
}
function registerNoteAtlasAction(plugin, openHome, createMenu) {
    const workspace = plugin.app.workspace;
    const documents = new Map();
    const markedTabs = new Set();
    const sync = () => {
        const mode = plugin.workspaceModes?.mode, wanted = new Set();
        if (mode) for (const leaf of plugin.workspaceModes.contentLeaves()) {
            const tabs = leaf.view?.containerEl?.closest(".workspace-tabs");
            if (tabs && canOpenAtlas(plugin, leaf, mode)) wanted.add(tabs);
        }
        for (const tabs of markedTabs) if (!wanted.has(tabs)) { tabs.classList.remove("hub-atlas-note-tabs"); markedTabs.delete(tabs); }
        for (const tabs of wanted) { tabs.classList.add("hub-atlas-note-tabs"); markedTabs.add(tabs); }
    };
    const open = async (leaf, expectedMode = plugin.workspaceModes?.mode) => {
        if (!canOpenAtlas(plugin, leaf, expectedMode)) return false;
        return openHome(leaf, expectedMode);
    };
    plugin.registerEvent(workspace.on("leaf-menu", (menu, leaf) => {
        const mode = plugin.workspaceModes?.mode;
        if (!canOpenAtlas(plugin, leaf, mode)) return;
        menu.addItem(item => item.setTitle("Open Atlas").setIcon("compass").setSection("open")
            .onClick(() => open(leaf, mode)));
    }));
    const watchDocument = document => {
        if (!document?.addEventListener || documents.has(document)) return;
        const contextmenu = event => {
            const strip = event.target.closest?.(".workspace-tab-header-container");
            // Actual tabs use native leaf-menu. Leave buttons, sidebars and
            // custom title bars to their existing menus.
            if (!strip || event.target.closest?.(".workspace-tab-header, button, .clickable-icon, .workspace-tab-header-new-tab, .workspace-tab-header-tab-list") ||
                !strip.closest(".workspace-split.mod-root")) return;
            const mode = plugin.workspaceModes?.mode, group = strip.closest(".workspace-tabs");
            const inGroup = leaf => leaf?.view?.containerEl?.closest(".workspace-tabs") === group;
            const leaf = inGroup(workspace.activeLeaf) ? workspace.activeLeaf : plugin.workspaceModes?.contentLeaves().find(inGroup);
            if (mode?.ownerDocument !== document || !canOpenAtlas(plugin, leaf, mode)) return;
            if (!createMenu) return;
            const menu = createMenu();
            menu.addItem(item => item.setTitle("Open Atlas").setIcon("compass").onClick(() => open(leaf, mode)));
            event.preventDefault(); event.stopPropagation(); menu.showAtMouseEvent(event);
        };
        document.addEventListener("contextmenu", contextmenu);
        documents.set(document, contextmenu);
    };
    const destroy = () => { for (const [document, listener] of documents) document.removeEventListener("contextmenu", listener); documents.clear();
        for (const tabs of markedTabs) tabs.classList.remove("hub-atlas-note-tabs"); markedTabs.clear(); };
    watchDocument(globalThis.document);
    sync();
    return { open, watchDocument, sync, destroy };
}
module.exports = { canOpenAtlas, registerNoteAtlasAction };
