"use strict";
const {TaskClient}=require('../client.cjs');
function connect({remote,ipcRenderer,mainEntry,file,syncOptions=null,onState=()=>{}}){
 let state='opening';const setState=value=>{if(value!==state){state=value;onState(value)}};
 const {channel}=remote.require(mainEntry).attach(remote.getCurrentWindow().id,file,syncOptions);let receive;
 const listener=(_event,message)=>{if(message.event==='service-exited')setState('reconnecting');receive(message)};
 const client=new TaskClient({send:message=>{ipcRenderer.invoke(channel,{method:message.method,args:message.args}).then(reply=>receive({...reply,requestId:message.requestId}),e=>receive({requestId:message.requestId,error:{code:'SERVICE_EXITED',message:e.message}}))},onMessage:fn=>{receive=fn;ipcRenderer.on(channel,listener)},onExit:()=>{}});
 ipcRenderer.invoke(channel,{method:'versions',args:[]}).then(reply=>{if(reply.error)throw Object.assign(Error(reply.error.message),reply.error);receive({event:'ready',versions:reply.result});setState('ready')}).catch(error=>{client.rejectReady(error);setState('unavailable')});
 const rawCall=client.call.bind(client);
 client.call=async(method,...args)=>{try{const result=await rawCall(method,...args);if(method!=='close')setState('ready');return result}catch(error){if(!['SERVICE_EXITED','OUTCOME_UNKNOWN'].includes(error.code)||method==='close')throw error;setState('reconnecting');const r=await rawCall(method,...args);setState('ready');return r;}};
 const close=client.close.bind(client);client.close=()=>close().finally(()=>ipcRenderer.removeListener(channel,listener));
 return client;
}
module.exports={connect};
