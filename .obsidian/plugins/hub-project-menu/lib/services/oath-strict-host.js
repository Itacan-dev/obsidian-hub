"use strict";
// Main-process Electron APIs only. No Obsidian imports or development escape.
const { StrictOathCoordinator } = require("./oath-strict");
const { OathProcessObserver } = require("./oath-process-observer");
const ownerKey = Symbol.for("itacan.strict-oath.window-owner");
function createStrictHost(win, options = {}) {
    const desktop = options.desktop ?? require("electron");
    const makeDock = options.makeDock ?? require("./oath-dock").createOathDock;
    let saved = null, pendingRestore = null, guarded = false, lastRestore = 0, dock = null;
    let dockConfig = null, opening = null, epoch = 0, lastRepair = -Infinity, lost = null, releasing = null;
    const full = win.setFullScreen, kiosk = win.setKiosk, contents = win.webContents;
    const identity = { pid: process.pid, handle: win.getNativeWindowHandle().readBigUInt64LE().toString() };
    const close = event => { if (guarded) event.preventDefault(); };
    const input = (event, key) => {
        if (guarded && (key.key === "Escape" || key.key === "F11" || key.key === "F4" && key.alt)) event.preventDefault();
    };
    const restore = () => {
        if (!guarded || win.isDestroyed() || Date.now() - lastRestore < 1000) return;
        lastRestore = Date.now(); if (win.isMinimized()) win.restore(); if (!win.isFullScreen()) full.call(win, true);
    };
    const reposition = () => { if (guarded) { restore(); dock?.reposition(); } };
    const resume = () => { lastRestore = 0; reposition(); };
    const rendererLost = () => { if (guarded) lost?.(); };
    win.webContents.on("render-process-gone", rendererLost);
    const openDock = (policy, actions) => {
        if (opening) return opening;
        dockConfig = { policy, actions }; const generation = epoch;
        dock?.dispose(); dock = null; delete identity.dockHandle;
        const work = (async () => {
            const created = await makeDock(win, policy, actions);
            if (!guarded || epoch !== generation) { created.dispose(); throw Error("Strict preparation was released."); }
            dock = created; identity.dockHandle = created.win.getNativeWindowHandle().readBigUInt64LE().toString();
            created.win.once("closed", () => { if (dock === created) delete identity.dockHandle; });
        })();
        opening = work;
        void work.finally(() => { if (opening === work) opening = null; }).catch(() => {});
        return work;
    };
    const restoreWindow = async () => {
        guarded = false; epoch++; dockConfig = null;
        desktop.powerMonitor.removeListener("resume", resume);
        for (const event of ["display-added", "display-removed", "display-metrics-changed"]) desktop.screen.removeListener(event, reposition);
        win.removeListener("move", reposition);
        let dockError;
        try { dock?.dispose(); } catch (error) { dockError = error.message; }
        dock = null; delete identity.dockHandle;
        win.removeListener("close", close); win.removeListener("minimize", restore); win.removeListener("leave-full-screen", restore);
        contents.removeListener("before-input-event", input);
        win.setFullScreen = full; win.setKiosk = kiosk;
        const previous = saved ?? pendingRestore; saved = null; pendingRestore = previous;
        if (globalThis[ownerKey] === win) delete globalThis[ownerKey];
        if (!previous || win.isDestroyed()) return;
        // A disconnected display must not restore the host entirely off-screen.
        previous.bounds = visibleBounds(previous.bounds, desktop.screen.getAllDisplays().map(display => display.workArea));
        const errors = dockError ? [dockError] : []; const attempt = fn => { try { fn(); } catch (error) { errors.push(error.message); } };
        attempt(() => kiosk.call(win, previous.kiosk)); attempt(() => full.call(win, previous.full));
        attempt(() => win.setClosable(previous.closable)); attempt(() => win.setMinimizable(previous.minimizable));
        attempt(() => win.setAlwaysOnTop(previous.top));
        // Windows can finish fullscreen geometry asynchronously. Settle before returning.
        for (let i = 0; i < 20 && !win.isDestroyed(); i++) {
            if (!previous.full && !previous.kiosk) attempt(() => {
                win.restore(); win.unmaximize(); win.setBounds(previous.bounds);
                if (previous.maximized) win.maximize(); if (previous.minimized) win.minimize();
            });
            await new Promise(resolve => setTimeout(resolve, 50));
            if (i >= 2 && JSON.stringify(win.getNormalBounds()) === JSON.stringify(previous.bounds) && win.isFullScreen() === previous.full) break;
        }
        if (!win.isDestroyed() && (win.isFullScreen() !== previous.full || win.isKiosk() !== previous.kiosk ||
            win.isClosable() !== previous.closable || win.isMinimizable() !== previous.minimizable ||
            win.isAlwaysOnTop() !== previous.top || win.isMinimized() !== previous.minimized || win.isMaximized() !== previous.maximized ||
            JSON.stringify(win.getNormalBounds()) !== JSON.stringify(previous.bounds))) errors.push("Saved window state did not settle");
        if (errors.length) throw Error("Strict window restoration: " + errors.join("; "));
        pendingRestore = null;
    };
    const release = () => releasing ??= restoreWindow().finally(() => { releasing = null; });
    win.once("closed", () => {
        contents.removeListener("render-process-gone", rendererLost);
        if (lost) lost(); else void release().catch(() => {});
    });
    return { identity, available: process.platform === "win32", release,
        onLost: callback => { lost = callback; },
        needsRestoration: () => !!pendingRestore,
        async maintain() {
            if (!guarded) return;
            reposition();
            if (!dock?.healthy() && dockConfig && Date.now() - lastRepair >= 15000) {
                lastRepair = Date.now(); await openDock(dockConfig.policy, dockConfig.actions);
            }
        },
        healthy: () => !win.isDestroyed() && win.isFullScreen() && !win.isMinimized() && !!dock?.healthy(),
        focus: () => { if (!win.isDestroyed()) win.focus(); },
        launch: (executable, args) => require("./oath-dock").launchApplication(executable, args),
        async pickApplication() {
            const result = await require("electron").dialog.showOpenDialog(win, { title: "Permit a desktop application", properties: ["openFile"], filters: [{ name: "Windows applications", extensions: ["exe"] }] });
            return result.canceled ? null : result.filePaths[0];
        },
        openDock,
        updateDock: health => dock?.update(health),
        async enter() {
            if (pendingRestore) throw Error("Restore the previous window state in Settings → The Oath before starting another Strict Oath.");
            if (globalThis[ownerKey] && globalThis[ownerKey] !== win) throw Error("Another Strict window is active in this process.");
            if (guarded) return;
            if (win.__hubOathFullscreenGuard?.enforced) throw Error("An ordinary Oath already owns fullscreen.");
            saved = { full: win.isFullScreen(), kiosk: win.isKiosk(), top: win.isAlwaysOnTop(),
                closable: win.isClosable(), minimizable: win.isMinimizable(), minimized: win.isMinimized(), maximized: win.isMaximized(), bounds: win.getNormalBounds() };
            globalThis[ownerKey] = win; guarded = true;
            lastRepair = -Infinity;
            desktop.powerMonitor.on("resume", resume);
            for (const event of ["display-added", "display-removed", "display-metrics-changed"]) desktop.screen.on(event, reposition);
            win.on("move", reposition);
            win.on("close", close); win.on("minimize", restore); win.on("leave-full-screen", restore); win.webContents.on("before-input-event", input);
            win.setFullScreen = value => { if (value || !guarded) full.call(win, value); };
            win.setKiosk = value => { if (!guarded) kiosk.call(win, value); };
            try {
                win.setAlwaysOnTop(false); win.setClosable(false); win.setMinimizable(false);
                kiosk.call(win, false); full.call(win, true);
                if (!win.isFullScreen()) throw Error("Fullscreen unavailable.");
            } catch (error) { await release(); throw error; }
        }
    };
}
function visibleBounds(bounds, areas) {
    if (!areas.length || areas.some(area => Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x) >= 64 &&
        Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y) >= 32)) return { ...bounds };
    const area = areas[0], width = Math.min(bounds.width, area.width), height = Math.min(bounds.height, area.height);
    return { x: area.x + Math.round((area.width - width) / 2), y: area.y + Math.round((area.height - height) / 2), width, height };
}
function getStrictCoordinator(win, options = {}) {
    const key = "__hubStrictOathCoordinator";
    if (!win[key]) win[key] = new StrictOathCoordinator({ ...options, host: createStrictHost(win), observer: options.observer ?? new OathProcessObserver() });
    else if (options.enabled === true && !win[key].enabled && !win[key].current) {
        // Test injection can explicitly configure this factory. Product opt-in is
        // applied by the lifecycle service after reading its device bucket.
        win[key].enabled = true;
        if (options.observer) win[key].observer = options.observer;
        if (options.now) win[key].now = options.now;
    }
    return win[key];
}
module.exports = { createStrictHost, getStrictCoordinator, visibleBounds };
