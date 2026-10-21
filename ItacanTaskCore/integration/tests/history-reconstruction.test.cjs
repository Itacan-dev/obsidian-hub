"use strict";
const test=require("node:test"),S=require("./history-support.cjs"),{assert}=S;
const {createCompletionFeed}=require("../completion-feed"),{createHistoryReadPort}=require("../../host/history-read");
test("History reconstructs from immutable receipts after edits and exact replay",async t=>{
 const f=await S.fixture(t),task=await f.create({completed:true}),before=await f.read(),intent=(await f.runtime.getRetained((await f.runtime.retained())[0].operationId)).intent;
 await f.reopen();const p=createHistoryReadPort(S.sessions.at(-1).host,{authorityId:f.config.authorityId,owners:[f.owner]}),feed=createCompletionFeed({native:p,legacy:f.legacy});t.after(()=>{feed.dispose();p.dispose();});
 assert.equal((await f.runtime.replay(intent.operationId)).status,"replayed");const after=await feed.read();assert.deepEqual(after.completions,before.completions);assert.equal(after.records[0].nativeHistory.taskId,task.id);
});
test("legacy changes during capture retry only complete observations; three unstable attempts fail",async t=>{
 const f=await S.fixture(t);await f.create({completed:true});let calls=0,mode="once";
 const native={subscribe:fn=>f.port.subscribe(fn),async read(){const value=await f.port.read();calls++;if(mode==="always"||calls===1)f.legacy.change([{id:"later",kind:"task",text:"Later",timestamp:1}]);return value;}};
 const feed=createCompletionFeed({native,legacy:f.legacy});t.after(()=>feed.dispose());
 const result=await feed.read();assert.equal(calls,2);assert.equal(result.completions.length,2);mode="always";calls=0;await assert.rejects(feed.read(),{code:"SNAPSHOT_UNSTABLE"});assert.equal(calls,3);
});
test("disposal prevents late accepted History and subscriber failures do not poison reads",async t=>{
 const f=await S.fixture(t);await f.create({completed:true});let release,entered;
 const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r),native={subscribe:fn=>f.port.subscribe(fn),async read(){entered();await gate;return f.port.read();}};
 const feed=createCompletionFeed({native,legacy:f.legacy});feed.subscribe(()=>{throw Error("listener");});const pending=feed.read();await ready;feed.dispose();release();await assert.rejects(pending,{code:"CLOSED"});assert.equal((await f.read()).completions.length,1);
});
test("native UUID collision cannot silently shadow typed legacy evidence; diagnostics stay bounded",async t=>{
 const f=await S.fixture(t);await f.create({completed:true,description:"PRIVATE_DESCRIPTION_SENTINEL"});const observation=await f.port.read();
 f.legacy.change([{id:observation.history.events[0].eventId,kind:"task",text:"PRIVATE_RAW_SENTINEL",timestamp:1}]);
 await assert.rejects(f.feed.read(),e=>{assert.equal(e.code,"HISTORY_UNAVAILABLE");assert(!String(e).includes("SENTINEL"));return true;});assert(!JSON.stringify(observation).includes("PRIVATE_DESCRIPTION_SENTINEL"));
});

test("a real commit during another demand still invalidates previously accepted consumers",async t=>{
 const f=await S.fixture(t),task=await f.create();let once=true,calls=0;
 const native={subscribe:fn=>f.port.subscribe(fn),async read(){const r=await f.port.read();if(once){once=false;await f.complete(task.id,true);}return r;}};
 const feed=createCompletionFeed({native,legacy:f.legacy});t.after(()=>feed.dispose());feed.subscribe(()=>calls++);
 const result=await feed.read();assert(calls>0,"actual repository invalidation was delivered during capture");assert.equal(result.completions.length,1);
});

