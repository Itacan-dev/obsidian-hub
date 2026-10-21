"use strict";
const test=require("node:test"),S=require("./support.cjs"),{assert}=S,I=require("../../application/intents"),A=require("../../writer/admission");
const session=()=>S.sessions.at(-1),grant=f=>session().authorize({version:1,owners:f.writerPolicy.owners,commands:f.writerPolicy.commands});
async function retained(f,values={}){const intent=await f.intent(values),cap=await grant(f);try{return{intent,record:await session().requests.prepare(cap,intent)};}finally{session().revoke(cap);}}
async function files(f){const out={};for(const n of await S.fs.readdir(f.directory)){const p=S.path.join(f.directory,n);if((await S.fs.lstat(p)).isFile())out[n]=(await S.fs.readFile(p)).toString("base64");}return out;}
function changedRecord(record,intent){const request=I.compile(intent).request,body={...S.V.clone(record),operationId:intent.operationId,intent,intentDigest:S.P.hash(intent),writerRequest:request,writerRequestDigest:S.P.hash(request),commandDigest:S.P.hash(A.compile(request))};delete body.checksum;return{...body,checksum:S.P.hash(body)};}

test("ordinary create and atomic Save remain unchanged; inspection is bounded and read-only",async t=>{
 const f=await S.fixture(t),i=await f.intent({text:"PRIVATE_TITLE_SENTINEL"}),out=await f.runtime.mutate(i);assert.equal(out.status,"committed");const form=f.runtime.formService({}),draft=await form.read({id:out.taskIds[0]});await form.save(draft,{...draft,text:"Saved",operation:"edit"});
 const before=await files(f),report=await f.runtime.recovery.inspect(i.operationId);assert.equal(report.classification,"confirmed-committed");assert(report.observation);assert(!JSON.stringify(report).includes("SENTINEL"));for(const key of ["intent","writerRequest","command","payload","directory","token"])assert(!Object.hasOwn(report,key));assert.deepEqual(await files(f),before);
});
test("reconstructed missing receipt stays uncertain by default, explicit exact replay resolves it and normal writes resume",async t=>{
 const f=await S.fixture(t),{intent,record}=await retained(f,{completed:true});await f.reopen();
 assert.equal((await f.runtime.replay(intent.operationId)).status,"uncertain");const review=await f.runtime.recovery.inspect(intent.operationId);assert.equal(review.classification,"execution-uncertain");assert.equal(review.canReplay,true);assert.equal(review.replayCode,"EXACT_ORIGINAL_HEAD_REPLAY");
 const out=await f.runtime.recovery.replay(review);assert.equal(out.status,"committed");assert.deepEqual(out.taskIds,[intent.action.draft.id]);assert.equal((await f.runtime.list()).tasks.length,1);assert.deepEqual(await f.runtime.getRetained(intent.operationId),record);
 await assert.rejects(f.runtime.recovery.replay(review));assert.equal((await f.runtime.recovery.reconcile(intent.operationId)).inspection.classification,"confirmed-committed");
 const again=await f.runtime.recovery.replay(await f.runtime.recovery.inspect(intent.operationId));assert.equal(again.status,"replayed");assert.deepEqual(again.eventIds,out.eventIds);
 const next=await f.runtime.mutate(await f.intent({text:"Next"}));assert.equal(next.status,"committed");assert.equal((await f.runtime.list()).tasks.length,2);
});
test("lost UI acknowledgement reconciles the native receipt and clears the process-local pending gate",async t=>{
 let armed=false;const f=await S.fixture(t,{repositoryOptions:{fault(stage){if(armed&&stage==="beforeAcknowledgement"){armed=false;throw Error("lost UI ack");}}}}),i=await f.intent({completed:true});armed=true;const uncertain=await f.runtime.mutate(i);assert.equal(uncertain.status,"uncertain");
 const inspection=await f.runtime.recovery.inspect(i.operationId);assert.equal(inspection.classification,"confirmed-committed");const before=await files(f);assert.equal((await f.runtime.recovery.reconcile(i.operationId)).presentation.state,"current");assert.deepEqual(await files(f),before);assert.equal((await f.runtime.mutate(await f.intent({text:"After reconciliation"}))).status,"committed");
});
test("known commitment with failed display refresh stays committed; reconciliation refreshes only",async t=>{
 let f,armed=false;f=await S.fixture(t,{repositoryOptions:{fault(stage){if(armed&&stage==="beforeAcknowledgement"){armed=false;f.registry.change(r=>r.owners[0].available=false);}}}});const i=await f.intent();armed=true;const out=await f.runtime.mutate(i);assert.equal(out.status,"committed");assert.notEqual(out.readAfterWrite.state,"current");
 // Reusing a fresh provider with the exact original observation models restoration,
 // not rebasing the retained request to a changed registry identity.
 const retained=await S.fs.readFile(S.path.join(f.directory,"REQUEST-v1-"+S.P.hash(i.operationId)+".json"),"utf8");await f.runtime.close();
 const c=S.configuration(f.directory),original=JSON.parse(retained),reg={version:1,registryId:f.config.registryId,applicationContextId:f.config.applicationContextId,revision:"1",owners:[{owner:f.owner,partitionId:"private",root:"Projects/Native",dashboard:"Projects/Native/Dashboard.md",shared:false,shareApproval:null,available:true,status:"active",locations:[],mounts:[]}]};
 const registry={read:async()=>({...reg,digest:S.H.registryDigest(reg)}),subscribe:()=>()=>{}};const runtime=await S.openProjectRuntime(f.config,{...c,owner:f.owner,writerPolicy:f.writerPolicy,rehearsalId:f.rehearsalId,registry,creating:false});t.after(()=>runtime.close());
 const before=await files(f),result=await runtime.recovery.reconcile(i.operationId);assert.equal(result.inspection.classification,"confirmed-committed");assert.equal(result.presentation.state,"current");assert.deepEqual(await files(f),before);assert.equal((await runtime.list()).tasks[0].id,original.intent.action.draft.id);
});
test("transient refresh failure is classified separately and refreshes without reissuing the command",async t=>{
 let armed=false,offline=false;const f=await S.fixture(t,{repositoryOptions:{fault(stage){if(armed&&stage==="beforeAcknowledgement"){armed=false;offline=true;}if(offline&&stage==="snapshot:beforeAcceptance"){const e=Error("synthetic read outage");e.code="IO_ERROR";throw e;}}}}),i=await f.intent();armed=true;const out=await f.runtime.mutate(i);assert.equal(out.status,"committed");assert.notEqual(out.readAfterWrite.state,"current");offline=false;
 assert.equal((await f.runtime.recovery.inspect(i.operationId)).classification,"committed-refresh-unavailable");const before=await files(f),reconciled=await f.runtime.recovery.reconcile(i.operationId);assert.equal(reconciled.inspection.classification,"confirmed-committed");assert.equal(reconciled.presentation.state,"current");assert.equal((await f.runtime.recovery.inspect(i.operationId)).classification,"confirmed-committed");assert.deepEqual(await files(f),before);
});
test("a changed stable retained request conflicts with the authoritative receipt",async t=>{
 const f=await S.fixture(t),i=await f.intent();await f.runtime.mutate(i);const original=await f.runtime.getRetained(i.operationId),changed=S.V.clone(i);changed.reason+=" changed";const r=changedRecord(original,changed);await S.fs.writeFile(S.path.join(f.directory,"REQUEST-v1-"+S.P.hash(i.operationId)+".json"),S.V.canonical(r)+"\n");
 const report=await f.runtime.recovery.inspect(i.operationId);assert.equal(report.classification,"conflict");assert.equal(report.canReplay,false);await assert.rejects(f.runtime.recovery.replay(report));assert.equal((await f.runtime.list()).tasks.length,1);
});
test("corrupt request is diagnosed without private bytes and remains blocked, including reconstruction",async t=>{
 const f=await S.fixture(t),{intent}=await retained(f);await S.fs.writeFile(S.path.join(f.directory,"REQUEST-v1-"+S.P.hash(intent.operationId)+".json"),"{PRIVATE_CORRUPTION_SENTINEL");const report=await f.runtime.recovery.inspect(intent.operationId);assert.equal(report.classification,"damaged");assert(report.observation);assert(!JSON.stringify(report).includes("SENTINEL"));assert.equal(report.canReplay,false);await assert.rejects(f.runtime.mutate(await f.intent()));await assert.rejects(f.reopen());
});
test("stale original repository guards cannot be refreshed by recovery",async t=>{
 const f=await S.fixture(t);await f.runtime.mutate(await f.intent());const i=await f.intent();i.guard.expectedRepositoryRevision--;const c=await grant(f);await session().requests.prepare(c,i);session().revoke(c);await f.reopen();const report=await f.runtime.recovery.inspect(i.operationId);assert.equal(report.classification,"execution-uncertain");assert.equal(report.canReplay,false);assert.equal(report.replayCode,"ORIGINAL_GUARDS_STALE");await assert.rejects(f.runtime.recovery.replay(report));await assert.rejects(f.runtime.mutate(await f.intent()));assert.equal((await f.runtime.list()).tasks.length,1);
});
test("review is unforgeable, one-use and cannot be applied to another retained request or writer signature",async t=>{
 const f=await S.fixture(t),{intent}=await retained(f);await f.reopen();const review=await f.runtime.recovery.inspect(intent.operationId);await assert.rejects(f.runtime.recovery.replay(S.V.clone(review)));await assert.rejects(f.runtime.recovery.replay({...review,operationId:S.crypto.randomUUID()}));
 const c=await grant(f),r=await session().requests.get(c,intent.operationId);const out=await session().writer.task(c,r.writerRequest,undefined,review);assert.equal(out.status,"uncertain");await assert.rejects(session().requests.replay(c,S.V.clone(review)));session().revoke(c);
 const committed=await f.runtime.recovery.replay(review);assert.equal(committed.status,"committed");assert.equal((await f.runtime.list()).tasks.length,1);
});
test("head changes revoke a reviewed permission; new inspection can replay only the original committed receipt",async t=>{
 const f=await S.fixture(t),i=await f.intent();await f.runtime.mutate(i);const report=await f.runtime.recovery.inspect(i.operationId);await f.runtime.mutate(await f.intent({text:"Later"}));const stale=await f.runtime.recovery.replay(report);assert.equal(stale.status,"uncertain");const next=await f.runtime.recovery.replay(await f.runtime.recovery.inspect(i.operationId));assert.equal(next.status,"replayed");assert.equal((await f.runtime.list()).tasks.length,2);
});
test("changed registry, invalid lease and closed writer cannot use a reviewed operation",async t=>{
 for(const kind of ["registry","lease","closed"]){const f=await S.fixture(t),{intent}=await retained(f);await f.reopen();const report=await f.runtime.recovery.inspect(intent.operationId);
  let restore=null;if(kind==="registry")f.registry.change(r=>r.owners[0].root="Projects/Changed");else if(kind==="lease"){const p=S.path.join(f.directory,"WRITER.lock"),original=await S.fs.readFile(p,"utf8"),lock=JSON.parse(original);assert.equal(lock.pid,process.pid);assert.equal(lock.host,S.os.hostname());lock.token=S.crypto.randomUUID();const altered=JSON.stringify(lock);await S.fs.writeFile(p,altered);restore=async()=>{assert.equal(await S.fs.readFile(p,"utf8"),altered);const rel=S.path.relative(await S.fs.realpath(S.os.tmpdir()),await S.fs.realpath(f.directory));assert(rel&&!rel.startsWith("..")&&!S.path.isAbsolute(rel));await S.fs.writeFile(p,original);};}else await f.runtime.close();
  const blocked=await f.runtime.recovery.inspect(intent.operationId);assert.equal(blocked.classification,"authority-unavailable");assert.equal(blocked.canReplay,false);await assert.rejects(f.runtime.recovery.replay(report));
  await restore?.();
 }
});
test("publication rechecks retained integrity during a permitted replay",async t=>{
 let f,armed=false,hit=false;f=await S.fixture(t,{repositoryOptions:{async fault(stage){if(armed&&stage==="beforeManifestReplace"){armed=false;hit=true;const n=(await S.fs.readdir(f.directory)).find(n=>n.startsWith("REQUEST-v1-"));await S.fs.writeFile(S.path.join(f.directory,n),"{invalid");}}}});const{intent}=await retained(f);await f.reopen();const review=await f.runtime.recovery.inspect(intent.operationId);armed=true;const out=await f.runtime.recovery.replay(review);assert(hit);assert(!["committed","replayed"].includes(out.status));assert.equal((await f.runtime.list()).tasks.length,0);assert.equal((await f.runtime.recovery.inspect(intent.operationId)).classification,"damaged");
});
test("cancelled recovery consumes its permission and does not alter the retained request",async t=>{
 const f=await S.fixture(t),{intent,record}=await retained(f);await f.reopen();const report=await f.runtime.recovery.inspect(intent.operationId),abort=new AbortController();abort.abort();const out=await f.runtime.recovery.replay(report,abort.signal);assert.equal(out.status,"cancelled");await assert.rejects(f.runtime.recovery.replay(report));assert.deepEqual(await f.runtime.getRetained(intent.operationId),record);assert.equal((await f.runtime.list()).tasks.length,0);
});

