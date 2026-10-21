"use strict";
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const {fixture:base,workspaceRef}=require("./oath-candidate-fixture.cjs");
const {taskMetadata}=require("../domain/task-planning");
function fixture({original=false,count=0}={}){
 const f=base({original,count});
 if(original){f.oath.destroy();const filename=path.resolve(__dirname,"../services/oath.js"),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));let seq=0;m.require=function(n){return n==="crypto"?{randomUUID:()=>"fixture-oath-"+(++seq)}:Module.prototype.require.call(this,n);};m._compile(fs.readFileSync(path.join(__dirname,"oath-committed-original.cjs"),"utf8"),filename);f.oath=new m.exports.HubOathService(f.plugin,{restore(){},isFull:()=>false,enter:async()=>true,exit:async()=>{},destroy(){}},{now:()=>f.now,notice:()=>{}});f.plugin.oath=f.oath;}
 const close=f.close.bind(f);f.close=async()=>{f.oath.destroy();await close();};return f;
}
function commit(f,ids=["parent"],workspace={type:"project",id:"private"},state="active"){
 const tasks=f.oath.tasks(),refs=ids.map(id=>{const task=tasks.find(t=>t.hubTaskId===id);return{id,path:task?.path??"Missing.md",text:task?.text??"Saved missing task"};});
 f.wizard.data.oathsByDevice={...f.wizard.data.oathsByDevice,[f.plugin.dataStore.deviceId]:{current:{id:"committed-oath",deviceId:f.plugin.dataStore.deviceId,state,workspace,scheduledAt:state==="scheduled"?f.now+60000:f.now,startedAt:state==="active"?f.now:null,takenAt:f.now,durationMs:1500000,tasks:refs,fulfilledAt:null,fullscreenOwned:false},history:[]}};f.oath.work=refs.map(ref=>({ref,task:null}));return refs;
}
function projection(work){return work.map(({ref,task})=>({ref,task:task?{path:task.path,line:task.line,end:task.end,text:task.text,hubTaskId:task.hubTaskId,completed:task.completed,status:task.status,steps:task.steps.map(s=>({...s})),...taskMetadata(task)}:null}));}
function request(f){return{workspace:f.oath.current.workspace,references:f.oath.current.tasks,awaitingIndex:[...f.oath.awaitingIndex].map(([id,t])=>({id,path:t.path,line:t.line,text:t.text}))};}
const gate=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function bridge(f,{preexisting=false,indexed=false}={}){
 const note="Projects/Private/Bridge.md";f.add(note,"- [ ] Bridge"+(indexed?" <!-- hub-task:source-existing -->":"")+"\n    - [x] Done\n        - [ ] Nested\n");
 const selected=f.oath.workspaceTasks({type:"project",id:"private"}).find(t=>t.path===note);
 if(preexisting&&!indexed)f.contents.set(note,f.contents.get(note).replace("Bridge","Bridge <!-- hub-task:source-existing -->"));
 const stale=structuredClone(f.pages.get(note)),process=f.vault.process.bind(f.vault);f.vault.process=async(file,transform)=>{await process(file,transform);if(file.path===note)f.pages.set(note,structuredClone(stale));};
 await f.oath.take(f.draft([selected]));return{note,selected,id:f.oath.current.tasks[0].id,import(){f.index(f.files.get(note));}};
}
const scenarios={
 unique:f=>{},title:f=>{f.contents.set("Projects/Private/Tasks.md",f.contents.get("Projects/Private/Tasks.md").replace("Parent **markdown**","New current title"));},
 continuation:f=>{f.contents.set("Projects/Private/Tasks.md",f.contents.get("Projects/Private/Tasks.md").replace("continuation evidence","changed prose"));},
 line:f=>{f.contents.set("Projects/Private/Tasks.md","\n\n"+f.contents.get("Projects/Private/Tasks.md"));},
 rename:f=>f.move(f.files.get("Projects/Private/Tasks.md"),"Projects/Private/Renamed.md"),
 move:f=>f.move(f.files.get("Projects/Private/Tasks.md"),"Projects/Private/Nested/Moved.md"),
 "between-notes":f=>{const p="Projects/Private/Tasks.md",text=f.contents.get(p),end=text.indexOf("- [ ] ID-less");f.add("Projects/Private/Other.md",text.slice(0,end));f.contents.set(p,text.slice(end));f.index(f.files.get(p));},
 "cross-owner":f=>f.move(f.files.get("Projects/Private/Tasks.md"),"Resources/Knowledge/Moved.md"),
 "other-project":f=>f.move(f.files.get("Projects/Private/Tasks.md"),"Projects/Itacan/Moved.md"),
 "copy-same-note":f=>{const p="Projects/Private/Tasks.md";f.contents.set(p,f.contents.get(p)+"- [ ] Copy <!-- hub-task:parent -->\n");f.index(f.files.get(p));},
 "copy-outside":f=>f.add("Outside/New.md","- [ ] Copy <!-- hub-task:parent -->\n"),
 "copy-project":f=>f.add("Projects/Itacan/Copy.md","- [ ] Copy <!-- hub-task:parent -->\n"),
 "copy-resource":f=>f.add("Resources/Knowledge/Copy.md","- [ ] Copy <!-- hub-task:parent -->\n"),
 "copy-step":f=>f.add("Outside/New.md","- [ ] Another parent\n    - [ ] Copy <!-- hub-task:parent -->\n"),
 "unrelated-step-copy":f=>f.add("Outside/New.md","- [ ] Another\n    - [ ] Copy <!-- hub-task:first -->\n"),
 "delete-note":f=>f.remove(f.files.get("Projects/Private/Tasks.md")),
 "delete-task":f=>{f.contents.set("Projects/Private/Tasks.md","- [ ] Same title\n");},
 "remove-id":f=>{const p="Projects/Private/Tasks.md";f.contents.set(p,f.contents.get(p).replace("<!-- hub-task:parent -->",""));},
 "same-title":f=>{f.contents.set("Projects/Private/Tasks.md","- [ ] Parent **markdown** <!-- hub-task:unrelated -->\n");f.index(f.files.get("Projects/Private/Tasks.md"));},
 complete:f=>{const p="Projects/Private/Tasks.md";f.contents.set(p,f.contents.get(p).replace("- [ ] Parent","- [x] Parent"));},
 steps:f=>{const p="Projects/Private/Tasks.md";f.contents.set(p,f.contents.get(p).replace("- [ ] Nested","- [x] Nested"));},
 metadata:f=>{f.wizard.data.taskMetadata.parent={necessity:"should",description:"new",fromDate:"2026-10-26",fromTime:"00:00",phaseId:"phase-1"};},
 future:f=>{f.owners[0].status="future";},shelved:f=>{f.owners[0].status="shelved";},
 "rename-project":f=>{f.owners[0].name="Renamed";},
 "missing-dashboard":f=>f.remove(f.files.get(f.owners[0].path)),
 "delete-project":f=>{f.owners.splice(0,1);},
 "root-moved":f=>{const owner=f.owners[0];f.move(f.files.get(owner.path),"Projects/New/New.md");owner.root="Projects/New";owner.path="Projects/New/New.md";f.move(f.files.get("Projects/Private/Tasks.md"),"Projects/New/Tasks.md");}
};
module.exports={fixture,commit,projection,request,gate,bridge,scenarios,workspaceRef};
if(require.main===module){(async()=>{const output=path.join(__dirname,"oath-committed-baseline.json");if(fs.existsSync(output))throw Error("Do not overwrite original capture");const facts=[];for(const[name,change]of Object.entries(scenarios)){const f=fixture({original:true});try{commit(f);change(f);await f.oath.resolveWork();facts.push({name,work:projection(f.oath.work),pending:[...f.oath.awaitingIndex.keys()],snapshot:f.snapshot(),current:f.oath.current});}finally{await f.close();}}fs.writeFileSync(output,JSON.stringify(facts,null,2)+"\n");console.log("Frozen actual original resolution: "+facts.length+" scenarios");})().catch(e=>{console.error(e);process.exitCode=1;});}
