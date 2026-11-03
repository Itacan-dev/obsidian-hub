"use strict";
// SQLite's controlled replication boundary. Called only inside the engine queue.
// Vectors identify task/series ancestry; they never use wall-clock ordering.
const V=require('./validation.cjs'),R=require('./recurrence.cjs'),{randomUUID,createHash}=require('node:crypto');
const columns={
 owners:['id','kind','external_id','label','available'],
 tasks:['id','owner_id','revision','title','description','completed','completed_at','start_date','start_time','due_date','due_time','importance','context_json','phase_id','created_at','modified_at','deleted_at'],
 steps:['id','task_id','position','text','completed','completed_at','created_at','modified_at','deleted_at'],
 history:['id','operation_id','task_id','step_id','owner_id','title','parent_title','completed_at','counted','reopened_at'],
 series:['id','owner_id','revision','active','rule_json','template_json','created_at','modified_at'],
 occurrences:['task_id','series_id','ordinal','series_revision','successor_id','generated'],
 operations:['operation_id','command_hash','result_json','committed_at']
};
// Opaque logical writers are separate from the private OneDrive device identity.
function logicalWriter(device){const h=createHash('sha256').update('itacan-logical-writer:'+device).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);}
function normalize(p){if(p.writerId)return p;const cv=v=>Object.fromEntries(Object.entries(v).map(([k,n])=>[logicalWriter(k),n]));return {...p,writerId:logicalWriter(p.deviceId),bases:Object.fromEntries(Object.entries(p.bases).map(([u,v])=>[u,cv(v)])),versions:Object.fromEntries(Object.entries(p.versions).map(([u,v])=>[u,cv(v)]))};}
function migrateLogicalWriters(e){
 for(const r of e.all('SELECT * FROM sync_versions')){const v=Object.fromEntries(Object.entries(JSON.parse(r.version_json)).map(([k,n])=>[logicalWriter(k),n]));e.run('UPDATE sync_versions SET version_json=? WHERE unit=?',JSON.stringify(v),r.unit);}
 for(const r of e.all("SELECT operation_id,payload_json FROM sync_received WHERE state IN ('pending','conflict')"))e.run('UPDATE sync_received SET payload_json=? WHERE operation_id=?',JSON.stringify(normalize(JSON.parse(r.payload_json))),r.operation_id);
}
function record(e,p){e.run('INSERT INTO sync_changes(operation_id,payload_json) VALUES(?,?) ON CONFLICT(operation_id) DO NOTHING',p.operationId,JSON.stringify(p));}
const table=k=>k==='series'?'recurrence_series':k;
const empty=()=>Object.fromEntries(Object.keys(columns).map(k=>[k,[]]));
const hash=v=>createHash('sha256').update(V.canonical(v)).digest('hex');
function setting(e,key,fallback=null){const r=e.one('SELECT value FROM sync_settings WHERE key=?',key);return r?JSON.parse(r.value):fallback;}
function set(e,key,value){e.run('INSERT INTO sync_settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));}
function vector(v){V.check(v&&typeof v==='object'&&!Array.isArray(v),'Invalid synchronization ancestry');V.check(Object.keys(v).length<=32,'Too many enrolled devices');for(const [id,n]of Object.entries(v)){V.id(id);V.check(Number.isSafeInteger(n)&&n>=0,'Invalid ancestry counter');}}
const le=(a,b)=>Object.entries(a).every(([k,n])=>n<=(b[k]??0));
const eq=(a,b)=>le(a,b)&&le(b,a);
const merge=(...vs)=>{const r={};for(const v of vs)for(const[k,n]of Object.entries(v))r[k]=Math.max(r[k]??0,n);return r;};
function heads(e,unit){return JSON.parse(e.one('SELECT version_json FROM sync_versions WHERE unit=?',unit)?.version_json??'{}');}
function putHeads(e,unit,v){e.run('INSERT INTO sync_versions VALUES(?,?) ON CONFLICT(unit) DO UPDATE SET version_json=excluded.version_json',unit,JSON.stringify(v));}
function units(data){return [...new Set([...data.tasks.map(t=>'task:'+t.id),...data.series.map(s=>'series:'+s.id)])].sort();}
function taskData(e,ids,{complete=false,historyIds=[]}={}){
 const d=empty(),owners=new Set(),ops=new Set(),series=new Set();
 for(const id of [...new Set(ids)]){
  const t=e.one('SELECT * FROM tasks WHERE id=?',id);if(!t)continue;d.tasks.push(t);owners.add(t.owner_id);
  const hs=complete?e.all('SELECT * FROM history WHERE task_id=?',id):e.all('SELECT * FROM history WHERE task_id=? AND counted=1',id);
  for(const hid of historyIds){const h=e.one('SELECT * FROM history WHERE id=? AND task_id=?',hid,id);if(h&&!hs.some(x=>x.id===h.id))hs.push(h);}
  d.history.push(...hs);for(const h of hs){owners.add(h.owner_id);ops.add(h.operation_id);}
  const ss=complete?e.all('SELECT * FROM steps WHERE task_id=?',id):e.all('SELECT * FROM steps WHERE task_id=? AND deleted_at IS NULL',id);
  for(const h of hs)if(h.step_id&&!ss.some(s=>s.id===h.step_id)){const s=e.one('SELECT * FROM steps WHERE id=?',h.step_id);if(s)ss.push(s);}
  d.steps.push(...ss);const o=e.one('SELECT * FROM occurrences WHERE task_id=?',id);if(o){d.occurrences.push(o);series.add(o.series_id);}
 }
 for(const id of series){const s=e.one('SELECT * FROM recurrence_series WHERE id=?',id);d.series.push(s);owners.add(s.owner_id);}
 for(const id of owners)d.owners.push(e.one('SELECT * FROM owners WHERE id=?',id));
 for(const id of ops)d.operations.push(e.one('SELECT operation_id,command_hash,result_json,committed_at FROM operations WHERE operation_id=?',id));
 return d;
}
function initialData(e){
 // Exclusions are an explicit, device-local installation audit of known retired
 // acceptance fixtures, never a title/date heuristic or a replay of old outbox.
 // Every real tombstone and uncounted History event otherwise belongs here.
 const excluded=new Set(setting(e,'baselineExclusions',[]));
 const ids=e.all('SELECT id,deleted_at FROM tasks').filter(t=>!excluded.has(t.id)||t.deleted_at===null||e.one('SELECT id FROM history WHERE task_id=? AND counted=1',t.id)).map(r=>r.id);
 const d=taskData(e,ids,{complete:true});d.owners=e.all('SELECT * FROM owners');return d;
}
function envelope(e,data,{operationId,commandHash,bases=null,replaceSeries=[],resolution=false}={}){
 if(!data.operations.some(o=>o.operation_id===operationId)){const original=e.one('SELECT operation_id,command_hash,result_json,committed_at FROM operations WHERE operation_id=?',operationId);if(original)data.operations.push(original);}
 const device=setting(e,'device'),number=setting(e,'next',0)+1;set(e,'next',number);
 bases??=Object.fromEntries(units(data).map(u=>[u,heads(e,u)]));
 const writerId=logicalWriter(device),versions=Object.fromEntries(Object.entries(bases).map(([u,b])=>[u,{...b,[writerId]:number}]));
 for(const[u,v]of Object.entries(versions))putHeads(e,u,v);
 const p={protocol:1,workspaceId:setting(e,'workspace'),deviceId:device,writerId,number,operationId,commandHash,data,bases,versions,replaceSeries,resolution};record(e,p);return p;
}
function capture(e,{taskIds,historyIds,operationId,commandHash,complete=false}){
 if(!setting(e,'workspace')||!taskIds.length)return null;
 return envelope(e,taskData(e,taskIds,{historyIds,complete}),{operationId,commandHash});
}
function initialize(e,{workspaceId,authorityId,deviceId}){
 V.id(workspaceId);V.id(authorityId);V.id(deviceId);
 const existing=setting(e,'workspace');V.check(!existing||existing===workspaceId,'Database belongs to another synchronization workspace','SYNC_WORKSPACE_MISMATCH');
 V.check(!setting(e,'device')||setting(e,'device')===deviceId,'Device identity does not match this database','SYNC_DEVICE_MISMATCH');
 if(!existing)set(e,'published',e.sequence());
 set(e,'workspace',workspaceId);set(e,'authority',authorityId);set(e,'device',deviceId);
}
function baseline(e,identity){
 initialize(e,identity);const data=initialData(e),versions=Object.fromEntries(units(data).map(u=>[u,heads(e,u)]));
 // Retained in SQLite until every part and the final manifest is published.
 const rows=[];for(const[k,rs]of Object.entries(data))for(const r of rs)rows.push({table:k,row:r});
 let part=[],bytes=0,index=0;e.run('DELETE FROM sync_baseline');
 for(const r of rows){const size=Buffer.byteLength(JSON.stringify(r));if(bytes+size>512*1024&&part.length){e.run('INSERT INTO sync_baseline VALUES(?,?)',index++,JSON.stringify(part));part=[];bytes=0;}part.push(r);bytes+=size;}
 if(part.length||!index)e.run('INSERT INTO sync_baseline VALUES(?,?)',index++,JSON.stringify(part));
 const info={protocol:1,workspaceId:identity.workspaceId,authorityId:identity.authorityId,deviceId:identity.deviceId,parts:index,position:e.sequence(),versions};set(e,'baselineInfo',info);return info;
}
function integer(v,nullable=false){V.check(nullable&&v===null||Number.isSafeInteger(v)&&v>=0,'Invalid synchronized number');}
function validateData(d){
 V.fields(d,Object.keys(columns),Object.keys(columns));
 for(const[k,rs]of Object.entries(d)){
  V.check(Array.isArray(rs)&&rs.length<=100000,'Synchronization table too large');const seen=new Set();
  for(const r of rs){V.fields(r,columns[k],columns[k]);const id=r.id??r.task_id??r.operation_id;V.id(id);V.check(!seen.has(id),'Duplicate synchronized identity');seen.add(id);
   for(const f of ['owner_id','task_id','series_id','operation_id'])if(r[f]!==undefined)V.id(r[f]);
   for(const f of ['step_id','successor_id'])if(r[f]!==undefined&&r[f]!==null)V.id(r[f]);
   for(const f of ['revision','position','ordinal','series_revision','created_at','modified_at','committed_at'])if(r[f]!==undefined)integer(r[f]);
   for(const f of ['completed_at','deleted_at','reopened_at'])if(r[f]!==undefined)integer(r[f],true);
   for(const f of ['completed','available','counted','active','generated'])if(r[f]!==undefined)V.check(r[f]===0||r[f]===1,'Invalid synchronized flag');
   if(r.revision!==undefined)V.check(r.revision>0,'Positive revision required');
   if(k==='owners'){V.check(['project','resource'].includes(r.kind),'Invalid owner');V.text(r.external_id,200);V.text(r.label,1000);}
   if(k==='tasks'){V.metadata({title:r.title,description:r.description,startDate:r.start_date,startTime:r.start_time,dueDate:r.due_date,dueTime:r.due_time,importance:r.importance,phaseId:r.phase_id,context:r.context_json===null?null:JSON.parse(r.context_json)});}
   if(k==='steps')V.text(r.text);
   if(k==='history'){V.text(r.title);if(r.parent_title!==null)V.text(r.parent_title);}
   if(k==='series'){R.rule(JSON.parse(r.rule_json));const t=JSON.parse(r.template_json);V.fields(t,['title','description','importance','context','phaseId','steps'],['title','description','importance','context','phaseId','steps']);V.metadata({title:t.title,description:t.description,importance:t.importance,context:t.context,phaseId:t.phaseId});V.check(Array.isArray(t.steps)&&t.steps.length<=1000,'Invalid recurrence template');for(const s of t.steps){V.fields(s,['templateId','text'],['templateId','text']);V.id(s.templateId);V.text(s.text);}}
   if(k==='operations'){V.check(/^[a-f0-9]{64}$/.test(r.command_hash),'Invalid operation hash');V.check(Buffer.byteLength(r.result_json)<=1024*1024,'Invalid operation result');const o=JSON.parse(r.result_json);V.check(o&&o.operationId===r.operation_id,'Invalid operation identity');}
  }
 }
}
function validate(p,workspace,device,number){
 V.fields(p,['protocol','workspaceId','deviceId','number','operationId','commandHash','data','bases','versions','replaceSeries','resolution','writerId','sharedProjection'],['protocol','workspaceId','deviceId','number','operationId','commandHash','data','bases','versions','replaceSeries','resolution']);
 V.check(p.protocol===1&&p.workspaceId===workspace&&p.deviceId===device&&p.number===number,'Synchronization file identity mismatch');V.id(p.workspaceId);V.id(device);V.id(p.operationId);integer(number);V.check(number>0&&/^[a-f0-9]{64}$/.test(p.commandHash),'Invalid synchronization operation');validateData(p.data);
 if(p.writerId!==undefined)V.id(p.writerId);if(p.sharedProjection!==undefined)V.check(p.sharedProjection===true,'Invalid shared projection');const writer=p.writerId??device;const us=units(p.data);V.check(V.canonical(Object.keys(p.bases).sort())===V.canonical(us)&&V.canonical(Object.keys(p.versions).sort())===V.canonical(us),'Invalid synchronization units');
 for(const u of us){vector(p.bases[u]);vector(p.versions[u]);V.check(eq(p.versions[u],{...p.bases[u],[writer]:number})&&(p.bases[u][writer]??0)<number,'Invalid operation ancestry');}
 V.check(typeof p.resolution==='boolean'&&Array.isArray(p.replaceSeries)&&p.replaceSeries.every(id=>p.data.series.some(s=>s.id===id))&&(p.resolution||p.replaceSeries.length===0),'Invalid series replacement');
 for(const r of [...p.data.tasks,...p.data.series,...p.data.history])V.check(p.data.owners.some(o=>o.id===r.owner_id),'Foreign owner reference');
 for(const h of p.data.history){V.check(p.data.tasks.some(t=>t.id===h.task_id),'Foreign History task');if(h.step_id)V.check(p.data.steps.some(s=>s.id===h.step_id&&s.task_id===h.task_id),'Foreign History Step');}
 for(const s of p.data.steps)V.check(p.data.tasks.some(t=>t.id===s.task_id),'Foreign Step');
 for(const o of p.data.occurrences)V.check(p.data.tasks.some(t=>t.id===o.task_id)&&p.data.series.some(s=>s.id===o.series_id),'Foreign occurrence');
}
function upsert(e,k,row){
 const cs=columns[k],pk=k==='occurrences'?'task_id':k==='operations'?'operation_id':'id';
 const old=e.one('SELECT * FROM '+table(k)+' WHERE '+pk+'=?',row[pk]);
 if(k==='owners'&&old){V.check(old.kind===row.kind&&old.external_id===row.external_id,'Owner identity collision');return;}
 if(k==='operations'&&old){V.check(old.command_hash===row.command_hash,'Operation identity collision');return;}
 if(k==='steps'&&old)V.check(old.task_id===row.task_id,'Step identity collision');
 if(k==='occurrences'&&old)V.check(old.series_id===row.series_id&&old.ordinal===row.ordinal,'Occurrence identity collision');
 if(k==='history'&&old)V.check(old.task_id===row.task_id&&old.step_id===row.step_id&&old.operation_id===row.operation_id,'History identity collision');
 let r={...row};if(k==='owners')r.available=0;
 // Presentation revisions are local optimistic guards; vectors are ancestry.
 if(k==='tasks'&&old)r.revision=Math.max(old.revision+1,r.revision);
 const assignments=cs.filter(c=>c!==pk).map(c=>c+'=excluded.'+c).join(',');
 e.run('INSERT INTO '+table(k)+'('+cs.join(',')+') VALUES('+cs.map(()=>'?').join(',')+') ON CONFLICT('+pk+') DO UPDATE SET '+assignments,...cs.map(c=>r[c]));
}
function applyData(e,d,{replaceSeries=[]}={}){
 const now=e.clock();
 for(const r of d.owners)upsert(e,'owners',r);
 for(const r of d.operations)upsert(e,'operations',r);
 for(const t of d.tasks){
  // Current counted events are an authoritative bounded part of each snapshot.
  e.run('UPDATE history SET counted=0,reopened_at=? WHERE task_id=? AND counted=1',now,t.id);
  e.run('UPDATE steps SET deleted_at=coalesce(deleted_at,?) WHERE task_id=? AND deleted_at IS NULL',now,t.id);
  upsert(e,'tasks',t);
 }
 for(const r of d.steps)upsert(e,'steps',r);
 for(const r of d.series)upsert(e,'series',r);
 for(const id of replaceSeries)e.run('DELETE FROM occurrences WHERE series_id=?',id);
 for(const r of d.occurrences)upsert(e,'occurrences',r);
 for(const r of d.history)upsert(e,'history',r);
 for(const t of d.tasks){
  const row=e.task(t.id,true);e.validateDates(row);
  V.check(!row.completed||e.one('SELECT id FROM history WHERE task_id=? AND step_id IS NULL AND counted=1',t.id),'Missing counted task History');
  V.check(row.completed||!e.one('SELECT id FROM history WHERE task_id=? AND step_id IS NULL AND counted=1',t.id),'Unexpected counted task History');
  V.check(!row.recurrence||!row.startTime&&!row.dueTime,'Recurring task times are unsupported');
  for(const s of row.steps)V.check(s.completed===!!e.one('SELECT id FROM history WHERE task_id=? AND step_id=? AND counted=1',t.id,s.id),'Inconsistent Step History');
 }
 for(const s of d.series){
  const bad=e.one('SELECT o.task_id FROM occurrences o LEFT JOIN occurrences n ON n.task_id=o.successor_id WHERE o.series_id=? AND o.successor_id IS NOT NULL AND (n.series_id IS NULL OR n.series_id<>o.series_id OR n.ordinal<>o.ordinal+1 OR o.generated<>1)',s.id);
  V.check(!bad,'Inconsistent recurrence successor');
 }
}
function notify(e,data,operationId,kind){
 const sequence=e.one('SELECT sequence FROM operations WHERE operation_id=?',operationId).sequence,changes=[];
 for(const t of data.tasks){const current=e.task(t.id,true);for(const ownerId of new Set([t.owner_id,...(data.previousOwners?.[t.id]??[])])){
  const p={sequence,operationId,ownerId,taskIds:[t.id],stepIds:current.steps.map(s=>s.id),historyIds:data.history.filter(h=>h.task_id===t.id).map(h=>h.id),kind,taskId:t.id,baseRevision:null,taskPatch:current,steps:current.steps,deletedStepIds:[],generatedTasks:[],owner:null,history:[]};
  // Multiple tasks in one transaction need one outbox row per owner. Full tasks
  // use the existing generatedTasks install path and retain tombstones.
  let c=changes.find(c=>c.ownerId===ownerId);if(c){c.taskIds.push(t.id);c.generatedTasks.push(current);c.historyIds.push(...p.historyIds);}else changes.push({...p,generatedTasks:[current],taskId:null,taskPatch:null});
 }}
 for(const c of changes)e.run('INSERT INTO outbox VALUES(?,?,?,?) ON CONFLICT(sequence,owner_id) DO UPDATE SET change_json=excluded.change_json',sequence,c.ownerId,operationId,JSON.stringify(c));return changes;
}
function rememberOperation(e,p){
 const old=e.one('SELECT command_hash FROM operations WHERE operation_id=?',p.operationId);
 if(old)V.check(old.command_hash===p.commandHash,'Operation identity collision');
 else {const original=p.data.operations.find(o=>o.operation_id===p.operationId);if(original){V.check(original.command_hash===p.commandHash,'Operation identity mismatch');upsert(e,'operations',original);}else e.run('INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,?,?)',p.operationId,p.commandHash,JSON.stringify({operationId:p.operationId,taskId:p.data.tasks[0]?.id??null,historyIds:p.data.history.map(h=>h.id)}),e.clock());}
}
function expandLocalUnits(e,us){const before=us.size;for(const u of [...us]){
 if(u.startsWith('task:')){const o=e.one('SELECT series_id FROM occurrences WHERE task_id=?',u.slice(5));if(o)us.add('series:'+o.series_id);}
 if(u.startsWith('series:'))for(const o of e.all('SELECT task_id FROM occurrences WHERE series_id=?',u.slice(7)))us.add('task:'+o.task_id);
 }return before!==us.size;}
function drain(e,limit=32){
 const changes=[];let progress=true,n=0;
 while(progress&&n<limit){progress=false;
  const cursor=setting(e,'drainCursor',0);let rows=e.all("SELECT rowid AS receipt,* FROM sync_received WHERE state IN ('pending','conflict') AND rowid>? ORDER BY rowid LIMIT 256",cursor);
  if(!rows.length)rows=e.all("SELECT rowid AS receipt,* FROM sync_received WHERE state IN ('pending','conflict') ORDER BY rowid LIMIT 256");
  if(rows.length)set(e,'drainCursor',rows.at(-1).receipt);
  for(const row of rows){const p=JSON.parse(row.payload_json),us=Object.keys(p.versions),vs=us.map(u=>heads(e,u));
   if(us.every((u,i)=>le(p.versions[u],vs[i]))){e.run("UPDATE sync_received SET state='superseded' WHERE operation_id=?",p.operationId);progress=true;continue;}
   if(us.every((u,i)=>eq(p.bases[u],vs[i])||p.resolution&&le(vs[i],p.bases[u]))){
    const previousOwners=Object.fromEntries(p.data.tasks.map(t=>[t.id,[e.one('SELECT owner_id FROM tasks WHERE id=?',t.id)?.owner_id].filter(Boolean)]));
    rememberOperation(e,p);applyData(e,p.data,p);for(const u of us)putHeads(e,u,p.versions[u]);
    changes.push(...notify(e,{...p.data,previousOwners},p.operationId,'sync.receive'));e.run("UPDATE sync_received SET state='applied',payload_json='{}' WHERE operation_id=?",p.operationId);progress=true;if(++n>=limit)break;
   }else{
    const concurrent=us.some((u,i)=>!le(vs[i],p.bases[u])&&!le(p.versions[u],vs[i]));
    e.run('UPDATE sync_received SET state=? WHERE operation_id=?',concurrent?'conflict':'pending',p.operationId);
   }
  }
 }
 return changes;
}
function receive(e,p){
 validate(p,setting(e,'workspace'),p.deviceId,p.number);V.check(p.deviceId!==setting(e,'device'),'Own stream cannot be imported');
 const old=e.one('SELECT payload_hash FROM sync_received WHERE device_id=? AND number=?',p.deviceId,p.number);
 if(old){V.check(old.payload_hash===hash(p),'Immutable stream was changed','SYNC_STREAM_CHANGED');return [];}
 const progress=e.one('SELECT number FROM sync_progress WHERE device_id=?',p.deviceId)?.number??0;V.check(p.number===progress+1,'Stream gap; waiting for earlier file','SYNC_GAP');
 const original=p;p=normalize(p);const changes=receiveLogical(e,p);e.run('UPDATE sync_received SET payload_hash=? WHERE operation_id=?',hash(original),p.operationId);e.run('INSERT INTO sync_progress VALUES(?,?) ON CONFLICT(device_id) DO UPDATE SET number=excluded.number',original.deviceId,original.number);e.boundary('syncBeforeCommit',p.operationId);return changes;
}
function receiveLogical(e,p){
 p=normalize(p);const prior=e.one('SELECT payload_json FROM sync_changes WHERE operation_id=?',p.operationId);
 if(prior){const known=JSON.parse(prior.payload_json);V.check(known.commandHash===p.commandHash,'Logical operation identity collision');
  // A personal original can arrive after its redacted shared withdrawal. It
  // retains the same logical identity and ancestry, and restores private state.
  if(known.sharedProjection&&!p.sharedProjection){
   const same=units(p.data).every(u=>eq(heads(e,u),p.versions[u]));
   e.run('UPDATE sync_changes SET payload_json=? WHERE operation_id=?',JSON.stringify(p),p.operationId);
   if(same){const previousOwners=Object.fromEntries(p.data.tasks.map(t=>[t.id,[e.one('SELECT owner_id FROM tasks WHERE id=?',t.id)?.owner_id].filter(Boolean)]));rememberOperation(e,p);applyData(e,p.data,p);const presentation=randomUUID();e.run('INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,?,?)',presentation,hash({upgrade:p.operationId}),JSON.stringify({operationId:presentation}),e.clock());return notify(e,{...p.data,previousOwners},presentation,'sync.receive');}
  }return [];
 }
 record(e,p);e.run("INSERT INTO sync_received VALUES(?,?,?,?,?,'pending')",p.deviceId,p.number,p.operationId,JSON.stringify(p),hash(p));return drain(e);

}
function conflicts(e){
 const rows=e.all("SELECT payload_json,state FROM sync_received WHERE state IN ('pending','conflict') ORDER BY device_id,number LIMIT 1000").map(r=>({...r,p:JSON.parse(r.payload_json)})),used=new Set(),result=[];
 for(const row of rows){if(row.state!=='conflict'||used.has(row))continue;const us=new Set(Object.keys(row.p.versions)),group=[];let more=true;
  while(more){more=expandLocalUnits(e,us);for(const r of rows)if(!used.has(r)&&r.p.deviceId===row.p.deviceId&&Object.keys(r.p.versions).some(u=>us.has(u))){used.add(r);group.push(r.p);for(const u of Object.keys(r.p.versions))us.add(u);more=true;}}
  const tasks=new Map(),steps=new Map(),occurrences=new Map(),series=new Map();
  for(const p of group){for(const t of p.data.tasks){tasks.set(t.id,t);steps.set(t.id,p.data.steps.filter(s=>s.task_id===t.id&&s.deleted_at===null));}for(const o of p.data.occurrences)occurrences.set(o.task_id,o);for(const s of p.data.series)series.set(s.id,s);}
  for(const sid of series.keys())for(const o of e.all('SELECT task_id FROM occurrences WHERE series_id=? ORDER BY ordinal',sid))us.add('task:'+o.task_id);
  const local=[...us].filter(u=>u.startsWith('task:')).map(u=>e.task(u.slice(5),true)).filter(Boolean).map(t=>({...t,ownerLabel:e.one('SELECT label FROM owners WHERE id=?',t.ownerId)?.label??t.ownerId,futureTemplate:t.recurrence?JSON.parse(e.one('SELECT template_json FROM recurrence_series WHERE id=?',t.recurrence.seriesId).template_json):null}));
  const incoming=[...tasks.values()].map(t=>{const o=occurrences.get(t.id),s=o?series.get(o.series_id):null;return{id:t.id,title:t.title,description:t.description,completed:!!t.completed,deletedAt:t.deleted_at,ownerId:t.owner_id,ownerLabel:group.flatMap(p=>p.data.owners).find(o=>o.id===t.owner_id)?.label??t.owner_id,startDate:t.start_date,startTime:t.start_time,dueDate:t.due_date,dueTime:t.due_time,importance:t.importance,context:t.context_json?JSON.parse(t.context_json):null,phaseId:t.phase_id,steps:steps.get(t.id).map(s=>({id:s.id,text:s.text,completed:!!s.completed})),recurrence:o?{seriesId:o.series_id,ordinal:o.ordinal,active:!!s.active,rule:JSON.parse(s.rule_json)}:null,futureTemplate:s?JSON.parse(s.template_json):null};});
  result.push({operationId:row.p.operationId,deviceId:row.p.deviceId,number:row.p.number,units:[...us],incoming,local});
 }
 return result;
}
function resolve(e,{operationId,choice}){
 V.id(operationId);V.check(['local','incoming'].includes(choice),'Choose a conflict version');
 const target=e.one("SELECT payload_json FROM sync_received WHERE operation_id=? AND state='conflict'",operationId);V.check(target,'Conflict is no longer pending','SYNC_CONFLICT_CHANGED');
 const us=new Set(Object.keys(JSON.parse(target.payload_json).versions)),selected=[];let more=true;
 const rows=e.all("SELECT * FROM sync_received WHERE state IN ('pending','conflict') ORDER BY device_id,number");
 while(more){more=expandLocalUnits(e,us);for(const r of rows){if(selected.includes(r))continue;const p=JSON.parse(r.payload_json);if(Object.keys(p.versions).some(u=>us.has(u))){selected.push(r);for(const u of Object.keys(p.versions))us.add(u);more=true;}}}
 const ps=selected.sort((a,b)=>a.device_id.localeCompare(b.device_id)||a.number-b.number).map(r=>JSON.parse(r.payload_json));
 V.check(new Set(ps.map(p=>p.deviceId)).size===1,'Resolve one incoming device at a time');
 for(const u of [...us])if(u.startsWith('series:'))for(const r of e.all('SELECT task_id FROM occurrences WHERE series_id=?',u.slice(7)))us.add('task:'+r.task_id);
 const ids=[...us].filter(u=>u.startsWith('task:')).map(u=>u.slice(5)),before=taskData(e,ids,{complete:true}),previousOwners=Object.fromEntries(before.tasks.map(t=>[t.id,[t.owner_id]]));
 const bases=Object.fromEntries([...us].map(u=>[u,merge(heads(e,u),...ps.map(p=>p.versions[u]??{}))]));
 if(choice==='incoming'){
  // A divergent successor stays as a tombstone; its counted branch events are
  // uncounted. The chosen branch restores its own occurrence identities.
  const touched=new Set(ps.flatMap(p=>p.data.tasks.map(t=>t.id))),sids=new Set(ps.flatMap(p=>p.data.series.map(s=>s.id)));
  for(const sid of [...us].filter(u=>u.startsWith('series:')).map(u=>u.slice(7)))if(!sids.has(sid)){
   // The incoming branch can predate a local recurrence definition. Choosing it
   // explicitly stops that local-only series and removes its occurrence links.
   e.run('UPDATE recurrence_series SET active=0 WHERE id=?',sid);
   for(const o of e.all('SELECT task_id FROM occurrences WHERE series_id=?',sid)){
    if(!touched.has(o.task_id)){e.run('UPDATE tasks SET deleted_at=?,revision=revision+1 WHERE id=?',e.clock(),o.task_id);e.run('UPDATE history SET counted=0,reopened_at=? WHERE task_id=? AND counted=1',e.clock(),o.task_id);}
   }
   e.run('DELETE FROM occurrences WHERE series_id=?',sid);
  }
  for(const s of sids)for(const o of e.all('SELECT * FROM occurrences WHERE series_id=?',s))if(!ps.some(p=>p.data.occurrences.some(n=>n.task_id===o.task_id))&&before.tasks.some(t=>t.id===o.task_id&&!touched.has(t.id))){
   e.run('UPDATE tasks SET deleted_at=?,revision=revision+1 WHERE id=?',e.clock(),o.task_id);e.run('UPDATE history SET counted=0,reopened_at=? WHERE task_id=? AND counted=1',e.clock(),o.task_id);e.run('DELETE FROM occurrences WHERE task_id=?',o.task_id);
  }
  // Remove colliding ordinal rows before installing the incoming branch.
  for(const p of ps)for(const o of p.data.occurrences)e.run('DELETE FROM occurrences WHERE series_id=? AND ordinal=? AND task_id<>?',o.series_id,o.ordinal,o.task_id);
  for(const p of ps){rememberOperation(e,p);applyData(e,p.data);}
 }
 // Preserve the rejected branch's identities and audit rows as uncounted data,
 // so a later resolution can never resurrect an undiscovered successor.
 for(const p of ps){rememberOperation(e,p);for(const t of p.data.tasks)if(!e.one('SELECT id FROM tasks WHERE id=?',t.id)){
  const d=empty();d.owners=p.data.owners;d.operations=p.data.operations;d.tasks=[{...t,deleted_at:e.clock(),completed:0,completed_at:null}];d.steps=p.data.steps.filter(s=>s.task_id===t.id).map(s=>({...s,completed:0,completed_at:null,deleted_at:e.clock()}));d.history=p.data.history.filter(h=>h.task_id===t.id).map(h=>({...h,counted:0,reopened_at:e.clock()}));applyData(e,d);
 }}
 const id=randomUUID(),commandHash=hash({id,choice,operationId});
 for(const p of ps)for(const h of p.data.history)if(!e.one('SELECT id FROM history WHERE id=?',h.id)){
  if(h.step_id&&!e.one('SELECT id FROM steps WHERE id=?',h.step_id)){const s=p.data.steps.find(s=>s.id===h.step_id);upsert(e,'steps',{...s,deleted_at:e.clock()});}
  upsert(e,'history',{...h,counted:0,reopened_at:e.clock()});
 }
 // Refresh once for explicit resolution (never on ordinary mutations).
 const resolved=taskData(e,ids,{complete:true});
 for(const u of us)if(u.startsWith('series:')&&!resolved.series.some(s=>s.id===u.slice(7))){const sid=u.slice(7),s=e.one('SELECT * FROM recurrence_series WHERE id=?',sid)??ps.flatMap(p=>p.data.series).find(s=>s.id===sid);if(s){const stopped={...s,active:0};upsert(e,'series',stopped);resolved.series.push(stopped);if(!resolved.owners.some(o=>o.id===s.owner_id))resolved.owners.push(e.one('SELECT * FROM owners WHERE id=?',s.owner_id));}}
 e.run("INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,?,?)",id,commandHash,JSON.stringify({operationId:id,taskId:ids[0]??null}),e.clock());
 const out=envelope(e,resolved,{operationId:id,commandHash,bases,replaceSeries:resolved.series.map(s=>s.id),resolution:true});
 const changes=notify(e,{...resolved,previousOwners},id,'sync.resolve');
 if(changes.length){const first=changes[0];e.run('UPDATE outbox SET change_json=? WHERE sequence=? AND owner_id=?',JSON.stringify({...first,sync:out}),first.sequence,first.ownerId);}
 for(const p of ps)e.run("UPDATE sync_received SET state='superseded' WHERE operation_id=?",p.operationId);
 return changes;
}
module.exports={logicalWriter,normalize,migrateLogicalWriters,record,envelope,receiveLogical,columns,empty,setting,set,heads,le,eq,hash,units,taskData,initialData,baseline,initialize,capture,validateData,validate,applyData,receive,drain,conflicts,resolve,notify};
