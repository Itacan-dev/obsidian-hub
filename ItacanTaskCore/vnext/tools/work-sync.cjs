"use strict";
// Narrow ordinary-Work acceptance: one temporary Task, preserve every preexisting
// record, exercise the application boundary, then drain/restart separately.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),{connect}=require('./cdp-client.cjs');
const root=path.resolve(process.argv[2]??''),base=path.join(process.env.LOCALAPPDATA,'Itacan/DevelopmentEvidence/TaskCoreVNext'),workspace=path.resolve(__dirname,'../../..');assert(root.startsWith(base+path.sep));
const exe=path.join(process.env.LOCALAPPDATA,'Programs/obsidian/Obsidian.exe'),child=cp.spawn(exe,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=19282'],{windowsHide:true,detached:true,stdio:'ignore'});child.unref();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let client;try{for(let i=0;i<200;i++){try{client=await connect(19282);break}catch{}await delay(50)}assert(client);for(let i=0;i<300;i++){if(await client.evaluate("!!window.app?.plugins?.plugins?.['hub-project-menu']?.nativeTaskHost"))break;await delay(50)}
 assert.equal(await client.evaluate('app.vault.adapter.getBasePath()'),workspace);
 const result=await client.evaluate(`(async()=>{
  const p=app.plugins.plugins['hub-project-menu'],h=p.nativeTaskHost;await h.ready;const before=(await Promise.all(h.nativeTasks.owners.map(async o=>(await h.runtime(o).list()).tasks))).flat();
  const owner=h.nativeTasks.owners.find(o=>o.type==='resource'),r=h.runtime(owner),times=[],measure=async(label,fn)=>{const start=performance.now(),value=await fn();times.push({label,ms:performance.now()-start});return value};
  let task;try{
   task=(await measure('create',()=>r.createTask({text:'Temporary OneDrive synchronization acceptance',steps:[{text:'Temporary Step'}]}))).task;
   task=(await measure('edit',()=>r.execute({type:'task.edit',operationId:require('node:crypto').randomUUID(),taskId:task.id,expectedRevision:task.revision,patch:{description:'Disposable stationary acceptance'}}))).task;
   for(const completed of [true,false])task=(await measure(completed?'complete':'reopen',()=>r.execute({type:'task.setCompleted',operationId:require('node:crypto').randomUUID(),taskId:task.id,expectedRevision:task.revision,completed}))).task;
  }finally{if(task&&!task.deletedAt)await measure('delete',()=>r.execute({type:'task.delete',operationId:require('node:crypto').randomUUID(),taskId:task.id,expectedRevision:task.revision}));}
  const after=(await Promise.all(h.nativeTasks.owners.map(async o=>(await h.runtime(o).list()).tasks))).flat();
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Preexisting Work task observations changed');
  return{pass:true,fixtureId:task.id,preexistingTaskIds:before.map(t=>t.id).sort(),times,historyIds:(await h.completionFeed.read()).records.map(r=>r.id).sort(),owners:h.nativeTasks.owners.length,pending:h.pendingOperations().length,status:h.status(),visible:document.visibilityState,activeFile:app.workspace.getActiveFile()?.path};
 })()`);
 for(let i=0;i<100;i++){if(await client.evaluate("app.plugins.plugins['hub-project-menu'].nativeTaskHost.status().synchronization==='current'"))break;await delay(100)}
 result.status=await client.evaluate("app.plugins.plugins['hub-project-menu'].nativeTaskHost.status()");assert.equal(result.status.synchronization,'current');assert.equal(result.owners,11);assert.equal(result.pending,0);
 fs.writeFileSync(path.join(root,'WORK-SYNC.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }catch(e){fs.writeFileSync(path.join(root,'WORK-SYNC-ERROR.txt'),e.stack);throw e;}finally{client?.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1});
