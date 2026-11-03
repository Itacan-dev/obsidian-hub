"use strict";
const path=require('node:path'),{TaskClient}=require('../client.cjs');
function openTaskService({utilityProcess,file,onDiagnostic=()=>{},entry=path.join(__dirname,'../service.cjs'),testBoundary=null,syncOptions=null,startupTimeout=10000}){
 if(typeof utilityProcess?.fork!=='function')throw Object.assign(Error('This Obsidian runtime does not expose Electron utilityProcess.fork.'),{code:'TASK_UTILITY_UNAVAILABLE'});
 let child;
 try{child=utilityProcess.fork(entry,[],{serviceName:'Itacan local tasks',stdio:'pipe',env:{...process.env,ITACAN_VNEXT_DB:path.resolve(file),...(syncOptions?{ITACAN_TASKSYNC_OPTIONS:JSON.stringify(syncOptions)}:{}),...(testBoundary?{ITACAN_VNEXT_TEST_BOUNDARY:testBoundary}:{})}});}
 catch(error){throw Object.assign(Error('Task utility could not launch: '+error.message),{code:'TASK_UTILITY_LAUNCH_FAILED'});}
 let stderr='',startupFailed=false,settled=false;
 const report=value=>{try{onDiagnostic(value)}catch{}};
 const kill=()=>{try{child.kill()}catch{}};
 const client=new TaskClient({send:m=>child.postMessage(m),onMessage:fn=>child.on('message',message=>{
  if(message.event==='diagnostic'){report(message.diagnostic);return;}
  if(message.event==='startup-error'){
   startupFailed=true;report({stage:'failed',versions:message.versions,error:message.error});
   client.rejectReady(Object.assign(Error(message.error.message),{code:message.error.code}));kill();return;
  }
  fn(message);
 }),onExit:fn=>child.on('exit',code=>{
  report({stage:startupFailed||!settled?'failed':'exited',exitCode:code,...(!settled&&!startupFailed?{error:{code:'SERVICE_EXITED',message:'Task utility exited before readiness (code '+code+').'+(stderr?' '+stderr:'')}}:{})});
  if(!settled&&!startupFailed)client.rejectReady(Object.assign(Error('Task utility exited before readiness (code '+code+').'+(stderr?' '+stderr:'')),{code:'SERVICE_EXITED'}));
  fn();
 })});
 child.stderr?.on('data',b=>{stderr=(stderr+b.toString()).slice(-2000);report({stage:'utility-stderr',stderr});});
 const startup=setTimeout(()=>{startupFailed=true;const error={code:'SERVICE_START_TIMEOUT',message:'Task utility did not become ready within '+startupTimeout+' ms.'};report({stage:'failed',error,stderr});client.rejectReady(Object.assign(Error(error.message),{code:error.code}));kill();},startupTimeout);
 client.ready.then(()=>{settled=true;clearTimeout(startup);report({stage:'ready',versions:client.versions});},()=>{clearTimeout(startup);});
 return{client,child};
}
module.exports={openTaskService};
