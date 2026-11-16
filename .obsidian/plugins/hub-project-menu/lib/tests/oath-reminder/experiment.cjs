"use strict";
const assert = require("node:assert/strict");
const path = require("node:path"), fs = require("node:fs"), { randomUUID } = require("node:crypto");
const { centeredBounds } = require("../../services/oath-reminder-placement.cjs");
const { ReminderState } = require("./state.cjs");
const { Supervisor } = require("../oath-windows/supervisor.cjs");
const { launchApplication } = require("../../services/oath-dock");
const { createStrictHost } = require("../../services/oath-strict-host");
const { installPrototypeRecovery } = require("../../services/oath-prototype-host");
const { applications } = require("../../domain/oath-strict");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const handle = win => win.getNativeWindowHandle().readInt32LE(); // Pinned provider's signed LONG representation.
async function run(ctx) {
    ctx.fixture.safetyOnly = true;
    await require("../oath-host/experiment.cjs").run(ctx);
    if (ctx.report.checks.some(item => item.status !== "pass")) throw Error("Recovery prerequisites failed");
    const { BrowserWindow, ipcMain, screen, powerMonitor } = ctx.electron;
    const host = ctx.host, adapter = new Supervisor(ctx.electron.utilityProcess);
    const state = new ReminderState();
    const channel = "oath-reminder-" + randomUUID();
    let reminder, control, timer, freshness, observationDeadline, stopped = false, started = false, visible = false;
    let suspended = false;
    let observeOnly = false, raising = false, raisingFailed = false, lastRaise = -Infinity, lastSuccess = -Infinity;
    let permitted = new Set(), recovery, finish, displayId = null;
    let lastForeground = null, lastControl = 0;
    const stats = { samples: 0, unknown: 0, shows: 0, hides: 0, raises: 0, maxQueryMs: 0 };
    const done = new Promise(resolve => { finish = resolve; });
    const strictHost = createStrictHost(host, { desktop: ctx.electron });
    const coordinator = { host: strictHost, update(health) {
        if (health.developmentRecoveryReleased) { stopMonitoring(); finish(); }
    }, async release() { stopMonitoring(); await strictHost.release(); } };
    installPrototypeRecovery(host, coordinator, ctx.electron);
    strictHost.onLost(() => { void coordinator.release().then(finish); });
    const previousCleanup = ctx.cleanup;
    function sendStatus(status) { if (control && !control.isDestroyed()) control.webContents.send(channel + ":model", { status }); }
    function stopMonitoring() {
        stopped = true; clearTimeout(timer); clearTimeout(observationDeadline); clearInterval(freshness); adapter.stop(); state.reset();
        if (reminder && !reminder.isDestroyed()) reminder.destroy();
    }
    ctx.cleanup = async () => {
        stopMonitoring(); powerMonitor.removeListener("lock-screen", suspend); powerMonitor.removeListener("suspend", suspend); powerMonitor.removeListener("unlock-screen", resume); powerMonitor.removeListener("resume", resume);
        for (const event of ["display-added","display-removed","display-metrics-changed"]) screen.removeListener(event, relocate);
        ipcMain.removeHandler(channel);
        await strictHost.release();
        if (control && !control.isDestroyed()) control.destroy();
        if (recovery && !recovery.isDestroyed()) recovery.destroy();
        ctx.report.reminder = { ...stats, physicalAcceptance: "pending", productionSuitable: false };
        await previousCleanup();
    };
    function secureWindow(options) {
        const win = new BrowserWindow({ ...options, show: false, webPreferences: {
            preload: path.join(__dirname, "preload.cjs"), additionalArguments: ["--reminder-channel=" + channel],
            partition: channel, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, devTools: false } });
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        win.webContents.on("will-navigate", event => event.preventDefault());
        win.webContents.session.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
        win.webContents.session.setPermissionCheckHandler(() => false);
        win.webContents.on("before-input-event", (event, key) => {
            if (key.type === "keyDown" && key.key === "F12" && key.control && key.alt && key.shift) {
                event.preventDefault(); void coordinator.release().then(finish);
            }
        });
        return win;
    }
    function place(foreground) {
        const result = centeredBounds(screen, foreground, host.getBounds(), displayId);
        displayId = result.displayId;
        if (JSON.stringify(reminder.getBounds()) !== JSON.stringify(result.bounds)) reminder.setBounds(result.bounds);
    }
    function render(model, foreground) {
        if (stopped || observeOnly || reminder.isDestroyed()) return;
        if (!model.visible) {
            if (visible) { reminder.hide(); stats.hides++; }
            visible = false; lastRaise = -Infinity; return;
        }
        if (foreground) place(foreground);
        reminder.webContents.send(channel + ":model", { label: model.label });
        if (!visible) { reminder.showInactive(); visible = true; stats.shows++; lastRaise = performance.now(); }
        if (raising && !raisingFailed && foreground && performance.now() - lastRaise >= 3000) {
            try { reminder.moveTop(); stats.raises++; lastRaise = performance.now(); }
            catch { raisingFailed = true; sendStatus("Raising failed. Reminder visibility is limited."); }
        }
    }
    function classify(foreground) {
        if (!foreground) return "unknown";
        if (foreground.pid === process.pid) {
            if (foreground.handle === handle(reminder)) return "self";
            const owned = [host, control, recovery];
            if (foreground.handle === Number(BigInt.asIntN(32, BigInt(strictHost.identity.dockHandle ?? 0)))) return "permitted";
            if (owned.some(win => win && !win.isDestroyed() && foreground.handle === handle(win))) return "permitted";
        }
        if (foreground.identity !== "observed" || !foreground.executable) return "unknown";
        return permitted.has(foreground.executable) ? "permitted" : "non-permitted";
    }
    async function poll() {
        if (stopped) return;
        try {
            const sample = await adapter.request("foreground");
            if (stopped) return;
            lastSuccess = performance.now(); lastForeground = sample.foreground;
            stats.samples++; stats.maxQueryMs = Math.max(stats.maxQueryMs, sample.durationMs);
            const kind = suspended ? "unknown" : classify(sample.foreground);
            if (kind === "unknown") stats.unknown++;
            const label = sample.foreground?.executable ? path.win32.basename(sample.foreground.executable) : "";
            render(state.sample(kind, lastSuccess, label), kind === "non-permitted" ? sample.foreground : null);
            if (lastSuccess - lastControl > 1000) {
                lastControl = lastSuccess;
                sendStatus(`${kind} | ${label} | reminder ${state.state} | ${stats.samples} samples | max query ${stats.maxQueryMs.toFixed(1)} ms`);
            }
        } catch (error) {
            stopMonitoring(); sendStatus("Foreground observer stopped. " + error.message);
        } finally { if (!stopped) timer = setTimeout(poll, 250); }
    }
    function suspend() { suspended = true; state.reset(); render({ visible: false }); }
    function resume() { suspended = false; state.reset(); lastSuccess = -Infinity; }
    function relocate() { place(lastForeground); }
    powerMonitor.on("unlock-screen", resume); powerMonitor.on("resume", resume);
    powerMonitor.on("lock-screen", suspend); powerMonitor.on("suspend", suspend);
    for (const event of ["display-added","display-removed","display-metrics-changed"]) screen.on(event, relocate);
    reminder = secureWindow({ width: 380, height: 230, frame: false, movable: false, resizable: false, minimizable: false,
        maximizable: false, fullscreenable: false, closable: false, skipTaskbar: true, alwaysOnTop: true });
    await reminder.loadFile(path.join(__dirname, "reminder.html"));
    reminder.on("close", event => { if (!stopped) event.preventDefault(); });
    reminder.on("will-move", event => event.preventDefault());
    reminder.webContents.on("render-process-gone", () => { stopMonitoring(); sendStatus("Reminder renderer stopped. Release and finish this experiment."); });
    control = secureWindow({ width: 560, height: 490, title: "Oath Reminder experiment recovery", alwaysOnTop: true });
    control.on("closed", () => { void coordinator.release().then(finish); });
    ipcMain.handle(channel, async (event, action, value) => {
        if (event.senderFrame !== event.sender.mainFrame) throw Error("Invalid frame");
        if (!reminder.isDestroyed() && event.sender === reminder.webContents && action === "return") { host.focus(); return; }
        if (event.sender !== control.webContents) throw Error("Invalid sender");
        if (action === "release") { await coordinator.release(); finish(); return; }
        if (!["start", "observe"].includes(action) || started || stopped) throw Error("Start a fresh experiment");
        const verified = applications((value?.paths ?? []).map(file => fs.realpathSync.native(file)));
        permitted = new Set(verified); observeOnly = action === "observe"; raising = !!value?.raising;
        reminder.setAlwaysOnTop(!raising);
        try {
        await coordinator.developmentRecovery.verify();
        recovery = BrowserWindow.getAllWindows().find(win => win.getTitle() === "Itacan prototype recovery");
        if (!observeOnly) { await strictHost.enter(); await strictHost.openDock({ applications: verified }, { focus: () => host.focus(), launch: async file => { const verifiedPath = applications([fs.realpathSync.native(file)])[0]; if (!permitted.has(verifiedPath)) throw Error("Application is not permitted"); return launchApplication(verifiedPath, []); } }); }
        started = true; adapter.start();
        const caps = await adapter.request("capabilities");
        if (!caps.observation) { stopMonitoring(); throw Error(caps.loadError); }
        freshness = setInterval(() => { if (!stopped && performance.now() - lastSuccess > 500) { state.reset(); render({ visible: false }); } }, 100);
        void poll();
        if (observeOnly) observationDeadline = setTimeout(() => { stopMonitoring(); finish(); }, 120000);
        } catch (error) { await coordinator.release(); throw error; }
    });
    await control.loadFile(path.join(__dirname, "control.html")); control.show();
    if (ctx.fixture.reminderSmoke) {
        await ctx.check("Reminder renderer is sandboxed and close requests do not dismiss it", async () => {
            const prefs = reminder.webContents.getLastWebPreferences();
            assert(prefs.sandbox && prefs.contextIsolation && !prefs.nodeIntegration && prefs.webSecurity);
            reminder.close(); assert(!reminder.isDestroyed());
        });
        await control.webContents.executeJavaScript("window.reminder.action('start',{paths:[],raising:false})");
        await ctx.check("Reminder recognizes its own HWND separately from permitted work", async () => {
            assert.equal(classify({ pid: process.pid, handle: handle(reminder) }), "self");
            assert.equal(classify({ pid: process.pid, handle: handle(host) }), "permitted");
        });
        const companion = await ctx.launchCompanion({ x: 180, y: 150, width: 640, height: 440 });
        await ctx.rpc("focus");
        // A programmatic focus request cannot establish a physical test precondition.
        const focusDeadline = Date.now() + 5000;
        while (!stopped && lastForeground?.pid !== companion.pid && Date.now() < focusDeadline) await delay(100);
        if (lastForeground?.pid !== companion.pid) {
            ctx.report.checks.push({ name: "Native companion foreground and no-activation appearance", status: "not-run",
                detail: "Windows did not grant the companion foreground. Physical switching is required; automatic restoration was not attempted." });
        } else await ctx.check("Native foreground identity and three-second reminder appearance", async () => {
            const until = Date.now() + 6000;
            while (Date.now() < until && !visible && !stopped) await delay(100);
            assert(visible, "Companion did not remain Windows foreground long enough");
            assert.equal(lastForeground.pid, companion.pid);
            assert.equal(lastForeground.handle, companion.handle);
            assert.equal(lastForeground.identity, "observed");
            assert(reminder.isAlwaysOnTop());
            await delay(300);
            assert.equal(lastForeground?.pid, companion.pid, "Showing the reminder must preserve companion foreground");
        });
        await ctx.check("Live foreground polling remains responsive with bounded helper requests", async () => {
            assert(stats.samples > 0); assert(stats.maxQueryMs < 2500);
            assert(adapter.child, "Foreground helper must remain healthy");
        });
        await ctx.check("Native reminder showInactive preserves the current foreground", async () => {
            clearTimeout(timer);
            while (adapter.pending) await delay(20);
            const before = (await adapter.request("foreground")).foreground;
            assert(before?.identity === "observed", "Readable foreground required");
            render({ visible: false });
            render({ visible: true, label: "Synthetic fixture" });
            await delay(300);
            const after = (await adapter.request("foreground")).foreground;
            assert.equal(after?.pid, before.pid);
            assert.equal(after?.handle, before.handle);
            assert(reminder.isVisible());
            render({ visible: false }); assert(!reminder.isVisible());
        });
        await ctx.check("Independent prototype recovery removes reminder and fullscreen guards", async () => {
            await coordinator.developmentRecovery.release();
            assert(reminder.isDestroyed()); assert(!host.isFullScreen());
        });
        finish();
    }
    ctx.report.limitations.push("Reminder experiment only. Third-party apps, actual occlusion, shell surfaces, virtual desktops and sustained leak measurements require physical acceptance.");
    await done;
}
module.exports = { run };
