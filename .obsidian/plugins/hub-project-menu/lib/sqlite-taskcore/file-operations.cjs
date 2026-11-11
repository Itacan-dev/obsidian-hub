"use strict";
// Four Itacan filesystem operations, coordinated through the existing DB queue.
// Filesystem work is deliberately outside these short SQLite transactions.
const V=require('./validation.cjs'),S=require('./sync-data.cjs');
const equal=(a,b)=>V.canonical(a)===V.canonical(b);
const context=value=>V.metadata({context:value});
function endpoint(value){V.fields(value,['ownerId','context'],['ownerId','context']);V.id(value.ownerId);context(value.context);}
function validate(intent){
 V.check(intent&&['rename','move','trash','copy'].includes(intent.kind),'Unsupported filesystem operation');
 V.text(intent.requestHash,64);V.check(/^[a-f0-9]{64}$/.test(intent.requestHash),'Invalid filesystem request identity');
 V.text(intent.from,32768);if(intent.kind==='trash')V.check(intent.to===null,'Trash has no destination');else V.text(intent.to,32768);
 V.check(Array.isArray(intent.mappings),'Location mappings required');
 const seen=new Set();
 for(const m of intent.mappings){endpoint(m.from);endpoint(m.to);endpoint(m.fallback);V.check(Array.isArray(m.phases)&&m.phases.every(p=>typeof p==='string'),'Destination phases required');const k=V.canonical(m.from);V.check(!seen.has(k),'Duplicate location mapping');seen.add(k);}
 V.check(intent.kind!=='copy'||!intent.mappings.length,'Copies cannot migrate tasks');
 V.check(Buffer.byteLength(V.canonical(intent))<=16*1024*1024,'Filesystem intent too large');
}
function pending(e){const row=e.one('SELECT * FROM pending_file_operations WHERE slot=1');return row?{operationId:row.operation_id,intent:JSON.parse(row.intent_json),progress:JSON.parse(row.progress_json),createdAt:row.created_at,updatedAt:row.updated_at}:null;}
function match(m,ownerId,c){return m.from.ownerId===ownerId&&equal(m.from.context,c);}
function blocked(e,c){
 const p=pending(e);if(!p||c.type==='owner.put')return;
 const maps=p.intent.mappings,hit=(ownerId,ctx)=>maps.some(m=>match(m,ownerId,ctx));
 let task=c.taskId?e.task(c.taskId,true):null;
 let affected=task&&hit(task.ownerId,task.context);
 if(task?.recurrence){const series=e.one('SELECT * FROM recurrence_series WHERE id=?',task.recurrence.seriesId),template=JSON.parse(series.template_json);affected||=hit(series.owner_id,template.context)||!!e.all('SELECT t.owner_id,t.context_json FROM tasks t JOIN occurrences o ON o.task_id=t.id WHERE o.series_id=?',series.id).find(t=>hit(t.owner_id,t.context_json===null?null:JSON.parse(t.context_json)));}
 const proposed=c.task??(c.patch?{...task,...c.patch}:null);
 affected||=proposed&&hit(proposed.ownerId,proposed.context??null);
 V.check(!affected,'A filesystem operation is reconciling this task or location. Resolve it before editing.','FILE_OPERATION_PENDING');
}
function syncGuard(e){
 const p=pending(e);if(!p)return null;
 const hit=(owner,c)=>p.intent.mappings.some(m=>match(m,owner,c)),ids=new Set(),series=new Set();
 for(const t of e.all('SELECT id,owner_id,context_json FROM tasks'))if(hit(t.owner_id,t.context_json===null?null:JSON.parse(t.context_json))){ids.add(t.id);const o=e.one('SELECT series_id FROM occurrences WHERE task_id=?',t.id);if(o)series.add(o.series_id);}
 for(const s of e.all('SELECT id,owner_id,template_json FROM recurrence_series'))if(hit(s.owner_id,JSON.parse(s.template_json).context))series.add(s.id);
 for(const sid of series)for(const o of e.all('SELECT task_id FROM occurrences WHERE series_id=?',sid))ids.add(o.task_id);
 const data=S.taskData(e,[...ids].sort(),{complete:true});delete data.owners;delete data.operations;const owners=new Set(p.intent.mappings.flatMap(m=>[m.from.ownerId,m.to.ownerId,m.fallback.ownerId]));data.ownership=[...owners].sort().map(id=>e.one('SELECT id,kind,external_id FROM owners WHERE id=?',id)??{id,missing:true});
 for(const rows of Object.values(data))rows.sort((a,b)=>(a.id??a.task_id).localeCompare(b.id??b.task_id));
 return V.canonical(data);
}
function migrate(e,p,indices,now){
 const mappings=indices.map(i=>({...p.intent.mappings[i],to:p.progress.destinations?.[i]??p.intent.mappings[i].to,fallback:p.progress.fallbacks?.[i]??p.intent.mappings[i].fallback})),changed=new Set(),snapshotIds=new Set(),previousOwners={};
 // Query stored tasks, including completed tasks and tombstones; never a UI page.
 const before=e.all('SELECT id,owner_id,context_json,phase_id FROM tasks');
 const destinations=new Map();
 for(const t of before){const c=t.context_json===null?null:JSON.parse(t.context_json),m=mappings.find(m=>match(m,t.owner_id,c));if(!m)continue;
  const phase=m.to.ownerId===t.owner_id?t.phase_id:m.phases.includes(t.phase_id)?t.phase_id:null;
  if(m.to.ownerId===t.owner_id&&equal(c,m.to.context)&&phase===t.phase_id)continue;
  V.check(e.one('SELECT id FROM owners WHERE id=?',m.to.ownerId),'Destination owner is unavailable','OWNER_UNAVAILABLE');
  e.run('UPDATE tasks SET owner_id=?,context_json=?,phase_id=?,revision=revision+1,modified_at=? WHERE id=?',m.to.ownerId,m.to.context===null?null:JSON.stringify(m.to.context),phase,now,t.id);
  destinations.set(t.id,{...m.to,phaseId:phase});changed.add(t.id);previousOwners[t.id]=[t.owner_id];
 }
 for(const s of e.all('SELECT * FROM recurrence_series')){
  const template=JSON.parse(s.template_json),frontier=e.one('SELECT task_id FROM occurrences WHERE series_id=? ORDER BY ordinal DESC LIMIT 1',s.id),target=destinations.get(frontier?.task_id),m=mappings.find(m=>match(m,s.owner_id,template.context));
  let owner=s.owner_id,next={...template};
  if(target){owner=target.ownerId;next.context=target.context;next.phaseId=target.phaseId;}
  else if(m){const to=m.to.ownerId===s.owner_id?m.to:m.fallback;owner=to.ownerId;next.context=to.context;/* A retained owner keeps its compatible phase. */}
  if(owner!==s.owner_id||!equal(next,template)){
   e.run('UPDATE recurrence_series SET owner_id=?,template_json=?,revision=revision+1,modified_at=? WHERE id=?',owner,JSON.stringify(next),now,s.id);
   // Existing replication units include the whole series; keep every occurrence
   // identity, successor marker and historical owner in the portable snapshot.
   for(const o of e.all('SELECT task_id FROM occurrences WHERE series_id=?',s.id))snapshotIds.add(o.task_id);
  }
 }
 for(const id of changed)snapshotIds.add(id);
 return{changed:[...changed],snapshotIds:[...snapshotIds],previousOwners};
}
function run(e,input){
 V.check(input&&typeof input.action==='string','Filesystem action required');
 return e.enqueue(()=>{
  if(input.action==='list')return pending(e)?[pending(e)]:[];
  V.id(input.operationId);const now=e.clock();let committed=false,changes=[];
  e.db.exec('BEGIN IMMEDIATE');
  try{
   const receipt=e.one('SELECT result_json,command_hash FROM operations WHERE operation_id=?',input.operationId);
   if(receipt){const result=JSON.parse(receipt.result_json);V.check(result.fileOperation,'Operation ID was used by a task command','OPERATION_ID_CONFLICT');if(input.action==='prepare'){validate(input.intent);V.check(receipt.command_hash===S.hash(input.intent),'Operation ID was used for another filesystem intent','OPERATION_ID_CONFLICT');}if(input.requestHash)V.check(result.requestHash===input.requestHash,'Operation ID was used for another filesystem request','OPERATION_ID_CONFLICT');e.db.exec('COMMIT');return{...result,replayed:true};}
   const p=pending(e);
   if(input.action==='prepare'){
    validate(input.intent);const hash=S.hash(input.intent);
    V.check(!p||p.operationId===input.operationId,'Resolve the pending filesystem operation first.','FILE_OPERATION_PENDING');
    if(p){V.check(equal(p.intent,input.intent),'Filesystem operation intent changed','OPERATION_ID_CONFLICT');e.db.exec('COMMIT');return p;}
    for(const m of input.intent.mappings)for(const endpoint of [m.from,m.to,m.fallback])V.check(e.one('SELECT id FROM owners WHERE id=?',endpoint.ownerId),'Refresh workspace ownership before changing files.','OWNER_UNAVAILABLE');
    if(input.intent.compensationReceiptId){
     V.id(input.intent.compensationReceiptId);const original=e.one('SELECT result_json FROM operations WHERE operation_id=?',input.intent.compensationReceiptId),receipt=original?JSON.parse(original.result_json):null;
     V.check(receipt?.fileOperation&&receipt.taskRevisions,'Original movement receipt is unavailable; preserve the files for review.','FILE_OPERATION_UNRESOLVED');
     const unchanged=Object.entries(receipt.taskRevisions).every(([id,revision])=>e.one('SELECT revision FROM tasks WHERE id=?',id)?.revision===revision)&&Object.entries(receipt.seriesRevisions??{}).every(([id,revision])=>e.one('SELECT revision FROM recurrence_series WHERE id=?',id)?.revision===revision);
     const associated=e.all('SELECT id,owner_id,context_json FROM tasks').filter(t=>input.intent.mappings.some(m=>match(m,t.owner_id,t.context_json===null?null:JSON.parse(t.context_json))));
     V.check(unchanged&&associated.every(t=>Object.hasOwn(receipt.taskRevisions,t.id)),'Task state changed after the original movement. Compensation is unsafe; files and current task metadata were preserved.','FILE_OPERATION_UNRESOLVED');
    }
    if(input.intent.requireUnreferenced){
     const hit=(owner,c)=>input.intent.mappings.some(m=>match(m,owner,c));
     V.check(!e.all('SELECT owner_id,context_json FROM tasks').some(t=>hit(t.owner_id,t.context_json===null?null:JSON.parse(t.context_json)))&&!e.all('SELECT owner_id,template_json FROM recurrence_series').some(s=>hit(s.owner_id,JSON.parse(s.template_json).context)),'Task references were added after capture. Reversal would leave their workspace; preserve the files and review recovery.','FILE_OPERATION_UNRESOLVED');
    }
    e.run('INSERT INTO pending_file_operations VALUES(1,?,?,?,?,?,?)',input.operationId,V.canonical(input.intent),hash,JSON.stringify({phase:'prepared'}),now,now);
    e.db.exec('COMMIT');committed=true;e.boundary('filePrepared',input.operationId);return pending(e);
   }
   V.check(p?.operationId===input.operationId,'Pending filesystem operation not found','NOT_FOUND');
   if(input.action==='progress'){
    V.check(['started','filesystem-complete','review'].includes(input.progress?.phase),'Invalid filesystem progress');
    V.check(p.progress.phase!=='filesystem-complete'||input.progress.phase==='filesystem-complete','Completed filesystem evidence cannot be reversed');
    if(input.progress.indices!==undefined)V.check(Array.isArray(input.progress.indices)&&new Set(input.progress.indices).size===input.progress.indices.length&&input.progress.indices.every(i=>Number.isInteger(i)&&i>=0&&i<p.intent.mappings.length),'Invalid resolved mappings');
    for(const field of ['fallbacks','destinations'])if(input.progress[field])for(const [key,value]of Object.entries(input.progress[field])){
     const m=p.intent.mappings[+key];V.check(m,'Invalid mapping index');endpoint(value);
     V.check((field==='fallbacks'||p.intent.kind==='trash')&&[m.fallback,...(m.ancestors??[]).map(a=>a.endpoint)].some(a=>equal(a,value)),'Unprepared reassignment destination');
    }
    e.run('UPDATE pending_file_operations SET progress_json=?,updated_at=? WHERE slot=1',V.canonical({...p.progress,...input.progress}),now);e.db.exec('COMMIT');committed=true;e.boundary('fileProgress',input.operationId);return pending(e);
   }
   V.check(['commit','cancel'].includes(input.action),'Unsupported filesystem action');
   if(input.action==='cancel')V.check(p.progress.phase==='prepared'||p.progress.cancelSafe===true,'Filesystem outcome must be checked before cancellation','FILE_OPERATION_UNRESOLVED');
   else V.check(p.progress.phase==='filesystem-complete','Filesystem outcome has not been verified','FILE_OPERATION_UNRESOLVED');
   if(input.action==='cancel'){e.run('DELETE FROM pending_file_operations WHERE slot=1');e.db.exec('COMMIT');return{operationId:input.operationId,cancelled:true};}
   const intentHash=e.one('SELECT intent_hash FROM pending_file_operations WHERE slot=1').intent_hash;
   e.run("INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,'{}',?)",input.operationId,intentHash,now);
   const migrated=input.action==='commit'?migrate(e,p,p.progress.indices??p.intent.mappings.map((_,i)=>i),now):{changed:[],snapshotIds:[],previousOwners:{}};
   const result={operationId:input.operationId,sequence:e.sequence(),fileOperation:true,requestHash:p.intent.requestHash,kind:p.intent.kind,cancelled:input.action==='cancel',partial:!!p.progress.partial,taskIds:migrated.changed,taskRevisions:Object.fromEntries(migrated.snapshotIds.map(id=>[id,e.one('SELECT revision FROM tasks WHERE id=?',id).revision])),seriesRevisions:Object.fromEntries(S.taskData(e,migrated.snapshotIds).series.map(s=>[s.id,s.revision])),taskId:null,taskRevision:null,successorId:null,historyIds:[],owner:null};
   e.run('UPDATE operations SET result_json=? WHERE operation_id=?',JSON.stringify(result),input.operationId);
   const data=S.taskData(e,migrated.snapshotIds,{complete:true});changes=S.notify(e,{...data,previousOwners:migrated.previousOwners},input.operationId,'filesystem.'+p.intent.kind);
   const sync=S.capture(e,{taskIds:migrated.snapshotIds,historyIds:[],operationId:input.operationId,commandHash:intentHash,complete:true});
   if(sync&&changes.length){const first=changes[0];e.run('UPDATE outbox SET change_json=? WHERE sequence=? AND owner_id=?',JSON.stringify({...first,sync}),first.sequence,first.ownerId);}
   e.run('DELETE FROM pending_file_operations WHERE slot=1');e.boundary('fileBeforeCommit',input.operationId);e.db.exec('COMMIT');committed=true;e.boundary('fileAfterCommit',input.operationId);
   for(const c of changes)e.publish(c);return result;
  }catch(error){if(!committed)try{e.db.exec('ROLLBACK')}catch{}if(committed)throw new V.TaskError('OUTCOME_UNKNOWN','Resolve original filesystem operation '+input.operationId);throw error;}
 });
}
module.exports={run,pending,blocked,syncGuard};
