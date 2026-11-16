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
    const control = new BrowserWindow({ width: 780, height: 620, title: "Strict Oath preview recovery", alwaysOnTop: true,
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
        if (strict.developmentRecovery?.verifying) return;
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
        if (action === "diagnostics") {
            const observation = await strict.observer.listWindows();
            const { classifyWindows, windowHandle } = require("../../domain/oath-strict");
            const { applications } = require("../../domain/oath-strict");
            const permitted = strict.current?.policy.applications ?? await js("phase5.service.strictApplications");
            const result = classifyWindows(observation, { applications: permitted }, strict.host.identity);
            const classify = row => {
                if (result.blockers.includes(row) || result.blockers.some(item => item.pid === row.pid && item.handle === row.handle)) return "Possible non-permitted application; switchability unverified";
                if (result.uncertain.some(item => item.pid === row.pid && item.handle === row.handle)) return "Uncertain: no matching window source";
                if (result.unknown.includes(row) || row.sourceOnly) return "Unknown executable identity";
                try { if (permitted.includes(applications([row.executable])[0])) return "Permitted executable"; } catch (_) {}
                return "Participating host or dock";
            };
            const sourceHandles = new Set(observation.sources.records.map(source => {
                const match = /^window:(-?\d+):[01]$/.exec(source.id);
                return match && windowHandle(match[1]);
            }));
            return { warnings: result.warnings, rows: [...observation.records, ...result.unknown.filter(row => row.sourceOnly)].map(row => ({
                title: row.title || "Untitled window", executable: row.executable || "Unavailable", handle: row.handle,
                processWindow: !row.sourceOnly, windowSource: sourceHandles.has(windowHandle(row.handle)), classification: classify(row)
            })) };
        }
        if (action === "permit") {
            const observation = await strict.observer.listWindows(), rows = observation.records, verified = [];
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
        await ctx.check("Preview diagnostics use live Electron corroboration and stay in the recovery renderer", async () => {
            const observation = await strict.observer.listWindows();
            assert.equal(observation.sources.status, "ok");
            const { classifyWindows } = require("../../domain/oath-strict");
            const result = classifyWindows(observation, { applications: [] }, strict.host.identity);
            assert(result.blockers.some(row => row.pid === external.pid), "Ordinary companion must have corroborated window evidence");
            const diagnostic = await control.webContents.executeJavaScript("window.oathPreview.action('diagnostics')");
            assert(Array.isArray(diagnostic.rows));
            assert(diagnostic.rows.some(row => row.processWindow && row.windowSource));
            await control.webContents.executeJavaScript("document.querySelector('[data-action=diagnostics]').click()");
            for (let i = 0; i < 100; i++) {
                if (await control.webContents.executeJavaScript("!!document.querySelector('#diagnostics table')")) return;
                await delay(100);
            }
            throw Error("Diagnostics did not render");
        });
        const observer = strict.observer;
        strict.observer = { listWindows: async () => {
            const value = await observer.listWindows();
            const records = value.records.filter(row => row.pid === process.pid || row.pid === external.pid);
            const handles = new Set(records.map(row => row.handle));
            return { ...value, records, sources: { ...value.sources, records: value.sources.records.filter(row => handles.has(row.id.split(":")[1])) } };
        }, cancel: () => observer.cancel() };
        const scopedObserver = strict.observer;
        let overlayGeneration = 0;
        strict.observer = { listWindows: async () => {
            const value = await scopedObserver.listWindows();
            const handle = String(900000 + ++overlayGeneration);
            return { ...value, records: [...value.records, { pid: 900000 + overlayGeneration, handle,
                title: "Synthetic overlay", executable: process.execPath }],
                sources: { status: "ok", records: [...value.sources.records, { id: "window:" + handle + ":0", title: "Synthetic overlay" }] } };
        }, cancel: () => scopedObserver.cancel() };
        await ctx.check("Manual-review UI requires separate acknowledgment and resets on refresh", async () => {
            await js("(async()=>{await phase5.service.setStrictEnabled(true);await phase5.service.setStrictApplications([]);phase5.plugin.oathControl.open();})()");
            const untilUI = async expression => {
                for (let i=0; i<100; i++) { if (await js(expression)) return; await delay(100); }
                throw Error("Manual-review UI did not reach expected state");
            };
            await js("document.querySelector('input[value=strict]').click();document.querySelector('input[value=\"25\"]').click()");
            await untilUI("!!document.querySelector('[aria-label=\"Add tasks\"]:not(:disabled)')");
            await js("document.querySelector('[aria-label=\"Add tasks\"]').click()");
            await untilUI("!!document.querySelector('.hub-oath-picker .hub-oath-task-row')");
            await js("document.querySelector('.hub-oath-picker .hub-oath-task-row').click();[...document.querySelectorAll('.hub-oath-picker button')].find(b=>b.textContent==='Add tasks').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='Review Oath').click()");
            await untilUI("!!document.querySelector('[aria-label=\"Use manual application review for this Oath\"]')");
            await js("document.querySelector('[aria-label=\"Use manual application review for this Oath\"]').click()");
            assert(await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Take the Oath').disabled"));
            await js("document.querySelector('[aria-label=\"I checked Alt+Tab and accept incomplete application detection\"]').click()");
            await untilUI("!document.querySelector('[aria-label=\"I checked Alt+Tab and accept incomplete application detection\"]').disabled");
            await js("document.querySelector('[aria-label=\"I understand and accept the Strict Oath restrictions\"]').click()");
            assert.equal(await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Take the Oath').disabled"), false);
            await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh application checks').click()");
            await untilUI("!document.querySelector('[aria-label=\"Use manual application review for this Oath\"]').disabled");
            assert.equal(await js("document.querySelector('[aria-label=\"Use manual application review for this Oath\"]').checked"), false);
            assert.equal(await js("document.querySelector('[aria-label=\"I checked Alt+Tab and accept incomplete application detection\"]').checked"), false);
            await js("phase5.plugin.oathControl.open()");
        });
        await ctx.check("Interactive preview activates only after escape proof and restores through its independent recovery window", async () => {
            await js(`(async()=>{const s=phase5.service;await s.setStrictEnabled(true);await s.setStrictApplications([]);const d={mode:'strict',applicationCheckMode:'manual-review',manualApplicationReviewAcknowledged:true,start:'now',workspace:{type:'project',id:'a'},durationMs:60000,tasks:s.workspaceTasks({type:'project',id:'a'}).slice(0,1)};const r=await s.reviewStrict(d);await s.take({...d,strictConfirmation:r.confirmation});})()`);
            assert(strict.current, JSON.stringify(await js("phase5.service.strictStatus"))); assert(win.isFullScreen());
            assert.equal(strict.current.policy.applicationCheckMode, "manual-review");
            const reminderWindow = BrowserWindow.getAllWindows().find(item => item.getTitle() === "Oath Reminder");
            assert(reminderWindow); assert.equal(reminderWindow.isMovable(), false);
            assert(reminderWindow.isAlwaysOnTop()); assert.equal(reminderWindow.isVisible(), false);
            const prefs = reminderWindow.webContents.getLastWebPreferences();
            assert(prefs.sandbox && prefs.contextIsolation && !prefs.nodeIntegration && prefs.webSecurity);
            assert.equal(await reminderWindow.webContents.executeJavaScript("getComputedStyle(document.querySelector('header')).webkitAppRegion"), "none");
            await delay(600); assert(!strict.reminderUnavailable, "Packaged observer must remain healthy");
            await strict.poll();
            assert(strict.health.candidates.length > 0);
            assert.equal(strict.health.blockers.length, 0);
            assert.equal(strict.current.policy.confirmationVersion, 4); assert(strict.reminder);
            const baselineObserver = strict.observer;
            const originalFocus = strict.host.focus;
            let attempts = 0;
            strict.host.focus = () => { attempts++; originalFocus(); };
            strict.observer = { ...baselineObserver, listWindows: async () => {
                const value = await baselineObserver.listWindows();
                return { ...value, records: [...value.records, { pid: 990001, handle: "990001",
                    executable: "C:\\Synthetic\\NewApplication.exe", title: "Synthetic new window" }] };
            } };
            try {
                await strict.poll(); assert.equal(attempts, 0);
                await strict.poll(); assert.equal(attempts, 0);
                await strict.poll(); assert.equal(attempts, 0);
                assert.equal(strict.health.monitoring, undefined);
                assert(strict.reminder);
            } finally { strict.observer = baselineObserver; strict.host.focus = originalFocus; }
            if (strict.developmentRecovery) {
                assert(strict.developmentRecovery.armed);
                const recovery = ctx.electron.BrowserWindow.getAllWindows().find(item => item.getTitle() === "Itacan prototype recovery");
                assert(recovery);
                await recovery.webContents.executeJavaScript("window.prototypeRecovery.release()");
                await js("phase5.service.refresh()");
                assert.equal(await js("phase5.service.current.state"), "interrupted");
                assert.equal(strict.current, null); assert(reminderWindow.isDestroyed());
                assert.deepEqual(snapshot(win), before);
            }
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