test("known fallback cannot acquire recovery permission or bypass the existing all-write fence",async t=>{
 const f=await S.fixture(t),i=await f.intent();await f.runtime.mutate(i);await f.runtime.mutate(await f.intent({text:"Acknowledged later work"}));const current=(await f.disk()).payload.current.file;await f.runtime.close();await S.fs.unlink(S.path.join(f.directory,current));
 try{await f.reopen();}catch(e){assert(["RECOVERY_REQUIRED","HOST_EVIDENCE_UNAVAILABLE"].includes(e.code));return;}
 const report=await f.runtime.recovery.inspect(i.operationId);assert.equal(report.classification,"authority-unavailable");assert.equal(report.canReplay,false);await assert.rejects(f.runtime.recovery.replay(report));await assert.rejects(f.runtime.replay(i.operationId));
});

test("another unresolved record and revoked grants are not covered by a reviewed request",async t=>{
 const f=await S.fixture(t),{intent,record}=await retained(f),other=await f.intent({text:"Unreviewed other operation"}),r=changedRecord(record,other);await S.fs.writeFile(S.path.join(f.directory,"REQUEST-v1-"+S.P.hash(other.operationId)+".json"),S.V.canonical(r)+"\n");await f.reopen();
 const review=await f.runtime.recovery.inspect(intent.operationId);assert.equal(review.canReplay,false);assert.equal(review.replayCode,"OTHER_REQUEST_UNRESOLVED");await assert.rejects(f.runtime.recovery.replay(review));
 const cap=await grant(f);session().revoke(cap);await assert.rejects(session().requests.replay(cap,review));assert.equal((await f.runtime.list()).tasks.length,0);
});

