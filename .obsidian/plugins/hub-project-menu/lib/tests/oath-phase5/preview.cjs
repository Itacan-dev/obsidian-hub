"use strict";
// Explicit development entrypoint. Never imported by product code.
const assert = require("node:assert/strict"), path = require("node:path");
const { snapshot } = require("../oath-host/recovery.cjs");
const setup = require("./setup.cjs");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(ctx) {
    ctx.fixture.safetyOnly = true;
    try { await require("../oath-host/experiment.cjs").run(ctx); } finally { ctx.fixture.safetyOnly = false; }
    if (ctx.report.checks.some(check => check.status !== "pass")) throw Error("Recovery prerequisites failed");
    const { BrowserWindow, ipcMain, app } = ctx.electron, win = ctx.host, strict = win.__hubStrictOathCoordinator, before = snapshot(win);
    let closed = false, released = false, watchdog, finish;
    const done = new Promise(resolve => { finish = resolve; });
    const control = new BrowserWindow({ width: 440, height: 340, title: "Strict Oath preview recovery", alwaysOnTop: true,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false,
            partition: "oath-preview-control-" + ctx.fixture.token, preload: path.join(__dirname, "preview-preload.cjs") } });
    const status = message => { if (!control.isDestroyed()) control.webContents.send("oath-preview:status", message); };
    const js = code => win.webContents.executeJavaScript(code);
    const release = async reason => {
        released = true; clearTimeout(watchdog);
        await strict.release(strict.current?.id);
        await js("(async()=>{const s=phase5.service;await s.setStrictEnabled(false);if(s.current?.state==='scheduled')await s.end(s.current.id,'cancel');else await s.refresh();})()");
        assert.deepEqual(snapshot(win), before);
        ctx.report.previewRecovery = { reason, restored: true };
        status("Restrictions released and window restored. Finish this preview, then launch a fresh one to test again.");
    };
    // Local Electron events only: works in this fixture's host, recovery window and guests.
    const contents = new Set();
    const input = (event, key) => {
        if (key.type === "keyDown" && key.key === "F12" && key.control && key.alt && key.shift) {
            event.preventDefault(); void release("development-shortcut").catch(error => status(error.message));
        }
    };
    const watch = (_event, item) => { item.on("before-input-event", input); contents.add(item); };
    for (const item of ctx.electron.webContents.getAllWebContents()) watch(null, item);
    app.on("web-contents-created", watch);
    const originalEnter = strict.host.enter;
    strict.host.enter = async () => {
        if (released || closed) throw Error("Start a fresh preview after using development recovery.");
        clearTimeout(watchdog);
        watchdog = setTimeout(() => void release("two-minute-watchdog").catch(error => { status(error.message); void ctx.stop(error); }), 120000);
        await originalEnter(); status("Strict Oath active. Automatic development release within two minutes. Alt+Tab back here or to Itacan for recovery.");
    };
    ipcMain.handle("oath-preview:action", async (event, action) => {
        if (event.sender !== control.webContents || event.senderFrame !== control.webContents.mainFrame) throw Error("Invalid recovery sender");
        if (action === "release") { await release("recovery-window"); return; }
        if (action === "finish") { finish(); return; }
        if (action === "permit") {
            const rows = await strict.observer.listWindows(), verified = [];
            for (const file of new Set(rows.map(row => row.executable).filter(Boolean))) {
                try { verified.push(...await strict.verifyApplications([file])); } catch (_) {}
            }
            await js(`phase5.service.setStrictApplications(${JSON.stringify(verified)})`);
            status("Current applications permitted in this disposable vault. Close and reopen Settings to inspect the list; then create a one-minute Strict Oath."); return;
        }
        throw Error("Unknown preview action");
    });
    control.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    control.webContents.on("will-navigate", event => event.preventDefault());
    control.webContents.session.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
    control.on("close", () => finish());
    const previousCleanup = ctx.cleanup;
    ctx.cleanup = async () => {
        closed = true; clearTimeout(watchdog); app.removeListener("web-contents-created", watch);
        for (const item of contents) item.removeListener("before-input-event", input);
        ipcMain.removeHandler("oath-preview:action"); strict.host.enter = originalEnter;
        await strict.release(strict.current?.id); if (!control.isDestroyed()) control.destroy(); setup.dispose(); await previousCleanup();
    };
    setup.initialize(ctx); await setup.attach(win);
    await js("document.getElementById('oath-phase1-banner').textContent='ISOLATED STRICT OATH PREVIEW • Ctrl+Alt+Shift+F12 releases • two-minute guard limit'");
    await control.loadFile(path.join(__dirname, "preview.html"));
    const external = await ctx.launchCompanion({ x: 180, y: 120, width: 640, height: 440 });
    await js(`phase5.service.setStrictApplications([${JSON.stringify(process.execPath)}])`);
    await js("phase5.plugin.settingsControl.open('oath')");
    console.log("PREVIEW_READY: Settings, recovery window and ordinary companion are open; Strict remains disabled until explicit opt-in.");
    if (ctx.fixture.previewSmoke) {
        const observer = strict.observer;
        strict.observer = { listWindows: async () => (await observer.listWindows()).filter(row => row.pid === process.pid || row.pid === external.pid), cancel: () => observer.cancel() };
        await ctx.check("Interactive preview activates only after escape proof and restores through its independent recovery window", async () => {
            await js(`(async()=>{const s=phase5.service;await s.setStrictEnabled(true);const d={mode:'strict',start:'now',workspace:{type:'project',id:'a'},durationMs:60000,tasks:s.workspaceTasks({type:'project',id:'a'}).slice(0,1)};const r=await s.reviewStrict(d);await s.take({...d,strictConfirmation:r.confirmation});})()`);
            assert(strict.current); assert(win.isFullScreen());
            await control.webContents.executeJavaScript("window.oathPreview.action('release')");
            assert.equal(strict.current, null); assert.deepEqual(snapshot(win), before); assert.equal(await js("phase5.service.strictEnabled"), false);
            // Check the preview's own key wiring as well as the prerequisite host proof.
            control.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
            control.webContents.sendInputEvent({ type: "keyUp", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
            for (let i=0; i<60 && ctx.report.previewRecovery?.reason !== "development-shortcut"; i++) await delay(50);
            assert.equal(ctx.report.previewRecovery.reason, "development-shortcut");
        });
        finish();
    }
    ctx.report.manualAcceptance = "Not claimed: physical Alt+Tab, real applications, display changes and sleep/wake require the person's observation.";
    await done;
}
module.exports = { run };
