"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {TaskEngine}=require('../engine.cjs'),{createApplication}=require('../application.cjs');
async function fixture(t,options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-app-')),service=new TaskEngine(path.join(root,'tasks.sqlite'));service.ready=Promise.resolve(service);
 const project={projectId:'project-a',name:'Project A',root:'Projects/A',path:'Projects/A/A.md',status:'active'},resource={contextKind:'resource',resourceType:'notes',id:'notes',name:'Notes',root:'Resources/Notes',path:'Resources/Notes/Notes.md'},stops=[];
 const plugin={register:fn=>stops.push(fn),dataStore:{deviceId:'synthetic-device',async save(){}},app:{vault:{getAbstractFileByPath:p=>[project.path,resource.path].includes(p)?{path:p}:null},workspace:{getActiveFile:()=>null}},projectWizard:{data:{},getProjectRecords:()=>[project],getResourceTypes:()=>[resource],getProjectById:id=>id===project.projectId?project:null,getResourceById:id=>id===resource.id?resource:null,getContextForPath:p=>p?.startsWith(project.root)?project:p?.startsWith(resource.root)?resource:null},planning:{phases:()=>[{id:'phase-a'}]}};
 const locations={describe:()=>({workspaceName:'Fixture',segments:[],available:true}),resolveId:(_owner,id)=>id==='location-a'?{type:'note',reference:{id}}:null};
 const host=createApplication({plugin,service,authorityId:'2eab707f-1674-485f-ae7e-752c9286af65',locations,openEditor:()=>({close(){},saving:false}),openCreator:()=>({close(){}}),...options});plugin.nativeTaskHost=host;await host.ready;t.after(async()=>{await host.close();stops.reverse().forEach(s=>s())});
 const owner={type:'project',id:project.projectId},other={type:'resource',id:resource.id},runtime=host.runtime(owner),form=runtime.formService();
 const create=async fields=>{const r=await form.create(form.formContext().destination,'App task',{text:'App task',...fields});return r.tasks.find(t=>t.id===r.result.task.id)};
 return{plugin,host,service,owner,other,runtime,form,create};
}
test('production boundary registers owners and serves forms, panels, committed completion events and History',async t=>{
 const f=await fixture(t),task=await f.create({description:'Detail',necessity:'must',fromDate:'2026-11-02',dueDate:'2026-11-03',phaseId:'phase-a',nativeLocation:'location-a',steps:[{text:'Independent'}]});
 assert.equal(task.text,'App task');assert.equal(task.description,'Detail');assert.equal(task.phaseId,'phase-a');assert.equal(task.location.id,'location-a');assert.equal((await f.service.listOwners()).owners.length,2);
 const panel=f.host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.owner}),done=await panel.toggle(task,true),completed=done.tasks.find(t=>t.id===task.id);assert(completed.completed);assert(completed.completionEvent.id);assert.equal(completed.completedAt,completed.completionEvent.completedAt);assert.equal((await f.host.completionFeed.read()).records.length,1);
 const reopened=await panel.toggle(completed,false);assert.equal(reopened.tasks.find(t=>t.id===task.id).completionEvent,null);assert.equal((await f.host.completionFeed.read()).completions.length,0);
 const original=await f.form.read(reopened.tasks[0]);const saved=await f.form.save(original,{...original,text:'Atomic save',completed:true,steps:[{text:'Replaced',completed:true}]});assert.equal(saved.tasks[0].completed,true);assert.equal((await f.service.readStatistics()).totalCompletions,2);panel.close();
});
test('moving a task invalidates both owner panels and preserves its stable identity',async t=>{
 const f=await fixture(t),task=await f.create({steps:[]}),original=await f.form.read(task);let oldChanges=0,newChanges=0;
 const old=f.host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.owner,changed:()=>oldChanges++}),next=f.host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.other,changed:()=>newChanges++});
 await f.form.save(original,{...original,nativeOwner:f.other,phaseId:null,nativeLocation:'',text:'Moved'});assert.equal((await old.read()).tasks.length,0);assert.equal((await next.read()).tasks[0].id,task.id);await new Promise(r=>setTimeout(r,20));assert(oldChanges>0&&newChanges>0);old.close();next.close();
});
test('application rejects stale saves, foreign Phases and unavailable locations without discarding metadata',async t=>{
 const f=await fixture(t),task=await f.create({description:'Keep',steps:[]}),original=await f.form.read(task);
 await assert.rejects(f.form.save(original,{...original,phaseId:'foreign'}));await assert.rejects(f.form.save(original,{...original,nativeLocation:'missing'}));
 const a=f.runtime.formService(),b=f.runtime.formService(),sa=await a.read(task),sb=await b.read(task);await a.save(sa,{...sa,text:'New'});await assert.rejects(b.save(sb,{...sb,text:'Stale'}),e=>e.code==='STALE_REVISION');assert.equal((await f.runtime.list()).tasks[0].description,'Keep');
});
test('existing Oath uses SQLite stable IDs and committed completion, preserving fulfillment latch after reopening',async t=>{
 const f=await fixture(t),task=await f.create({steps:[]}),{HubOathService}=require('../../../.obsidian/plugins/hub-project-menu/lib/services/oath');let full=false;
 const oath=new HubOathService(f.plugin,{enter:async()=>{full=true;return true},isFull:()=>full,exit:async()=>{full=false},restore(){}},{notice(){},now:()=>1793610000000});
 f.plugin.oath=oath;const draft={mode:'ordinary',start:'now',durationMs:600000,workspace:f.owner,tasks:[task]};
 // Prepare native candidate panels, as the existing Oath selection view does.
 oath.ensureCommittedRead();await oath.take(draft);assert(oath.active);assert.equal(oath.current.tasks[0].id,task.id);
 const panel=f.host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.owner});const done=await panel.toggle(task,true);await oath.refresh();assert(oath.fulfilled);const at=oath.current.fulfilledAt;await panel.toggle(done.tasks[0],false);await oath.refresh();assert.equal(oath.current.fulfilledAt,at);oath.closeCommittedRead();panel.close();
});
test('atomic editor recurrence creation and completion use the current Step template',async t=>{
 const f=await fixture(t),task=await f.create({dueDate:'2026-11-02',steps:[{text:'Template A'}],recurrenceDraft:{frequency:'weekly',interval:1,zone:'Europe/Stockholm'}});
 assert(task.recurrence);const original=await f.form.read(task),saved=await f.form.save(original,{...original,completed:true,steps:[{...original.steps[0],text:'Template B'}],recurrenceDraft:{frequency:'weekly',interval:1,zone:'Europe/Stockholm',updateTemplate:true}});
 assert(saved.result.successor);assert.equal(saved.result.successor.dueDate,'2026-11-09');assert.equal(saved.result.successor.steps[0].text,'Template B');assert(!saved.result.successor.steps[0].completed);
});
test('lost creation reply retains the original command and app restart recovers it without duplicate Task',async t=>{
 const pending=new Map(),pendingStore={put:c=>pending.set(c.operationId,structuredClone(c)),remove:id=>pending.delete(id),list:()=>[...pending.values()]},f=await fixture(t,{pendingStore});
 const execute=f.service.execute.bind(f.service);let lost=true;f.service.execute=async c=>{const result=await execute(c);if(lost&&c.type==='task.create'){lost=false;throw Object.assign(Error('Lost reply'),{code:'OUTCOME_UNKNOWN'})}return result};
 await assert.rejects(f.create({steps:[]}),e=>e.code==='OUTCOME_UNKNOWN');assert.equal(pending.size,1);const original=[...pending.values()][0];await f.host.close();
 const reopened=new TaskEngine(f.service.file);reopened.ready=Promise.resolve(reopened);const host=createApplication({plugin:f.plugin,service:reopened,authorityId:'2eab707f-1674-485f-ae7e-752c9286af65',openEditor(){},openCreator(){},pendingStore});t.after(()=>host.close());await host.ready;assert.equal(pending.size,0);assert.equal((await reopened.listTasks()).total,1);assert.equal((await reopened.getOperation(original.operationId)).taskId,(await reopened.listTasks()).tasks[0].id);
});

