"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { installPrototypeRecovery } = require("../services/oath-prototype-host");
function fixture(timeoutMs = 1000) {
    const app = new EventEmitter(), windows = [], handlers = new Map();
    let shortcutWorks = true, restrictions = false, failRestore = false;
    class Window extends EventEmitter {
        constructor(options = {}) {
            super(); this.options = options; this.dead = false; this.webContents = new EventEmitter();
            const contents = this.webContents;
            contents.mainFrame = {}; contents.isDestroyed = () => this.dead;
            contents.setWindowOpenHandler = () => {}; contents.send = () => {};
            contents.session = { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} };
            contents.sendInputEvent = key => { if (shortcutWorks) contents.emit("before-input-event", { preventDefault() {} }, { ...key, key: key.keyCode, control: true, alt: true, shift: true }); };
            windows.push(this); app.emit("web-contents-created", {}, contents);
        }
        async loadFile() {} showInactive() {} isDestroyed() { return this.dead; }
        destroy() { this.dead = true; this.webContents.emit("destroyed"); this.emit("closed"); }
        static fromWebContents(contents) { return windows.find(win => win.webContents === contents); }
    }
    const desktop = { BrowserWindow: Window, app, ipcMain: { handle: (key, fn) => handlers.set(key, fn), removeHandler: key => handlers.delete(key) },
        webContents: { getAllWebContents: () => windows.map(win => win.webContents) } };
    const win = new Window(), health = [];
    const coordinator = { current: null, health: {}, update(value) { this.health = value; health.push(value); },
        host: { enter: async () => { restrictions = true; }, release: async () => { restrictions = false; if (failRestore) throw Error("Restore failed"); } },
        async release() { this.current = null; await this.host.release(); } };
    const recovery = installPrototypeRecovery(win, coordinator, desktop, timeoutMs);
    return { coordinator, recovery, win, windows, handlers, health, desktop,
        shortcut: value => { shortcutWorks = value; }, failRestore: value => { failRestore = value; },
        get restricted() { return restrictions; }, dispose() { win.destroy(); } };
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
test("prototype verifies local input before guards, installs once and emergency shortcut disarms", async () => {
    const f = fixture();
    try {
        assert.equal(installPrototypeRecovery(f.win, f.coordinator, f.desktop), f.recovery);
        await f.coordinator.host.enter(); assert(f.restricted); assert(f.recovery.armed);
        const control = f.windows[1];
        assert.equal(control.options.webPreferences.sandbox, true);
        f.win.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12" }); await wait(0);
        assert.equal(f.restricted, false); assert.equal(f.recovery.armed, false);
        assert.equal(f.health.at(-1).developmentRecoveryReason, "development-shortcut");
        await assert.rejects(f.coordinator.host.enter(), /Verify/);
        await f.recovery.verify(); await f.coordinator.host.enter(); assert(f.restricted);
        await f.coordinator.host.release(); assert.equal(f.recovery.armed, false);
    } finally { f.dispose(); }
    assert.equal(f.handlers.size, 0); assert.equal(f.desktop.app.listenerCount("web-contents-created"), 0);
});
test("watchdog releases independently of renderer and recovery-window close releases immediately", async () => {
    const f = fixture(20);
    try {
        await f.coordinator.host.enter(); await wait(40);
        assert.equal(f.restricted, false); assert.equal(f.health.at(-1).developmentRecoveryReason, "development-watchdog");
        await f.recovery.verify(); await f.coordinator.host.enter(); f.windows[1].destroy(); await wait(0);
        assert.equal(f.restricted, false); assert.equal(f.health.at(-1).developmentRecoveryReason, "recovery-window-closed");
    } finally { f.dispose(); }
});
test("recovery IPC rejects other renderers and restoration failure leaves guards disarmed", async () => {
    const f = fixture();
    try {
        await f.coordinator.host.enter(); const handler = [...f.handlers.values()][0];
        await assert.rejects(handler({ sender: f.win.webContents, senderFrame: {} }, "release"), /Invalid/);
        f.failRestore(true); await assert.rejects(f.recovery.release("test"), /Restore/);
        assert.equal(f.restricted, false); assert.equal(f.recovery.armed, false);
        assert.equal(f.health.at(-1).developmentRecoveryReleased, true);
    } finally { f.dispose(); }
});
test("release during verification invalidates its result and prevents restrictive entry", async () => {
    const f = fixture();
    try {
        const entering = f.coordinator.host.enter();
        await f.recovery.release("cancelled-before-entry");
        await assert.rejects(entering, /unavailable/); assert.equal(f.restricted, false);
    } finally { f.dispose(); }
});

test("failed shortcut verification prevents native restrictions", async () => {
    const f = fixture();
    try { f.shortcut(false); await assert.rejects(f.coordinator.host.enter(), /verification failed/); assert.equal(f.restricted, false); }
    finally { f.dispose(); }
});

test("only an explicitly registered reminder gets development escape authority", async () => {
    const f = fixture();
    try {
        await f.coordinator.host.enter();
        const reminder = new f.desktop.BrowserWindow();
        reminder.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12" }); await wait(0);
        assert(f.restricted);
        const unregister = f.recovery.registerWindow(reminder);
        reminder.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12" }); await wait(0);
        assert(!f.restricted); unregister(); reminder.destroy();
    } finally { f.dispose(); }
});
