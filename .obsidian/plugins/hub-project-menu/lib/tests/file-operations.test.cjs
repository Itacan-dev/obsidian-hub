"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{randomUUID}=require("node:crypto");
const {FileOperations}=require("../services/file-operations"),L=require("../domain/native-task-location");
const {TaskEngine}=require("../../../../../ItacanTaskCore/vnext/engine.cjs");
async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"itacan-vault-operations-")),dbFile=path.join(dir,"tasks.sqlite");let engine=new TaskEngine(dbFile),clipboard=null,actor=false;
 t.after(()=>engine.close());const files=new Map(),owners=[{root:"Projects/P",path:"Projects/P/P.md",contextKind:"project",projectId:"p",name:"P",status:"active"},{root:"Resources/R",path:"Resources/R/R.md",contextKind:"resource",resourceType:"r",name:"R"}];
 const ids={p:randomUUID(),r:randomUUID()};for(const [id,kind]of[["p","project"],["r","resource"]])await engine.execute({type:"owner.put",operationId:randomUUID(),owner:{id:ids[id],externalId:id,kind,label:id,available:true}});
 function add(p,bytes=null){const item={path:p,name:p.split("/").at(-1),parent:files.get(p.slice(0,p.lastIndexOf("/"))),...(bytes===null?{children:[]}:{extension:p.split(".").at(-1),basename:p.split("/").at(-1).replace(/\.[^.]+$/,""),bytes:Buffer.from(bytes)})};files.set(p,item);item.parent?.children.push(item);return item;}
 for(const p of["Projects","Projects/P","Projects/P/A","Projects/P/A/Nested","Projects/P/B","Resources","Resources/R","Resources/R/Dest"])add(p);
 add("Projects/P/P.md","identity");add("Resources/R/R.md","identity");add("Projects/P/A/Nested/One.md","One");add("Projects/P/A/Nested/Bytes.bin",Buffer.from([0,255,1,128]));
 const vault={getAbstractFileByPath:p=>files.get(p),readBinary:async f=>f.bytes,createFolder:async p=>{assert(!files.has(p));return add(p);},copy:async(f,p)=>{assert(!files.has(p));return add(p,f.bytes);}};
 const manager={async renameFile(file,to){const old=file.path,entries=[...files.values()].filter(f=>f.path===old||f.path.startsWith(old+"/"));file.parent.children=file.parent.children.filter(f=>f!==file);for(const f of entries)files.delete(f.path);for(const f of entries){f.path=to+f.path.slice(old.length);f.name=f.path.split("/").at(-1);files.set(f.path,f);}file.parent=files.get(to.slice(0,to.lastIndexOf("/")));file.parent.children.push(file);for(const w of owners)if(w.root===old){w.root=to;w.path=to+w.path.slice(old.length);}},async trashFile(file){for(const [p]of files)if(p===file.path||p.startsWith(file.path+"/"))files.delete(p);file.parent.children=file.parent.children.filter(f=>f!==file);}};
 const bridge={ownerId:o=>ids[o.id],receipt:id=>engine.getOperation(id),refresh:async()=>{},request:async input=>{
  if(input.action==="acquire"){assert(!actor);actor=true;return true;}if(input.action==="release"){actor=false;return true;}
  if(input.action==="clipboardSet"){clipboard=structuredClone(input.value);return clipboard;}if(input.action==="clipboardGet")return clipboard;
  return engine.fileOperation(input);
 }};
 const plugin={app:{vault,fileManager:manager},projectWizard:{getProjectRecords:()=>owners.filter(w=>w.contextKind==="project"),getResourceTypes:()=>owners.filter(w=>w.contextKind==="resource")},planning:{phases:()=>[]}};
 let service=new FileOperations(plugin,{bridge});plugin.fileOperations=service;
 const context=(p,type="note",owner="p")=>{const w=owners.find(w=>w.projectId===owner||w.resourceType===owner),ref=L.locationReference({type:owner==="p"?"project":"resource",id:owner},w.root,p,type);return ref?{kind:type,reference:ref.id}:null;};
 return{dir,files,add,owners,ids,plugin,manager,bridge,context,get engine(){return engine;},get service(){return service;},async task(p,extra={}){return(await engine.execute({type:"task.create",operationId:randomUUID(),task:{ownerId:ids.p,title:"Linked",context:context(p),...extra}})).task;},async restart(){await engine.close();engine=new TaskEngine(dbFile);service=new FileOperations(plugin,{bridge});plugin.fileOperations=service;return service;}};
}
test("recursive cross-owner movement migrates canonical and compatibility references; copies preserve binary bytes and do not clone tasks",async t=>{
 const f=await fixture(t),task=await f.task("Projects/P/A/Nested/One.md"),dest="Resources/R/Dest/A";
 await f.service.move("Projects/P/A",dest);const moved=(await f.engine.getTask(task.id)).task;assert.equal(moved.ownerId,f.ids.r);assert.deepEqual(moved.context,f.context(dest+"/Nested/One.md","note","r"));
 await f.service.copy(dest,"Projects/P/B/Copy");assert.deepEqual(f.files.get("Projects/P/B/Copy/Nested/Bytes.bin").bytes,Buffer.from([0,255,1,128]));assert.equal((await f.engine.listTasks()).total,1);
 const legacy=L.resourceReference({type:"resource",id:"r"},dest+"/Nested/One.md","note");const old=await f.task("Projects/P/B/Copy/Nested/One.md",{ownerId:f.ids.r,context:{kind:"note",reference:legacy.id}});
 await f.service.rename(dest+"/Nested/One.md",dest+"/Nested/Renamed.md");assert.deepEqual((await f.engine.getTask(old.id)).task.context,f.context(dest+"/Nested/Renamed.md","note","r"));
});
test("preflight rejects root files, identities, internal stores, collisions, self moves and overlapping batches before mutation",async t=>{
 const f=await fixture(t);await assert.rejects(f.service.copy("Projects/P/A/Nested/One.md","Resources/R/One.md",{filesView:true}),/roots/);
 await assert.rejects(f.service.copy("Projects/P","Resources/R/Dest/P"),/protected/);await assert.rejects(f.service.copy("Projects/P/P.md","Projects/P/B/Identity.md"),/identities/);
 await assert.rejects(f.service.move("Projects/P/A","Projects/P/A/Inside"),/itself/);
 await assert.rejects(f.service.batch("copy",["Projects/P/A/Nested/One.md","Projects/P/P.md"],"Projects/P/B"),/identities/);assert(!f.files.has("Projects/P/B/One.md"));
 f.add("Projects/P/A/.itacan-tasks");await assert.rejects(f.service.copy("Projects/P/A","Projects/P/B/Copy"),/internal store/);assert(!f.files.has("Projects/P/B/Copy"));
 assert.equal((await f.service.list()).length,0);
});
test("crash after mutation recovers original mapping after database reopen and cannot migrate twice",async t=>{
 const f=await fixture(t),task=await f.task("Projects/P/A/Nested/One.md"),from="Projects/P/A",to="Resources/R/Dest/A",operationId=randomUUID();
 const intent=await f.service.plan("move",from,to,{},"a".repeat(64));await f.engine.fileOperation({action:"prepare",operationId,intent});await f.engine.fileOperation({action:"progress",operationId,progress:{phase:"started"}});await f.manager.renameFile(f.files.get(from),to);
 await f.restart();await f.service.recover();assert.equal((await f.engine.getTask(task.id)).task.ownerId,f.ids.r);const revision=(await f.engine.getTask(task.id)).task.revision;await f.service.recover();assert.equal((await f.engine.getTask(task.id)).task.revision,revision);assert.equal((await f.service.list()).length,0);
});
test("competing data remains unresolved without repeated destructive actions or task writes",async t=>{
 const f=await fixture(t),task=await f.task("Projects/P/A/Nested/One.md"),operationId=randomUUID(),intent=await f.service.plan("move","Projects/P/A/Nested/One.md","Projects/P/B/One.md",{},"b".repeat(64));
 await f.engine.fileOperation({action:"prepare",operationId,intent});await f.engine.fileOperation({action:"progress",operationId,progress:{phase:"started"}});f.add("Projects/P/B/One.md","Competing data");await f.restart();await assert.rejects(f.service.recover(),/ambiguous/);assert.equal((await f.engine.getTask(task.id)).task.ownerId,f.ids.p);assert(f.files.has(intent.from));assert.equal(f.files.get(intent.to).bytes.toString(),"Competing data");await assert.rejects(f.service.move("Projects/P/A","Projects/P/B/A"),/ambiguous/);assert.equal((await f.service.list())[0].progress.phase,"review");
});
test("partial deletion reassigns removed descendants, preserves remaining files and reports failure",async t=>{
 const f=await fixture(t),task=await f.task("Projects/P/A/Nested/One.md");let calls=0;
 f.manager.trashFile=async file=>{calls++;const one=f.files.get(file.path+"/Nested/One.md");f.files.delete(one.path);one.parent.children=one.parent.children.filter(x=>x!==one);throw Error("Trash stopped");};
 await assert.rejects(f.service.trash("Projects/P/A"),{code:"FILE_OPERATION_PARTIAL"});assert.equal(calls,1);assert(f.files.has("Projects/P/A/Nested/Bytes.bin"));assert.equal((await f.engine.getTask(task.id)).task.context,null);assert.equal((await f.service.list()).length,0);
});
test("trash recovery never repeats deletion and computes the nearest still-surviving ancestor",async t=>{
 const f=await fixture(t),task=await f.task("Projects/P/A/Nested/One.md"),operationId=randomUUID(),intent=await f.service.plan("trash","Projects/P/A/Nested/One.md",null,{},"c".repeat(64));
 await f.engine.fileOperation({action:"prepare",operationId,intent});await f.engine.fileOperation({action:"progress",operationId,progress:{phase:"started"}});await f.manager.trashFile(f.files.get("Projects/P/A/Nested"));await f.restart();f.manager.trashFile=()=>{throw Error("Must not repeat trash");};await f.service.recover();assert.deepEqual((await f.engine.getTask(task.id)).task.context,f.context("Projects/P/A","folder"));
});
test("interrupted recursive copy resumes matching writes, preserves partial failures and never creates tasks",async t=>{
 const f=await fixture(t),operationId=randomUUID(),intent=await f.service.plan("copy","Projects/P/A","Projects/P/B/Copy",{},"d".repeat(64));await f.engine.fileOperation({action:"prepare",operationId,intent});await f.engine.fileOperation({action:"progress",operationId,progress:{phase:"started",writes:[""]}});f.add(intent.to);await f.restart();await f.service.recover();assert(f.files.has(intent.to+"/Nested/One.md"));assert.equal((await f.engine.listTasks()).total,0);
});
test("cut clipboard is per vault and across explorer instances, normalizes roots, and clears only completed transfers",async t=>{
 const f=await fixture(t),other=new FileOperations(f.plugin,{bridge:f.bridge});await f.service.setClipboard(["Projects/P/A","Projects/P/A/Nested/One.md"],true);await other.paste("Projects/P/B",{filesView:true});assert(f.files.has("Projects/P/B/A/Nested/One.md"));assert.equal((await f.bridge.request({action:"clipboardGet"})).paths.length,0);
});
test("whole-workspace rename preserves owner and canonical references",async t=>{
 const f=await fixture(t),task=await f.task("Projects/P/A/Nested/One.md");await f.service.rename("Projects/P","Projects/Renamed",{workspaceRename:true});const current=(await f.engine.getTask(task.id)).task;assert.equal(current.ownerId,task.ownerId);assert.deepEqual(current.context,task.context);assert.equal(current.revision,task.revision);
});


