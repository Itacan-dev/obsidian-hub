"use strict";
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const model=require('../domain/plan-lifecycle');
const {emptyPlan,entryFor,clone}=require('../domain/global-plan');
const {PlanLifecycleStore}=require('../services/plan-lifecycle-store');
async function run(){
 const noon=new Date(2026,10,16,12),old=emptyPlan();old.note='Preserve this note';old.entries=[entryFor('file',{path:'Research/a.pdf'})];
 const migrated=model.migrate(old,{now:noon});assert.equal(migrated.activePlanId,model.migrate(old,{now:noon}).activePlanId);assert.deepEqual(migrated.plansById[migrated.activePlanId].content,{note:old.note,entries:old.entries});assert.deepEqual(old.note,'Preserve this note');
 assert.equal(model.migrate(emptyPlan()).activePlanId,null);assert.throws(()=>model.migrate({...old,version:99}));
 let s=model.create(model.empty(),{now:noon,id:'a'});assert.throws(()=>model.create(s,{now:noon}));
 const midnight=new Date(s.plansById.a.endsAt);
 assert.equal(model.end(s,{planId:'a',status:'day-ended',now:midnight,snapshot:s.plansById.a.content}).plansById.a.status,'day-ended');
 s.plansById.a.content.note='A note only';s.plansById.a.touched=true;
 const ended=model.end(s,{planId:'a',status:'day-ended',now:midnight,snapshot:s.plansById.a.content});assert.equal(ended.plansById.a.snapshot.note,'A note only');assert.equal(ended.plansById.a.status,'day-ended');
 const empty=model.create(model.empty(),{now:noon,id:'e'}),manual=model.end(empty,{planId:'e',status:'finished',now:noon,snapshot:empty.plansById.e.content,transitionId:'finish-e'});assert(manual.plansById.e);assert.deepEqual(model.end(manual,{planId:'e',transitionId:'finish-e'}),manual);
 assert.throws(()=>model.end(empty,{planId:'e',status:'finished',now:midnight,snapshot:empty.plansById.e.content}));
 const checkpointDraft=clone(old);checkpointDraft.note='Recovered exact text';
 const converted=model.migrateRecovery({version:1,base:old,desired:checkpointDraft,sequence:9,pendingFile:{operationId:'move-1'}},{now:noon});assert.equal(converted.desired.activePlanId,migrated.activePlanId);assert.equal(converted.desired.plansById[migrated.activePlanId].content.note,'Recovered exact text');assert.equal(converted.pendingFile.operationId,'move-1');
 let time=noon,disk=clone(old),savedCheckpoint,fail=false;
 const checkpoint={put:v=>savedCheckpoint=clone(v),clear:()=>savedCheckpoint=null};
 const store={async updatePlan(fn){if(fail)throw Error('disk full');const data={globalPlan:clone(disk),unrelated:42};fn(data);assert.equal(data.unrelated,42);disk=clone(data.globalPlan);return data;}};
 let repo=new PlanLifecycleStore({store,saved:disk,checkpoint,now:()=>time});await repo.edit(repo.active().id,c=>c.note='Latest unsaved note');const id=repo.active().id;
 fail=true;await assert.rejects(repo.finish(id,async p=>clone(p.content)));assert.equal(disk.activePlanId,id);assert.equal(savedCheckpoint.pending.kind,'finished');
 fail=false;repo=new PlanLifecycleStore({store,saved:disk,checkpoint,now:()=>time});repo.recover(savedCheckpoint);await repo.retry();assert.equal(disk.activePlanId,null);assert.equal(disk.plansById[id].snapshot.note,'Latest unsaved note');assert.equal(savedCheckpoint,null);
 // Crash after the atomic write but before acknowledgement: saved desired is
 // already on disk and must be recognized without another history append.
 const ackRecord={version:2,base:old,desired:clone(disk),pending:{planId:id,kind:'finished'},sequence:3,pendingFile:{operationId:'retained-receipt'}};
 const acknowledged=new PlanLifecycleStore({store,saved:disk,checkpoint,now:()=>time});acknowledged.recover(ackRecord);assert.equal(acknowledged.pending,null);assert.equal(acknowledged.pendingFile.operationId,'retained-receipt');assert.equal(model.history(acknowledged.read()).length,1);
 const frozen=JSON.stringify(disk.plansById[id].snapshot);await repo.create();assert.equal(JSON.stringify(disk.plansById[id].snapshot),frozen);assert.equal(model.history(disk).length,1);
 const next=repo.active().id;time=new Date(repo.active().endsAt);await repo.ensureLifecycle(()=>{throw Error('empty should not read native sources')});assert.equal(disk.plansById[next].status,'day-ended');
 time=new Date(time.getTime()+1000);await repo.create();await repo.edit(repo.active().id,c=>c.note='Only note');time=new Date(repo.active().endsAt);await repo.ensureLifecycle(async p=>clone(p.content));assert.equal(model.history(disk).length,3);
 time=new Date(time.getTime()+1000);await repo.create();repo.deferInput(repo.active().id,'late IME text');const deferred=clone(savedCheckpoint);await repo.edit(repo.active().id,c=>c.note='safe');assert(savedCheckpoint.deferredInput);assert.equal(savedCheckpoint.deferredInput.text,'late IME text');
 const conflict=new PlanLifecycleStore({store,saved:{...disk,revision:disk.revision+1},checkpoint,now:()=>time});assert.throws(()=>conflict.recover(deferred),/another device/);
 const before=clone(disk);disk.revision++;await assert.rejects(repo.edit(repo.active().id,c=>c.note='concurrent'),/changed on disk/);assert.equal(disk.plansById[disk.activePlanId].content.note,before.plansById[before.activePlanId].content.note);
 console.log('PASS: lifecycle migration, sequential Plans, empty rollover, note-only history, manual empty finish, atomic failures/restart, snapshots, deferred input and concurrent-write preservation');
}
if(process.argv.includes('--zone')){
 for(const [y,m,d,hours] of [[2026,2,29,23],[2026,9,25,25]]){const start=new Date(y,m,d);const b=model.boundary(start);assert.equal((Date.parse(b.endsAt)-start.getTime())/3600000,hours);}
 assert.throws(()=>model.scheduledStart('2026-03-29T02:30',new Date(2026,2,28)),/valid local/);
 assert.equal(model.scheduledStart('2026-10-25T02:30',new Date(2026,9,24)).toISOString(),'2026-10-25T00:30:00.000Z');
 assert.equal(model.scheduledStart('2026-03-30T00:00',new Date(2026,2,29)).toISOString(),'2026-03-29T22:00:00.000Z');
 console.log('PASS: Stockholm 23/25-hour calendar boundaries');
}else run().then(()=>{const r=spawnSync(process.execPath,[__filename,'--zone'],{encoding:'utf8',env:{...process.env,TZ:'Europe/Stockholm'},windowsHide:true});assert.equal(r.status,0,r.stderr);process.stdout.write(r.stdout);}).catch(e=>{console.error(e);process.exitCode=1});
