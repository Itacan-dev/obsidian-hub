"use strict";
const S=require("./history-support.cjs");
(async()=>{
 const control=JSON.parse(await S.fs.readFile(process.argv[2],"utf8")), c=control.c;
 c.registry={read:async()=>control.registry,subscribe:()=>()=>{}};
 let armed=false;
 const runtime=await S.openProjectRuntime(c.config,{...c,creating:false,historyUiV1:true,repositoryOptions:{async fault(stage){if(armed&&stage==="snapshot:beforeAcceptance"){process.send({kind:"paused",stage,pid:process.pid,host:S.os.hostname()});setInterval(()=>{},1000);await new Promise(()=>{});}}}});
 const port=require("../../host/history-read").createHistoryReadPort(S.sessions.at(-1).host,{authorityId:c.config.authorityId,owners:[c.owner]});
 armed=true;await port.read();throw Error("Read unexpectedly accepted");
})().catch(e=>{process.send?.({kind:"error",code:e.code,message:e.message});process.exitCode=1;process.disconnect?.();});
