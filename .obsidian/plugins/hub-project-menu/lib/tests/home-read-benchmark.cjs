"use strict";
const { performance } = require("node:perf_hooks"), fs = require("node:fs");
const { createHomeFixture, originalHome, homeOwnerResolver } = require("./home-read-fixture.cjs");
const { createHomeTaskRead } = require("../services/home-task-read");
const { taskGroups } = require("../domain/task-planning");
const median = values => values.sort((a, b) => a-b)[Math.floor(values.length/2)];
async function timed(work, repeats = 7) { const values=[]; for(let i=0;i<repeats;i++){const start=performance.now();await work();values.push(performance.now()-start);} return +median(values).toFixed(3); }
const output=[];
(async()=>{for(const size of [100,1000,5000]){
    const f=createHomeFixture(); for(const page of f.pages.values()){page.file.tasks=[];page.file.lists=[];} for(const key of Object.keys(f.plugin.projectWizard.data.taskMetadata))delete f.plugin.projectWizard.data.taskMetadata[key];
    for(let i=0;i<size;i++){
        const owner=f.workspaces[i%f.workspaces.length], outside=i%13===0;
        const path=(outside?"Outside":owner.root)+"/Bench-"+(i%17)+".md";
        f.addTask(path,"Task "+i,"bench-"+i,{completed:i%11===0,metadata:{necessity:i%3===0?"must":null,fromDate:i%7===0?"2026-11-01":null},
            steps:i%5===0?[{title:"Step "+i,id:"step-"+i}]:[]});
        if(outside)f.pages.get(path).project="App";
    }
    const cleanups=[], make=()=>createHomeTaskRead({plugin:f.plugin,component:{register:fn=>cleanups.push(fn)},resolveOwner:homeOwnerResolver(f),changed(){},editTask(){}});
    const c=make(); let old, next;
    const originalCold=await timed(()=>{old=originalHome(f);});
    const newCold=await timed(async()=>{const x=make();next=await x.read();x.close();});
    await c.read();const sources=f.counts.sources;
    const originalCached=await timed(()=>{old=originalHome(f);});
    const cachedStart=f.counts.indexes,newCached=await timed(async()=>{next=await c.read();}),cachedScans=f.counts.indexes-cachedStart;
    const originalInvalidation=await timed(()=>{f.plugin.taskData.invalidateAll();f.flush();old=originalHome(f);});
    const invalidationStart=f.counts.indexes,newInvalidation=await timed(async()=>{f.plugin.taskData.invalidateAll();f.flush();next=await c.read();}),invalidationScans=f.counts.indexes-invalidationStart;
    const oldFilter=()=>[...old.projectTasks.filter(item=>item.owner.status==="active"&&!item.owner.deleted),...old.resourceTasks];
    const newFilter=()=>next.items.filter(item=>item.owner.contextKind==="resource"||item.owner.status==="active"&&!item.owner.deleted);
    const filtering=[await timed(oldFilter),await timed(newFilter)],preparation=[await timed(()=>taskGroups(oldFilter(),f.now())),await timed(()=>taskGroups(newFilter(),f.now()))];
    const mounts=[await timed(()=>{for(let i=0;i<3;i++)originalHome(f);}),await timed(async()=>{for(let i=0;i<3;i++){const x=make();await x.read();x.close();}})];
    const statuses=[await timed(()=>{f.projects[0].status=f.projects[0].status==="active"?"shelved":"active";old=originalHome(f);oldFilter();}),
        await timed(async()=>{f.projects[0].status=f.projects[0].status==="active"?"shelved":"active";next=await c.read();newFilter();})];
    const count=next.items.length;
    output.push({tasks:size,discoveredOwnedRows:count,ms:{cold:[originalCold,newCold],cached:[originalCached,newCached],invalidation:[originalInvalidation,newInvalidation],filtering,preparation,threeMounts:mounts,statusChanges:statuses},
        scans:{cachedSevenReads:cachedScans,sevenInvalidations:invalidationScans},identityPassesPerCold:{original:1,current:2},sourceReads:f.counts.sources-sources,writes:f.counts.writes,secondaryPanelWork:0});
    if(cachedScans||f.counts.sources-sources||f.counts.writes)throw Error("Benchmark violated read isolation");
    c.close();cleanups.forEach(fn=>fn());await f.close();
}console.log(JSON.stringify(output,null,2));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(output,null,2)+"\n");})().catch(error=>{console.error(error);process.exitCode=1;});
