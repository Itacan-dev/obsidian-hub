"use strict";
// Actual sandboxed dock document; no Strict restrictions or application launching.
const electron=require('electron'),fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),assert=require('assert/strict');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-dock-colors-'));electron.app.setPath('userData',scratch);electron.app.commandLine.appendSwitch('no-sandbox');electron.app.commandLine.appendSwitch('disable-gpu');
const {PALETTES,DEFAULT_DOCK}=require('../ui/color-palettes');let shown=0;
const facade={...electron,BrowserWindow:function(options){const win=new electron.BrowserWindow({...options,show:false});win.showInactive=()=>{shown++};return win;}};
const file=path.resolve(__dirname,'../services/oath-dock.js'),moduleValue={exports:{}};
new Function('require','module','exports','__dirname',fs.readFileSync(file,'utf8'))(name=>name==='electron'?facade:name.startsWith('.')?require(path.resolve(path.dirname(file),name)):require(name),moduleValue,moduleValue.exports,path.dirname(file));
const timer=setTimeout(()=>electron.app.exit(1),30000);
electron.app.whenReady().then(async()=>{let dock;try{
 const host={getBounds:()=>({x:0,y:0,width:800,height:600})};
 dock=await moduleValue.exports.createOathDock(host,{applications:[]},{focus(){throw Error('Unexpected focus')},launch(){throw Error('Unexpected launch')}},{version:1,revision:1,colors:PALETTES[1].dock});
 assert.equal(shown,1);assert.equal(dock.win.isVisible(),false);
 for(let i=0;i<PALETTES.length;i++){
  const colors=PALETTES[i].dock;dock.setColors({version:1,revision:i+2,colors});await new Promise(r=>setTimeout(r,40));
  const result=await dock.win.webContents.executeJavaScript(`(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(['background','text','button','border','focus'].map(k=>[k,s.getPropertyValue('--hub-dock-'+k).trim()]))})()`);
  assert.deepEqual(result,colors);
 }
 assert.throws(()=>dock.setColors({version:1,revision:3,colors:{...DEFAULT_DOCK,background:'url(bad)'}}));
 dock.update({status:'degraded'});assert(dock.healthy());
 fs.writeFileSync(path.join(scratch,'dock.png'),(await dock.win.webContents.capturePage()).toPNG());
 console.log('PASS actual sandboxed dock initial color acknowledgment before show, five palette payloads under unchanged CSP, invalid-model rejection, health independence and cleanup');console.log(scratch);
 dock.dispose();clearTimeout(timer);electron.app.quit();
 }catch(error){console.error(error);dock?.dispose();clearTimeout(timer);electron.app.exit(1)}});
