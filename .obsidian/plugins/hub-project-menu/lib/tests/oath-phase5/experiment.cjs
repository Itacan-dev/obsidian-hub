"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { snapshot } = require("../oath-host/recovery.cjs");
const { installEscape } = require("../oath-lifecycle/development-escape.cjs");
const { getStrictCoordinator } = require("../../services/oath-strict-host");
const setup = require("./setup.cjs");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(ctx) {
    const checkpoint = path.join(ctx.fixture.scratch, "phase5-checkpoint.json");
    if (ctx.fixture.restartStage) {
        const saved = JSON.parse(fs.readFileSync(checkpoint)); ctx.report.checks.push(...saved.checks);
        let win;
        for (let i = 0; i < 600; i++) {
            win = ctx.ownedWindows.find(w => !w.isDestroyed());
            if (win && await win.webContents.executeJavaScript("!!app?.plugins?.plugins?.['hub-project-menu']?.oath").catch(() => false)) break;
            await delay(50);
        }
        assert(win); ctx.host = win;
        await ctx.check("Phase 5: fresh process recovers a persisted active commitment once without re-entering fullscreen", async () => {
            const state = await win.webContents.executeJavaScript("(async()=>{const s=app.plugins.plugins['hub-project-menu'].oath;await s.start();return {current:s.current,history:s.bucket.history};})()");
            assert.equal(state.current.id, saved.id); assert.equal(state.current.state, "interrupted"); assert.equal(state.history.length, saved.history + 1);
            assert.equal(win.isFullScreen(), false); assert(win.isClosable()); assert(win.isMinimizable());
            await win.webContents.executeJavaScript("app.plugins.plugins['hub-project-menu'].oath.refresh()");
            assert.equal(await win.webContents.executeJavaScript("app.plugins.plugins['hub-project-menu'].oath.bucket.history.length"), saved.history + 1);
        });
        ctx.report.limitations = saved.limitations; return;
    }
    await require("../oath-phase4/experiment.cjs").run(ctx);
    if (ctx.report.checks.some(check => check.status !== "pass")) throw Error("Phase 4 prerequisites failed");
    const win = ctx.host, strict = win.__hubStrictOathCoordinator, before = snapshot(win);
    setup.initialize(ctx); await setup.attach(win);
    const js = async code => {
        const result = await win.webContents.executeJavaScript(`(async()=>{try{return {value:await eval(${JSON.stringify(code)})};}catch(error){return {failure:error.stack};}})()`);
        if (result.failure) throw Error(result.failure); return result.value;
    };
    const safety = installEscape(win, () => strict.release(strict.current?.id), () => void ctx.stop(Error("Phase 5 development recovery used")));
    const priorCleanup = ctx.cleanup;
    ctx.cleanup = async () => { safety.dispose(); setup.dispose(); await priorCleanup(); };
    const take = async () => {
        await js(`(async()=>{const s=phase5.service;const d={mode:'strict',start:'now',workspace:{type:'project',id:'a'},durationMs:60000,tasks:s.workspaceTasks({type:'project',id:'a'}).slice(0,1)};const r=await s.reviewStrict(d);if(!r.preflight.ready)throw Error(r.preflight.warnings.join('; '));await s.take({...d,strictConfirmation:r.confirmation});})()`);
        for (let i=0; i<160 && !strict.current; i++) { await delay(50); await js("phase5.service.refresh()"); }
        assert(strict.current, JSON.stringify(await js("({current:phase5.service.current,health:phase5.service.strictStatus})")));
    };
    await take(); assert(strict.current);
    await ctx.check("Phase 5: real plugin reload reattaches active ownership without duplicate guards or docks", async () => {
        const id = strict.current.id, listeners = win.listenerCount("close");
        const errors = [], consoleListener = (_event, level, message) => { if (level >= 2) errors.push(message); };
        win.webContents.on("console-message", consoleListener);
        try {
            const disk = await js("(async()=>{const p=phase5.plugin;await p.dataStore.writeQueue;const disk=await p.dataStore.readDiskData(),api=await p.loadData();await app.plugins.disablePlugin('hub-project-menu');await p.dataStore.writeQueue;await app.plugins.enablePlugin('hub-project-menu');return {apiRevision:api?.hubState?.revision,diskRevision:disk?.hubState?.revision};})()");
            console.log("RELOAD_DATA", JSON.stringify(disk));
            await setup.attach(win);
        } catch (error) { throw Error(error.message + "; renderer errors: " + errors.join("; ")); }
        finally { win.webContents.removeListener("console-message", consoleListener); }
        assert.equal(await js("phase5.service.current.id"), id); assert.equal(await js("phase5.service.active"), true);
        assert.equal(win.__hubStrictOathCoordinator, strict); assert.equal(win.listenerCount("close"), listeners);
        assert.equal(ctx.electron.BrowserWindow.getAllWindows().filter(w => w.getTitle() === "Strict Oath dock").length, 1);
    });
    if (ctx.report.checks.some(check => check.status !== "pass")) throw Error("Reload prerequisite failed");
    await ctx.check("Phase 5: resume and display events preserve fullscreen and reposition the dock", async () => {
        ctx.electron.powerMonitor.emit("resume");
        const display = ctx.electron.screen.getPrimaryDisplay();
        ctx.electron.screen.emit("display-metrics-changed", {}, display, ["bounds"]);
        await strict.host.maintain(); assert(win.isFullScreen());
        const dock = ctx.electron.BrowserWindow.getAllWindows().find(w => w.getTitle() === "Strict Oath dock");
        const area = ctx.electron.screen.getDisplayMatching(win.getBounds()).workArea, bounds = dock.getBounds();
        assert(bounds.x >= area.x && bounds.y >= area.y && bounds.x + bounds.width <= area.x + area.width);
        return { simulatedEvents: true, physicalSleepOrDisplayRemoval: false };
    });
    await ctx.check("Phase 5: separate popout cannot acquire a second Strict owner", async () => {
        const other = new ctx.electron.BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
        try { await assert.rejects(getStrictCoordinator(other, { enabled: true }).host.enter(), /Another Strict/); assert.equal(other.isFullScreen(), false); }
        finally { other.destroy(); }
    });
    await ctx.check("Phase 5: actual dock renderer crash is reconstructed with the same policy", async () => {
        const original = ctx.electron.BrowserWindow.getAllWindows().find(w => w.getTitle() === "Strict Oath dock");
        const gone = new Promise(resolve => original.webContents.once("render-process-gone", resolve));
        original.webContents.forcefullyCrashRenderer(); await gone; await strict.poll();
        const replacement = ctx.electron.BrowserWindow.getAllWindows().find(w => w.getTitle() === "Strict Oath dock");
        assert(replacement && replacement !== original); assert(original.isDestroyed()); assert(win.isFullScreen()); assert(strict.current);
        assert.equal(replacement.webContents.getLastWebPreferences().sandbox, true);
    });
    await ctx.check("Phase 5: renderer-loss handling releases guards and records interruption", async () => {
        // Exercise the handler without crashing Obsidian's entire UI during other checks.
        win.webContents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 1 });
        await strict.release(strict.current?.id); await js("phase5.service.refresh()");
        assert.equal(await js("phase5.service.current.state"), "interrupted"); assert.deepEqual(snapshot(win), before);
        return { hostCrashEventSimulated: true };
    });
    await ctx.check("Phase 5: failed restoration disarms guards and the real Settings retry restores the snapshot", async () => {
        await strict.host.enter();
        const original = win.setBounds;
        win.setBounds = () => { throw Error("Injected disposable bounds failure"); };
        try { await assert.rejects(strict.release(), /bounds failure/); }
        finally { win.setBounds = original; }
        assert(win.isClosable()); assert(win.isMinimizable()); assert.equal(strict.health.status, "recovery-required");
        await js("phase5.plugin.settingsControl.open('oath')");
        assert(await js("[...document.querySelectorAll('.hub-settings-dialog button')].some(b=>b.textContent==='Restore window')"));
        await js("[...document.querySelectorAll('.hub-settings-dialog button')].find(b=>b.textContent==='Restore window').click()");
        for (let i=0; i<60 && strict.health.status !== "idle"; i++) await delay(50);
        assert.equal(strict.health.status, "idle"); assert.deepEqual(snapshot(win), before);
        await js("document.querySelector('.hub-settings-dialog').closest('.modal-container').querySelector('.modal-close-button,.modal-header-button').click()");
    });
    // Persist a genuinely activated commitment, stop renderer reconciliation,
    // then ask the launcher for a new OS process over the same disposable profile.
    await take(); assert(strict.current);
    const state = await js("({id:phase5.service.current.id,history:phase5.service.bucket.history.length})");
    await js("phase5.service.destroy()");
    fs.writeFileSync(checkpoint, JSON.stringify({ ...state, checks: ctx.report.checks, limitations: [
        "Actual plugin reload, dock renderer crash and fresh-process startup were exercised in disposable Obsidian.",
        "Host renderer-loss, power resume and display change events are simulated; physical hardware/OS transitions require manual acceptance.",
        "Synthetic task/workspace/index adapters and fixture-scoped preflight protect ordinary applications and user data.",
        "Physical Alt+Tab, foreground ownership and arbitrary external-window stacking are not asserted by automation."
    ] }));
    process.send({ type: "restart", token: ctx.fixture.token });
}
module.exports = { run };
