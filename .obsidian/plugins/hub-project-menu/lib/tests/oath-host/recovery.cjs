"use strict";
// EXPERIMENT ONLY. Never import this module from plugin.js or a shipped bundle.
function snapshot(win) {
    return { full: win.isFullScreen(), kiosk: win.isKiosk(), minimized: win.isMinimized(),
        maximized: win.isMaximized(), bounds: win.getNormalBounds(), closable: win.isClosable(),
        minimizable: win.isMinimizable(), top: win.isAlwaysOnTop() };
}
function createRecovery(win, { safetyVerified = false, timeoutMs = 30000, onRelease = () => {} } = {}) {
    if (!(timeoutMs > 0 && timeoutMs <= 60000)) throw Error("A bounded recovery timer is mandatory");
    const before = snapshot(win), original = { full: win.setFullScreen, kiosk: win.setKiosk };
    let released = false, guarded = false, timer, restoring = false, resolveSettled;
    const settled = new Promise(resolve => { resolveSettled = resolve; });
    const errors = [];
    const attempt = fn => { try { fn(); } catch (error) { errors.push(error.message); } };
    const release = reason => {
        if (released) return errors;
        // Disarm first, even if a restoration method fails. Never leave a close veto installed.
        released = true; guarded = false; clearTimeout(timer);
        win.removeListener("close", close);
        win.removeListener("leave-full-screen", restoreFull);
        win.removeListener("minimize", restoreMinimized);
        win.webContents.removeListener("before-input-event", input);
        win.setFullScreen = original.full; win.setKiosk = original.kiosk;
        if (!win.isDestroyed()) {
            attempt(() => win.setKiosk(before.kiosk));
            attempt(() => win.setFullScreen(before.full));
            attempt(() => win.setClosable(before.closable));
            attempt(() => win.setMinimizable(before.minimizable));
            attempt(() => win.setAlwaysOnTop(before.top));
            if (!before.full && !before.kiosk) {
                attempt(() => win.restore());
                attempt(() => win.unmaximize());
                attempt(() => win.setBounds(before.bounds));
                if (before.maximized) attempt(() => win.maximize());
                if (before.minimized) attempt(() => win.minimize());
            }
        }
        // Native transitions can overwrite bounds AFTER setFullScreen(false) returns.
        // Check stability, reapply only on mismatch, and bound the recovery attempt.
        const deadline = Date.now() + 2000; let stable = 0;
        const settle = () => {
            if (win.isDestroyed()) stable = 3;
            else if (JSON.stringify(snapshot(win)) === JSON.stringify(before)) stable++;
            else {
                stable = 0;
                if (!win.isFullScreen() && !win.isKiosk() && !before.full && !before.kiosk) {
                    attempt(() => { win.restore(); win.unmaximize(); win.setBounds(before.bounds);
                        if (before.maximized) win.maximize(); if (before.minimized) win.minimize(); });
                }
            }
            if (stable >= 3 || Date.now() >= deadline) {
                if (stable < 3) errors.push("Window state did not settle to its saved snapshot");
                resolveSettled(errors); onRelease({ reason, errors: [...errors] });
            } else setTimeout(settle, 50);
        };
        setTimeout(settle, 50);
        return errors;
    };
    const input = (event, key) => {
        if (key.type !== "keyDown") return;
        if (key.key === "F12" && key.control && key.alt && key.shift) {
            event.preventDefault(); release("development-shortcut"); return;
        }
        if (guarded && (key.key === "Escape" || key.key === "F11" || key.key === "F4" && key.alt)) event.preventDefault();
    };
    const close = event => { if (guarded) event.preventDefault(); };
    const restoreFull = () => {
        if (!guarded || restoring || win.isDestroyed()) return;
        restoring = true;
        try { original.full.call(win, true); } finally { restoring = false; }
    };
    const restoreMinimized = () => { if (guarded && !win.isDestroyed()) win.restore(); };
    // Recovery is registered before any restrictive operation.
    win.webContents.on("before-input-event", input);
    timer = setTimeout(() => release("watchdog"), timeoutMs);
    return {
        before, settled, get released() { return released; }, release,
        arm(mode) {
            if (!safetyVerified || released) throw Error("Native recovery must pass before guards can be armed");
            if (!["fullscreen", "kiosk"].includes(mode)) throw Error("Unknown experiment mode");
            guarded = true;
            win.on("close", close); win.on("leave-full-screen", restoreFull); win.on("minimize", restoreMinimized);
            win.setFullScreen = value => { if (value || !guarded) original.full.call(win, value); };
            win.setKiosk = value => { if (value || !guarded) original.kiosk.call(win, value); };
            try {
                win.setAlwaysOnTop(false); win.setClosable(false); win.setMinimizable(false);
                original.kiosk.call(win, mode === "kiosk"); original.full.call(win, true);
            } catch (error) { release("arm-failed"); throw error; }
        }
    };
}
module.exports = { snapshot, createRecovery, probe: () => ({ processType: process.type, pid: process.pid }) };
