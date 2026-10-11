"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { fixture } = require("../oath.test");
const { getStrictCoordinator } = require("../../services/oath-strict-host");
const { OathProcessObserver } = require("../../services/oath-process-observer");
const { snapshot } = require("../oath-host/recovery.cjs");
const { installEscape } = require("./development-escape.cjs");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(ctx) {
    ctx.fixture.safetyOnly = true;
    try { await require("../oath-host/experiment.cjs").run(ctx); }
    finally { ctx.fixture.safetyOnly = false; }
    const win = ctx.host, before = snapshot(win), f = fixture(), observer = new OathProcessObserver();
    const defaultDisabled = await ctx.check("Phase 3: freshly built plugin keeps Strict disabled by default", async () => {
        const enabled = await win.webContents.executeJavaScript("app.plugins.plugins['hub-project-menu'].oath.strict.enabled"); assert.equal(enabled, false);
    });
    if (!defaultDisabled) throw Error("Default-disabled prerequisite failed; refusing test activation");
    let external, safety, expectedEscape = false;
    const scopedObserver = { listWindows: async () => (await observer.listWindows()).filter(row => row.pid === process.pid || row.pid === external?.pid), cancel: () => observer.cancel() };
    const strict = getStrictCoordinator(win, { enabled: true, observer: scopedObserver, now: f.service.now });
    f.service.strict = strict; strict.onHealth(value => { f.service.strictStatus = value; });
    const save = f.plugin.dataStore.save;
    f.plugin.dataStore.save = async data => { await save(data); fs.writeFileSync(path.join(ctx.fixture.scratch, "strict-lifecycle-state.json"), JSON.stringify(data)); };
    const cleanup = ctx.cleanup;
    ctx.cleanup = async () => { safety?.dispose(); await strict.release(f.service.current?.id); f.destroy(); await cleanup(); };
    // Register the development escape and deadline BEFORE native Strict prepare.
    safety = installEscape(win, () => strict.release(f.service.current?.id), reason => {
        ctx.report.developmentAudit = { reason, restored: JSON.stringify(snapshot(win)) === JSON.stringify(before) };
        if (!expectedEscape) void ctx.stop(Error("Development escape used; remaining checks cancelled"));
    });
    await ctx.check("Phase 3: built-in Windows process observation runs without native addon", async () => {
        const rows = await observer.listWindows(); assert(Array.isArray(rows));
        ctx.report.observer = { processCountWithMainWindows: rows.length, capabilities: observer.capabilities() };
    });
    external = await ctx.launchCompanion({ x: 180, y: 120, width: 640, height: 440 });
    await f.service.setStrictApplications([process.execPath]);
    async function take() {
        const draft = f.draft({ mode: "strict", durationMs: 60000 });
        const review = await f.service.reviewStrict(draft); assert(review.preflight.ready, JSON.stringify(review.preflight.warnings));
        await f.service.take({ ...draft, strictConfirmation: review.confirmation }); assert(f.service.active);
    }
    await ctx.check("Phase 3: confirmed service activation owns guarded fullscreen with normal stacking", async () => {
        await take(); ctx.report.preparedWindow = snapshot(win);
        // On Windows Electron 39 IsKiosk delegates to IsFullscreen; it is not a distinct state.
        assert(win.isFullScreen()); assert.equal(win.isAlwaysOnTop(), false, "alwaysOnTop");
        assert.equal(win.isClosable(), false, "closable"); assert.equal(win.isMinimizable(), false, "minimizable");
        assert.equal(f.service.current.startedAt, f.service.now());
    });
    if (!f.service.active) throw Error("Strict activation failed; cannot run guarded checks");
    await ctx.check("Phase 3: local Alt+Tab is not cancelled; external window can minimize and restore", async () => {
        let prevented = false;
        win.webContents.emit("before-input-event", { preventDefault() { prevented = true; } }, { type: "keyDown", key: "Tab", alt: true });
        assert.equal(prevented, false); await ctx.rpc("focus"); await ctx.rpc("minimize"); await delay(150);
        assert((await ctx.rpc("state")).minimized); await ctx.rpc("restore"); await delay(150);
        assert.equal((await ctx.rpc("state")).minimized, false); assert(win.isFullScreen());
        return { physicalAltTabVerified: false, foregroundOwnershipVerified: false };
    });
    await ctx.check("Phase 3: early service exit and ordinary host close remain guarded", async () => {
        assert.equal(await f.service.end(f.service.current.id, "broken"), "strict-unfulfilled");
        win.close(); assert.equal(win.isDestroyed(), false); win.setFullScreen(false); assert(win.isFullScreen());
    });
    await ctx.check("Phase 3: fulfillment saves one history record before native restoration", async () => {
        f.advance(60000); await f.service.refresh(); assert(f.service.fulfilled); assert(win.isFullScreen());
        await f.service.end(f.service.current.id); assert.equal(f.service.bucket.history.length, 1);
        const disk = JSON.parse(fs.readFileSync(path.join(ctx.fixture.scratch, "strict-lifecycle-state.json")));
        assert.equal(disk.oathsByDevice["this-device"].history[0].state, "fulfilled"); assert.deepEqual(snapshot(win), before);
    });
    await ctx.check("Phase 3: isolated development shortcut releases native guards and restores state", async () => {
        await take(); expectedEscape = true;
        win.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
        win.webContents.sendInputEvent({ type: "keyUp", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
        for (let i = 0; i < 60 && !safety.pending; i++) await delay(50);
        assert(safety.pending, "Development shortcut did not arrive"); await safety.pending;
        assert.deepEqual(snapshot(win), before); await f.service.refresh(); assert.equal(f.service.current.state, "interrupted");
        expectedEscape = false;
    });
    ctx.report.limitations = ["Native lifecycle checks use the existing synthetic service/task fixture with temporary JSON persistence over real isolated Obsidian windows.",
        "The freshly built real plugin is checked for default-disabled behavior; end-to-end Strict setup UI is Phase 4.",
        "Process observation is scoped to owned fixture processes for activation so no unrelated user application needs to be closed.",
        "Physical Alt+Tab, global stacking and foreground ownership are not asserted; no native foreground dependency is loaded."];
}
module.exports = { run };
