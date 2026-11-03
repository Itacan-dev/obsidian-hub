"use strict";
// Main only owns processes/IPC/lifecycle. SQLite runs exclusively in service.cjs.
const {ipcMain,utilityProcess,BrowserWindow,app}=require('electron'),path=require('node:path'),{openTaskService}=require('./electron.cjs');
const workspaces=new Map();let serial=0,quitting=false;
app.on('before-quit',()=>{quitting=true});
function attach(windowId,file,syncOptions=null){
 const window=BrowserWindow.fromId(windowId);if(!window||window.isDestroyed())throw Error('Owning window required');
 file=path.resolve(file);let workspace=workspaces.get(file);
 if(!workspace||workspace.closing){workspace={file,service:null,opening:null,closing:null,previousDrain:workspace?.closing,connections:new Map()};workspaces.set(file,workspace);}
 const channel='itacan-sqlite-'+(++serial),connection={channel,window,closed:false};workspace.connections.set(channel,connection);
 const notify=value=>{for(const c of workspace.connections.values())if(!c.closed&&!c.window.isDestroyed())c.window.webContents.send(c.channel,value)};
 async function service(){
  if(workspace.closing)throw Object.assign(Error('Tasks are closing'),{code:'CLOSED'});
  if(workspace.service&&!workspace.service.client.exited)return workspace.service;
  if(!workspace.opening)workspace.opening=(async()=>{
   await workspace.previousDrain;const s=openTaskService({utilityProcess,file,syncOptions});workspace.service=s;
   s.client.subscribe({},change=>notify({event:'change',change}));
   s.child.once('exit',()=>{if(workspace.service===s){workspace.service=null;notify({event:'service-exited'})}});
   await s.client.ready;return s;
  })().finally(()=>{workspace.opening=null});
  return workspace.opening;
 }
 const methods=new Set(['execute','getTask','listOwners','listTasks','readHistory','readStatistics','getOperation','readOutbox','getCursor','checkpoint','syncStatus','syncConflicts','syncResolve','syncEnroll','syncNow']);
 ipcMain.handle(channel,async(event,message)=>{
  if(event.sender!==window.webContents||connection.closed)return{error:{code:'CLOSED',message:'Task channel unavailable'}};
  try{
   if(!message||typeof message.method!=='string'||!Array.isArray(message.args))throw Error('Invalid request');
   if(message.method==='close'){await release();return{result:true};}
   const s=await service();
   if(message.method==='versions')return{result:s.client.versions};
   if(!methods.has(message.method))throw Error('Unsupported task method');
   return{result:await s.client.call(message.method,...message.args)};
  }catch(error){return{error:{code:error.code??'INVALID_REQUEST',message:error.message}}}
 });
 async function release(){
  if(connection.closed){await workspace.closing;return;}connection.closed=true;workspace.connections.delete(channel);
  if(!workspace.connections.size){
   workspace.closing??=(async()=>{await workspace.previousDrain;await workspace.opening?.catch(()=>{});const s=workspace.service;if(s&&!s.client.exited){const exit=new Promise(r=>s.child.once('exit',r));await s.client.close();const code=await exit;if(code!==0)throw Error('Task utility did not close cleanly');}if(workspaces.get(file)===workspace)workspaces.delete(file);})();
   await workspace.closing;
  }
  window.removeListener('close',onClose);
  // Keep the handler until the in-flight close reply has been sent.
  setTimeout(()=>ipcMain.removeHandler(channel),0);
 }
 let closePending=false;
 function onClose(event){
  // Oath can install its close listener after ours. Its existing native guard
  // is authoritative even before that listener receives this same event.
  if(event.defaultPrevented||window.__hubOathFullscreenGuard?.enforced)return;
  event.preventDefault();if(closePending)return;closePending=true;release().then(()=>{if(!window.isDestroyed()){if(quitting)app.quit();else window.close();}},error=>{closePending=false;console.error('Task shutdown failed; close cancelled',error)});
 }
 window.on('close',onClose);
 window.webContents.once('destroyed',()=>{void release().catch(e=>console.error('Task renderer disposal failed',e))});
 return{channel};
}
module.exports={attach};
