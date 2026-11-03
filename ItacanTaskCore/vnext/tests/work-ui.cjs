"use strict";
module.exports=async function({app,plugin},evidence){
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
 const host=plugin.nativeTaskHost;await host.ready;assert.equal(host.status().mode,'sqlite');assert.equal(app.vault.adapter.getBasePath(),'C:\\Users\\El_Baraka 2025\\OneDrive\\Obsidian Notes\\Work');assert.equal(document.visibilityState,'visible');
 const checks=[],raw={},created=[],wait=async(fn,label)=>{const start=performance.now();while(performance.now()-start<20000){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,3))}throw Error('Ordinary Work timeout: '+label)},frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const owner={type:'project',id:'4b597e3b-b588-4a29-969b-70db3a684112'},runtime=host.runtime(owner),Component=Object.getPrototypeOf(Object.getPrototypeOf(plugin.constructor.prototype)).constructor,component=new Component();component.load();
 const panel=host.nativeTasks.createPanelRead({component,workspace:owner}),task=async id=>(await runtime.list()).tasks.find(t=>t.id===id),measure=async(name,fn)=>{const start=performance.now(),r=await fn();(raw[name]??=[]).push(performance.now()-start);return r};
 let fixtureId,heartbeat=performance.now();const gaps=[],timer=setInterval(()=>{const now=performance.now();gaps.push(Math.max(0,now-heartbeat-16));heartbeat=now},16);
 const row=id=>[...document.querySelectorAll('.home-task-row')].find(r=>{try{return r.getClientRects().length>0&&JSON.parse(r.homeTaskKey??'null')?.[2]===id}catch{return false}}),checkbox=id=>row(id)?.querySelector('.home-task-checkbox');
 const persist=()=>fs.writeFileSync(path.join(evidence,'WORK-PERFORMANCE-PROGRESS.json'),JSON.stringify({created,fixtureId,raw},null,2));
 try{
  for(let i=0;i<30;i++){const result=await measure('task.create',()=>runtime.createTask({text:'TaskCore acceptance '+i,description:'Temporary local acceptance fixture',dueDate:'2026-11-02',steps:[{text:'Acceptance A'},{text:'Acceptance B'}]}));created.push(result.task.id);persist();}
  fixtureId=created[0];await wait(async()=>checkbox(fixtureId)&&!checkbox(fixtureId).disabled&&Number(row(fixtureId).dataset.taskRevision)===(await task(fixtureId)).revision,'real Home task presentation');await frames();checks.push('Visible ordinary Home presents committed SQLite Tasks with all actual vault plugins and Atlas running');
  for(let i=0;i<30;i++){
   let t=await task(fixtureId),form=runtime.formService(),snapshot=await form.read(t);await measure('task.edit',()=>form.save(snapshot,{...snapshot,description:'Measured metadata save '+i}));
   t=await task(fixtureId);let result=await measure('step.add',()=>runtime.execute({type:'step.add',operationId:randomUUID(),taskId:t.id,expectedRevision:t.revision,step:{text:'Measured new Step'}}));const stepId=result.task.steps.at(-1).id;
   result=await measure('step.edit',()=>runtime.execute({type:'step.edit',operationId:randomUUID(),taskId:result.task.id,expectedRevision:result.task.revision,stepId,text:'Measured edited Step'}));
   result=await measure('step.complete',()=>runtime.execute({type:'step.setCompleted',operationId:randomUUID(),taskId:result.task.id,expectedRevision:result.task.revision,stepId,completed:true}));
   result=await measure('step.reopen',()=>runtime.execute({type:'step.setCompleted',operationId:randomUUID(),taskId:result.task.id,expectedRevision:result.task.revision,stepId,completed:false}));
   result=await measure('step.reorder',()=>runtime.execute({type:'step.reorder',operationId:randomUUID(),taskId:result.task.id,expectedRevision:result.task.revision,stepIds:result.task.steps.map(s=>s.id).reverse()}));
   await measure('step.delete',()=>runtime.execute({type:'step.delete',operationId:randomUUID(),taskId:result.task.id,expectedRevision:result.task.revision,stepId}));
  }
  checks.push('Thirty repeated full local commands for Task metadata and Step creation/edit/completion/reopening/reordering/deletion');
  for(let i=0;i<30;i++){
   const control=await wait(async()=>{const c=checkbox(fixtureId),t=await task(fixtureId);return c&&!c.disabled&&!c.checked&&Number(row(fixtureId).dataset.taskRevision)===t.revision?c:null},'ready Home checkbox');const start=performance.now();control.click();(raw.pendingFeedback??=[]).push(performance.now()-start);assert(control.dataset.nativePending,'Production checkbox immediately signals pending');
   await wait(async()=>{const t=await task(fixtureId),c=checkbox(fixtureId);return t.completed&&(!c||c.checked&&!c.disabled)},'committed Home completion');await frames();(raw.confirmedTaskUI??=[]).push(performance.now()-start);
   const completed=await task(fixtureId);await measure('task.reopen',()=>panel.toggle(completed,false));await wait(()=>checkbox(fixtureId)&&!checkbox(fixtureId).disabled&&!checkbox(fixtureId).checked,'reopened Home row');await frames();
  }
  checks.push('Thirty real Home checkbox completions show immediate pending feedback, then authoritative committed UI confirmation');
  for(let i=0;i<30;i++){
   let current=await task(fixtureId),r=await wait(()=>row(fixtureId),'Home Step row');const toggle=r.querySelector('.hub-task-steps-toggle');if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();
   const control=r.querySelector('.hub-task-step-item input'),done=!current.steps[0].completed,start=performance.now();control.click();
   await wait(async()=>{const t=await task(fixtureId),c=row(fixtureId)?.querySelector('.hub-task-step-item input');return t.steps[0].completed===done&&c&&c.checked===done&&!c.disabled},'committed Home Step');await frames();(raw.confirmedStepUI??=[]).push(performance.now()-start);
  }
  checks.push('Thirty real Home Step controls confirm independently through the same production pending/commit path');
  for(let i=0;i<20;i++){
   const current=await task(fixtureId),start=performance.now(),modal=panel.actions.editTask(current,()=>{});await modal.ready;await frames();(raw.editorOpen??=[]).push(performance.now()-start);assert(modal.modalEl.getClientRects().length);
   const input=modal.taskFields.input;input.value='TaskCore acceptance edited '+i;input.dispatchEvent(new Event('input',{bubbles:true}));
   const save=[...modal.contentEl.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save'),saving=performance.now();save.click();assert(modal.saving);await wait(()=>modal.closed,'real editor Save');await frames();(raw.editorSave??=[]).push(performance.now()-saving);
  }
  for(let i=0;i<20;i++){const start=performance.now();window.hubOpenStatistics();await wait(()=>plugin.statisticsModal?.source,'ordinary Statistics');await frames();(raw.statisticsNavigation??=[]).push(performance.now()-start);plugin.statisticsModal.close();await measure('historyQuery',()=>host.completionFeed.read());}
  checks.push('Twenty repeated actual editor openings/Saves and Statistics/History navigations in ordinary Work');
  for(const id of created.slice(1)){const current=await task(id);await measure('task.delete',()=>runtime.execute({type:'task.delete',operationId:randomUUID(),taskId:id,expectedRevision:current.revision}));}
  // All temporary completions are reopened before deletion, keeping Statistics clean.
  let current=await task(fixtureId);for(const step of current.steps)if(step.completed){await panel.actions.mutate({...current,operation:'step',step,stepCompleted:false});current=await task(fixtureId)}if(current.completed){await panel.toggle(current,false);current=await task(fixtureId)}await measure('task.delete',()=>runtime.execute({type:'task.delete',operationId:randomUUID(),taskId:fixtureId,expectedRevision:current.revision}));
  const summary=values=>{const a=[...values].sort((x,y)=>x-y);return{samples:a.length,medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.ceil(a.length*.95)-1],maxMs:a.at(-1)}};
  const result={pass:true,at:new Date().toISOString(),checks,startup:{hostMs:host.startupMs,fromPluginMs:host.startupFromPluginMs},timings:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,summary(v)])),rendererHeartbeat:summary(gaps),raw,visible:document.visibilityState,owners:host.nativeTasks.owners.length,remainingAcceptanceTasks:(await runtime.list()).tasks.filter(t=>created.includes(t.id)).length,remainingCountedAcceptanceHistory:(await host.completionFeed.read()).records.filter(r=>created.includes(r.nativeHistory.taskId)).length,notes:'Programmatic activation of actual production controls; confirmed UI includes two animation frames. OS input queue/optical latency excluded. All acceptance tasks deleted and their completions reopened.'};
  assert.equal(result.remainingAcceptanceTasks,0);assert.equal(result.remainingCountedAcceptanceHistory,0);fs.writeFileSync(path.join(evidence,'WORK-PERFORMANCE.json'),JSON.stringify(result,null,2));return{pass:true,startup:result.startup,timings:result.timings,rendererHeartbeat:result.rendererHeartbeat};
 }catch(error){persist();fs.writeFileSync(path.join(evidence,'WORK-PERFORMANCE-ERROR.txt'),error.stack);throw error}
 finally{clearInterval(timer);component.unload()}
};
