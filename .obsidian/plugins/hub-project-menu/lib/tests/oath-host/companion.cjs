"use strict";
// An ordinary top-level Windows application in a SEPARATE Electron process.
// IPC controls only its own synthetic window; this is not an external-window adapter.
const { app, BrowserWindow } = require("electron"), fs = require("fs"), path = require("path"), os = require("os");
const root = process.env.ITACAN_OATH_FIXTURE, token = process.env.ITACAN_OATH_TOKEN;
if (!root || path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("itacan-oath-phase1-") ||
    JSON.parse(fs.readFileSync(path.join(root, "fixture.json"))).token !== token || !process.send) throw Error("Not a disposable Oath fixture");
app.setPath("userData", path.join(root, "companion-profile")); app.setName("Oath Phase 1 Companion");
let win, heartbeat = Date.now();
setInterval(() => { if (Date.now() - heartbeat > 4000) app.exit(2); }, 500);
setTimeout(() => app.exit(2), JSON.parse(fs.readFileSync(path.join(root, "fixture.json"))).preview ? 21 * 60000 : 140000);
process.on("disconnect", () => app.exit(0));
function state() { return { pid: process.pid, handle: win.getNativeWindowHandle().readInt32LE(), focused: win.isFocused(), minimized: win.isMinimized(),
    visible: win.isVisible(), full: win.isFullScreen(), bounds: win.getBounds(), contentBounds: win.getContentBounds(), parent: win.getParentWindow()?.id ?? null }; }
process.on("message", message => {
    if (message?.token !== token) return;
    if (message.type === "heartbeat") { heartbeat = Date.now(); return; }
    if (!win || win.isDestroyed()) return;
    try {
        switch (message.action) {
            case "focus": win.show(); win.focus(); break;
            case "minimize": win.minimize(); break;
            case "restore": win.restore(); win.focus(); break;
            case "bounds": win.setBounds(message.bounds); break;
            case "quit": app.exit(0); return;
            case "state": break;
            default: throw Error("Unknown fixture action");
        }
        process.send({ id: message.id, state: state() });
    } catch (error) { process.send({ id: message.id, error: error.message }); }
});
app.whenReady().then(async () => {
    win = new BrowserWindow({ width: 600, height: 400, title: "Oath Phase 1 external fixture", backgroundColor: "#27ae60",
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    await win.loadURL("data:text/html," + encodeURIComponent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Oath Phase 1 external fixture</title><body style="background:#27ae60;color:white;font:24px system-ui"><h1>External test application</h1><p>Separate process. Synthetic content only.</p><p>Minimize, restore and Alt+Tab normally.</p>'));
    win.webContents.on("will-navigate", event => event.preventDefault());
    process.send({ type: "ready", state: state() });
});
