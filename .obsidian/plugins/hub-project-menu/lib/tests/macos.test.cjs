"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createNativeOathGuard,createOathFullscreen}=require('../services/oath-fullscreen');
const {openMacShortcut}=require('../services/mac-shortcuts');
function fixture({timeout=100,initialFull=false}={}){
 const win=new EventEmitter();win.webContents=new EventEmitter();let full=initialFull,kiosk=false,destroyed=false;const calls=[];
 win.isDestroyed=()=>destroyed;win.isFullScreen=()=>full;win.isKiosk=()=>kiosk;
 win.setFullScreen=value=>calls.push(['full',value]);win.setKiosk=value=>{kiosk=value;calls.push(['kiosk',value])};
 const originalFull=win.setFullScreen,originalKiosk=win.setKiosk;
 const guard=createNativeOathGuard(win,()=>{}, {platform:'darwin',transitionTimeout:timeout});
 return{win,guard,calls,originalFull,originalKiosk,settle(value){full=value;win.emit(value?'enter-full-screen':'leave-full-screen')},destroy(){destroyed=true;win.emit('closed')}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Mac Oath waits for transitions, coalesces duplicate entry, and restores the saved state',async()=>{
 const f=fixture();let done=false;const first=f.guard.enter(),duplicate=f.guard.enter();assert.equal(first,duplicate);first.then(()=>done=true);
 await tick();assert.equal(done,false);assert(f.guard.enforced);assert.equal(f.win.listenerCount('enter-full-screen'),1);
 f.settle(true);assert.equal(await first,true);assert.equal(f.win.listenerCount('enter-full-screen'),0);
 const exit=f.guard.exit();await tick();assert.equal(f.win.setFullScreen,f.originalFull);assert.equal(f.win.listenerCount('close'),0);
 f.settle(false);await exit;assert.equal(f.guard.owned,false);assert.equal(f.win.isKiosk(),false);assert.equal(f.win.listenerCount('leave-full-screen'),0);assert.equal(f.win.listenerCount('closed'),0);
});
test('Mac Oath serializes entry followed by exit and restores initially fullscreen windows',async()=>{
 const f=fixture();const enter=f.guard.enter(),exit=f.guard.exit();await tick();f.settle(true);await enter;await tick();f.settle(false);await exit;
 assert.equal(f.guard.enforced,false);
 const g=fixture({initialFull:true});assert.equal(await g.guard.enter(),false);await g.guard.exit();assert.equal(g.win.isFullScreen(),true);assert.equal(g.win.isKiosk(),false);
});
test('Mac Oath timeout releases methods and listeners without losing its exit contract',async()=>{
 const f=fixture({timeout:10});await assert.rejects(f.guard.enter(),{code:'OATH_FULLSCREEN_TIMEOUT'});
 assert.equal(f.guard.enforced,false);assert.equal(f.guard.owned,false);assert.equal(f.win.setFullScreen,f.originalFull);assert.equal(f.win.setKiosk,f.originalKiosk);
 for(const event of ['enter-full-screen','leave-full-screen','close','closed'])assert.equal(f.win.listenerCount(event),0);
 assert.equal(f.win.webContents.listenerCount('before-input-event'),0);await f.guard.exit();
});
test('destroying the Mac window rejects transition and disposes temporary guards',async()=>{
 const f=fixture();const entering=f.guard.enter();await tick();f.destroy();await assert.rejects(entering,/destroyed/);
 assert.equal(f.guard.enforced,false);assert.equal(f.win.listenerCount('closed'),0);assert.equal(f.win.listenerCount('enter-full-screen'),0);
});
test('Mac fullscreen restoration can retry after a timeout with guards already released',async()=>{
 const f=fixture({timeout:10}),enter=f.guard.enter();await tick();f.settle(true);await enter;
 await assert.rejects(f.guard.exit(),{code:'OATH_FULLSCREEN_TIMEOUT'});assert.equal(f.guard.enforced,false);assert.equal(f.win.setFullScreen,f.originalFull);
 const retry=f.guard.exit();await tick();f.settle(false);await retry;assert.equal(f.win.listenerCount('closed'),0);
});
test('failed Mac fullscreen re-entry releases the active native guards',async()=>{
 const f=fixture({timeout:10}),enter=f.guard.enter();await tick();f.settle(true);await enter;
 // Simulate an OS exit without its event, then explicitly request return.
 f.win.isFullScreen=()=>false;
 await assert.rejects(f.guard.enter(),{code:'OATH_FULLSCREEN_TIMEOUT'});
 assert.equal(f.guard.enforced,false);assert.equal(f.win.setFullScreen,f.originalFull);assert.equal(f.win.listenerCount('close'),0);
});
test('fullscreen wrapper awaits native guard promises before publishing ownership',async()=>{
 let resolve,changed;const entering=new Promise(r=>resolve=r);
 const win={electronWindow:{setFullScreen(){},setKiosk(){},isKiosk(){}},electron:{remote:{require:()=>({createNativeOathGuard:()=>({enter:()=>entering,exit:()=>Promise.resolve(),onExitRequest(){}})})}},addEventListener(){},removeEventListener(){}};
 const fullscreen=createOathFullscreen(win,'fixture');fullscreen.onChange(value=>changed=value);const work=fullscreen.enter();await tick();assert.equal(changed,undefined);resolve(true);assert.equal(await work,true);assert.equal(changed,true);await fullscreen.exit();assert.equal(changed,false);fullscreen.destroy();
});
test('Windows guard keeps synchronous entry and native exit veto',()=>{
 const win=new EventEmitter();win.webContents=new EventEmitter();let full=false,kiosk=false,requested=0;
 win.setFullScreen=value=>full=value;win.setKiosk=value=>kiosk=value;win.isFullScreen=()=>full;win.isKiosk=()=>kiosk;
 const guard=createNativeOathGuard(win,()=>requested++,{platform:'win32'});assert.equal(guard.enter(),true);assert(full&&kiosk);
 win.setFullScreen(false);assert(full);assert.equal(requested,1);guard.exit();assert(!full&&!kiosk);
});
test('Mac shortcuts use browser URLs and argument arrays without Windows launching',async()=>{
 const calls=[],options={shell:{openExternal:async url=>calls.push(['url',url])},execFile:(file,args,_options,callback)=>{calls.push([file,args]);callback(null)}};
 await openMacShortcut({type:'website',url:'https://example.com/a?b=c'},options);
 await openMacShortcut({type:'application',id:'zotero'},options);
 assert.deepEqual(calls,[['url','https://example.com/a?b=c'],['/usr/bin/open',['-a','Zotero']]]);
 await assert.rejects(openMacShortcut({type:'application',id:'zotero'},{...options,execFile:(_f,_a,_o,callback)=>callback(Error('missing'))}),/Install Zotero/);
});
