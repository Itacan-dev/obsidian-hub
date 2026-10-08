"use strict";

const path = require("path");
const { Modal, Notice } = require("obsidian");
const { mountAtlasOverview, renderNavigation } = require("./ui");

// Renderer bridge: holds descriptions, DOM identities and subscriptions only.
// It has no controller, policy evaluator, persistence writer or Journey facts.
function installAtlasIntegration(plugin) {
    const app = plugin.app, records = new Map(), listeners = new Set(), patches = new Map(), documents = new Map(), existingIds = new WeakMap();
    let host = null, client = null, stopped = false, modal = null, issue = null;
    const publish = () => { for (const callback of listeners) callback(); };
    const bridge = {
        view() { return host ? host.view() : { status: "UNAVAILABLE", reason: issue, snapshot: null, contexts: [] }; },
        async command(input) {
            if (!host) return { type: "BLOCKED", reason: issue };
            const result = await host.command(input); refresh(); publish(); return result;
        },
        subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
        forget(nativeId) { host?.forget(nativeId); },
        open() {
            if (modal) return;
            modal = new class extends Modal {
                onOpen() { this.contentEl.classList.add("hub-atlas-overview"); this.dispose = mountAtlasOverview(this.contentEl, bridge); }
                onClose() { this.dispose?.(); this.contentEl.replaceChildren(); modal = null; }
            }(app);
            modal.open();
        },
        destroy() {
            stopped = true; modal?.close(); clearInterval(scanTimer);
            if (host && client !== null) host.unsubscribe(client);
            for (const record of records.values()) { record.panel?.remove(); record.status?.remove(); }
            for (const observer of documents.values()) observer.disconnect();
            for (const [prototype, patch] of patches) {
                if (prototype.instantiateWebView === patch.wrapper) prototype.instantiateWebView = patch.original;
                if (prototype.navigate === patch.navigateWrapper) prototype.navigate = patch.navigate;
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
                const record = records.get(this);
                if (record?.context?.closed) {
                    this.url = url; this.loadFirstPage = null;
                    this.instantiateWebView(); this.displayWebView?.(); refresh();
                    return Promise.resolve();
                }
                return navigate.call(this, url, ...args);
            };
            patches.set(prototype, { original, wrapper, navigate, navigateWrapper }); prototype.instantiateWebView = wrapper;
            if (typeof navigate === "function") prototype.navigate = navigateWrapper;
        }
        let record = records.get(view);
        if (record?.webview === view.webview) { remember(record); return; }
        if (record) { record.panel?.remove(); record.status?.remove(); if (record.nativeId) host?.forget(record.nativeId); }
        record = { view, webview: view.webview, nativeId: existingIds.get(view.webview) ?? null, context: null };
        records.set(view, record);
        for (const event of ["did-attach", "dom-ready", "did-start-navigation", "destroyed"]) {
            record.webview.addEventListener(event, () => { remember(record); refresh(); });
        }
        remember(record);
    }
    function scan() {
        if (stopped) return;
        watchDocument(window.document);
        app.workspace.iterateAllLeaves?.(leaf => watchDocument(leaf.view?.containerEl?.ownerDocument ?? leaf.view?.contentEl?.ownerDocument));
        for (const leaf of app.workspace.getLeavesOfType("webviewer")) watch(leaf.view);
        for (const [view, record] of records) {
            if (!view.contentEl.isConnected) { record.panel?.remove(); record.status?.remove(); if (record.nativeId) host?.forget(record.nativeId); records.delete(view); }
        }
        refresh();
    }
    function refresh() {
        if (stopped) return;
        const state = bridge.view();
        for (const record of records.values()) {
            remember(record);
            const context = state.contexts.find(item => item.nativeId === record.nativeId) ?? record.context;
            record.context = context;
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
                view.contentEl.appendChild(record.status);
            }
            record.panel.hidden = !blocked;
            if (blocked) {
                // Also clear Obsidian's extracted reader copy. CSS keeps any late
                // async reader/error rendering concealed until a new guest passes.
                view.renderer?.clear?.(); view.readerView?.replaceChildren();
                if (context?.closed) record.webview.remove();
                renderNavigation(record.panel, state, context, bridge);
            }
            record.status.textContent = context?.response?.decision
                ? `Atlas · ${context.response.decision.reason.replaceAll("_", " ").toLowerCase()}` : `Atlas · ${state.reason ?? state.status}`;
        }
    }
    function watchDocument(document) {
        if (!document || documents.has(document)) return;
        if (!host) quarantineDocument(document);
        else if (document.__hubAtlasQuarantine) {
            const saved = document.__hubAtlasQuarantine;
            if (document.createElement === saved.createWrapper) document.createElement = saved.create;
            if (document.createElementNS === saved.createNSWrapper) document.createElementNS = saved.createNS;
            delete document.__hubAtlasQuarantine;
        }
        const watched = new WeakSet();
        const identities = new WeakMap();
        const inspect = () => {
            const state = bridge.view();
            for (const guest of document.querySelectorAll("webview")) {
                if (!host) { try { guest.stop(); } catch (_) { /* not yet mounted */ } guest.remove(); continue; }
                if (!watched.has(guest)) {
                    watched.add(guest);
                    const remember = () => { try { identities.set(guest, guest.getWebContentsId()); } catch (_) { /* attachment may be pending */ } };
                    remember(); guest.addEventListener("did-attach", remember);
                    guest.addEventListener("destroyed", () => guest.remove());
                }
                if (state.contexts.some(context => context.nativeId === identities.get(guest) && context.closed)) guest.remove();
            }
        };
        const observer = new document.defaultView.MutationObserver(inspect);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        documents.set(document, observer); inspect();
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
        host = window.electron.remote.require(path.join(directory, "atlas-native.cjs"))
            .getAtlasHost({ directory, partition: app.getWebviewPartition() });
        client = host.subscribe(message => { if (stopped) return; if (message.type === "OPEN_HOME") openHome(message); else { scan(); publish(); } });
        if (!host.view().enabled) void host.open();
    } catch (error) {
        issue = "NATIVE_ENFORCEMENT_UNAVAILABLE";
        console.error("Atlas could not install the native webviewer guard", error);
        // Refuse native browser creation when the mandatory main bridge is absent.
        // Existing guests and new guest elements are removed before they can be
        // used. This unsupported profile cannot offer Atlas-controlled browsing.
        quarantineDocument(window.document);
        new Notice("Atlas requires desktop native enforcement. Webviewer browsing is unavailable.", 0);
    }
    const scanTimer = setInterval(scan, 500);
    plugin.registerEvent(app.workspace.on("layout-change", scan));
    plugin.registerEvent(app.workspace.on("window-open", (_workspaceWindow, openedWindow) => watchDocument(openedWindow?.document)));
    app.workspace.onLayoutReady(scan);
    plugin.addCommand({ id: "atlas-open", name: "Open Atlas access and Vault", callback: () => bridge.open() });
    plugin.addRibbonIcon("shield-check", "Atlas", () => bridge.open());
    return bridge;
}

module.exports = { installAtlasIntegration };
