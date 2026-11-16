"use strict";
const assert=require('node:assert/strict');
const {GlobalPlanService}=require('../services/global-plan');
const {entryFor,clone}=require('../domain/global-plan');
function fixture(saved,storage=new Map()){
 let disk=clone(saved??null),fail=false,time=new Date(2026,10,16,12);
 const plugin={app:{vault:{adapter:{getBasePath:()=>'/test'}}},projectWizard:{data:{globalPlan:clone(disk)}},dataStore:{async updatePlan(fn){if(fail)throw Error('disk full');const next={globalPlan:clone(disk)};fn(next);disk=clone(next.globalPlan);return next;}}};
 const plan=new GlobalPlanService(plugin,{storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},now:()=>time});
 let completed=false;plan.references={workspace:()=>null,async resolve(entries){return entries.map(entry=>({entry,label:entry.lastKnownLabel??'Task',availability:'current',task:entry.kind==='task'?{text:'Task',completed,nativeLocationDisplay:{workspaceName:'Project',segments:['Work']}}:undefined}));}};
 return {plan,storage,disk:()=>clone(disk),fail:v=>fail=v,time:v=>time=v,complete:v=>completed=v};
}
async function run(){
 let f=fixture();await f.plan.createPlan();const id=f.plan.active().id;
 f.plan.setNote('Pending exact text',id);f.plan.add([entryFor('task',{authorityId:'a',taskId:'t'},{lastKnownLabel:'Task'})]);
 f.fail(true);await assert.rejects(f.plan.finishPlan(id));assert.equal(f.plan.readPlan(id).status,'active');assert.equal(f.disk().activePlanId,id);
 const restarted=fixture(f.disk(),f.storage);assert(restarted.plan.pendingTransition);await restarted.plan.ensureLifecycle();assert.equal(restarted.plan.readPlan(id).status,'finished');assert.equal(restarted.disk().plansById[id].snapshot.note,'Pending exact text');assert.equal(restarted.disk().plansById[id].snapshot.entries[0].taskState,'incomplete');
 restarted.complete(true);assert.equal((await restarted.plan.resolvePlan(id))[0].task.completed,false,'historical state does not follow native completion');
 const newId=await restarted.plan.createPlan();assert.notEqual(newId,id);assert.throws(()=>restarted.plan.setNote('stale editor',id));assert.equal(restarted.plan.deferredInput.text,'stale editor');assert.equal(restarted.plan.draft.note,'');
 restarted.time(new Date(restarted.plan.active().endsAt));await restarted.plan.ensureLifecycle();assert.equal(restarted.plan.readPlan(newId),null);
 restarted.time(new Date(2026,10,17,12));const noteOnly=await restarted.plan.createPlan();restarted.plan.setNote('Note only');await restarted.plan.flush();restarted.time(new Date(restarted.plan.active().endsAt));await restarted.plan.ensureLifecycle();assert.equal(restarted.plan.readPlan(noteOnly).status,'day-ended');
 const p=restarted.plan.readPlan(id);assert.equal(p.snapshot.note,'Pending exact text');assert.equal(p.snapshot.entries[0].taskState,'incomplete');
 f=fixture();await f.plan.createPlan();const empty=f.plan.active().id;await f.plan.finishPlan(empty);assert.equal(f.plan.readPlan(empty).status,'finished');
 f=fixture();f.fail(true);await assert.rejects(f.plan.createPlan());assert.equal(f.plan.active(),null,'failed creation is not exposed as active');assert(f.plan.pendingTransition);f.fail(false);await f.plan.ensureLifecycle();assert(f.plan.active());

 f=fixture();const abandoned=await f.plan.createPlan();f.plan.setNote('Note only is abandoned on close');await f.plan.abandonEmptyPlan(abandoned);
 assert.equal(f.disk().activePlanId,null);assert.equal(f.plan.readPlan(abandoned),null);assert.equal(f.plan.listHistorical().length,0);assert.equal(fixture(f.disk(),f.storage).plan.active(),null);
 f=fixture();const populated=await f.plan.createPlan([entryFor('task',{authorityId:'a',taskId:'t'})]);await assert.rejects(f.plan.abandonEmptyPlan(populated));assert(f.plan.active());
 f.plan.remove(f.plan.draft.entries[0].id);await f.plan.flush();await f.plan.abandonEmptyPlan(populated);assert.equal(f.plan.active(),null);
 f=fixture();const failed=await f.plan.createPlan();f.plan.setNote('Keep this exact note');await f.plan.flush();
 const update=f.plan.store.updatePlan;let calls=0;f.plan.store.updatePlan=async fn=>{if(++calls===1)throw Error('abandon failed');return update(fn);};
 await assert.rejects(f.plan.abandonEmptyPlan(failed));assert.equal(f.plan.active().content.note,'Keep this exact note');assert.equal(f.disk().activePlanId,failed);
 const retry=fixture(f.disk(),f.storage);assert.equal(retry.plan.pendingTransition.kind,'abandon');await retry.plan.ensureLifecycle();assert.equal(retry.plan.active(),null);assert.equal(retry.plan.listHistorical().length,0);
 f=fixture();const finished=await f.plan.createPlan();await f.plan.finishPlan(finished);assert.equal(f.plan.finishedPreviewPlanId,finished);assert.equal(fixture(f.disk(),f.storage).plan.finishedPreviewPlanId,undefined);f.plan.dismissHomePlan(finished);assert.equal(f.plan.finishedPreviewPlanId,null);assert(f.plan.readPlan(finished));

 f=fixture();const unprotected=await f.plan.createPlan();f.plan.setNote('Durable original');await f.plan.flush();f.plan.recovery.storage.setItem=()=>{throw Error('checkpoint unavailable');};f.fail(true);await assert.rejects(f.plan.abandonEmptyPlan(unprotected));assert.equal(f.plan.active().content.note,'Durable original');assert.equal(fixture(f.disk()).plan.active().content.note,'Durable original');
 console.log('PASS: production Plan service durable Finish/restart, failed creation, stale-editor protection, immutable task state, empty and note-only rollover, atomic abandonment, failed checkpoints and session preview');
}
run().catch(e=>{console.error(e);process.exitCode=1});
