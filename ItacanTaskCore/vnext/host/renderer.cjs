"use strict";
const {TaskClient}=require('../client.cjs');
const failure=(code,message)=>Object.assign(Error(message),{code});
function unavailable(error) {
 const client=new TaskClient({send(){},onMessage(){},onExit(){}});
 client.ready.catch(()=>{});client.rejectReady(error);client.close=()=>Promise.resolve();return client;
}
function connect({remote,ipcRenderer,mainEntry,file,syncOptions=null,onState=()=>{},onDiagnostic=()=>{}}){
 let state='opening',channel,receive,attached=false,ready=false,closing;
 const setState=value=>{if(value!==state){state=value;onState(value)}};
 const report=diagnostic=>onDiagnostic(diagnostic);
 const listener=(_event,message)=>{
  if(message.event==='diagnostic'){report(message.diagnostic);return;}
  if(message.event==='service-exited')setState('reconnecting');receive(message);
 };
 const dispose=()=>{if(attached){ipcRenderer.removeListener(channel,listener);attached=false;}};
 const client=new TaskClient({send:message=>{ipcRenderer.invoke(channel,{method:message.method,args:message.args}).then(reply=>receive({...reply,requestId:message.requestId}),e=>receive({requestId:message.requestId,error:{code:'SERVICE_EXITED',message:e.message}}))},onMessage:fn=>{receive=fn;},onExit:()=>{}});
 // Return an unavailable client when attachment fails, allowing the rest of
 // the plugin to initialize without inventing a second task backend.
 try {
  if(typeof remote?.require!=='function'||typeof remote?.getCurrentWindow!=='function')throw failure('TASK_BRIDGE_UNAVAILABLE','Obsidian does not expose the required main-process bridge.');
  if(!['invoke','on','removeListener'].every(key=>typeof ipcRenderer?.[key]==='function'))throw failure('TASK_IPC_UNAVAILABLE','Obsidian does not expose the required task IPC methods.');
  const window=remote.getCurrentWindow();
  if(!Number.isInteger(window?.id))throw failure('TASK_WINDOW_UNAVAILABLE','The owning Obsidian window is unavailable.');
  const main=remote.require(mainEntry);
  if(typeof main?.attach!=='function')throw failure('TASK_HOST_UNAVAILABLE','The packaged task main-process entry is missing or incompatible.');
  const binding=main.attach(window.id,file,syncOptions);channel=binding.channel;
  if(typeof channel!=='string'||!channel)throw failure('TASK_HOST_UNAVAILABLE','The task host returned no IPC channel.');
  ipcRenderer.on(channel,listener);attached=true;
  report({stage:'utility-starting',mainVersions:binding.versions});
  ipcRenderer.invoke(channel,{method:'versions',args:[]}).then(reply=>{
   if(reply.error)throw Object.assign(Error(reply.error.message),reply.error);
   ready=true;receive({event:'ready',versions:reply.result});setState('ready');report({stage:'ready',versions:reply.result});
  }).catch(fail);
 } catch(error) { fail(error); }
 function fail(error){
  report({stage:'failed',error:{code:error.code??'TASK_HOST_UNAVAILABLE',message:error.message}});
  client.rejectReady(error);setState('unavailable');
  if(attached)void ipcRenderer.invoke(channel,{method:'close',args:[]}).catch(()=>{}).finally(dispose);
 }
 client.ready.catch(()=>{});
 const rawCall=client.call.bind(client);
 client.call=async(method,...args)=>{try{const result=await rawCall(method,...args);if(method!=='close')setState('ready');return result}catch(error){if(!['SERVICE_EXITED','OUTCOME_UNKNOWN'].includes(error.code)||method==='close')throw error;setState('reconnecting');const r=await rawCall(method,...args);setState('ready');return r;}};
 const close=client.close.bind(client);
 client.close=()=>closing??=(ready?close():channel?ipcRenderer.invoke(channel,{method:'close',args:[]}).then(()=>{}):Promise.resolve()).finally(dispose);
 return client;
}
module.exports={connect,unavailable};
