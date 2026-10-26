"use strict";
// Real Electron guests, a local HTTP server and an isolated temporary profile.
// Never loads the user's vault, account cookies, extensions or live Obsidian.
const { app, BrowserWindow, webContents } = require("electron");
const electron = require("electron"), fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), assert = require("assert/strict");
const { AtlasFileRepository } = require("../../obsidian/persistence");
const { createAtlasRuntime } = require("../../obsidian/runtime");
const { createWebviewerEnforcement } = require("../../obsidian/webviewer");
const directory = process.env.ATLAS_NATIVE_TEST_ROOT || fs.mkdtempSync(path.join(os.tmpdir(), "atlas-native-test-"));
app.setPath("userData", path.join(directory, "profile"));
app.commandLine.appendSwitch("host-resolver-rules", "MAP *.test 127.0.0.1, MAP chatgpt.com 127.0.0.1, MAP www.chatgpt.com 127.0.0.1");
app.commandLine.appendSwitch("no-proxy-server");
app.commandLine.appendSwitch("disable-gpu");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
    const end = Date.now() + 7000;
    while (Date.now() < end) { const value = predicate(); if (value) return value; await delay(10); }
    throw new Error(`Timed out: ${label}`);
}
let repository, enforcement, window, server, runtime, port, now = 10000, passed = 0;
const requests = [], trace = [];
const configuration = { accessTiming: { waitMs: 10, confirmationWindowMs: 5000, grantDurationMs: 300 },
    vaultTiming: { waitMs: 10, confirmationWindowMs: 5000 }, journeyLimits: { lifetimeMs: 3000, maxHops: 5 } };
