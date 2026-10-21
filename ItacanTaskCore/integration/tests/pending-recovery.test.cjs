"use strict";
const { test } = require("node:test"), S = require("./support.cjs"), { assert } = S;
const A = require("../../writer/admission"), I = require("../../application/intents");
async function cap(f) { return f.session.authorize({ version: 1, owners: f.writerPolicy.owners, commands: f.writerPolicy.commands }); }
async function retained(f) { const i = await f.intent(), c = await cap(f); return { i, c, r: await f.session.requests.prepare(c, i) }; }
test("immutable retention precedes dispatch, exact duplicates coalesce and changed evidence conflicts", async t => {
 const f = await S.fixture(t), i = await f.intent(), c = await cap(f); const [a,b] = await Promise.all([f.session.requests.prepare(c,i),f.session.requests.prepare(c,i)]); assert.deepEqual(a,b);
 const names = await S.fs.readdir(f.directory); assert.equal(names.filter(n=>n.startsWith("REQUEST-v1-")).length,1); assert.equal((await f.runtime.list()).tasks.length,0);
 const changed = S.V.clone(i); changed.reason += " changed"; await assert.rejects(f.session.requests.prepare(c,changed),{code:"OPERATION_CONFLICT"});
 assert.equal((await f.runtime.mutate(i)).status,"committed"); const again=await f.runtime.mutate(i); assert.equal(again.status,"replayed"); assert.equal((await f.runtime.list()).tasks.length,1);
});
test("unretained request and retained repository handle cannot bypass admission", async t => {
 const f=await S.fixture(t),i=await f.intent(),compiled=I.compile(i),c=await cap(f);
 const out=await f.session.writer.task(c,compiled.request);assert.equal(out.status,"rejected");assert.equal(out.code,"WRITER_ADMISSION_REQUIRED");
 await assert.rejects(f.repository.execute(A.compile(compiled.request)));await assert.rejects(f.repository.execute(A.compile(compiled.request),{}));assert.equal((await f.runtime.list()).tasks.length,0);
 await f.session.requests.prepare(c,i);assert.equal((await f.runtime.mutate(i)).status,"committed");
});
test("restart missing receipt is unknown and cannot execute or permit another request", async t => {
 const f=await S.fixture(t),{i}=await retained(f);await f.reopen();const out=await f.runtime.reconcile(i.operationId);assert.equal(out.state,"missing");assert.equal(out.receipt,null);
 assert.equal((await f.runtime.replay(i.operationId)).status,"uncertain");await assert.rejects(f.runtime.mutate(await f.intent({text:"Replacement"})));assert.equal((await f.runtime.list()).tasks.length,0);
});
test("committed receipt survives later deletion and reconstruction; projection leaks no draft", async t => {
 const f=await S.fixture(t),i=await f.intent({text:"PRIVATE_SENTINEL"}),out=await f.runtime.mutate(i),e=await f.runtime.editor(out.taskIds[0]);
 await f.runtime.mutate(S.B.remove(e));await f.reopen();const read=await f.runtime.reconcile(i.operationId);assert.equal(read.state,"committed");assert.deepEqual(read.taskIds,out.taskIds);assert(!JSON.stringify(read).includes("PRIVATE_SENTINEL"));assert.equal((await f.runtime.list()).tasks.length,0);
 assert.equal((await f.runtime.replay(i.operationId)).status,"replayed");assert.equal((await f.runtime.list()).tasks.length,0);
});
for(const kind of ["truncated","checksum","intent","wrong-marker","unknown-file"])test("corrupt/unknown retained evidence blocks: "+kind,async t=>{
 const f=await S.fixture(t),{r}=await retained(f);await f.runtime.close();const marker=S.path.join(f.directory,"REQUEST-RETENTION-v1.json"),file=S.path.join(f.directory,"REQUEST-v1-"+S.P.hash(r.operationId)+".json");
 if(kind==="truncated")await S.fs.writeFile(file,"{");else if(kind==="unknown-file")await S.fs.writeFile(S.path.join(f.directory,"REQUEST-v9-future.json"),"{}");else{const target=kind==="wrong-marker"?marker:file,data=JSON.parse(await S.fs.readFile(target,"utf8"));if(kind==="checksum")data.checksum="0".repeat(64);if(kind==="intent")data.intent.action.draft.metadata.title="tampered";if(kind==="wrong-marker")data.rehearsalId=S.crypto.randomUUID();await S.fs.writeFile(target,JSON.stringify(data));}
 await assert.rejects(f.reopen());
});
test("ordinary writer host refuses a retained root without support",async t=>{
 const f=await S.fixture(t);await f.runtime.close();const session=S.W.createNativeWriterSession(f.config,{registry:f.registry,writerPolicy:f.writerPolicy});t.after(()=>session.dispose());await assert.rejects(session.host.open({version:1,expectedAuthorityId:f.config.authorityId,syntheticOnly:true}),{code:"REQUEST_RETENTION_REQUIRED"});
});
test("operation lookup is digest- and owner-qualified; malformed fields reject",async t=>{
 const f=await S.fixture(t),i=await f.intent();await f.runtime.mutate(i);const r=await f.runtime.getRetained(i.operationId);
 const q={version:3,authorityId:f.config.authorityId,owners:[f.owner],selection:"operation",operationId:i.operationId,commandDigest:"0".repeat(64),ownerContextPin:r.writerRequest.scope.ownerContextPin,identityPin:r.writerRequest.scope.identityPin};
 assert.equal((await f.session.host.readOperation(q)).snapshot.operation.state,"conflict");await assert.rejects(f.session.host.readOperation({...q,extra:true}));await assert.rejects(f.session.host.readOperation({...q,authorityId:S.crypto.randomUUID()}),{code:"HOST_CONTRACT"});
});

