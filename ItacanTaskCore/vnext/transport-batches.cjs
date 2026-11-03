"use strict";
// Durable immutable batches shared by the directory transports. A prepared batch
// survives rename/checkpoint interruption without picking up later commits.
const path=require('node:path'),S=require('./sync-data.cjs'),V=require('./validation.cjs');
const name=n=>String(n).padStart(16,'0')+'.json';
async function publishBatch(io,key,header,project){
 let state=await io.engine.enqueue(()=>S.setting(io.engine,key,{cursor:0,number:0,pending:null}));
 if(!state.pending){state=await io.engine.syncTransaction(e=>{
  const rows=e.all('SELECT * FROM sync_changes WHERE sequence>? ORDER BY sequence LIMIT 32',state.cursor);if(!rows.length)return{value:state};if(rows.length===32)io.schedule(50);
  const changes=[];let cursor=state.cursor,bytes=0;
  for(const r of rows){e.run('SAVEPOINT sync_batch_item');const p=project?project(e,JSON.parse(r.payload_json)):JSON.parse(r.payload_json),size=p?Buffer.byteLength(JSON.stringify(p)):0;if(changes.length&&bytes+size>1024*1024){e.run('ROLLBACK TO sync_batch_item');e.run('RELEASE sync_batch_item');break;}e.run('RELEASE sync_batch_item');cursor=r.sequence;if(p){changes.push(p);bytes+=size;}}
  const next={cursor,number:state.number+(changes.length?1:0),pending:changes.length?{...header,number:state.number+1,changes}:null};S.set(e,key,next);return{value:next};
 });}
 if(!state.pending||io.closed)return;
 await io.mkdir(path.join(io.root,header.directory));const dir=path.join(io.root,header.directory,header.writerId);await io.mkdir(dir);
 const value={...state.pending};delete value.directory;
 if(io.closed)return;await io.publish(path.join(dir,name(value.number)),value);await io.testBoundary?.('beforeBatchCheckpoint',value);
 await io.engine.syncTransaction(e=>{S.set(e,key,{...state,pending:null});return{value:true};});io.schedule(50);
}
async function importBatches(io,directory,key,header,apply){
 const root=path.join(io.root,directory);if(!await io.safe(root,{missing:true,directory:true}))return;
 const entries=await require('node:fs/promises').readdir(root,{withFileTypes:true});V.check(entries.length<=128,'Too many synchronization writers');let budget=64;
 for(const entry of entries){if(!entry.isDirectory()||!/^[a-f0-9-]{36}$/.test(entry.name))continue;V.id(entry.name);await io.safe(path.join(root,entry.name),{directory:true});
  let number=await io.engine.enqueue(()=>S.setting(io.engine,key+entry.name,0));
  while(budget-->0&&!io.closed){const file=path.join(root,entry.name,name(number+1));if(!await io.safe(file,{missing:true}))break;const batch=await io.json(file);
   V.fields(batch,['protocol','workspaceId','projectId','writerId','number','changes'],['protocol','writerId','number','changes']);V.check(batch.protocol===1&&batch.writerId===entry.name&&batch.number===number+1&&Array.isArray(batch.changes)&&batch.changes.length>0&&batch.changes.length<=32,'Invalid synchronization batch');for(const[k,v]of Object.entries(header))V.check(batch[k]===v,'Synchronization repository identity mismatch');
   await io.engine.syncTransaction(e=>{const changes=[];for(const p of batch.changes)changes.push(...apply(e,p));S.set(e,key+entry.name,batch.number);return{changes,value:true};});number++;
  }if(budget<=0){io.schedule(50);break;}
 }
}
module.exports={publishBatch,importBatches};
