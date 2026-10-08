"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), { EventEmitter } = require("node:events");
const { createRecovery, snapshot } = require("./recovery.cjs");
function windowFixture() {
    const win = new EventEmitter(); win.webContents = new EventEmitter();
    const state = { full: false, kiosk: false, minimized: false, maximized: false, closable: true, minimizable: true, top: false,
        bounds: { x: 40, y: 60, width: 800, height: 600 } };
    for (const [method, key] of Object.entries({ FullScreen: "full", Kiosk: "kiosk", Closable: "closable", Minimizable: "minimizable", AlwaysOnTop: "top" })) {
        win["is" + method] = () => state[key]; win["set" + method] = value => { state[key] = value; };
    }
    win.isMinimized = () => state.minimized; win.isMaximized = () => state.maximized;
    win.getNormalBounds = () => ({ ...state.bounds }); win.setBounds = value => { state.bounds = { ...value }; };
    win.minimize = () => { state.minimized = true; win.emit("minimize"); };
    win.maximize = () => { state.maximized = true; }; win.unmaximize = () => { state.maximized = false; };
    win.restore = () => { state.minimized = false; state.maximized = false; }; win.isDestroyed = () => false;
    return win;
}
test("guards require a prior recovery proof", async () => {
    const win = windowFixture(), initial = snapshot(win), guard = createRecovery(win);
    assert.throws(() => guard.arm("fullscreen"), /recovery/); guard.release("test"); await guard.settled; assert.deepEqual(snapshot(win), initial);
});
for (const mode of ["fullscreen", "kiosk"]) test(`${mode}: local escape restores state and removes vetoes`, async () => {
    const win = windowFixture(); win.maximize(); win.setAlwaysOnTop(true);
    const initial = snapshot(win), method = win.setFullScreen;
    const guard = createRecovery(win, { safetyVerified: true }); guard.arm(mode);
    let prevented = 0; win.emit("close", { preventDefault() { prevented++; } }); assert.equal(prevented, 1);
    win.setFullScreen(false); assert.equal(win.isFullScreen(), true);
    win.minimize(); assert.equal(win.isMinimized(), false);
    win.webContents.emit("before-input-event", { preventDefault() { prevented++; } }, { type: "keyDown", key: "F12", control: true, alt: true, shift: true });
    assert.equal(guard.released, true); assert.deepEqual(snapshot(win), initial); assert.equal(win.setFullScreen, method);
    assert.equal(win.listenerCount("close"), 0); assert.equal(win.webContents.listenerCount("before-input-event"), 0);
    assert.deepEqual(guard.release("again"), []); assert.deepEqual(await guard.settled, []);
});
test("watchdog releases without renderer input", async () => {
    const win = windowFixture(), initial = snapshot(win);
    await new Promise(resolve => { const guard = createRecovery(win, { safetyVerified: true, timeoutMs: 15,
        onRelease: result => { assert.equal(result.reason, "watchdog"); resolve(); } }); guard.arm("kiosk"); });
    assert.deepEqual(snapshot(win), initial);
});
test("restoration failure still removes guards and attempts remaining restoration", async () => {
    const win = windowFixture(), guard = createRecovery(win, { safetyVerified: true }); guard.arm("fullscreen");
    win.setClosable = () => { throw Error("injected failure"); };
    assert.deepEqual(guard.release("failure"), ["injected failure"]);
    assert.equal(win.isMinimizable(), true); assert.equal(win.isFullScreen(), false); assert.equal(win.listenerCount("close"), 0);
    assert((await guard.settled).includes("Window state did not settle to its saved snapshot"));
});
test("preexisting kiosk/fullscreen and minimized state survive release", async () => {
    for (const prepare of [win => { win.setKiosk(true); win.setFullScreen(true); }, win => win.minimize()]) {
        const win = windowFixture(); prepare(win); const initial = snapshot(win);
        const guard = createRecovery(win, { safetyVerified: true }); guard.arm("fullscreen"); guard.release("test");
        assert.deepEqual(await guard.settled, []); assert.deepEqual(snapshot(win), initial);
    }
});
test("late native fullscreen geometry is repaired before recovery settles", async () => {
    const win = windowFixture(), initial = snapshot(win), guard = createRecovery(win, { safetyVerified: true });
    guard.arm("fullscreen"); guard.release("test");
    setTimeout(() => win.setBounds({ x: 0, y: 0, width: 300, height: 200 }), 25);
    assert.deepEqual(await guard.settled, []); assert.deepEqual(snapshot(win), initial);
});
test("development experiment is absent from production entrypoints and bundles", () => {
    const fs = require("node:fs"), path = require("node:path"), root = path.resolve(__dirname, "../../..");
    for (const file of ["plugin.js", "main.js", "atlas-native.cjs", "build.js"]) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /oath-host|oath-phase1|ITACAN_OATH_FIXTURE|oath-windows|ITACAN_OATH_ADAPTER|phase2-upstream|oath-lifecycle|development-escape/);
    }
});
test("Obsidian protocol/login registration is intercepted before its startup executes", () => {
    const fs = require("node:fs"), path = require("node:path");
    const source = fs.readFileSync(path.join(__dirname, "host.cjs"), "utf8");
    const guard = source.indexOf('app[name] = () =>');
    assert(guard > 0 && guard < source.indexOf('require(path.join(fixture.archive, "main.js"))'));
    for (const name of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient", "setLoginItemSettings"]) assert(source.includes('"' + name + '"'));
});
test("GUI-mode launcher exits before creating a temporary fixture", () => {
    const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
    const source = fs.readFileSync(path.join(__dirname, "launch.cjs"), "utf8"), exit = new Error("expected early exit");
    let created = 0;
    assert.throws(() => vm.runInNewContext(source, {
        require: name => name === "node:fs" ? { ...fs, mkdtempSync() { created++; throw Error("Unexpected fixture creation"); } } : require(name),
        process: { type: "browser", exit(code) { assert.equal(code, 1); throw exit; } }, console: { error() {} }
    }), error => error === exit);
    assert.equal(created, 0);
});
