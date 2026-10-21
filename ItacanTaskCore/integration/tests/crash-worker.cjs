"use strict";
const S=require("./support.cjs"),{NodeDirectory}=require("../../src/node-directory");
(async()=>{
 const control=JSON.parse(await S.fs.readFile(process.argv[2],"utf8")),stage=process.argv[3], c=control.c;
 c.registry={read:async()=>control.registry,subscribe:()=>()=>{}};
 const pause=async name=>{if(name!==stage)return;setInterval(()=>{},1000);process.send({kind:"paused",stage:name,pid:process.pid,host:S.os.hostname()});await new Promise(()=>{});};
 const write=NodeDirectory.prototype.writeNew, replace=NodeDirectory.prototype.replace;
 NodeDirectory.prototype.writeNew=function(name,data,hook){return write.call(this,name,data,async point=>{await hook?.(point);if(name.startsWith("REQUEST-v1-")&&point==="duringTemporaryWrite")await pause("during-retention");});};
 NodeDirectory.prototype.replace=async function(from,to){if(to==="CURRENT.json")await pause("before-publication");const out=await replace.call(this,from,to);if(to==="CURRENT.json")await pause("after-publication");return out;};
 const runtime=await S.openProjectRuntime(c.config,{...c,creating:false});
 const i=S.B.create(await runtime.creationContext(),{text:"Interrupted native task",steps:[{text:"Step",completed:false}]});i.action.draft.id=S.crypto.randomUUID();process.send({kind:"request",intent:i});
 if(stage==="after-retention"){const session=S.sessions.at(-1),cap=await session.authorize({version:1,owners:c.writerPolicy.owners,commands:c.writerPolicy.commands});await session.requests.prepare(cap,i);await pause(stage);}
 const out=await runtime.mutate(i);if(["committed","replayed"].includes(out.status))await pause("before-memory-refresh");
 process.send({kind:"outcome",out});await runtime.close();process.disconnect();
})().catch(e=>{process.send?.({kind:"error",code:e.code,message:e.message});process.exitCode=1;process.disconnect?.();});
