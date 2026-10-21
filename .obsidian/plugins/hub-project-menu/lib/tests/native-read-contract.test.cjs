"use strict";
const {test,after}=require("node:test"),assert=require("node:assert/strict");
const {fixture,dataset,taskView,eventView,owners,id,clone,clock}=require("./native-read-fixture.cjs");
const {READ_FEATURES}=require("../services/task-read-contract");
const {TaskService}=require("../services/task-service");
const {fixture:legacyFixture,restoreObsidianStub}=require("./task-service-fixture.cjs");
after(restoreObsidianStub);
async function setup(t,options){const f=fixture(options);t.after(()=>f.service.close());return f;}
const read=(service,operation,rest={})=>service.read({backend:"native",operation,...rest});
test("source-independent native readiness reports only actual capabilities",async t=>{
 const {service}=await setup(t);const ready=await service.readiness(["source-independent","mutation","presentation","imported-lineage"]);
 assert.equal(ready.state,"ready");assert.deepEqual(ready.missing,["mutation","presentation","imported-lineage"]);
 assert.equal(ready.capabilities.features["source-independent"].state,"supported");
 assert.equal(service.capabilities().guarantees.persistentIdempotency,false);
 assert.equal(service.capabilities().guarantees.completion,"unsupported");
 assert(Object.values(service.capabilities().operations).every(value=>value===false));
 await assert.rejects(()=>service.createTask({}),e=>e.code==="UNSUPPORTED");
});
for(const state of ["not-ready","unavailable","recovering","unsupported"])test("native readiness explicitly represents "+state,async t=>{
 const {service}=await setup(t,{state});assert.equal((await service.readiness()).state,state);
 const result=await read(service,"structured");assert.equal(result.status,state==="unsupported"?"unsupported":"unavailable");
 assert.equal("rows" in result,false);
});
test("legacy readiness distinguishes missing and initialized Dataview without changing existing wire",async t=>{
 const f=legacyFixture();t.after(()=>f.close());f.add("Projects/Private/Read.md","- [ ] Legacy <!-- hub-task:legacy-read -->");
 assert.equal((await f.service.readiness()).state,"ready");
 const old=await f.service.queryStructured({policy:"panel",workspace:owners.private});
 const wrapped=await f.service.read({backend:"legacy-markdown",operation:"structured",options:{policy:"panel",workspace:owners.private}});
 assert.equal(wrapped.backend,"legacy-markdown");assert.deepEqual(wrapped.data,old);assert.equal("backend" in old,false);
 const {LegacyTaskAdapter}=require("../services/task-service-legacy");
 for(const dataview of [null,{pages(){},index:{initialized:false}}]){
  const service=new TaskService(new LegacyTaskAdapter({plugin:f.plugin,dataview:()=>dataview}));
  assert.equal((await service.readiness()).state,"not-ready");
  const result=await service.read({backend:"legacy-markdown",operation:"structured"});
  assert.equal(result.status,"unavailable");assert.equal(result.code,"BACKEND_NOT-READY");await service.close();
 }
});
test("unknown backend/request/readiness discriminators fail safely",async t=>{
 const f=await setup(t);await assert.rejects(()=>f.service.read({backend:"mystery",operation:"structured"}),e=>e.code==="VALIDATION");
 await assert.rejects(()=>f.service.read({backend:"native",operation:"visibleTasks"}),e=>e.code==="VALIDATION");
 await assert.rejects(()=>f.service.readiness(["imaginary"]),e=>e.code==="VALIDATION");
 const adapter={capabilities:()=>({backend:"unknown"}),subscribe(){},async close(){}};
 const service=new TaskService(adapter);await assert.rejects(()=>service.readiness(),e=>e.code==="VALIDATION");await service.close();
 const bad=await setup(t,{state:"mystery"});await assert.rejects(()=>bad.service.readiness(),e=>e.code==="VALIDATION");
});
test("a facade never falls back or accepts cross-backend requests",async t=>{
 const {service,adapter}=await setup(t);
 const mismatch=await service.read({backend:"legacy-markdown",operation:"history"});
 assert.equal(mismatch.status,"unsupported");assert.equal(mismatch.code,"BACKEND_MISMATCH");assert.equal(adapter.counts.reads,0);
 await assert.rejects(()=>service.resolveLegacyAction({kind:"native",id:id(1)}),e=>e.code==="UNSUPPORTED");
});
for(const operation of ["history","committed","navigation"])test("partial task adapter cannot claim "+operation,async t=>{
 const {service}=await setup(t,{unsupportedOperations:[operation]});
 assert.equal((await read(service,"structured")).status,"ok");
 const result=await read(service,operation);assert.equal(result.status,"unsupported");assert.equal("rows" in result,false);
 const feature={history:"history",committed:"oath-committed",navigation:"navigation"}[operation];
 assert.deepEqual((await service.readiness([feature])).missing,[feature]);
});
test("native IDs do not imply navigation or imported completion lineage",async t=>{
 const {service}=await setup(t,{unsupportedFeatures:["navigation"]});
 assert((await read(service,"structured")).rows.length>0);
 assert.equal((await read(service,"navigation",{handle:{kind:"native",id:id(1)},mode:"task"})).status,"unsupported");
 for(const selection of ["legacy-statistics","current-bindings"]){
  const result=await read(service,"history",{selection});assert.equal(result.status,"unsupported");assert.equal(result.code,"HISTORY_LINEAGE_UNSUPPORTED");
 }
});
test("native tasks/Steps preserve real record fields without any Markdown evidence",async t=>{
 const {service}=await setup(t);const result=await read(service,"structured");
 const task=result.rows.find(task=>task.id===id(1)),record=dataset().tasks[0];
 assert.equal(task.kind,"native-task-read");assert.deepEqual(task.handle,{kind:"native",id:record.id});
 assert.deepEqual(task.due,{date:"2026-10-17",time:"00:00"});assert.equal(task.completedAt,null);assert.equal(task.revision,1);
 assert.equal(task.steps[1].parentStepId,task.steps[0].id);assert.equal(task.steps[2].order,1);
 for(const item of [task,...task.steps])for(const key of ["path","line","hubTaskId","file","block","source","legacy"])assert.equal(Object.hasOwn(item,key),false);
 assert.equal(result.rows.filter(task=>task.title==="Same title").length,2);
 assert.equal(result.rows.find(task=>task.id===id(14)).completedAt,null);
});
test("native projections are detached and immutable through facade and cached sessions",async t=>{
 const {service,adapter}=await setup(t);const result=await read(service,"structured");assert(Object.isFrozen(result.rows[0].steps));
 assert.throws(()=>{result.rows[0].owner.id="changed";},TypeError);
 assert.throws(()=>{result.rows[0].steps[1].parentStepId=null;},TypeError);
 assert.equal(adapter.snapshot().tasks[0].owner.id,"private");assert.equal((await read(service,"structured")).rows[0].revision,1);
 const direct=await adapter.read({backend:"native",operation:"structured"});direct.rows[0].title="Detached";
 assert.equal(adapter.snapshot().tasks[0].title,"Same title");
});
test("structural native validators reject fake owners, bad ancestry and unknown fields",()=>{
 for(const patch of [{owner:{type:"project",id:""}},{path:"native.md"},{linkedProjectId:"itacan"},{start:{date:"2026-10-17",time:"18:00"},due:{date:"2026-10-17",time:"09:00"}}])
  assert.throws(()=>taskView({...dataset().tasks[0],...patch}));
 const task=dataset().tasks[0];task.steps[1].parentStepId=id(999);assert.throws(()=>taskView(task));
 assert.throws(()=>taskView({...dataset().tasks[0],id:"legacy-non-uuid"}));
 const duplicate=dataset();duplicate.tasks[1].id=duplicate.tasks[0].id;assert.throws(()=>fixture({data:duplicate}),/identity conflict/);
 const badHistory=dataset();badHistory.history[0].partitionId="project-private";assert.throws(()=>fixture({data:badHistory}),/historical owner\/partition mismatch/);
});
test("retained and counted native History remain explicit and separate from current tasks",async t=>{
 const {service}=await setup(t),data=dataset();
 const retained=await read(service,"history",{selection:"retained"}),counted=await read(service,"history",{selection:"counted"});
 assert.equal(retained.rows.length,5);assert.equal(counted.rows.length,4);assert(retained.rows.some(event=>!event.counted&&event.reopenedAt));
 assert.deepEqual(retained.rows.map(event=>event.eventId),data.history.map(event=>event.id));
 const event=retained.rows[1];assert.deepEqual(event.ownerAtEvent,owners.itacan);assert.deepEqual(event.workingContext,owners.private);
 assert.equal(event.snapshot.title,"Original recorded title");assert.equal(retained.rows[4].relationship,"historical-only");
 assert.equal(retained.rows[4].taskId,null);assert.equal(retained.rows[3].timestamp,null);assert.equal(retained.rows[3].taskId,id(10));
 assert.match(retained.counting,/not legacy Statistics parity/);
 const deleted=(await read(service,"structured",{includeDeleted:true})).rows.find(task=>task.id===id(10));
 assert(deleted.deletedAt);assert.equal(eventView(data.history[0]).eventId,data.history[0].id);
});
test("legacy recorded primitives/duplicates/diagnostics retain their original projection",async t=>{
 const f=legacyFixture();t.after(()=>f.close());f.wizard.completedTaskHistory=[
  {text:"Recorded",path:"Old.md",id:0,timestamp:null,project:"Fallback"},
  {text:"Recorded",path:"Old.md",id:"same",timestamp:1},
  {text:"Recorded",path:"Old.md",id:"same",timestamp:2},
  {text:"Partial",path:"Old.md",id:false},
 ];
 const before=clone(f.wizard.completedTaskHistory),old=await f.service.queryHistory({projection:"recorded"});
 const wrapped=await f.service.read({backend:"legacy-markdown",operation:"history"});
 assert.deepEqual(wrapped.data,old);assert.deepEqual(f.wizard.completedTaskHistory,before);
 assert.equal(wrapped.data.rows[0].fact.recorded.id,0);assert.equal(wrapped.data.rows.length,4);
 assert.equal(Object.hasOwn(wrapped.data.rows[3].fact.recorded,"timestamp"),false);
});
test("native commitments resolve completed and inactive-owned parents, not setup candidates",async t=>{
 const {service}=await setup(t);const references=[{kind:"native",id:id(3)},{kind:"native",id:id(10)},{kind:"native",id:id(999)},{kind:"native",id:id(6)},{kind:"legacy-id",id:"old-id"}];
 const result=await read(service,"committed",{workspace:owners.private,references});
 assert.deepEqual(result.rows.map(row=>row.state),["resolved","deleted","missing","owner-mismatch","unsupported-alias"]);
 assert(result.rows[0].task.completed);assert.equal(result.rows[4].task,null);assert.deepEqual(result.rows.map(row=>row.reference),references);
 const inactive=await read(service,"committed",{workspace:owners.shelved,references:[{kind:"native",id:id(12)}]});
 assert.equal(inactive.rows[0].state,"resolved");
 assert.equal((await read(service,"candidates",{workspace:owners.shelved})).status,"unavailable");
});
test("native navigation distinguishes root/task, folder, note, none and missing context",async t=>{
 const {service}=await setup(t);
 const nav=(n,mode)=>read(service,"navigation",{handle:{kind:"native",id:id(n)},mode});
 assert.deepEqual((await nav(1,"task")).target,{kind:"native-task",id:id(1)});
 assert.equal((await nav(1,"location")).state,"none");
 assert.equal((await nav(4,"location")).target.location.type,"folder");assert.equal((await nav(5,"location")).target.location.type,"note");
 assert.equal((await nav(11,"location")).state,"missing-location");assert.equal((await nav(10,"task")).state,"deleted-task");
 assert.equal((await nav(1,"provenance")).state,"none");
 const data=dataset();data.provenance=[{taskId:id(1),source:{kind:"recorded-legacy-note",path:"Historical/Recorded.md",line:7}}];
 const explicit=await setup(t,{data});const evidence=await read(explicit.service,"navigation",{handle:{kind:"native",id:id(1)},mode:"provenance"});
 assert.equal(evidence.target.kind,"historical-provenance");assert.equal(evidence.target.source.path,"Historical/Recorded.md");
 assert.equal((await read(explicit.service,"structured")).rows[0].location,null);
});
test("native saved targets use IDs and report missing Step/task without source locators",async t=>{
 const {service}=await setup(t);
 assert.equal((await read(service,"target",{handle:{kind:"native",id:id(1)},stepId:id(102)})).step.parentStepId,id(101));
 assert.equal((await read(service,"target",{handle:{kind:"native",id:id(1)},stepId:id(999)})).state,"missing-step");
 assert.equal((await read(service,"target",{handle:{kind:"native",id:id(999)}})).state,"missing");
});
test("no native adapter result may smuggle an unknown variant or fabricated source",async t=>{
 const {adapter}=await setup(t);const realRead=adapter.read.bind(adapter);
 for(const change of [r=>({...r,backend:"mystery"}),r=>({...r,operation:"history"}),r=>({...r,rows:[{...r.rows[0],path:"native.md",line:0}]}),
  r=>({...r,rows:[{...r.rows[0],kind:"mystery"}]})]){
  adapter.read=async request=>change(await realRead(request));
  const service=new TaskService(adapter);await assert.rejects(()=>read(service,"structured"),e=>e.code==="VALIDATION");
 }
 adapter.read=realRead;
});
test("new readiness requires an actual native read port, never just advertised support",async()=>{
 const {adapter,service}=fixture();const capabilities=adapter.readiness();
 const liar=new TaskService({capabilities:()=>adapter.capabilities(),readiness:()=>capabilities,subscribe:()=>()=>{},async close(){}});
 await assert.rejects(()=>liar.readiness(),e=>e.code==="VALIDATION");await liar.close();await service.close();
});
test("fresh native module graph and real reads deny platform, storage and Dataview dependencies",()=>{
 const code = `const Module=require("node:module"),original=Module._load;
 Module._load=function(name,...args){if(/^(?:node:)?(?:fs(?:\\/promises)?|electron|obsidian|dataview)$/.test(name))throw Error("Forbidden dependency: "+name);return original.call(this,name,...args);};
 (async()=>{const {fixture,owners,id}=require(${JSON.stringify(require.resolve("./native-read-fixture.cjs"))}),f=fixture();
 const ready=await f.service.readiness(["source-independent"]);if(ready.state!=="ready"||ready.missing.length)throw Error("Not independently ready");
 for(const request of [{operation:"structured"},{operation:"history",selection:"retained"},
 {operation:"committed",workspace:owners.private,references:[{kind:"native",id:id(3)}]},
 {operation:"navigation",handle:{kind:"native",id:id(1)},mode:"task"}]){
 const result=await f.service.read({backend:"native",...request});if(result.status!=="ok")throw Error("Read failed");}
 await f.service.close();process.stdout.write("independent-native-reads-ok");
 })().catch(e=>{process.stderr.write(e.stack);process.exitCode=1;});`;
 const output=require("node:child_process").execFileSync(process.execPath,["-e",code],{encoding:"utf8",env:{...process.env,ELECTRON_RUN_AS_NODE:"1"}});
 assert.equal(output,"independent-native-reads-ok");
});
test("native navigation and History reject unknown nested variants and fabricated source targets",async t=>{
 const {adapter,service}=await setup(t),original=adapter.read.bind(adapter);
 adapter.read=async request=>{const result=await original(request);return {...result,target:{kind:"native-task",id:id(1),path:"native.md",line:0}};};
 await assert.rejects(()=>read(service,"navigation",{handle:{kind:"native",id:id(1)},mode:"task"}),e=>e.code==="VALIDATION");
 adapter.read=async request=>{const result=await original(request);return {...result,rows:[{...result.rows[0],kind:"unknown-history"}]};};
 await assert.rejects(()=>read(service,"history",{selection:"retained"}),e=>e.code==="VALIDATION");
 adapter.read=original;
});
test("readiness returns detached maps and legacy/native unsupported distinctions",async t=>{
 const {service}=await setup(t);const ready=await service.readiness();ready.capabilities.features.mutation.state="supported";
 assert.equal((await service.readiness()).capabilities.features.mutation.state,"unsupported");
 assert.deepEqual(Object.keys(ready.capabilities.features),[...READ_FEATURES]);
});

