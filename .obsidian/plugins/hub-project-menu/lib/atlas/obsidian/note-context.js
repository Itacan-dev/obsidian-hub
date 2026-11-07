"use strict";

// Hub mode state, live leaf ownership and native view types are the gate.
// Body classes, selected text and remembered workspace history are never used.
function eligibleNoteLeaf(plugin, leaf, expectedMode = plugin.workspaceModes?.mode, insideSettings = false) {
    const modes = plugin.workspaceModes, mode = modes?.mode, active = plugin.app.workspace.activeLeaf;
    if (!mode || mode !== expectedMode || modes.destroyed || modes.internalDepth > 0 || modes.state.currentMode !== "note" ||
        !insideSettings && (plugin.settingsControl?.isOpen?.() || plugin.atlas?.isSettingsOpen?.())) return false;
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
        if (item?.view?.containerEl?.isConnected === false || path === "Home.md") return false;
        const kind = type(item);
        if (item === mode.projectLeaf) return kind === "hub-prepared-note-rail" || kind === "markdown";
        if (kind === "empty") return !path;
        if (kind === "webviewer") return true;
        return ["markdown", "pdf"].includes(kind) && modes.contextContainsFile(mode.project, path);
    };
    return permitted(leaf) && permitted(active) &&
        (leaf === mode.projectLeaf || modes.contentLeaves().includes(leaf)) &&
        (active === mode.projectLeaf || modes.contentLeaves().includes(active));
}
const canOpenAtlas = (plugin, leaf, expectedMode = plugin.workspaceModes?.mode) => eligibleNoteLeaf(plugin, leaf, expectedMode);
function canUseAtlasContext(plugin, leaf, expectedMode = plugin.workspaceModes?.mode) {
    const workspace = plugin.app.workspace, container = leaf?.getContainer?.(), document = leaf?.view?.contentEl?.ownerDocument;
    // Pop-out access controls address a live native webviewer in this workspace.
    // This is UI eligibility only; the shared native host still authorizes every
    // command and navigation. Main-window Note restrictions remain unchanged.
    if (container && container !== workspace.rootSplit && document && container.win?.document === document &&
        !container.win.closed && leaf.view.contentEl.isConnected && workspace.getLeavesOfType("webviewer").includes(leaf)) return true;
    return eligibleNoteLeaf(plugin, leaf, expectedMode, true);
}
function registerNoteAtlasAction(plugin, openHome, createMenu) {
    const workspace = plugin.app.workspace;
    const documents = new Map(); let destroyed = false;
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
        if (destroyed || !canOpenAtlas(plugin, leaf, expectedMode)) return false;
        return openHome(leaf, expectedMode);
    };
    plugin.registerEvent(workspace.on("leaf-menu", (menu, leaf) => {
        const mode = plugin.workspaceModes?.mode;
        if (!canOpenAtlas(plugin, leaf, mode)) return;
        menu.addItem(item => item.setTitle("Open Atlas").setIcon("compass").setSection("open")
            .onClick(() => open(leaf, mode)));
    }));
    const watchDocument = document => {
        if (destroyed || !document?.addEventListener || documents.has(document)) return;
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
    const unwatchDocument = document => { const listener = documents.get(document); if (listener) document.removeEventListener("contextmenu", listener); documents.delete(document); };
    const destroy = () => { destroyed = true; for (const document of documents.keys()) unwatchDocument(document);
        for (const tabs of markedTabs) tabs.classList.remove("hub-atlas-note-tabs"); markedTabs.clear(); };
    watchDocument(globalThis.document);
    sync();
    return { open, watchDocument, unwatchDocument, sync, destroy };
}
module.exports = { canOpenAtlas, canUseAtlasContext, registerNoteAtlasAction };
