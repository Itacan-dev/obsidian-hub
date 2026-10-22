"use strict";
const S=require("./production-admission-support.cjs"),{openProjectRuntime}=require("../project-runtime"),B=require("../../product-ui/bridge.cjs");
(async()=>{const f=await S.fixture({after(){}},9);let armed=false;
 const r=await openProjectRuntime(f.config,{...f.options,creating:true,repositoryOptions:{fault:async stage=>{if(armed&&stage==="beforeAcknowledgement"){
  const lock=await S.fs.readFile(S.path.join(f.config.directory,"WRITER.lock"),"utf8");process.stdout.write(JSON.stringify({pid:process.pid,host:S.os.hostname(),root:f.root,base:f.base,config:f.config,options:{...f.options,registry:undefined},registry:await f.registry.read(),roaming:f.roaming,lock,operationId:intent.operationId,taskId:intent.action.draft.id})+"\n");await new Promise(()=>setInterval(()=>{},1000));
 }}}});
 const intent=B.create(await r.creationContext(),{text:"Disposable interrupted non-Temp",steps:[],completed:false});intent.action.draft.id=S.crypto.randomUUID();armed=true;await r.mutate(intent);
})().catch(e=>{console.error(e);process.exitCode=1});
