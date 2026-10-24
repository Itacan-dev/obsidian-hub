"use strict";
// Runs in Electron's main process. Renderer-proxied event callbacks are async
// and cannot synchronously prevent a BrowserWindow close.
function createNativeQuitGate(window, app, requestDrain) {
    let pending = false, stopped = false, quitting = false;
    const beforeQuit = () => { quitting = true; };
    const detach = () => { if (stopped) return; stopped = true; window.removeListener("close", close); app.removeListener("before-quit", beforeQuit); };
    // Disposal may race a pending close. Its accepted drain callback alone
    // resumes that close; removing the gate early could lose its continuation.
    const stop = () => { if (!pending) detach(); };
    const close = event => {
        if (stopped) return;
        event.preventDefault();
        if (pending) return;
        pending = true;
        // A completion callback grants one continuation of this close only.
        // No persistent permission, forced exit or lock operation exists here.
        let answered = false;
        requestDrain(success => {
            if (answered || stopped) return;
            answered = true;
            if (success !== true) return; // Quit is cancelled, evidence retained.
            detach();
            if (!window.isDestroyed()) { if (quitting) app.quit(); else window.close(); }
        });
    };
    app.on("before-quit", beforeQuit);
    window.on("close", close);
    return stop;
}
function installNativeQuit(windowId, requestDrain) {
    const electron = require("electron"), window = electron.BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed() || typeof requestDrain !== "function") throw Error("Native owning window required.");
    return createNativeQuitGate(window, electron.app, requestDrain);
}
module.exports = { installNativeQuit, createNativeQuitGate };
