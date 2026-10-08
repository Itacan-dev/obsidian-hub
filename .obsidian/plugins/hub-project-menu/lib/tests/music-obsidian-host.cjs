"use strict";
// Loads the locally installed Obsidian application in an isolated, hidden
// Electron process. The launcher supplies a fresh profile and synthetic vault.
const electron = require("electron"), fs = require("fs"), path = require("path");
const { EventEmitter } = require("events");
const os = require("os");
os.userInfo = () => ({ username: "hub-music-fixture-" + process.pid, homedir: os.homedir(), uid: -1, gid: -1, shell: null });
const scratch = process.env.HUB_MUSIC_RUNTIME_ROOT;
if (!scratch || !path.basename(scratch).startsWith("hub-music-runtime-")) throw Error("Missing isolated Music runtime root");
const vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
electron.app.setPath("userData", profile);
electron.app.setName("Hub Music Runtime Test");
electron.app.commandLine.appendSwitch("disable-gpu");
electron.app.commandLine.appendSwitch("no-sandbox");
const NativeWindow = electron.BrowserWindow;
const ownedWindows = [];
function HiddenWindow(options = {}) {
    // Electron's built-in classes cannot be subclassed. Return a genuine
    // BrowserWindow, preserving its native registry and remote identity.
    const window = new NativeWindow({ ...options, show: false, webPreferences: { ...options.webPreferences,
        preload: path.join(__dirname, "music-obsidian-preload.cjs") } });
    window.show = () => {}; window.showInactive = () => {};
    ownedWindows.push(window); return window;
}
Object.setPrototypeOf(HiddenWindow, NativeWindow); HiddenWindow.prototype = NativeWindow.prototype;
// Electron's export getters are immutable. Supply a shallow facade to the
// application's main module, retaining the real Electron implementations.
const appElectron = { ...electron, BrowserWindow: HiddenWindow };
electron.protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true, corsEnabled: true } }
]);
const remote = require("../atlas/tests/native/node_modules/@electron/remote/main");
remote.initialize();
appElectron.remote = { enable: contents => remote.enable(contents) };
for (const name of ["showErrorBox", "showMessageBox", "showMessageBoxSync", "showOpenDialog", "showOpenDialogSync"]) {
    electron.dialog[name] = (...args) => {
        console.error("Unexpected Obsidian dialog:", name, JSON.stringify(args.at(-1)));
        if (name.endsWith("Sync")) return name.includes("Message") ? 1 : undefined;
        return Promise.resolve({ canceled: true, response: 1, filePaths: [] });
    };
}
electron.shell.openExternal = async () => { throw Error("External browsing is outside the Music fixture"); };
const archive = process.env.HUB_MUSIC_OBSIDIAN_ARCHIVE || "C:\\Program Files\\Obsidian\\resources\\obsidian.asar";
if (!fs.existsSync(archive)) throw Error("Installed Obsidian archive is unavailable");
const events = new EventEmitter();
events.on("check-start", () => events.emit("check-end"));
const Module = require("module"), originalLoad = Module._load;
Module._load = function (name) { return name === "electron" ? appElectron : originalLoad.apply(this, arguments); };
const boot = require(path.join(archive, "main.js"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let failed = false;
const musicGuestNavigation = [];
const timer = setTimeout(() => { failed = true; console.error("Music Obsidian runtime timed out"); electron.app.exit(1); }, 180000);
electron.app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
        for (const eventName of ["will-frame-navigate", "will-redirect", "did-navigate", "did-navigate-in-page"]) {
            contents.on(eventName, (event, legacyURL, _inPlace, legacyMain) => {
                const url = event.url || legacyURL;
                if ((event.isMainFrame ?? legacyMain ?? true) && url) {
                    const record = { nativeId: contents.id, event: eventName, url };
                    musicGuestNavigation.push(record);
                    console.log("MUSIC_RUNTIME guest navigation", JSON.stringify(record));
                }
            });
        }
    }
    if (contents.getType() === "window") {
        contents.on("console-message", event => {
            const message = event.message || "";
            if (/error|failed|fail|pass|music_runtime|music_provider_runtime/i.test(message)) console.log("Obsidian:", message);
        });
        contents.on("render-process-gone", (_event, details) => { failed = true; console.error(details); electron.app.exit(1); });
    }
});
electron.app.whenReady().then(async () => {
    try {
        let window, state, triedEnable = false;
        for (let attempt = 0; attempt < 350; attempt++) {
            window = ownedWindows.find(value => !value.isDestroyed());
            if (attempt % 50 === 0) console.log("MUSIC_RUNTIME windows", ownedWindows.length);
            if (window) {
                state = await window.webContents.executeJavaScript(`JSON.stringify({title:document.title,url:location.href,app:!!window.app,plugins:!!window.app?.plugins,loaded:!!window.app?.plugins?.plugins?.['hub-project-menu'],api:typeof window.require})`).catch(error => { if (attempt % 50 === 0) console.log(error.message); return null; });
                if (attempt % 50 === 0) console.log("MUSIC_RUNTIME progress", state);
                if (state && JSON.parse(state).loaded) break;
                if (state && JSON.parse(state).plugins && !triedEnable && attempt > 15) {
                    triedEnable = true;
                    console.log("MUSIC_RUNTIME plugin inventory", await window.webContents.executeJavaScript("JSON.stringify({plugins:Object.keys(app.plugins.manifests),enabled:[...app.plugins.enabledPlugins],folder:app.plugins.getPluginFolder(),base:app.vault.adapter.getBasePath(),config:app.vault.configDir})"));
                    await window.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();return app.plugins.enablePlugin('hub-project-menu')})()").catch(error => console.error("MUSIC_RUNTIME enable", error.message));
                }
            }
            await delay(100);
        }
        console.log("MUSIC_RUNTIME", state);
        if (!state || !JSON.parse(state).loaded) throw Error("Actual Obsidian did not load the fixture Hub plugin");
        const result = await window.webContents.executeJavaScript(`JSON.stringify({version:app.plugins.plugins['hub-project-menu'].constructor.__musicRuntimeApi.apiVersion,plugin:app.plugins.plugins['hub-project-menu'].manifest.id,music:!!app.plugins.plugins['hub-project-menu'].music,library:!!app.plugins.plugins['hub-project-menu'].musicLibrary})`);
        if (window.isVisible()) throw Error("Fixture window became visible");
        console.log("PASS actual isolated Obsidian plugin load", result);
        // Remote playback probes stay silent without changing provider APIs,
        // service policy, document visibility or the user's real application.
        window.webContents.setAudioMuted(true);
        window.setSize(1200, 900);
        const fixture = path.join(__dirname, "music-obsidian-fixture.cjs");
        const running = window.webContents.executeJavaScript(`require(${JSON.stringify(fixture)})(${JSON.stringify(scratch)}).then(result=>{window.__musicRuntimeResult=result;return result;},error=>{window.__musicRuntimeError=error.stack;throw error;})`);
        running.catch(() => {});
        for (let attempt = 0; attempt < 1600; attempt++) {
            const progress = await window.webContents.executeJavaScript("JSON.stringify({stage:window.__musicRuntimeStage,error:window.__musicRuntimeError,done:!!window.__musicRuntimeResult})");
            const status = JSON.parse(progress);
            if (status.error) throw Error(status.error);
            if (status.stage) {
                if (status.stage === "local-files") {
                    // CDP supplies genuine Chromium File objects to the actual
                    // native form. Production webUtils/path handling is used.
                    window.webContents.debugger.attach("1.3");
                    try {
                        const { root } = await window.webContents.debugger.sendCommand("DOM.getDocument");
                        const { nodeId } = await window.webContents.debugger.sendCommand("DOM.querySelector", {
                            nodeId: root.nodeId, selector: '.hub-music-item-dialog input[type="file"]' });
                        if (!nodeId) throw Error("Native Music file input is unavailable");
                        await window.webContents.debugger.sendCommand("DOM.setFileInputFiles", { nodeId,
                            files: [path.join(vault, "Fixture one.wav"), path.join(scratch, "Fixture two.wav")] });
                    } finally { window.webContents.debugger.detach(); }
                    await window.webContents.executeJavaScript("window.__musicRuntimeStage=null;window.__musicRuntimeContinue();");
                    continue;
                }
                // Resizing before the first capture wakes a hidden native
                // compositor, avoiding a stale first-run consent image.
                for (const width of [760, 420, 1200]) {
                    window.setSize(width, 900); await delay(200);
                    const geometry = JSON.parse(await window.webContents.executeJavaScript(`JSON.stringify([...document.querySelectorAll('.hub-music-dialog,.hub-settings-dialog')].map(dialog=>({width:dialog.clientWidth,scrollWidth:dialog.scrollWidth,right:dialog.getBoundingClientRect().right,viewport:innerWidth})))`));
                    for (const item of geometry) if (item.scrollWidth > item.width + 1 || item.right > item.viewport + 1) throw Error("Music native responsive overflow: " + JSON.stringify({ width, ...item }));
                    const capture = await window.webContents.capturePage({}, { stayHidden: true, stayAwake: true });
                    const output = path.join(os.tmpdir(), "hub-music-obsidian-" + status.stage + "-" + width + "-verified.png");
                    fs.writeFileSync(output, capture.toPNG()); console.log("Screenshot:", output);
                }
                window.setSize(1200, 900);
                await window.webContents.executeJavaScript("window.__musicRuntimeStage=null;window.__musicRuntimeContinue();");
            }
            if (status.done) break;
            await delay(100);
        }
        const report = await running;
        report.runtime = { obsidian: JSON.parse(result).version, electron: process.versions.electron,
            hidden: !window.isVisible(), isolated: true, muted: window.webContents.isAudioMuted() };
        report.musicGuestNavigation = musicGuestNavigation;
        const output = path.join(os.tmpdir(), "hub-music-obsidian-runtime-report.json");
        fs.writeFileSync(output, JSON.stringify(report, null, 2));
        console.log("PASS actual isolated Obsidian Music runtime", report.checks.length, "checks; report:", output);
    } catch (error) { failed = true; console.error(error.stack); }
    finally { clearTimeout(timer); electron.app.exit(failed ? 1 : 0); }
});
try { boot(archive, events); }
catch (error) { failed = true; clearTimeout(timer); console.error(error.stack); electron.app.exit(1); }
