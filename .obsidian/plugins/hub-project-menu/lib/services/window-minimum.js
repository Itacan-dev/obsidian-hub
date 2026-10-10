"use strict";

// BrowserWindow dimensions are logical (device-independent) pixels, matching
// CSS pixels at the normal 100% page zoom. This constrains the hosting window,
// not its workspace pane, and never explicitly resizes or repositions it.
function installWindowMinimum(win = globalThis.window) {
    let native, original, changed = false;
    const restore = () => {
        if (!changed) return;
        try {
            if (!native.isDestroyed()) native.setMinimumSize(...original);
            changed = false;
        } catch (error) {
            console.warn("Could not restore Itacan's window minimum size", error);
        }
    };
    try {
        native = win?.electronWindow || win?.electron?.remote?.getCurrentWindow?.();
        if (!native || typeof native.isDestroyed !== "function" || native.isDestroyed() ||
            typeof native.getMinimumSize !== "function" || typeof native.setMinimumSize !== "function") return restore;
        original = native.getMinimumSize();
        if (!Array.isArray(original) || original.length !== 2 ||
            !original.every(value => Number.isInteger(value) && value >= 0)) return restore;
        original = [...original];
        if (original[0] < 1024) {
            // Mark before calling so a partially failed native operation can
            // still restore the captured constraints.
            changed = true;
            native.setMinimumSize(1024, original[1]);
        }
    } catch (error) {
        restore();
        console.warn("Could not apply Itacan's window minimum size", error);
    }
    return restore;
}

module.exports = { installWindowMinimum };
