"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), { EventEmitter } = require("node:events");
const { createStrictHost, visibleBounds } = require("../services/oath-strict-host");
const { StrictOathCoordinator } = require("../services/oath-strict");
function fixture() {
    const win = new EventEmitter(), screen = new EventEmitter(), powerMonitor = new EventEmitter(); win.webContents = new EventEmitter();
    const initial = { x: 30, y: 40, width: 800, height: 600 }; let bounds = { ...initial }, destroyed = false, fail = false, nextHandle = 2;
    const flags = { FullScreen: false, Kiosk: false, Closable: true, Minimizable: true, AlwaysOnTop: false, Minimized: false, Maximized: false };
    for (const key of Object.keys(flags)) { win["is" + key] = () => flags[key]; win["set" + key] = value => { flags[key] = value; }; }
    win.getNativeWindowHandle = () => { const b = Buffer.alloc(8); b.writeBigUInt64LE(1n); return b; };
    win.getNormalBounds = win.getBounds = () => ({ ...bounds }); win.setBounds = value => { if (fail) throw Error("bounds failed"); bounds = { ...value }; };
    win.restore = () => { flags.Minimized = flags.Maximized = false; }; win.unmaximize = () => { flags.Maximized = false; };
    win.maximize = () => { flags.Maximized = true; }; win.minimize = () => { flags.Minimized = true; };
    win.isDestroyed = () => destroyed; win.focus = () => {};
    screen.getAllDisplays = () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
    const docks = [];
    const makeDock = async () => {
        const native = new EventEmitter(); let closed = false;
        const handle = nextHandle++; native.getNativeWindowHandle = () => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(handle)); return b; };
        const dock = { win: native, positions: 0, healthy: () => !closed, reposition() { this.positions++; }, update() {},
            dispose() { if (!closed) { closed = true; native.emit("closed"); } } }; docks.push(dock); return dock;
    };
    const host = createStrictHost(win, { desktop: { screen, powerMonitor }, makeDock });
    return { win, flags, host, docks, screen, powerMonitor, initial, fail: value => { fail = value; }, destroy() { destroyed = true; win.emit("closed"); } };
}
test("failed restoration disarms guards, retains the snapshot, and succeeds on retry", async () => {
    const f = fixture(); await f.host.enter(); f.fail(true);
    await assert.rejects(f.host.release(), /bounds failed/); assert(f.flags.Closable); assert(f.flags.Minimizable);
    assert.equal(f.win.listenerCount("close"), 0); assert(f.host.needsRestoration());
    await assert.rejects(f.host.enter(), /Restore/); f.fail(false); await f.host.release();
    assert.deepEqual(f.win.getBounds(), f.initial); assert.equal(f.host.needsRestoration(), false); f.destroy();
});
test("dock reconstruction clears stale identity, resumes once, and disposes listeners on release", async () => {
    const f = fixture(); await f.host.enter(); await f.host.openDock({ applications: [] }, {});
    f.docks[0].dispose(); assert.equal(f.host.identity.dockHandle, undefined);
    await Promise.all([f.host.maintain(), f.host.maintain()]); assert.equal(f.docks.length, 2); assert(f.host.healthy());
    f.powerMonitor.emit("resume"); f.screen.emit("display-removed"); assert(f.docks[1].positions >= 2);
    await f.host.release(); assert.equal(f.powerMonitor.listenerCount("resume"), 0); assert.equal(f.screen.listenerCount("display-removed"), 0);
    assert.equal(f.host.identity.dockHandle, undefined); f.destroy();
});
test("another window cannot acquire fullscreen ownership; renderer loss releases ownership", async () => {
    const a = fixture(), b = fixture();
    const coordinator = new StrictOathCoordinator({ enabled: true, host: a.host, observer: { listWindows: async () => [] } });
    const oath = { id: "a", policy: { mode: "strict", confirmationVersion: 1, applications: [] } };
    await coordinator.prepare(oath); coordinator.commit("a"); await assert.rejects(b.host.enter(), /Another/);
    a.win.webContents.emit("render-process-gone");
    for (let i = 0; i < 30 && a.host.needsRestoration(); i++) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(coordinator.current, null); assert(a.flags.Closable); await b.host.enter(); await b.host.release(); a.destroy(); b.destroy();
});
test("restoration health remains actionable after failure, and cannot release an active oath through retry", async () => {
    let fail = true; const c = new StrictOathCoordinator({ host: { release: async () => { if (fail) throw Error("restore failed"); } } });
    await assert.rejects(c.release(), /restore failed/); assert.equal(c.health.status, "recovery-required");
    fail = false; await c.retryRestoration(); assert.equal(c.health.status, "idle");
    c.current = { id: "active" }; await assert.rejects(c.retryRestoration(), /active/);
});
test("display removal preserves visible bounds and relocates only unreachable windows", () => {
    const area = { x: -1920, y: 0, width: 1920, height: 1080 }, visible = { x: -1800, y: 20, width: 900, height: 650 };
    assert.deepEqual(visibleBounds(visible, [area]), visible);
    const moved = visibleBounds({ x: 3000, y: 100, width: 2500, height: 1200 }, [area]);
    assert.deepEqual(moved, area);
});
