"use strict";
const electron = require("electron"), fs = require("fs"), path = require("path"), os = require("os"), { EventEmitter } = require("events");
const scratch = path.resolve(process.env.ATHENA_OBSIDIAN_ROOT || "");
if (path.dirname(scratch) !== path.resolve(os.tmpdir()) || !path.basename(scratch).startsWith("athena-obsidian-")) throw Error("Invalid isolated vault");
os.userInfo = () => ({ username: "athena-fixture-" + process.pid, homedir: os.homedir(), uid: -1, gid: -1, shell: null });
electron.app.setPath("userData", path.join(scratch, "profile")); electron.app.setName("Athena Runtime Fixture"); electron.app.disableHardwareAcceleration();
const windows = [], NativeWindow = electron.BrowserWindow;
function HiddenWindow(options = {}) {
  const win = new NativeWindow({ ...options, show: false, webPreferences: { ...options.webPreferences, backgroundThrottling: false, preload: path.resolve(__dirname, "../../tests/music-obsidian-preload.cjs") } });
  win.show = () => {}; win.showInactive = () => {}; windows.push(win); return win;
}
Object.setPrototypeOf(HiddenWindow, NativeWindow); HiddenWindow.prototype = NativeWindow.prototype;
const remote = require("../../atlas/tests/native/node_modules/@electron/remote/main"); remote.initialize();
const facade = { ...electron, BrowserWindow: HiddenWindow, remote: { enable: contents => remote.enable(contents) } };
electron.protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true, corsEnabled: true } }]);
for (const name of ["showErrorBox", "showMessageBox", "showMessageBoxSync", "showOpenDialog", "showOpenDialogSync"]) electron.dialog[name] = () => name.endsWith("Sync") ? 1 : Promise.resolve({ canceled: true, response: 1, filePaths: [] });
electron.shell.openExternal = async () => { throw Error("External browsing is disabled in this fixture"); };
const archive = process.env.ATHENA_OBSIDIAN_ARCHIVE || path.join(process.env.LOCALAPPDATA || "", "Programs/Obsidian/resources/obsidian.asar");
if (!fs.existsSync(archive)) throw Error("Set ATHENA_OBSIDIAN_ARCHIVE to an installed Obsidian archive");
const Module = require("module"), original = Module._load;
Module._load = function(name) { return name === "electron" ? facade : original.apply(this, arguments); };
const boot = require(path.join(archive, "main.js")), events = new EventEmitter(); events.on("check-start", () => events.emit("check-end"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms)); let failed = false;
const deadline = setTimeout(() => { console.error("Athena Obsidian fixture timed out"); electron.app.exit(1); }, 90000);
electron.app.on("web-contents-created", (_event, contents) => {
  contents.on("console-message", event => { if (/Athena fixture|plugin failure|Uncaught/i.test(event.message || "")) console.log(event.message); });
  contents.on("render-process-gone", (_event, details) => { console.error(details); electron.app.exit(1); });
});
electron.app.whenReady().then(async () => {
  try {
    electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, callback) => callback({ cancel: true }));
    let win, loaded = false, tried = false;
    for (let i = 0; i < 350; i++) {
      win = windows.find(item => !item.isDestroyed());
      if (win) {
        loaded = await win.webContents.executeJavaScript("!!window.app?.plugins?.plugins?.['hub-project-menu']").catch(() => false);
        if (loaded) break;
        const plugins = await win.webContents.executeJavaScript("!!window.app?.plugins").catch(() => false);
        if (plugins && !tried && i > 15) { tried = true; await win.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();await app.plugins.enablePlugin('hub-project-menu')})()"); }
      }
      await delay(100);
    }
    if (!loaded || !win || win.isVisible()) throw Error("Hidden isolated Obsidian did not load Hub");
    win.setSize(1200, 900);
    const fixture = path.join(__dirname, "obsidian-fixture.cjs");
    const result = await win.webContents.executeJavaScript(`require(${JSON.stringify(fixture)})(${JSON.stringify(scratch)})`);
    if (win.isVisible()) throw Error("Fixture window became visible");
    const report = { ...result, electron: process.versions.electron, chromium: process.versions.chrome, node: process.versions.node, isolated: true, hidden: true };
    // Wake the hidden native compositor after first-run dialogs and plugin reload.
    win.setSize(1180, 900); await delay(200); win.setSize(1200, 900); await delay(300);
    const root = path.resolve(__dirname, ".."); fs.mkdirSync(path.join(root, ".cache"), { recursive: true });
    fs.writeFileSync(path.join(root, ".cache/obsidian-report.json"), JSON.stringify(report, null, 2));
    const screenshot = await win.webContents.capturePage({}, { stayHidden: true, stayAwake: true }); fs.writeFileSync(path.join(root, ".cache/obsidian-verified.png"), screenshot.toPNG());
    console.log("PASS actual isolated Obsidian Athena", JSON.stringify(report));
  } catch (error) { failed = true; console.error(error.stack); }
  finally { clearTimeout(deadline); electron.app.exit(failed ? 1 : 0); }
});
try { boot(archive, events); } catch (error) { clearTimeout(deadline); console.error(error.stack); electron.app.exit(1); }
