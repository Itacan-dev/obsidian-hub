"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),core=require("../src");
const{fixture,create,mutate,randomUUID,owners,rule,command,define,template,revise,reviseRule,node,setup,defined,stateOf,atomicReject}=require("./recurrence-support.cjs");
for(const kind of ["memory","json"]){
 test(`${kind}: B1 precondition rejects reversed same-day endpoints through the unchanged task validator`,async t=>{
  const f=await fixture(kind,t);await atomicReject(assert,f,create({start:{date:"2026-10-17",time:"18:00"},due:{date:"2026-10-17",time:"09:00"}}),"VALIDATION");assert.equal(f.repo.queryTasks().length,0);assert.equal(f.repo.info().schemaVersion,1);
 });
 test(`${kind}: B1 defining a series preserves preexisting checked nested Steps and completion bindings`,async t=>{
  const f=await fixture(kind,t),a=randomUUID(),b=randomUUID();const task=(await f.repo.execute(create({due:{date:"2026-10-17",time:null},steps:[{id:a,title:"Checked",order:0,completed:true},{id:b,parentStepId:a,title:"Checked child",order:0,completed:true}]}))).task,before=await stateOf(f);
  await f.repo.execute(define(f.repo,task));const after=await stateOf(f);assert.deepEqual(after.tasks,before.tasks);assert.deepEqual(after.history,before.history);assert.deepEqual(after.bindings,before.bindings);assert.equal(after.history.length,2);
 });
 test(`${kind}: B1 define series upgrades only store schema, preserves task/Steps/events and replays after reopen`,async t=>{
  const{f,task}=await setup(kind,t);const before=await stateOf(f),request=define(f.repo,task),r=await f.repo.execute(request),s=r.recurrence;
  assert.equal(f.repo.info().schemaVersion,2);assert.equal(task.schemaVersion,1);assert.deepEqual(f.repo.getTask(task.id),task);assert.equal(r.tasks.length,0);assert.deepEqual(r.change.eventIds,[]);assert.equal(s.series.committedOccurrenceCount,1);assert.equal(s.membership.ordinal,1);assert.equal(s.membership.generationKey,null);assert.deepEqual((await stateOf(f)).history,before.history);assert.deepEqual((await stateOf(f)).bindings,before.bindings);assert.deepEqual((await stateOf(f)).recurrence.generationLedger,[]);
  assert.equal((await f.repo.execute(request)).replayed,true);await f.reopen();assert.deepEqual((await f.repo.execute(request)).recurrence,s);assert.equal(f.repo.recurrenceReadiness().generationSupported,false);
  const detached=f.repo.getRecurrenceSeries(s.series.id);detached.series.owner.id="outside";assert.deepEqual(f.repo.getRecurrenceSeries(s.series.id).series.owner,task.owner);
  const collision={...request,payload:{...request.payload,reason:"Different payload"}};await assert.rejects(()=>f.repo.execute(collision),e=>e.code==="OPERATION_CONFLICT");
 });
 for(const [label,patch,code]of[
  ["missing task",c=>c.taskId=randomUUID(),"NOT_FOUND"],["stale task",c=>c.expectedRevision=99,"REVISION_CONFLICT"],["stale repository",c=>c.expectedRepositoryRevision=0,"REPOSITORY_CONFLICT"],
  ["wrong owner",c=>c.payload.owner=owners.b],["wrong partition",c=>c.payload.partitionId="git-b"],["invalid UUID",c=>c.payload.seriesId="invalid"],["unknown contract",c=>c.payload.version=2,"UNSUPPORTED_SCHEMA"],
  ["missing expected revision",c=>delete c.expectedRepositoryRevision],["unknown field",c=>c.payload.rule.count=2],["natural language",c=>c.payload.rule="every day"],["unknown calendar",c=>c.payload.rule.calendar.calendar="iso8601"],["invalid zone",c=>c.payload.rule.calendar.zone="Never/Anywhere"],
  ...["MONTHLY","YEARLY","HOURLY"].map(x=>[x,c=>c.payload.rule.frequency=x,"UNSUPPORTED_OPERATION"]),
  ...[0,-1,1.2,Number.MAX_SAFE_INTEGER+1].map(x=>["interval "+x,c=>c.payload.rule.interval=x]),
  ["when done",c=>c.payload.rule.referencePolicy="when-done","UNSUPPORTED_OPERATION"],
  ["bound",c=>c.payload.rule.until="2027-01-01"], ["external revision",c=>c.payload.expectedInventoryRevision="changed","RESERVATION_CONFLICT"]
 ])test(`${kind}: B1 rejects ${label} atomically`,async t=>{const{f,task}=await setup(kind,t),c=define(f.repo,task);patch(c);await atomicReject(assert,f,c,code);});
 for(const [label,endpoints,code]of[
  ["start anchor",{start:{date:"2026-02-28",time:null},due:null}], ["due anchor",{start:null,due:{date:"2026-03-01",time:null}}],
  ["no anchor",{start:null,due:null},"VALIDATION"],["explicit midnight",{start:null,due:{date:"2026-10-17",time:"00:00"}},"UNSUPPORTED_OPERATION"],
  ["timed",{start:{date:"2026-10-17",time:"09:00"},due:{date:"2026-10-17",time:"18:00"}},"UNSUPPORTED_OPERATION"]
 ])test(`${kind}: B1 ${label} endpoint boundary`,async t=>{const f=await fixture(kind,t),task=(await f.repo.execute(create(endpoints))).task,c=define(f.repo,task);if(code)await atomicReject(assert,f,c,code);else{const r=await f.repo.execute(c);assert.equal(r.recurrence.rule.offsets.anchor,endpoints.due?"due":"start");}});
 test(`${kind}: B1 duplicate membership, stale series/rule and explicit revision boundary`,async t=>{
  const{f,task,snapshot:s}=await defined(kind,t);await atomicReject(assert,f,define(f.repo,task));
  const bad=reviseRule(f.repo,task,s,{effectiveAfterOccurrenceId:randomUUID()});await atomicReject(assert,f,bad);
  const result=await f.repo.execute(reviseRule(f.repo,task,s));assert.equal(result.recurrence.rule.rule.frequency,"WEEKLY");assert.equal(result.recurrence.rule.offsets.startDays,-1);assert.equal(result.recurrence.rule.revision,2);assert.deepEqual(result.recurrence.membership,s.membership);assert.deepEqual(f.repo.getTask(task.id),task);
  const state=await stateOf(f);assert.deepEqual(state.recurrence.ruleRevisions[0],s.rule);
  await atomicReject(assert,f,reviseRule(f.repo,task,s),"REVISION_CONFLICT");
  await atomicReject(assert,f,reviseRule(f.repo,task,result.recurrence,{expectedRuleRevision:1}),"REVISION_CONFLICT");
 });
 test(`${kind}: B1 nested template revision preserves immutable history, supports content/order/reparent and explicit retirement`,async t=>{
  const{f,task,snapshot:s}=await defined(kind,t),a=node(),b=node({parentNodeId:a.id}),c=node({parentNodeId:b.id}),d=node({parentNodeId:c.id}),e=node({order:1});
  let x=(await f.repo.execute(template(f.repo,task,s,[a,b,c,d,e]))).recurrence;assert.equal(x.template.revision.nodes.length,5);assert.deepEqual(f.repo.getTask(task.id),task);
  await atomicReject(assert,f,revise(f.repo,task,x,[],{deletions:[{nodeId:a.id,cascade:false,descendantIds:[b.id,c.id,d.id]}]}));
  await atomicReject(assert,f,revise(f.repo,task,x,[],{deletions:[{nodeId:a.id,cascade:true,descendantIds:[b.id]}]}));
  const original=structuredClone(x.template.revision),draft=x.template.revision.nodes.map(n=>({...n,state:"existing"}));draft.find(n=>n.id===e.id).order=0;draft.find(n=>n.id===a.id).order=1;draft.find(n=>n.id===c.id).parentNodeId=e.id;draft.find(n=>n.id===b.id).body="Edited\nbody";
  x=(await f.repo.execute(revise(f.repo,task,x,draft))).recurrence;assert.equal(x.template.revision.revision,2);assert.equal(x.template.revision.nodes.find(n=>n.id===d.id).parentNodeId,c.id);
  assert.deepEqual((await stateOf(f)).recurrence.templateRevisions[0],original);
  const kept=x.template.revision.nodes.filter(n=>![c.id,d.id].includes(n.id)).map(n=>({...n,state:"existing"}));x=(await f.repo.execute(revise(f.repo,task,x,kept,{deletions:[{nodeId:c.id,cascade:true,descendantIds:[d.id]}]}))).recurrence;
  const retired=(await stateOf(f)).recurrence.reservations.filter(r=>r.retired).map(r=>r.id).sort();assert.deepEqual(retired,[c.id,d.id].sort());
  const reuse=[...x.template.revision.nodes.map(n=>({...n,state:"existing"})),node({id:c.id,order:2})];await atomicReject(assert,f,revise(f.repo,task,x,reuse),"IDENTITY_CONFLICT");
  const changed=(await f.repo.execute(mutate(task,"task.update",{patch:{title:"Occurrence-only edit",due:{date:"2027-01-01",time:null}}}))).task;
  const after=f.repo.getRecurrenceSeries(s.series.id);assert.deepEqual(after,x);assert.equal(after.rule.origin.due.date,"2026-10-17");assert.equal(changed.due.date,"2027-01-01");
 });
 for(const [label,alter]of[
  ["cycle",nodes=>nodes[0].parentNodeId=nodes[1].id],["self parent",nodes=>nodes[0].parentNodeId=nodes[0].id],["foreign parent",nodes=>nodes[1].parentNodeId=randomUUID()],
  ["duplicate node",nodes=>nodes.push(structuredClone(nodes[0]))],["duplicate order",nodes=>nodes[1].order=0],["gapped order",nodes=>nodes[1].order=3],["completed node",nodes=>nodes[0].completed=true],["invalid title",nodes=>nodes[0].title=""],["invalid body",nodes=>nodes[0].body={bad:true}], ["untyped intent",nodes=>delete nodes[0].state]
 ])test(`${kind}: B1 rejects template ${label}`,async t=>{const{f,task,snapshot:s}=await defined(kind,t),nodes=[node(),node({order:1})];alter(nodes);await atomicReject(assert,f,template(f.repo,task,s,nodes));});
 test(`${kind}: B1 empty template, explicit insertion first/between/last, omissions and stale revisions`,async t=>{
  const{f,task,snapshot:s}=await defined(kind,t);let x=(await f.repo.execute(template(f.repo,task,s,[]))).recurrence;
  const a=node({order:0}),b=node({order:1}),c=node({order:2});x=(await f.repo.execute(revise(f.repo,task,x,[a,b,c]))).recurrence;
  await atomicReject(assert,f,revise(f.repo,task,x,x.template.revision.nodes.slice(1).map(n=>({...n,state:"existing"}))));
  const fresh=node({order:1}),draft=x.template.revision.nodes.map(n=>({...n,state:"existing",order:n.order>=1?n.order+1:n.order}));x=(await f.repo.execute(revise(f.repo,task,x,[...draft,fresh]))).recurrence;
  assert.equal(x.template.revision.nodes.find(n=>n.id===fresh.id).order,1);await atomicReject(assert,f,revise(f.repo,task,x,x.template.revision.nodes.map(n=>({...n,state:"existing"})),{expectedTemplateRevision:1}),"REVISION_CONFLICT");
 });
 test(`${kind}: B1 occurrence Step completion and native body edits leave template untouched`,async t=>{
  const{f,task,snapshot:s}=await defined(kind,t),x=(await f.repo.execute(template(f.repo,task,s,[node()]))).recurrence;
  let current=(await f.repo.execute(mutate(task,"step.add",{step:{title:"Local step",order:0}}))).task;
  current=(await f.repo.execute(mutate(current,"step.complete",{stepId:current.steps[0].id,completed:true}))).task;
  const content={version:1,expectedRevision:0,appendOriginals:[],continuation:"Local body"};
  // Use the actual N1-C native-content command payload, not template completion fields.
  const structural={version:1,draft:{version:1,taskId:current.id,expectedRevision:current.revision,steps:current.steps.map(s=>({state:"existing",id:s.id,parentStepId:s.parentStepId,order:s.order,title:s.title,body:"Local **Step body**",completed:s.completed}))},deletions:[],taskPatch:{},content};
  assert.deepEqual(f.repo.getRecurrenceSeries(s.series.id),x);assert.equal(current.steps[0].completed,true);assert.equal(f.repo.queryHistory().length,1);
  await f.repo.execute(mutate(current,"task.editStructure",structural));assert.deepEqual(f.repo.getRecurrenceSeries(s.series.id),x);
 });
 test(`${kind}: B1 concurrent same IDs and concurrent stale series edits publish once`,async t=>{
  const{f,task}=await setup(kind,t),seriesId=randomUUID(),ruleId=randomUUID();const pair=await Promise.allSettled([f.repo.execute(define(f.repo,task,{seriesId,ruleId})),f.repo.execute(define(f.repo,task,{seriesId,ruleId}))]);assert.equal(pair.filter(x=>x.status==="fulfilled").length,1);
  const s=f.repo.getRecurrenceSeries(seriesId),pair2=await Promise.allSettled([f.repo.execute(reviseRule(f.repo,task,s)),f.repo.execute(reviseRule(f.repo,task,s))]);assert.equal(pair2.filter(x=>x.status==="fulfilled").length,1);assert.equal((await stateOf(f)).recurrence.ruleRevisions.length,2);
 });
 for(const type of ["recurrence.generateNextOccurrence","recurrence.completeAndGenerate","recurrence.pause","recurrence.resume","recurrence.replace"])
  test(`${kind}: B1 explicitly refuses ${type}`,async t=>{const{f,task}=await setup(kind,t);await atomicReject(assert,f,command(f.repo,task,type,{}),"UNSUPPORTED_OPERATION");});
}