test("read-generated storage bursts retry coherently; repeated demand failures cannot form a refresh loop",async t=>{
 const f=await S.fixture(t);await f.create({completed:true});let notify,mode="storage",reads=0,notifications=0;
 const native={subscribe(fn){notify=fn;return()=>{};},async read(){reads++;if(mode==="failure"){notify({reason:"unavailable",code:"LOCK_LOST"});throw Error("unavailable");}const r=await f.port.read();if(reads===1)notify({reason:"storage",code:"VALIDATED_NATIVE_CAPTURE"});return r;}};
 const feed=createCompletionFeed({native,legacy:f.legacy});t.after(()=>feed.dispose());feed.subscribe(()=>notifications++);
 assert.equal((await feed.read()).completions.length,1);assert.equal(reads,2);assert.equal(notifications,0);
 mode="failure";await assert.rejects(feed.read(),{code:"HISTORY_UNAVAILABLE"});await assert.rejects(feed.read(),{code:"HISTORY_UNAVAILABLE"});assert.equal(notifications,1);
 mode="stable";await feed.read();mode="failure";await assert.rejects(feed.read(),{code:"HISTORY_UNAVAILABLE"});assert.equal(notifications,2);
});
test("actual parent termination during History acceptance preserves receipts, request and exact replay",async t=>{
 const {spawn}=require("node:child_process"),{once}=require("node:events"),f=await S.fixture(t);await f.create({completed:true});const before=await f.read(),retained=await f.runtime.retained(),original=await f.runtime.getRetained(retained[0].operationId);await f.runtime.close();
 const dir=await S.fs.mkdtemp(S.path.join(S.audit,"history-interruption-")),control=S.path.join(dir,"control.json");
 await S.fs.writeFile(control,JSON.stringify({c:{config:f.config,writerPolicy:f.writerPolicy,owner:f.owner,rehearsalId:f.rehearsalId},registry:await f.registry.read()}));
 const args=[...process.execArgv.filter(x=>!x.startsWith("--test")),S.path.join(__dirname,"history-crash-worker.cjs"),control],child=spawn(process.execPath,args,{env:process.env,stdio:["ignore","pipe","pipe","ipc"]}),ended=once(child,"exit");let stdout="",stderr="";child.stdout.on("data",b=>stdout+=b);child.stderr.on("data",b=>stderr+=b);
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill();await ended;});
 const paused=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("No History pause: "+stderr)),15000);child.on("message",m=>{clearTimeout(timer);m.kind==="paused"?resolve(m):reject(Error(JSON.stringify(m)));});});assert.equal(paused.stage,"snapshot:beforeAcceptance");
 const lockPath=S.path.join(f.directory,"WRITER.lock"),raw=await S.fs.readFile(lockPath),lock=JSON.parse(raw);assert.equal(lock.pid,child.pid);assert.equal(lock.host,S.os.hostname());S.V.uuid(lock.token);
 async function files(){const out={};for(const n of await S.fs.readdir(f.directory)){const p=S.path.join(f.directory,n);if((await S.fs.lstat(p)).isFile())out[n]=(await S.fs.readFile(p)).toString("base64");}return out;}
 const beforeFiles=await files();await S.fs.writeFile(S.path.join(dir,"paused.json"),JSON.stringify({command:{executable:process.execPath,args},paused,lock,files:beforeFiles,original},null,2));
 assert(child.kill());const [exitCode,signal]=await ended;assert.throws(()=>process.kill(lock.pid,0));assert.deepEqual(await S.fs.readFile(lockPath),raw);assert.deepEqual(await files(),beforeFiles);
 await S.fs.writeFile(S.path.join(dir,"death-before-lock-movement.json"),JSON.stringify({exitCode,signal,deathProven:true,lockBytes:raw.toString("base64"),lockSha256:S.crypto.createHash("sha256").update(raw).digest("hex"),stdout,stderr},null,2));
 const root=await S.fs.realpath(f.directory),rel=S.path.relative(await S.fs.realpath(S.os.tmpdir()),root);assert(rel&&!rel.startsWith("..")&&!S.path.isAbsolute(rel));await S.fs.rename(lockPath,S.path.join(root,".dead-history-reader-"+lock.token));
 await f.reopen();const port=createHistoryReadPort(S.sessions.at(-1).host,{authorityId:f.config.authorityId,owners:[f.owner]}),feed=createCompletionFeed({native:port,legacy:f.legacy});t.after(()=>{feed.dispose();port.dispose();});
 assert.equal((await f.runtime.reconcile(original.operationId)).state,"committed");assert.equal((await f.runtime.replay(original.operationId)).status,"replayed");assert.deepEqual(await f.runtime.getRetained(original.operationId),original);assert.deepEqual((await feed.read()).completions,before.completions);
});
