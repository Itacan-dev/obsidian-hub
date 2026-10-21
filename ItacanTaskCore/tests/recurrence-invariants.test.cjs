"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),core=require("../src"),{sha256}=require("../src/source-content"),{canonical}=require("../src/value");
const{fixture,create,mutate,randomUUID,rule,define,template,revise,node,setup,defined,stateOf,atomicReject}=require("./recurrence-support.cjs");
for(const kind of ["memory","json"]){
 for(const [label,which]of[["series equals task","task"],["rule equals task","ruleTask"],["template equals Step","templateStep"],["node equals Step","nodeStep"],["rule equals retired task","retiredTask"],["series equals retired Step","retiredStep"],["external ID","external"]])
 test(`${kind}: B1 native reservation conflict ${label}`,async t=>{
  const external=randomUUID(),{f,task}=await setup(kind,t,{externalReservations:{version:1,revision:"synthetic-exclusive-inventory-1",ids:[external]}});
  let current=(await f.repo.execute(mutate(task,"step.add",{step:{title:"Existing",order:0}}))).task;const stepId=current.steps[0].id;
  if(which==="retiredStep")current=(await f.repo.execute(mutate(current,"step.delete",{stepId}))).task;
  if(which==="retiredTask"){let other=(await f.repo.execute(create())).task;await f.repo.execute(mutate(other,"task.delete",{}));await atomicReject(assert,f,define(f.repo,current,{ruleId:other.id}),"IDENTITY_CONFLICT");return;}
  if(["templateStep","nodeStep"].includes(which)){const s=(await f.repo.execute(define(f.repo,current))).recurrence;await atomicReject(assert,f,template(f.repo,current,s,[node({id:which==="nodeStep"?stepId:randomUUID()})],which==="templateStep"?{templateId:stepId}:{}),"IDENTITY_CONFLICT");}
  else await atomicReject(assert,f,define(f.repo,current,which==="ruleTask"?{ruleId:task.id}:{seriesId:which==="task"?task.id:which==="retiredStep"?stepId:external}),"IDENTITY_CONFLICT");
 });
 test(`${kind}: B1 later task/Step/event allocations cannot reuse recurrence reservations`,async t=>{
  const{f,task,snapshot:s}=await defined(kind,t),seriesId=s.series.id;await atomicReject(assert,f,create({id:seriesId}),"IDENTITY_CONFLICT");await atomicReject(assert,f,mutate(task,"step.add",{step:{id:s.rule.ruleId,title:"collision",order:0}}),"IDENTITY_CONFLICT");
  const oldFactory=f.options.idFactory;await f.reopen({idFactory:()=>seriesId});await atomicReject(assert,f,mutate(task,"task.complete",{completed:true}),"IDENTITY_CONFLICT");await f.reopen({idFactory:oldFactory});
 });
 test(`${kind}: B1 allocation exhaustion/invalid UUID and failed new-node drafts publish no reservations`,async t=>{
  const{f,task}=await setup(kind,t);await f.reopen({idFactory:()=>task.id});await atomicReject(assert,f,define(f.repo,task),"IDENTITY_EXHAUSTED");await f.reopen({idFactory:()=>"bad"});await atomicReject(assert,f,define(f.repo,task),"VALIDATION");
 });
 test(`${kind}: B1 external inventory is mandatory and captured revisions cannot change across reopen`,async t=>{
  const{f,task}=await setup(kind,t);await f.reopen({externalReservations:undefined});await atomicReject(assert,f,define(f.repo,task),"EXTERNAL_RESERVATION_REQUIRED");await f.reopen();const s=(await f.repo.execute(define(f.repo,task))).recurrence;
  await f.reopen({externalReservations:{version:1,revision:"changed",ids:[]}});const c=template(f.repo,task,s,[]);c.payload.expectedInventoryRevision="changed";await atomicReject(assert,f,c,"RESERVATION_CONFLICT");
 });
 test(`${kind}: B1 rejects recurring deletion/owner transfer rather than partial lifecycle`,async t=>{
  const{f,task}=await defined(kind,t);await atomicReject(assert,f,mutate(task,"task.delete",{}),"UNSUPPORTED_OPERATION");await atomicReject(assert,f,mutate(task,"task.relocate",{owner:{type:"resource",id:"study"},location:null,phase:null}),"UNSUPPORTED_OPERATION");
 });
 const workspaces=[...["Itacan","Obsidian Hub"].map(id=>({id,kind:"git-project",owner:{type:"project",id}})),{id:"Private",kind:"private-project",owner:{type:"project",id:"Private"}},...["study","literature","references","inspiration"].map(id=>({id,kind:"resource",owner:{type:"resource",id}}))];
 for(const partition of workspaces)test(`${kind}: B1 owner/privacy ${partition.owner.type}/${partition.owner.id}`,async t=>{
  const f=await fixture(kind,t,{partitions:workspaces});const task=(await f.repo.execute(create({owner:partition.owner,due:{date:"2026-10-17",time:null}}))).task,c=define(f.repo,task);c.context={workingContext:{type:"project",id:"Itacan"}};
  const s=(await f.repo.execute(c)).recurrence,x=(await f.repo.execute(template(f.repo,task,s,[node({body:"private-source-path / aliases / Oath / receipt evidence"})]))).recurrence;
  assert.deepEqual(x.series.owner,partition.owner);assert.deepEqual(x.template.definition.owner,partition.owner);assert.equal(x.membership.partitionId,partition.id);
  assert.throws(()=>f.repo.exportSharedPartition(partition.id),e=>e.code==="UNSUPPORTED_OPERATION");
  const other=workspaces.find(p=>p.kind==="git-project"&&p.id!==partition.id);const packet=JSON.parse(f.repo.exportSharedPartition(other.id));assert.equal(packet.tasks.length,0);assert(!JSON.stringify(packet).includes("private-source-path"));assert(!Object.hasOwn(packet,"recurrence"));
 });
}
test("B1 immutable records cannot be rewritten, downcast or detached from their receipts",async t=>{
 const{f,task,snapshot:s}=await defined("memory",t);await f.repo.execute(template(f.repo,task,s,[node()]));const state=await stateOf(f);
 for(const alter of [
  x=>x.recurrence.version=2,x=>x.recurrence.ruleRevisions[0].rule.interval=3,x=>x.recurrence.memberships[0].taskId=randomUUID(),x=>x.recurrence.memberships.push({...x.recurrence.memberships[0]}),
  x=>x.recurrence.series[0].owner.id="wrong",x=>x.recurrence.series[0].state="paused",x=>x.recurrence.generationLedger.push({}),
  x=>{x.schemaVersion=1;delete x.recurrence;},x=>{const r=x.recurrence.templateRevisions[0];r.nodes[0].body="rewritten";r.digest=sha256(canonical({...r,digest:null}));},
  x=>x.recurrence.reservations[0].id=task.id
 ]){const next=structuredClone(state);alter(next);assert.throws(()=>core.validateState(next));}
});
function graph(){
 const sid=randomUUID(),rid=randomUUID(),a=randomUUID(),b=randomUUID(),owner={type:"project",id:"synthetic"};
 const membership=(taskId,ordinal,predecessorId,successorId)=>({version:1,taskId,seriesId:sid,owner,partitionId:"synthetic",ordinal,predecessorId,successorId,ruleId:rid,ruleRevision:1,templateId:null,templateRevision:null,generationOperationId:ordinal===1?null:"generation-command",generationKey:ordinal===1?null:core.generationKey(owner,sid,predecessorId),originalEndpoints:{start:null,due:{date:ordinal===1?"2026-10-17":"2026-10-18",time:null}}});
 return{version:1,occurrences:[membership(a,1,null,b),membership(b,2,a,null)],ledger:[{version:1,key:core.generationKey(owner,sid,a),seriesId:sid,predecessorId:a,operationId:"generation-command",receiptOperationId:"generation-command",completionEventId:randomUUID(),committedRevision:5,ruleRevision:1,templateRevision:null,referenceEvidence:{version:1,policy:"fixed-origin",originOrdinal:1,origin:{start:null,due:{date:"2026-10-17",time:null}},zone:"Europe/Stockholm"},result:{kind:"successor",taskId:b,steps:[]}}],retiredSuccessorIds:[]};
}
test("B1 future graph validator is static only, retains deleted successor identity and spent outcome",()=>{const g=graph();assert.equal(core.validateGenerationGraph(g),true);g.retiredSuccessorIds.push(g.occurrences[1].taskId);assert.equal(core.validateGenerationGraph(g),true);});
for(const[label,alter]of[
 ["two outcomes",g=>g.ledger.push(structuredClone(g.ledger[0]))],["noncanonical key",g=>g.ledger[0].key+="device-B"],["event-dependent key",g=>g.ledger[0].key=JSON.stringify([g.ledger[0].key,g.ledger[0].completionEventId])],
 ["missing reciprocal",g=>g.occurrences[0].successorId=null],["cross-owner",g=>g.occurrences[1].owner={type:"resource",id:"study"}],["cross-partition",g=>g.occurrences[1].partitionId="other"],
 ["duplicate membership",g=>g.occurrences.push(structuredClone(g.occurrences[0]))],["two successors",g=>g.occurrences.push({...g.occurrences[1],taskId:randomUUID()})],
 ["two authored roots",g=>g.occurrences.push({...g.occurrences[0],taskId:randomUUID(),successorId:null})],
 ["retarget successor",g=>g.ledger[0].result.taskId=randomUUID()],["lost spent key",g=>{g.retiredSuccessorIds.push(g.occurrences[1].taskId);g.ledger=[];}],
 ["initial generated",g=>g.occurrences[0].generationKey=g.ledger[0].key],["receipt reused as event",g=>g.ledger[0].completionEventId=g.ledger[0].operationId],
 ["template node reused as Step",g=>{const id=randomUUID();g.ledger[0].result.steps=[{stepId:id,templateNodeId:id,completed:false,completedAt:null,completionBinding:null}];}],
 ["copied completed Step",g=>g.ledger[0].result.steps=[{stepId:randomUUID(),templateNodeId:randomUUID(),completed:true,completedAt:123,completionBinding:"E1"}]],
 ["unknown future schema",g=>g.version=2],["missing terminal proof",g=>{g.occurrences=[{...g.occurrences[0],successorId:null}];g.ledger[0].result={kind:"exhausted",reason:"count",proof:""};}]
])test("B1 pure future contract rejects "+label,()=>{const g=graph();alter(g);assert.throws(()=>core.validateGenerationGraph(g));});
test("B1 generation key canonical encoding excludes rule/event/device and separates tuple components",()=>{
 const sid=randomUUID(),pred=randomUUID();const key=core.generationKey({type:"project",id:"owner:a:b"},sid,pred);assert.deepEqual(JSON.parse(key),["native-generation",1,"project","owner:a:b",sid,pred]);assert.notEqual(key,core.generationKey({type:"project",id:"owner:a"},sid,pred));assert.equal(core.RECURRENCE_COMMANDS.length,4);
});
test("B1 captures an immutable external inventory snapshot, without claiming a cross-store fence",async t=>{
 const external={version:1,revision:"synthetic-exclusive-inventory-1",ids:[]},reserved=randomUUID(),{f,task}=await setup("memory",t,{externalReservations:external});external.ids.push(reserved);external.revision="concurrently-mutated-caller-object";
 const result=await f.repo.execute(define(f.repo,task));assert.equal(result.recurrence.series.revision,1);assert.deepEqual((await stateOf(f)).recurrence.externalInventory.ids,[]);
});