test("an unchanged source after an unknown mutation stays protected until explicit review",async t=>{
 const f=await fixture(t),operationId=randomUUID(),intent=await f.service.plan("move","Projects/P/A","Projects/P/B/A",{},"f".repeat(64));await f.engine.fileOperation({action:"prepare",operationId,intent});await f.engine.fileOperation({action:"progress",operationId,progress:{phase:"started"}});await f.restart();await assert.rejects(f.service.recover(),/ambiguous/);assert.equal((await f.service.list()).length,1);await f.service.resolve();assert.equal((await f.service.list()).length,0);assert(f.files.has(intent.from));assert(!f.files.has(intent.to));
});
test("Inbox forward/compensation/retry uses distinct stable receipts and preserves associated tasks",async t=>{
 const f=await fixture(t),from="Projects/P/A/Nested/One.md",to="Resources/R/Dest/One.md",task=await f.task(from),move={from,to,hash:require('node:crypto').createHash('sha256').update(f.files.get(from).bytes).digest('hex')},captureId=randomUUID();
 await f.service.captureMove(captureId,move);assert.equal((await f.engine.getTask(task.id)).task.ownerId,f.ids.r);await f.service.captureMove(captureId,move,true);assert.equal((await f.engine.getTask(task.id)).task.ownerId,f.ids.p);await f.service.captureMove(captureId,move);assert.equal((await f.engine.getTask(task.id)).task.ownerId,f.ids.r);assert(f.files.has(to));assert.equal((await f.engine.listTasks()).total,1);
});
test("compensation refuses to strand a new task outside all workspaces",async t=>{
 const f=await fixture(t);f.add('Inbox');f.add('Inbox/One.md','One');const move={from:'Inbox/One.md',to:'Projects/P/B/One.md',hash:require('node:crypto').createHash('sha256').update('One').digest('hex')},captureId=randomUUID();await f.service.captureMove(captureId,move);const task=await f.task(move.to);await assert.rejects(f.service.captureMove(captureId,move,true),/Task state changed|Task references were added/);assert(f.files.has(move.to));assert(!f.files.has(move.from));assert.deepEqual((await f.engine.getTask(task.id)).task.context,f.context(move.to));
});

