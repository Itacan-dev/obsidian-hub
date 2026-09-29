"use strict";
const assert = require("assert");
const { randomUUID } = require("crypto");
const { PROJECT_VIEWS, RESOURCE_VIEWS, upcomingGroups, upcomingBucket, filterTasks, locationLabel, validLocation, calendarRange, dayNumber, timelinePlacement, sortTasks, locationTree } = require("../domain/task-views");
const { taskMetadata, readTaskSnapshot } = require("../domain/task-planning");
const { editTaskContent, applyTaskEdit, taskLineDetails } = require("../domain/tasks");
const { taskProgressMutation } = require("../domain/task-progress");
const { HubTaskEditor } = require("../services/task-editor");
const { HubTaskDataService } = require("../services/task-data");
const now = new Date(2026, 8, 28, 14), p = { root: "Projects/Thesis", projectId: "p1", contextKind: "project", status: "active", name: "Thesis" };
const r = { root: "Resources/Knowledge", projectId: "resource:study", contextKind: "resource", name: "Knowledge" };
const shelved = { ...p, root: "Projects/Shelved", projectId: "p2", status: "shelved", name: "Shelved" };
assert.deepEqual(PROJECT_VIEWS, ["upcoming", "calendar", "timeline", "all"]);
assert.deepEqual(RESOURCE_VIEWS, ["location", "upcoming", "all"]);
const sample = [
 { text: "Past", dueDate: "2026-09-27" }, { text: "Today timed", dueDate: "2026-09-28", dueTime: "09:00" },
 { text: "Tomorrow", dueDate: "2026-09-29" }, { text: "Later", fromDate: "2026-10-01", dueDate: "2026-10-03" },
 { text: "Start only", fromDate: "2026-10-01" }, { text: "Done", dueDate: "2026-09-27", completed: true }
];
assert.deepEqual(Object.values(upcomingGroups(sample, now)).map(tasks => tasks.length), [1,1,1,1,1]);
assert.equal(upcomingBucket(sample[1], now), "today", "Buckets use local due day even if a due time has elapsed");
assert.equal(upcomingBucket({ dueDate: "2027-01-01" }, new Date(2026, 11, 31)), "tomorrow");
assert.equal(filterTasks(sample, { status: "active" }, now).length, 3);
assert.equal(filterTasks(sample, { status: "future" }, now).length, 2);
assert.equal(filterTasks(sample, { status: "completed" }, now).length, 1);
assert.equal(filterTasks(sample, { search: "today" }, now).length, 1);
assert.equal(locationLabel(r.root + "/Math/Topology/Tasks.md", r), "Math › Topology");
assert.equal(locationLabel(r.root + "/Math/Proof.md", r), "Math › Proof");
assert.equal(validLocation(r.root + "/System/Templates/task.md", r), false);
assert.equal(validLocation("Resources/Knowledge2/a.md", r), false);
assert.equal(validLocation(r.root + "/.hidden/a.md", r), false);
assert.equal(calendarRange(now, "month").length, 35);
assert.equal(calendarRange(now, "week")[0].getDay(), 1);
assert.equal(dayNumber("2026-03-30") - dayNumber("2026-03-29"), 1, "DST keeps calendar-day spacing");
assert.equal(timelinePlacement({}, "2026-09-01", "2027-03-01"), null);
assert.equal(timelinePlacement({ dueDate: "2026-09-28" }, "2026-09-01", "2027-03-01").kind, "due");
assert.equal(timelinePlacement({ fromDate: "2026-09-28" }, "2026-09-01", "2027-03-01").kind, "start");
assert.equal(timelinePlacement({ fromDate: "2026-08-01", dueDate: "2026-10-01" }, "2026-09-01", "2027-03-01").clippedStart, true);
assert.equal(timelinePlacement({ dueDate: "2026-08-01" }, "2026-09-01", "2027-03-01"), null);
assert.deepEqual(sortTasks([{text:"Z"},{text:"A"}], "task").map(t=>t.text), ["A","Z"]);
assert.deepEqual(taskMetadata(), { necessity: null, fromDate: null, dueDate: null }, "Legacy metadata shape preserved");

