"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {fixture}=require("./task-service-fixture.cjs");
const {historyRecords}=require("../services/task-history-read");
const {readStatistics}=require("../services/statistics");
const clean=records=>records.map(({historyReadKey,...record})=>record);
const source="- [ ] Parent <!-- hub-task:writer-parent -->\n    - [ ] First <!-- hub-task:writer-first -->\n        - [ ] Nested <!-- hub-task:writer-nested -->\n    - [ ] Last <!-- hub-task:writer-last -->\n- [ ] Following <!-- hub-task:writer-following -->\n";
for(const operation of["complete","reopen","recomplete","step","step-reopen","nested-step","parent-after-steps","multiple-steps","edit","delete","clear","clear-nested","note-move","cross-owner-move","recurrence","idless","history-failure"])
test("recorded read preserves actual "+operation+" writer state, original History outputs and Statistics inputs",async t=>{
    const now=Date.now;Date.now=()=>1793000000000;t.after(()=>{Date.now=now;});
    const f=fixture();t.after(()=>f.close());f.plugin.taskService=f.service;
    const file=f.add("Projects/Private/Tasks.md",operation==="idless"?"- [ ] Parent\n":source);
    Object.setPrototypeOf(file,require("obsidian").TFile.prototype);
    f.metadataCache.getFileCache=()=>({});f.wizard.activityLog=[];
    Object.assign(f.wizard,{projectWorkRatings:{},projectWorkLogs:{},resourceWorkRatings:{},resourceWorkLogs:{}});
    const toggle=completed=>f.plugin.toggleTask(file.path,0,"Parent",completed,operation==="idless"?null:"writer-parent");
    const step=(line,text,id,completed)=>f.plugin.mutateTask({path:file.path,line:0,text:"Parent",hubTaskId:"writer-parent",operation:"step",step:{line,text,hubTaskId:id},stepCompleted:completed});
    async function compare(){
        const before=JSON.stringify(f.snapshot()),state={...f.state},statistics=await readStatistics(f.plugin,1793000000000);
        assert.deepEqual(statistics,require("./statistics-read-service-original.cjs").readStatistics(f.plugin,1793000000000),"Actual writer output retains original Statistics semantics");
        const original=f.wizard.getCompletedTaskHistory(),actual=clean(historyRecords(await f.service.queryHistory({projection:"recorded"})));
        assert.deepEqual(actual,original);assert.equal(JSON.stringify(f.snapshot()),before);assert.deepEqual(f.state,state);
        assert.deepEqual(await readStatistics(f.plugin,1793000000000),statistics);
        return actual;
    }
    await compare();
    if(operation==="step-reopen"){await step(1,"First","writer-first",true);assert.equal((await compare()).length,1);await step(1,"First","writer-first",false);assert.equal((await compare()).length,0);return;}
    if(["step","nested-step","parent-after-steps","multiple-steps","clear-nested"].includes(operation)){
        await step(operation==="nested-step"?2:1,operation==="nested-step"?"Nested":"First",operation==="nested-step"?"writer-nested":"writer-first",true);await compare();
        if(operation==="multiple-steps"||operation==="clear-nested"){await step(2,"Nested","writer-nested",true);await compare();}
        if(operation==="step"||operation==="nested-step"||operation==="multiple-steps")return;
    }
    if(operation==="recurrence")f.plugin.app.plugins.plugins["obsidian-tasks-plugin"]={apiV1:{executeToggleTaskDoneCommand:line=>line.replace("[ ]","[x]")+"\n- [ ] Next occurrence"}};
    if(operation==="history-failure")f.state.failHistory=true;
    await toggle(true);let recorded=await compare();
    if(operation==="history-failure"){assert.equal(recorded.length,0);assert(f.contents.get(file.path).includes("[x] Parent"));return;}
    if(operation==="reopen"||operation==="recomplete"){
        const id=recorded[0].id;await toggle(false);assert.equal((await compare()).length,0);
        if(operation==="recomplete"){await toggle(true);recorded=await compare();assert.equal(recorded.length,1);assert.notEqual(recorded[0].id,id);}return;
    }
    if(operation==="parent-after-steps")assert.equal(recorded.filter(record=>record.kind==="step").length,1);
    if(operation==="edit"){
        const before=recorded[0].text;await f.plugin.mutateTask({path:file.path,line:0,text:"Parent",hubTaskId:"writer-parent",operation:"edit",value:"Changed live title"});recorded=await compare();assert.equal(recorded[0].text,before);
    }
    if(operation==="delete"){
        const before=JSON.stringify(recorded);await f.plugin.mutateTask({path:file.path,line:0,text:"Parent",hubTaskId:"writer-parent",operation:"delete"});assert.equal(JSON.stringify(await compare()),before);
    }
    if(operation==="clear"||operation==="clear-nested"){
        const before=JSON.stringify(recorded);await f.plugin.clearCompletedTasks([{path:file.path,line:0,text:"Parent",hubTaskId:"writer-parent",projectId:"private"}],false);
        assert.equal(JSON.stringify(await compare()),before);assert(!f.contents.get(file.path).includes("Parent"));assert(f.contents.get(file.path).includes("Following"));
    }
    if(operation==="note-move"||operation==="cross-owner-move"){
        const before=JSON.stringify(recorded);f.move(file,operation==="note-move"?"Projects/Private/Renamed.md":"Resources/Knowledge/Moved.md");assert.equal(JSON.stringify(await compare()),before);
    }
});
for(const owner of["private","itacan","hub","resource:study"])test("recorded reads retain actual "+owner+" completion partition/owner evidence without writes",async t=>{
    const f=fixture();t.after(()=>f.close());const context=f.owners.find(item=>item.projectId===owner),file=f.add(context.root+"/Tasks.md",source);
    await f.plugin.toggleTask(file.path,0,"Parent",true,"writer-parent");const before=JSON.stringify(f.snapshot()),state={...f.state};
    const records=clean(historyRecords(await f.service.queryHistory({projection:"recorded"})));
    assert.equal(records[0].projectId,owner);assert.equal(records[0].contextKind,context.contextKind);assert.equal(records[0].resourceType,context.resourceType??null);
    assert.equal(JSON.stringify(f.snapshot()),before);assert.deepEqual(f.state,state);
});
for(const physical of["private","resource:study"])test("legacy clear archive retains recorded presentation attribution and creates no task/Step identity: "+physical,async t=>{
    const f=fixture();t.after(()=>f.close());const owner=f.owners.find(item=>item.projectId===physical),presentation=f.owners[0];
    const file=f.add(owner.root+"/Legacy.md","- [x] Externally checked\n    - [x] Recorded only as source Step\n- [ ] Following\n");
    Object.setPrototypeOf(file,require("obsidian").TFile.prototype);
    await f.plugin.clearCompletedTasks([{path:file.path,line:0,text:"Externally checked",projectId:presentation.projectId,projectName:presentation.name,
        projectStatus:presentation.status,projectPath:presentation.path,projectRoot:presentation.root,contextKind:"project",resourceType:null}],false);
    const before=JSON.stringify(f.snapshot()),state={...f.state},query=await f.service.queryHistory({projection:"recorded"});
    assert.equal(query.rows.length,1);const fact=query.rows[0].fact;assert.equal(fact.kind,"task");assert.equal(fact.taskIdentity,null);
    assert.equal(fact.recorded.projectId,"private");assert.equal(fact.recorded.path,file.path);assert(Number.isFinite(fact.recorded.archivedAt));
    assert(!Object.hasOwn(fact.recorded,"kind")&&!Object.hasOwn(fact.recorded,"hubTaskId"));
    assert.deepEqual(clean(historyRecords(query)),f.wizard.getCompletedTaskHistory());assert.equal(f.contents.get(file.path),"- [ ] Following\n");
    assert.equal(JSON.stringify(f.snapshot()),before);assert.deepEqual(f.state,state);
});