test('startup reuses persisted Project and Resource owners after adopting a different sync authority',async t=>{
 const {randomUUID}=require('node:crypto'),f=await fixture(t);
 const projectTask=(await f.runtime.createTask({text:'Existing project task'})).task;
 const resourceTask=(await f.host.runtime(f.other).createTask({text:'Existing resource task',completed:true,steps:[{text:'Keep this step'}]})).task;
 const beforeOwners=(await f.service.listOwners()).owners,beforeHistory=await f.service.readHistory();
 await f.host.close();
 const service=new TaskEngine(f.service.file);service.ready=Promise.resolve(service);
 const authorityId=randomUUID();service.syncStatus=async()=>({state:'current',workspaceId:randomUUID(),authorityId});
 const host=createApplication({plugin:f.plugin,service,authorityId:randomUUID(),openEditor(){},openCreator(){}});
 t.after(()=>host.close());
 // Panels can subscribe before startup has read the persisted owner registry.
 let changes=0;const panel=host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.other,changed:()=>changes++});
 await host.ready;
 assert.equal(host.nativeTasks.availability(),'current');
 assert.deepEqual((await service.listOwners()).owners,beforeOwners);
 assert.deepEqual(await service.readHistory(),beforeHistory);
 assert.equal((await host.runtime(f.owner).list()).tasks[0].id,projectTask.id);
 const retained=(await panel.read()).tasks[0];assert.equal(retained.id,resourceTask.id);assert.equal(retained.steps[0].id,resourceTask.steps[0].id);
 await new Promise(r=>setTimeout(r,20));changes=0;
 await service.execute({type:'task.edit',operationId:randomUUID(),taskId:resourceTask.id,expectedRevision:resourceTask.revision,patch:{title:'Incoming edit'}});
 await new Promise(r=>setTimeout(r,35));assert(changes>0,'early panel receives changes for the persisted owner');
 await panel.toggle((await panel.read()).tasks[0],false);
 const created=(await host.runtime(f.other).createTask({text:'New resource task'})).task;
 assert.equal(created.ownerId,resourceTask.ownerId);
 await host.refreshInventory();assert.deepEqual((await service.listOwners()).owners,beforeOwners);
 assert.equal((await host.runtime(f.other).list()).tasks.length,2);panel.close();
});
test('one workspace metadata barrier precedes owner availability and initial task presentation',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-ready-')),service=new TaskEngine(path.join(root,'tasks.sqlite'));service.ready=Promise.resolve(service);let metadata=false,release;
 const project={projectId:'ready-project',name:'Ready Project',root:'Projects/Ready',path:'Projects/Ready/Ready.md',status:'active'},plugin={projectWizard:{getProjectRecords:()=>metadata?[project]:[],getResourceTypes:()=>[]},planning:{phases:()=>[]},app:{}},metadataReady=new Promise(r=>release=r);
 const host=createApplication({plugin,service,authorityId:'2eab707f-1674-485f-ae7e-752c9286af65',openEditor(){},openCreator(){},metadataReady});t.after(()=>host.close());await new Promise(r=>setTimeout(r,5));assert.equal(host.nativeTasks.availability(),'loading');assert.equal((await service.listOwners()).owners.length,0);metadata=true;release();await host.ready;assert.equal(host.nativeTasks.availability(),'current');assert.equal(host.nativeTasks.owners.length,1);assert.equal((await service.listOwners()).owners[0].externalId,'ready-project');
});
test('closing during metadata startup does not hang or publish an incomplete owner registry',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-startup-close-')),service=new TaskEngine(path.join(root,'tasks.sqlite'));service.ready=Promise.resolve(service);const plugin={projectWizard:{getProjectRecords:()=>[],getResourceTypes:()=>[]},app:{}};
 const host=createApplication({plugin,service,authorityId:'2eab707f-1674-485f-ae7e-752c9286af65',openEditor(){},openCreator(){},metadataReady:new Promise(()=>{})});await host.close();const sql=new (require('node:sqlite').DatabaseSync)(service.file,{readOnly:true});assert.equal(sql.prepare('select count(*) n from owners').get().n,0);sql.close();
});
test('a committed deletion without a caller reply updates interested panels after durable catch-up',async t=>{const f=await fixture(t),task=await f.create({steps:[]});let observed=false,panel;panel=f.host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.owner,changed:()=>{if(!panel.snapshot().tasks.some(t=>t.id===task.id))observed=true}});await new Promise(r=>setTimeout(r,20));observed=false;await f.service.execute({type:'task.delete',operationId:require('node:crypto').randomUUID(),taskId:task.id,expectedRevision:task.revision});await new Promise(r=>setTimeout(r,35));assert(observed);panel.close();});
test('service reconnection automatically demands durable catch-up and restores current views',async t=>{const f=await fixture(t);await f.create({steps:[]});f.host.setState('reconnecting');assert.equal(f.host.nativeTasks.availability(),'loading');await new Promise(r=>setTimeout(r,35));assert.equal(f.host.nativeTasks.availability(),'current');});


