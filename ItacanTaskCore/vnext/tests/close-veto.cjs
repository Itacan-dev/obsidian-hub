"use strict";
// Main-process fixture: exercise Oath's existing late close-veto contract
// without entering kiosk/fullscreen or creating a restrictive commitment.
const assert=require('node:assert/strict'),path=require('node:path'),{app,BrowserWindow}=require('electron');
exports.check=async windowId=>{
 const evidence=path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep;
 assert(path.resolve(app.getPath('userData')).startsWith(evidence),'Synthetic profile required');
 const window=BrowserWindow.fromId(windowId),key='__hubOathFullscreenGuard',previous=window[key];
 assert(!previous?.enforced);const pid=app.getAppMetrics().find(m=>m.type==='Utility'&&m.name==='Itacan local tasks')?.pid;assert(pid);
 let vetoed=false;const veto=event=>{event.preventDefault();vetoed=true};
 window[key]={enforced:true};window.on('close',veto);
 try{window.close();await new Promise(r=>setTimeout(r,100));assert(vetoed);assert(!window.isDestroyed());assert(app.getAppMetrics().some(m=>m.pid===pid));return{pass:true,utilityPid:pid};}
 finally{window.removeListener('close',veto);if(previous===undefined)delete window[key];else window[key]=previous;}
};
