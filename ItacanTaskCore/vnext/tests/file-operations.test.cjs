"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID:id}=require('node:crypto');
const {TaskEngine}=require('../engine.cjs');
const op=(type,fields)=>({type,operationId:id(),...fields});
async function fixture(t,options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'itacan-file-ops-')),file=path.join(root,'tasks.sqlite'),e=new TaskEngine(file,options);
 t.after(()=>e.close());const a={id:id(),kind:'project',externalId:'source',label:'Source',available:true},b={id:id(),kind:'resource',externalId:'destination',label:'Destination',available:true};
 for(const owner of[a,b])await e.execute(op('owner.put',{owner}));
 return{e,file,a,b,create:async(fields={})=>(await e.execute(op('task.create',{task:{ownerId:a.id,title:'Associated',...fields}}))).task};
}
test('outbox pages retain every owner row at a transfer boundary',async t=>{
 const f=await fixture(t),task=await f.create();
 const before=(await f.e.readOutbox()).next;
 await f.e.execute(op('task.edit',{taskId:task.id,expectedRevision:task.revision,patch:{ownerId:f.b.id,context:null,phaseId:null}}));
 await f.create({title:'Trailing change'});
 const first=await f.e.readOutbox({after:before,limit:1});
 assert.equal(first.changes.length,2);assert.equal(new Set(first.changes.map(c=>c.sequence)).size,1);assert(first.more);
 const next=await f.e.readOutbox({after:first.next,limit:1});assert.equal(next.changes.length,1);assert.equal(next.more,false);
 for(const ownerId of[f.a.id,f.b.id])assert.equal((await f.e.readOutbox({ownerId,after:before,limit:1})).changes.length,1);
});


