"use strict";
// Git carries existing TaskCore envelopes. It never runs Git or owns task state.
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const S=require('./sync-data.cjs'),V=require('./validation.cjs'),B=require('./transport-batches.cjs'),{TaskSync}=require('./sync-transport.cjs');
// Matches the existing application owner-ID calculation without importing UI.
const stableId=value=>{const h=require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
const portable=p=>typeof p==='string'&&p.length<4000&&!/[:\\\x00-\x1f]/.test(p)&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..');
const publicOwner=id=>stableId(['itacan-shared-project-owner',id]);
function trimOperations(data){data.operations=data.operations.map(o=>{const old=JSON.parse(o.result_json),result={operationId:o.operation_id,owner:null,historyIds:(old.historyIds??[]).filter(id=>data.history.some(h=>h.id===id))};if(data.tasks.some(t=>t.id===old.taskId)){result.taskId=old.taskId;result.taskRevision=old.taskRevision??null;}if(data.tasks.some(t=>t.id===old.successorId))result.successorId=old.successorId;return {...o,result_json:JSON.stringify(result)};});}
function mergeRows(target,source){for(const k of Object.keys(target)){const pk=k==='operations'?'operation_id':k==='occurrences'?'task_id':'id';for(const row of source[k]){const i=target[k].findIndex(r=>r[pk]===row[pk]);if(i<0)target[k].push(row);else target[k][i]=row;}}}
function subset(data,ids){const d=S.empty();d.tasks=data.tasks.filter(t=>ids.has(t.id));d.steps=data.steps.filter(s=>ids.has(s.task_id));d.history=data.history.filter(h=>ids.has(h.task_id));d.occurrences=data.occurrences.filter(o=>ids.has(o.task_id));const series=new Set(d.occurrences.map(o=>o.series_id));d.series=data.series.filter(s=>series.has(s.id));d.operations=data.operations;d.owners=data.owners;return d;}
function projection(e,p,projectId,shared){
 const d=S.empty(),owners=new Map(p.data.owners.map(o=>[o.id,o])),projectOf=o=>o?.kind==='project'&&shared.has(o.external_id)?o.external_id:null;let relevant=false,admission=false;
 for(const t of p.data.tasks){if(new Set(S.setting(e,'baselineExclusions',[])).has(t.id)&&t.deleted_at&&!e.one('SELECT id FROM history WHERE task_id=? AND counted=1',t.id))continue;const current=projectOf(owners.get(t.owner_id)),members=e.all('SELECT * FROM sync_git_members WHERE task_id=?',t.id);let td;
  if(current){if(current===projectId&&!members.some(m=>m.project_id===projectId&&JSON.parse(m.payload_json).active))admission=true;td=subset(p.data,new Set([t.id]));if(current===projectId||members.some(m=>m.project_id===projectId&&JSON.parse(m.payload_json).active))relevant=true;}
  else{const member=members.find(m=>JSON.parse(m.payload_json).active);if(!member)continue;const saved=JSON.parse(member.payload_json);td=saved.data;td.tasks=td.tasks.map(old=>({...old,deleted_at:t.modified_at,modified_at:t.modified_at}));td.series=td.series.map(s=>({...s,active:0}));if(members.some(m=>m.project_id===projectId&&JSON.parse(m.payload_json).active))relevant=true;}
  mergeRows(d,td);
 }
 if(!relevant||!d.tasks.length)return null;
 for(const series of d.series){const privateOccurrence=e.one("SELECT t.id FROM occurrences x JOIN tasks t ON t.id=x.task_id JOIN owners o ON o.id=t.owner_id WHERE x.series_id=? AND (o.kind<>'project' OR o.external_id NOT IN (SELECT value FROM json_each(?))) LIMIT 1",series.id,JSON.stringify([...shared]));const sharedOccurrence=e.one("SELECT t.id FROM occurrences x JOIN tasks t ON t.id=x.task_id JOIN owners o ON o.id=t.owner_id WHERE x.series_id=? AND o.kind='project' AND o.external_id IN (SELECT value FROM json_each(?)) AND t.deleted_at IS NULL LIMIT 1",series.id,JSON.stringify([...shared]));const wholeWithdrawal=d.tasks.every(t=>t.deleted_at!==null)&&!sharedOccurrence;V.check(!privateOccurrence||wholeWithdrawal,'This recurring series spans private and shared owners. Move all its occurrences into shared Projects before Git publication; local data is preserved.','GIT_SERIES_SCOPE');}
 // Only the task's shared content crosses the boundary. Historical private
 // ownership is represented by the collaborative task owner, never a Resource.
 const allOwners=new Map(d.owners.map(o=>[o.id,o])),map=new Map();
 for(const o of d.owners){const id=projectOf(o);if(id)map.set(o.id,publicOwner(id));}
 for(const t of d.tasks){const o=allOwners.get(t.owner_id);V.check(projectOf(o),'Private task escaped Project projection');}
 for(const h of d.history)if(!map.has(h.owner_id))h.owner_id=d.tasks.find(t=>t.id===h.task_id).owner_id;
 for(const s of d.series)if(!map.has(s.owner_id)){const old=e.one('SELECT payload_json FROM sync_git_members WHERE project_id=? AND task_id IN (SELECT task_id FROM occurrences WHERE series_id=?) LIMIT 1',projectId,s.id);const prior=old&&JSON.parse(old.payload_json).data.series.find(x=>x.id===s.id);V.check(prior,'Move the remaining recurring series into the shared Project before publishing.','GIT_SERIES_SCOPE');Object.assign(s,prior,{active:0});const oldOwner=JSON.parse(old.payload_json).data.owners.find(o=>o.id===prior.owner_id);if(oldOwner&&!map.has(oldOwner.id)){d.owners.push(oldOwner);map.set(oldOwner.id,publicOwner(oldOwner.external_id));}}
 for(const k of ['tasks','history','series'])for(const row of d[k])row.owner_id=map.get(row.owner_id)??row.owner_id;
 d.owners=[...new Set([...d.tasks,...d.history,...d.series].map(r=>r.owner_id))].map(id=>{const o=d.owners.find(o=>map.get(o.id)===id);V.check(o,'Unknown shared owner');return{id,kind:'project',external_id:o.external_id,label:o.external_id,available:0};});trimOperations(d);
 // Save a local last-public snapshot before publication. Prepared batches and
 // this membership change commit together, including safe withdrawals.
 for(const t of d.tasks){const saved=e.one('SELECT payload_json FROM sync_git_members WHERE project_id=? AND task_id=?',projectId,t.id),previous=saved&&JSON.parse(saved.payload_json);if(previous?.versions&&!S.le(previous.versions['task:'+t.id]??{},p.versions['task:'+t.id]??{}))continue;const external=d.owners.find(o=>o.id===t.owner_id).external_id,localData=structuredClone(subset(d,new Set([t.id])));e.run('INSERT INTO sync_git_members VALUES(?,?,?) ON CONFLICT(project_id,task_id) DO UPDATE SET payload_json=excluded.payload_json',projectId,t.id,JSON.stringify({active:!t.deleted_at&&external===projectId,data:localData,versions:p.versions}));}
 const us=S.units(d),bases=Object.fromEntries(us.map(u=>[u,p.bases[u]??{}])),versions=Object.fromEntries(us.map(u=>[u,p.versions[u]??{}]));
 return {...p,workspaceId:projectId,deviceId:p.writerId,data:d,bases,versions,sharedProjection:true,resolution:p.resolution||admission,replaceSeries:p.replaceSeries.filter(id=>d.series.some(s=>s.id===id))};
}
function localize(e,p,projectId,shared){
 S.validate(p,projectId,p.deviceId,p.number);V.check(p.writerId===p.deviceId&&p.sharedProjection===true,'Git requires opaque logical writer identities');
 const d=structuredClone(p.data),map=new Map();trimOperations(d);
 for(const o of d.owners){V.check(o.kind==='project'&&shared.has(o.external_id)&&o.id===publicOwner(o.external_id),'Git contains an unapproved Project owner');const old=e.one("SELECT * FROM owners WHERE kind='project' AND external_id=?",o.external_id),id=old?.id??stableId([S.setting(e,'authority'),'project',o.external_id]);map.set(o.id,id);o.id=id;o.label=old?.label??o.external_id;}
 for(const k of ['tasks','series','history'])for(const row of d[k])row.owner_id=map.get(row.owner_id);
 // References are opaque location IDs, never filesystem reads. Block path-like
 // traversal/absolute values before exposing imported references to consumers.
 for(const c of [...d.tasks.map(t=>t.context_json?JSON.parse(t.context_json):null),...d.series.map(s=>JSON.parse(s.template_json).context)].filter(Boolean)){V.check(!/(^|[\\/])\.\.([\\/]|$)|^[\\/]|^[a-z]:/i.test(c.reference),'Unsafe Git location reference');}
 return {...p,workspaceId:S.setting(e,'workspace'),data:d};
}
class GitProject extends TaskSync{
 constructor(parent,id,relative,shared){super(parent.engine,{vault:parent.vault,authorityId:parent.defaultAuthority,automatic:parent.automatic,interval:parent.interval,gitEnabled:false});this.testBoundary=parent.testBoundary;this.parent=parent;this.id=id;this.relative=relative;this.shared=shared;this.root=path.join(parent.vault,...relative.split('/'),'.itacan-tasks');this.key='git:'+id+':';}
 async cycle(){
  const configFile=path.join(this.parent.vault,'System/Hub-shared-projects.json'),configStat=await fs.lstat(configFile);V.check(configStat.isFile()&&!configStat.isSymbolicLink()&&configStat.size<2*1024*1024,'Invalid shared Project registry');const config=JSON.parse(await fs.readFile(configFile,'utf8'));V.check(config.schemaVersion===1&&config.projects&&typeof config.projects==='object'&&!Array.isArray(config.projects)&&Object.keys(config.projects).length<=64,'Invalid shared Project registry');for(const[id,p]of Object.entries(config.projects)){V.id(id);V.check(portable(p.root),'Invalid shared Project root');}this.shared=new Set(Object.keys(config.projects));if(config.projects?.[this.id]?.root!==this.relative)return this.report('disabled',{projectId:this.id,error:null});
  V.check(await this.engine.enqueue(()=>S.setting(this.engine,'workspace')),'Waiting for personal TaskCore enrollment.','GIT_WAITING_FOR_TASKCORE');
  // Validate every Project path component; never create a missing checkout or
  // follow a link out of the explicitly approved vault directory.
  let current=this.parent.vault;for(const segment of this.relative.split('/')){current=path.join(current,segment);const st=await fs.lstat(current);V.check(st.isDirectory()&&!st.isSymbolicLink(),'Shared Project directory is unavailable or linked');}
  let repository=current,found=false;for(;;){try{await fs.lstat(path.join(repository,'.git'));found=true;break;}catch(e){if(e.code!=='ENOENT')throw e;}if(repository===this.parent.vault)break;const next=path.dirname(repository);if(next===repository)break;repository=next;}
  V.check(found,'Shared Project Git repository is unavailable. Local tasks are preserved.','GIT_REPOSITORY_UNAVAILABLE');
  const wasPublished=await this.engine.enqueue(()=>S.setting(this.engine,this.key+'repositoryPublished',false));if(wasPublished)V.check(await this.safe(this.root,{missing:true,directory:true}),'Waiting for the existing shared task directory. Restore/pull its retained files; local tasks are preserved.','GIT_DATA_UNAVAILABLE');try{await fs.mkdir(this.root);}catch(e){if(e.code!=='EEXIST')throw e;}await this.safe(this.root,{directory:true});
  const identity={protocol:1,projectId:this.id};const file=path.join(this.root,'project.json');if(await this.safe(file,{missing:true})){const m=await this.json(file);V.fields(m,['protocol','projectId'],['protocol','projectId']);V.check(V.canonical(m)===V.canonical(identity),'Shared task repository Project identity mismatch');}else await this.publish(file,identity);
  this.deviceId=this.parent.deviceId??await this.parent.identity();const writerId=stableId(['itacan-git-writer',this.id,this.deviceId]);
  await this.engine.syncTransaction(e=>{
   S.set(e,this.key+'repositoryPublished',true);if(S.setting(e,this.key+'enrolled'))return{value:true};const owner=e.one("SELECT * FROM owners WHERE kind='project' AND external_id=?",this.id);if(!owner)return{value:false};
   const excluded=new Set(S.setting(e,'baselineExclusions',[])),tasks=e.all('SELECT id,deleted_at FROM tasks WHERE owner_id=?',owner.id).filter(t=>!excluded.has(t.id)||!t.deleted_at||e.one('SELECT id FROM history WHERE task_id=? AND counted=1',t.id));const groups=new Map();
   for(const t of tasks){const series=e.one('SELECT series_id FROM occurrences WHERE task_id=?',t.id)?.series_id,key=series??t.id;groups.set(key,[...(groups.get(key)??[]),t.id]);}
   const changes=[];for(const ids of groups.values()){const hasRoots=ids.every(task=>{const rows=e.all("SELECT payload_json FROM sync_changes WHERE EXISTS (SELECT 1 FROM json_each(sync_changes.payload_json,'$.data.tasks') WHERE json_extract(value,'$.id')=?) ORDER BY sequence LIMIT 1",task);if(!rows.length)return false;const p=JSON.parse(rows[0].payload_json);return p.resolution||Object.keys(p.bases['task:'+task]??{}).length===0;});if(hasRoots)continue;const id=randomUUID(),commandHash=S.hash({gitEnrollment:this.id,id});e.run('INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,?,?)',id,commandHash,JSON.stringify({operationId:id}),e.clock());const p=S.envelope(e,S.taskData(e,ids,{complete:true}),{operationId:id,commandHash,resolution:true});const cs=S.notify(e,p.data,id,'sync.enroll');if(cs.length)e.run('UPDATE outbox SET change_json=? WHERE sequence=? AND owner_id=?',JSON.stringify({...cs[0],sync:p}),cs[0].sequence,cs[0].ownerId);changes.push(...cs);}
   // Start at current enrollment records, never replay synthetic historical outbox.
   S.set(e,this.key+'published',{cursor:0,number:0,pending:null});S.set(e,this.key+'enrolled',true);return{changes,value:true};
  });
  await B.publishBatch(this,this.key+'published',{protocol:1,projectId:this.id,writerId,directory:'streams'},(e,p)=>projection(e,p,this.id,this.shared));
  await B.importBatches(this,'streams',this.key+'received:',{projectId:this.id},(e,p)=>S.receiveLogical(e,localize(e,p,this.id,this.shared)));
  await this.engine.syncTransaction(e=>({changes:S.drain(e),value:true}));
  const summary=await this.engine.enqueue(()=>({conflicts:S.conflicts(this.engine).length,pending:this.engine.one("SELECT count(*) n FROM sync_received WHERE state='pending'").n}));return this.report(summary.conflicts?'conflict':summary.pending?'waiting':'current',{projectId:this.id,path:this.relative+'/.itacan-tasks',...summary,error:null});
 }
}
class GitProjects{
 constructor(parent){this.parent=parent;this.projects=new Map();}
 async reconcile(){
  const file=path.join(this.parent.vault,'System','Hub-shared-projects.json');let text;try{const st=await fs.lstat(file);V.check(st.isFile()&&!st.isSymbolicLink()&&st.size<2*1024*1024,'Invalid shared Project registry');text=await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const registry=text?JSON.parse(text):{schemaVersion:1,projects:{}};V.check(registry.schemaVersion===1&&registry.projects&&typeof registry.projects==='object'&&!Array.isArray(registry.projects),'Invalid shared Project registry');const shared=new Set(Object.keys(registry.projects));V.check(shared.size<=64,'Too many shared Projects');const result=[];
  for(const [id,p]of Object.entries(registry.projects)){V.id(id);V.check(portable(p.root),'Invalid shared Project root');}
  V.check(new Set(Object.values(registry.projects).map(p=>p.root)).size===shared.size,'Ambiguous shared Project roots');
  for(const[id,project]of this.projects)if(!shared.has(id)||project.relative!==registry.projects[id].root){await project.close();this.projects.delete(id);}
  for(const[id,p]of Object.entries(registry.projects)){let project=this.projects.get(id);if(!project){project=new GitProject(this.parent,id,p.root,shared);this.projects.set(id,project);await project.start();}else{project.shared=shared;await project.reconcile();}result.push({...project.status(),projectId:id});}
  return result;
 }
 async close(){for(const project of this.projects.values())await project.close();this.projects.clear();}
}
module.exports={GitProjects,GitProject,projection,localize,publicOwner};
