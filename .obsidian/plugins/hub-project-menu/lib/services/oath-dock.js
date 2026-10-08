"use strict";
// Main-process bridge. The dock receives labels and indices, never executable authority.
const path = require("path"), { randomUUID } = require("crypto");
const { BrowserWindow, ipcMain, screen } = require("electron");
const { spawn } = require("child_process");
function launchApplication(executable, args = []) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { shell: false, detached: true, stdio: "ignore", windowsHide: false });
        child.once("error", reject); child.once("spawn", () => { child.unref(); resolve({ pid: child.pid }); });
    });
}
async function createOathDock(host, policy, actions) {
    const channel = "itacan-oath-dock-" + randomUUID();
    const files = [...policy.applications];
    const bounds = () => {
        const area = screen.getDisplayMatching(host.getBounds()).workArea;
        const width = Math.min(760, area.width), height = Math.min(100, area.height);
        return { width, height, x: area.x + Math.round((area.width - width) / 2), y: area.y + area.height - height };
    };
    const win = new BrowserWindow({ ...bounds(),
        show: false, frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
        skipTaskbar: true, focusable: false, alwaysOnTop: true,
        webPreferences: { preload: path.join(__dirname, "../ui/oath-dock/preload.cjs"),
            additionalArguments: ["--oath-dock-channel=" + channel], partition: channel,
            sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, devTools: false } });
    let disposed = false, rendererHealthy = true;
    const model = { applications: files.map(file => path.win32.basename(file)), status: "Desktop checks are best effort. Switch with Alt+Tab." };
    const send = () => { if (!disposed && rendererHealthy && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel + ":model", model); };
    const request = async (event, action, index) => {
        if (disposed || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw Error("Invalid dock sender.");
        if (action === "ready") { send(); return; }
        if (action === "focus") { actions.focus(); return; }
        if (action !== "launch" || !Number.isInteger(index) || index < 0 || index >= files.length) throw Error("Invalid dock action.");
        return actions.launch(files[index]);
    };
    ipcMain.handle(channel, request);
    const dispose = () => { if (disposed) return; disposed = true; ipcMain.removeHandler(channel); if (!win.isDestroyed()) win.destroy(); };
    win.once("closed", dispose);
    win.webContents.on("render-process-gone", () => { rendererHealthy = false; });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    try {
        await win.loadFile(path.join(__dirname, "../ui/oath-dock/index.html"));
        win.showInactive();
    } catch (error) { dispose(); throw error; }
    return { win, dispose, reposition() { if (!disposed && !win.isDestroyed()) win.setBounds(bounds()); },
        healthy: () => !disposed && rendererHealthy && !win.isDestroyed(), update(health) {
        model.status = health.status === "degraded" ? "Desktop checks limited. Your Oath remains active." : "Desktop checks are best effort. Switch with Alt+Tab.";
        send();
    } };
}
module.exports = { createOathDock, launchApplication };