const ctx=name=>({kind:'note',reference:'workspace-location:v1:'+name});
function intent(f,kind='move',extra={}){return{kind,requestHash:'a'.repeat(64),from:'Projects/Source/Folder',to:kind==='trash'?null:'Resources/Target/Folder',mappings:[{from:{ownerId:f.a.id,context:ctx('old')},to:{ownerId:f.b.id,context:ctx('new')},fallback:{ownerId:f.a.id,context:null},phases:[]}],...extra};}
async function prepare(f,plan=intent(f),operationId=id()){await f.e.fileOperation({action:'prepare',operationId,intent:plan});return operationId;}
async function finish(f,operationId){await f.e.fileOperation({action:'progress',operationId,progress:{phase:'filesystem-complete'}});return f.e.fileOperation({action:'commit',operationId});}
test('pending intent survives reopen, single admission, cancellation, and stable receipts',async t=>{
 const f=await fixture(t),operationId=await prepare(f),other=new TaskEngine(f.file);t.after(()=>other.close());
 assert.equal((await other.fileOperation({action:'list'}))[0].operationId,operationId);
 await assert.rejects(other.fileOperation({action:'prepare',operationId:id(),intent:intent(f)}),{code:'FILE_OPERATION_PENDING'});
 await assert.rejects(other.fileOperation({action:'prepare',operationId,intent:intent(f,'trash')}),{code:'OPERATION_ID_CONFLICT'});
 const cancelled=await other.fileOperation({action:'cancel',operationId});assert(cancelled.cancelled);
 assert.equal((await f.e.fileOperation({action:'list'})).length,0);
 assert.equal(await f.e.getOperation(operationId),null);
 assert.equal((await f.e.listTasks()).total,0);
});
test('bulk mapping includes completed, tombstoned and descendant tasks without changing history or steps',async t=>{
 const f=await fixture(t),one=await f.create({context:ctx('old'),phaseId:'old-phase',steps:[{text:'Keep step',completed:true}],completed:true}),two=await f.create({context:ctx('old')}),unrelated=await f.create({context:ctx('unrelated')});
 await f.e.execute(op('task.delete',{taskId:two.id,expectedRevision:two.revision}));
 const history=(await f.e.readHistory()).events,steps=f.e.all('SELECT * FROM steps'),before=(await f.e.readOutbox()).next;
 const operationId=await prepare(f);
 await assert.rejects(f.e.execute(op('task.setCompleted',{taskId:one.id,expectedRevision:one.revision,completed:false})),{code:'FILE_OPERATION_PENDING'});
 await assert.rejects(f.create({context:ctx('old')}),{code:'FILE_OPERATION_PENDING'});
 await f.e.execute(op('task.edit',{taskId:unrelated.id,expectedRevision:unrelated.revision,patch:{title:'Unrelated still works'}}));
 const result=await finish(f,operationId);assert.equal(result.taskIds.length,2);
 for(const taskId of[one.id,two.id]){const task=(await f.e.getTask(taskId,{includeDeleted:true})).task;assert.equal(task.ownerId,f.b.id);assert.deepEqual(task.context,ctx('new'));assert.equal(task.phaseId,null);}
 assert((await f.e.getTask(two.id,{includeDeleted:true})).task.deletedAt!==null);
 assert.deepEqual((await f.e.readHistory()).events,history);assert.deepEqual(f.e.all('SELECT * FROM steps'),steps);
 const rows=(await f.e.readOutbox({after:before})).changes.filter(c=>c.operationId===operationId);assert.equal(rows.length,2);assert(rows.every(c=>c.generatedTasks.length===2));
 assert.equal(JSON.stringify(await f.e.getOperation(operationId)).includes('Projects/'),false);
 await assert.rejects(f.e.fileOperation({action:'prepare',operationId,intent:intent(f,'trash')}),{code:'OPERATION_ID_CONFLICT'});
 const revision=(await f.e.getTask(one.id)).task.revision;assert((await f.e.fileOperation({action:'commit',operationId})).replayed);assert.equal((await f.e.getTask(one.id)).task.revision,revision);
});
test('latest occurrence transfers future location without regenerating template identities or successors',async t=>{
 const f=await fixture(t),first=await f.create({context:ctx('old'),dueDate:'2026-11-11',steps:[{text:'Template step'}],recurrence:{frequency:'daily',interval:1,zone:'Europe/Stockholm',startDate:null,dueDate:'2026-11-11'}});
 const done=await f.e.execute(op('task.setCompleted',{taskId:first.id,expectedRevision:first.revision,completed:true})),latest=done.successor,sid=first.recurrence.seriesId;
 const oldSeries=f.e.one('SELECT * FROM recurrence_series WHERE id=?',sid),oldTemplate=JSON.parse(oldSeries.template_json),occurrences=f.e.all('SELECT * FROM occurrences'),history=(await f.e.readHistory()).events;
 const operationId=await prepare(f);await finish(f,operationId);
 const series=f.e.one('SELECT * FROM recurrence_series WHERE id=?',sid),template=JSON.parse(series.template_json);assert.equal(series.owner_id,f.b.id);assert.deepEqual(template,{...oldTemplate,context:ctx('new'),phaseId:null});assert.equal(series.rule_json,oldSeries.rule_json);assert.deepEqual(f.e.all('SELECT * FROM occurrences'),occurrences);assert.deepEqual((await f.e.readHistory()).events,history);
 const current=(await f.e.getTask(latest.id)).task,completed=await f.e.execute(op('task.setCompleted',{taskId:current.id,expectedRevision:current.revision,completed:true}));assert.equal(completed.successor.ownerId,f.b.id);assert.deepEqual(completed.successor.context,ctx('new'));
 const past=(await f.e.getTask(first.id)).task;await f.e.execute(op('task.setCompleted',{taskId:past.id,expectedRevision:past.revision,completed:false}));const reopened=(await f.e.getTask(first.id)).task;const repeated=await f.e.execute(op('task.setCompleted',{taskId:past.id,expectedRevision:reopened.revision,completed:true}));assert.equal(repeated.successor,null);assert.equal(f.e.all('SELECT * FROM occurrences').length,3);
});
test('past-only move retains future ownership and repairs a departing template to its surviving ancestor',async t=>{
 const f=await fixture(t),first=await f.create({context:ctx('old'),dueDate:'2026-11-11',recurrence:{frequency:'daily',interval:1,zone:'UTC',startDate:null,dueDate:'2026-11-11'}}),done=await f.e.execute(op('task.setCompleted',{taskId:first.id,expectedRevision:first.revision,completed:true}));
 await f.e.execute(op('task.edit',{taskId:done.successor.id,expectedRevision:done.successor.revision,patch:{context:ctx('elsewhere')}}));
 const operationId=await prepare(f);await finish(f,operationId);const series=f.e.one('SELECT * FROM recurrence_series WHERE id=?',first.recurrence.seriesId);assert.equal(series.owner_id,f.a.id);assert.equal(JSON.parse(series.template_json).context,null);assert.equal((await f.e.getTask(done.successor.id)).task.ownerId,f.a.id);
});
test('deletion reassigns to parent, preserves identity and cannot reattach on replay',async t=>{
 const f=await fixture(t),task=await f.create({context:ctx('old')}),plan=intent(f,'trash');plan.mappings[0].to={ownerId:f.a.id,context:{kind:'folder',reference:'parent'}};
 const operationId=await prepare(f,plan);await finish(f,operationId);assert.deepEqual((await f.e.getTask(task.id)).task.context,plan.mappings[0].to.context);
 await f.e.fileOperation({action:'commit',operationId});assert.deepEqual((await f.e.getTask(task.id)).task.context,plan.mappings[0].to.context);
});
test('task commit is atomic on failure and lost acknowledgement resolves from receipt',async t=>{
 let armed=false,stage='fileBeforeCommit';const f=await fixture(t,{testBoundary:s=>{if(armed&&s===stage)throw Error('Injected interruption')}}),task=await f.create({context:ctx('old')}),operationId=await prepare(f);
 await f.e.fileOperation({action:'progress',operationId,progress:{phase:'filesystem-complete'}});armed=true;await assert.rejects(f.e.fileOperation({action:'commit',operationId}));assert.equal((await f.e.getTask(task.id)).task.ownerId,f.a.id);assert.equal((await f.e.fileOperation({action:'list'})).length,1);
 stage='fileAfterCommit';await assert.rejects(f.e.fileOperation({action:'commit',operationId}),{code:'OUTCOME_UNKNOWN'});assert.equal((await f.e.getTask(task.id)).task.ownerId,f.b.id);assert.equal((await f.e.fileOperation({action:'list'})).length,0);assert((await f.e.getOperation(operationId)).fileOperation);assert((await f.e.fileOperation({action:'commit',operationId})).replayed);
});

