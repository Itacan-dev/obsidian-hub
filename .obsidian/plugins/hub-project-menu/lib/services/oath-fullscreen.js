"use strict";

const isExitKey = event => event.key === "Escape" || event.key === "F11" ||
    (event.key?.toLowerCase() === "f" && (event.ctrlKey || event.control) && (event.metaKey || event.meta));

// On desktop this function runs IN ELECTRON'S MAIN PROCESS via remote.require.
// Remote event callbacks cannot synchronously cancel native events; the guard
// must prevent keyboard/menu/window exits here, before notifying the renderer.
function createNativeOathGuard(native, requestExit, { platform = process.platform, transitionTimeout = 10000 } = {}) {
    const savedKey = "__hubOathFullscreenGuard";
    if (native[savedKey]) { native[savedKey].onExitRequest(requestExit); return native[savedKey]; }
    if (platform === "darwin") return createMacOathGuard(native, requestExit, transitionTimeout);
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

// macOS enters/leaves native fullscreen asynchronously. Keep cancellation in
// main, and let the existing asynchronous Oath service await settled geometry.
function createMacOathGuard(native, requestExit, timeout) {
    const fullMethod = native.setFullScreen, kioskMethod = native.setKiosk;
    const setFull = value => fullMethod.call(native, value), setKiosk = value => kioskMethod.call(native, value);
    let owned = false, enforced = false, previous = null, tail = Promise.resolve(), lastAction = null, lastPromise = null;
    const request = () => { try { requestExit?.(); } catch (_) {} };
    const close = event => { if (enforced) { event.preventDefault(); request(); } };
    const input = (event, key) => {
        if (!enforced || !isExitKey(key)) return;
        event.preventDefault();
        if (key.type === "keyDown" && !key.isAutoRepeat) request();
    };
    const left = () => {
        if (enforced) void api.enter().catch(error => console.error("Oath fullscreen could not be restored", error));
    };
    function disarm() {
        native.setFullScreen = fullMethod; native.setKiosk = kioskMethod;
        native.removeListener("close", close); native.removeListener("leave-full-screen", left);
        native.webContents?.removeListener("before-input-event", input);
    }
    function transition(full, kiosk) {
        if (native.isDestroyed()) return Promise.reject(Error("Oath window was destroyed during fullscreen transition."));
        if (native.isFullScreen() === full) {
            try { setKiosk(kiosk); setFull(full); return Promise.resolve(); }
            catch (error) { return Promise.reject(error); }
        }
        return new Promise((resolve, reject) => {
            const event = full ? "enter-full-screen" : "leave-full-screen";
            const finish = error => {
                clearTimeout(timer); native.removeListener(event, settled); native.removeListener("closed", destroyed);
                error ? reject(error) : resolve();
            };
            const settled = () => { if (native.isFullScreen() === full) finish(); };
            const destroyed = () => finish(Error("Oath window was destroyed during fullscreen transition."));
            const timer = setTimeout(() => finish(Object.assign(Error("Oath fullscreen transition timed out. Window guards have been released; retry restoration before another Oath."), { code: "OATH_FULLSCREEN_TIMEOUT" })), timeout);
            native.on(event, settled); native.on("closed", destroyed);
            try { setKiosk(kiosk); setFull(full); } catch (error) { finish(error); }
        });
    }
    async function restore() {
        enforced = false; disarm(); owned = false;
        if (!previous) return;
        if (native.isDestroyed()) { previous = null; return; }
        // Retain the snapshot if restoration fails, so a retry can finish it.
        await transition(previous.full, previous.kiosk); previous = null;
    }
    function schedule(action, work) {
        if (lastAction === action && lastPromise) return lastPromise;
        const pending = tail.catch(() => {}).then(work);
        tail = pending; lastAction = action; lastPromise = pending;
        void pending.finally(() => { if (lastPromise === pending) { lastAction = null; lastPromise = null; } }).catch(() => {});
        return pending;
    }
    const api = {
        get owned() { return owned; }, get enforced() { return enforced; },
        isFull: () => !native.isDestroyed() && native.isFullScreen(),
        restore(value) { if (!enforced) owned = !!value; },
        onExitRequest(callback) { requestExit = callback; },
        enter() { return schedule("enter", async () => {
            if (enforced) {
                try { await transition(true, true); return owned; }
                catch (error) {
                    try { await restore(); } catch (restoration) { error.message += " Restoration: " + restoration.message; }
                    throw error;
                }
            }
            if (previous) await restore();
            previous = { full: owned ? false : native.isFullScreen(), kiosk: native.isKiosk() };
            native.setFullScreen = value => { if (enforced && !value) request(); else setFull(value); };
            native.setKiosk = value => { if (enforced && !value) request(); else setKiosk(value); };
            native.on("close", close); native.on("leave-full-screen", left);
            native.webContents?.on("before-input-event", input);
            enforced = true; owned = !previous.full;
            try { await transition(true, true); return owned; }
            catch (error) {
                try { await restore(); } catch (restoration) { error.message += " Restoration: " + restoration.message; }
                throw error;
            }
        }); },
        exit() { return schedule("exit", restore); }
    };
    native.__hubOathFullscreenGuard = api;
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
        async enter() { const owned = await (guard?.enter() ?? false); changed(owned); return owned; },
        async exit() { await guard?.exit(); changed(false); },
        destroy() {
            win.removeEventListener("keydown", keydown, { capture: true });
            requestExit = () => {}; guard?.onExitRequest(null);
            // Unloading is not an Oath exit. The main-process guard retains
            // enforcement and the original window state across plugin reloads.
        }
    };
}
module.exports = { createOathFullscreen, createNativeOathGuard };
