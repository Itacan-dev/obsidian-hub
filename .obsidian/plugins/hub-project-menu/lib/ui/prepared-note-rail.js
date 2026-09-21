"use strict";

const NOTE_RAIL_VIEW = "hub-prepared-note-rail";
const HOME_VIEW = "hub-prepared-home";
const VIEW_PATH = "System/Dashboards/Project/view";
const HOME_PATH = "System/Dashboards/Home/view";

// Prepare destination structure using the existing dashboard renderers. Native
// view lifetime owns it; secondary panels remain on the shared deferred path.
function createPreparedNoteRails(plugin) {
    const { ItemView, Component } = require("obsidian");
    const pending = new Map();
    const assets = new Map();
    let serial = 0, destroyed = false;
    const loadAssets = path => {
        if (assets.has(path)) return assets.get(path);
        const loading = Promise.all([
            plugin.app.vault.adapter.read(path + ".js"),
            plugin.app.vault.adapter.read(path + ".css")
        ]).then(([code, css]) => ({
            render: new (Object.getPrototypeOf(async function () {}).constructor)("dv", "app", "input", code),
            css
        })).catch(error => {
            if (assets.get(path) === loading) assets.delete(path);
            throw error;
        });
        assets.set(path, loading);
        return loading;
    };
    plugin.registerEvent(plugin.app.vault.on("modify", file => {
        for (const path of [VIEW_PATH, HOME_PATH]) {
            if (file.path === path + ".js" || file.path === path + ".css") assets.delete(path);
        }
    }));

    class PreparedNoteRail extends ItemView {
        constructor(leaf) {
            super(leaf);
            const candidates = [...pending.values()].filter(item => item.viewType === this.getViewType());
            const prepared = candidates.find(item => item.leafId === leaf.id) ||
                (candidates.length === 1 ? candidates[0] : null);
            // Populate before native onOpen/setState can yield. There is never
            // an attached blank rail waiting for a later Markdown/Dataview pass.
            if (prepared) this.attachPrepared(prepared);
        }
        attachPrepared(prepared) {
            pending.delete(prepared.token);
            if (this.prepared) this.removeChild(this.prepared.component);
            this.prepared = prepared;
            this.context = prepared.context;
            this.path = prepared.context.path;
            this.file = plugin.app.vault.getAbstractFileByPath(this.path);
            this.addChild(prepared.component);
            this.contentEl.replaceChildren(prepared.host);
            if (prepared.commit) {
                // Commit the actual prepared view before native open() can
                // detach/await the old view's asynchronous onClose. Native's
                // later remove/reappend is synchronous, with no second render.
                if (this.leaf.view !== this) this.leaf.view?.containerEl?.replaceWith(this.containerEl);
                prepared.commit();
                delete prepared.commit;
                this.activatePreparedRail();
            }
        }
        getViewType() { return NOTE_RAIL_VIEW; }
        getDisplayText() { return this.context?.name || "Workspace"; }
        getState() {
            return { file: this.file?.path || this.path,
                ...(this.getViewType() === HOME_VIEW ? { mode: "preview", source: false } : {}) };
        }
        activatePreparedRail() { this.prepared?.frame.activate(); }
        async setState(state, result) {
            if (this.prepared && this.path === state.file &&
                (!state.hubPreparedRail || state.hubPreparedRail === this.prepared.token)) {
                plugin.workspaceModes.pendingNoteRestore?.adopt();
                this.activatePreparedRail();
                return super.setState(state, result);
            }
            let prepared = pending.get(state.hubPreparedRail);
            // Obsidian itself persists its open view types at shutdown. Rebuild
            // this same renderer on startup; Hub snapshots remain canonical.
            if (!prepared && !state.hubPreparedRail) {
                const home = this.getViewType() === HOME_VIEW;
                const context = home ? { path: "Home.md", name: "Home" } : plugin.workspaceModes.contextFor(state.file);
                if (!context) throw new Error("This Hub workspace no longer exists.");
                const restored = await controller.prepare(context, {
                    main: { type: "leaf", state: { type: "markdown", state: { file: state.file } } }
                }, this.containerEl.ownerDocument, home ? "home" : "note");
                state = restored.snapshot.main.state.state;
                prepared = pending.get(state.hubPreparedRail);
            }
            if (!prepared || prepared.context.path !== state.file) {
                throw new Error("Prepared Hub folder rail is unavailable.");
            }
            this.attachPrepared(prepared);
            plugin.workspaceModes.pendingNoteRestore?.adopt();
            this.activatePreparedRail();
            await super.setState(state, result);
        }
    }
    class PreparedHome extends PreparedNoteRail {
        getViewType() { return HOME_VIEW; }
    }
    const controller = {
        async prepare(context, layout, doc, mode = "note") {
            if (destroyed) throw new Error("The Hub has been unloaded.");
            const dataview = plugin.app.plugins.getPlugin("dataview");
            if (!dataview?.localApi) throw new Error("Dataview is required to restore the Hub folder rail.");
            const { render, css } = await loadAssets(mode === "home" ? HOME_PATH : VIEW_PATH);
            const component = new Component();
            component.hubDeferFrameActivation = true;
            component.hubDestinationMode = mode;
            let frame;
            component.hubOnFrameCommit = value => { frame = value; };
            component.load();
            const host = doc.createElement("div");
            host.className = "markdown-preview-view markdown-rendered" + (mode === "home" ? " dashboard" : "");
            // Match native Markdown preview layout before the first commit.
            // The existing theme/dashboard variables own the actual width;
            // note-rail CSS continues to override it in Full/Half/Closed mode.
            host.classList.toggle("is-readable-line-width",
                !!plugin.app.vault.getConfig?.("readableLineLength"));
            const sizer = host.createDiv({ cls: "markdown-preview-sizer" });
            const container = sizer.createDiv({ cls: "block-language-dataviewjs" });
            container.createEl("style", { text: css });
            try {
                await render(dataview.localApi(context.path, component, container), plugin.app, undefined);
                if (destroyed) throw new Error("The Hub was unloaded during folder-rail preparation.");
                if (!frame?.root.querySelector(mode === "home" ? ".home-nav" : ".project-nav") ||
                    (mode === "note" && !frame.root.hubCaptureFolders)) {
                    throw new Error("The Hub folder rail did not finish its structural render.");
                }
                const token = String(++serial);
                const viewType = mode === "home" ? HOME_VIEW : NOTE_RAIL_VIEW;
                const prepared = { context, host, frame, component, token, viewType };
                pending.set(token, prepared);
                const snapshot = JSON.parse(JSON.stringify(layout));
                const visit = node => {
                    if (node.type === "leaf" && node.state?.state?.file === context.path) {
                        prepared.leafId = node.id;
                        node.state = { ...node.state, type: viewType,
                            state: { file: context.path, hubPreparedRail: token } };
                    }
                    for (const child of node.children ?? []) visit(child);
                };
                visit(snapshot.main);
                return { snapshot, async openHome(leaf, commit) {
                    prepared.leafId = leaf.id;
                    prepared.commit = commit;
                    await leaf.setViewState({ type: HOME_VIEW,
                        state: { file: context.path, hubPreparedRail: token }, active: true });
                }, dispose() {
                    if (pending.get(token) === prepared) {
                        pending.delete(token);
                        component.unload();
                    }
                } };
            } catch (error) {
                component.unload();
                throw error;
            }
        },
        destroy() {
            destroyed = true;
            for (const prepared of pending.values()) prepared.component.unload();
            pending.clear();
            assets.clear();
        }
    };
    plugin.registerView(NOTE_RAIL_VIEW, leaf => new PreparedNoteRail(leaf));
    plugin.registerView(HOME_VIEW, leaf => new PreparedHome(leaf));
    return controller;
}

module.exports = { createPreparedNoteRails, NOTE_RAIL_VIEW, HOME_VIEW };
