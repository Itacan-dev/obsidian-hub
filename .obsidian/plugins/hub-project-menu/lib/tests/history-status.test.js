"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), Module = require("module");
const { historyKind, queryHistory } = require("../domain/history");
const { reduceActivityLog } = require("../domain/activity");
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const original = Module._load;
Module._load = function(name) { return name === "obsidian" ? {
 Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile: class {}, TFolder: class {}
} : original.apply(this, arguments); };
try { compiled._compile(fs.readFileSync(filename,"utf8")+"\nmodule.exports.Wizard=ProjectWizardService;",filename); }
finally { Module._load = original; }
let projects = ["active","future","shelved"].map(status=>({projectId:status,name:status,status}));
let resources=[{resourceType:"study",label:"Knowledge"}];
const snapshot = {
 projectWorkRatings:Object.fromEntries(projects.map(p=>[p.projectId,{"2026-09-14":3}])),
 projectWorkLogs:Object.fromEntries(projects.map(p=>[p.projectId,{"2026-09-14":{projectName:p.name,summary:"Report",timestamp:100}}])),
 resourceWorkRatings:{study:{"2026-09-14":2}},
 resourceWorkLogs:{study:{"2026-09-14":{resourceName:"Knowledge",summary:"Study",timestamp:101}}},
 completedTaskHistory:[...projects.map(p=>({projectId:p.projectId,projectName:p.name,path:p.name+".md",text:"Done",timestamp:102})),{projectId:"resource:study",contextKind:"resource",text:"Resource task",path:"Resources/Knowledge/Note.md"}],
 activityLog:[...projects.map(p=>({projectId:p.projectId,project:p.name,action:"edited",path:p.name+".md",timestamp:102})),{projectId:"resource:study",contextKind:"resource",action:"edited",path:"Resources/Knowledge/Note.md"}]
};
function reload(data=snapshot) {
 const wizard=Object.assign(Object.create(compiled.exports.Wizard.prototype),JSON.parse(JSON.stringify(data)));
 wizard.getProjectRecords=()=>projects;wizard.getResourceById=id=>resources.find(r=>r.resourceType===id);
 return wizard;
}
for(const state of ["active","future","shelved","active","deleted"]){
 projects=state==="deleted"?[]:projects.map(p=>({...p,status:state}));
 if(state==="deleted")resources=[];
 // Actual shared getters on a fresh service model each time: reload / Home rebuild.
 const wizard=reload();
 assert.equal(wizard.getProgressReports().length,3,state+" retains Reports");
 assert.equal(wizard.getCompletedTaskHistory().length,4,state+" retains Tasks");
 assert.equal(wizard.getActivityLog().length,4,state+" retains Activity");
 assert.equal(wizard.getProgressReports({kind:"resource"}).length,1,"Resource report remains without live registry");
 assert.equal(wizard.getProgressReports("future")[0].projectName,"future","Stored report name survives deletion");
 for(const records of [wizard.getActivityLog(),wizard.getCompletedTaskHistory()]){
  assert.equal(queryHistory(records,{kind:"project"}).length,3);
  assert.equal(queryHistory(records,{kind:"resource"}).length,1);
 }
 assert.equal(wizard.getCompletedTaskHistory("shelved").length,1,"Workspace scope is stable identity, not status");
}
let log=Array.from({length:650},(_,i)=>({action:"created",path:"old/"+i,title:String(i),timestamp:i}));
const before=JSON.stringify(log);
log=reduceActivityLog(log,{action:"project-deleted",path:"old/0",title:"Old"},{timestamp:9999});
assert.equal(log.length,651,"Deletion must neither prune older paths nor cap archive");
assert.equal(JSON.stringify(log.slice(1)),before);
const reloaded=reload({...snapshot,activityLog:log});assert.equal(reloaded.getActivityLog().length,651);
const source=fs.readFileSync(path.resolve(__dirname,"../../../../../System/Dashboards/Home/view.js"),"utf8");
function selection(fn,variable,env){
 const start=source.indexOf("    const "+variable+" =",source.indexOf("function "+fn+"("));
 const end=source.indexOf("\n    if (",start);
 return new Function(...Object.keys(env),source.slice(start,end)+"\nreturn "+variable+";")(...Object.values(env));
}
for(const scope of ["projects","resources"]){
 const wizard=reload(),env={historyKind,progressScope:scope,projects:[],resourceTypes:[],
 progressReports:[...wizard.getProgressReports(),...wizard.getProgressReports({kind:"resource"})],
 recentItems:wizard.getActivityLog(),completedTaskHistory:wizard.getCompletedTaskHistory()};
 for(const [fn,v] of [["renderRecentReports","visibleReports"],["renderRecentActivity","visibleItems"],["renderCompletedTaskHistory","items"]])
  assert.equal(selection(fn,v,env).length,scope==="projects"?3:1,"Actual Home selections retain deleted sources");
}
console.log("PASS: actual shared getters and Home queries; Active/Future/Shelved/status changes/reload/deleted Project and Resource; Reports/Activity/Tasks identity/name retention; independent categorical scopes; >650 retained events.");

