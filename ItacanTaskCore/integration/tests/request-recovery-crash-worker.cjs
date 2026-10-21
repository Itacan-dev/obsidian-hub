"use strict";
const S=require("./support.cjs"),{NodeDirectory}=require("../../src/node-directory");
(async()=>{
 const control=JSON.parse(await S.fs.readFile(process.argv[2],"utf8")),stage=process.argv[3],c=control.c;c.registry={read:async()=>control.registry,subscribe:()=>()=>{}};
 const runtime=await S.openProjectRuntime(c.config,{...c,creating:false}),review=await runtime.recovery.inspect(control.operationId);if(!review.canReplay)throw Error("Recovery not admissible: "+review.replayCode);
 process.send({kind:"review",review,record:await runtime.getRetained(control.operationId)});
 const replace=NodeDirectory.prototype.replace;NodeDirectory.prototype.replace=async function(from,to){const pause=async point=>{if(to!=="CURRENT.json"||point!==stage)return;process.send({kind:"paused",stage,pid:process.pid,host:S.os.hostname()});setInterval(()=>{},1000);await new Promise(()=>{});};await pause("before-publication");const out=await replace.call(this,from,to);await pause("after-publication");return out;};
 const result=await runtime.recovery.replay(review);process.send({kind:"result",result});await runtime.close();process.disconnect();
})().catch(e=>{process.send?.({kind:"error",code:e.code,message:e.message});process.exitCode=1;process.disconnect?.();});
