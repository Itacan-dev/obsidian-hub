"use strict";
const S=require("./support.cjs");
(async()=>{const control=JSON.parse(await S.fs.readFile(process.argv[2],"utf8")),stage=process.argv[3],store=S.api.createTransactionalApplicationStore(control.config);let armed=false,published=false;
const pause=async name=>{if(name!==stage)return;const keepAlive=setInterval(()=>{},1000);process.send({kind:"paused",stage:name,pid:process.pid,host:S.os.hostname()});await new Promise(()=>{});clearInterval(keepAlive);};
if(stage==="contend"){try{await store.open({version:1});process.send({kind:"contention",code:"UNEXPECTED_OPEN"});await store.close();}catch(error){process.send({kind:"contention",code:error.code});}process.disconnect();return;}
await store.open({version:1});
let request=control.request;
if(!request){const r=await store.readScopes({version:1,authorityId:control.config.authorityId,applicationContextId:control.config.applicationContextId,fields:["workspaceMode","folderUi","inboxSort"]});request=S.request({cfg:control.config},r);}
process.send({kind:"request",request,pid:process.pid});
if(stage==="before-publication")await pause(stage);
const originalOpen=S.fs.open,originalRename=S.fs.rename,originalRead=S.fs.readFile;
S.fs.open=async function(file,...rest){const h=await originalOpen(file,...rest);if(armed&&String(file).includes(".application.")){await pause("after-temp-creation");const sync=h.sync.bind(h);h.sync=async()=>{await sync();await pause("after-flush");};}return h;};
S.fs.rename=async function(from,to){if(armed&&String(from).includes(".application.")){await pause("before-replacement");const v=await originalRename(from,to);published=true;await pause("after-replacement");return v;}return originalRename(from,to);};
S.fs.readFile=async function(file,...args){if(armed&&S.path.basename(String(file))==="data.json"){if(published)await pause("before-acknowledgement");if(stage==="during-reconciliation")await pause(stage);}return originalRead(file,...args);};
armed=true;const out=stage==="during-reconciliation"?await store.reconcile(request):await store.transact(request);process.send({kind:"outcome",out});await store.close();process.disconnect();})().catch(error=>{process.send?.({kind:"error",code:error.code,message:error.message});process.exitCode=1;process.disconnect?.();});