async function persistence() {
 const objects = new Map(), contents = new Map();
 const folder = path => { const item={path,children:[]};objects.set(path,item);return item };
 const note = (path, content) => { const file={path,extension:"md",parent:objects.get(path.slice(0,path.lastIndexOf("/")))};objects.set(path,file);contents.set(path,content);return file };
 for(const path of [p.root,r.root,shelved.root,r.root+"/Math",r.root+"/Math/Topology",r.root+"/Empty",r.root+"/System",r.root+"/System/Templates"]) folder(path);
 const source=r.root+"/Math/Topology/Proof.md", target=r.root+"/Math/Target.md";
 note(source,"# Notes\r\n- [ ] Prove lemma\r\n    - [ ] Outline proof\r\n    - [ ] Verify result\r\n- [ ] Sibling\r\n");
 note(target,"# Target\n"); note(p.root+"/Tasks.md","- [ ] Project task\n");note(r.root+"/System/Templates/Bad.md","- [ ] Example\n");
 let failStore=false, failSource=false, checks=[], history=[], saves=0;
 const wizard={data:{},getProjectRecords:()=>[p,shelved],getResourceTypes:()=>[r],
  getContextForPath:path=>[p,r,shelved].find(w=>path===w.root||path.startsWith(w.root+"/")),
  recordTaskMutation:async(edit,owner,at)=>{const result=taskProgressMutation(checks,history,edit,owner,at,randomUUID);checks=result.checks;history=result.history;return result.changed}};
 const plugin={app:{vault:{getAbstractFileByPath:path=>objects.get(path),getAllLoadedFiles:()=>[...objects.values()],getMarkdownFiles:()=>[...objects.values()].filter(f=>f.extension==="md"),
  read:async file=>contents.get(file.path),create:async(path,text)=>note(path,text),
  process:async(file,transform)=>{if(failSource && file.path===source)throw Error("Source failure");contents.set(file.path,transform(contents.get(file.path)))} }},
  projectWizard:wizard,enqueueTaskMutation:work=>work(),dataStore:{save:async()=>{if(failStore)throw Error("Disk conflict");saves++}},markProjectChangedByPath(){},oath:{changed(){}}
 };
 const editor=plugin.taskEditor=new HubTaskEditor(plugin);
 const data=plugin.taskData=new HubTaskDataService(plugin.app,{metadata:id=>editor.metadata(id)});
 data.invalidate=()=>{};
 const parse=path=>{const text=contents.get(path),lines=text.split(/\r?\n/),tasks=[];
  for(let i=0;i<lines.length;i++){const item=taskLineDetails(lines[i]);if(!item||/^\s/.test(lines[i]))continue;
   const task=readTaskSnapshot(text,{path,line:i,text:item.text});
   const children=task.steps.map(step=>({...step,path,task:true,parent:i,children:[]}));
   tasks.push({...task,text:item.text,children},...children);
  }return{file:{path,tasks}}};
 const dv={pages:()=>({array:()=>[...contents.keys()].map(parse)})};
 const request=()=>data.readWorkspace(dv,r).find(task=>task.text==="Prove lemma");
 let draft=await editor.read(request());
 await editor.save(draft,{...draft,linkedProjectId:"p1",necessity:"must",dueDate:"2026-09-28"});
 const id=request().hubTaskId;
 assert.ok(id);
 assert.equal(data.readWorkspace(dv,p,[r]).length,2,"Project planning includes the same linked Resource task");
 assert.equal(data.readWorkspace(dv,r).find(t=>t.hubTaskId===id).path,source,"Association keeps source location");
 assert.equal(data.readWorkspace(dv,r).some(t=>t.text==="Example"),false);
 assert.equal(editor.locations(r.root).some(item=>item.path.includes("/System/")),false);
 assert.equal(editor.projects().length,1,"Shelved projects cannot be newly selected");
 draft=await editor.read(request());
 await assert.rejects(()=>editor.save(draft,{...draft,linkedProjectId:"p2"}),/active Project/);
 // Record real parent and Step completion before moving, preserving their check time.
 let edit=editTaskContent(contents.get(source),{...request(),completed:true},line=>line.replace("[ ]","[x]"));
 contents.set(source,edit.content);await wizard.recordTaskMutation(edit.edit,r,12345);
 draft=await editor.read(data.readWorkspace(dv,r).find(t=>t.hubTaskId===id));
 await editor.save(draft,{...draft,steps:draft.steps.map((step,i)=>({...step,completed:i===0}))});
 const beforeHistory=JSON.stringify(history), oldTasks=data.readWorkspace(dv,r);
 draft=await editor.read(data.readWorkspace(dv,r).find(t=>t.hubTaskId===id));
 const moved=await editor.save(draft,{...draft,location:target});
 assert.equal(JSON.stringify(history),beforeHistory,"Moving a checked task adds no completion and keeps snapshots unchanged");
 assert.equal((contents.get(target).match(new RegExp(id,"g"))||[]).length,1);
 assert.ok(!contents.get(source).includes(id)&&contents.get(source).includes("Sibling"));
 assert.equal(moved.tasks[0].steps.length,2);
 assert.equal(moved.tasks[0].hubTaskId,id);
 assert.equal(applyTaskEdit(oldTasks,moved).find(t=>t.hubTaskId===id).path,target);
 assert.ok(checks.every(check=>check.path===target));
 edit=editTaskContent(contents.get(target),{...moved.tasks[0],completed:false},line=>line.replace("[x]","[ ]"));
 contents.set(target,edit.content);await wizard.recordTaskMutation(edit.edit,r,23456);
 assert.equal(history.filter(record=>record.kind==="task").length,0,"Uncheck after move removes original completion");
 draft=await editor.read(data.readWorkspace(dv,r).find(t=>t.hubTaskId===id));
 const movedBack=await editor.save(draft,{...draft,location:source,steps:draft.steps.map(step=>({...step,completed:false}))});
 assert.equal(history.length,0,"Unchecking a Step in the same save as moving removes its original completion");
 assert.equal(movedBack.tasks[0].hubTaskId,id);
 assert.ok(!objects.has(r.root+"/Empty/Tasks.md"),"No preemptive folder notes");
 await editor.create(r.root+"/Empty","Folder task",{dueDate:"2026-09-29",linkedProjectId:"p1",steps:[{text:"First",completed:false}]});
 assert.ok(contents.get(r.root+"/Empty/Tasks.md").includes("Folder task"));
 assert.equal(data.readWorkspace(dv,p,[r]).find(t=>t.text==="Folder task").dueDate,"2026-09-29");
 await editor.create(source,"Specific note task");
 assert.ok(contents.get(source).includes("Specific note task"));
 await assert.rejects(()=>editor.create(r.root+"/System/Templates/Bad.md","Bad"),/location/);
 draft=await editor.read(data.readWorkspace(dv,r).find(t=>t.hubTaskId===id));
 const originalSource=contents.get(source),originalTarget=contents.get(target);
 failSource=true;
 await assert.rejects(()=>editor.save(draft,{...draft,location:target}),/Source failure/);
 failSource=false;
 assert.equal(contents.get(source),originalSource);assert.equal(contents.get(target),originalTarget,"Destination rolls back if source removal fails");
 failStore=true;
 await assert.rejects(()=>editor.save(draft,{...draft,location:target,necessity:"should"}),/Disk conflict/);
 failStore=false;
 assert.equal(contents.get(source),originalSource);assert.equal(contents.get(target),originalTarget,"Both notes roll back on metadata failure");
 await assert.rejects(()=>editor.save(draft,{...draft,location:p.root+"/Tasks.md"}),/inside this workspace/);
 assert.equal(contents.get(source),originalSource,"Cross-workspace moves rejected");
 p.status="shelved";
 await editor.save(draft,{...draft,text:"Preserve existing link"});
 assert.equal(editor.metadata(id).linkedProjectId,"p1","Existing shelved links retained without becoming selectable");
 const tree=locationTree(data.readWorkspace(dv,r),r,editor.locations(r.root).filter(x=>x.folder));
 assert.equal(tree.children.get("Math").children.get("Topology").tasks.length,3);
 contents.delete(source);objects.delete(source);
 assert.ok(!data.readWorkspace(dv,p,[r]).some(t=>t.hubTaskId===id),"Deleted sources vanish without phantom tasks");
 assert.ok(saves>0);
}
persistence().then(()=>console.log("Task workspace passed: deterministic views, local dates/DST, queries, project links, hierarchy, lazy folders, canonical moves, check history and rollback.")).catch(error=>{console.error(error);process.exitCode=1});
