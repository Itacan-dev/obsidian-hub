"use strict";
window.onload=async()=>{try{
 window.process={platform:"win32",env:{}};
 const input=await(await fetch("oath-candidate-input.json")).json(),sources={},cache={};
 const resolve=(name,request)=>{const out=[];for(const p of(name.slice(0,name.lastIndexOf("/"))+"/"+request).split("/")){if(p==="..")out.pop();else if(p!==".")out.push(p);}return out.join("/");};
 async function prepare(name){if(sources[name]||name==="obsidian")return;const response=await fetch("../"+name+".js");assert(response.ok,"Existing module "+name);sources[name]=await response.text();for(const m of sources[name].matchAll(/require\(\s*["'](\.[^"']+)["']\s*\)/g))await prepare(resolve(name,m[1]));}
 const load=name=>{if(name==="obsidian")return obsidian;if(name==="crypto")return{randomUUID:()=>crypto.randomUUID()};if(name==="path")return{win32:{normalize:v=>v.replaceAll("/","\\")}};if(cache[name])return cache[name].exports;const m=cache[name]={exports:{}};new Function("module","exports","require",sources[name])(m,m.exports,n=>load(n.startsWith(".")?resolve(name,n):n));return m.exports;};
 for(const name of["ui/oath","services/oath","services/task-data","services/task-editor","services/task-service","services/task-service-legacy","ui/tasks","ui/oath-tasks"])await prepare(name);
 sources["services/original-oath"]=await(await fetch("oath-committed-original.cjs")).text();
 function host(original=false){const files=new Map(input.files),pages=new Map(structuredClone(input.pages)),owners=structuredClone(input.owners),subscribers=new Set(),cleanup=[],counts={index:0,sources:0,writes:0,persists:0};
  const vault={getAbstractFileByPath:path=>files.has(path)?{path,extension:"md"}:null,read:async file=>{counts.sources++;return files.get(file.path);},process:async(file,change)=>{counts.writes++;files.set(file.path,change(files.get(file.path)));}};
  const api={index:{initialized:true},pages:()=>({array:()=>{counts.index++;return[...pages.values()];}})};
  const app={vault,plugins:{getPlugin:()=>({api})},workspace:{openLinkText(){}}};
  const wizard={data:{taskMetadata:input.metadata},getProjectRecords:()=>owners.filter(o=>o.contextKind==="project"),getResourceTypes:()=>owners.filter(o=>o.contextKind==="resource"),getProjectById:id=>owners.find(o=>o.contextKind==="project"&&o.projectId===id),getResourceById:id=>owners.find(o=>o.contextKind==="resource"&&o.resourceType===id),getContextForPath:path=>owners.find(o=>path===o.root||path.startsWith(o.root+"/")),getCategories:()=>[]};
  const plugin={app,projectWizard:wizard,register:fn=>cleanup.push(fn),dataStore:{deviceId:"browser",save:async()=>{counts.persists++;}},workspaceModes:{currentContext:()=>owners[0]},enqueueTaskMutation:fn=>fn()};
  plugin.taskData=new(load("services/task-data").HubTaskDataService)(app,{metadata:id=>input.metadata[id]});
  plugin.taskData.subscribe=(owner,fn)=>{subscribers.add(fn);const stop=()=>subscribers.delete(fn);owner.register(stop);return stop;};
  plugin.taskEditor=new(load("services/task-editor").HubTaskEditor)(plugin);plugin.taskEditor.metadata=id=>input.metadata[id]??{};
  const adapter=new(load("services/task-service-legacy").LegacyTaskAdapter)({plugin,dataview:api});plugin.taskService=new(load("services/task-service").TaskService)(adapter);
  const service=new(load(original?"services/original-oath":"services/oath").HubOathService)(plugin,{restore(){},isFull:()=>false,enter:async()=>true,exit:async()=>{},destroy(){}},{now:()=>input.now,notice:()=>{}});
  return{plugin,service,adapter,files,pages,owners,subscribers,cleanup,counts,api,async close(){cleanup.splice(0).forEach(fn=>fn());service.destroy();await plugin.taskService.close();}};
 }

 const checks=[],captures=[],originals=[];
 const check=(ok,message)=>{assert(ok,message);checks.push(message);};
 const compare=(a,b,message)=>{if(JSON.stringify(a)!==JSON.stringify(b))window.hubTaskOpeningFrames={mismatch:{message,a,b},checks};check(JSON.stringify(a)===JSON.stringify(b),message);};
 const {createTaskUi,createTaskRow}=load("ui/tasks"),ui=load("ui/oath"),{oathProgress}=load("domain/oath");
 const facts=element=>({html:element.innerHTML.replace(/hub-tooltip-\d+/g,"hub-tooltip-ID"),rects:[element,...element.querySelectorAll("section,input,button,.project-task-row,.hub-oath-missing,.hub-oath-pinned-status,.hub-oath-status-work")].map(el=>{const r=el.getBoundingClientRect();return[el.tagName,el.className,...[r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100)];})});
 async function capture(original,mode){const h=host(original),owner=h.owners[0];
  const refs=["parent","complete","steps-parent","absent"].map(id=>{const t=h.service.tasks().find(t=>t.hubTaskId===id);return{id,path:t?.path??"Saved/Missing.md",text:t?.text??"Saved missing commitment"};});
  h.plugin.projectWizard.data.oathsByDevice={browser:{current:{id:"browser-oath",deviceId:"browser",state:mode==="scheduled"?"scheduled":"active",workspace:{type:"project",id:"private"},tasks:refs,takenAt:input.now,startedAt:mode==="scheduled"?null:input.now-60000,scheduledAt:input.now-60000,durationMs:1500000,fulfilledAt:mode==="fulfilled"?input.now-1000:null,...(mode==="strict"?{policy:{mode:"strict",applications:[]}}:{})},history:[]}};
  if(mode==="changed")h.files.set("Projects/Private/Tasks.md",h.files.get("Projects/Private/Tasks.md").replace("Parent **markdown**","Current changed **title**"));
  if(mode==="missing")h.files.delete("Projects/Private/Tasks.md");
  h.plugin.projectWizard.data.oathsByDevice.browser.current.scheduledAt=mode==="scheduled"?input.now+60000:input.now-60000;
  h.plugin.projectWizard.data.oathsByDevice.browser.current.lastObservedAt=input.now;
  if(mode==="strict")h.service.strict.owns=()=>true;
  await h.service.resolveWork();h.service.needsRead=false;const section=document.getElementById("fixture");section.empty();const body=section.createDiv({cls:"project-tasks-body hub-button-scope"}),component=new Component();component.load();
  const taskUi=createTaskUi({app:h.plugin.app,component,body,oath:h.service,mutate:()=>{throw Error("No source writes in parity capture");},onEdit(){},editTask:()=>{}});
  const plan=taskUi.partitionOath(h.service.tasks());taskUi.renderOath(plan,(task,completed,parent)=>{const row=createTaskRow(parent,task,completed);taskUi.bind(row.row,row.textEl,task,()=>task.path,{description:false});});await settle();
  const disclosure=body.querySelector(".hub-task-steps-toggle");disclosure?.click();await settle();const pin=facts(body),progress=oathProgress(h.service.work),work=h.service.work.map(({ref,task})=>({ref,task:task?{path:task.path,line:task.line,text:task.text,id:task.hubTaskId,completed:task.completed,steps:task.steps}:null}));
  const target=body.querySelector('input[type="checkbox"]');target?.focus();const focus=target===document.activeElement,scroll=(body.scrollTop=32,body.scrollTop);
  const before={...h.counts};for(let i=0;i<5;i++){h.service.tickDisplay();await h.service.refresh(false);}compare(h.counts,before,"Read-free display clocks "+mode+" "+original);
  const modal=ui.openOathStatus(h.service);await settle();const status=facts(modal.modalEl);check(modal.contentEl.textContent.includes("Saved missing commitment")||mode==="missing","Unavailable saved reference remains visible "+mode+" "+original);
  if(!original&&mode==="active"){window.hubTestScreenshotRequest="oath-committed-active";await new Promise(resolve=>{window.hubTestScreenshotDone=resolve;});}
  modal.close();
  check(focus||!target,"Pinned checkbox keyboard focus "+mode+" "+original);check(body.scrollTop===scroll,"Pinned scroll retained "+mode+" "+original);check(h.counts.writes+h.counts.persists===0,"Active read capture never writes "+mode+" "+original);
  component.unload();check(h.service.clockListeners.size===0,"Renderer cleanup releases clock listener "+mode+" "+original);await h.close();return{mode,pin,status,progress,work};
 }
 const beforeOnly=new URLSearchParams(location.search).get("preview")==="before";
 for(const mode of["active","scheduled","strict","fulfilled","changed","missing"]){const before=await capture(true,mode);originals.push(before);if(!beforeOnly){const after=await capture(false,mode);compare(after,before,"Actual original/current active/pinned/status DOM, geometry and source state "+mode);captures.push(after);}}
 if(!beforeOnly){const frozen=await(await fetch("oath-committed-dom-baseline.json")).json();compare(originals,frozen,"Original active DOM/geometry matches pre-integration capture");}
 if(!beforeOnly){
  const h=host(),task=h.service.tasks().find(t=>t.hubTaskId==="parent"),ref={id:"parent",path:task.path,text:task.text};
  h.plugin.projectWizard.data.oathsByDevice={browser:{current:{id:"race-oath",deviceId:"browser",state:"active",workspace:{type:"project",id:"private"},tasks:[ref],takenAt:input.now,startedAt:input.now,durationMs:1500000,fulfilledAt:null},history:[]}};
  await h.service.refresh();const modal=ui.openOathStatus(h.service);await settle();
  const raw=h.adapter.resolveOathWork.bind(h.adapter),pending=[];
  h.adapter.resolveOathWork=async request=>{const value=await raw(request);return new Promise(resolve=>pending.push({value,resolve}));};
  const old=h.service.refresh();while(pending.length<1)await Promise.resolve();
  const result=load("domain/tasks").editTaskContent(h.files.get(task.path),{...h.service.work[0].task,completed:true},line=>line.replace("[ ]","[x]"));h.files.set(task.path,result.content);h.service.changed(result.edit);await settle();
  check(!!modal.contentEl.querySelector('[aria-label="Completed"]'),"Active status shows local completion while older read is pending");
  pending[0].resolve(pending[0].value);while(pending.length<2)await Promise.resolve();
  check(h.service.work[0].task.completed,"Obsolete incomplete result cannot reverse active completion");pending[1].resolve(pending[1].value);await old;await settle();
  check(modal.contentEl.textContent.includes("Fulfilled")&&!!modal.contentEl.querySelector('[aria-label="Completed"]'),"Actual status retains fulfillment and completed source after coalesced read");
  check(h.counts.persists===1,"Deferred UI completion persists fulfillment exactly once");
  h.adapter.resolveOathWork=async()=>{throw Error("Synthetic read unavailable");};await h.service.refresh();await settle();check(!!modal.contentEl.querySelector('[aria-label="Completed"]'),"Temporary query failure retains current active UI");
  h.adapter.resolveOathWork=raw;await h.service.refresh();await settle();check(h.counts.persists===1,"Read recovery never duplicates fulfillment");
  h.adapter.resolveOathWork=async request=>{const value=await raw(request);return new Promise(resolve=>pending.push({value,resolve}));};
  const closing=h.service.resolveWork();while(pending.length<3)await Promise.resolve();modal.close();const work=h.service.work;h.service.destroy();pending[2].resolve(pending[2].value);await closing;check(h.service.work===work&&!modal.containerEl.isConnected,"Late active read cannot publish after modal/service disposal");
  check(h.subscribers.size===0,"Active disposal removes its shared backend subscription");await h.close();
 }
 const last=host();last.plugin.workspaceModes.currentContext=()=>last.owners[0];const setup=ui.openOathSetup(last.service);await settle();setup.close();await last.close();
 check(runtimeErrors.length===0,"No asynchronous browser errors");window.hubTaskOpeningFrames={originals,captures,checks};document.getElementById("result").textContent="PASS "+checks.length+" actual committed Oath UI checks";
}catch(error){document.getElementById("result").textContent="FAIL: "+(error.stack||error);}};
