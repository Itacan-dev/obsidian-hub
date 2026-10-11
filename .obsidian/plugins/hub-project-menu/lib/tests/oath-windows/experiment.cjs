"use strict";
const assert = require("node:assert/strict"), path = require("node:path");
const { Supervisor } = require("./supervisor.cjs");
const pins = require("./dependencies.json");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const handle = win => win.getNativeWindowHandle().readInt32LE(); // upstream emits LONG HWND
async function run(ctx) {
    const { report, electron } = ctx, originalCheck = ctx.check, originalCleanup = ctx.cleanup;
    const adapter = new Supervisor(electron.utilityProcess), windows = [];
    let external = null;
    report.dependencies = pins; report.adapterHealth = []; report.windowsObservations = []; report.adapterStages = [];
    report.limitations.push("Phase 2 controls are unsupported by the pinned public provider; source builds not verified.",
        "get-windows filters some windows silently; a successful inventory is not proof of complete coverage.",
        "Direct upstream N-API loading tests binary compatibility, not the ESM wrapper or production packaging.");
    adapter.on("health", state => report.adapterHealth.push(state));
    adapter.on("diagnostic", stage => report.adapterStages.push(stage));
    ctx.cleanup = async () => {
        adapter.stop();
        for (const win of windows) if (!win.isDestroyed()) win.destroy();
        await originalCleanup();
    };
    const own = raw => {
        if (!raw) return null;
        const isOwned = raw.pid === process.pid || raw.pid === external?.pid;
        // No unrelated user titles, paths, PIDs or HWNDs are persisted in evidence.
        return isOwned ? { ...raw, executable: raw.executable ? "<verified test Electron executable>" : null } : { unrelatedWindow: true, identity: raw.identity };
    };
    async function sample(label, foregroundOnly = false) {
        const value = await adapter.request(foregroundOnly ? "foreground" : "sample");
        value.windows ??= [];
        const evidence = { label, durationMs: value.durationMs, coverage: value.coverage,
            foreground: own(value.foreground), windows: value.windows.filter(w => w.pid === process.pid || w.pid === external?.pid).map(own),
            unrelatedCount: value.windows.filter(w => w.pid !== process.pid && w.pid !== external?.pid).length,
            unknownIdentityCount: value.windows.filter(w => w.identity === "unknown").length,
            host: ctx.host && !ctx.host.isDestroyed() ? { handle: handle(ctx.host), electronFocused: ctx.host.isFocused(), fullscreen: ctx.host.isFullScreen() } : null,
            external: external ? await ctx.rpc("state") : null };
        report.windowsObservations.push(evidence); return value;
    }
    adapter.start();
    if (!await originalCheck("Phase 2: upstream addon loads in separate utility process", async () => {
        const caps = await adapter.request("capabilities"); report.adapterCapabilities = caps;
        assert.notEqual(caps.pid, process.pid); assert.equal(caps.observation, true, caps.loadError);
        assert.equal(caps.focus, false); assert.equal(caps.minimize, false); assert.equal(caps.restore, false);
        return { pid: caps.pid, napi: caps.runtime.napi };
    })) throw Error("Native observation unavailable; stopping without substitutes");
    // Reuse Phase 1's exact recovery prerequisites, guarded fullscreen/kiosk and secure dock.
    // Add read-only Windows evidence after checks, including failed Electron assertions.
    ctx.check = async (name, action) => {
        const result = await originalCheck(name, action);
        if (name.includes("external fixture is")) external = await ctx.rpc("state");
        if (ctx.host && external && adapter.child) await originalCheck("Windows observation after " + name, () => sample(name, true).then(() => ({ recorded: true })));
        return result;
    };
    await require("../oath-host/experiment.cjs").run(ctx);
    ctx.check = originalCheck;
    if (ctx.fixture.safetyOnly) return;
    if (!adapter.child) { await delay(200); adapter.start(); await adapter.request("capabilities"); }
    // One longer diagnostic probe distinguishes slow inventory from absent capability.
    // This is not an enforcement timeout and is never used while guards are armed.
    adapter.timeoutMs = 10000;
    const inventoryAvailable = await originalCheck("Phase 2: bounded inventory diagnostic", async () => {
        const value = await sample("inventory diagnostic"); return { count: value.windows.length, durationMs: value.durationMs };
    });
    adapter.timeoutMs = 2500;
    if (!inventoryAvailable) {
        report.checks.push({ name: "Phase 2 gate: inventory coverage and controls", status: "fail", detail: "Inventory timed out; window-shape cases cannot run. Public provider also lacks minimize/restore." });
        await delay(200); adapter.start(); await adapter.request("capabilities");
        await originalCheck("Phase 2: unavailable controls reject without side effects", async () => {
            await assert.rejects(adapter.request("minimize"), /Unsupported control/);
        });
        await helperFailureChecks();
        for (const name of ["minimized windows", "duplicate titles", "empty title", "modal coverage", "process exit", "handle reuse", "inaccessible process", "source-built controls"])
            report.checks.push({ name: "Phase 2: " + name, status: "not-run", detail: "Required capability unavailable; no substitute used" });
        return;
    }
    await originalCheck("Phase 2: conventional executable path agrees with fixture", async () => {
        const value = await sample("identity agreement");
        const found = value.windows.find(w => w.handle === external.handle && w.pid === external.pid);
        assert(found, "External fixture omitted"); assert.equal(found.identity, "observed");
        const expected = require("node:fs").realpathSync.native(process.execPath).toLowerCase();
        assert.equal(found.executable, expected);
    });
    const prefs = { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, devTools: false };
    async function create(title, options = {}) {
        const win = new electron.BrowserWindow({ width: 360, height: 220, title, show: false, webPreferences: prefs, ...options });
        windows.push(win);
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        await win.loadURL("data:text/html," + encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><body>Synthetic unsaved text; no user documents.</body>'));
        win.setTitle(title); win.webContents.on("page-title-updated", event => event.preventDefault());
        win.webContents.on("will-navigate", event => event.preventDefault()); win.show(); return win;
    }
    const first = await create("Duplicate Phase 2 title"), second = await create("Duplicate Phase 2 title");
    await delay(300);
    let oldToken;
    await originalCheck("Phase 2: two windows with duplicate titles have distinct tokens", async () => {
        const value = await sample("duplicate titles");
        const a = value.windows.find(w => w.handle === handle(first)), b = value.windows.find(w => w.handle === handle(second));
        assert(a && b); assert.equal(a.pid, b.pid); assert.equal(a.title, b.title); assert.notEqual(a.token, b.token); oldToken = a.token;
    });
    await originalCheck("Phase 2: minimized ordinary window remains inventoried", async () => {
        first.minimize(); await delay(300); assert(first.isMinimized());
        const value = await sample("minimized window"); assert(value.windows.some(w => w.handle === handle(first)));
        first.restore();
    });
    await originalCheck("Phase 2: empty-title ordinary window remains inventoried", async () => {
        second.setTitle(""); await delay(200); const value = await sample("empty title");
        const found = value.windows.find(w => w.handle === handle(second)); assert(found); assert.equal(found.title, "");
    });
    const modal = await create("Phase 2 owned modal", { parent: first, modal: true }); await delay(300);
    await originalCheck("Phase 2 gate: blocked parent or owned modal stays discoverable", async () => {
        const value = await sample("owned modal disables parent");
        const parentListed = value.windows.some(w => w.handle === handle(first));
        const modalListed = value.windows.some(w => w.handle === handle(modal));
        const foregroundIsModal = value.foreground?.handle === handle(modal);
        report.modalCoverage = { parentListed, modalListed, foregroundIsModal };
        assert(parentListed || modalListed, "Neither disabled parent nor owned modal returned by inventory");
    });
    modal.destroy(); first.destroy(); await delay(200);
    await originalCheck("Phase 2: closed-window token rejected after fresh enumeration", async () => {
        assert(oldToken, "Missing original token"); await assert.rejects(adapter.request("resolve", { token: oldToken }), /Stale/);
    });
    const recreated = await create("Duplicate Phase 2 title");
    await originalCheck("Phase 2: new window never inherits disappeared token", async () => {
        const value = await sample("new lifetime"); const found = value.windows.find(w => w.handle === handle(recreated));
        assert(found); assert.notEqual(found.token, oldToken);
        return { actualHandleReuseForced: false, samePidSameHandleBetweenPolls: "unsupported" };
    });
    await originalCheck("Phase 2: exited external process disappears and its token is rejected", async () => {
        const before = await adapter.request("sample"), pid = external.pid;
        const record = before.windows.find(item => item.pid === pid && item.handle === external.handle);
        assert(record, "External fixture was not inventoried before exit");
        // This command closes only the fixture's synthetic window. No adapter close API exists.
        const exiting = ctx.rpc("quit"); external = null;
        await assert.rejects(exiting, /timed out|disconnected/);
        const after = await adapter.request("sample"); assert(!after.windows.some(item => item.pid === pid));
        await assert.rejects(adapter.request("resolve", { token: record.token }), /Stale/);
    });
    await originalCheck("Phase 2: bounded polling stays serial and host event loop runs", async () => {
        let ticks = 0; const timer = setInterval(() => ticks++, 10), durations = [];
        try {
            for (let i = 0; i < 8; i++) {
                const foreground = await adapter.request("foreground");
                const inventory = i % 4 === 0 ? await adapter.request("sample") : null;
                durations.push({ foregroundMs: foreground.durationMs, inventoryMs: inventory?.durationMs }); await delay(250);
            }
            assert(ticks > 10); return { ticks, durations, foregroundDelayAfterReplyMs: 250, inventoryEveryFourthCycle: true };
        } finally { clearInterval(timer); }
    });
    await originalCheck("Phase 2: unsupported controls fail explicitly", async () => {
        for (const action of ["focus", "minimize", "restore", "launch"]) await assert.rejects(adapter.request(action), /Unsupported control/);
    });
    async function helperFailureChecks() {
    await originalCheck("Phase 2: helper exit rejects request and allows one explicit restart", async () => {
        await assert.rejects(adapter.request("test-exit"), /exited/); await delay(100); adapter.start();
        assert((await adapter.request("capabilities")).observation);
    });
    await originalCheck("Phase 2: synchronous helper stall times out without hanging host", async () => {
        let ticked = false; const timer = setTimeout(() => { ticked = true; }, 50);
        try { await assert.rejects(adapter.request("test-stall"), /timed out/); assert(ticked); }
        finally { clearTimeout(timer); }
        await delay(200); adapter.start(); assert((await adapter.request("capabilities")).observation);
    });
    }
    await helperFailureChecks();
    // Required gates are not converted into passes by successful diagnostics.
    report.checks.push({ name: "Phase 2 gate: source-built distributable controls", status: "fail",
        detail: "Pinned public nut.js libnut provider throws for minimize/restore. No source-build toolchain available. No custom native substitute introduced." });
    for (const name of ["actual OS handle reuse", "inaccessible/elevated process identity", "physical Alt+Tab and dock hit-testing", "sleep/wake and display changes", "general app launch and denied native focus", "installed Obsidian launcher runtime"])
        report.checks.push({ name: "Phase 2: " + name, status: "not-run", detail: "Not established by this diagnostic fixture" });
}
module.exports = { run };
