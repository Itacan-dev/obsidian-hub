"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {fixture,facts,proposedBridge,workspaceRef}=require("./oath-candidate-fixture.cjs");
test("original candidate keys/order/full text and legacy read bridge preserve every workspace",async t=>{
 const f=fixture({original:true});t.after(()=>f.close());const baseline=require("./oath-candidate-baseline.json"),before=f.snapshot();
 for(const owner of f.owners){const tasks=f.read(workspaceRef(owner));assert.deepEqual(facts(tasks),baseline.find(b=>b.workspace.id===workspaceRef(owner).id).candidates);assert.deepEqual(facts(proposedBridge(tasks,owner)),facts(tasks));}
 assert.deepEqual(f.snapshot(),before);assert.equal(f.state.writes+f.counts.sources+f.counts.persists,0);
});
for(const mode of["parent","multiple","idless","same-title","steps","resource","copied","mounted","source-completed","source-title","source-moved","missing-dashboard","inactive","write-failure","persist-failure"])
test("separation gate: unchanged actual enrollment original / bridged "+mode,async t=>{
 const results=[];
 for(const bridged of[false,true]){
  const f=fixture({original:true});t.after(()=>f.close());let owner=f.owners[0],tasks=f.read(workspaceRef(owner));
  let selected=mode==="idless"?tasks.filter(t=>t.text==="ID-less"):mode==="same-title"?tasks.filter(t=>t.text==="Same title"):mode==="steps"?tasks.filter(t=>t.hubTaskId==="steps-parent"):mode==="multiple"?tasks.slice(0,3):tasks.filter(t=>t.hubTaskId==="parent");
  if(mode==="resource"){owner=f.owners.find(o=>o.resourceType==="study");selected=f.read(workspaceRef(owner));}
  if(mode==="copied")selected=f.plugin.taskData.readPages(f.dv).flatMap(p=>p.file.tasks).filter(t=>t.hubTaskId==="copied").slice(0,1);
  if(mode==="mounted"){owner=f.owners.find(o=>o.projectId==="itacan");selected=f.read({type:"resource",id:"study"});}
  if(bridged)selected=proposedBridge(selected,owner);
  const draft={...f.draft(selected),workspace:workspaceRef(owner)};
  if(mode==="source-completed"||mode==="source-title")f.contents.set(selected[0].path,f.contents.get(selected[0].path).replace("Parent **markdown**",mode==="source-title"?"Changed title":"Parent **markdown**").replace(mode==="source-completed"?"- [ ] Parent":"NEVER", "- [x] Parent"));
  if(mode==="source-moved")f.move(f.files.get(selected[0].path),"Resources/Knowledge/Moved.md");
  if(mode==="missing-dashboard")f.remove(f.files.get(owner.path));if(mode==="inactive")owner.status="shelved";
  if(mode==="write-failure")f.state.failWrite=true;if(mode==="persist-failure")f.failPersist(true);
  let error=null;try{await f.oath.take(draft);}catch(problem){error=problem.message;}
  results.push({error,source:Object.fromEntries(f.contents),metadata:f.wizard.data.taskMetadata,current:f.oath.current,saved:f.saved,writes:f.state.writes,persists:f.counts.persists});
 }
 assert.deepEqual(results[1],results[0]);
 if(["parent","multiple","idless","same-title","steps","resource"].includes(mode)){assert.equal(results[0].error,null);assert(results[0].current.tasks.length);for(const ref of results[0].current.tasks)assert.deepEqual(Object.keys(ref),["id","path","text"]);}
 else assert(results[0].error,"Unsafe enrollment must reject");
});