test('editor and creator display context is captured by the originating panel', async t => {
 const calls=[],f=await fixture(t,{openEditor:service=>{calls.push(service);return{close(){}}},openCreator:service=>{calls.push(service);return{close(){}}}}),task=await f.create({steps:[]});
 const make=options=>f.host.nativeTasks.createPanelRead({component:{register(){}},workspace:f.owner,...options});
 const home=make({locationWorkspace:null}),workspace=make({});
 f.plugin.workspaceModes={currentContext:()=>({projectId:'unrelated',root:'Projects/Other'})};
 home.actions.editTask(task);assert.equal(calls.at(-1).locationWorkspace,null);
 workspace.actions.editTask(task);assert.deepEqual(calls.at(-1).locationWorkspace,f.owner);
 home.create({});assert.equal(calls.at(-1).locationWorkspace,null);
 workspace.create({});assert.deepEqual(calls.at(-1).locationWorkspace,f.owner);
 f.host.create({root:'Projects/A'});assert.deepEqual(calls.at(-1).locationWorkspace,f.owner);
 f.host.create({root:'Projects/A',locationWorkspace:null});assert.equal(calls.at(-1).locationWorkspace,null);
 assert.equal(f.runtime.formService().locationWorkspace,null,'Unscoped editors retain workspace prefix');
 home.close();workspace.close();
});