test("compensation preserves an intervening edit and a newly associated cross-owner task",async t=>{
 const f=await fixture(t),from="Projects/P/A/Nested/One.md",to="Resources/R/Dest/One.md",task=await f.task(from),move={from,to,hash:require('node:crypto').createHash('sha256').update('One').digest('hex')},captureId=randomUUID();await f.service.captureMove(captureId,move);
 const current=(await f.engine.getTask(task.id)).task;await f.engine.execute({type:'task.edit',operationId:randomUUID(),taskId:task.id,expectedRevision:current.revision,patch:{title:'User edit after placement'}});
 await assert.rejects(f.service.captureMove(captureId,move,true),/Compensation is unsafe/);assert(f.files.has(to));assert.equal((await f.engine.getTask(task.id)).task.title,'User edit after placement');assert.equal((await f.engine.getTask(task.id)).task.ownerId,f.ids.r);
});

test("failed batch reports completed, pending and untouched subtrees and retains remaining cut entries",async t=>{
 const f=await fixture(t),root='Projects/P/A/Nested',one=root+'/One.md',binary=root+'/Bytes.bin',third=root+'/Third-long-file.md';f.add(third,'Third');const task=await f.task(one),rename=f.manager.renameFile;f.manager.renameFile=async(file,to)=>{if(file.path===binary)throw Error('Injected move failure');return rename(file,to);};await f.service.setClipboard([one,binary,third],true);
 await assert.rejects(f.service.paste('Projects/P/B'),error=>{assert.deepEqual(error.completed,[one]);assert.equal(error.pending,binary);assert.deepEqual(error.untouched,[third]);return true;});
 assert(f.files.has('Projects/P/B/One.md'));assert(f.files.has(binary));assert(f.files.has(third));assert.deepEqual((await f.engine.getTask(task.id)).task.context,f.context('Projects/P/B/One.md'));assert.deepEqual((await f.bridge.request({action:'clipboardGet'})).paths,[binary,third]);assert.equal((await f.service.list()).length,0);
});
test("a competing partial copy is retained without overwrite and cannot be reported complete",async t=>{
 const f=await fixture(t),operationId=randomUUID(),intent=await f.service.plan('copy','Projects/P/A','Projects/P/B/Copy',{},'a'.repeat(64));await f.engine.fileOperation({action:'prepare',operationId,intent});await f.engine.fileOperation({action:'progress',operationId,progress:{phase:'started',writes:['','Nested','Nested/One.md']}});f.add(intent.to);f.add(intent.to+'/Nested');f.add(intent.to+'/Nested/One.md','Competing bytes');await f.restart();await assert.rejects(f.service.recover(),/changed/);assert.equal(f.files.get(intent.to+'/Nested/One.md').bytes.toString(),'Competing bytes');assert.equal((await f.service.list())[0].progress.phase,'review');assert.equal(await f.engine.getOperation(operationId),null);
});
test("workspace deletion keeps task ownership and reassigns linked descendants to the unavailable root",async t=>{
 const f=await fixture(t),task=await f.task('Projects/P/A/Nested/One.md');await f.service.trash('Projects/P',{workspaceDelete:true});const result=(await f.engine.getTask(task.id)).task;assert.equal(result.ownerId,task.ownerId);assert.equal(result.context,null);assert(!f.files.has('Projects/P'));assert.equal((await f.engine.listTasks()).total,1);
});