test("original target guards still reject atomically after explicit recovery admission",async t=>{
 const f=await S.fixture(t),created=await f.runtime.mutate(await f.intent()),editor=await f.runtime.editor(created.taskIds[0]),intent=S.B.complete(editor,true);intent.action.target.expectedTaskRevision++;
 const cap=await grant(f),record=await session().requests.prepare(cap,intent);session().revoke(cap);await f.reopen();const review=await f.runtime.recovery.inspect(intent.operationId);assert(review.canReplay);const out=await f.runtime.recovery.replay(review);assert.equal(out.status,"conflict");assert.equal(out.code,"REVISION_CONFLICT");assert(!(await f.runtime.list()).tasks[0].completed);assert.deepEqual(await f.runtime.getRetained(intent.operationId),record);await assert.rejects(f.runtime.mutate(await f.intent()));
});

test("committed creation remains confirmed after deletion and recovery never recreates its targets",async t=>{
 const f=await S.fixture(t),intent=await f.intent({completed:true}),created=await f.runtime.mutate(intent);await f.runtime.mutate(S.B.remove(await f.runtime.editor(created.taskIds[0])));await f.reopen();
 const report=await f.runtime.recovery.inspect(intent.operationId);assert.equal(report.classification,"confirmed-committed");const result=await f.runtime.recovery.replay(report);assert.equal(result.status,"replayed");assert.deepEqual(result.taskIds,created.taskIds);assert.deepEqual(result.eventIds,created.eventIds);assert.equal((await f.runtime.list()).tasks.length,0);assert.equal((await f.runtime.recovery.reconcile(intent.operationId)).presentation.state,"current");
});

test("a context change at final publication revokes permitted replay without committing",async t=>{
 let f,armed=false,hit=false;f=await S.fixture(t,{repositoryOptions:{fault(stage){if(armed&&stage==="beforeManifestReplace"){armed=false;hit=true;f.registry.change(r=>r.owners[0].status="shelved");}}}});const{intent}=await retained(f);await f.reopen();const report=await f.runtime.recovery.inspect(intent.operationId);armed=true;const out=await f.runtime.recovery.replay(report);assert(hit);assert(!["committed","replayed"].includes(out.status));assert.equal((await f.runtime.list()).tasks.length,0);assert.equal((await f.runtime.recovery.inspect(intent.operationId)).canReplay,false);
});

module.exports={retained,grant,session,files};