test('incoming synchronization defers affected tasks and series but admits unrelated changes',async t=>{
 const f=await fixture(t),task=await f.create({context:ctx('old')}),other=await f.create({context:ctx('elsewhere')});await prepare(f);
 await f.e.syncTransaction(e=>{e.run('UPDATE tasks SET title=? WHERE id=?','Unrelated incoming edit',other.id);return{value:true};});
 await assert.rejects(f.e.syncTransaction(e=>{e.run('UPDATE tasks SET owner_id=?,context_json=NULL WHERE id=?',f.b.id,task.id);return{value:true};}),{code:'FILE_OPERATION_PENDING'});
 assert.equal((await f.e.getTask(task.id)).task.ownerId,f.a.id);assert.equal((await f.e.getTask(other.id)).task.title,'Unrelated incoming edit');
});

test('schema 4 upgrades additively and preserves existing rows and receipts',async t=>{
 const f=await fixture(t),task=await f.create({completed:true,steps:[{text:'Keep',completed:true}]}),before={tasks:f.e.all('SELECT * FROM tasks'),history:f.e.all('SELECT * FROM history'),operations:f.e.all('SELECT * FROM operations'),outbox:f.e.all('SELECT * FROM outbox')};
 f.e.db.exec('DROP TABLE pending_file_operations;PRAGMA user_version=4');await f.e.close();const reopened=new TaskEngine(f.file);t.after(()=>reopened.close());
 assert.equal(reopened.one('PRAGMA user_version').user_version,5);for(const [table,rows]of Object.entries(before))assert.deepEqual(reopened.all('SELECT * FROM '+table),rows);assert((await reopened.getTask(task.id)).task.completed);assert.equal((await reopened.fileOperation({action:'list'})).length,0);
});

test('cross-Project migration keeps only destination-compatible phases',async t=>{
 const f=await fixture(t),destination={id:id(),kind:'project',externalId:'other-project',label:'Other',available:true};await f.e.execute(op('owner.put',{owner:destination}));
 const keep=await f.create({context:ctx('old'),phaseId:'compatible'}),clear=await f.create({context:ctx('old'),phaseId:'source-only'}),plan=intent(f);plan.mappings[0].to.ownerId=destination.id;plan.mappings[0].phases=['compatible'];await finish(f,await prepare(f,plan));assert.equal((await f.e.getTask(keep.id)).task.phaseId,'compatible');assert.equal((await f.e.getTask(clear.id)).task.phaseId,null);
});
