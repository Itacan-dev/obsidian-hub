"use strict";
const { prepareNoteLayout, rewriteLayoutPaths } = require("../domain/navigation");
const copy = value => JSON.parse(JSON.stringify(value));

class HubPresets {
    constructor(modes) { this.modes = modes; this.pending = null; }
    get items() { return Array.isArray(this.modes.state.presets) ? this.modes.state.presets.filter(item =>
        item && typeof item.id === "string" && typeof item.name === "string" && item.layout?.main) : []; }
    get canSave() { return !this.modes.destroyed && !!this.modes.mode && this.modes.usableContentLeaves().length > 0; }
    save(items) {
        if (this.modes.destroyed) throw Error("The Hub has been unloaded.");
        this.modes.state.presets = items; this.modes.saveState();
    }
    defaultName() {
        let n = 1;
        while (this.items.some(item => item.name === `Preset ${n}`)) n++;
        return `Preset ${n}`;
    }
    snapshot() {
        const m = this.modes;
        if (!this.canSave) throw Error("Open a workspace in note-mode to save a preset.");
        const context = m.mode.project;
        const layout = prepareNoteLayout(m.app.workspace.getLayout(), context.path,
            path => !!m.app.vault.getAbstractFileByPath(path));
        if (!layout) throw Error("There is no usable note layout to save.");
        const roots = m.leafElement(m.mode.projectLeaf)?.querySelectorAll(".project-dashboard") ?? [];
        const root = [...roots].find(root => root.getClientRects().length && root.hubCaptureFolders);
        const folders = m.plugin.workspaceState.folders(context.projectId);
        const file = m.app.vault.getAbstractFileByPath(context.path);
        const folderState = root?.hubCaptureFolders() ?? {
            folders, order: m.app.metadataCache.getFileCache(file)?.frontmatter?.folder_order ?? []
        };
        return copy({ contextId: context.projectId, hubPath: context.path, root: context.root,
            layout, folderState, railState: m.noteRailState ?? "full" });
    }
    create(name) {
        const snapshot = this.snapshot();
        const item = { version: 1, id: require("crypto").randomUUID(), name: name.trim() || this.defaultName(), ...snapshot };
        this.save([...this.items, item]); return item;
    }
    rename(id, name) {
        const value = name.trim();
        if (value) this.save(this.items.map(item => item.id === id ? { ...item, name: value } : item));
    }
    delete(id) { this.save(this.items.filter(item => item.id !== id)); }
    reorder(ids) {
        const items = this.items, byId = new Map(items.map(item => [item.id, item]));
        if (ids.length !== items.length || new Set(ids).size !== items.length || ids.some(id => !byId.has(id))) {
            throw Error("The preset list changed. Reopen the menu and try again.");
        }
        if (ids.some((id, index) => id !== items[index].id)) this.save(ids.map(id => byId.get(id)));
    }
    update(id) {
        const snapshot = this.snapshot();
        this.save(this.items.map(item => item.id === id ? { ...item, ...snapshot } : item));
    }
    rewritePaths(rewrite) {
        if (!this.items.length) return;
        this.save(this.items.map(item => {
            const folders = Object.fromEntries(Object.entries(item.folderState?.folders ?? {}).map(([path, state]) =>
                [rewrite(path), { ...state, currentPath: rewrite(state.currentPath) }]));
            const order = (item.folderState?.order ?? []).map(name => rewrite(`${item.root}/${name}`).split("/").pop());
            return { ...item, root: rewrite(item.root), hubPath: rewrite(item.hubPath),
                layout: rewriteLayoutPaths(item.layout, rewrite), folderState: { folders, order } };
        }));
    }
    folderRestore(id) { return this.pending?.contextId === id ? this.pending.folderState : null; }
    applyPendingFolders() {
        const m = this.modes, pending = this.pending;
        if (!pending) return;
        for (const root of m.leafElement(m.mode?.projectLeaf)?.querySelectorAll(".project-dashboard") ?? []) {
            if (root.dataset.hubContextId === pending.contextId) root.hubRestoreFolders?.(copy(pending.folderState));
        }
    }
    open(id, source) { return this.restoreSnapshot(() => this.items.find(item => item.id === id), source); }
    // Named presets and historical continuations restore the same configuration.
    restoreSnapshot(snapshot, source = null, { allowActivation = true, resolvePath = path => path } = {}) {
        return this.modes.enqueue(async () => {
            const m = this.modes, item = typeof snapshot === "function" ? snapshot() : snapshot;
            if (!item) return false;
            const { Notice, TFile } = require("obsidian");
            const context = m.contextFor(item.contextId);
            if (m.plugin.oath?.canOpen(context) === false) return false;
            if (!context || !(m.app.vault.getAbstractFileByPath(context.path) instanceof TFile)) {
                new Notice("This preset's workspace no longer exists."); return false;
            }
            if (!allowActivation && context.contextKind !== "resource" && context.status !== "active") return false;
            const layout = prepareNoteLayout(rewriteLayoutPaths(item.layout,
                path => path === item.hubPath ? context.path : resolvePath(path)), context.path,
                path => m.app.vault.getAbstractFileByPath(path) instanceof TFile &&
                    (allowActivation || m.navigationHistory.eligiblePath(path)),
                type => m.canRestoreLayoutView(type));
            if (!layout) { if (allowActivation) new Notice("No saved tabs are available for this preset. The current workspace was left unchanged."); return false; }
            if (!await m.plugin.ensureContextOpen(context, m.dashboardRoot(source)) ||
                m.plugin.oathNavigation?.allowLayout(layout) === false) return false;
            const files = tree => tree?.type === "leaf" ? 1 : (tree?.children ?? []).reduce((n, child) => n + files(child), 0);
            const missing = files(item.layout.main) - files(layout.main);
            const folders = Object.fromEntries(Object.entries(item.folderState?.folders ?? {}).map(([path, state]) => [resolvePath(path), { ...state, currentPath: resolvePath(state.currentPath) }]).filter(([path]) =>
                !!m.app.vault.getAbstractFileByPath(path)).map(([path, state]) => [path, { ...state,
                    currentPath: m.app.vault.getAbstractFileByPath(state.currentPath ?? "") ? state.currentPath : path }]));
            const folderState = { folders, order: item.folderState?.order ?? [] };
            return m.navigateFrom(source, () => m.presentWorkspace(m.leafForSource(source), context, true, async () => {
                this.pending = { contextId: context.projectId, folderState };
                await m.plugin.workspaceState.saveFolders(context.projectId, folders);
                const file = m.app.vault.getAbstractFileByPath(context.path);
                if (JSON.stringify(m.app.metadataCache.getFileCache(file)?.frontmatter?.folder_order ?? []) !== JSON.stringify(folderState.order)) {
                    await m.app.fileManager.processFrontMatter(file, fm => { fm.folder_order = [...folderState.order]; });
                }
                m.noteRailState = ["full", "half", "closed"].includes(item.railState) ? item.railState : "full";
                const restored = await m.applyNoteLayout(context, layout);
                if (allowActivation && restored && missing > 0) new Notice(`Preset restored; ${missing} unavailable tab${missing === 1 ? " was" : "s were"} skipped.`);
                return restored;
            })).finally(() => { this.pending = null; });
        });
    }
}

module.exports = { HubPresets };
