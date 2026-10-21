"use strict";
const {TaskService}=require("../services/task-service");
const {LegacyTaskAdapter}=require("../services/task-service-legacy");
const {queryHistory}=require("../domain/history");
const {aggregateStatistics,RANGES}=require("../domain/statistics");
const original=require("./statistics-read-service-original.cjs");
const plain=value=>JSON.parse(JSON.stringify(value,(_key,item)=>item instanceof Map?[...item]:item instanceof Set?[...item]:item));
function fixture(count=100, now=Date.parse("2026-10-26T12:00:00+01:00")){
 const counts={history:0,index:0,source:0,writes:0,notes:0,metadata:0,projects:0,resources:0,reports:0},cleanup=[];
 const owners=[...[["private","Renamed private","active"],["itacan","Itacan","active"],["hub","Obsidian Hub","active"],["future","Same name","future"],["shelved","Same name","shelved"]].map(([projectId,name,status])=>({projectId,name,status,contextKind:"project",root:"Projects/"+projectId,path:`Projects/${projectId}/${projectId}.md`})),
 ...["study","literature","references","inspiration"].map(resourceType=>({projectId:"resource:"+resourceType,resourceType,name:resourceType,contextKind:"resource",root:"Resources/"+resourceType,path:`Resources/${resourceType}/${resourceType}.md`}))];
 const day=86400000,records=Array.from({length:count},(_,i)=>{const o=owners[i%owners.length];return {id:"e"+i,kind:i%3===0?"step":"task",text:"Historical "+i,path:o.root+"/Missing.md",timestamp:now-(i%600)*day-1000,projectId:o.projectId,projectName:"Old "+o.name,contextKind:o.contextKind,resourceType:o.resourceType??null,hubTaskId:"same-task-"+(i%3),parentTaskId:i%3===0?"parent":null};});
 const base={text:"Legacy",path:"Resources/study/Missing.md",timestamp:now-1000};
 records.push(...[
 {...base,id:"duplicate",timestamp:null},{...base,id:"duplicate"},
 {...base},{...base},{...base,id:""},{...base,id:""},{...base,id:null},{...base,id:null},{...base,id:0},{...base,id:0},
 {...base,id:17},{...base,id:17},{...base,id:"17"},
 {...base,id:"deleted",projectId:"deleted",project:"Legacy deleted name"},
 {...base,id:"name-only",project:"Renamed private"},{...base,id:"same-name-only",project:"Same name"},
 {...base,id:"conflict",projectId:"private",project:"Wrong name",projectName:"Wrong modern name",contextKind:"project"},
 {...base,id:"modern-wins",projectId:"deleted-modern",projectName:"Modern name",project:"Legacy name"},
 {...base,id:"null-modern",projectId:"deleted-null",projectName:null,project:"Null fallback"},
 {...base,id:"empty-modern",projectId:"deleted-empty",projectName:"",project:"Do not replace empty"},
 {...base,id:"presentation",projectId:"itacan",targetKind:"project",contextKind:"resource"},
 {...base,id:"unknown-kind",kind:"Step"},{...base,id:"null-kind",kind:null},
 {...base,id:"archived",archivedAt:now-1,hubTaskId:null},
 {...base,id:"string-time",timestamp:String(now-1000)},{...base,id:"date-only",timestamp:"2026-10-25"},
 {...base,id:"zone-string",timestamp:"2026-10-25T01:30:00+02:00"},
 {...base,id:"missing-time",timestamp:undefined},{...base,id:"future-time",timestamp:now+1},
 {id:"no-title-or-path",timestamp:now-1,projectId:"private"},
 ...["2026-03-29T01:59:59+01:00","2026-03-29T03:00:00+02:00","2026-10-25T02:30:00+02:00","2026-10-25T02:30:00+01:00","2026-01-01T00:00:00+01:00","2024-02-29T23:59:59+01:00"].map((time,i)=>({...base,id:"boundary-"+i,timestamp:Date.parse(time)}))
 ]);
 const activity=owners.flatMap((o,i)=>[{action:"created",path:o.root+"/Note.md",projectId:o.projectId,timestamp:now-day*(i+1)},{action:"edited",path:o.root+"/Note.md",projectId:o.projectId,timestamp:now-1000}]);
 const reports=owners.map((o,i)=>({projectId:o.projectId,date:"2026-10-25",score:i%5}));reports.push({projectId:"report-only",projectName:"Report only",date:"2025-12-31",score:4},{date:"2026-10-25",score:2});
 const files=owners.flatMap(o=>[{path:o.root+"/Note.md",stat:{ctime:now-30*day}},{path:o.path,stat:{ctime:now-day}},{path:o.root+"/Meta/Hidden.md",stat:{ctime:now-day}}]);
 const oath={id:"synced",state:"fulfilled",startedAt:now-2*day,completedAt:now-day,workspace:{id:"private",type:"project",name:"Old private"}};
 const data={completedTaskHistory:records,oathsByDevice:{a:{history:[oath]},b:{history:[{...oath},{id:"broken",state:"broken",startedAt:now-day,completedAt:now-1000,workspace:{id:"study",type:"resource"}}]}}};
 const wizard={data,completedTaskHistory:records,activityLog:activity,getProjectRecords(){counts.projects++;return owners.filter(o=>o.contextKind==="project");},getResourceTypes(){counts.resources++;return owners.filter(o=>o.contextKind==="resource");},getCompletedTaskHistory(){counts.history++;return queryHistory(wizard.completedTaskHistory);},getProgressReports(scope){counts.reports++;return reports.filter(r=>String(r.projectId).startsWith("resource:")===(scope?.kind==="resource"));}};
 const plugin={projectWizard:wizard,register:fn=>cleanup.push(fn),app:{vault:{getMarkdownFiles(){counts.notes++;return files;},read(){counts.source++;throw Error("No Markdown reads");}},metadataCache:{getFileCache(){counts.metadata++;return {};}}},taskData:{readPages(){counts.index++;throw Error("No task scans");}},taskEditor:{}};
 const service=plugin.taskService=new TaskService(new LegacyTaskAdapter({plugin,dataview:()=>{throw Error("No Dataview");}}));
 return {plugin,wizard,owners,records,files,reports,counts,now,cleanup,close:()=>service.close()};
}
function aggregates(snapshot){return RANGES.flatMap(([range])=>["all",...snapshot.registry.keys()].map(workspace=>({range,workspace,model:plain(aggregateStatistics(snapshot,range,workspace))})));}
module.exports={fixture,plain,aggregates,original};
if(require.main===module){
 if(process.argv.includes("--browser-input")){
  const fs=require("node:fs"),path=require("node:path"),target=path.join(__dirname,"statistics-read-input.json");if(fs.existsSync(target))throw Error("Input already captured");
  const f=fixture();fs.writeFileSync(target,JSON.stringify(plain({owners:f.owners,records:f.records,files:f.files,reports:f.reports,data:f.wizard.data,activity:f.wizard.activityLog,now:f.now}),null,2)+"\n");f.close();
 } else {
 const fs=require("node:fs"),path=require("node:path"),target=path.join(__dirname,"statistics-read-baseline.json");
 if(fs.existsSync(target))throw Error("Original baseline already exists");
 const f=fixture(),snapshot=original.readStatistics(f.plugin,f.now);
 fs.writeFileSync(target,JSON.stringify({snapshot:plain(snapshot),aggregates:aggregates(snapshot),counts:f.counts},null,2)+"\n");
 console.log("Original snapshot captured: "+snapshot.completions.length+" accepted events, "+snapshot.registry.size+" cohorts, "+aggregates(snapshot).length+" exact range/workspace models");f.close();
 }
}
