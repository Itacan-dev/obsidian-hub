"use strict";
// Itacan application boundary: existing visual components receive committed tasks.
const {randomUUID,createHash}=require('node:crypto'),{TaskModel}=require('./ui/model.cjs');
// Presentation equality only; command validation and SQL stay in the utility.
const V={check(yes,message,code='INVALID_COMMAND'){if(!yes)throw Object.assign(Error(message),{code})},canonical(value){if(Array.isArray(value))return'['+value.map(V.canonical).join(',')+']';if(value&&typeof value==='object')return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+V.canonical(value[k])).join(',')+'}';return JSON.stringify(value)}};
const key=owner=>JSON.stringify([owner.type,owner.id]),same=(a,b)=>!!a&&!!b&&a.type===b.type&&a.id===b.id;
function stableId(value){const h=createHash('sha256').update(JSON.stringify(value)).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
function createApplication({plugin,service,authorityId,locations,openEditor,openCreator,pendingStore=null,metadataReady=Promise.resolve(),onError=console.error}){
 const wizard=plugin.projectWizard,listeners=new Set(),historyListeners=new Set(),records=new Map(),dbOwners=new Map(),runtimes=new Map();let syncState={state:'disabled'},state='opening',closed=false,closing=null,notification=null,metadataWork=Promise.resolve();
 let stopStartup;const startupStopped=new Promise(resolve=>{stopStartup=resolve});
 const ownerId=owner=>stableId([authorityId,owner.type,owner.id]);
 const refOf=w=>w.contextKind==='resource'?{type:'resource',id:w.resourceType??w.id}:{type:'project',id:w.projectId};
 function collect(){const values=[...wizard.getProjectRecords(),...wizard.getResourceTypes()],seen=new Set();records.clear();for(const w of values){const owner=refOf(w);if(!owner.id)continue;const k=key(owner);if(seen.has(k))throw Error('Ambiguous task owner: '+k);seen.add(k);records.set(k,{...w,owner,dbId:ownerId(owner),available:!w.deleted&&(owner.type==='resource'||['active','future','shelved'].includes(w.status))});}}
 collect();
 function record(owner){const r=records.get(key(owner));if(!r||!r.available)throw Object.assign(Error('Task workspace unavailable'),{code:'OWNER_UNAVAILABLE'});return r;}
 function ownerRecord(id){const live=[...records.values()].find(r=>r.dbId===id);if(live)return live;const o=dbOwners.get(id);return o?{owner:{type:o.kind,id:o.externalId},name:o.label,available:o.available}:null;}
 function context(owner){const r=record(owner);return{owner,root:r.root,dashboard:r.path,status:r.status??'active'};}
 function notify(change={reset:true}){if(closed)return;for(const l of listeners)if(change.reset||!l.ownerId||(change.ownerIds??[]).includes(l.ownerId))l.dirty=true;if(notification!==null)return;notification=setTimeout(()=>{notification=null;for(const l of [...listeners])if(l.dirty){l.dirty=false;try{l.fn()}catch(e){onError(e)}}},0);}
 function subscribe(owner,fn){const l={ownerId:owner?ownerId(owner):null,fn,dirty:false};listeners.add(l);return()=>listeners.delete(l);}
 const model=new TaskModel(service,{changed(change){if(change.available&&model.started&&state!=='ready'&&!closed){state='ready';notify({reset:true});return;}const ownerIds=new Set(change.ownerIds??[]);for(const id of change.taskIds??[]){const t=model.tasks.get(id);if(t)ownerIds.add(t.ownerId);}if(change.reset)notify({reset:true});else if(ownerIds.size)notify({ownerIds:[...ownerIds]});},failed(error){const changed=state!=='unavailable';state='unavailable';if(changed)notify();onError(error)}});
 const stopChanges=service.subscribe({},change=>{notify({ownerIds:[change.ownerId]});if(change.historyIds.length)for(const fn of [...historyListeners])try{fn(change)}catch(e){onError(e)}});
 async function registerOwners(){
  collect();const old=await service.listOwners();const desired=[...records.values()].map(r=>({id:r.dbId,kind:r.owner.type,externalId:r.owner.id,label:r.name??r.label??r.owner.id,available:r.available}));
  for(const o of old.owners)if(!desired.some(n=>n.id===o.id))desired.push({...o,available:false});
  for(const owner of desired){if(JSON.stringify(old.owners.find(o=>o.id===owner.id))!==JSON.stringify(owner))await service.execute({type:'owner.put',operationId:randomUUID(),owner});dbOwners.set(owner.id,owner);}
 }
 async function execute(command){
  if(closed)throw Error('Task application closed');await ready;
  // A small saved original command lets a lost acknowledgement/restart retry its ID.
  pendingStore?.put(command);
  try{const result=await service.execute(command);if(model.started)state='ready';model.install(result);pendingStore?.remove(command.operationId);return result;}
  catch(error){error.operationId=command.operationId;if(!['SERVICE_EXITED','OUTCOME_UNKNOWN','BUSY'].includes(error.code))pendingStore?.remove(command.operationId);throw error;}
 }
 function currentTask(input){const id=input.nativeReference?.taskId??input.id,t=model.tasks.get(id);if(!t)throw Error('Task no longer available');const revision=input.nativeReference?.taskRevision??input.revision;V.check(revision===t.revision,'Task changed; reopen it','STALE_REVISION');return t;}
 function view(t){const r=ownerRecord(t.ownerId),owner=r?.owner??{type:t.ownerKind,id:'unavailable'};
  const location=t.context?{type:t.context.kind,id:t.context.reference}:null;
  const display=locations?.describe(owner,location);
  return{id:t.id,revision:t.revision,nativeReference:{authorityId,owner:{...owner},taskId:t.id,taskRevision:t.revision},owner:{...owner},location,text:t.title,description:t.description,completed:t.completed,completedAt:t.completionEvent?.completedAt??null,completionEvent:t.completionEvent,necessity:t.importance,fromDate:t.startDate,fromTime:t.startTime,dueDate:t.dueDate,dueTime:t.dueTime,phaseId:t.phaseId,recurrence:t.recurrence,steps:t.steps.map(s=>({...s})),nativeReadOnly:state!=='ready'||!t.ownerAvailable,...(display?{nativeLocationDisplay:display,nativeLocationUnavailable:!display.available}:{})};
 }
 function snapshot(owner){const available=!!records.get(key(owner))?.available;return{tasks:[...model.tasks.values()].filter(t=>t.ownerId===ownerId(owner)).map(view),availability:!available?'unavailable':state==='ready'?'current':state==='opening'?'loading':'unavailable',context:available?context(owner):null,diagnostics:[],sequence:model.cursor};}
 function validateValues(owner,values){
  record(owner);let location=null;
  if(values.nativeLocation){const item=locations?.resolveId(owner,values.nativeLocation);if(!item)throw Error('Choose an available task location');location={kind:item.type,reference:item.reference.id};}
  const phaseId=values.phaseId||null;if(phaseId&&(owner.type!=='project'||!plugin.planning.phases(owner.id).some(p=>p.id===phaseId)))throw Error('Choose an available Phase in this Project');
  return{title:String(values.text??'').trim(),description:values.description??'',startDate:values.fromDate||null,startTime:values.fromTime||null,dueDate:values.dueDate||null,dueTime:values.dueTime||null,importance:values.necessity??null,context:location,phaseId};
 }
 function steps(values){return(values.steps??[]).map(s=>({...(s.id?{id:s.id}:{}),text:s.text,completed:!!s.completed}));}
 function recurrence(values,task=null){const draft=values.recurrenceDraft;if(!draft)return undefined;const prior=task?.recurrence;
  if(draft.frequency==='none')return prior?.active?{action:'stop',expectedSeriesRevision:prior.seriesRevision}:undefined;
  const rule={frequency:draft.frequency,interval:draft.interval,zone:draft.zone,startDate:prior?prior.rule.startDate:values.fromDate||null,dueDate:prior?prior.rule.dueDate:values.dueDate||null};
  if(!prior)return task?{action:'define',rule}:rule;
  if(!prior.active)throw Error('This series was stopped. Create a new recurring task.');
  const changed=V.canonical(rule)!==V.canonical(prior.rule);return changed||draft.updateTemplate?{action:'edit',expectedSeriesRevision:prior.seriesRevision,...(changed?{rule}:{}),...(draft.updateTemplate?{updateTemplate:true}:{})}:undefined;
 }
 function edit(result,owner){return{backend:'native',authorityId,owner,outcome:{status:result.replayed?'replayed':'committed',operationId:result.operationId},availability:'current',tasks:snapshot(owner).tasks,context:context(owner),sequence:result.sequence,result};}
 function formService(owner){let retained=null;
  async function issue(values,build){const fingerprint=V.canonical(JSON.parse(JSON.stringify(values)));if(retained&&retained.fingerprint!==fingerprint)throw Error('Retry the original saved request before changing it');retained??={fingerprint,command:build()};const result=await execute(retained.command);retained=null;return edit(result,owner);}
  return{app:plugin.app,nativeOwner:owner,nativeLocations:locations,context:()=>record(owner),workspaceContext:target=>record(target),phases:(_path,target=owner)=>target.type==='project'?plugin.planning.phases(target.id):[],formContext:s=>({destination:{authorityId,owner},sourcePath:record(owner).path,sourceLabel:record(owner).name??record(owner).label,nativeOwner:owner,nativeLocation:s?.nativeLocation??''}),
   async read(input){await ready;const result=await service.getTask(input.nativeReference?.taskId??input.id);if(!result.task)throw Error('Task no longer available');model.installTask(result.task,result.sequence);const t=result.task;return{...view(t),text:t.title,steps:t.steps.map(s=>({...s})),nativeOwner:view(t).owner,nativeLocation:t.context?.reference??'',nativeLocationType:t.context?.kind};},
   create(destination,text,values){const target=values.nativeOwner??owner;record(target);V.check(destination.authorityId===authorityId,'Task destination changed');return issue({...values,text},()=>({type:'task.create',operationId:randomUUID(),task:{...validateValues(target,{...values,text}),id:randomUUID(),ownerId:ownerId(target),completed:!!values.completed,steps:steps(values),...(recurrence(values)?{recurrence:recurrence(values)}:{})}}));},
   save(original,values){return issue(values,()=>{const t=currentTask(original),base={operationId:randomUUID(),taskId:t.id,expectedRevision:t.revision};if(values.operation==='delete')return{...base,type:'task.delete'};const target=values.nativeOwner??owner,repeat=recurrence(values,t);return{...base,type:'task.edit',patch:{...validateValues(target,values),ownerId:ownerId(target)},steps:steps(values),completed:!!values.completed,...(repeat?{recurrence:repeat}:{})}});}
  };
 }
 function runtime(owner){record(owner);const k=key(owner);if(runtimes.has(k))return runtimes.get(k);
  const r={owner,info:()=>({authority:{backend:'native',authorityId},owner,engine:'sqlite',synchronization:syncState.state}),async list(){await ready;return snapshot(owner)},formService:()=>formService(owner),execute,
   async setRecurrence(input,rule){const t=currentTask(input),c={operationId:randomUUID(),taskId:t.id,expectedRevision:t.revision};return edit(await execute(t.recurrence?{...c,type:'recurrence.edit',expectedSeriesRevision:t.recurrence.seriesRevision,...(rule?{rule}:{updateTemplate:true})}:{...c,type:'recurrence.define',rule}),owner);},
   async stopRecurrence(input){const t=currentTask(input);return edit(await execute({type:'recurrence.stop',operationId:randomUUID(),taskId:t.id,expectedRevision:t.revision,expectedSeriesRevision:t.recurrence.seriesRevision}),owner)},
   async createTask(values,operationId=randomUUID(),taskId=randomUUID()){const repeat=recurrence(values);return execute({type:'task.create',operationId,task:{...validateValues(owner,values),id:taskId,ownerId:ownerId(owner),steps:steps(values),completed:!!values.completed,...(repeat?{recurrence:repeat}:{})}})},
   getOperation:id=>service.getOperation(id)};runtimes.set(k,r);return r;
 }
 function createPanelRead({component,workspace:owner,changed=()=>{}}){let disposed=false,last=null;const editors=new Set(),stop=subscribe(owner,changed);const close=()=>{if(disposed)return;disposed=true;stop();for(const modal of editors)if(!modal.saving)modal.close();editors.clear()};component.register(close);
  async function change(input,completed,step=null){if(disposed)throw Error('Task view closed');const t=currentTask(input);record(owner);V.check(same(view(t).owner,owner),'Task owner changed');const result=await execute({type:step?'step.setCompleted':'task.setCompleted',operationId:randomUUID(),taskId:t.id,expectedRevision:t.revision,completed,...(step?{stepId:step.id}:{})});return edit(result,owner);}
  const panel={close,availability:()=>snapshot(owner).availability,snapshot:()=>({...snapshot(owner),changed:true}),async read(){await ready;if(disposed)return null;const s=snapshot(owner);return{...s,changed:JSON.stringify(s.tasks)!==last}},async observe(){return panel.read()},accept(tasks){last=JSON.stringify(tasks)},reconcile(_items,result){if(disposed)return[];if(result.authorityId!==authorityId)throw Error('Task application changed');return snapshot(owner).tasks},toggle:(task,done)=>change(task,done),actions:{mutate:request=>change(request,request.operation==='step'?request.stepCompleted:request.completed,request.operation==='step'?request.step:null),editTask(task,saved){if(disposed)throw Error('Task view closed');const modal=openEditor(formService(owner),task,result=>{if(!disposed)saved?.(result)});editors.add(modal);return modal}},create:options=>openCreator(formService(owner),options)};return panel;
 }
 async function history(){await ready;let after=null,events=[];do{const page=await service.readHistory({after,limit:1000});events.push(...page.events);after=page.next;}while(after);const rows=events.filter(e=>e.counted).map(e=>{const r=ownerRecord(e.ownerId),owner=r?.owner??{type:'project',id:'unavailable'};return{id:e.id,kind:e.stepId?'step':'task',text:e.title,...(e.stepId?{parentText:e.parentTitle}:{}),timestamp:e.completedAt,projectId:owner.type==='resource'?'resource:'+owner.id:owner.id,contextKind:owner.type,resourceType:owner.type==='resource'?owner.id:null,projectName:r?.name??r?.label,projectStatus:r?.status??'active',historyReadKey:JSON.stringify(['sqlite-history',authorityId,e.id]),nativeHistory:{authorityId,eventId:e.id,taskId:e.taskId,stepId:e.stepId,owner,navigation:{state:model.tasks.has(e.taskId)?'available':'unavailable'}}}}).sort((a,b)=>b.timestamp-a.timestamp||a.id.localeCompare(b.id));return{records:rows,completions:rows.map(({nativeHistory,historyReadKey,...r})=>r),diagnostics:[]};}
 const completionFeed={read:history,subscribe(fn){historyListeners.add(fn);return()=>historyListeners.delete(fn)},async reveal(row){const ref=row.nativeHistory,t=model.tasks.get(ref.taskId);if(!t)throw Error('Completed task was deleted');return openEditor(formService(view(t).owner),view(t),()=>{})}};
 const nativeTasks={get owners(){return[...records.values()].filter(r=>r.available).map(r=>r.owner)},availability:()=>state==='ready'?'current':state==='opening'?'loading':'unavailable',availabilityFor:owner=>records.get(key(owner))?.available?nativeTasks.availability():'unavailable',createPanelRead,taskKey:t=>JSON.stringify([authorityId,t.id]),mergeHome(accepted,tasks,owner,c,resolve){const w=resolve(owner);if(!w||w.root!==c.root||w.path!==c.dashboard)throw Error('Task owner context changed');return[...accepted.filter(i=>!same(i.task.nativeReference.owner,owner)),...tasks.map(task=>({task,owner:w,phaseLabel:null}))]}};
 const ready=(async()=>{await Promise.race([service.ready,startupStopped]);if(closed)return;await Promise.race([metadataReady,startupStopped]);if(closed)return;if(service.syncStatus){syncState=await service.syncStatus();if(syncState.workspaceId&&syncState.state!=='enrollment-required')authorityId=syncState.authorityId;}await registerOwners();for(const command of pendingStore?.list()??[]){await service.execute(command);pendingStore.remove(command.operationId)}await model.start();if(closed)return;state='ready';notify();})().catch(error=>{state='unavailable';notify();onError(error);throw error});ready.catch(()=>{});
 const host={ready,nativeTasks,completionFeed,runtime,matches:owner=>!!records.get(key(owner))?.available,status:()=>({mode:'sqlite',synchronization:syncState.state,owners:[...records.values()].map(r=>({owner:r.owner,state:state==='ready'&&r.available?'ready':state}))}),
  async setSyncStatus(value){const changed=value.authorityId!==authorityId&&value.workspaceId&&value.state!=='enrollment-required';syncState=value;if(changed){authorityId=value.authorityId;await host.refreshInventory();await model.refresh();}return syncState;},
  refreshInventory(){metadataWork=metadataWork.catch(()=>{}).then(async()=>{await ready;await registerOwners();notify();});return metadataWork;},
  create(options={}){V.check(state==='ready','Tasks are still loading. Try again shortly.','TASKS_LOADING');const owner=options.owner??refOf(wizard.getContextForPath(options.location??options.path??options.root??plugin.app.workspace.getActiveFile?.()?.path)??wizard.getResourceById('references'));record(owner);return openCreator(formService(owner),options)},
  retryOriginal:execute,
  close(){if(closing)return closing;closed=true;stopStartup();clearTimeout(notification);stopChanges();listeners.clear();historyListeners.clear();closing=(async()=>{await ready.catch(()=>{});model.close();await metadataWork.catch(()=>{});await service.close()})();return closing;},
  setState(value){if(closed||value==='ready'&&!model.started)return;state=value==='ready'?'ready':value==='reconnecting'?'opening':'unavailable';notify();if(model.started&&(value==='ready'||value==='reconnecting'))void model.refresh()}
 };return host;
}
module.exports={createApplication,stableId};
