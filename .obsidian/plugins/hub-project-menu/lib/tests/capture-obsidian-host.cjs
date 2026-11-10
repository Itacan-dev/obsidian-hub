"use strict";
// Loads the locally installed Obsidian application in an isolated, hidden
// Electron process. The launcher supplies a fresh profile and synthetic vault.
const electron = require("electron"), fs = require("fs"), path = require("path");
const { EventEmitter } = require("events");
const os = require("os");
os.userInfo = () => ({ username: "hub-location-fixture-" + process.pid, homedir: os.homedir(), uid: -1, gid: -1, shell: null });
const scratch = process.env.HUB_CAPTURE_RUNTIME_ROOT;
if (!scratch || !path.basename(scratch).startsWith("hub-capture-runtime-")) throw Error("Missing isolated Location runtime root");
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
const archive = process.env.HUB_CAPTURE_OBSIDIAN_ARCHIVE || "C:\\Program Files\\Obsidian\\resources\\obsidian.asar";
if (!fs.existsSync(archive)) throw Error("Installed Obsidian archive is unavailable");
const events = new EventEmitter();
events.on("check-start", () => events.emit("check-end"));
const Module = require("module"), originalLoad = Module._load;
Module._load = function (name) { return name === "electron" ? appElectron : originalLoad.apply(this, arguments); };
const boot = require(path.join(archive, "main.js"));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let failed = false;
const timer=setTimeout(()=>{console.error("Native location test timed out");electron.app.exit(1)},180000);
electron.app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "window") {
        contents.on("console-message", event => {
            const message = event.message || "";
            if (/error|failed|fail|pass|location_runtime/i.test(message)) console.log("Obsidian:", message);
        });
        contents.on("render-process-gone", (_event, details) => { failed = true; console.error(details); electron.app.exit(1); });
    }
});
electron.app.whenReady().then(async()=>{
 try{
  let window;
  for(let i=0;i<400;i++){
   window=ownedWindows.find(w=>!w.isDestroyed());
   if(window&&await window.webContents.executeJavaScript("!!window.app?.plugins?.plugins?.['hub-project-menu']?.captureTest").catch(()=>false))break;
   if(i===60&&window)await window.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();await app.plugins.enablePlugin('hub-project-menu')})()").catch(console.error);
   await delay(100);
  }
  if(!window)throw Error('No isolated Obsidian window');window.setSize(1100,850);
  const wc=window.webContents;
  wc.debugger.attach('1.3');
  await wc.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});
  await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  let result,error,done=false;
  wc.executeJavaScript('require('+JSON.stringify(path.join(__dirname,'capture-obsidian-fixture.cjs'))+')('+JSON.stringify(process.env.HUB_CAPTURE_PHASE)+')').then(r=>{result=r;done=true;},e=>{error=e;done=true;});
  while(!done){
   const request=await wc.executeJavaScript('window.__captureKeyRequest??null');
   if(request){await wc.executeJavaScript('window.__captureKeyRequest=null');const vk={Escape:27,Enter:13,Tab:9}[request];await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:request,code:request,windowsVirtualKeyCode:vk,...(request==='Enter'?{text:'\r'}:{})});await wc.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:request,code:request,windowsVirtualKeyCode:vk});await wc.executeJavaScript('window.__captureKeyDone()');}
   const point=await wc.executeJavaScript('window.__captureMouseRequest??null');
   if(point){await wc.executeJavaScript('window.__captureMouseRequest=null');await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await wc.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await wc.executeJavaScript('window.__captureMouseDone()');}
   const shot=await wc.executeJavaScript('window.__captureShotRequest??null');
   if(shot){await wc.executeJavaScript('window.__captureShotRequest=null');const size=window.getSize();window.setSize(size[0]+1,size[1]);await delay(150);window.setSize(...size);await delay(200);fs.writeFileSync(path.join(scratch,shot+'.png'),(await wc.capturePage()).toPNG());await wc.executeJavaScript('window.__captureShotDone()');}
   await delay(25);
  }
  if(error)throw error;
  fs.writeFileSync(path.join(scratch,process.env.HUB_CAPTURE_PHASE+'-report.json'),JSON.stringify(result,null,2));
  console.log('PASS genuine capture phase '+process.env.HUB_CAPTURE_PHASE,JSON.stringify(result));
 }catch(error){failed=true;console.error(error.stack);}
 finally{clearTimeout(timer);electron.app.exit(failed?1:0);}
});
try{boot(archive,events);}catch(error){clearTimeout(timer);console.error(error.stack);electron.app.exit(1);}
