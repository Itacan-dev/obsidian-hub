"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), { EventEmitter } = require("node:events");
const { centeredBounds } = require("../../services/oath-reminder-placement.cjs");
const { createReminder } = require("../../services/oath-reminder");
const { StrictOathCoordinator } = require("../../services/oath-strict");
const displays = [ {id:1,bounds:{x:0,y:0,width:1920,height:1080},workArea:{x:0,y:0,width:1920,height:1040}}, {id:2,bounds:{x:-1200,y:0,width:1200,height:900},workArea:{x:-1200,y:0,width:1200,height:860}} ];
const screen = () => Object.assign(new EventEmitter(), { getAllDisplays:()=>displays, getPrimaryDisplay:()=>displays[0], getDisplayMatching:r=>r.x<0?displays[1]:displays[0], screenToDipRect:(_win,r)=>r });
test("centering selects foreground display, rejects invalid/offscreen geometry, and retains display for self", () => {
    const s=screen(), host={x:10,y:10,width:900,height:700};
    assert.deepEqual(centeredBounds(s,{bounds:{x:-1000,y:20,width:500,height:400}},host).bounds,{x:-790,y:315,width:380,height:230});
    for (const bounds of [null,{x:NaN,y:0,width:10,height:10},{x:9000,y:0,width:50,height:50},{x:0,y:0,width:0,height:50}]) assert.equal(centeredBounds(s,{bounds},host).displayId,1);
    assert.equal(centeredBounds(s,null,host,2).displayId,2);
});
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
test("integrated reminder follows foreground persistence without focus, hides on permission and disposes on failure", async () => {
    let tick=0, id=0, sample=null, fail=false, focus=0, stopped=false;
    const windows=[], handlers=new Map(), desktop={screen:screen(),powerMonitor:new EventEmitter(),ipcMain:{handle:(c,fn)=>handlers.set(c,fn),removeHandler:c=>handlers.delete(c)}};
    class Window extends EventEmitter {
        constructor(options){super(); this.options=options; this.id=++id; this.dead=false; this.visible=false; this.bounds={x:0,y:0,width:380,height:230}; windows.push(this);
            this.webContents=Object.assign(new EventEmitter(),{mainFrame:{},send(){},setWindowOpenHandler(){},session:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}});}
        getNativeWindowHandle(){const b=Buffer.alloc(8); b.writeBigUInt64LE(BigInt(this.id)); return b;}
        isDestroyed(){return this.dead;} getBounds(){return this.bounds;} setBounds(v){this.bounds=v;}
        hide(){this.visible=false;} showInactive(){this.visible=true;} async loadFile(){} destroy(){this.dead=true;}
    }
    desktop.BrowserWindow=Window;
    const win=new Window({}), coordinator={current:{id:"a"},health:{warnings:[]},host:{identity:{},focus:()=>focus++},update(v){this.health=v;},developmentRecovery:{registerWindow:()=>()=>{},ownsForeground:()=>false}};
    const adapter={start(){},stop(){stopped=true;},async request(action){if(fail)throw Error("failed"); return action==="capabilities"?{observation:true}:{foreground:sample};}};
    const session=await createReminder({win,coordinator,policy:{applications:["c:\\allowed.exe"]},desktop,adapter,now:()=>tick});
    const reminder=windows[1]; assert.equal(reminder.options.movable,false); assert.equal(reminder.options.webPreferences.sandbox,true);
    const foreground=executable=>({pid:999,handle:9,identity:"observed",executable,bounds:{x:-1000,y:0,width:500,height:500}});
    try {
        sample=foreground("c:\\other.exe"); session.start(); await delay(10); assert(!reminder.visible);
        for(tick=250;tick<=3250;tick+=250) await delay(260);
        assert(reminder.visible); assert.equal(reminder.bounds.x,-790); assert.equal(focus,0);
        sample={pid:process.pid,handle:reminder.id}; await delay(270); assert(reminder.visible);
        sample=foreground("c:\\allowed.exe"); await delay(270); assert(!reminder.visible);
        fail=true; await delay(270); assert(reminder.dead); assert(stopped); assert(coordinator.reminderUnavailable); assert.equal(focus,0);
    } finally {session.dispose();}
    assert.equal(handlers.size,0); assert.equal(desktop.screen.listenerCount("display-removed"),0);
});
test("version 4 prepares hidden, starts only on commit, never inventory-nudges, and disposes on fulfillment/release", async () => {
    let starts=0, disposed=0, focus=0;
    const c=new StrictOathCoordinator({enabled:true,createReminder:async()=>({start(){starts++;},dispose(){disposed++;}}),host:{identity:{},async enter(){},async release(){},focus(){focus++;}},observer:{async listWindows(){return [];}}});
    const oath={id:"a",policy:{mode:"strict",applicationCheckMode:"manual-review",confirmationVersion:4,applications:[]}};
    await c.prepare(oath); assert.equal(starts,0); c.commit("a"); assert.equal(starts,1);
    await c.poll(); assert.equal(focus,0); c.fulfill("a"); assert.equal(disposed,1); await c.release("a"); assert.equal(disposed,1);
});
test("release during asynchronous reminder preparation never enters fullscreen afterward", async () => {
    let ready, entered=0, disposed=0;
    const c=new StrictOathCoordinator({enabled:true,createReminder:()=>new Promise(resolve=>{ready=resolve;}),host:{identity:{},async enter(){entered++;},async release(){}},observer:{async listWindows(){return [];}}});
    const preparing=c.prepare({id:"a",policy:{mode:"strict",applicationCheckMode:"automatic",confirmationVersion:4,applications:[]}});
    while(!ready) await Promise.resolve();
    await c.release(); ready({start(){throw Error("must not start");},dispose(){disposed++;}});
    await assert.rejects(preparing,/released/); assert.equal(entered,0); assert.equal(disposed,1); assert.equal(c.reminder,null);
});
