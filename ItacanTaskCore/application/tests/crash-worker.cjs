"use strict";
const S=require("./support.cjs"),fs=require("node:fs/promises");
(async()=>{const [inputFile,signalFile]=process.argv.slice(2),input=JSON.parse(await fs.readFile(inputFile,"utf8"));let armed=false;
async function pause(stage){if(!armed||stage!==input.stage)return;const lock=await fs.readFile(S.path.join(input.directory,"WRITER.lock"),"utf8");await fs.writeFile(signalFile,JSON.stringify({stage,pid:process.pid,host:S.os.hostname(),lock}));setInterval(()=>{},1000);await new Promise(()=>{});}
const f=await S.fixture(null,{unopened:true,directory:input.directory,authorityId:input.authorityId,policy:input.policy,repositoryOptions:{fault:pause},...(input.stage==="before-coherent-return"?{readHost:h=>({...h,read:async(...args)=>{const r=await h.read(...args);await pause("before-coherent-return");return r;}})}:{})});
await f.host.open({version:1,expectedAuthorityId:input.authorityId,syntheticOnly:true});await f.reconnect();armed=true;const r=await f.app.mutate(input.intent);process.stdout.write(JSON.stringify(r));await f.session.dispose();})().catch(e=>{process.stderr.write(e.stack);process.exitCode=1;});
