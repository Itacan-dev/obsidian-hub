"use strict";
const {clone,normalize,identity}=require("../domain/global-plan");
const {randomUUID}=require("node:crypto");
const lifecycle=require("../domain/plan-lifecycle");
const {PlanDraft}=require("./plan-draft");
const {localISODate,parseLocalISODate}=require("../domain/dates");
class GlobalPlanService {
 constructor(plugin,{storage=globalThis.localStorage,vault=plugin.app.vault.adapter.getBasePath(),now=()=>new Date()}={}) {
  this.plugin=plugin;this.store=plugin.dataStore??plugin.projectWizard.store;this.now=now;this.listeners=new Set();this.sequence=0;this.status="Saved";this.recovery=new PlanDraft(storage,vault);this.nativeOperations=new Set();
  this.rawBase=clone(plugin.projectWizard.data.globalPlan??null);
  try{this.state=lifecycle.migrate(this.rawBase,{now:this.now()});}catch(error){this.state=lifecycle.empty();this.readOnly=true;this.error=error;this.status=error.message;}
  this.baseState=clone(this.state);
  try{const saved=this.recovery.read();if(saved&&!this.readOnly){
   const r=lifecycle.migrateRecovery(saved,{now:this.now()});this.sequence=r.sequence;this.pendingFile=r.pendingFile;this.deferredInput=r.deferredInput;
   if(JSON.stringify(r.desired)===JSON.stringify(this.rawBase)){if(!this.pendingFile&&!this.deferredInput)this.recovery.clear();}
   else if(JSON.stringify(r.base)===JSON.stringify(this.rawBase)||saved.inflight===JSON.stringify(this.rawBase)){this.state=lifecycle.normalize(r.desired);this.pendingTransition=r.pending;this.protected=true;this.status="Changes kept locally - Retry";}
   else{this.conflict=r;this.protected=true;this.status="Recovered changes need review";}
  }}catch(error){this.error=error;this.status=error.message;}
  this.interruptedPlanner = Object.values(this.state.plansById).some(record => record.plannerSession);
 }
 projection(state=this.state){const p=state.plansById[state.activePlanId];return {...clone(p?.content??{entries:[],note:""}),version:1,revision:state.revision,legacyReview:state.legacyReview,fileOperationCursor:clone(state.fileOperationCursor)};}
 get draft(){return this.projection();}
 set draft(value){const p=this.state.plansById[this.state.activePlanId];if(p)p.content={note:value.note,entries:clone(value.entries)};}
 get base(){return this.projection(this.baseState);}
 read(){return this.projection();}
 readState(){return clone(this.state);}
 published(){return this.transitioning||this.pendingTransition?this.baseState:this.state;}
 active(){const state=this.pendingTransition?this.baseState:this.state;return state.plansById[state.activePlanId]??null;}
 listHistorical(date){return lifecycle.history(this.published()).filter(p=>!date||p.calendarDate===date);}
 listScheduled(){
  return lifecycle.scheduled(this.published()).filter(record => {
   const saved = this.baseState.plansById[record.id];
   const current = this.state.plansById[record.id];
   return !record.plannerSession || (
    current?.status === 'scheduled' && saved?.status === 'scheduled' &&
    saved.scheduledAt === current.scheduledAt && lifecycle.hasContent(saved) && lifecycle.hasContent(current)
   );
  });
 }
 canFinish(id){const record=this.readPlan(id);return record?.status==="active"&&!lifecycle.provisional(record);}
 readPlan(id){return clone(this.published().plansById[id]??null);}
 selected(date){const state=(this.transitioning||this.pendingTransition)?this.baseState:this.state,p=state.plansById[state.activePlanId];return p&&(!date||p.calendarDate===date)?clone(p):this.listHistorical(date)[0]??null;}
 get busy(){return !!(this.transitioning||this.pendingTransition||this.conflict||this.readOnly||this.restoring);}
 bind(id,{historicalNavigation=false}={}){const service=this;return {
  get draft(){const p=service.readPlan(id);return p?.content??p?.snapshot??{note:"",entries:[]};},
  get status(){return service.status;},get error(){return service.error;},get deferredInput(){return service.deferredInput;},
  get busy(){return service.busy||service.enrollingOathId===id;},
  assertEditable:()=>service.assertEditable(id),subscribe:(c,f)=>service.subscribe(c,f),emit:()=>service.emit(),
  assertExecutable:()=>{if(service.active()?.id!==id)throw Error("This Plan is no longer active.");service.assertEditable(id);},
  references:{resolve:()=>service.resolvePlan(id,{historicalNavigation}),open:i=>service.references.open(i),workspace:r=>service.references.workspace(r),tasks:service.references.tasks},
  trackNative:p=>service.trackNative(p),move:(entry,to)=>service.move(entry,to,id),remove:entry=>service.remove(entry,id)
 };}
 oathProtects(id){
  const oath=this.plugin.oath;
  return !!id&&(this.enrollingOathId===id||(oath?.committed&&(oath.focus?.planId??oath.current?.planId)===id));
 }
 focusHandoff(oathId){const handoff=this.published().focusHandoff;return handoff?.oathId===oathId?clone(handoff):null;}
 duePlans(now=this.now()){return this.listScheduled().filter(p=>p.scheduledAt&&Date.parse(p.scheduledAt)<=+now);}
 nextScheduledTime(){const first=lifecycle.scheduled(this.state).find(p=>p.scheduledAt&&!lifecycle.provisional(p));return first?Date.parse(first.scheduledAt):Infinity;}
 focusPrompts(){
  const oath=this.plugin.oath;
  if(!oath?.active||!oath.fulfilled)return [];
  const watermark=Date.parse(this.published().lastScheduledActivation??"");
  return this.duePlans().filter(p=>p.deferredOathId!==oath.current.id&&!(Date.parse(p.scheduledAt)<=watermark));
 }
 assertEditable(id=this.state.activePlanId){
  if(this.readOnly)throw this.error;
  if(this.busy)throw Error("Resolve the pending Plan changes first.");
  const p=this.state.plansById[id];
  if(!lifecycle.editable(p))throw Error("This Plan is no longer editable.");
  if(this.enrollingOathId===id)throw Error("Wait for the Oath commitment to save.");
  if(p.status==='active'&&this.now().getTime()>=Date.parse(p.endsAt)&&!this.oathProtects(id)){
   void this.ensureLifecycle().catch(()=>{});
   throw Error("The Plan day ended.");
  }
 }
 async withOathPlan(id,work){
  await this.ensureLifecycle();
  const p=this.active();
  if(!id||p?.id!==id||!p.content.entries.length||this.now().getTime()>=Date.parse(p.endsAt))throw Error("An active Plan with at least one item is required to take an Oath.");
  this.assertEditable(id);
  this.enrollingOathId=id;
  this.emit();
  try{await this.flush();return await work(clone(this.state.plansById[id]));}
  finally{this.enrollingOathId=null;this.emit();void this.ensureLifecycle().then(()=>this.schedule()).catch(()=>{});}
 }
 async resolvePlan(id,{historicalNavigation=false}={}){
  const p=this.readPlan(id);
  if(!p)return [];
  if(lifecycle.editable(p))return (await this.references.resolve(p.content.entries)).map(item=>({...item,planId:id}));
  const bindings = historicalNavigation ? p.navigation.filter(entry=>entry.kind!=="task") : [];
  const navigation = new Map((bindings.length ? await this.references.resolve(bindings) : [])
   .map(item=>[item.entry.id,item.availability]));
  return p.snapshot.entries.map(e=>({
   entry:clone(e),label:e.label??e.lastKnownLabel,historical:true,planId:id,snapshot:clone(e),
   navigationAvailability:navigation.get(e.id),
   task:e.kind==="task"?{text:e.label??e.lastKnownLabel,completed:e.taskState==="completed",nativeReadOnly:true}:null
  }));
 }
 async capture(p){let items=[];try{await this.plugin.nativeTaskHost?.ready;items=await this.references.resolve(p.content.entries);}catch{}const observedAt=this.now().toISOString();return {note:p.content.note,entries:p.content.entries.map((e,i)=>{const item=items[i],route=item?.task?.nativeLocationDisplay;const source=this.references.workspace?.(e.reference.sourceWorkspace);return {...clone(e),label:item?.label??e.lastKnownLabel??'Unavailable reference',route:route?[route.workspaceName,...(route.segments??[])].filter(Boolean).join(' / '):e.kind==='workspace'?(e.reference.type==='resource'?'Resource':'Project'):[source?.name??source?.label??'Vault',...e.reference.path?.split('/').slice(0,-1)??[]].join(' / '),taskState:e.kind==='task'?(item?.availability==='current'&&item.task?(item.task.completed?'completed':'incomplete'):'unknown'):undefined,observedAt};})};}
 trackNative(promise){this.nativeOperations.add(promise);promise.finally(()=>this.nativeOperations.delete(promise)).catch(()=>{});return promise;}
 async createPlan(entries=[]){await this.ensureLifecycle();if(this.active())return this.active().id;return this.transition(async()=>{this.state=lifecycle.create(this.state,{now:this.now(),entries});this.pendingTransition={kind:"create",planId:this.state.activePlanId};this.sequence++;this.checkpoint();await this.flush();this.pendingTransition=null;this.finishedPreviewPlanId=null;return this.state.activePlanId;});}
 async changeSchedule(kind,operation){
  await this.ensureLifecycle();
  return this.transition(async()=>{
   if(this.pendingTransition)throw Error("Retry the pending Plan change first.");
   const {state,id}=operation(this.state,this.now());
   this.state=state;
   this.pendingTransition={kind,planId:id};
   this.sequence++;
   this.checkpoint();
   await this.flush();
   this.pendingTransition=null;
   return id;
  });
 }
 assertScheduleAllowed(start,now){
  const at=+lifecycle.scheduledStart(start,now),until=this.plugin.oath?.commitmentDeadline?.();
  if(this.enrollingOathId)throw Error("Wait for the Oath commitment to save.");
  const current=this.plugin.oath?.current;
  if(until>at&&(this.plugin.oath.active||current?.scheduledAt<=at))
   throw Error("This start time overlaps an unfulfilled Oath.");
  if(current?.state==="scheduled"&&at<current.scheduledAt)
   throw Error("This Plan would replace the Plan of a scheduled Oath.");
 }
 schedulePlan(start){
  const id=randomUUID();
  return this.changeSchedule("schedule",(state,now)=>{
   this.assertScheduleAllowed(start,now);
   return {state:lifecycle.schedule(state,{start,now,id}),id};
  });
 }
 async createPlannerPlan({ date = null, id = randomUUID() } = {}) {
  await this.ensureLifecycle();
  if (this.readPlan(id)) return id;
  return this.changeSchedule("create", (state, now) => {
   const today = localISODate(now);
   if (date !== null && (!parseLocalISODate(date) || date < today)) {
    throw Error("Choose today or a future day to create a Plan.");
   }
   const startNow = !state.activePlanId && (!date || date === today);
   return { state: lifecycle.createForPlanner(state, { date, now, id, startNow }), id };
  }).then(created => {
   if (this.active()?.id === created) this.dismissHomePlan(this.finishedPreviewPlanId);
   return created;
  });
 }
 async finalizePlanner() {
  const candidates = Object.values(this.state.plansById).filter(record => record.plannerSession);
  if (!candidates.length) return;
  await this.transition(async () => {
   await this.flush();
   let next = this.readState();
   for (const { id } of candidates) {
    const record = next.plansById[id];
    if (!record) continue;
    if (!lifecycle.hasContent(record) && !this.oathProtects(id) && this.deferredInput?.planId !== id) {
     next = lifecycle.deletePlan(next, id);
    } else if (lifecycle.hasContent(record)) {
     delete record.plannerSession;
    }
   }
   if (JSON.stringify(next) !== JSON.stringify(this.state)) await this.saveTransition(next, "planner-close");
  });
 }
 async deletePlan(id, { confirmed = false } = {}) {
  if (this.lifecycleWork) await this.lifecycleWork;
  if (this.pendingTransition) await this.ensureLifecycle();
  await this.transition(async () => {
   await this.flush();
   await Promise.all([...this.nativeOperations]);
   const record = this.state.plansById[id];
   if (!record) return;
   if (this.oathProtects(id)) throw Error("End the Oath before deleting its Plan.");
   if (!confirmed && lifecycle.hasContent(record)) throw Error("Confirm deletion of this Plan first.");
   await this.saveTransition(lifecycle.deletePlan(this.state, id), "delete", id);
   if (this.finishedPreviewPlanId === id) this.finishedPreviewPlanId = null;
   if (this.deferredInput?.planId === id) {
    this.deferredInput = null;
    this.checkpoint();
   }
  });
 }
 reschedulePlan(id,start){return this.changeSchedule("reschedule",(state,now)=>{
  this.assertScheduleAllowed(start,now);
  return {state:lifecycle.reschedule(state,{planId:id,start,now}),id};
 });}
 async transition(work){if(this.transitioning)throw Error('A Plan transition is already in progress.');if(this.readOnly)throw this.error;if(this.conflict)throw Error('Resolve the recovered Plan first.');this.transitioning=true;this.emit();try{return await work();}finally{this.transitioning=false;this.emit();this.schedule();}}
 async saveTransition(state,kind,planId){
  this.state=lifecycle.normalize(state);
  this.pendingTransition={planId,kind};
  this.undoAction=null;this.undoPlanId=null;
  this.sequence++;
  this.checkpoint();
  await this.flush();
  this.pendingTransition=null;
 }
 async endPlan(id,status){
  if(this.oathProtects(id))throw Error("End the Oath before finishing its Plan.");
  if(this.pendingTransition)return this.ensureLifecycle();
  return this.transition(async()=>{
   await this.flush();
   await Promise.all([...this.nativeOperations]);
   const p=this.active();
   if(!p||p.id!==id)throw Error("The active Plan changed.");
   if (lifecycle.provisional(p)) {
    if (status === "finished") throw Error("Add a note or item before finishing this Plan.");
    const next = this.readState();
    lifecycle.releaseProvisionalActive(next, id);
    await this.saveTransition(next, "release-empty", id);
    return;
   }
   const snapshot=await this.capture(p),now=this.now();
   if(status==="finished"&&this.nextScheduledTime()<=+now)throw Error("A scheduled Plan is due. The current Plan will time out.");
   if(+now>=Date.parse(p.endsAt))status="day-ended";
   const state=lifecycle.end(this.state,{planId:id,status,now,snapshot,transitionId:id+":"+status});
   await this.saveTransition(state,status,id);
  });
 }
 async finishPlan(id){await this.ensureLifecycle();this.requestedFinishId=id;await this.endPlan(id,'finished');if(this.readPlan(id)?.status==='finished'){this.finishedPreviewPlanId=id;this.emit();}}
 async applyDue(activateId,archiveIds,{oathId=null}={}){
  return this.transition(async()=>{
   await this.flush();
   await Promise.all([...this.nativeOperations]);
   const sequence=this.sequence,state=this.readState(),now=this.now(),current=state.plansById[state.activePlanId];
   const target=state.plansById[activateId];
   const due=archiveIds.map(id=>state.plansById[id]);
   if ([...due, ...(activateId ? [target] : [])].some(record =>
    record?.status !== "scheduled" || lifecycle.provisional(record) || Date.parse(record.scheduledAt) > +now)) {
    throw Error("The scheduled Plans changed. Retry the update.");
   }
   const archives=due.map(p=>({record:p,reason:"never-activated",at:p.scheduledAt}));
   if (target && lifecycle.provisional(current)) lifecycle.releaseProvisionalActive(state, current.id);
   else if(target&&current){
    const ended=this.plugin.oath?.current,when=Date.parse(target.scheduledAt);
    const released=ended?.startedAt!=null&&ended.startedAt<=when&&when<=ended.completedAt;
    const at=oathId||target.deferredOathId||released?+now:Math.min(Date.parse(current.endsAt),...due.concat(target).map(p=>Date.parse(p.scheduledAt)));
    archives.push({record:current,reason:"replaced",at:Math.max(at,Date.parse(current.startedAt??current.createdAt))});
   }
   for(const {record,reason,at} of archives){
    lifecycle.archive(state,{planId:record.id,reason,at,now,snapshot:await this.capture(record)});
   }
   if(sequence!==this.sequence)throw Error("Plan entries changed during the handoff. Retry the update.");
   if(oathId){
    const oath=this.plugin.oath;
    if(!oath.active||!oath.fulfilled||oath.current.id!==oathId)throw Error("The focus session has changed.");
    state.focusHandoff={oathId,planId:target.id,entries:clone(target.content.entries)};
   }else delete state.focusHandoff;
   const next=target?lifecycle.startScheduled(state,{planId:target.id,now}):state;
   await this.saveTransition(next,"activate-scheduled",target?.id??archiveIds.at(-1));
   if(target)this.finishedPreviewPlanId=null;
  });
 }
 focusChoice(id,update){
  const oath=this.plugin.oath;
  return oath.enqueue(async()=>{
   if(!this.focusPrompts().some(p=>p.id===id))throw Error("This Plan is no longer waiting for focus.");
   const oathId=oath.current.id;
   if(update){
    if(Date.parse(this.readPlan(id).scheduledAt)<=Date.parse(this.published().lastScheduledActivation??""))throw Error("A later Plan is already active.");
    await this.applyDue(id,[],{oathId});
    await oath.focusChanged();
   }else await this.transition(async()=>{
    const state=this.readState();
    state.plansById[id].deferredOathId=oathId;
    await this.saveTransition(state,"defer-scheduled",id);
   });
  });
 }
 ensureLifecycle(){
  if(this.lifecycleWork)return this.lifecycleWork;
  if(this.transitioning||this.disposed||this.restoring)return Promise.resolve();
  this.lifecycleWork=this.advanceLifecycle().then(()=>{
   this.retryDelay=0;
  },error=>{
   this.retryDelay=Math.min(30000,(this.retryDelay||500)*2);
   throw error;
  }).finally(()=>{this.lifecycleWork=null;this.schedule();});
  return this.lifecycleWork;
 }
 async advanceLifecycle(){
  if(this.pendingTransition){
   const pending=this.pendingTransition;
   await this.transition(async()=>{await this.flush();this.pendingTransition=null;});
   if(pending.kind==="activate-scheduled"&&this.plugin.oath?.active)await this.plugin.oath.focusChanged?.();
   if(this.requestedFinishId&&this.readPlan(this.requestedFinishId)?.status==='finished'){this.finishedPreviewPlanId=this.requestedFinishId;this.emit();}
  }
  if (this.interruptedPlanner) {
   await this.finalizePlanner();
   this.interruptedPlanner = false;
  }
  const oath=this.plugin.oath,p=this.active(),due=this.duePlans();
  if(this.enrollingOathId||oath?.active){
   if(oath?.fulfilled)this.emit();
   return;
  }
  if(oath?.current?.state==="scheduled"&&oath.commitmentDeadline?.()>+this.now())return;
  if(due.length){
   const latest=due.at(-1),watermark=Date.parse(this.published().lastScheduledActivation??"");
   const activate=!(Date.parse(latest.scheduledAt)<=watermark);
   await this.applyDue(activate?latest.id:null,(activate?due.slice(0,-1):due).map(p=>p.id));
   if(!activate&&p&&+this.now()>=Date.parse(p.endsAt))await this.endPlan(p.id,"day-ended");
  }else if(p&&!this.oathProtects(p.id)&&+this.now()>=Date.parse(p.endsAt))await this.endPlan(p.id,'day-ended');
 }
 schedule(){
  clearTimeout(this.dayTimer);
  if(this.disposed||this.restoring||this.conflict||this.readOnly)return;
  const now=+this.now(),oath=this.plugin.oath;
  const focused=!!(oath?.active||this.enrollingOathId),reserved=oath?.current?.state==="scheduled"&&oath.commitmentDeadline?.()>now;
  const future=this.listScheduled().map(p=>Date.parse(p.scheduledAt)).filter(t=>Number.isFinite(t)&&(!(focused||reserved)||t>now));
  const p=this.active();
  if(p&&!focused&&!reserved&&!this.oathProtects(p.id))future.push(Date.parse(p.endsAt));
  if(reserved)future.push(oath.commitmentDeadline());
  if(this.pendingTransition)future.push(now+1000);
  if(!future.length)return;
  this.dayTimer=setTimeout(()=>void this.ensureLifecycle().catch(error=>{this.status=error.message;this.emit();}),Math.min(2147483647,Math.max(this.retryDelay??0,5,Math.min(...future)-now)));
  this.dayTimer.unref?.();
 }
 start(){
  const resume=()=>void this.ensureLifecycle().catch(error=>{this.status=error.message;this.emit();});
  globalThis.document?.addEventListener('visibilitychange',resume);
  globalThis.window?.addEventListener('focus',resume);
  let signature;
  const stop=this.plugin.oath?.onChange(()=>{const oath=this.plugin.oath,next=JSON.stringify([oath.current?.id,oath.current?.state,oath.fulfilled]);if(next!==signature){signature=next;resume();}});
  this.plugin.register(()=>{this.disposed=true;stop?.();clearTimeout(this.dayTimer);globalThis.document?.removeEventListener('visibilitychange',resume);globalThis.window?.removeEventListener('focus',resume);});
  resume();
 }
 dismissHomePlan(id){if(this.finishedPreviewPlanId===id)this.finishedPreviewPlanId=null;this.emit();}
 subscribe(component,fn){this.listeners.add(fn);const stop=()=>this.listeners.delete(fn);component?.register(stop);return stop;}
 emit(){for(const fn of [...this.listeners])try{fn();}catch(error){console.error(error);}}
 checkpoint(){if(this.restoring)return true;try{this.recovery.put({version:2,base:this.rawBase,desired:this.state,sequence:this.sequence,inflight:this.inflight,pendingFile:this.pendingFile,pending:this.pendingTransition,deferredInput:this.deferredInput});this.protected=true;return true;}catch(error){this.protected=false;this.error=error;return false;}}
 mutate(change,{id=this.state.activePlanId,note=false,undo=null,system=false}={}){
  if(!system)this.assertEditable(id);
  else if(this.readOnly||this.conflict||this.restoring)throw this.error??Error('Plan recovery needs review.');
  const state=clone(this.state),p=state.plansById[id],next={...this.projection(state),...clone(p?.content??{note:"",entries:[]})};
  change(next);
  const content=normalize(next);
  if(p){
   if(this.oathProtects(id)&&p.content.entries.length&&!content.entries.length)throw Error("Keep at least one item in the Plan while its Oath is in effect.");
   p.content={note:content.note,entries:content.entries};
   p.navigation=clone(content.entries);
   if (!system && p.plannerSession && p.status === "scheduled" && !lifecycle.hasContent(p)) {
    p.status = "draft";
    delete p.deferredOathId;
   }
   if (!system && p.status === "draft" && p.scheduledAt && lifecycle.hasContent(p)) {
    const start = lifecycle.localTime(new Date(p.scheduledAt));
    try {
     this.assertScheduleAllowed(start, this.now());
     p.status = "scheduled";
    } catch {
     // Preserve the work even when the proposed start has to be changed.
    }
   }
   if(!system)p.touched=true;
  }
  state.fileOperationCursor=content.fileOperationCursor;
  state.legacyReview=content.legacyReview;
  this.state=lifecycle.normalize(state);
  this.sequence++;
  if(undo){this.undoAction=undo;this.undoPlanId=id;}
  this.checkpoint();this.status="Saving...";this.emit();clearTimeout(this.timer);
  if(note&&this.protected)this.timer=setTimeout(()=>void this.flush().catch(()=>{}),500);
  else void this.flush().catch(()=>{});
 }
 referenceEntries(){
  const plans=Object.values(this.state.plansById);
  return plans.flatMap(p => lifecycle.editable(p) ? p.content.entries : p.navigation);
 }
 mutateReferences(change){
  if(this.readOnly||this.conflict||this.restoring)throw Error('Plan recovery needs review.');
  const state=clone(this.state),plans=Object.values(state.plansById);
  const entries=plans.flatMap(p => lifecycle.editable(p) ? p.content.entries : p.navigation);
  const projection={entries,fileOperationCursor:state.fileOperationCursor};
  change(projection);
  state.fileOperationCursor=projection.fileOperationCursor;
  for(const p of plans)if(lifecycle.editable(p))p.navigation=clone(p.content.entries);
  lifecycle.normalize(state);
  this.state=state;this.sequence++;this.checkpoint();void this.flush().catch(()=>{});
 }
 setNote(text,id=this.state.activePlanId){try{this.mutate(p=>p.note=text,{id,note:true});}catch(error){this.deferredInput={planId:id,text,observedAt:this.now().toISOString()};this.checkpoint();throw error;}}
 add(entries,id=this.state.activePlanId){const added=[];this.mutate(p=>{const keys=new Set(p.entries.map(identity));for(const entry of entries)if(!keys.has(identity(entry))){keys.add(identity(entry));p.entries.push(clone(entry));added.push(entry.id);}},{id,undo:p=>p.entries=p.entries.filter(e=>!added.includes(e.id))});return added.length;}
 remove(entryId,id=this.state.activePlanId){this.assertEditable(id);const entries=this.state.plansById[id].content.entries,i=entries.findIndex(e=>e.id===entryId),entry=entries[i];if(!entry)return;const after=entries[i+1]?.id;this.mutate(p=>p.entries=p.entries.filter(e=>e.id!==entryId),{id,undo:p=>{if(!p.entries.some(e=>identity(e)===identity(entry)))p.entries.splice(after?Math.max(0,p.entries.findIndex(e=>e.id===after)):p.entries.length,0,clone(entry));}});}
 move(entryId,to,id=this.state.activePlanId){this.assertEditable(id);const before=this.state.plansById[id].content.entries.map(e=>e.id);this.mutate(p=>{const i=p.entries.findIndex(e=>e.id===entryId);if(i<0)return;const [entry]=p.entries.splice(i,1);p.entries.splice(Math.max(0,Math.min(to,p.entries.length)),0,entry);},{id,undo:p=>{p.entries.sort((a,b)=>{const ai=before.indexOf(a.id),bi=before.indexOf(b.id);return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);});}});}
 undo(id=this.undoPlanId){const action=this.undoPlanId===id&&this.undoAction;if(action){this.mutate(action,{id});this.undoAction=null;this.undoPlanId=null;}}
 async flush(){if(this.restoring)return;if(this.readOnly)throw this.error;clearTimeout(this.timer);if(this.conflict)throw Error('Resolve the recovered Plan first.');if(this.saving){await this.saving;return this.flush();}if(JSON.stringify(this.state)===JSON.stringify(this.rawBase)){
  if(this.status==="Saving..."){this.status="Saved";this.emit();}
  return;
 }
 // An initial admission that missed its start while waiting to be saved stays editable.
 for (const record of Object.values(this.state.plansById)) {
  if (!record.plannerSession || record.status !== "scheduled" || +new Date(record.scheduledAt) > +this.now()) continue;
  const saved = this.baseState.plansById[record.id];
  if (saved?.status === "scheduled" && saved.scheduledAt === record.scheduledAt) continue;
  record.status = "draft";
  delete record.deferredOathId;
 }
 const target = clone(this.state), seq = this.sequence, previousWrite = this.inflight;
 target.revision = this.baseState.revision + 1;
 this.inflight = JSON.stringify(target);
 this.checkpoint();
 this.saving=this.store.updatePlan(data => {
  const disk = JSON.stringify(data.globalPlan ?? null);
  if (disk === this.inflight) return;
  if (previousWrite && disk === previousWrite) {
   // The previous write reached disk even though the caller never received it.
   target.revision = data.globalPlan.revision + 1;
   this.inflight = JSON.stringify(target);
   this.checkpoint();
  } else if (disk !== JSON.stringify(this.rawBase)) {
   throw Object.assign(Error('Plan changed on disk. Reload to review your recovered draft.'), { code: 'PLAN_CONFLICT' });
  }
  data.globalPlan = target;
 }).then(data=>{this.error=null;this.rawBase=clone(data.globalPlan);this.baseState=lifecycle.normalize(data.globalPlan);this.plugin.projectWizard.data.globalPlan=clone(this.baseState);this.state.revision=this.baseState.revision;this.inflight=null;
  if(seq===this.sequence&&!this.pendingFile&&!this.deferredInput){try{this.recovery.clear();this.protected=true;}catch(error){this.error=error;}}
  else this.checkpoint();
  this.status=seq===this.sequence?"Saved":"Saving...";
 }).catch(error=>{this.error=error;this.status=this.checkpoint()?'Changes kept locally - Retry':'Could not protect these changes';throw error;}).finally(()=>{this.saving=null;this.emit();this.schedule();});await this.saving;if(seq!==this.sequence)return this.flush();
 }
 async resolveConflict(restore){
  const recovered=this.conflict;
  if(!recovered)return;
  const desired=lifecycle.normalize(restore?recovered.desired:this.baseState);
  const lockedId=this.plugin.oath?.focus?.planId??this.plugin.oath?.current?.planId;
  if(this.oathProtects(lockedId)&&(desired.activePlanId!==lockedId||!desired.plansById[lockedId]?.content.entries.length))
   throw Error("End the Oath before resolving this Plan conflict.");
  if(restore){
   if(desired.activePlanId&&this.baseState.activePlanId&&desired.activePlanId!==this.baseState.activePlanId)
    throw Error("Competing active Plans require Audit Hub data review. Both drafts are preserved.");
   for(const [id,p] of Object.entries(this.baseState.plansById)){
    const other=desired.plansById[id];
    if(!other){
     if(p.status==="active")throw Error("Resolve competing Plan drafts in Audit Hub data.");
     desired.plansById[id]=clone(p);
    }else if(p.status!=="active"&&JSON.stringify(p)!==JSON.stringify(other)){
     throw Error("Plan versions conflict. Both copies need Audit Hub data review.");
    }
   }
   this.sequence++;
  }
  this.state=lifecycle.normalize(desired);
  this.conflict=null;
  this.checkpoint();
  await this.flush();
 }
 async closePlanner(){
  if (this.lifecycleWork) await this.lifecycleWork;
  if (this.pendingTransition) await this.ensureLifecycle();
  await this.finalizePlanner();
  return this.closeSafe();
 }
 async closeSafe(){
  if(this.readOnly)return true;
  try{await this.flush();return true;}catch{return this.protected;}
 }
 async directAdd(entries){
  const {Notice}=require("obsidian"),{ownNoticeColors}=require("../ui/color-system");
  try{
   await this.ensureLifecycle();if(entries.some(e=>e.kind==="file"))await this.references.audit();
   const id=this.active()?.id??await this.createPlan(),count=this.add(entries,id);
   await this.flush();
   const notice=ownNoticeColors(new Notice(count?`${count} added to plan`:"Already in plan"));
   if(count&&notice.noticeEl){const button=notice.noticeEl.createEl("button",{text:"Undo"});button.onclick=()=>{try{this.undo(id);}catch(error){ownNoticeColors(new Notice(error.message));}};}
  }catch(error){ownNoticeColors(new Notice(error.message));}
 }
}
module.exports={GlobalPlanService};
