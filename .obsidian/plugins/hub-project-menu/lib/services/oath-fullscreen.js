"use strict";

const isExitKey = event => event.key === "Escape" || event.key === "F11" ||
    (event.key?.toLowerCase() === "f" && (event.ctrlKey || event.control) && (event.metaKey || event.meta));

// On desktop this function runs IN ELECTRON'S MAIN PROCESS via remote.require.
// Remote event callbacks cannot synchronously cancel native events; the guard
// must prevent keyboard/menu/window exits here, before notifying the renderer.
function createNativeOathGuard(native, requestExit) {
    const savedKey = "__hubOathFullscreenGuard";
    if (native[savedKey]) { native[savedKey].onExitRequest(requestExit); return native[savedKey]; }
    let owned = false, enforced = false, previous = null;
    const fullMethod = native.setFullScreen, kioskMethod = native.setKiosk;
    const setFull = value => fullMethod.call(native, value);
    const setKiosk = value => kioskMethod.call(native, value);
    const request = () => { try { requestExit?.(); } catch (_) { /* renderer may be reloading */ } };
    const restoreFull = () => {
        if (!enforced) return;
        if (!native.isKiosk()) setKiosk(true);
        if (!native.isFullScreen()) setFull(true);
    };
    const beforeInput = (event, input) => {
        if (!enforced || !isExitKey(input)) return;
        event.preventDefault();
        if (input.type === "keyDown" && !input.isAutoRepeat) request();
    };
    const close = event => { if (enforced) { event.preventDefault(); request(); } };
    const api = {
        get owned() { return owned; },
        get enforced() { return enforced; },
        isFull() { return native.isFullScreen(); },
        restore(value) { if (!enforced) owned = !!value; },
        onExitRequest(callback) { requestExit = callback; },
        enter() {
            if (enforced) { restoreFull(); return owned; }
            previous = { full: owned ? false : native.isFullScreen(), kiosk: native.isKiosk() };
            native.setFullScreen = value => { if (enforced && !value) request(); else setFull(value); };
            native.setKiosk = value => { if (enforced && !value) request(); else setKiosk(value); };
            native.on("leave-full-screen", restoreFull);
            native.on("close", close);
            native.webContents?.on("before-input-event", beforeInput);
            enforced = true; owned = !previous.full;
            try { setKiosk(true); setFull(true); return owned; }
            catch (error) { api.exit(); throw error; }
        },
        exit() {
            enforced = false;
            native.setFullScreen = fullMethod; native.setKiosk = kioskMethod;
            native.removeListener("leave-full-screen", restoreFull);
            native.removeListener("close", close);
            native.webContents?.removeListener("before-input-event", beforeInput);
            if (previous) { setKiosk(previous.kiosk); setFull(previous.full); previous = null; }
            owned = false;
        }
    };
    native[savedKey] = api;
    return api;
}

// Oath alone uses native kiosk fullscreen. HTML fullscreen is not a fallback:
// Chromium may release it on Escape before any renderer handler runs.
function createOathFullscreen(win = window, nativeModulePath = null) {
    const native = win.electronWindow;
    let guard = null, requestExit = () => {}, changed = () => {};
    if (native?.setFullScreen && native?.setKiosk && native?.isKiosk) {
        const remote = win.electron?.remote;
        if (remote && nativeModulePath) {
            try { guard = remote.require(nativeModulePath).createNativeOathGuard(native, () => requestExit()); }
            catch (error) { console.error("Could not install native Oath fullscreen enforcement", error); }
        } else if (!remote) {
            // Direct native handles (including isolated tests) need no IPC.
            guard = createNativeOathGuard(native, () => requestExit());
        }
    }
    const keydown = event => {
        if (!guard?.enforced || !isExitKey(event)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) requestExit();
    };
    win.addEventListener("keydown", keydown, { capture: true });
    return {
        get owned() { return !!guard?.owned; },
        get enforced() { return !!guard?.enforced; },
        isFull() { return !!guard?.isFull(); },
        restore(value) { guard?.restore(value); },
        onChange(callback) { changed = callback; },
        onExitRequest(callback) { requestExit = callback; },
        async enter() { const owned = guard?.enter() ?? false; changed(owned); return owned; },
        async exit() { guard?.exit(); changed(false); },
        destroy() {
            win.removeEventListener("keydown", keydown, { capture: true });
            requestExit = () => {}; guard?.onExitRequest(null);
            // Unloading is not an Oath exit. The main-process guard retains
            // enforcement and the original window state across plugin reloads.
        }
    };
}
module.exports = { createOathFullscreen, createNativeOathGuard };
