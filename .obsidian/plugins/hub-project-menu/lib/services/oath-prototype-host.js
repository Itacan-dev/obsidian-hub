"use strict";
// Obsidian development prototype entrypoint. Standalone uses oath-strict-host directly.
const path = require("path");
const { randomUUID } = require("crypto");
const { getStrictCoordinator } = require("./oath-strict-host");
function installPrototypeRecovery(win, coordinator, desktop = require("electron"), timeoutMs = 120000) {
    if (coordinator.developmentRecovery) return coordinator.developmentRecovery;
    const { BrowserWindow, ipcMain, app, webContents } = desktop;
    const channel = "itacan-prototype-recovery-" + randomUUID();
    let control = null, ready = false, armed = false, tripped = false, watchdog = null;
    let verifying = null, releasing = null, probe = null, disposed = false, generation = 0;
    const listeners = new Map(), recoveryWindows = new Set();
    const originalEnter = coordinator.host.enter, originalRelease = coordinator.host.release;
    const status = text => {
        if (control && !control.isDestroyed()) control.webContents.send(channel + ":status", text);
    };
    const disarm = () => { armed = false; clearTimeout(watchdog); watchdog = null; };
    const release = reason => {
        if (releasing) return releasing;
        generation++; tripped = true; ready = false; disarm();
        releasing = (async () => {
            try {
                await coordinator.release(coordinator.current?.id);
                status("Development recovery released restrictions and restored the window. The Oath is interrupted. Verify recovery again before another test.");
            } catch (error) { status(error.message); throw error; }
            finally { coordinator.update({ ...coordinator.health, developmentRecoveryReleased: true, developmentRecoveryReason: reason }); }
        })().finally(() => { releasing = null; });
        return releasing;
    };
    const recover = reason => { void release(reason).catch(error => console.error("Prototype Oath recovery", error)); };
    const input = (event, key) => {
        if (key.type !== "keyDown" || key.key !== "F12" || !key.control || !key.alt || !key.shift) return;
        const owner = BrowserWindow.fromWebContents(event.sender);
        if (event.sender !== win.webContents && owner !== win && event.sender !== control?.webContents && !recoveryWindows.has(owner)) return;
        if (probe && event.sender === control?.webContents) { event.preventDefault(); probe(); return; }
        if (armed) { event.preventDefault(); recover("development-shortcut"); }
    };
    const watch = (_event, contents) => {
        if (listeners.has(contents)) return;
        const handler = (event, key) => input({ sender: contents, preventDefault: () => event.preventDefault() }, key);
        contents.on("before-input-event", handler);
        listeners.set(contents, handler);
        contents.once("destroyed", () => listeners.delete(contents));
    };
    for (const contents of webContents.getAllWebContents()) watch(null, contents);
    app.on("web-contents-created", watch);
    const verify = () => {
        if (verifying) return verifying;
        if (armed) return Promise.reject(Error("Recovery is already armed for this Oath."));
        verifying = (async () => {
            if (disposed || win.isDestroyed()) throw Error("Prototype host is unavailable.");
            const ticket = generation;
            ready = false;
            if (!control || control.isDestroyed()) {
                control = new BrowserWindow({ width: 480, height: 300, title: "Itacan prototype recovery", alwaysOnTop: true,
                    webPreferences: { preload: path.join(__dirname, "../ui/oath-prototype/preload.cjs"),
                        additionalArguments: ["--itacan-prototype-channel=" + channel], partition: channel,
                        sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, devTools: false } });
                control.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
                control.webContents.on("will-navigate", event => event.preventDefault());
                control.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
                control.webContents.session.setPermissionCheckHandler(() => false);
                control.once("closed", () => { ready = false; if (armed) recover("recovery-window-closed"); });
                control.webContents.on("render-process-gone", () => { ready = false; if (armed) recover("recovery-renderer-lost"); });
                await control.loadFile(path.join(__dirname, "../ui/oath-prototype/index.html"));
            }
            control.showInactive();
            let timer;
            try {
                await new Promise((resolve, reject) => {
                    probe = resolve;
                    timer = setTimeout(() => reject(Error("Development shortcut verification failed. Strict Oath was not started.")), 2000);
                    control.webContents.sendInputEvent({ type: "keyDown", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
                    control.webContents.sendInputEvent({ type: "keyUp", keyCode: "F12", modifiers: ["control", "alt", "shift"] });
                });
            } finally { clearTimeout(timer); probe = null; }
            if (ticket !== generation || control.isDestroyed() || control.webContents.isDestroyed()) throw Error("Recovery window is unavailable.");
            ready = true; tripped = false;
            status("Development recovery verified. Ctrl+Alt+Shift+F12 releases while an Itacan window is focused. Restrictions automatically release after two minutes.");
            return true;
        })().finally(() => { verifying = null; });
        return verifying;
    };
    ipcMain.handle(channel, async (event, action) => {
        if (!control || event.sender !== control.webContents || event.senderFrame !== control.webContents.mainFrame) throw Error("Invalid prototype recovery sender.");
        if (action !== "release") throw Error("Unknown prototype recovery action.");
        return release("recovery-window");
    });
    coordinator.host.enter = async () => {
        if (tripped) throw Error("Verify development recovery in Settings ? The Oath before another test.");
        await verify();
        if (!ready || disposed) throw Error("Development recovery is unavailable.");
        armed = true;
        watchdog = setTimeout(() => recover("development-watchdog"), timeoutMs);
        try { await originalEnter(); }
        catch (error) { disarm(); throw error; }
    };
    coordinator.host.release = async () => { disarm(); return originalRelease(); };
    const dispose = () => {
        generation++; disposed = true; disarm(); ready = false;
        app.removeListener("web-contents-created", watch);
        for (const [contents, handler] of listeners) if (!contents.isDestroyed()) contents.removeListener("before-input-event", handler);
        listeners.clear(); ipcMain.removeHandler(channel);
        if (control && !control.isDestroyed()) control.destroy();
    };
    win.once("closed", dispose);
    coordinator.developmentRecovery = { verify, release,
        registerWindow(window) { recoveryWindows.add(window); return () => recoveryWindows.delete(window); },
        ownsForeground(value) { return value.pid === process.pid && [control].some(window => window && !window.isDestroyed() && window.getNativeWindowHandle().readInt32LE() === value.handle); }, get ready() { return ready; }, get armed() { return armed; }, get verifying() { return !!verifying; } };
    return coordinator.developmentRecovery;
}
function getPrototypeStrictCoordinator(win) {
    const coordinator = getStrictCoordinator(win);
    installPrototypeRecovery(win, coordinator);
    coordinator.createReminder ??= policy => require("./oath-reminder").createReminder({ win, coordinator, policy });
    return coordinator;
}
module.exports = { getPrototypeStrictCoordinator, installPrototypeRecovery };
