"use strict";
const assert = require("assert/strict"), path = require("path"), { spawn } = require("child_process");
const { snapshot, createRecovery } = require("./recovery.cjs");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 5000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { const value = await check(); if (value) return value; await delay(50); }
    throw Error("Timed out: " + label);
}
function createExperiment({ electron, ownedWindows, fixture, report, stop }) {
    let host, guard, dock, companion, heartbeat, seq = 0, abort = false;
    const pending = new Map();
    const check = async (name, action) => {
        if (abort) throw Error("Experiment already released");
        try { const detail = await action(); report.checks.push({ name, status: "pass", detail }); console.log("PASS", name); return true; }
        catch (error) { report.checks.push({ name, status: "fail", detail: error.message }); console.error("FAIL", name, error.message); return false; }
    };
    function rpc(action, extra = {}) {
        return new Promise((resolve, reject) => {
            if (!companion?.connected) { reject(Error("Companion disconnected")); return; }
            const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error("Companion request timed out")); }, 2500);
            pending.set(id, { resolve, reject, timer }); companion.send({ token: fixture.token, id, action, ...extra });
        });
    }
    async function cleanup() {
        abort = true;
        const restoration = guard?.release("cleanup") ?? [];
        await guard?.settled;
        clearInterval(heartbeat);
        electron.ipcMain.removeHandler("oath-phase1:focus"); electron.ipcMain.removeHandler("oath-phase1:stop");
        if (dock && !dock.isDestroyed()) dock.destroy();
        if (companion && companion.exitCode === null && companion.signalCode === null) {
            const exited = new Promise(resolve => companion.once("exit", resolve));
            if (companion.connected) companion.send({ token: fixture.token, id: ++seq, action: "quit" });
            const kill = setTimeout(() => companion.kill(), 2000);
            await exited; clearTimeout(kill);
        }
        for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error("Experiment cleanup")); } pending.clear();
        if (restoration.length) throw Error("Restoration failed: " + restoration.join("; "));
    }
    return { electron, ownedWindows, fixture, report, stop, check, rpc, cleanup,
        get host() { return host; }, set host(value) { host = value; },
        get guard() { return guard; }, set guard(value) { guard = value; },
        get dock() { return dock; }, set dock(value) { dock = value; },
        get aborted() { return abort; },
        async launchCompanion(bounds) {
            const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
            companion = spawn(process.execPath, [path.join(__dirname, "companion.cjs")], { env, windowsHide: false, stdio: ["ignore", "ignore", "pipe", "ipc"] });
            companion.stderr.on("data", data => console.error("Companion:", data.toString().trim()));
            companion.on("error", error => { console.error(error.message); });
            companion.on("message", message => {
                if (message.type === "ready") companion.ready = message.state;
                const item = pending.get(message.id); if (!item) return;
                pending.delete(message.id); clearTimeout(item.timer);
                if (message.error) item.reject(Error(message.error)); else item.resolve(message.state);
            });
            heartbeat = setInterval(() => { if (companion.connected) companion.send({ type: "heartbeat", token: fixture.token }); }, 500);
            await until(() => companion.ready, "separate-process companion");
            assert.notEqual(companion.ready.pid, process.pid); assert.equal(companion.ready.parent, null);
            await rpc("bounds", { bounds }); return companion.ready;
        }
    };
}
async function run(ctx) {
    const { electron, fixture, report, check } = ctx, { screen, BrowserWindow, ipcMain } = electron;
    if (!fixture.safetyOnly && screen.getAllDisplays().length !== 1) throw Error("Phase 1 automatic tests require exactly one display");
    const display = screen.getPrimaryDisplay(); report.display = { bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor };
    await until(async () => {
        ctx.host = ctx.ownedWindows.find(win => !win.isDestroyed());
        if (!ctx.host) return false;
        return ctx.host.webContents.executeJavaScript("!!window.app?.plugins").catch(() => false);
    }, "Obsidian fixture opens", 40000);
    const win = ctx.host;
    await win.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();if(!app.plugins.plugins['hub-project-menu'])await app.plugins.enablePlugin('hub-project-menu');})()");
    await until(() => win.webContents.executeJavaScript("!!app.plugins.plugins['hub-project-menu']?.oathControl"), "Itacan footer mounts", 15000);
    await check("real Obsidian loads Itacan in the synthetic vault", async () => {
        const state = await win.webContents.executeJavaScript("({vault:app.vault.adapter.getBasePath(),oath:app.plugins.plugins['hub-project-menu'].oath.current,footer:!!document.querySelector('.hub-oath-statusbar')})");
        assert.equal(path.resolve(state.vault), path.resolve(fixture.vault)); assert.equal(state.oath, null); assert.equal(state.footer, true); return state;
    });
    if (report.checks.some(item => item.status === "fail")) throw Error("Isolation verification failed");
    await check("existing Obsidian bridge reaches main process and correct BrowserWindow", async () => {
        const modulePath = path.join(__dirname, "recovery.cjs");
        const value = await win.webContents.executeJavaScript(`({windowId:window.electronWindow?.id,...window.electron.remote.require(${JSON.stringify(modulePath)}).probe()})`);
        assert.equal(value.windowId, win.id); assert.equal(value.processType, "browser"); assert.equal(value.pid, process.pid); return value;
    });
    report.hostPreferences = Object.fromEntries(["nodeIntegration", "contextIsolation", "sandbox", "webSecurity", "webviewTag"].map(key => [key, win.webContents.getLastWebPreferences()[key]]));
    for (const flag of ["no-sandbox", "disable-web-security", "disable-setuid-sandbox"]) assert.equal(electron.app.commandLine.hasSwitch(flag), false, "Forbidden flag " + flag);
    // Visible identity and recovery instructions; no live Oath/service state is changed.
    await win.webContents.executeJavaScript(`(() => {
        document.querySelectorAll('.modal-container .modal-close-button,.modal-container .modal-header-button').forEach(button=>button.click());
        const banner=document.createElement('div');banner.id='oath-phase1-banner';banner.textContent='ISOLATED PHASE 1 • Ctrl+Alt+Shift+F12 releases • automatic timeout';
        banner.style.cssText='position:fixed;left:0;top:0;height:46px;width:100%;padding:10px 50px;box-sizing:border-box;background:#2454a6;color:white;z-index:2147483647;pointer-events:none;font:16px system-ui';document.body.append(banner);
    })()`);
    win.restore(); win.setBounds({ x: display.workArea.x + 40, y: display.workArea.y + 40, width: 900, height: 650 }); win.show();
    const initial = snapshot(win);
    let expectedEscape = false;
    const released = ({ reason }) => {
        if (reason === "development-shortcut" && !expectedEscape) void ctx.stop(Error("User used development escape; remaining cases cancelled"));
    };
    const escape = async () => {
        expectedEscape = true;
        try {
            win.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
            win.webContents.sendInputEvent({ type: "keyUp", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
            await until(() => ctx.guard.released, "local development escape"); await ctx.guard.settled;
        } finally { expectedEscape = false; }
    };
    const recoveryPassed = await check("BEFORE GUARDS: native local escape and state restoration", async () => {
        ctx.guard = createRecovery(win, { onRelease: released }); win.setSize(800, 600); win.setFullScreen(true);
        await until(() => win.isFullScreen(), "unguarded fullscreen"); await escape(); await delay(300);
        assert.deepEqual(snapshot(win), initial); return { shortcut: "Ctrl+Alt+Shift+F12", state: snapshot(win) };
    });
    const watchdogPassed = await check("BEFORE GUARDS: watchdog restores without renderer input", async () => {
        ctx.guard = createRecovery(win, { timeoutMs: 250, onRelease: released }); win.setFullScreen(true);
        await until(() => ctx.guard.released, "watchdog recovery"); await ctx.guard.settled; assert.deepEqual(snapshot(win), initial);
    });
    if (!recoveryPassed || !watchdogPassed || report.checks.some(item => item.status === "fail")) throw Error("Recovery prerequisite failed; guards were not enabled");
    if (fixture.safetyOnly) return;
    const b = display.bounds;
    await check("external fixture is an ordinary independent top-level application", () => ctx.launchCompanion({ x: b.x + 180, y: b.y + 120, width: 640, height: 440 }));
    ctx.dock = new BrowserWindow({ x: b.x, y: b.y + b.height - 64, width: b.width, height: 64,
        frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
        show: false, skipTaskbar: true, focusable: false, alwaysOnTop: true, backgroundColor: "#ca326c",
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
            partition: "oath-phase1-dock-" + fixture.token,
            webviewTag: false, devTools: false, preload: path.join(__dirname, "dock-preload.cjs") } });
    const dock = ctx.dock;
    dock.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    dock.webContents.on("will-navigate", event => event.preventDefault());
    dock.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    function trusted(event) { if (event.sender !== dock.webContents || event.senderFrame !== dock.webContents.mainFrame) throw Error("Unexpected dock sender"); }
    let dockFocusRequests = 0;
    ipcMain.handle("oath-phase1:focus", event => { trusted(event); dockFocusRequests++; win.focus(); return true; });
    ipcMain.handle("oath-phase1:stop", event => { trusted(event); ctx.guard?.release("dock-stop"); void ctx.stop(Error("Development dock stop requested")); return true; });
    await dock.loadFile(path.join(__dirname, "dock.html")); dock.showInactive();
    await check("separate dock has isolated sandboxed renderer and no parent", async () => {
        const preferences = dock.webContents.getLastWebPreferences();
        for (const key of ["sandbox", "contextIsolation", "webSecurity"]) assert.equal(preferences[key], true);
        assert.equal(preferences.nodeIntegration, false); assert.equal(preferences.webviewTag, false);
        assert.equal(dock.getParentWindow(), null); assert.equal(dock.isFocusable(), false); assert.equal(dock.isAlwaysOnTop(), true);
        const api = await dock.webContents.executeJavaScript("({require:typeof require,keys:Object.keys(window.oathExperiment)})");
        assert.equal(api.require, "undefined"); assert.deepEqual(api.keys.sort(), ["focusHost", "stop"]); return api;
    });
    for (const mode of ["fullscreen", "kiosk"]) {
        if (ctx.aborted) throw Error("Experiment was cancelled");
        ctx.guard = createRecovery(win, { safetyVerified: true, timeoutMs: 30000,
            onRelease: result => { released(result); if (result.reason === "watchdog") void ctx.stop(Error("Guard watchdog expired")); } });
        try {
            ctx.guard.arm(mode); await until(() => win.isFullScreen(), "guarded fullscreen");
            await check(mode + ": ordinary close and fullscreen exit are blocked", async () => {
                win.close(); assert.equal(win.isDestroyed(), false); win.setFullScreen(false); win.setKiosk(false);
                win.webContents.sendInputEvent({ type: "keyDown", keyCode: "F11" });
                win.webContents.sendInputEvent({ type: "keyUp", keyCode: "F11" });
                await delay(200); assert.equal(win.isFullScreen(), true); assert.equal(win.isMinimizable(), false); assert.equal(win.isClosable(), false);
            });
            await check(mode + ": host recovers programmatic minimization", async () => {
                win.minimize(); await delay(300); assert.equal(win.isMinimized(), false); assert.equal(win.isFullScreen(), true);
            });
            await check(mode + ": external app focuses while Itacan stays fullscreen", async () => {
                await ctx.rpc("focus"); await until(async () => (await ctx.rpc("state")).focused, "external foreground");
                await delay(300);
                const observed = { host: { focused: win.isFocused(), visible: win.isVisible(), bounds: win.getBounds(), contentBounds: win.getContentBounds() }, external: await ctx.rpc("state") };
                (report.observations ??= {})[mode] = observed;
                assert.equal(win.isFullScreen(), true); assert.equal(win.isAlwaysOnTop(), false); assert.equal(win.isFocused(), false, JSON.stringify(observed)); return observed;
            });
            await check(mode + ": external minimization and restore preserve fullscreen", async () => {
                await ctx.rpc("minimize"); await until(async () => (await ctx.rpc("state")).minimized, "external minimized");
                assert.equal(win.isFullScreen(), true); await ctx.rpc("restore");
                await until(async () => !(await ctx.rpc("state")).minimized, "external restored"); assert.equal(win.isFullScreen(), true);
            });
            await check(mode + ": desktop pixels show external app above host and dock above app", async () => {
                // Deliberately overlap the companion with the dock. Capture is sampled in memory;
                // only three RGB triples are retained, never desktop images or unrelated titles.
                await ctx.rpc("bounds", { bounds: { x: b.x + 180, y: b.y + 80, width: 640, height: b.height - 80 } });
                await ctx.rpc("focus"); dock.showInactive(); await delay(400);
                const sources = await electron.desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: b.width, height: b.height } });
                const source = sources.find(item => item.display_id === String(display.id)); assert(source && !source.thumbnail.isEmpty(), "No desktop capture evidence");
                const size = source.thumbnail.getSize(), bitmap = source.thumbnail.toBitmap();
                const sample = (x, y) => { const i = (Math.floor(y * size.height / b.height) * size.width + Math.floor(x * size.width / b.width)) * 4; return [bitmap[i + 2], bitmap[i + 1], bitmap[i]]; };
                const pixels = { host: sample(10, 20), external: sample(200, 300), dock: sample(200, b.height - 5) };
                report.observations[mode].pixels = pixels;
                report.observations[mode].captureSize = size;
                report.observations[mode].dockBounds = dock.getBounds();
                report.observations[mode].dockVisible = dock.isVisible();
                // Positive control: distinguish an absent marker from a broken desktop capture/stacking assumption.
                const own = await win.webContents.capturePage({ x: 10, y: 20, width: 1, height: 1 });
                const ownBytes = own.toBitmap(); report.observations[mode].hostRendererPixel = [ownBytes[2], ownBytes[1], ownBytes[0]];
                for (const [key, expected] of Object.entries({ host: [36, 84, 166], external: [39, 174, 96], dock: [202, 50, 108] }))
                    assert(pixels[key].every((value, i) => Math.abs(value - expected[i]) < 12), key + " pixel: " + pixels[key]);
                return pixels;
            });
            if (fixture.altTab) await check(mode + ": repeated OS-injected Alt+Tab switches host and external app", async () => {
                const transitions = [];
                win.focus(); await until(() => win.isFocused(), "host foreground before switching");
                await ctx.rpc("focus"); await until(async () => (await ctx.rpc("state")).focused, "companion foreground before switching");
                for (let i = 0; i < 4; i++) {
                    assert(win.isFocused() || (await ctx.rpc("state")).focused, "Focus left experiment; refusing more keyboard input");
                    await sendAltTab(); await delay(400);
                    const value = { host: win.isFocused(), external: (await ctx.rpc("state")).focused, dock: dock.isFocused(), full: win.isFullScreen() };
                    transitions.push(value); assert.equal(value.dock, false); assert.equal(value.full, true);
                    assert.equal(i % 2 === 0 ? value.host : value.external, true, JSON.stringify(transitions));
                    assert.equal(i % 2 === 0 ? value.external : value.host, false, "Contradictory or unchanged focus: " + JSON.stringify(transitions));
                }
                return transitions;
            });
            else report.checks.push({ name: mode + ": Alt+Tab", status: "not-run", detail: "Run explicitly with --alt-tab on an idle interactive desktop" });
            await check(mode + ": nonfocusable dock button sends validated action", async () => {
                // Targeted Chromium mouse delivery proves button/IPC, not physical hit testing.
                const beforeRequests = dockFocusRequests;
                const rect = await dock.webContents.executeJavaScript("(()=>{const r=document.getElementById('focus').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
                dock.webContents.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...rect });
                dock.webContents.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...rect });
                await until(() => dockFocusRequests === beforeRequests + 1, "dock click reaches validated IPC"); assert.equal(dock.isFocused(), false);
                return { actionDelivered: true, hostReportsFocus: win.isFocused(), physicalClickVerified: false };
            });
            await check(mode + ": development escape releases and restores exact state", async () => {
                await escape(); await delay(300); assert.deepEqual(snapshot(win), initial); return snapshot(win);
            });
        } finally { ctx.guard.release("case-finally"); const errors = await ctx.guard.settled; if (errors.length) throw Error(errors.join("; ")); }
    }
    await check("Itacan Oath persistence and footer remain unchanged", async () => {
        const value = await win.webContents.executeJavaScript("({oath:app.plugins.plugins['hub-project-menu'].oath.current,footer:!!document.querySelector('.hub-oath-statusbar')})");
        assert.equal(value.oath, null); assert.equal(value.footer, true); return value;
    });
}
function sendAltTab() {
    return new Promise((resolve, reject) => {
        // Windows' existing COM SendKeys is test input only: no hook, native DLL or focus workaround.
        const child = spawn(path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe"),
            ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", "$oathKeys = New-Object -ComObject WScript.Shell; $oathKeys.SendKeys('%{TAB}')"],
            { windowsHide: true, stdio: "ignore" });
        const timeout = setTimeout(() => { child.kill(); reject(Error("Alt+Tab input timed out")); }, 3000);
        child.once("error", error => { clearTimeout(timeout); reject(error); });
        child.once("exit", code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Error("Alt+Tab injector exited " + code)); });
    });
}
module.exports = { createExperiment, run };
