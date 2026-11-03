"use strict";
// OneDrive is just an eventually available directory. No network service or SQL
// outside the existing utility. Immutable files are published after local commit.
const fs=require('node:fs/promises'),nativeFs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const S=require('./sync-data.cjs'),V=require('./validation.cjs');
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',workspaceName=new RegExp('^workspace-('+UUID+')\\.json$'),deviceName=new RegExp('^'+UUID+'$');
const MAX_FILE=8*1024*1024,MAX_BASELINE=128*1024*1024;
const digest=b=>createHash('sha256').update(b).digest('hex');
class TaskSync {
 constructor(engine,{vault,authorityId,interval=15000,automatic=true,onStatus=()=>{},testBoundary=null}={}){
  V.check(path.isAbsolute(vault),'Absolute vault required');V.id(authorityId);
  this.engine=engine;this.root=path.join(vault,'.itacan-task-sync');this.defaultAuthority=authorityId;this.interval=interval;this.automatic=automatic;this.onStatus=onStatus;this.testBoundary=testBoundary;this.closed=false;this.state={state:'starting',authorityId};
  this.stopChanges=engine.subscribe({},c=>{if(!c.kind.startsWith('sync.'))this.schedule(200)});
  this.state.authorityId=S.setting(engine,'authority',authorityId);this.state.workspaceId=S.setting(engine,'workspace');
 }
 status(){return structuredClone(this.state);}
 report(state,extra={}){this.state={...this.state,state,...extra};this.onStatus(this.status());return this.status();}
 async safe(file,{directory=false,missing=false}={}){
  const relative=path.relative(this.root,file);V.check(relative===''||!relative.startsWith('..')&&!path.isAbsolute(relative),'Synchronization path escaped root');
  let current=this.root;for(const segment of ['',...relative.split(path.sep).filter(Boolean)]){
   if(segment)current=path.join(current,segment);
   let st;try{st=await fs.lstat(current)}catch(e){if(missing&&e.code==='ENOENT')return null;throw e;}
   V.check(!st.isSymbolicLink(),'Synchronization links are not supported','SYNC_UNSAFE_PATH');
  }
  const real=await fs.realpath(file),base=await fs.realpath(this.root),rel=path.relative(base,real);V.check(rel===''||!rel.startsWith('..')&&!path.isAbsolute(rel),'Synchronization real path escaped root');
  const st=await fs.stat(file);V.check(directory?st.isDirectory():st.isFile(),'Unexpected synchronization file type');return st;
 }
 async read(file,max=MAX_FILE){const st=await this.safe(file);V.check(st.size<=max,'Synchronization file exceeds size limit','SYNC_FILE_TOO_LARGE');const handle=await fs.open(file,'r');try{const stat=await handle.stat();V.check(stat.isFile()&&stat.size<=max,'Invalid synchronization file');const buffer=Buffer.alloc(stat.size+1);let length=0;while(length<buffer.length){const r=await handle.read(buffer,length,buffer.length-length,length);if(!r.bytesRead)break;length+=r.bytesRead;}V.check(length===stat.size&&length<=max,'Synchronization file changed during read');return buffer.subarray(0,length);}finally{await handle.close();}}
 async json(file,max){return JSON.parse((await this.read(file,max)).toString('utf8'));}
 async mkdir(dir){await this.safe(path.dirname(dir),{directory:true});try{await fs.mkdir(dir)}catch(e){if(e.code!=='EEXIST')throw e;}await this.safe(dir,{directory:true});}
 async publish(file,value){
  const bytes=Buffer.from(JSON.stringify(value));V.check(bytes.length<=MAX_FILE,'Synchronization file exceeds size limit','SYNC_FILE_TOO_LARGE');
  await this.safe(path.dirname(file),{directory:true});
  const prior=await this.safe(file,{missing:true});if(prior){V.check((await this.read(file)).equals(bytes),'Immutable synchronization file was changed','SYNC_STREAM_CHANGED');return;}
  const tmp=path.join(path.dirname(file),'.pending-'+randomUUID()+'.tmp');let handle;
  try{handle=await fs.open(tmp,'wx');await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;await this.testBoundary?.('beforeRename',file);await fs.rename(tmp,file);await this.testBoundary?.('afterRename',file);}finally{await handle?.close();await fs.unlink(tmp).catch(()=>{});}
 }
 async identity(){
  const file=path.join(path.dirname(this.engine.file),'task-sync-device.json');let id;
  try{const value=JSON.parse(await fs.readFile(file,'utf8'));V.fields(value,['protocol','deviceId'],['protocol','deviceId']);V.check(value.protocol===1,'Unsupported local device identity');V.id(value.deviceId);id=value.deviceId;}catch(e){if(e.code!=='ENOENT')throw e;id=await this.engine.enqueue(()=>S.setting(this.engine,'device'))??randomUUID();try{const h=await fs.open(file,'wx');try{await h.writeFile(JSON.stringify({protocol:1,deviceId:id}));await h.sync();}finally{await h.close();}}catch(error){if(error.code!=='EEXIST')throw error;id=JSON.parse(await fs.readFile(file,'utf8')).deviceId;V.id(id);}}
  return id;
 }
 schedule(ms=250){if(this.closed||this.timer||!this.automatic)return;this.timer=setTimeout(()=>{this.timer=null;void this.reconcile()},ms);this.timer.unref?.();}
 async start(){await this.reconcile();if(!this.closed&&this.automatic){try{this.watcher=nativeFs.watch(this.root,{recursive:true},()=>this.schedule());this.watcher.on('error',()=>{this.watcher?.close();this.watcher=null;this.schedule(1000)});}catch{}this.periodic=setInterval(()=>this.schedule(),this.interval);this.periodic.unref?.();}return this.status();}
 reconcile(){if(this.closed)return Promise.resolve(this.status());if(this.running){this.again=true;return this.running;}this.running=this.cycle().catch(e=>this.report('error',{error:e.message,code:e.code??'SYNC_UNAVAILABLE'})).finally(()=>{this.running=null;if(this.again){this.again=false;this.schedule();}});return this.running;}
 async cycle(){
  if(this.closed)return this.status();
  try{await fs.mkdir(this.root);this.createdRoot=true;}catch(e){if(e.code!=='EEXIST')throw e;}await this.safe(this.root,{directory:true});
  this.deviceId??=await this.identity();
  const entries=await fs.readdir(this.root),manifests=entries.filter(n=>workspaceName.test(n));
  V.check(manifests.length<=1,'Two workspace enrollments arrived. Keep both files and choose the original workspace before continuing.','SYNC_MULTIPLE_WORKSPACES');
  let manifest;
  if(!manifests.length){
   const saved=await this.engine.enqueue(()=>({workspace:S.setting(this.engine,'workspace'),baseline:S.setting(this.engine,'baselineInfo'),published:S.setting(this.engine,'workspacePublished',false)}));
   V.check(!saved.published,'Waiting for the existing workspace manifest to become available.','SYNC_WORKSPACE_UNAVAILABLE');
   let info=saved.baseline;
   V.check(info||this.createdRoot&&entries.length===0,'Waiting for the original workspace manifest and baseline to finish arriving through OneDrive. Open the first computer to finish enrollment.','SYNC_BASELINE_PENDING');
   if(!info){info=await this.engine.syncTransaction(e=>({value:S.baseline(e,{workspaceId:randomUUID(),authorityId:this.defaultAuthority,deviceId:this.deviceId})}));}
   // The consistent baseline and its exact SQLite position are durable before
   // asynchronous publication; later mutations are already in the outbox.
   const prefix='baseline-'+info.workspaceId,parts=[];
   for(let i=0;i<info.parts;i++){const rows=await this.engine.enqueue(()=>JSON.parse(this.engine.one('SELECT payload_json FROM sync_baseline WHERE part=?',i).payload_json)),name=prefix+'-'+i+'.json',value={protocol:1,workspaceId:info.workspaceId,part:i,rows};await this.publish(path.join(this.root,name),value);parts.push({name,sha256:digest(Buffer.from(JSON.stringify(value)))});}
   manifest={protocol:1,workspaceId:info.workspaceId,authorityId:info.authorityId,creator:info.deviceId,position:info.position,parts,versions:info.versions};
   await this.publish(path.join(this.root,'workspace-'+info.workspaceId+'.json'),manifest);
  }else {manifest=await this.json(path.join(this.root,manifests[0]));V.check(manifests[0]==='workspace-'+manifest.workspaceId+'.json','Workspace manifest identity mismatch');}
  this.validateManifest(manifest);this.manifest=manifest;
  const local=await this.engine.enqueue(()=>({workspace:S.setting(this.engine,'workspace'),authority:S.setting(this.engine,'authority'),count:this.engine.one('SELECT count(*) n FROM tasks WHERE deleted_at IS NULL OR id IN (SELECT task_id FROM history WHERE counted=1)').n}));
  if(!local.workspace){
   if(local.count){this.report('enrollment-required',{authorityId:this.defaultAuthority,workspaceId:manifest.workspaceId,deviceId:this.deviceId,error:'This device has independent tasks. Review and explicitly merge them before joining.'});return this.status();}
   await this.join(manifest,false);
  }else V.check(local.workspace===manifest.workspaceId,'Database is enrolled in a different workspace.','SYNC_WORKSPACE_MISMATCH');
  await this.engine.syncTransaction(e=>{V.check(S.setting(e,'device')===this.deviceId,'Local device identity mismatch','SYNC_DEVICE_MISMATCH');S.set(e,'workspacePublished',true);e.run('DELETE FROM sync_baseline');e.run("DELETE FROM sync_settings WHERE key='baselineInfo'");return{value:true};});
  await this.mkdir(path.join(this.root,'streams'));const stream=path.join(this.root,'streams',this.deviceId);await this.mkdir(stream);
  this.report('syncing',{authorityId:manifest.authorityId,workspaceId:manifest.workspaceId,deviceId:this.deviceId,error:null,code:null});
  await this.export(stream);await this.import();
  const summary=await this.engine.enqueue(()=>({conflicts:S.conflicts(this.engine).length,pending:this.engine.one("SELECT count(*) n FROM sync_received WHERE state='pending'").n}));
  return this.report(summary.conflicts?'conflict':summary.pending?'waiting':'current',{...summary,lastSuccess:Date.now(),error:null});
 }
 validateManifest(m){
  V.fields(m,['protocol','workspaceId','authorityId','creator','position','parts','versions'],['protocol','workspaceId','authorityId','creator','position','parts','versions']);V.check(m.protocol===1,'Unsupported task synchronization protocol','SYNC_PROTOCOL');V.id(m.workspaceId);V.id(m.authorityId);V.id(m.creator);V.check(Array.isArray(m.parts)&&m.parts.length>0&&m.parts.length<=256,'Invalid baseline parts');
  V.check(Number.isSafeInteger(m.position)&&m.position>=0,'Invalid baseline position');
  m.parts.forEach((p,i)=>{V.fields(p,['name','sha256'],['name','sha256']);V.check(p.name==='baseline-'+m.workspaceId+'-'+i+'.json'&&/^[a-f0-9]{64}$/.test(p.sha256),'Invalid baseline reference');});
 }
 async readBaseline(m){
  const data=S.empty();let bytes=0;
  for(let i=0;i<m.parts.length;i++){const p=m.parts[i],buffer=await this.read(path.join(this.root,p.name));bytes+=buffer.length;V.check(bytes<=MAX_BASELINE&&digest(buffer)===p.sha256,'Invalid or oversized baseline');const part=JSON.parse(buffer);V.fields(part,['protocol','workspaceId','part','rows'],['protocol','workspaceId','part','rows']);V.check(part.protocol===1&&part.workspaceId===m.workspaceId&&part.part===i&&Array.isArray(part.rows),'Invalid baseline part');for(const item of part.rows){V.fields(item,['table','row'],['table','row']);V.check(Object.hasOwn(data,item.table),'Invalid baseline table');data[item.table].push(item.row);}}
  S.validateData(data);V.check(V.canonical(Object.keys(m.versions).sort())===V.canonical(S.units(data)),'Invalid baseline ancestry');for(const v of Object.values(m.versions))V.check(Object.keys(v).length===0,'Initial baseline must precede change streams');return data;
 }
 async join(m,mergeLocal){
  const baseline=await this.readBaseline(m);
  await this.engine.syncTransaction(e=>{
   const existing=S.initialData(e);V.check(mergeLocal||existing.tasks.length===0,'Existing tasks require explicit enrollment','SYNC_ENROLLMENT_REQUIRED');
   V.check(!baseline.tasks.some(t=>e.one('SELECT id FROM tasks WHERE id=?',t.id)),'Existing task identities overlap. Enrollment requires manual review; no data was changed.','SYNC_ENROLLMENT_OVERLAP');
   // SQLite's transaction preserves all existing rows on failure. Successful
   // enrollment retains Task/History identities in this same local database.
   // Existing owner IDs are generated from a device's old authority. Canonical
   // IDs come from the shared authority, while availability remains device-local.
   const remap=new Map();for(const o of baseline.owners){const old=e.one('SELECT * FROM owners WHERE kind=? AND external_id=?',o.kind,o.external_id);if(old&&old.id!==o.id){remap.set(old.id,o.id);e.run('UPDATE owners SET external_id=? WHERE id=?','enrollment-old:'+old.id,old.id);}}
   S.applyData(e,baseline);for(const [old,id]of remap){for(const table of ['tasks','history','recurrence_series'])e.run('UPDATE '+table+' SET owner_id=? WHERE owner_id=?',id,old);e.run('UPDATE owners SET available=0 WHERE id=?',old);}
   S.initialize(e,{workspaceId:m.workspaceId,authorityId:m.authorityId,deviceId:this.deviceId});
   for(const[u,v]of Object.entries(m.versions))e.run('INSERT INTO sync_versions VALUES(?,?)',u,JSON.stringify(v));
   if(mergeLocal){
    const grouped=new Map();for(const t of existing.tasks){const o=existing.occurrences.find(o=>o.task_id===t.id),key=o?'series:'+o.series_id:'task:'+t.id;const ids=grouped.get(key)??[];ids.push(t.id);grouped.set(key,ids);}
    for(const ids of grouped.values()){
     const id=randomUUID(),commandHash=S.hash({enroll:id});e.run('INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,?,?)',id,commandHash,JSON.stringify({operationId:id,taskId:ids[0]}),e.clock());
     const sync=S.capture(e,{taskIds:ids,historyIds:existing.history.map(h=>h.id),operationId:id,commandHash}),changes=S.notify(e,S.taskData(e,ids,{complete:true}),id,'sync.enroll');const c=changes[0];e.run('UPDATE outbox SET change_json=? WHERE sequence=? AND owner_id=?',JSON.stringify({...c,sync}),c.sequence,c.ownerId);
    }
   }
   const id=randomUUID();e.run('INSERT INTO operations(operation_id,command_hash,result_json,committed_at) VALUES(?,?,?,?)',id,S.hash({baseline:m.workspaceId}),JSON.stringify({operationId:id}),e.clock());
   return{changes:S.notify(e,baseline,id,'sync.baseline'),value:true};
  });
 }
 async enroll(choice){V.check(choice==='merge','Explicitly choose to merge independent local tasks');V.check(this.state.state==='enrollment-required'&&this.manifest,'No enrollment is awaiting a decision');await this.join(this.manifest,true);await this.reconcile();return this.status();}
 async export(stream){
  const page=await this.engine.enqueue(()=>this.engine.snapshot(()=>{const after=S.setting(this.engine,'published',0);return{rows:this.engine.all("SELECT sequence,change_json FROM outbox WHERE sequence>? AND json_type(change_json,'$.sync') IS NOT NULL ORDER BY sequence LIMIT 32",after)};})),rows=page.rows;
  for(const row of rows){if(this.closed)return;const p=JSON.parse(row.change_json).sync;S.validate(p,this.manifest.workspaceId,this.deviceId,p.number);await this.publish(path.join(stream,String(p.number).padStart(16,'0')+'.json'),p);await this.testBoundary?.('beforePublishCheckpoint',p);await this.engine.syncTransaction(e=>{S.set(e,'published',row.sequence);return{value:true};});}
  if(rows.length===32)this.schedule(50);
  else await this.engine.syncTransaction(e=>{S.set(e,'published',page.sequence);return{value:true};});
 }
 async import(){
  const streams=path.join(this.root,'streams');const entries=await fs.readdir(streams,{withFileTypes:true});V.check(entries.length<=64,'Too many stream directories');let budget=64;
  for(const entry of entries){if(!entry.isDirectory()||!deviceName.test(entry.name)||entry.name===this.deviceId)continue;const directory=path.join(streams,entry.name);await this.safe(directory,{directory:true});
   // Exact next filenames avoid directory-wide rereads and tolerate arrival gaps.
   let next=await this.engine.enqueue(()=>this.engine.one('SELECT number FROM sync_progress WHERE device_id=?',entry.name)?.number??0);
   while(budget-->0&&!this.closed){const file=path.join(directory,String(++next).padStart(16,'0')+'.json');if(!await this.safe(file,{missing:true}))break;const p=await this.json(file);S.validate(p,this.manifest.workspaceId,entry.name,next);await this.testBoundary?.('beforeImport',p);await this.engine.syncTransaction(e=>({changes:S.receive(e,p),value:true}));await this.testBoundary?.('afterImport',p);}
   if(budget<=0){this.schedule(50);break;}
  }
  await this.engine.syncTransaction(e=>({changes:S.drain(e),value:true}));
 }
 async conflicts(){return this.engine.enqueue(()=>S.conflicts(this.engine));}
 async resolve(input){await this.engine.syncTransaction(e=>({changes:S.resolve(e,input),value:true}));this.schedule(0);return this.status();}
 async close(){this.closed=true;clearTimeout(this.timer);clearInterval(this.periodic);this.watcher?.close();this.stopChanges();if(this.running){let timer;try{await Promise.race([this.running,new Promise(r=>{timer=setTimeout(r,500)})]);}finally{clearTimeout(timer);}}}
}
module.exports={TaskSync};
