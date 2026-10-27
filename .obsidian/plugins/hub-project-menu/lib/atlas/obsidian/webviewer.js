"use strict";

const { webTarget, homeOrigin, blank } = require("./runtime");

// Runs only in Electron's main process. A remote renderer callback cannot
// synchronously prevent a native navigation/window event.
/** @param {{electron: typeof import('electron'), runtime: ReturnType<typeof import('./runtime').createAtlasRuntime>, partition: string, onOpenHome: (event: {nativeId: number, contextId: string, origin: string}) => void}} options */
function createWebviewerEnforcement({ electron, runtime, partition, onOpenHome }) {
    const { app, webContents, session } = electron;
    const browserSession = session.fromPartition(partition);
    const guards = new Map(), hosts = new Map();
    let suspended = false;

    /** @param {Electron.WebContents} contents */
    function protectGuest(contents) {
        if (guards.has(contents.id)) return guards.get(contents.id);
        const originalLoad = contents.loadURL.bind(contents);
        const guard = { contents, ready: false, closing: false, frameId: null, userLoads: 0,
            provenance: null, network: new Map(), deadlineTimer: null, setupTimer: null,
            requestTimers: new Map(), lastArrival: null, document: null, initialOrigin: null };
        guards.set(contents.id, guard);
        const context = guard.context = runtime.attach(contents.id, {
            block() { closeGuest(guard); },
            lease(response) { setLease(guard, response); },
            openHome(origin) { onOpenHome({ nativeId: contents.id, contextId: context.id, origin }); }
        });
        const crashClosed = reason => {
            // Preserve a sanitized destination for an explicit fresh-home retry.
            // This is display/routing data, never navigation provenance.
            let origin = guard.initialOrigin;
            try { origin = homeOrigin(contents.isDestroyed() ? "" : contents.getURL()) ?? origin; } catch (_) { /* routing data cannot prevent closure */ }
            context.origin ??= origin;
            runtime.block(context, reason); closeGuest(guard);
        };
        guard.crashClosed = crashClosed;
        contents.stop();
        const attached = new Promise(resolve => { guard.attached = resolve; });
        // Both future native calls and webview IPC loads use the same method.
        // Document requests still need Fetch; this wrapper only fences setup and
        // unsupported schemes, including calls that emit no will-navigate event.
        contents.loadURL = (url, options) => {
            // Electron's attachment itself calls loadURL with our sterile src.
            // It must not count as an application replacing the captured URL.
            if (!blank(url)) { guard.userLoads++; guard.provenance = null; }
            else if (guard.ready) { guard.provenance = null; void runtime.retireDocument(context); }
            let task;
            if (blank(url) && !guard.ready && !guard.closing) {
                // The sterile attachment document must finish first. That lets
                // Electron establish the DOM guest id before a denied initial
                // request closes it, so the parent can show its exact context.
                task = guard.blankLoad = originalLoad(url, options);
            } else if (!blank(url) && !webTarget(url)) { crashClosed("UNSUPPORTED_PROTOCOL"); task = Promise.reject(new Error("Atlas blocked protocol")); }
            else task = guard.setup.then(() => {
                if (guard.closing || suspended || !runtime.view().enabled) throw new Error("Atlas viewer unavailable");
                return originalLoad(url, options);
            });
            // Electron also calls loadURL internally without awaiting its result.
            // Keep rejection observable to callers without process-wide warnings.
            task = task.catch(error => { if (guard.closing) throw new Error("Atlas stopped navigation."); throw error; });
            task.catch(() => {}); return task;
        };
        const denyPopup = () => ({ action: "deny" });
        const setWindowOpen = contents.setWindowOpenHandler.bind(contents);
        setWindowOpen(denyPopup);
        // Obsidian installs its own guest handlers too. Later registration cannot
        // replace the synchronous deny rule and create an ungoverned popup.
        contents.setWindowOpenHandler = () => setWindowOpen(denyPopup);
        contents.on("will-frame-navigate", (event, legacyUrl, _inPlace, legacyMain) => {
            const url = event.url ?? legacyUrl;
            const isMainFrame = event.isMainFrame ?? legacyMain ?? true;
            if (!isMainFrame) return; // ordinary embedded documents are outside the top-level policy gate
            if (blank(url) && guard.ready) { guard.provenance = null; void runtime.retireDocument(context); return; }
            if (guard.closing || suspended || !runtime.view().enabled || (!blank(url) && !webTarget(url))) {
                event.preventDefault(); crashClosed("UNSUPPORTED_OR_UNAVAILABLE_NAVIGATION"); return;
            }
            const initiator = event.initiator;
            // Native frame identity, exact current document URL, and saved Core
            // arrival are required. Iframe promotion supplies no root departure.
            guard.provenance = { url, initiatorIsMainFrame: !!initiator && initiator === contents.mainFrame,
                initiatorURL: initiator?.url ?? null, sourceURL: contents.getURL() };
        });
        contents.on("will-navigate", (event, url) => {
            if (!blank(event.url ?? url) && !webTarget(event.url ?? url)) event.preventDefault();
        });
        contents.on("will-redirect", (event, url, _inPlace, isMainFrame) => {
            if ((event.isMainFrame ?? isMainFrame) && !blank(event.url ?? url) && !webTarget(event.url ?? url)) {
                event.preventDefault(); crashClosed("UNSUPPORTED_PROTOCOL");
            }
        });
        contents.on("did-start-navigation", (event, url, _inPlace, isMainFrame) => {
            if ((event.isMainFrame ?? isMainFrame) && !blank(event.url ?? url) && !webTarget(event.url ?? url)) {
                contents.stop(); crashClosed("UNSUPPORTED_PROTOCOL");
            }
        });
        contents.on("did-navigate", () => {
            // Evict prior documents, including BFCache. Obsidian's separate leaf
            // history still restores each URL through loadURL and the Fetch gate.
            try { contents.navigationHistory.clear(); }
            catch (_) { crashClosed("HISTORY_FENCE_FAILED"); }
        });
        // Same-document changes use the ordered Page protocol stream below.
        // Electron's separate in-page event may precede Core's ARRIVAL receipt.
        contents.on("render-process-gone", () => crashClosed("RENDERER_GONE"));
        contents.on("did-stop-loading", () => { guard.provenance = null; });
        contents.on("destroyed", () => {
            guard.closing = true;
            clearTimeout(guard.deadlineTimer); clearTimeout(guard.setupTimer);
            for (const timer of guard.requestTimers.values()) clearTimeout(timer);
            guard.requestTimers.clear(); guards.delete(contents.id);
            void runtime.close(context);
        });
        contents.debugger.on("detach", () => { if (!guard.closing) crashClosed("INTERCEPTION_LOST"); });
        contents.debugger.on("message", (_event, method, params) => {
            if (guard.closing) return;
            if (method === "Network.requestWillBeSent" && params.type === "Document" && params.frameId === guard.frameId) {
                guard.network.set(params.requestId, { url: params.request.url, loaderId: params.loaderId, method: params.request.method });
                if (guard.network.size > 64) guard.network.delete(guard.network.keys().next().value);
            } else if (method === "Fetch.requestPaused") {
                void paused(guard, params);
            } else if (method === "Page.frameNavigated" && !params.frame.parentId) {
                guard.frameId = params.frame.id;
                guard.document = { loaderId: params.frame.loaderId, url: params.frame.url };
                const arrivalKey = `${params.frame.loaderId}:${params.frame.url}`;
                if (guard.lastArrival === arrivalKey) return;
                guard.lastArrival = arrivalKey;
                void runtime.arrive(context, { url: params.frame.url, loaderId: params.frame.loaderId });
            } else if (method === "Page.navigatedWithinDocument" && params.frameId === guard.frameId) {
                if (!guard.document || !runtime.sameDocument(context, { url: params.url, loaderId: guard.document.loaderId })) {
                    if (!blank(params.url)) crashClosed("UNEXPECTED_URL_CHANGE"); return;
                }
                guard.document.url = params.url; void runtime.observe();
            }
        });
        guard.setupTimer = setTimeout(() => crashClosed("INTERCEPTION_SETUP_TIMEOUT"), 10_000);
        guard.setupTimer.unref?.();
        guard.setup = (async () => {
            try {
                if (!contents.navigationHistory?.clear || !contents.debugger?.attach) throw new Error("Missing guard capability");
                // Start a sterile document before asynchronous protocol setup.
                // New guests already attach blank; existing guests are closed by
                // installation rather than adopting previously rendered content.
                await attached;
                await (guard.blankLoad ?? originalLoad("about:blank"));
                contents.debugger.attach("1.3");
                await contents.debugger.sendCommand("Page.enable");
                const tree = await contents.debugger.sendCommand("Page.getFrameTree");
                guard.frameId = tree.frameTree.frame.id;
                await contents.debugger.sendCommand("Network.enable");
                // A service worker may serve a navigation without a network
                // request. Bypass it for these guests so every document is held.
                await contents.debugger.sendCommand("Network.setBypassServiceWorker", { bypass: true });
                await contents.debugger.sendCommand("Fetch.enable", {
                    patterns: [{ urlPattern: "*", resourceType: "Document", requestStage: "Request" }]
                });
                if (guard.closing) throw new Error("Guest closed during setup");
                guard.ready = true; clearTimeout(guard.setupTimer);
            } catch (_) { crashClosed("INTERCEPTION_UNAVAILABLE"); throw new Error("Atlas interception unavailable"); }
        })();
        guard.setup.catch(() => {});
        return guard;
    }

    async function paused(guard, params) {
        const { contents, context } = guard;
        const send = (method, args) => contents.debugger.sendCommand(method, args);
        const reject = () => send("Fetch.failRequest", { requestId: params.requestId, errorReason: "BlockedByClient" }).catch(() => {});
        if (!guard.ready || guard.closing || suspended) { await reject(); guard.crashClosed("INTERCEPTION_NOT_READY"); return; }
        if (params.frameId !== guard.frameId) {
            // Fetch sees subframes as Documents too. They create neither a Journey
            // context nor privileges for a later promotion into the top frame.
            await send("Fetch.continueRequest", { requestId: params.requestId }).catch(() => guard.crashClosed("RELEASE_FAILED"));
            return;
        }
        const network = guard.network.get(params.networkId);
        if (!network || network.url !== params.request.url || network.method !== params.request.method || !network.loaderId) {
            await reject(); guard.crashClosed("MISSING_NAVIGATION_CORRELATION"); return;
        }
        const provenance = guard.provenance?.url === params.request.url && guard.provenance.sourceURL === guard.provenance.initiatorURL
            ? guard.provenance : null;
        guard.provenance = null;
        const request = { requestId: params.requestId, loaderId: network.loaderId, url: params.request.url, method: params.request.method,
            redirectedFrom: params.redirectedRequestId ?? null, redirectTarget: params.redirectedRequestId ? params.request.url : null,
            initiatorIsMainFrame: provenance?.initiatorIsMainFrame ?? false, initiatorURL: provenance?.initiatorURL ?? null };
        const timer = setTimeout(() => { void reject(); guard.crashClosed("NAVIGATION_CHECK_TIMEOUT"); }, 10_000);
        timer.unref?.(); guard.requestTimers.set(params.requestId, timer);
        try {
            await runtime.navigate(context, request, async response => {
                if (guard.closing || !guard.ready || suspended) throw new Error("Guest closed");
                // Protect already-loaded content independently of the operation
                // queue, including while storage or a new request is stalled.
                setLease(guard, response);
                await send("Fetch.continueRequest", { requestId: params.requestId });
            }, () => { void reject(); });
        } catch (_) { await reject(); guard.crashClosed("NAVIGATION_CHECK_FAILED"); }
        finally { clearTimeout(timer); guard.requestTimers.delete(params.requestId); }
    }

    function setLease(guard, response) {
        clearTimeout(guard.deadlineTimer);
        // While a new request is held/loading, the old document is still alive.
        // An unbounded Whitelist destination must not remove its old deadline.
        const deadlines = [response.decision?.expiresAt,
            guard.context.displayed?.response.decision?.expiresAt].filter(Number.isSafeInteger);
        if (deadlines.length === 0) return;
        const expiresAt = Math.min(...deadlines);
        // This timer only removes expired content. It cannot establish permission
        // or recreate a Journey. The runtime separately persists observation.
        const delay = Math.max(0, Math.min(2_147_483_647, expiresAt - runtime.now()));
        guard.deadlineTimer = setTimeout(() => {
            if (!Number.isSafeInteger(runtime.now()) || runtime.now() >= expiresAt) guard.crashClosed("AUTHORIZATION_EXPIRED");
            else setLease(guard, response);
        }, delay);
        guard.deadlineTimer.unref?.();
    }

    function closeGuest(guard) {
        if (guard.closing || guard.contents.isDestroyed()) return;
        guard.closing = true; guard.ready = false;
        clearTimeout(guard.deadlineTimer);
        guard.contents.stop();
        // Retire the protocol transport before destroying its native owner.
        // Closing is already latched, so detachment cannot reopen a request.
        try { if (guard.contents.debugger.isAttached()) guard.contents.debugger.detach(); } catch (_) { /* close remains mandatory */ }
        guard.contents.close({ waitForBeforeUnload: false });
    }

    /** @param {Electron.WebContents} contents */
    function protectHost(contents) {
        if (hosts.has(contents.id)) return;
        const pending = [];
        const willAttach = (event, preferences, params) => {
            if (params.partition !== partition && preferences.partition !== partition) return;
            if (suspended || !runtime.view().enabled) { event.preventDefault(); return; }
            pending.push(params.src);
            params.src = "about:blank";
            Object.assign(preferences, { nodeIntegration: false, nodeIntegrationInSubFrames: false,
                nodeIntegrationInWorker: false, contextIsolation: true, sandbox: true,
                webSecurity: true, allowRunningInsecureContent: false, webviewTag: false });
            delete preferences.preload;
        };
        const didAttach = (_event, guest) => {
            if (guest.session !== browserSession) return;
            const initial = pending.shift(), guard = protectGuest(guest);
            guard.initialOrigin = homeOrigin(initial);
            guard.attached();
            if (initial && !blank(initial)) guard.setup.then(() => {
                if (!guard.closing && guard.userLoads === 0) void guest.loadURL(initial).catch(() => {});
            }).catch(() => {});
        };
        contents.on("will-attach-webview", willAttach);
        contents.on("did-attach-webview", didAttach);
        hosts.set(contents.id, { contents, willAttach, didAttach });
        contents.on("destroyed", () => hosts.delete(contents.id));
    }

    const created = (_event, contents) => {
        if (contents.getType() === "webview") {
            if (contents.session === browserSession) protectGuest(contents);
        } else if (contents.getType() === "window") protectHost(contents);
    };
    app.on("web-contents-created", created);
    // Existing content has no proven startup correlation. Close it immediately;
    // renderer recreates its requested view only behind the installed blank gate.
    for (const contents of webContents.getAllWebContents()) {
        if (contents.getType() === "webview" && contents.session === browserSession) {
            // Retain only a closed explanation and sanitized destination. Never
            // adopt the old page as a loaded root or an allowed request.
            const context = runtime.attach(contents.id, {
                block() { if (!contents.isDestroyed()) { contents.stop(); contents.close({ waitForBeforeUnload: false }); } },
                lease() {}, openHome(origin) { onOpenHome({ nativeId: contents.id, contextId: context.id, origin }); }
            });
            context.origin = homeOrigin(contents.getURL());
            contents.once("destroyed", () => { void runtime.close(context); });
            runtime.block(context, "UNVERIFIED_EXISTING_CONTENT");
        } else if (contents.getType() === "window") protectHost(contents);
    }
    const download = event => event.preventDefault();
    browserSession.on("will-download", download);
    return Object.freeze({
        getGuard(id) { return guards.get(id); },
        suspend() { suspended = true; runtime.suspend(); },
        resume() { suspended = false; },
        // Only process shutdown/tests release native hooks. Plugin unload keeps
        // enforcement installed; it must not become a browser-unlock command.
        shutdown() {
            suspended = true; runtime.suspend();
            app.removeListener("web-contents-created", created);
            browserSession.removeListener("will-download", download);
            for (const item of hosts.values()) {
                if (!item.contents.isDestroyed()) {
                    item.contents.removeListener("will-attach-webview", item.willAttach);
                    item.contents.removeListener("did-attach-webview", item.didAttach);
                }
            }
        }
    });
}

module.exports = { createWebviewerEnforcement };