for (const frequency of ['daily', 'weekly']) test(`hidden recurrence action: ${frequency} survives editor saves without a recurrence draft`, async t => {
 const f = await fixture(t);
 let task = await f.create({fromDate:'2026-11-06',dueDate:'2026-11-07',steps:[{text:'Original step'}],recurrenceDraft:{frequency,interval:2,zone:'Europe/Stockholm'}});
 const recurrence = structuredClone(task.recurrence);
 let original = await f.form.read(task);
 assert.deepEqual(original.recurrence, recurrence);
 assert.equal(original.recurrenceDraft, undefined);
 let result = await f.form.save(original, {...original});
 task = result.tasks.find(item => item.id === task.id);
 assert.deepEqual(task.recurrence, recurrence);
 original = await f.form.read(task);
 result = await f.form.save(original, {...original,text:'Edited title',description:'Edited description',necessity:'should',fromDate:'2026-11-08',dueDate:'2026-11-09',nativeLocation:'location-a',steps:original.steps.map(step=>({...step,text:'Edited step'}))});
 task = result.tasks.find(item => item.id === task.id);
 assert.deepEqual(task.recurrence, recurrence);
 assert.equal(task.text, 'Edited title');
 assert.equal(task.steps[0].text, 'Edited step');
 assert.equal(task.location.id, 'location-a');
 assert.deepEqual((await f.form.read(task)).recurrence, recurrence);
});
