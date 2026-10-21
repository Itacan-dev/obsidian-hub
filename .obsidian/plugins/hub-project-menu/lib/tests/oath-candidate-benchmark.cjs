"use strict";
const {performance}=require("node:perf_hooks"),fs=require("node:fs"),assert=require("node:assert/strict");
const {fixture,workspaceRef}=require("./oath-candidate-fixture.cjs"),{createOathCandidateRead}=require("../services/oath-candidate-read"),{taskGroups}=require("../domain/task-planning");
async function measure(work){const samples=[];for(let i=0;i<7;i++){const start=performance.now();await work();samples.push(performance.now()-start);}return +samples.sort((a,b)=>a-b)[3].toFixed(3);}
(async()=>{const base=fixture(),baseSize=base.plugin.taskData.readPages(base.dv).flatMap(p=>p.file.tasks).length;await base.close();const results=[];
 for(const size of[100,1000,5000]){const f=fixture({count:size-baseSize});
  const missing={task:true,path:"Projects/Private/Missing.md",line:0,text:"Stale missing source",completed:false,children:[]};f.pages.set(missing.path,{file:{path:missing.path,tasks:[missing],lists:[missing]}});
  const moved=[...f.files.values()].find(file=>file.path.endsWith("/Synthetic-0.md"));f.move(moved,"Resources/Knowledge/Moved/Synthetic-0.md");assert.equal(f.plugin.taskData.readPages(f.dv).flatMap(page=>page.file.tasks).length,size);
  const cleanup=[],reader=createOathCandidateRead(f.oath,{register:fn=>cleanup.push(fn)}),ref={type:"project",id:"private"};
  const original=await measure(()=>f.read(ref)),cold=await measure(()=>reader.selectWorkspace({type:"resource",id:"study"}).then(()=>reader.selectWorkspace(ref)));
  await reader.selectWorkspace(ref);const cachedBefore={...f.counts},cached=await measure(()=>reader.read());assert.deepEqual(f.counts,cachedBefore);
  const refresh=await measure(()=>reader.retry()),selected=reader.tasks().slice(0,2),draft=f.draft(selected),selectionRefresh=await measure(async()=>{await reader.retry();reader.enrollmentDraft(draft);});
  const prepared=await measure(()=>taskGroups(reader.state.tasks,new Date(f.now))),beforeClock={...f.counts};for(let i=0;i<10;i++){f.oath.tickDisplay();reader.requirements(draft);}assert.deepEqual(f.counts,beforeClock);
  const beforeQuery=f.counts.queries,facade=await measure(()=>f.service.queryStructured({policy:"oath-candidates",workspace:ref,validation:"indexed"}));assert.equal(f.counts.queries-beforeQuery,7);
  assert.equal(f.counts.sources+f.state.writes+f.counts.persists,0);results.push({tasks:size,ms:{original,facade,coldTwoWorkspaceReads:cold,cached,refresh,selectionRefresh,groupPreparation:prepared},cachedDataviewScans:0,countdownDataviewScans:0,dataviewScansPerQuery:1,identityPassesPerQuery:2,sourceReads:0,writes:0});cleanup.forEach(fn=>fn());await f.close();
 }if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(results,null,2)+"\n");console.log(JSON.stringify(results,null,2));})().catch(error=>{console.error(error);process.exitCode=1;});
