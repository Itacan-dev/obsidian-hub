"use strict";
const test=require("node:test"),S=require("./history-support.cjs"),{assert}=S,lib="../../../.obsidian/plugins/hub-project-menu/lib/";
test("report snapshots and Daily Brief use counted native evidence and exact identities, not same-title legacy guesses",async t=>{
 const f=await S.fixture(t),task=await f.create({text:"Same title"});await f.complete(task.id,true,task.steps[0].id);const current=(await f.runtime.list()).tasks[0],feed=await f.feed.read();
 const {captureReportContext}=require(lib+"domain/report-context"),{buildDailyBriefContext,matchesProgress}=require(lib+"domain/daily-brief"),{localISODate}=require(lib+"domain/dates");
 const wizard={completedTaskHistory:[],activityLog:[],dailyFocus:{},data:{},getProgressReports:()=>[]};
 const before=captureReportContext(wizard,localISODate(),f.owner.id);assert.equal(before.tasks.length,0);
 wizard.taskProgressEvidence=()=>({availability:"unavailable",records:[]});const unavailable=captureReportContext(wizard,localISODate(),f.owner.id);assert.equal(unavailable.tasksAvailability,"unavailable");
 wizard.taskProgressEvidence=()=>({availability:"current",records:feed.records});const recorded=captureReportContext(wizard,localISODate(),f.owner.id);assert.equal(recorded.tasks.length,1);assert.equal(recorded.tasks[0].nativeHistory.taskId,task.id);assert.deepEqual(wizard.completedTaskHistory,[]);
 assert.equal(matchesProgress(current,{text:current.text,path:undefined}),false);assert.equal(matchesProgress(current,feed.records[0]),true);
 const tomorrow=new Date(Date.now()+86400000),context=buildDailyBriefContext({...wizard,taskProgressEvidence:undefined,completedTaskHistory:feed.records},{now:tomorrow,workspaces:[{workspaceId:f.owner.id,name:"Native",path:"Projects/Native/Dashboard.md",type:"project",status:"active",available:true}],tasks:[{...current,workspaceId:f.owner.id}],canOpenNative:()=>true});
 assert.equal(context.days[0].workspaces[0].taskProgress.length,1);assert.equal(context.days[0].workspaces[0].continuations.length,1);assert.equal(context.days[0].workspaces[0].continuations[0].task.id,task.id);
});
test("ephemeral report supplier invalidates incomplete observations and never changes legacy History",async t=>{
 const f=await S.fixture(t),before=global.document;global.document=new EventTarget();t.after(()=>{global.document=before});const callbacks=[],plugin={projectWizard:{completedTaskHistory:[]},register:fn=>callbacks.push(fn)};let fail=true,changed;
 const port={read:async()=>{if(fail)throw Error("unavailable");return f.feed.read()},subscribe:fn=>{changed=fn;return()=>{}}};require(lib+"services/native-task-report-evidence").attachNativeReportEvidence(plugin,{completionFeed:port});t.after(()=>callbacks.reverse().forEach(fn=>fn()));await new Promise(r=>setTimeout(r,20));assert.equal(plugin.projectWizard.taskProgressEvidence().availability,"unavailable");
 fail=false;await changed();assert.equal(plugin.projectWizard.taskProgressEvidence().availability,"current");fail=true;await changed();assert.equal(plugin.projectWizard.taskProgressEvidence().availability,"unavailable");assert.deepEqual(plugin.projectWizard.completedTaskHistory,[]);
});
