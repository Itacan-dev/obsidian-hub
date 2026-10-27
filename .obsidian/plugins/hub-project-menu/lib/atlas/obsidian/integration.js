"use strict";

const path = require("path");
const { Notice, Menu } = require("obsidian");
const { renderNavigation } = require("./ui");
const { getSettingsOwner } = require("../../ui/settings");
const { getAtlasSession, normalizeRoute } = require("./session");
const { pendingForBridge } = require("./pending");
const { mountAtlasHome } = require("./home-ui");
const { registerNoteAtlasAction, canOpenAtlas, canUseAtlasContext } = require("./note-context");

// Renderer bridge: holds descriptions, DOM identities and subscriptions only.
// It has no controller, policy evaluator, persistence writer or Journey facts.
function installAtlasIntegration(plugin) {
    const app = plugin.app, records = new Map(), listeners = new Set(), patches = new Map(), documents = new Map(), existingIds = new WeakMap();
    let host = null, client = null, stopped = false, issue = null, action = null;
    let description = null, launchingHome = null, descriptionJSON = null;
    const readDescription = () => { if (!host) return false; const encoded = host.viewJSON(); if (encoded === descriptionJSON) return false; description = JSON.parse(encoded); descriptionJSON = encoded; return true; };
    const publish = () => { for (const callback of listeners) callback(); };
    const bridge = {
        view() { return description ?? { status: "UNAVAILABLE", reason: issue, snapshot: null, contexts: [] }; },
        async command(input) {
            if (stopped || !host) return { type: "BLOCKED", reason: stopped ? "INTEGRATION_CLOSED" : issue };
            if (["START_ACCESS", "CONFIRM_ACCESS_AND_OPEN", "CANCEL_ACCESS", "OPEN_HOME", "RETRY_JOURNEY", "CANCEL_JOURNEY"].includes(input?.kind)) {
                const context = bridge.view().contexts.find(c => c.id === input.contextId && c.generation === input.generation);
                if (!context || !bridge.canActOnContext(context)) return { type: "BLOCKED", reason: "STALE_CONTEXT" };
            }
            const result = JSON.parse(await host.commandJSON(JSON.stringify(input))); if (stopped) return { type: "BLOCKED", reason: "TRANSPORT_UNRESOLVED" }; if (readDescription()) { refresh(); publish(); } return result;
        },
        subscribe(callback) { if (stopped) return () => {}; listeners.add(callback); return () => listeners.delete(callback); },
        isSettingsOpen: () => getSettingsOwner(plugin).isOpen(),
        canActOnContext(context) {
            if (stopped || !host) return false;
            const record = [...records.values()].find(r => r.nativeId === context.nativeId && r.view.contentEl.isConnected);
            const leaf = record && app.workspace.getLeavesOfType("webviewer").find(l => l.view === record.view);
            return !!leaf && canUseAtlasContext(plugin, leaf);
        },
        forget(nativeId) { if (!stopped) host?.forget(nativeId); },
        open(route) {
            if (stopped) return false;
            const session = getAtlasSession(bridge), target = normalizeRoute(route, session.route);
            if (stopped || !target) return false;
            session.route = target;
            const opened = getSettingsOwner(plugin).open("atlas");
            if (opened) session.navigate(target);
            else new Notice("Close the current dialog to open Atlas Settings. Your draft is kept.");
            return opened;
        },
        destroy() {
            stopped = true; getSettingsOwner(plugin).close(); getAtlasSession(bridge).dispose(); clearInterval(scanTimer); action?.destroy();
            if (host && client !== null) host.unsubscribe(client);
            for (const record of records.values()) { record.disposeHome?.(); record.home?.remove(); record.panel?.remove(); record.status?.remove(); }
            for (const observer of documents.values()) observer.disconnect();
            for (const [prototype, patch] of patches) {
                if (prototype.instantiateWebView === patch.wrapper) prototype.instantiateWebView = patch.original;
                if (prototype.navigate === patch.navigateWrapper) prototype.navigate = patch.navigate;
                if (prototype.setState === patch.setStateWrapper) prototype.setState = patch.setState;
                if (prototype.getState === patch.getStateWrapper) prototype.getState = patch.getState;
            }
            listeners.clear();
        }
    };

    function remember(record) {
        try { record.nativeId = record.webview.getWebContentsId(); } catch (_) { /* guest not attached yet */ }
    }
    function watch(view) {
        if (!view?.webview || !view.contentEl) return;
        const prototype = Object.getPrototypeOf(view);
        if (!patches.has(prototype) && typeof prototype.instantiateWebView === "function") {
            const original = prototype.instantiateWebView;
            const wrapper = function (...args) { const result = original.apply(this, args); watch(this); return result; };
            const navigate = prototype.navigate;
            const navigateWrapper = function (url, ...args) {
                this.__atlasHome = url === "about:blank";
                const record = records.get(this);
                if (record?.context?.closed) {
                    this.url = url; this.loadFirstPage = null;
                    this.instantiateWebView(); this.displayWebView?.(); refresh();
                    return Promise.resolve();
                }
                return navigate.call(this, url, ...args);
            };
            const setState = prototype.setState, getState = prototype.getState;
            const setStateWrapper = function (state, ...args) {
                this.__atlasHome = state?.atlasHome === true && state?.url === "about:blank";
                const result = setState.call(this, state, ...args);
                Promise.resolve(result).then(() => { watch(this); refresh(); }, () => {}); return result;
            };
            const getStateWrapper = function (...args) {
                const state = getState.apply(this, args);
                return this.__atlasHome || !this.url || this.url === "about:blank" ? { ...state, url: "about:blank", atlasHome: true, title: "Atlas" } : state;
            };
            patches.set(prototype, { original, wrapper, navigate, navigateWrapper, setState, getState, setStateWrapper, getStateWrapper }); prototype.instantiateWebView = wrapper;
            if (typeof navigate === "function") prototype.navigate = navigateWrapper;
            if (typeof setState === "function") prototype.setState = setStateWrapper;
            if (typeof getState === "function") prototype.getState = getStateWrapper;
        }
        let record = records.get(view);
        if (record?.webview === view.webview) { remember(record); return; }
        if (record) { record.disposeHome?.(); record.home?.remove(); record.panel?.remove(); record.status?.remove(); if (record.nativeId) host?.forget(record.nativeId); }
        record = { view, webview: view.webview, nativeId: existingIds.get(view.webview) ?? null, context: null };
        records.set(view, record);
        for (const event of ["did-attach", "dom-ready", "did-start-navigation", "destroyed"]) {
            record.webview.addEventListener(event, () => { remember(record); refresh(); });
        }
        remember(record);
    }
    function scan() {
        if (stopped) return;
        action?.sync();
        watchDocument(window.document);
        app.workspace.iterateAllLeaves?.(leaf => watchDocument(leaf.view?.containerEl?.ownerDocument ?? leaf.view?.contentEl?.ownerDocument));
        for (const leaf of app.workspace.getLeavesOfType("webviewer")) watch(leaf.view);
        for (const [view, record] of records) {
            if (!view.contentEl.isConnected) { record.disposeHome?.(); record.home?.remove(); record.panel?.remove(); record.status?.remove(); if (record.nativeId) host?.forget(record.nativeId); records.delete(view); }
        }
        refresh();
    }
    function refresh() {
        if (stopped) return;
        const state = bridge.view();
        for (const observer of documents.values()) observer.inspectClosed();
        for (const record of records.values()) {
            remember(record);
            const context = state.contexts.find(item => item.nativeId === record.nativeId) ?? record.context;
            record.context = context;
            const internalHome = !record.view.url || record.view.url === "about:blank";
            if (internalHome && !record.home) {
                record.home = record.view.contentEl.ownerDocument.createElement("section");
                record.home.className = "hub-atlas-home"; record.view.contentEl.appendChild(record.home);
                record.disposeHome = mountAtlasHome(record.home, bridge, async url => {
                    if (stopped || !host) return;
                    // The same native navigate/loadURL/Fetch gate as note links.
                    await record.view.navigate(url).catch(() => {}); refresh();
                });
            }
            if (record.home) record.home.hidden = !internalHome;
            record.view.contentEl.classList.toggle("hub-atlas-internal-home", internalHome);
            const view = record.view, blocked = !host || state.status !== "READY" || !state.enabled ||
                !context || context.closed || ["BLOCKED", "ENFORCEMENT_FAILED"].includes(context.phase);
            view.contentEl.classList.toggle("hub-atlas-blocked", blocked);
            if (!record.panel) {
                record.panel = view.contentEl.ownerDocument.createElement("section");
                record.panel.className = "hub-atlas-panel";
                view.contentEl.appendChild(record.panel);
                record.status = view.contentEl.ownerDocument.createElement("div");
                record.status.className = "hub-atlas-navigation-status";
                record.status.setAttribute("aria-live", "polite");
                record.statusCopy = view.contentEl.ownerDocument.createElement("span"); record.status.appendChild(record.statusCopy);
                record.pendingButton = view.contentEl.ownerDocument.createElement("button"); record.pendingButton.type = "button"; record.pendingButton.className = "hub-atlas-pending-link"; record.status.appendChild(record.pendingButton);
                record.pendingButton.addEventListener("click", event => {
                    const items = pendingForBridge(bridge); if (!items.length) return;
                    if (items.length === 1) { bridge.open(items[0].route); return; }
                    const menu = new Menu();
                    for (const item of items) menu.addItem(entry => entry.setTitle(item.label + ": " + item.detail).onClick(() => {
                        const latest = pendingForBridge(bridge).find(current => current.key === item.key); if (latest) bridge.open(latest.route);
                    }));
                    menu.showAtMouseEvent(event);
                });
                view.contentEl.appendChild(record.status);
            }
            record.panel.hidden = internalHome || !blocked;
            if (blocked || internalHome) view.showLoadingIndicator?.(false);
            if (blocked && !internalHome) {
                // Also clear Obsidian's extracted reader copy. CSS keeps any late
                // async reader/error rendering concealed until a new guest passes.
                if (!record.wasBlocked) view.renderer?.clear?.();
                if (view.readerView?.hasChildNodes()) view.readerView.replaceChildren();
                if (context?.closed) record.webview.remove();
                renderNavigation(record.panel, state, context, bridge);
            }
            record.wasBlocked = blocked;
            const decision = context?.response?.decision;
            const detail = decision?.reason ?? context?.response?.reason ?? state.reason;
            const statusText = "Atlas · " + (state.status !== "READY" ? "browsing paused" : decision?.reason === "WHITELISTED" ? "Whitelist access" :
                decision?.reason === "ACTIVE_GRANT" ? "temporary access" : decision?.reason === "ACTIVE_JOURNEY" ? "bounded Journey" :
                decision?.outcome === "WAIT" ? "access requested" : decision?.outcome === "REQUIRE_CONFIRMATION" ? "confirmation available" : "access required or blocked");
            record.statusCopy.title = detail ?? "";
            if (record.statusCopy.textContent !== statusText) record.statusCopy.textContent = statusText;
            const pending = pendingForBridge(bridge), pendingLabel = pending.length + " pending " + (pending.length === 1 ? "action" : "actions");
            if (record.pendingButton.textContent !== pendingLabel) record.pendingButton.textContent = pendingLabel;
            record.pendingButton.hidden = !pending.length; record.pendingButton.title = pending.map(item => item.label + ": " + item.detail).join("\n");
            record.status.hidden = internalHome;
        }
    }
    function watchDocument(document) {
        action?.watchDocument(document);
        if (!document || documents.has(document)) return;
        if (!host) quarantineDocument(document);
        else if (document.__hubAtlasQuarantine) {
            const saved = document.__hubAtlasQuarantine;
            if (document.createElement === saved.createWrapper) document.createElement = saved.create;
            if (document.createElementNS === saved.createNSWrapper) document.createElementNS = saved.createNS;
            delete document.__hubAtlasQuarantine;
        }
        const guests = new Map();
        const unwatch = guest => { const record = guests.get(guest); if (!record) return; guest.removeEventListener("did-attach", record.remember); guest.removeEventListener("destroyed", record.destroyed); guests.delete(guest); };
        const check = guest => {
            if (!guest.isConnected) { unwatch(guest); return; }
            if (!host || bridge.view().contexts.some(c => c.nativeId === guests.get(guest)?.id && c.closed)) {
                try { guest.stop(); } catch (_) { /* attachment may be pending */ } guest.remove(); unwatch(guest);
            }
        };
        const watchGuest = guest => {
            if (!guests.has(guest)) {
                const record = { id: null, remember: null, destroyed: null };
                record.remember = () => { try { record.id = guest.getWebContentsId(); } catch (_) { /* attachment may be pending */ } check(guest); };
                record.destroyed = () => { guest.remove(); unwatch(guest); };
                guests.set(guest, record); guest.addEventListener("did-attach", record.remember); guest.addEventListener("destroyed", record.destroyed); record.remember();
            } else check(guest);
        };
        const inspectTree = node => { if (node.nodeType !== 1) return; if (node.matches("webview")) watchGuest(node); for (const guest of node.querySelectorAll("webview")) watchGuest(guest); };
        const observer = new document.defaultView.MutationObserver(records => {
            for (const mutation of records) { for (const node of mutation.addedNodes) inspectTree(node);
                for (const node of mutation.removedNodes) if (node.nodeType === 1 && (node.matches("webview") || node.querySelector("webview"))) for (const guest of guests.keys()) if (!guest.isConnected) unwatch(guest); }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        documents.set(document, { inspectClosed: () => { for (const guest of guests.keys()) check(guest); }, disconnect() { observer.disconnect(); for (const [guest, record] of guests) { guest.removeEventListener("did-attach", record.remember); guest.removeEventListener("destroyed", record.destroyed); } guests.clear(); } });
        inspectTree(document.documentElement);
    }

    function quarantineDocument(document) {
        if (document.__hubAtlasQuarantine) return;
        const create = document.createElement, createNS = document.createElementNS;
        const refuse = tag => { if (String(tag).toLowerCase() === "webview") throw new Error("Atlas native enforcement is unavailable"); };
        const createWrapper = function (tag, ...args) { refuse(tag); return create.call(this, tag, ...args); };
        const createNSWrapper = function (namespace, tag, ...args) { refuse(tag); return createNS.call(this, namespace, tag, ...args); };
        document.__hubAtlasQuarantine = { create, createNS, createWrapper, createNSWrapper };
        document.createElement = createWrapper; document.createElementNS = createNSWrapper;
        for (const guest of document.querySelectorAll("webview")) { try { guest.stop(); } catch (_) { /* attachment incomplete */ } guest.remove(); }
    }
    function openHome(message) {
        scan();
        const record = [...records.values()].find(item => item.nativeId === message.nativeId);
        if (stopped) return;
        if (!record) {
            // Canvas/other native guests share enforcement and the global access
            // UI. A deliberate confirmation opens a fresh ordinary webviewer.
            Promise.resolve(app.workspace.getLeaf("tab").setViewState({ type: "webviewer", state: { url: message.origin } }))
                .then(() => { host.forget(message.nativeId); scan(); })
                .catch(() => new Notice("Atlas could not open a new webviewer. Open the destination again."));
            return;
        }
        const view = record.view;
        view.__atlasHome = false;
        view.url = message.origin;
        view.loadFirstPage = null;
        view.readerView?.replaceChildren(); view.renderer = null;
        view.instantiateWebView(); // fresh native binding and fresh GET, behind Fetch
        view.displayWebView?.();
        watch(view); refresh();
    }
    try {
        // Capture live DOM identity before the synchronous main installation
        // closes pre-existing, unverified guests during hot plugin activation.
        for (const leaf of app.workspace.getLeavesOfType("webviewer")) {
            try { existingIds.set(leaf.view.webview, leaf.view.webview.getWebContentsId()); } catch (_) { /* deferred view */ }
        }
        const base = app.vault.adapter.getBasePath();
        const directory = path.resolve(base, plugin.manifest.dir);
        const candidate = window.electron.remote.require(path.join(directory, "atlas-native.cjs"))
            .getAtlasHost({ directory, partition: app.getWebviewPartition() });
        if (candidate.apiVersion !== 6) {
            // Never hot-swap an old controller or its uncertain-write guards.
            try { candidate.unsubscribe(null); } catch (_) { /* quarantine below */ }
            throw new Error("NATIVE_ADAPTER_UPGRADE_REQUIRED");
        }
        host = candidate;
        readDescription();
        client = host.subscribe(message => { if (stopped) return; const changed = readDescription(); if (message.type === "OPEN_HOME") openHome(message); else if (changed) { refresh(); publish(); } });
        if (!description.enabled) void host.open();
    } catch (error) {
        issue = error.message === "NATIVE_ADAPTER_UPGRADE_REQUIRED" ? error.message : "NATIVE_ENFORCEMENT_UNAVAILABLE";
        if (issue === "NATIVE_ADAPTER_UPGRADE_REQUIRED") console.info("Atlas native upgrade requires an Obsidian restart.");
        else console.error("Atlas could not install the native webviewer guard", error);
        // Refuse native browser creation when the mandatory main bridge is absent.
        // Existing guests and new guest elements are removed before they can be
        // used. This unsupported profile cannot offer Atlas-controlled browsing.
        quarantineDocument(window.document);
        new Notice(issue === "NATIVE_ADAPTER_UPGRADE_REQUIRED" ? "Quit and reopen Obsidian to load the updated Atlas native service. Browsing stays blocked." : "Atlas requires desktop native enforcement. Webviewer browsing is unavailable.", 0);
    }
    const scanTimer = setInterval(scan, 500);
    plugin.registerEvent(app.workspace.on("layout-change", scan));
    plugin.registerEvent(app.workspace.on("window-open", (_workspaceWindow, openedWindow) => watchDocument(openedWindow?.document)));
    app.workspace.onLayoutReady(scan);
    action = registerNoteAtlasAction(plugin, (source, expectedMode) => {
        if (!canOpenAtlas(plugin, source, expectedMode) || stopped || !host) return Promise.resolve(false);
        if (launchingHome) return launchingHome;
        const work = async () => {
            const modes = plugin.workspaceModes;
            const existing = modes.contentLeaves().find(leaf => {
                const state = leaf.getViewState?.();
                return state?.type === "webviewer" && state.state?.url === "about:blank" && (!leaf.view?.url || leaf.view.url === "about:blank");
            });
            if (existing) { await app.workspace.revealLeaf(existing); scan(); const eligible = !stopped && canOpenAtlas(plugin, existing, expectedMode); if (eligible) existing.view.contentEl.querySelector(".hub-atlas-home input[type=search]")?.focus({ preventScroll: true }); return eligible; }
            const preferred = modes.pickContentLeaf() ?? source, anchor = canOpenAtlas(plugin, preferred, expectedMode) ? preferred : source;
            if (!canOpenAtlas(plugin, source, expectedMode)) return false;
            const leaf = modes.createTabLeaf(anchor);
            await leaf.setViewState({ type: "webviewer", state: { url: "about:blank", atlasHome: true, title: "Atlas" }, active: true });
            if (stopped || !canOpenAtlas(plugin, leaf, expectedMode)) { leaf.detach?.(); return false; }
            leaf.view.__atlasHome = true; scan(); modes.captureNoteLayout(); leaf.view.contentEl.querySelector(".hub-atlas-home input[type=search]")?.focus({ preventScroll: true }); return true;
        };
        const pending = work().finally(() => { if (launchingHome === pending) launchingHome = null; });
        launchingHome = pending; return pending;
    }, () => new Menu());
    bridge.openFromNote = action.open;
    return bridge;
}

module.exports = { installAtlasIntegration };
