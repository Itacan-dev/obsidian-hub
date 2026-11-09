"use strict";
// Loads the locally installed Obsidian application in an isolated, hidden
// Electron process. The launcher supplies a fresh profile and synthetic vault.
const electron = require("electron"), fs = require("fs"), path = require("path");
const { EventEmitter } = require("events");
const os = require("os");
os.userInfo = () => ({ username: "hub-location-fixture-" + process.pid, homedir: os.homedir(), uid: -1, gid: -1, shell: null });
const scratch = process.env.ITACAN_COLOR_NATIVE_ROOT;
if (!scratch || !path.basename(scratch).startsWith("hub-color-native-")) throw Error("Missing isolated Location runtime root");
const vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
electron.app.setPath("userData", profile);
electron.app.setName("Itacan Color Runtime Test");
electron.app.commandLine.appendSwitch("disable-gpu");
electron.app.commandLine.appendSwitch("no-sandbox");
const NativeWindow = electron.BrowserWindow;
const ownedWindows = [];
function HiddenWindow(options = {}) {
    // Electron's built-in classes cannot be subclassed. Return a genuine
    // BrowserWindow, preserving its native registry and remote identity.
    const window = new NativeWindow({ ...options, show: false, webPreferences: { ...options.webPreferences,
        backgroundThrottling: false, preload: path.join(__dirname, "color-obsidian-preload.cjs") } });
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
const remote = require(path.join(process.env.ITACAN_TEST_REMOTE, "main"));
remote.initialize();
appElectron.remote = { enable: contents => remote.enable(contents) };
for (const name of ["showErrorBox", "showMessageBox", "showMessageBoxSync", "showOpenDialog", "showOpenDialogSync"]) {
    electron.dialog[name] = (...args) => {
        console.error("Unexpected Obsidian dialog:", name, JSON.stringify(args.at(-1)));
        if (name.endsWith("Sync")) return name.includes("Message") ? 1 : undefined;
        return Promise.resolve({ canceled: true, response: 1, filePaths: [] });
    };
}
electron.shell.openExternal = async () => { throw Error("External browsing is outside the Location fixture"); };
const archive = process.env.ITACAN_OBSIDIAN_ARCHIVE || "C:\\Program Files\\Obsidian\\resources\\obsidian.asar";
if (!fs.existsSync(archive)) throw Error("Installed Obsidian archive is unavailable");
const events = new EventEmitter();
events.on("check-start", () => events.emit("check-end"));
const Module = require("module"), originalLoad = Module._load;
Module._load = function (name) { return name === "electron" ? appElectron : originalLoad.apply(this, arguments); };
const boot = require(path.join(archive, "main.js"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let failed = false;
const timer=setTimeout(()=>{console.error("Native color test timed out");electron.app.exit(1)},90000);
electron.app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "window") {
        contents.on("console-message", event => {
            const message = event.message || "";
            if (/error|failed|fail|pass|location_runtime/i.test(message)) console.log("Obsidian:", message);
        });
        contents.on("render-process-gone", (_event, details) => { failed = true; console.error(details); electron.app.exit(1); });
    }
});
electron.app.whenReady().then(async () => {
    try {
        let window, state, triedEnable = false;
        for (let attempt = 0; attempt < 350; attempt++) {
            window = ownedWindows.find(value => !value.isDestroyed());
            if (attempt % 50 === 0) console.log("COLOR_RUNTIME windows", ownedWindows.length);
            if (window) {
                state = await window.webContents.executeJavaScript(`JSON.stringify({title:document.title,url:location.href,app:!!window.app,plugins:!!window.app?.plugins,loaded:!!window.app?.plugins?.plugins?.['hub-project-menu'],api:typeof window.require})`).catch(error => { if (attempt % 50 === 0) console.log(error.message); return null; });
                if (attempt % 50 === 0) console.log("COLOR_RUNTIME progress", state);
                if (state && JSON.parse(state).loaded) break;
                if (state && JSON.parse(state).plugins && !triedEnable && attempt > 15) {
                    triedEnable = true;
                    console.log("COLOR_RUNTIME plugin inventory", await window.webContents.executeJavaScript("JSON.stringify({plugins:Object.keys(app.plugins.manifests),enabled:[...app.plugins.enabledPlugins],folder:app.plugins.getPluginFolder(),base:app.vault.adapter.getBasePath(),config:app.vault.configDir})"));
                    await window.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();return app.plugins.enablePlugin('hub-project-menu')})()").catch(error => console.error("COLOR_RUNTIME enable", error.message));
                }
            }
            await delay(100);
        }
        console.log("COLOR_RUNTIME", state);
        if (!state || !JSON.parse(state).loaded) throw Error("Actual Obsidian did not load the fixture Hub plugin");
        window.setSize(1200, 900);

        const result=await window.webContents.executeJavaScript(require('fs').readFileSync(path.join(__dirname,'color-obsidian-fixture.cjs'),'utf8'));
        window.webContents.debugger.attach('1.3');

        const nativePrimaryCases={};
        for(const name of result.nativeCases||[]) {
            await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
            const before=await window.webContents.executeJavaScript(`window.__stage2OpenCase(${JSON.stringify(name)})`);
            await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:before.x,y:before.y});await delay(220);
            // Hidden Electron windows may leave compositor transitions at time zero.
            // Settle only paint transitions on the genuinely hovered action. The
            // browser fixture separately checks the real 120ms transition contract.
            await window.webContents.executeJavaScript('window.__stage2FinishPaint()');
            const after=await window.webContents.executeJavaScript('window.__stage2ReadCase()');
            console.log('NATIVE_PRIMARY',name,JSON.stringify({before,after}));
            await window.webContents.executeJavaScript(`window.__stage2CheckPair(${JSON.stringify(before)},${JSON.stringify(after)})`);
            if(before.width!==after.width||before.height!==after.height)throw Error('Primary hover geometry changed in '+name);
            nativePrimaryCases[name]={normal:before.background,hover:after.background,foreground:after.color};
            await window.webContents.executeJavaScript('window.__stage2CloseCase()');
        }
        if(new Set(Object.values(nativePrimaryCases).map(x=>x.normal+' / '+x.hover)).size!==1)throw Error('Native primary pairs diverged');
        result.summary.nativePrimaryCases=nativePrimaryCases;

        await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
        await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:4,y:1});
        await delay(30);
        await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...result.tooltipTarget});
        await delay(1400);
        const tooltip=await window.webContents.executeJavaScript(`(()=>{const e=document.querySelector('.tooltip.hub-color-scope');return e?{color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}:null})()`);
        if(!tooltip||tooltip.color!=='rgb(250, 250, 250)')throw Error('Native tooltip lost ownership or color: '+JSON.stringify({tooltip,details:await window.webContents.executeJavaScript("JSON.stringify({tips:[...document.querySelectorAll('.tooltip')].map(e=>e.outerHTML),labels:[...document.querySelectorAll('[aria-label=\"Owned native tooltip\"]')].map(e=>({html:e.outerHTML,hover:e.matches(':hover'),no:getComputedStyle(e).getPropertyValue('--no-tooltip')})),hover:[...document.querySelectorAll(':hover')].map(e=>e.tagName+'.'+e.className)})")}));
        result.summary.nativeTooltip=true;
        fs.writeFileSync(path.join(scratch,process.env.ITACAN_COLOR_RESULT||'baseline.json'),JSON.stringify(result,null,2));
        const image=await window.webContents.capturePage();fs.writeFileSync(path.join(scratch,(process.env.ITACAN_COLOR_RESULT||'baseline.json')+'.png'),image.toPNG());
        console.log('PASS native color probe',JSON.stringify(result.summary)); clearTimeout(timer); electron.app.exit(0);
    } catch(error) { console.error(error); clearTimeout(timer);electron.app.exit(1); }
});
try { boot(archive, events); } catch(error){console.error(error);electron.app.exit(1)}
