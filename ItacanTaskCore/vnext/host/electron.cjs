"use strict";
const path=require('node:path'),{TaskClient}=require('../client.cjs');
function openTaskService({utilityProcess,file,onDiagnostic=()=>{},entry=path.join(__dirname,'../service.cjs'),testBoundary=null}){
 const child=utilityProcess.fork(entry,[],{serviceName:'Itacan local tasks',stdio:'pipe',env:{...process.env,ITACAN_VNEXT_DB:path.resolve(file),...(testBoundary?{ITACAN_VNEXT_TEST_BOUNDARY:testBoundary}:{})}});
 child.stderr?.on('data',b=>onDiagnostic({kind:'service-stderr',text:b.toString().slice(0,1000)}));
 const client=new TaskClient({send:m=>child.postMessage(m),onMessage:fn=>child.on('message',fn),onExit:fn=>child.on('exit',fn)});
 const startup=setTimeout(()=>{client.rejectReady(Object.assign(Error('Task utility startup timed out'),{code:'SERVICE_START_TIMEOUT'}));child.kill();},10000);
 client.ready.then(()=>clearTimeout(startup),()=>clearTimeout(startup));
 return{client,child};
}
module.exports={openTaskService};