test("review can preserve a partial copy or accept an inspected destination without destructive writes",async t=>{
 const f=await fixture(t),from='Projects/P/A/Nested/One.md',to='Projects/P/B/One.md',task=await f.task(from),operationId=randomUUID(),intent=await f.service.plan('move',from,to,{},'b'.repeat(64));await f.engine.fileOperation({action:'prepare',operationId,intent});await f.engine.fileOperation({action:'progress',operationId,progress:{phase:'started'}});await f.manager.renameFile(f.files.get(from),to);f.files.get(to).bytes=Buffer.from('Inspected updated links');await assert.rejects(f.service.recover(),/ambiguous/);await f.service.resolve('use-destination');assert.deepEqual((await f.engine.getTask(task.id)).task.context,f.context(to));assert.equal(f.files.get(to).bytes.toString(),'Inspected updated links');
 const copyId=randomUUID(),copy=await f.service.plan('copy','Projects/P/A','Projects/P/B/Partial',{},'c'.repeat(64));await f.engine.fileOperation({action:'prepare',operationId:copyId,intent:copy});await f.engine.fileOperation({action:'progress',operationId:copyId,progress:{phase:'review',message:'Retained partial copy'}});f.add(copy.to);await f.service.resolve('keep-copy');assert(f.files.has(copy.to));assert.equal((await f.service.list()).length,0);
});

test("a post-commit view refresh failure preserves the successful receipt and clears a completed cut",async t=>{
 const f=await fixture(t),messages=[];f.plugin.fileOperationNotice=message=>messages.push(message);let refreshes=0;f.bridge.refresh=async()=>{if(++refreshes>1)throw Error('Injected view refresh failure');};const source='Projects/P/A/Nested/One.md',task=await f.task(source);await f.service.setClipboard([source],true);const result=await f.service.paste('Projects/P/B');assert.deepEqual(result.completed,[source]);assert.equal((await f.bridge.request({action:'clipboardGet'})).paths.length,0);assert.deepEqual((await f.engine.getTask(task.id)).task.context,f.context('Projects/P/B/One.md'));assert.equal(messages.length,1);assert.equal((await f.service.list()).length,0);
});