const {spawn}=require("node:child_process"),{once}=require("node:events");
function child(control,stage){const args=[...process.execArgv.filter(x=>!x.startsWith("--test")),S.path.join(__dirname,"crash-worker.cjs"),control,stage],p=spawn(process.execPath,args,{env:process.env,stdio:["ignore","pipe","pipe","ipc"]}),ended=once(p,"exit"),messages=[],waiters=[];let stdout="",stderr="";p.stdout.on("data",x=>stdout+=x);p.stderr.on("data",x=>stderr+=x);p.on("message",m=>{messages.push(m);waiters.forEach(fn=>fn(m));});return{p,args,ended,messages,output:()=>({stdout,stderr}),wait(kind){const old=messages.find(x=>x.kind===kind);if(old)return Promise.resolve(old);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{p.kill();reject(Error("Missing "+kind+stderr));},15000);waiters.push(m=>{if(m.kind==="error"){clearTimeout(timer);reject(Error(JSON.stringify(m)));}if(m.kind===kind){clearTimeout(timer);resolve(m);}});});}};}
async function rawFiles(directory){const files={};for(const n of await S.fs.readdir(directory)){const p=S.path.join(directory,n);if((await S.fs.lstat(p)).isFile()){const raw=await S.fs.readFile(p);files[n]={bytes:raw.toString("base64"),sha256:S.crypto.createHash("sha256").update(raw).digest("hex")};}}return files;}
for(const stage of ["during-retention","after-retention","before-publication","after-publication","before-memory-refresh"])test("actual parent termination: "+stage,async t=>{
 const f=await S.fixture(t);await f.runtime.close();const dir=await S.fs.mkdtemp(S.path.join(S.audit,"interruption-")),control=S.path.join(dir,"control.json");const c={config:f.config,writerPolicy:f.writerPolicy,owner:f.owner,rehearsalId:f.rehearsalId};await S.fs.writeFile(control,JSON.stringify({c,registry:await f.registry.read()}));
 const childRun=child(control,stage);t.after(async()=>{if(childRun.p.exitCode===null&&childRun.p.signalCode===null)childRun.p.kill();await childRun.ended;});
 const intent=(await childRun.wait("request")).intent,paused=await childRun.wait("paused");assert.equal(paused.stage,stage);const lockPath=S.path.join(f.directory,"WRITER.lock"),raw=await S.fs.readFile(lockPath),lock=JSON.parse(raw);assert.equal(lock.pid,childRun.p.pid);assert.equal(lock.host,S.os.hostname());S.V.uuid(lock.token);const before=await rawFiles(f.directory);
 await S.fs.writeFile(S.path.join(dir,"paused.json"),JSON.stringify({command:{executable:process.execPath,args:childRun.args},stage,pid:lock.pid,host:lock.host,token:lock.token,intent,files:before},null,2));assert(childRun.p.kill());const[exitCode,signal]=await childRun.ended;assert.throws(()=>process.kill(lock.pid,0));assert.deepEqual(await S.fs.readFile(lockPath),raw);
 await S.fs.writeFile(S.path.join(dir,"death-before-lock-movement.json"),JSON.stringify({exitCode,signal,deathProven:true,lockBytes:raw.toString("base64"),lockSha256:S.crypto.createHash("sha256").update(raw).digest("hex"),files:await rawFiles(f.directory),...childRun.output()},null,2));
 const temp=await S.fs.realpath(S.os.tmpdir()),root=await S.fs.realpath(f.directory),rel=S.path.relative(temp,root);assert(rel&&!rel.startsWith("..")&&!S.path.isAbsolute(rel));await S.fs.rename(lockPath,S.path.join(root,".dead-writer-"+lock.token));
 if(stage==="during-retention"){await assert.rejects(f.reopen());assert(Object.keys(before).some(n=>n.startsWith("REQUEST-v1-")));}
 else{await f.reopen();const result=await f.runtime.reconcile(intent.operationId),committed=["after-publication","before-memory-refresh"].includes(stage);assert.equal(result.state,committed?"committed":"missing");const replay=await f.runtime.replay(intent.operationId);assert.equal(replay.status,committed?"replayed":"uncertain");const tasks=(await f.runtime.list()).tasks;assert.equal(tasks.length,committed?1:0);if(committed)assert.equal(tasks[0].id,intent.action.draft.id);else await assert.rejects(f.runtime.mutate(await f.intent({text:"Replacement"})));await f.runtime.close();}
 await S.fs.writeFile(S.path.join(dir,"final-files.json"),JSON.stringify(await rawFiles(f.directory),null,2));
});

