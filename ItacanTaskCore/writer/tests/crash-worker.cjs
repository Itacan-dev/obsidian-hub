"use strict";
const S=require("./support.cjs");
(async()=>{const [inputFile,signalFile]=process.argv.slice(2),input=JSON.parse(await S.fs.readFile(inputFile,"utf8"));let armed=false;
 async function pause(stage){if(!armed||stage!==input.stage)return;const raw=await S.fs.readFile(S.path.join(input.directory,"WRITER.lock"),"utf8").catch(()=>null);await S.fs.writeFile(signalFile,JSON.stringify({stage,pid:process.pid,host:S.os.hostname(),lock:raw}));setInterval(()=>{},1000);await new Promise(()=>{});}
 if(input.mode==="close"){const proto=require("../../src/node-directory").NodeDirectory.prototype,original=proto.release;proto.release=async function(){await pause("before-release");const r=await original.call(this);await pause("after-release");return r;};}
 const f=await S.fixture(null,{unopened:true,directory:input.directory,authorityId:input.authorityId,policy:input.policy,repositoryOptions:{fault:pause}});await f.host.open({version:1,expectedAuthorityId:input.authorityId,syntheticOnly:true});f.cap=await f.authorize();armed=true;
 if(input.mode==="close")await f.session.close();else{const r=await f.submit(input.request);process.stdout.write(JSON.stringify(r));}await f.session.dispose();
})().catch(e=>{process.stderr.write(String(e.stack));process.exitCode=1;});
