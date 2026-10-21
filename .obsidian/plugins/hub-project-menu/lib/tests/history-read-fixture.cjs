"use strict";
const fs = require("node:fs"), path = require("node:path");
const { fixture } = require("./task-service-fixture.cjs");
const { historyKind } = require("../domain/history");
const root = path.resolve(__dirname, "../../../../..");
function between(source, start, end) { const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<a)throw Error("Missing original History boundary: "+start);return source.slice(a,b); }
function createHistoryFixture(count = 135) {
    const f=fixture(), registrations=[];
    f.plugin.taskService=f.service;f.plugin.register=fn=>registrations.push(fn);
    for(const [projectId,name,status]of[["future","Future","future"],["shelved","Shelved","shelved"],["deleted","Deleted","active"]])f.owners.push({projectId,name,status,deleted:projectId==="deleted",root:"Projects/"+name,path:`Projects/${name}/${name}.md`,contextKind:"project"});
    for(const[resourceType,name]of[["literature","Research"],["references","Explorations"],["inspiration","Inspiration"]])f.owners.push({projectId:"resource:"+resourceType,resourceType,name,contextKind:"resource",root:"Resources/"+name,path:`Resources/${name}/${name}.md`});
    for(const owner of f.owners)Object.assign(owner,{id:owner.resourceType??owner.projectId,label:owner.name,sourcePath:owner.path});
    const at=Date.parse("2026-10-25T00:30:00+02:00"), records=[];
    for(let i=0;i<count;i++){
        const owner=i<80?f.owners[0]:f.owners[(i-80)%f.owners.length];
        const step=i%3===0;
        records.push({id:"event-"+i,kind:step?"step":"task",hubTaskId:step?"step-"+(i%5):"task-"+(i%7),...(step?{parentTaskId:"task-parent",parentText:"Original **parent**"}:{}),
            text:(step?"Completed Step ":"Completed task ")+i+(i%11===0?"\nrecorded continuation":""),timestamp:at+i*900000,path:owner.root+(i%8===0?"/Deleted.md":"/Tasks.md"),line:i,
            projectId:owner.projectId,projectName:"Recorded "+owner.name,projectStatus:"active",projectPath:owner.path,projectRoot:owner.root,contextKind:owner.contextKind,resourceType:owner.resourceType??null});
    }
    records.push(
        {text:"Legacy missing identity",path:"Projects/Private/Tasks.md",timestamp:at,projectRoot:"Projects/Private",projectName:"Recorded private"},
        {id:null,kind:null,text:"Explicit null identity",path:"Projects/Private/Tasks.md",timestamp:null,projectId:null,projectPath:"Projects/Private/Private.md"},
        {id:"noncanonical/event",hubTaskId:"inbox-task-old",text:"String timestamp",path:"Projects/Itacan/Missing.md",timestamp:String(at),archivedAt:at+1,projectId:"itacan",projectName:"Original Itacan"},
        {id:"presentation",text:"Recorded presentation conflict",path:"Resources/Knowledge/Tasks.md",timestamp:at,projectId:"private",projectName:"Recorded Private",projectRoot:"Projects/Private",contextKind:"project",resourceType:null},
        {id:"resource-clear",text:"Legacy Resource clear",path:"Resources/Research/Tasks.md",timestamp:at,projectId:null,projectName:"Research before rename",projectRoot:"Resources/Research",contextKind:"resource",resourceType:"literature"},
        {id:"resource-prefix",text:"Resource prefix convention",path:"Resources/Knowledge/Tasks.md",timestamp:at,projectId:"resource:study"},
        {id:"root-fallback",text:"Resource root fallback",path:"Outside/Recorded.md",timestamp:at,projectRoot:"Resources/Explorations"},
        {id:"missing-name",text:"No historical owner name",path:"Outside/Recorded.md",timestamp:at},
        {id:"missing-time",text:"No recorded timestamp",path:"Outside/Recorded.md",projectId:"private"}
    );
    records.push({...records[0]}, {...records[1],id:"distinct-event-same-task"});
    f.wizard.completedTaskHistory=records;f.wizard.data.completedTaskHistory=records;
    f.add("Projects/Private/Tasks.md","- [ ] Current unrelated title <!-- hub-task:current -->\n");
    for(const owner of f.owners)if(owner.contextKind==="resource")f.add(owner.root+"/Tasks.md","# Current unrelated Resource source\n");
    const counts={history:0,index:0,sources:0,writes:0};
    const original=f.wizard.getCompletedTaskHistory.bind(f.wizard);
    f.wizard.getCompletedTaskHistory=(...args)=>{counts.history++;return original(...args);};
    const read=f.vault.read;f.vault.read=(...args)=>{counts.sources++;return read(...args);};
    const pages=f.plugin.taskData.readPages.bind(f.plugin.taskData);f.plugin.taskData.readPages=(...args)=>{counts.index++;return pages(...args);};
    return {...f,records,counts,registrations};
}
function originalItems(records,kind,owner=null){
    const source=fs.readFileSync(path.join(__dirname,kind==="home"?"history-read-home-original.cjs":"history-read-project-original.cjs"),"utf8");
    const fn=kind==="home"?"function renderCompletedTaskHistory()":"function renderProjectTaskHistory()";
    const body=between(source,fn,kind==="home"?"function renderActiveProgressView()":"function renderProjectProgressView()");
    const start=body.indexOf("    const items ="),end=body.indexOf("    if (items.length",start);
    return new Function("window","completedTaskHistory","historyKind","progressScope","isResourceContext","current","projectRoot",body.slice(start,end)+";return items;")(
        {hubGetCompletedTaskHistory:()=>records},records,historyKind,owner??"projects",owner?.contextKind==="resource",owner&&{...owner,file:{path:owner.path}},owner?.root);
}
module.exports={root,between,createHistoryFixture,originalItems};
if(require.main===module){
    if(process.argv[2]!=="--record-original")throw Error("Explicit baseline capture required");
    for(const [target,source]of[["home","Home"],["project","Project"]]){
        const file=path.join(__dirname,"history-read-"+target+"-original.cjs");if(fs.existsSync(file))throw Error("Frozen original already exists");
        fs.copyFileSync(path.join(root,"System/Dashboards/"+source+"/view.js"),file);
    }
    const f=createHistoryFixture(),before=JSON.stringify(f.snapshot()),records=f.wizard.getCompletedTaskHistory();
    const baseline={home:Object.fromEntries(["projects","resources"].map(scope=>[scope,originalItems(records,"home",scope)])),
        workspaces:f.owners.map(owner=>({id:owner.projectId,records:originalItems(records,"project",owner)}))};
    fs.writeFileSync(path.join(__dirname,"history-read-baseline.json"),JSON.stringify(baseline,null,2)+"\n");
    fs.writeFileSync(path.join(__dirname,"history-read-input.json"),JSON.stringify({records,owners:f.owners,files:[...f.files],contents:[...f.contents]},null,2)+"\n");
    if(JSON.stringify(f.snapshot())!==before||f.counts.index||f.counts.sources||f.state.writes)throw Error("History capture violated read isolation");
    console.log("Captured "+records.length+" original recorded events; Home scopes and "+f.owners.length+" workspace selections; no index/source reads or writes");
    f.close().catch(error=>{throw error;});
}
