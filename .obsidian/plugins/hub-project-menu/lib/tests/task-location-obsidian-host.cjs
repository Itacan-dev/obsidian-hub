"use strict";
// Loads the locally installed Obsidian application in an isolated, hidden
// Electron process. The launcher supplies a fresh profile and synthetic vault.
const electron = require("electron"), fs = require("fs"), path = require("path");
const { EventEmitter } = require("events");
const os = require("os");
os.userInfo = () => ({ username: "hub-location-fixture-" + process.pid, homedir: os.homedir(), uid: -1, gid: -1, shell: null });
const scratch = process.env.HUB_LOCATION_RUNTIME_ROOT;
if (!scratch || !path.basename(scratch).startsWith("hub-location-runtime-")) throw Error("Missing isolated Location runtime root");
const vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
electron.app.setPath("userData", profile);
electron.app.setName("Hub Location Runtime Test");
electron.app.commandLine.appendSwitch("disable-gpu");
electron.app.commandLine.appendSwitch("no-sandbox");
const NativeWindow = electron.BrowserWindow;
const ownedWindows = [];
function HiddenWindow(options = {}) {
    // Electron's built-in classes cannot be subclassed. Return a genuine
    // BrowserWindow, preserving its native registry and remote identity.
    const window = new NativeWindow({ ...options, show: false, webPreferences: { ...options.webPreferences,
        backgroundThrottling: false, preload: path.join(__dirname, "music-obsidian-preload.cjs") } });
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
electron.shell.openExternal = async () => { throw Error("External browsing is outside the Location fixture"); };
const archive = process.env.HUB_LOCATION_OBSIDIAN_ARCHIVE || "C:\\Program Files\\Obsidian\\resources\\obsidian.asar";
if (!fs.existsSync(archive)) throw Error("Installed Obsidian archive is unavailable");
const events = new EventEmitter();
events.on("check-start", () => events.emit("check-end"));
const Module = require("module"), originalLoad = Module._load;
Module._load = function (name) { return name === "electron" ? appElectron : originalLoad.apply(this, arguments); };
const boot = require(path.join(archive, "main.js"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let failed = false;
const timer=setTimeout(()=>{console.error("Native location test timed out");electron.app.exit(1)},600000);
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
            if (attempt % 50 === 0) console.log("LOCATION_RUNTIME windows", ownedWindows.length);
            if (window) {
                state = await window.webContents.executeJavaScript(`JSON.stringify({title:document.title,url:location.href,app:!!window.app,plugins:!!window.app?.plugins,loaded:!!window.app?.plugins?.plugins?.['hub-project-menu'],api:typeof window.require})`).catch(error => { if (attempt % 50 === 0) console.log(error.message); return null; });
                if (attempt % 50 === 0) console.log("LOCATION_RUNTIME progress", state);
                if (state && JSON.parse(state).loaded) break;
                if (state && JSON.parse(state).plugins && !triedEnable && attempt > 15) {
                    triedEnable = true;
                    console.log("LOCATION_RUNTIME plugin inventory", await window.webContents.executeJavaScript("JSON.stringify({plugins:Object.keys(app.plugins.manifests),enabled:[...app.plugins.enabledPlugins],folder:app.plugins.getPluginFolder(),base:app.vault.adapter.getBasePath(),config:app.vault.configDir})"));
                    await window.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();return app.plugins.enablePlugin('hub-project-menu')})()").catch(error => console.error("LOCATION_RUNTIME enable", error.message));
                }
            }
            await delay(100);
        }
        console.log("LOCATION_RUNTIME", state);
        if (!state || !JSON.parse(state).loaded) throw Error("Actual Obsidian did not load the fixture Hub plugin");
        window.setSize(1200, 900);

        const wc=window.webContents;
        await wc.executeJavaScript(`require(${JSON.stringify(path.join(__dirname,'task-location-obsidian-fixture.cjs'))})()`);
        wc.debugger.attach('1.3');
        const call=(m,p={})=>wc.debugger.sendCommand(m,p);
        const evaluate=expression=>wc.executeJavaScript(expression);
        const move=(x=1,y=1)=>call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
        const click=async expression=>{const p=await evaluate(`(()=>{const e=(${expression});if(!e)throw Error('Missing target: '+${JSON.stringify(expression)}+' DOM: '+__locationProbe.modal.locationPicker?.containerEl.outerHTML.slice(0,2500));const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await move(p.x,p.y);await call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};

        const assert=require('assert/strict');
        const key=async(key,code,vk)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(vk===13?{text:'\r'}:vk===32?{text:' '}:{})});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk})};
        const settle=()=>evaluate('new Promise(r=>setTimeout(r,30))');
        const rest=async()=>{
            await move();await settle();
            const state=await evaluate('__locationProbe.inspect()');
            for(const e of state.slice(0,-2)){
                assert.equal(e.bg,'rgba(0, 0, 0, 0)','Transparent control and descendants');
                assert.equal(e.shadow,'none','No raised focus shadow: '+e.cls);
                assert(!e.hover&&!e.active,'No stale hover or active state');
            }
            assert(await evaluate('!__locationProbe.modal.locationPicker'),'Picker closed');
            return state;
        };
        const results=[];
        for(const theme of (process.env.HUB_LOCATION_SMOKE?['dark']:['dark','light'])){
         await evaluate(`document.body.classList.remove('theme-dark','theme-light');document.body.classList.add('theme-${theme}')`);
         for(const mode of (process.env.HUB_LOCATION_SMOKE?['Add']:['Add','Edit']))for(const kind of (process.env.HUB_LOCATION_SMOKE?['root']:['root','folder','note'])){
            await evaluate(`__locationProbe.open('${mode}','${kind}')`);await move();await settle();
            const before=await evaluate('__locationProbe.inspect()');
            const label=await evaluate('trigger().textContent');
            for(const dismissal of ['confirm','cancel','x','escape']){console.log('Testing',theme,mode,kind,dismissal);
                await click('trigger()');
                assert(await evaluate('Boolean(__locationProbe.modal.locationPicker)'),'Native input opens picker');
                if(dismissal==='escape')await key('Escape','Escape',27);
                else await click(dismissal==='confirm'?'__locationProbe.modal.locationPicker.confirm':dismissal==='x'?'__locationProbe.modal.locationPicker.modalEl.querySelector(".modal-header-button")':'__locationProbe.modal.locationPicker.contentEl.querySelector(".hub-task-dialog-actions button")');
                const after=await rest();
                assert.equal(await evaluate('trigger().textContent'),label,'Unchanged selection/cancel retains location');
                results.push({theme,mode,kind,dismissal,before:before[0],after:after[0]});
            }
            await click('trigger()');
            await click(kind==='root'?'__locationProbe.modal.locationPicker.list.querySelector("button")':'__locationProbe.modal.locationPicker.breadcrumbs.querySelector("button")');
            await click('__locationProbe.modal.locationPicker.confirm');await rest();
            assert.notEqual(await evaluate('trigger().textContent'),label,'New location updates draft');
            const geometry=await evaluate('(()=>{const b=trigger();return JSON.stringify([...b.children].map(e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height]}))})()');
            const point=await evaluate('(()=>{const r=trigger().getBoundingClientRect();return{x:r.x+2,y:r.y+2}})()');
            await move(point.x,point.y);await settle();
            assert(await evaluate('trigger().matches(":hover")&&getComputedStyle(trigger()).backgroundColor!=="rgba(0, 0, 0, 0)"'),'Genuine hover remains gray');
            assert.equal(await evaluate('(()=>{const b=trigger();return JSON.stringify([...b.children].map(e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height]}))})()'),geometry,'Hover does not move icon/text');
            await rest();
            await click('trigger()');
            await move(point.x,point.y);await key('Escape','Escape',27);await settle();
            assert(await evaluate('trigger().matches(":hover")'),'Pointer physically over opener remains hovered');
            await rest();
            await evaluate('__locationProbe.modal.taskFields.input.focus()');
            for(let i=0;i<8&&!await evaluate('document.activeElement===trigger()');i++)await key('Tab','Tab',9);
            assert(await evaluate('document.activeElement===trigger()&&trigger().matches(":focus-visible")'),'Tab gives deliberate visible focus');
            for(const [name,code,vk]of [['Enter','Enter',13],[' ','Space',32]]){
                await key(name,code,vk);
                assert(await evaluate('Boolean(__locationProbe.modal.locationPicker)'),'Keyboard activation '+code);
                await key('Escape','Escape',27);await settle();
                assert(await evaluate('document.activeElement===trigger()&&trigger().matches(":focus-visible")'),'Native keyboard restoration');
                assert(await evaluate('getComputedStyle(trigger()).boxShadow==="none"&&getComputedStyle(trigger()).outlineStyle!=="none"&&parseFloat(getComputedStyle(trigger()).outlineWidth)>0'),'Keyboard outline preserved without raised shadow');
            }
            console.log('PASS native',theme,mode,kind,'all dismissal paths, repeated open, changed location, hover, keyboard');
         }
        }
        await evaluate('__locationProbe.modal.close()');
        await wc.executeJavaScript("(async()=>{const p=app.plugins.plugins['hub-project-menu'];app.plugins.disablePlugin('hub-project-menu');await p.nativeTaskStopping})()");
        const report=path.join(os.tmpdir(),process.env.HUB_LOCATION_SMOKE?'itacan-location-native-pointer-smoke.json':'itacan-location-native-pointer.json');fs.writeFileSync(report,JSON.stringify(results,null,2));
        console.log('PASS actual isolated Obsidian location runtime',JSON.stringify({report,dismissalChecks:results.length,obsidian:'1.15.0',electron:process.versions.electron,hidden:!window.isVisible()}));
    } catch (error) { failed = true; console.error(error.stack); }
    finally { clearTimeout(timer); electron.app.exit(failed ? 1 : 0); }
});
try { boot(archive, events); }
catch (error) { failed = true; clearTimeout(timer); console.error(error.stack); electron.app.exit(1); }
