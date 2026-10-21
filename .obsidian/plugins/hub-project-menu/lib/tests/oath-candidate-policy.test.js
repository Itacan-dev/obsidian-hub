"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {fixture,facts,workspaceRef}=require("./oath-candidate-fixture.cjs");
const {legacyReadTask}=require("../services/task-service-legacy-bridge"),{taskGroups}=require("../domain/task-planning");
async function candidates(f,owner){const q=await f.service.queryStructured({workspace:workspaceRef(owner),policy:"oath-candidates",validation:"indexed"});const groups=taskGroups(q.rows.filter(r=>r.state==="indexed"&&r.view).map(r=>legacyReadTask(r.view)),new Date(f.now));return{q,tasks:[...groups.active,...groups.future]};}
for(const id of["private","itacan","hub","resource:study","resource:literature","resource:references","resource:inspiration"])
test("real shared facade policy equals original complete candidate identities/groups: "+id,async t=>{
 const f=fixture();t.after(()=>f.close());const owner=f.owners.find(o=>o.projectId===id),before=f.snapshot(),{q,tasks}=await candidates(f,owner);
 assert.equal(q.policy,"oath-candidates");assert.equal(q.complete,true);assert.deepEqual(facts(tasks),facts(f.read(workspaceRef(owner))));assert.deepEqual(f.snapshot(),before);assert.equal(f.counts.sources+f.state.writes+f.counts.persists,0);
});
for(const id of["future-project","shelved","deleted"])test("facade rejects unavailable/ineligible workspace: "+id,async t=>{const f=fixture();t.after(()=>f.close());await assert.rejects(candidates(f,f.owners.find(o=>o.projectId===id)),{code:"REFERENCE_UNRESOLVED"});});
test("global parent/Step collisions and same-title temporary keys preserve Oath-specific rules",async t=>{
 const f=fixture();t.after(()=>f.close());const {q,tasks}=await candidates(f,f.owners[0]);
 assert(!tasks.some(t=>["copied","parent-step"].includes(t.hubTaskId)));assert(tasks.some(t=>t.hubTaskId==="steps-parent"));assert.equal(tasks.filter(t=>t.text==="Same title").length,2);
 assert(q.diagnostics.some(d=>d.code==="OATH_STEP_ID_COPIED"));assert.equal(f.counts.queries,1);
});
test("every actual facade candidate enrolls identically through unchanged original take",async t=>{
 const results=[];for(const useFacade of[false,true]){const f=fixture({original:true});t.after(()=>f.close());const tasks=useFacade?(await candidates(f,f.owners[0])).tasks:f.read(workspaceRef(f.owners[0]));await f.oath.take(f.draft(tasks));results.push({snapshot:f.snapshot(),saved:f.saved,current:f.oath.current});}assert.deepEqual(results[1],results[0]);
});
test("indexed candidate reads never enable generic Oath visibility or source validation",async t=>{const f=fixture();t.after(()=>f.close());await assert.rejects(f.service.queryStructured({policy:"oath-candidates",workspace:{type:"project",id:"private"},validation:"source"}),{code:"VALIDATION"});await assert.rejects(f.service.queryVisible({type:"project",id:"private"},{policy:"oath"}),{code:"UNSUPPORTED"});});
module.exports={candidates};
test("mounted Resource navigation allowance never grants Project candidate eligibility",async t=>{const f=fixture();t.after(()=>f.close());const itacan=f.owners.find(o=>o.projectId==="itacan");f.wizard.data.oathsByDevice={"candidate-device":{current:{id:"active",state:"active",workspace:workspaceRef(itacan),tasks:[],durationMs:1500000,startedAt:f.now},history:[]}};assert.equal(f.oath.projectWorkspaceForPath("Resources/Knowledge/Mounted/Tasks.md"),itacan);const {tasks}=await candidates(f,itacan);assert(tasks.every(task=>task.path.startsWith(itacan.root+"/")));});
test("Resource dashboard removal and root rename retain original candidate policy",async t=>{const f=fixture();t.after(()=>f.close());const owner=f.owners.find(o=>o.resourceType==="study"),file=f.files.get(owner.path);f.remove(file);await assert.rejects(candidates(f,owner),{code:"REFERENCE_UNRESOLVED"});f.add(owner.path,"");const oldRoot=owner.root;owner.root="Resources/Renamed Knowledge";owner.path=owner.root+"/Knowledge.md";f.move(f.files.get(oldRoot+"/Knowledge.md"),owner.path);f.move(f.files.get(oldRoot+"/Mounted/Tasks.md"),owner.root+"/Mounted/Tasks.md");assert.deepEqual(facts((await candidates(f,owner)).tasks),facts(f.read(workspaceRef(owner))));});