const url = (hostname, pathname = "/") => `http://${hostname}:${port}${pathname}`;
async function createGuest(initial = url("trusted.test"), adjustNative) {
    const attached = new Promise(resolve => window.webContents.once("did-attach-webview", (_event, guest) => resolve(guest)));
    await window.webContents.executeJavaScript(`(() => { const w=document.createElement('webview'); w.partition='persist:vault-atlas-test'; w.src=${JSON.stringify(initial)}; w.setAttribute('allowpopups',''); document.body.appendChild(w); })()`);
    const guest = await attached, guard = enforcement.getGuard(guest.id);
    adjustNative?.(guest);
    guest.debugger.on("message", (_event, method, params) => {
        if (["Fetch.requestPaused", "Network.requestWillBeSent", "Page.frameNavigated"].includes(method)) {
            trace.push({ method, requestId: params.requestId, networkId: params.networkId, frameId: params.frameId,
                redirectedRequestId: params.redirectedRequestId, loaderId: params.loaderId, url: params.request?.url ?? params.frame?.url });
            if (trace.length > 30) trace.shift();
        }
    });
    await until(() => ["DISPLAYED", "BLOCKED"].includes(guard.context.phase), "initial guest authorization");
    return { guest, guard, context: guard.context };
}
async function caseTest(name, work) {
    const before = new Set(webContents.getAllWebContents().map(item => item.id));
    await work(); passed++; console.log(`PASS ${name}`);
    for (const guest of webContents.getAllWebContents()) if (guest.getType() === "webview" && !before.has(guest.id) && !guest.isDestroyed()) guest.close({ waitForBeforeUnload: false });
    await window.webContents.executeJavaScript("document.body.replaceChildren()");
    await delay(30);
}
async function blockedAfter(item, action) {
    await action().catch(() => {});
    await until(() => item.context.phase === "BLOCKED", "blocked navigation");
    assert.equal(item.guest.isDestroyed(), true);
}
app.whenReady().then(async () => {
    server = http.createServer((request, response) => {
        const host = request.headers.host.split(":")[0], pathname = request.url;
        let body = ""; request.on("data", chunk => { body += chunk; });
        request.on("end", () => {
            requests.push({ host, pathname, method: request.method, body });
            if (pathname === "/redirect") { response.writeHead(302, { Location: url("idp.test", "/login") }); response.end(); return; }
            if (pathname === "/black-redirect") { response.writeHead(302, { Location: url("blocked.test") }); response.end(); return; }
            if (pathname === "/callback-redirect") { response.writeHead(302, { Location: url("idp.test", "/second") }); response.end(); return; }
            if (pathname === "/stall") return; // retain the old page while new response is deliberately stalled
            if (pathname === "/download") { response.setHeader("Content-Disposition", "attachment; filename=atlas-test.txt"); response.end("blocked download"); return; }
            if (pathname === "/sw.js") {
                response.setHeader("Content-Type", "application/javascript");
                response.end("self.addEventListener('install', e => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.clients.claim())); self.addEventListener('fetch', e => { if(e.request.mode === 'navigate') e.respondWith(new Response('<title>cached worker document</title>', {headers:{'Content-Type':'text/html'}})); });"); return;
            }
            response.setHeader("Content-Type", "text/html");
            response.end(`<!doctype html><title>${host}</title><p>${host}</p><a id="leave" href="${url("idp.test", "/login")}">Sign in</a><form id="form" method="post" action="${url("account.test", "/submit")}"><input name="token" value="retained-original-body"></form>`);
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve)); port = server.address().port;
    repository = new AtlasFileRepository(path.join(directory, "state"), { configuration });
    runtime = createAtlasRuntime({ repository, clock: { now: () => now }, configuration });
    await runtime.open(); await runtime.command({ kind: "INITIALIZE", policy: { whitelist: ["trusted.test", "trusted.localhost"], blacklist: ["blocked.test"] }, configuration });
    enforcement = createWebviewerEnforcement({ electron, runtime, partition: "persist:vault-atlas-test", onOpenHome() {} });
    window = new BrowserWindow({ show: false, webPreferences: { webviewTag: true, nodeIntegration: true, contextIsolation: false } });
    await window.loadFile(path.join(__dirname, "host.html"));
    console.log(`Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`);
    await caseTest("initial Whitelist document passes; native guest hardening is installed", async () => {
        const item = await createGuest(); assert.equal(item.context.phase, "DISPLAYED");
        const prefs = item.guest.getLastWebPreferences(); assert.equal(prefs.nodeIntegration, false); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.sandbox, true);
    });
    await caseTest("Strict fullscreen and dock preserve focused Atlas guest authorization and sandbox", async () => {
        const { createStrictHost } = require("../../../services/oath-strict-host");
        const { createRecovery, snapshot } = require("../../../tests/oath-host/recovery.cjs");
        const { installEscape } = require("../../../tests/oath-lifecycle/development-escape.cjs");
        const before = snapshot(window), proof = createRecovery(window);
        window.setFullScreen(true);
        window.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
        await until(() => proof.released, "development escape before Strict guards");
        await proof.settled; assert.deepEqual(snapshot(window), before);
        const host = createStrictHost(window), safety = installEscape(window, () => host.release(), () => {});
        try {
            await host.enter(); await host.openDock({ applications: [] }, { focus() {}, launch() {} });
            const item = await createGuest(); item.guest.focus();
            const prefs = item.guest.getLastWebPreferences();
            assert.equal(prefs.sandbox, true); assert.equal(prefs.nodeIntegration, false);
            assert.equal(prefs.contextIsolation, true); assert.equal(prefs.webSecurity, true);
            assert.equal(await item.guest.executeJavaScript("typeof require"), "undefined");
            assert(window.isFullScreen()); assert.equal(window.isAlwaysOnTop(), false);
            await blockedAfter(item, () => item.guest.loadURL(url("strict-unpermitted.test")));
            assert.equal(requests.some(request => request.host === "strict-unpermitted.test"), false);
            await host.maintain(); assert(window.isFullScreen());
        } finally { safety.dispose(); await host.release(); }
        assert.deepEqual(snapshot(window), before);
    });
    await caseTest("initial Greylist URL is held before the server sees it", async () => {
        const before = requests.length, item = await createGuest(url("unknown.test"));
        assert.equal(item.context.response.decision.outcome, "GREYLIST"); assert.equal(requests.slice(before).some(request => request.host === "unknown.test"), false);
    });
    await caseTest("programmatic loadURL and another guest cannot bypass policy", async () => {
        const item = await createGuest(); await blockedAfter(item, () => item.guest.loadURL(url("unknown.test", "/programmatic")));
        const second = await createGuest(url("blocked.test")); assert.equal(second.context.response.decision.outcome, "DENY");
    });
    await caseTest("script navigation from a temporary page is governed by Core", async () => {
        const item = await createGuest(url("unknown.test"));
        await runtime.command({ kind: "START_ACCESS", contextId: item.context.id, generation: item.context.generation });
        now += 10; await runtime.observe();
        await runtime.command({ kind: "CONFIRM_ACCESS_AND_OPEN", contextId: item.context.id, generation: item.context.generation });
        const granted = await createGuest(url("unknown.test")); assert.equal(granted.context.phase, "DISPLAYED");
        await blockedAfter(granted, () => granted.guest.executeJavaScript(`location.href=${JSON.stringify(url("unrelated.test"))}`));
    });
    await caseTest("reload after grant expiry closes the guest before another request", async () => {
        const item = await createGuest(url("unknown.test")); assert.equal(item.context.phase, "DISPLAYED");
        now += 300; const before = requests.length;
        item.guest.reload(); await until(() => item.context.phase === "BLOCKED", "expired reload");
        assert.equal(requests.length, before);
    });
    await caseTest("correlated HTTP redirect is a bounded Journey; Blacklist redirect is denied", async () => {
        const item = await createGuest(url("trusted.test", "/redirect"));
        assert.equal(item.context.response.decision.reason, "ACTIVE_JOURNEY");
        assert.equal(runtime.view().snapshot.journeyState.journeys.find(j => j.contextId === item.context.id).currentHostname, "idp.test");
        const denied = await createGuest(url("trusted.test", "/black-redirect")); assert.equal(denied.context.response.decision.outcome, "DENY");
    });
    await caseTest("native main-frame root departure and POST preserve the actual request body", async () => {
        const item = await createGuest();
        await item.guest.executeJavaScript("document.getElementById('leave').click()");
        await until(() => item.context.displayed?.url === url("idp.test", "/login"), "root departure");
        await item.guest.executeJavaScript("document.getElementById('form').submit()");
        await until(() => item.context.displayed?.url === url("account.test", "/submit"), "form continuation");
        assert.ok(requests.some(request => request.host === "account.test" && request.method === "POST" && request.body === "token=retained-original-body"));
    });
    await caseTest("iframe top promotion cannot attest a Whitelist root departure", async () => {
        const item = await createGuest();
        await item.guest.executeJavaScript(`(() => { const f=document.createElement('iframe'); f.srcdoc='<script>top.location.href=${JSON.stringify(url("iframe-escape.test"))}<\\/script>'; document.body.appendChild(f); })()`);
        await until(() => item.context.phase === "BLOCKED", "iframe promotion blocked");
        assert.equal(requests.some(request => request.host === "iframe-escape.test"), false);
    });
    await caseTest("window.open and target blank cannot create ungoverned native contents", async () => {
        const item = await createGuest(), before = webContents.getAllWebContents().length;
        await item.guest.executeJavaScript(`window.open(${JSON.stringify(url("popup.test"))}); const a=document.createElement('a'); a.href=${JSON.stringify(url("popup.test"))}; a.target='_blank'; document.body.appendChild(a); a.click();`);
        await delay(100); assert.equal(webContents.getAllWebContents().length, before); assert.equal(requests.some(request => request.host === "popup.test"), false);
    });
    await caseTest("native history cannot retain a prior page; host URL restoration still passes Fetch", async () => {
        const item = await createGuest(); await item.guest.loadURL(url("trusted.test", "/next"));
        await until(() => item.context.displayed?.url === url("trusted.test", "/next"), "second document");
        assert.equal(item.guest.navigationHistory.canGoBack(), false); assert.equal(item.guest.navigationHistory.canGoForward(), false);
        item.guest.goBack(); item.guest.goForward(); await delay(30);
        assert.equal(item.guest.getURL(), url("trusted.test", "/next"));
        await blockedAfter(item, () => item.guest.loadURL(url("history-unknown.test")));
    });
    await caseTest("service worker navigation responses cannot bypass the Document gate", async () => {
        const item = await createGuest(url("trusted.localhost"));
        await item.guest.executeJavaScript("navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => true)");
        const before = requests.filter(request => request.pathname === "/cached").length;
        await item.guest.loadURL(url("trusted.localhost", "/cached"));
        await until(() => item.context.displayed?.url === url("trusted.localhost", "/cached"), "worker bypass navigation");
        assert.equal(requests.filter(request => request.pathname === "/cached").length, before + 1);
        assert.equal(item.guest.getTitle(), "trusted.localhost");
    });
    await caseTest("downloads from governed guests are cancelled", async () => {
        const item = await createGuest(); let cancelled = false;
        const listener = event => { cancelled = event.defaultPrevented; };
        item.guest.session.once("will-download", listener);
        await item.guest.loadURL(url("trusted.test", "/download")).catch(() => {});
        await until(() => cancelled, "download cancellation");
    });
    await caseTest("old grant deadline survives a stalled Whitelist destination", async () => {
        const denied = await createGuest(url("lease.test"));
        await runtime.command({ kind: "START_ACCESS", contextId: denied.context.id, generation: denied.context.generation });
        now += 10; await runtime.observe();
        await runtime.command({ kind: "CONFIRM_ACCESS_AND_OPEN", contextId: denied.context.id, generation: denied.context.generation });
        const item = await createGuest(url("lease.test"));
        void item.guest.loadURL(url("trusted.test", "/stall")).catch(() => {});
        await until(() => item.context.flight?.url === url("trusted.test", "/stall"), "stalled navigation released");
        now += 300;
        await until(() => item.guest.isDestroyed(), "old content lease closes without a queued observation");
        assert.equal(item.context.displayed, null);
    });
    await caseTest("same-document changes retain authority and fragments do not miscorrelate arrival", async () => {
        const item = await createGuest(url("trusted.test", "/#fragment")); assert.equal(item.context.phase, "DISPLAYED");
        await item.guest.executeJavaScript("history.pushState({}, '', '/same-document#two')");
        await until(() => item.context.displayed?.url === url("trusted.test", "/same-document#two"), "same document update");
        await runtime.observe(); assert.equal(item.context.phase, "DISPLAYED");
    });
    await caseTest("debugger detachment and unsupported programmatic protocols fail closed", async () => {
        const item = await createGuest(); item.guest.debugger.detach(); await until(() => item.guest.isDestroyed(), "detach closure");
        const second = await createGuest(); await blockedAfter(second, () => second.guest.loadURL("file:///does-not-exist"));
    });
    await caseTest("blank replacement retires loaded source and old redirect/Journey identity", async () => {
        const item = await createGuest(url("trusted.test", "/redirect"));
        await item.guest.loadURL("about:blank");
        await until(() => runtime.view().snapshot.journeyState.journeys.find(j => j.contextId === item.context.id).phase === "ENDED", "blank retires Journey");
        assert.equal(item.context.displayed, null); assert.equal(item.context.flight, null);
        await blockedAfter(item, () => item.guest.loadURL(url("idp.test", "/old-context")));
        assert.equal(item.context.response.decision.outcome, "GREYLIST");
    });
    await caseTest("failed native interception setup withholds the initial document", async () => {
        const item = await createGuest(url("trusted.test", "/no-transport"), guest => {
            guest.debugger.sendCommand = async () => { throw new Error("injected protocol failure"); };
        });
        assert.equal(item.context.response.reason, "INTERCEPTION_UNAVAILABLE");
        assert.equal(requests.some(request => request.pathname === "/no-transport"), false);
    });
    await caseTest("a second native window shares authority and cannot borrow another viewer's Journey", async () => {
        const source = await createGuest(url("trusted.test", "/redirect"));
        assert.equal(source.context.response.decision.reason, "ACTIVE_JOURNEY");
        const originalWindow = window, other = new BrowserWindow({ show: false, webPreferences: { webviewTag: true, nodeIntegration: true, contextIsolation: false } });
        try {
            await other.loadFile(path.join(__dirname, "host.html")); window = other;
            const denied = await createGuest(url("idp.test", "/other-window"));
            assert.equal(denied.context.response.decision.outcome, "GREYLIST");
            assert.equal(requests.some(request => request.pathname === "/other-window"), false);
        } finally { await other.webContents.executeJavaScript("document.body.replaceChildren()"); other.close(); window = originalWindow; }
    });
    await caseTest("hot activation closes existing content without adopting its browser provenance", async () => {
        const attached = new Promise(resolve => window.webContents.once("did-attach-webview", (_event, guest) => resolve(guest)));
        await window.webContents.executeJavaScript(`(() => { const w=document.createElement('webview'); w.partition='persist:vault-atlas-hot'; w.src=${JSON.stringify(url("trusted.test", "/legacy"))}; document.body.appendChild(w); })()`);
        const legacy = await attached;
        await until(() => legacy.getURL() === url("trusted.test", "/legacy") && !legacy.isLoading(), "legacy page loaded before activation");
        const hotRepository = new AtlasFileRepository(path.join(directory, "hot-state"), { configuration });
        const hotRuntime = createAtlasRuntime({ repository: hotRepository, clock: { now: () => now }, configuration });
        await hotRuntime.open(); await hotRuntime.command({ kind: "INITIALIZE", policy: { whitelist: ["trusted.test"], blacklist: [] }, configuration });
        const hotEnforcement = createWebviewerEnforcement({ electron, runtime: hotRuntime, partition: "persist:vault-atlas-hot", onOpenHome() {} });
        try {
            assert.equal(legacy.isDestroyed(), true);
            const closed = hotRuntime.view().contexts[0];
            assert.equal(closed.closed, true); assert.equal(closed.origin, url("trusted.test"));
            assert.equal(hotRuntime.view().snapshot.journeyState.journeys.length, 0);
        } finally { hotEnforcement.shutdown(); await hotRuntime.observe(); hotRepository.close(); }
    });
    await caseTest("retained intermediate closes at Journey expiry without granting anything", async () => {
        const item = await createGuest(url("trusted.test", "/redirect")); now += 3000; await runtime.observe();
        assert.equal(item.guest.isDestroyed(), true); assert.equal(item.context.displayed, null);
        assert.equal(runtime.view().snapshot.accessState.grants.some(grant => grant.expiresAt > now), false);
    });
    await caseTest("a confirmed transient checkpoint failure recovers without reloading a valid native page", async () => {
        const item = await createGuest(), prior = runtime.view(), beforeRequests = requests.length, originalIO = repository.io, io = Object.create(fs);
        let injected = false;
        io.openSync = (name, ...args) => { if (!injected && path.basename(String(name)).startsWith(".authority-")) { injected = true; throw Object.assign(Error("injected busy candidate"), { code: "EBUSY" }); } return fs.openSync(name, ...args); };
        try {
            repository.io = io; now++; await runtime.observe();
            assert.ok(injected); assert.equal(runtime.view().status, "READY");
            assert.equal(runtime.view().recovery.automaticAttempts, prior.recovery.automaticAttempts + 1);
            assert.equal(runtime.view().recovery.automaticSucceeded, prior.recovery.automaticSucceeded + 1);
            assert.equal(item.guest.isDestroyed(), false); assert.equal(item.context.phase, "DISPLAYED");
            assert.equal(requests.length, beforeRequests, "Recovery never reloads or replays a request");
            assert.deepEqual(runtime.view().snapshot.policy, prior.snapshot.policy);
        } finally { repository.io = originalIO; }
        const denied = await createGuest(url("blocked.test", "/storage-still-denied"));
        assert.equal(denied.context.phase, "BLOCKED"); assert.equal(requests.some(r => r.pathname === "/storage-still-denied"), false);
    });
    await caseTest("persistent candidate failure exhausts one native recovery and manual recovery remains usable", async () => {
        const item = await createGuest(), prior = runtime.view(), originalIO = repository.io, io = Object.create(fs); let failures = 0;
        io.openSync = (name, ...args) => { if (path.basename(String(name)).startsWith(".authority-")) { failures++; throw Object.assign(Error("persistent busy candidate"), { code: "EBUSY" }); } return fs.openSync(name, ...args); };
        try {
            repository.io = io; now++; await runtime.observe();
            assert.equal(runtime.view().status, "UNAVAILABLE"); assert.equal(item.guest.isDestroyed(), true);
            for (let i = 0; i < 20; i++) { now++; await runtime.observe(); }
            assert.equal(failures, 2); assert.equal(runtime.view().recovery.automaticAttempts, prior.recovery.automaticAttempts + 1);
            assert.equal(runtime.view().recovery.automaticFailed, prior.recovery.automaticFailed + 1); assert.deepEqual(runtime.view().snapshot.policy, prior.snapshot.policy);
        } finally { repository.io = originalIO; }
        await runtime.command({ kind: "RECOVER" }); assert.equal(runtime.view().status, "READY");
        const fresh = await createGuest(); assert.equal(fresh.context.phase, "DISPLAYED");
    });
    await caseTest("a real applied write with lost acknowledgement stays fenced until explicit native reconciliation", async () => {
        const item = await createGuest(), prior = runtime.view(), originalIO = repository.io, io = Object.create(fs); let injected = false;
        io.renameSync = (from, to) => { fs.renameSync(from, to); if (!injected) { injected = true; throw Object.assign(Error("lost native acknowledgement"), { code: "EIO" }); } };
        try {
            repository.io = io; now++; await runtime.observe(); assert.ok(injected);
            assert.equal(runtime.view().status, "RECONCILING"); assert.equal(item.guest.isDestroyed(), true);
            for (let i = 0; i < 5; i++) await runtime.observe();
            assert.equal(runtime.view().recovery.automaticAttempts, prior.recovery.automaticAttempts);
            assert.ok(repository.read("pending.json"));
        } finally { repository.io = originalIO; }
        await runtime.command({ kind: "RECOVER" }); assert.equal(runtime.view().status, "READY"); assert.equal(repository.read("pending.json"), null);
        assert.deepEqual(runtime.view().snapshot.policy, prior.snapshot.policy); const fresh = await createGuest(); assert.equal(fresh.context.phase, "DISPLAYED");
    });
    await caseTest("Obsidian renderer bridge and functional Atlas UI", async () => {
        const remoteMain = require("@electron/remote/main"); remoteMain.initialize();
        const uiDirectory = path.join(directory, "ui-plugin"); fs.mkdirSync(uiDirectory);
        const pluginDirectory = path.resolve(__dirname, "../../../..");
        fs.copyFileSync(process.env.ATLAS_NATIVE_TEST_BUNDLE ?? path.join(pluginDirectory, "atlas-native.cjs"), path.join(uiDirectory, "atlas-native.cjs"));
        const bundleDirectory = path.join(uiDirectory, "lib/atlas/managed/data"); fs.mkdirSync(bundleDirectory, { recursive: true });
        for (const name of ["hosts", "metadata.json"]) fs.copyFileSync(path.join(pluginDirectory, "lib/atlas/managed/data", name), path.join(bundleDirectory, name));
        // Operational fetch uses only the pinned fixture bytes in this suite.
        const net = require("electron").net, originalFetch = net.fetch;
        net.fetch = async () => new Response(fs.readFileSync(path.join(bundleDirectory, "hosts"), "utf8"), { headers: { etag: '"native-fixture"' } });
        const uiWindow = new BrowserWindow({ show: false, width: 1300, height: 940, webPreferences: { webviewTag: true, nodeIntegration: true, contextIsolation: false, backgroundThrottling: false } });
        remoteMain.enable(uiWindow.webContents); await uiWindow.loadFile(path.join(__dirname, "host.html"));
        const result = await uiWindow.webContents.executeJavaScript(`require(${JSON.stringify(path.join(__dirname, "renderer-fixture.cjs"))})(${JSON.stringify({ directory: uiDirectory, pluginDirectory, baseUrl: url("unknown.test") })})`);
        net.fetch = originalFetch;
        assert.match(result, /^PASS/); console.log(result);
        await uiWindow.webContents.executeJavaScript("document.body.replaceChildren()"); uiWindow.close();
    });
    assert.equal(passed, 25); console.log(`Native Atlas tests: ${passed} passed`);
    cleanup(0);
}).catch(error => { console.error(error.stack); console.error(JSON.stringify(trace.slice(-8))); if (runtime) console.error(JSON.stringify(runtime.view().contexts.slice(-2))); cleanup(1); });
async function cleanup(code) {
    enforcement?.shutdown(); server?.close();
    if (runtime) await runtime.observe(); // drain already queued close observations
    await delay(100); repository?.close();
    process.exitCode = code;
    if (window && !window.isDestroyed()) { await window.webContents.executeJavaScript("document.body.replaceChildren()").catch(() => {}); window.close(); }
    await delay(100);
    if (code) app.exit(code); else app.quit();
}
