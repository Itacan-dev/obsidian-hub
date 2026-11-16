"use strict";
const path = require("path"), { randomUUID } = require("crypto");
const { ReminderState } = require("./oath-reminder-state.cjs");
const { Supervisor } = require("./oath-foreground-supervisor.cjs");
const { centeredBounds } = require("./oath-reminder-placement.cjs");
const handle = win => win.getNativeWindowHandle().readInt32LE();
async function createReminder({ win, coordinator, policy, desktop = require("electron"), adapter = new Supervisor(desktop.utilityProcess), now = () => performance.now() }) {
    const { BrowserWindow, screen, ipcMain, powerMonitor } = desktop;
    const channel = "oath-reminder-" + randomUUID(), state = new ReminderState();
    let disposed = false, active = false, suspended = false, visible = false, timer, freshness, lastSuccess = -Infinity, lastExternal = null, displayId = null;
    const reminder = new BrowserWindow({ width: 380, height: 230, show: false, frame: false, movable: false,
        resizable: false, minimizable: false, maximizable: false, fullscreenable: false, closable: false, skipTaskbar: true, alwaysOnTop: true,
        webPreferences: { preload: path.join(__dirname,"../ui/oath-reminder/preload.cjs"), additionalArguments: ["--reminder-channel="+channel],
            partition: channel, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, devTools: false } });
    const unregisterRecovery = coordinator.developmentRecovery?.registerWindow(reminder);
    const identity = coordinator.host.identity;
    identity.reminderHandle = BigInt.asUintN(64, reminder.getNativeWindowHandle().readBigUInt64LE()).toString();
    function hide() { state.reset(); if (!reminder.isDestroyed()) reminder.hide(); visible = false; }
    function place() {
        if (disposed || reminder.isDestroyed()) return;
        const value = centeredBounds(screen, lastExternal, win.isDestroyed() ? null : win.getBounds(), displayId);
        displayId = value.displayId;
        if (JSON.stringify(reminder.getBounds()) !== JSON.stringify(value.bounds)) reminder.setBounds(value.bounds);
    }
    function dispose() {
        if (disposed) return;
        disposed = true; active = false; clearTimeout(timer); clearInterval(freshness); adapter.stop();
        for (const event of ["display-added","display-removed","display-metrics-changed"]) screen.removeListener(event,place);
        for (const event of ["lock-screen","suspend"]) powerMonitor.removeListener(event,suspend);
        for (const event of ["unlock-screen","resume"]) powerMonitor.removeListener(event,resume);
        ipcMain.removeHandler(channel); unregisterRecovery?.(); delete identity.reminderHandle;
        if (!reminder.isDestroyed()) reminder.destroy();
    }
    function degrade() {
        dispose();
        coordinator.reminderUnavailable = true;
        if (coordinator.current) coordinator.update({ ...coordinator.health, reminder: "unavailable", status: "degraded",
            warnings: [...coordinator.health.warnings, "The Oath Reminder is unavailable. Your Oath remains active."] });
    }
    function suspend() { suspended = true; hide(); }
    function resume() { suspended = false; lastSuccess = -Infinity; hide(); }
    function classify(f) {
        if (!f) return "unknown";
        if (f.pid === process.pid) {
            if (f.handle === handle(reminder)) return "self";
            if (!win.isDestroyed() && f.handle === handle(win)) return "permitted";
            if (coordinator.developmentRecovery?.ownsForeground(f)) return "permitted";
            if (identity.dockHandle && f.handle === Number(BigInt.asIntN(32,BigInt(identity.dockHandle)))) return "permitted";
        }
        if (f.identity !== "observed" || !f.executable) return "unknown";
        return policy.applications.includes(f.executable) ? "permitted" : "non-permitted";
    }
    async function poll() {
        if (!active || disposed) return;
        try {
            const sample = await adapter.request("foreground");
            if (disposed || !active) return;
            lastSuccess = now();
            const kind = suspended ? "unknown" : classify(sample.foreground);
            const model = state.sample(kind,lastSuccess, sample.foreground?.executable ? path.win32.basename(sample.foreground.executable) : "");
            if (kind === "non-permitted") lastExternal = sample.foreground;
            else if (kind !== "self") lastExternal = null;
            if (!model.visible) { if (visible) reminder.hide(); visible = false; }
            else {
                place(); reminder.webContents.send(channel+":model",{label:model.label});
                if (!visible) { reminder.showInactive(); visible = true; }
            }
        } catch { degrade(); }
        finally { if (active && !disposed) timer = setTimeout(poll,250); }
    }
    reminder.on("close", event => { if (!disposed) event.preventDefault(); });
    reminder.on("will-move", event => event.preventDefault());
    reminder.webContents.setWindowOpenHandler(() => ({action:"deny"}));
    reminder.webContents.on("will-navigate",event => event.preventDefault());
    reminder.webContents.session.setPermissionRequestHandler((_web,_permission,callback) => callback(false));
    reminder.webContents.session.setPermissionCheckHandler(() => false);
    reminder.webContents.on("render-process-gone",degrade);
    ipcMain.handle(channel,(event,action) => {
        if (disposed || event.sender !== reminder.webContents || event.senderFrame !== reminder.webContents.mainFrame || action !== "return") throw Error("Invalid reminder action");
        coordinator.host.focus();
    });
    for (const event of ["display-added","display-removed","display-metrics-changed"]) screen.on(event,place);
    for (const event of ["lock-screen","suspend"]) powerMonitor.on(event,suspend);
    for (const event of ["unlock-screen","resume"]) powerMonitor.on(event,resume);
    try {
        await reminder.loadFile(path.join(__dirname,"../ui/oath-reminder/reminder.html"));
        adapter.start();
        if (!(await adapter.request("capabilities")).observation) throw Error("Foreground observer could not load");
        if (disposed) throw Error("Reminder preparation was released");
    } catch (error) { dispose(); throw error; }
    return { dispose, start() {
        if (disposed || active) return;
        active = true;
        freshness = setInterval(() => { if (now()-lastSuccess > 500) hide(); },100);
        void poll();
    } };
}
module.exports = { createReminder };
