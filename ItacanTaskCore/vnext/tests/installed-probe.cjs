"use strict";
// Loaded in the genuine installed Obsidian main process through its remote API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID:id}=require('node:crypto');
const {openTaskService}=require('../host/electron.cjs');
exports.run=function(root,options={}){
 if(!path.resolve(root).startsWith(path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext')+path.sep))throw Error('Owned evidence directory required');
 const result={pass:false,mainVersions:process.versions,mainExe:process.execPath,checks:[]};
 let service;
 const open=async(file=path.join(root,'tasks.sqlite'),testBoundary=null)=>{service=openTaskService({utilityProcess:require('electron').utilityProcess,file,...(options.entry?{entry:options.entry}:{}),testBoundary,onDiagnostic:d=>fs.appendFileSync(path.join(root,'service.jsonl'),JSON.stringify(d)+'\n')});await service.client.ready;return service.client};
 const close=async()=>{const exit=new Promise(r=>service.child.once('exit',r));await service.client.close();assert.equal(await exit,0);service=null};
 (async()=>{try{
  let c=await open();result.utilityVersions=c.versions;
  const owner={id:id(),kind:'project',externalId:'installed-host-synthetic',label:'Synthetic',available:true};
  await c.execute({operationId:id(),type:'owner.put',owner});
  const created=await c.execute({operationId:id(),type:'task.create',task:{ownerId:owner.id,title:'Installed host task',steps:[{text:'Independent Step'}]}});
  let task=created.task;const command={operationId:id(),type:'task.setCompleted',taskId:task.id,expectedRevision:task.revision,completed:true};
  task=(await c.execute(command)).task;assert(task.completed);assert.equal((await c.readHistory()).events.length,1);
  result.checks.push('genuine installed executable starts built-in node:sqlite utility and exchanges direct IPC commands');
  await close();result.checks.push('accepted work drains and utility exits zero');
  c=await open();assert.deepEqual((await c.getTask(task.id)).task,task);assert((await c.execute(command)).replayed);assert.equal((await c.readStatistics()).completedTasks,1);
  result.checks.push('device-local database reopens with persisted task, History and exactly-once original-operation replay');
  await close();
  if(options.boundaries){for(const boundary of ['beforeBegin','afterWrites','beforeCommit','afterCommit']){
   const file=path.join(root,boundary+'.sqlite');c=await open(file,boundary);const owner={id:id(),kind:'project',externalId:'crash-fixture',label:'Crash fixture',available:true};await c.execute({operationId:id(),type:'owner.put',owner});
   const created=await c.execute({operationId:id(),type:'task.create',task:{ownerId:owner.id,title:'Recurring crash boundary',dueDate:'2026-11-02',steps:[{text:'Flat template'}],recurrence:{frequency:'daily',interval:1,zone:'Europe/Stockholm',startDate:null,dueDate:'2026-11-02'}}});
   await c.call('test.arm');const command={operationId:id(),type:'task.setCompleted',taskId:created.task.id,expectedRevision:created.task.revision,completed:true},hit=new Promise(r=>service.child.on('message',m=>{if(m.event==='test-boundary')r(m)})),exit=new Promise(r=>service.child.once('exit',r));
   const pending=c.execute(command),rejected=assert.rejects(pending,e=>e.code==='SERVICE_EXITED');await hit;service.child.kill();await exit;await rejected;service=null;
   c=await open(file);assert.equal((await c.listTasks()).total,boundary==='afterCommit'?2:1);const replay=await c.execute(command);assert.equal(replay.replayed,boundary==='afterCommit');assert.equal(replay.successor.recurrence.ordinal,2);assert.equal((await c.readHistory()).events.length,1);assert.equal((await c.listTasks()).total,2);await close();
   result.checks.push('packaged recurring completion recovers atomically after installed utility interruption at '+boundary);
  }}
  result.pass=true;
 }catch(e){result.error={code:e.code,message:e.message,stack:e.stack};try{if(service)await close()}catch(closeError){result.closeError=String(closeError)}}
 finally{fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2))}
 })();return true;
};
