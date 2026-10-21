"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {fixture,dataset,taskView,owners,id,clock,clone}=require("./native-read-fixture.cjs");
const policy=require("./native-read-policy-fixture.cjs");
async function setup(t){const f=fixture();t.after(()=>f.service.close());const query=await f.service.read({backend:"native",operation:"structured",includeDeleted:true});return {...f,tasks:query.rows,contexts:dataset().workspaces};}
test("Search: stable native title/owner/Step evidence exercises real nameScore; complete ranking remains unsupported",async t=>{
 const {tasks}=await setup(t),result=policy.searchEvidence(tasks.find(t=>t.id===id(1)),"Same");
 assert.equal(result.titleScore,1);assert.equal(result.id,id(1));assert.equal(result.steps[1].parentStepId,id(101));
 assert.equal(result.description,"Explicit description");assert.equal(result.parity,"unsupported");assert(result.gaps.includes("indexed continuations"));
 assert.equal(Object.hasOwn(result,"path"),false);
});
test("Daily Brief: actual future/date grouping with eligible owners and native-ID targets; source action unsupported",async t=>{
 const {tasks,contexts,service}=await setup(t),result=policy.briefEvidence(tasks,contexts,clock);
 assert(result.targets.some(ref=>ref.id===id(1)));assert(!result.targets.some(ref=>[id(2),id(3),id(10),id(12)].includes(ref.id)));
 assert(result.targets.some(ref=>ref.id===id(6)));assert.equal(result.legacySourceAction,"unsupported");
 const missing=await service.read({backend:"native",operation:"target",handle:{kind:"native",id:id(999)}});assert.equal(missing.state,"missing");
});
test("Schedule: Project owner and real upcomingGroups/date helpers work; native location eligibility is explicitly unresolved",async t=>{
 const {tasks}=await setup(t),result=policy.scheduleEvidence(tasks,owners.private,clock);
 assert.equal(result.status,"partial");assert(result.groups.today.some(task=>task.id===id(1)));
 assert(!Object.values(result.groups).flat().some(task=>task.id===id(4)));
 assert.equal(policy.scheduleEvidence(tasks,owners.private,clock,"folder-itacan").status,"unsupported");
 assert.equal(policy.scheduleEvidence(tasks,owners.knowledge,clock).status,"unsupported");
});
test("Project Tasks: real active/future/completed grouping retains hierarchical records within physical owner",async t=>{
 const {tasks}=await setup(t),result=policy.panelEvidence(tasks,owners.private,clock);
 assert(result.groups.active.some(task=>task.id===id(1)));assert(result.groups.future.some(task=>task.id===id(2)));
 assert(result.groups.completed.some(task=>task.id===id(3)));assert(!result.tasks.some(task=>task.owner.type==="resource"));
 assert.equal(result.tasks.find(task=>task.id===id(1)).steps[1].parentStepId,id(101));assert.equal(result.locationEligibility,"unresolved");
});
test("Resource Tasks: all four persisted Resource owners remain separate from mounted Project",async t=>{
 const {tasks}=await setup(t);
 for(const owner of [owners.knowledge,owners.research,owners.explorations,owners.inspiration]){
  const result=policy.panelEvidence(tasks,owner,clock);assert.equal(result.tasks.length,1);assert.deepEqual(result.tasks[0].owner,owner);
 }
 const itacan=policy.panelEvidence(tasks,owners.itacan,clock);assert(!itacan.tasks.some(task=>task.owner.type==="resource"));
});
test("Phase editor: native parent IDs/owning Project/Phase, deleted and missing selections, Step non-equivalence",async t=>{
 const {tasks}=await setup(t);const selected=[id(4),id(5),id(10),id(999),id(102)];
 const result=policy.phaseEvidence(tasks,owners.itacan,selected,{projectId:"itacan",phaseId:"phase-itacan"});
 assert.deepEqual(result.map(row=>row.state),["assigned","owner-mismatch","deleted","missing","not-parent"]);
 assert.deepEqual(result.map(row=>row.id),selected);
});
test("Home: primary Resource owner, working Project and unresolved presentation remain distinct",async t=>{
 const {tasks,contexts}=await setup(t),task=tasks.find(task=>task.id===id(6));
 const result=policy.homeEvidence(task,contexts,owners.itacan);
 assert.deepEqual(result.primaryOwner,owners.knowledge);assert.deepEqual(result.workingContext,owners.itacan);
 assert(result.resourceFirst);assert(result.eligibleCohort);assert.equal(result.presentation.state,"unresolved");
 assert.equal(policy.homeEvidence(tasks.find(task=>task.id===id(12)),contexts).eligibleCohort,false);
 assert.equal(Object.hasOwn(task,"linkedProjectId"),false);
});
test("Recorded History: native event snapshots and recorded owner survive moved/deleted/current task evidence",async t=>{
 const {service,adapter}=await setup(t);const history=await service.read({backend:"native",operation:"history",selection:"retained"});
 const current=adapter.snapshot().tasks.find(task=>task.id===id(3));adapter.replaceRecord({...current,revision:2,title:"Changed now",owner:owners.hub,partitionId:"project-hub"});
 const after=await service.read({backend:"native",operation:"history",selection:"retained"});
 assert.deepEqual(after,history);assert.equal(after.rows[1].snapshot.title,"Original recorded title");
 assert.deepEqual(after.rows[1].ownerAtEvent,owners.itacan);assert(after.rows.some(row=>row.taskId===id(10)));
});
test("Statistics: all five real local ranges are usable; no numerical native/legacy equivalence is claimed",async t=>{
 const {service}=await setup(t);const ranges=policy.rangeEvidence(clock,Date.parse("2026-03-01T12:00:00+01:00"));
 assert.deepEqual(ranges.map(range=>range.key),["7d","30d","3m","1y","all"]);
 for(const range of ranges){assert(range.bins.length>0);assert(range.start<=clock);assert(range.end>clock);}
 const native=await service.read({backend:"native",operation:"history",selection:"legacy-statistics"});
 assert.equal(native.status,"unsupported");assert.equal(native.code,"HISTORY_LINEAGE_UNSUPPORTED");
});
test("Statistics local DST boundaries use actual calendar bins, not fixed 24h assumptions",()=>{
 const now=Date.parse("2026-03-30T12:00:00+02:00"),ranges=policy.rangeEvidence(now,Date.parse("2026-03-25T12:00:00+01:00"));
 const week=ranges[0];assert(week.bins.some(bin=>bin.end-bin.start===23*60*60*1000));
});
test("Oath candidates: open physical parents and actual active/future grouping differ from committed completed hydration",async t=>{
 const {service}=await setup(t);const candidates=await service.read({backend:"native",operation:"candidates",workspace:owners.private});
 assert(candidates.rows.some(task=>task.id===id(1)));assert(candidates.rows.some(task=>task.id===id(2)));
 assert(candidates.rows.every(task=>!task.completed&&!task.deletedAt));assert(!candidates.rows.some(task=>task.id===id(6)));
 const groups=policy.groups(candidates.rows,clock);assert(groups.future.some(task=>task.id===id(2)));
 assert(candidates.rows.find(task=>task.id===id(1)).steps.some(step=>step.parentStepId===id(101)));
});
test("Oath committed: actual oathProgress uses resolved current parents; missing/deleted aliases never auto-fulfill",async t=>{
 const {service}=await setup(t);const read=references=>service.read({backend:"native",operation:"committed",workspace:owners.private,references});
 const complete=policy.committedEvidence(await read([{kind:"native",id:id(3)}]));assert(complete.progress.allComplete);
 const missing=policy.committedEvidence(await read([{kind:"native",id:id(3)},{kind:"native",id:id(10)},{kind:"legacy-id",id:"legacy"}]));
 assert.equal(missing.progress.missing,2);assert.equal(missing.progress.allComplete,false);assert.match(missing.fulfillmentWriter,/unsupported/);
});
test("local endpoints retain date-only, midnight, missing endpoints and unknown completion instants",async t=>{
 const {tasks}=await setup(t),midnight=tasks.find(task=>task.id===id(1)),dateOnly=tasks.find(task=>task.id===id(4));
 assert.equal(policy.dateEvidence(midnight).dueTime,"00:00");assert.equal(policy.dateEvidence(dateOnly).dueTime,null);
 assert.equal(policy.dateEvidence(tasks.find(task=>task.id===id(6))).dueDate,null);
 assert.equal(tasks.find(task=>task.id===id(14)).completedAt,null);
});
test("N1 same-day date mismatch and recurrence remain explicit gaps without native coercion",()=>{
 const {validateTaskMetadata}=require("../domain/task-planning");
 assert.doesNotThrow(()=>validateTaskMetadata({fromDate:"2026-10-17",fromTime:"18:00",dueDate:"2026-10-17",dueTime:"09:00"}));
 const record=clone(dataset().tasks[0]);record.start={date:"2026-10-17",time:"18:00"};record.due={date:"2026-10-17",time:"09:00"};
 assert.throws(()=>taskView(record));const f=fixture();assert.equal(f.adapter.readiness().capabilities.features.recurrence.state,"unsupported");void f.service.close();
});
test("synthetic within-owner location update preserves UUID and independent Step ancestry/revision",async t=>{
 const {service,adapter}=await setup(t),record=adapter.snapshot().tasks.find(task=>task.id===id(1));
 adapter.replaceRecord({...record,revision:2,location:{type:"folder",id:"another-private-folder"}});
 const result=await service.read({backend:"native",operation:"target",handle:{kind:"native",id:record.id}});
 assert.equal(result.task.id,id(1));assert.equal(result.task.revision,2);assert.deepEqual(result.task.owner,owners.private);
 assert.equal(result.task.steps[1].parentStepId,id(101));assert.deepEqual(record.location,null);
});

