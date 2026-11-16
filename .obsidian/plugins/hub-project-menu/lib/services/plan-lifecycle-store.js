"use strict";
// Atomic envelope repository. UI and native-item adapters supply snapshot capture;
// this layer never changes native tasks or performs file operations.
const {clone}=require('../domain/global-plan');
const lifecycle=require('../domain/plan-lifecycle');
class PlanLifecycleStore {
 constructor({store,saved,checkpoint,now=()=>new Date()}) {
  this.store=store;this.checkpoint=checkpoint;this.now=now;this.rawBase=clone(saved??null);this.base=lifecycle.migrate(saved,{now:this.now()});this.draft=clone(this.base);this.queue=Promise.resolve();this.pending=null;this.deferredInput=null;this.pendingFile=null;this.sequence=0;
 }
 read(){return clone(this.draft);}
 active(){const s=this.draft;return s.activePlanId?s.plansById[s.activePlanId]:null;}
 protect(){this.checkpoint.put({version:2,base:this.rawBase,desired:this.draft,pending:this.pending,deferredInput:this.deferredInput,pendingFile:this.pendingFile,sequence:this.sequence});}
 recover(record){
  if(!record)return;
  record=lifecycle.migrateRecovery(record,{now:this.now()});
  const desired=lifecycle.normalize(record.desired);this.pendingFile=clone(record.pendingFile??null);
  if(JSON.stringify(this.rawBase)===JSON.stringify(record.desired)){
   this.base=clone(desired);this.draft=clone(desired);this.pending=null;this.deferredInput=clone(record.deferredInput??null);if(!this.deferredInput&&!this.pendingFile)this.checkpoint.clear();return;
  }
  if(JSON.stringify(this.rawBase)!==JSON.stringify(record.base))throw Object.assign(Error('Recovered Plan changed on another device. Review both drafts.'),{code:'PLAN_CONFLICT',recovered:clone(record)});
  this.draft=desired;this.pending=clone(record.pending??null);this.deferredInput=clone(record.deferredInput??null);this.sequence=record.sequence??0;
 }
 async commit(next,pending=null){
  this.draft=lifecycle.normalize(next);this.pending=pending;this.sequence++;this.protect();
  const target=clone(this.draft);target.revision=this.base.revision+1;
  // Protect the exact revision as well, so restart recognizes commit-before-ack.
  this.draft=clone(target);this.protect();
  const result=await this.store.updatePlan(data=>{
   if(JSON.stringify(data.globalPlan??null)!==JSON.stringify(this.rawBase))throw Object.assign(Error('Plan changed on disk. Review the recovered draft.'),{code:'PLAN_CONFLICT'});
   data.globalPlan=target;
  });
  this.rawBase=clone(result.globalPlan);this.base=lifecycle.normalize(result.globalPlan);this.draft=clone(this.base);this.pending=null;
  if(this.deferredInput||this.pendingFile)this.protect();else this.checkpoint.clear();
  return this.read();
 }
 exclusive(work){const result=this.queue.catch(()=>{}).then(work);this.queue=result;return result;}
 retry(){return this.exclusive(()=>this.commit(this.draft,this.pending));}
 create(entries=[]){return this.exclusive(async()=>{if(this.pending)throw Error('Resolve the pending Plan transition first.');return this.commit(lifecycle.create(this.draft,{now:this.now(),entries}));});}
 edit(id,change){return this.exclusive(async()=>{
  if(this.pending)throw Error('Resolve the pending Plan transition first.');
  const next=this.read(),p=next.plansById[id];if(next.activePlanId!==id||p?.status!=='active')throw Error('The original Plan is no longer active.');
  if(this.now().getTime()>=Date.parse(p.endsAt))throw Object.assign(Error('The Plan day ended.'),{code:'PLAN_EXPIRED'});
  change(p.content);p.touched=true;p.navigation=clone(p.content.entries);return this.commit(next);
 });}
 deferInput(planId,text){this.deferredInput={planId,text,observedAt:this.now().toISOString()};this.protect();}
 finish(id,capture){return this.exclusive(()=>this.endInside(id,'finished',capture));}
 ensureLifecycle(capture){return this.exclusive(async()=>{const p=this.active();if(!p||this.now().getTime()<Date.parse(p.endsAt))return this.read();return this.endInside(p.id,'day-ended',capture);});}
 async endInside(id,status,capture){
  if(this.pending)return this.commit(this.draft,this.pending);
  const p=this.active();if(!p||p.id!==id)throw Error('The original Plan is no longer active.');
  const now=this.now();if(now.getTime()>=Date.parse(p.endsAt))status='day-ended';
  const transitionId=id+':'+status;
  let snapshot;
  if(status==='day-ended'&&!p.touched&&!p.content.note.trim()&&!p.content.entries.length)snapshot=clone(p.content);
  else snapshot=await capture(clone(p),{status,observedAt:now.toISOString(),boundary:p.endsAt});
  // The transition timestamp includes time spent capturing authoritative reads.
  const committedAt=this.now();
  if(status==='finished'&&committedAt.getTime()>=Date.parse(p.endsAt)){
   status='day-ended';snapshot=await capture(clone(p),{status,observedAt:committedAt.toISOString(),boundary:p.endsAt});
  }
  const next=lifecycle.end(this.draft,{planId:id,status,now:committedAt,snapshot,transitionId:status==='finished'?transitionId:id+':day-ended'});
  return this.commit(next,{planId:id,kind:status,transitionId:id+':'+status});
 }
}
module.exports={PlanLifecycleStore};
