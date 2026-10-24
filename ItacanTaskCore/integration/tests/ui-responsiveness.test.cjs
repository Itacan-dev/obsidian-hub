"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {createHomeTaskRead}=require("../../../.obsidian/plugins/hub-project-menu/lib/services/home-task-read");
const consumers=require("../home-schedule");
function fixture(){
 let state="loading",reads=0,legacyReads=0,writes=0,changed=()=>{};
 const owner={type:"project",id:crypto.randomUUID()},project={projectId:owner.id,root:"Projects/Native",path:"Projects/Native/Native.md",status:"active",name:"Native"},id=crypto.randomUUID();
 const task={id,text:"Accepted task",completed:false,steps:[],nativeReference:{authorityId:crypto.randomUUID(),owner,taskId:id,taskRevision:1}};
 const plugin={register(){},taskService:{subscribe:()=>()=>{},queryStructured:async()=>{legacyReads++;return{rows:[],diagnostics:[]}}},projectWizard:{getContextForPath:()=>project}};
 const nativeTasks={consumerUiV1:true,owner,availability:()=>state,mergeHome:consumers.mergeHome,createPanelRead(args){changed=args.changed;return{read:async()=>{reads++;return{tasks:[task],availability:"current",context:{owner,root:project.root,dashboard:project.path,status:project.status}}},close(){},accept(){},actions:{mutate(){writes++}},toggle(){writes++}}}};
 const home=createHomeTaskRead({plugin,component:{register(){}},changed(){},resolveOwner:()=>project,resolveNativeOwner:()=>project,nativeTasks});
 return{home,task,plugin,nativeTasks,project,set(value){state=value;changed()},counts:()=>({reads,legacyReads,writes})};
}
test("initializing Home never queries repositories/Legacy or reports a complete empty list",async()=>{
 const f=fixture();for(let i=0;i<5;i++){const r=await f.home.read();assert.equal(r.availability,"loading");assert.equal(r.countComplete,false);assert.deepEqual(r.items,[])}
 assert.deepEqual(f.counts(),{reads:0,legacyReads:0,writes:0});f.set("current");const good=await f.home.read();assert.equal(good.countComplete,true);assert.equal(good.items[0].task.id,f.task.id);f.home.close();
});
test("accepted rows remain explicitly nonauthoritative while loading or unavailable and actions stay guarded",async()=>{
 const f=fixture();f.set("current");const good=await f.home.read();f.home.accept(good.items);
 for(const state of ["loading","unavailable"]){f.set(state);const result=await f.home.read();assert.equal(result.availability,state);assert.equal(result.countComplete,false);assert.equal(result.items[0].task.id,f.task.id);assert.equal(result.items[0].task.nativeReadOnly,true);assert.throws(()=>f.home.actions.mutate(result.items[0].task));}
 assert.equal(f.counts().writes,0);f.set("current");assert.equal((await f.home.read()).availability,"current");f.home.close();
});
test("multi-owner History preflight avoids reading healthy owners while any peer is initializing",async()=>{
 const previous=global.document;global.document=new EventTarget();const owners=[0,1].map(()=>({type:"project",id:crypto.randomUUID()}));let state="opening",reads=0;
 const hosts=owners.map((owner,i)=>({owner,ready:Promise.resolve(),status:()=>({state:i?state:"ready"}),historyEvidence:{read:async()=>{reads++;return{version:1,authorityId:owner.id,stamp:{head:{repositoryRevision:0}},history:{events:[],overlap:null}}},subscribe:()=>()=>{}},close:async()=>{},release(){}}));
 const {composeNativeHosts}=require("../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-host-multi");const p={register(){},app:{workspace:{}},projectWizard:{data:{completedTaskHistory:[]}}},h=composeNativeHosts(p,hosts);
 try{assert.equal(h.nativeTasks.availability(),"loading");await assert.rejects(h.completionFeed.read());assert.equal(reads,0);state="ready";assert.equal(h.nativeTasks.availability(),"current");assert.equal((await h.completionFeed.read()).records.length,0);assert.equal(reads,2);}finally{await h.close();global.document=previous;}
});

test("previous Home rows are presentation-only, owner-qualified and never a complete or mutable authority",async()=>{
 const f=fixture();f.set("current");const good=await f.home.read();f.home.accept(good.items);
 const previous=f.home.previousPresentation();assert.equal(previous.length,1);assert.equal(previous[0].task.nativeReadOnly,true);
 previous[0].task.text="Changed presentation";assert.equal(f.home.previousPresentation()[0].task.text,"Accepted task");
 f.set("loading");assert.equal((await f.home.read()).countComplete,false);assert.throws(()=>f.home.actions.mutate(previous[0].task));assert.equal(f.counts().writes,0);f.home.close();assert.equal(f.home.availability(),"unavailable");
});

test("Home uses current registered Project metadata before Dataview indexing, preserving legacy fallback",()=>{
 const fs=require("node:fs"),vm=require("node:vm"),source=fs.readFileSync(require("node:path").resolve(__dirname,"../../../System/Dashboards/Home/view.js"),"utf8");
 const prefix=source.slice(0,source.indexOf("const savedProjectCardOrder"));
 const record={projectId:"p",path:"Projects/P/P.md",root:"Projects/P",name:"P",status:"active"};let queries=0;
 const dv={date:()=>({toISODate:()=>"2026-10-24"}),pages(){queries++;return{where(){return this},array:()=>[{type:"project",file:{path:"Projects/Legacy/Legacy.md",name:"Legacy"},projectId:"old",status:"active"}]}}};
 const context={dv,window:{hubGetHomeTimePeriod:()=>"day",hubGetHomeProjects:()=>[record]}};
 assert.equal(vm.runInNewContext(prefix+"projects[0].projectId",context),"p");assert.equal(queries,0);assert.equal(record.sourcePath,undefined);
 delete context.window.hubGetHomeProjects;assert.equal(vm.runInNewContext(prefix+"projects[0].projectId",{dv,window:context.window}),"old");assert.equal(queries,1);
});

test("previous presentation is discarded when its physical owner or vault changes",async()=>{
 const f=fixture();f.set("current");f.home.accept((await f.home.read()).items);
 const make=()=>createHomeTaskRead({plugin:f.plugin,component:{register(){}},changed(){},resolveOwner:()=>f.project,resolveNativeOwner:()=>f.project,nativeTasks:f.nativeTasks});
 const moved=make();assert.equal(moved.previousPresentation().length,1);f.project.root="Projects/Moved";assert.equal(moved.previousPresentation().length,0);f.project.root="Projects/Native";
 f.plugin.app={vault:{adapter:{getBasePath:()=>"different-vault"}}};assert.equal(moved.previousPresentation().length,0);moved.close();f.home.close();
});