test("final publication rechecks retained request after candidate and generation staging",async t=>{
 let f,armed=false,hit=false;f=await S.fixture(t,{repositoryOptions:{fault:async stage=>{if(armed&&stage==="beforeManifestReplace"){armed=false;hit=true;const name=(await S.fs.readdir(f.directory)).find(n=>n.startsWith("REQUEST-v1-"));const p=S.path.join(f.directory,name);await S.fs.writeFile(p,"{tampered");}}}});
 const i=await f.intent();armed=true;const out=await f.runtime.mutate(i);assert(hit);assert.equal(out.status,"rejected");assert.equal(f.repository.queryTasks().length,0);assert.equal((await f.runtime.list()).tasks.length,0);await assert.rejects(f.runtime.mutate(await f.intent()));
});
test("operation reconciliation rejects changed context instead of accepting old owner pins",async t=>{
 const f=await S.fixture(t),i=await f.intent();await f.runtime.mutate(i);f.registry.change(r=>r.owners[0].root="Projects/Renamed");await assert.rejects(f.runtime.reconcile(i.operationId));
});
test("close drains accepted retention and suppresses late result acceptance",async t=>{
 const f=await S.fixture(t),i=await f.intent(),c=await cap(f);const p=f.session.requests.prepare(c,i),closing=f.runtime.close();await p;await closing;assert.equal(f.session.host.info().phase,"disposed");assert.equal((await S.fs.readdir(f.directory)).includes("WRITER.lock"),false);await assert.rejects(f.session.requests.prepare(c,i));
});

test("malformed private evidence yields bounded diagnostics without source or root disclosure",async t=>{
 const f=await S.fixture(t),{r}=await retained(f),name="REQUEST-v1-"+S.P.hash(r.operationId)+".json";await S.fs.writeFile(S.path.join(f.directory,name),"{PRIVATE_RAW_SENTINEL");
 await assert.rejects(f.runtime.getRetained(r.operationId),e=>{assert.equal(e.code,"REQUEST_RETENTION_INVALID");assert(!String(e).includes("PRIVATE_RAW_SENTINEL"));assert(!String(e).includes(f.directory));assert.deepEqual(e.details,{});return true;});assert.equal(f.repository.queryTasks().length,0);
});
