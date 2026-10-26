"use strict";
if (process.env.ITACAN_REAL_HOST_GUARD) require(process.env.ITACAN_REAL_HOST_GUARD);
const electron = require("electron"), fs = require("fs"), path = require("path"), os = require("os"), Module = require("module"), { EventEmitter } = require("events");
const root = process.env.ITACAN_REAL_HOST_ROOT, workspace = process.env.ITACAN_REAL_HOST_WORKSPACE;
if (!root || !path.basename(root).startsWith("itacan-real-host-")) throw Error("Missing owned profile");
const rel = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(root)); if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw Error("Invalid owned profile");
os.userInfo = () => ({ username: "itacan-m1a-" + process.pid, homedir: root, uid: -1, gid: -1, shell: null });
electron.app.setPath("userData", path.join(root, "obsidian-profile")); electron.app.setPath("crashDumps", path.join(root, "evidence")); electron.app.setName("Itacan isolated component rehearsal");
// Process-local rehearsal must not change OS protocol/startup registration.
electron.app.isDefaultProtocolClient = () => true;
for (const name of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient", "setLoginItemSettings", "setUserTasks", "setJumpList"]) electron.app[name] = () => false;
electron.app.commandLine.appendSwitch("disable-gpu"); electron.app.commandLine.appendSwitch("no-sandbox");
const NativeWindow = electron.BrowserWindow, windows = [];
function Hidden(options = {}) { const w = new NativeWindow({ ...options, show: false, webPreferences: { ...options.webPreferences, preload: path.join(__dirname, "obsidian-preload.cjs") } }); w.show = () => {}; w.showInactive = () => {}; windows.push(w); return w; }
Object.setPrototypeOf(Hidden, NativeWindow); Hidden.prototype = NativeWindow.prototype;
const facade = { ...electron, BrowserWindow: Hidden };
electron.protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true, corsEnabled: true } }]);
const remote = require(path.join(workspace, ".obsidian/plugins/hub-project-menu/lib/atlas/tests/native/node_modules/@electron/remote/main")); remote.initialize(); facade.remote = { enable: c => remote.enable(c) };
electron.shell.openExternal = async () => { throw Error("External navigation denied"); };
for (const n of ["showErrorBox", "showMessageBox", "showMessageBoxSync", "showOpenDialog", "showOpenDialogSync"]) electron.dialog[n] = () => n.endsWith("Sync") ? 1 : Promise.resolve({ canceled: true, response: 1, filePaths: [] });
const load = Module._load; Module._load = function(name) { return name === "electron" ? facade : load.apply(this, arguments); };
const archive = process.env.ITACAN_OBSIDIAN_ARCHIVE, events = new EventEmitter(); events.on("check-start", () => events.emit("check-end"));
const boot = require(path.join(archive, "main.js")), delay = ms => new Promise(r => setTimeout(r, ms));
electron.ipcMain.handle("m1a-capture",async(event,stage)=>{if(!["add","edit","list"].includes(stage))throw Error("Unknown capture");const image=await event.sender.capturePage({}, {stayHidden:true,stayAwake:true});fs.writeFileSync(path.join(root,"evidence/"+stage+".png"),image.toPNG());});
let failed = false; const timeout = setTimeout(() => { console.error("M1A timeout"); electron.app.exit(1); }, process.env.ITACAN_N4_PEER ? 600000 : process.env.ITACAN_REAL_HOST_SCENARIO === "cutover" ? 300000 : 120000);
electron.app.whenReady().then(async () => { try {
 electron.session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] }, (_details, done) => done({ cancel: true }));
 let w, ready = false;
 for (let n = 0; n < 400; n++) { w = windows.find(w => !w.isDestroyed()); if (w) { const s = await w.webContents.executeJavaScript("JSON.stringify({app:!!window.app,plugins:!!window.app?.plugins,boot:!!window.__m1aBootstrap})").catch(() => "{}"); const state = JSON.parse(s); if (state.boot) { ready = true; break; } if (state.plugins && n === 30) await w.webContents.executeJavaScript("(async()=>{localStorage.setItem('enable-plugin-'+app.appId,'true');await app.plugins.loadManifests();await app.plugins.enablePlugin('itacan-m1a-fixture')})()"); } await delay(100); }
 if (!ready) throw Error("Fixture bootstrap did not load");
 if (["home-schedule", "history", "startup", "cutover", "device-identity", "multi-owner", "git-shared"].includes(process.env.ITACAN_REAL_HOST_SCENARIO)) w.webContents.setBackgroundThrottling(false);
 w.webContents.setAudioMuted(true); w.setSize(1200, 900);
 const scenario = process.env.ITACAN_REAL_HOST_SCENARIO ?? "project";
 if (!["project", "home-schedule", "history", "startup", "cutover", "device-identity", "multi-owner", "git-shared"].includes(scenario)) throw Error("Unknown rehearsal scenario");
 const fixture = path.join(__dirname, process.env.ITACAN_N4_PEER ? "git-peer-obsidian.cjs" : scenario === "git-shared" ? "git-production-obsidian.cjs" : scenario === "multi-owner" ? "multi-owner-obsidian.cjs" : scenario === "device-identity" ? "cutover-identity.cjs" : ["startup", "cutover"].includes(scenario) ? "startup-obsidian.cjs" : scenario === "project" ? "obsidian-fixture.cjs" : scenario === "history" ? "history-obsidian.cjs" : "home-schedule-obsidian.cjs");
 if (process.env.ITACAN_TASK_LOCATION_CHECKS === "1" || process.env.ITACAN_NATIVE_CAPTURE_CHECKS === "1") {
  electron.ipcMain.handle("itacan-location-input", async(event, key) => {
   const codes={ArrowDown:40,ArrowUp:38,Escape:27,Tab:9,Enter:13};if(event.sender!==w.webContents || !Object.hasOwn(codes,key))throw Error("Owned location fixture input required");
   const debuggerApi=w.webContents.debugger;if(!debuggerApi.isAttached())debuggerApi.attach("1.3");
   for(const type of ["keyDown","keyUp"])await debuggerApi.sendCommand("Input.dispatchKeyEvent",{type,key,code:key,windowsVirtualKeyCode:codes[key]});
  });
  electron.ipcMain.handle("itacan-location-capture", async(event,name) => { if(event.sender!==w.webContents || !["picker-dark","picker-light"].includes(name))throw Error("Owned fixture capture required");await w.webContents.executeJavaScript("(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const m=[...document.querySelectorAll('.hub-task-location-dialog')].at(-1);await Promise.allSettled(m.getAnimations({subtree:true}).map(a=>a.finished));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})()");const styles=await w.webContents.executeJavaScript("(()=>{const m=[...document.querySelectorAll('.hub-task-location-dialog')].at(-1),r=m.querySelector('.hub-task-location-entry');return{rules:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return[]}}).filter(v=>v.selectorText&&[r,r.querySelector('.hub-task-location-name')].some(e=>e.matches(v.selectorText))).map(v=>v.cssText).filter(v=>/color|opacity|filter/.test(v)).slice(-18),tokens:[document.body,m,m.querySelector('.modal-content'),r,r.querySelector('.hub-task-location-name')].filter(Boolean).map(e=>({cls:e.className,inline:e.getAttribute('style'),text:getComputedStyle(e).getPropertyValue('--text-normal'),base:getComputedStyle(e).getPropertyValue('--color-base-100'),color:getComputedStyle(e).color})),theme:document.body.className,color:getComputedStyle(r).color,rowBackground:getComputedStyle(r).backgroundColor,modalBackground:getComputedStyle(m).backgroundColor,width:m.getBoundingClientRect().width}})()");fs.writeFileSync(path.join(root,"evidence",name+".json"),JSON.stringify(styles));const capture=await w.webContents.capturePage({}, {stayHidden:true,stayAwake:true});fs.writeFileSync(path.join(root,"evidence",name+".png"),capture.toPNG()); });
 }
 const report = await w.webContents.executeJavaScript(`require(${JSON.stringify(fixture)})({app:window.app,api:window.__m1aBootstrap.constructor.api},${JSON.stringify(root)})`);
 if (w.isVisible()) throw Error("Owned test window unexpectedly visible");
 const capture = await w.webContents.capturePage({}, { stayHidden: true, stayAwake: true }); fs.writeFileSync(path.join(root, "evidence/final.png"), capture.toPNG());
 fs.writeFileSync(path.join(root, "evidence/report.json"), JSON.stringify({ ...report, hidden: true, electron: process.versions.electron }, null, 2)); console.log(["startup", "cutover", "device-identity", "multi-owner", "git-shared"].includes(scenario) ? "PASS actual Itacan startup" : scenario === "project" ? "PASS actual Obsidian M1A" : scenario === "history" ? "PASS actual Obsidian History/Statistics" : "PASS actual Obsidian Home/Schedule", report.checks.length, "checks");
 } catch (e) { failed = true; console.error(e.stack); } finally { clearTimeout(timeout); if (!failed && (process.env.ITACAN_REAL_HOST_SCENARIO === "multi-owner" || process.env.ITACAN_N4_PEER)) electron.app.quit(); else electron.app.exit(failed ? 1 : 0); } });
if (process.env.ITACAN_REAL_HOST_SCENARIO === "multi-owner" || process.env.ITACAN_N4_PEER) {
 const trace = (stage, value = null) => fs.appendFileSync(path.join(root,"evidence/quit-trace.jsonl"),JSON.stringify({stage,value,time:Date.now()})+"\n");
 electron.app.on("before-quit",()=>trace("before-quit"));
 electron.app.on("browser-window-created",(_e,w)=>{w.on("close",e=>trace("window-close",{prevented:e.defaultPrevented}));w.webContents.on("will-prevent-unload",()=>trace("will-prevent-unload"));w.webContents.on("console-message",(_e,level,message)=>{if(level>=2)trace("renderer-error",message)});});
 electron.app.on("will-quit",()=>{const file=path.join(root,"evidence/native-directories.json");if(fs.existsSync(file)){const dirs=JSON.parse(fs.readFileSync(file)),remaining=dirs.filter(d=>fs.existsSync(path.join(d,"WRITER.lock")));trace("will-quit",{remaining});fs.writeFileSync(path.join(root,"evidence/quit-result.json"),JSON.stringify({remaining,processGracefulQuit:true}));if(remaining.length)electron.app.exit(1)}});
}
boot(archive, events);
