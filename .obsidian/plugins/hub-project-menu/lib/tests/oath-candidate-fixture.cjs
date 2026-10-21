"use strict";
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const {fixture:taskFixture}=require("./task-service-fixture.cjs");
const {taskKey,workspaceRef}=require("../domain/oath-workspace");
const {legacyReadView}=require("../services/task-service-legacy-read");
const {legacyReadTask}=require("../services/task-service-legacy-bridge");
function oathClass(original=false){
 const filename=path.resolve(__dirname,"../services/oath.js"),compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(path.dirname(filename));let sequence=0;
 compiled.require=function(name){return name==="crypto"?{randomUUID:()=>"fixture-oath-"+(++sequence)}:Module.prototype.require.call(this,name);};
 compiled._compile(fs.readFileSync(original?path.join(__dirname,"oath-candidate-service-original.cjs"):filename,"utf8"),filename);return compiled.exports.HubOathService;
}
function fixture({original=false,count=0}={}){
 const metadata={parent:{necessity:"must",dueDate:"2026-10-25",dueTime:"00:00",description:"Recorded **metadata**"},future:{fromDate:"2026-11-01",fromTime:"00:00",dueDate:"2026-11-02"},malformed:{necessity:"unexpected",fromDate:"not-a-date",dueDate:"2026-02-30"}};
 const f=taskFixture({metadata}),cleanup=[],counts={queries:0,sources:0,persists:0},now=+new Date(2026,9,26,12);
 for(const[id,name,status]of[["future-project","Future","future"],["shelved","Shelved","shelved"],["deleted","Deleted","active"]])f.owners.push({projectId:id,name,status,root:"Projects/"+name,path:`Projects/${name}/${name}.md`,contextKind:"project"});
 for(const[resourceType,name]of[["literature","Research"],["references","Explorations"],["inspiration","Inspiration"]])f.owners.push({projectId:"resource:"+resourceType,resourceType,name,root:"Resources/"+name,path:`Resources/${name}/${name}.md`,contextKind:"resource"});
 for(const o of f.owners){o.id=o.resourceType??o.projectId;if(o.projectId!=="deleted")f.add(o.path,"");}
 f.add("Projects/Private/Tasks.md","- [ ] Parent **markdown** <!-- hub-task:parent -->\n    continuation evidence\n    - [x] First <!-- hub-task:first -->\n        - [ ] Nested <!-- hub-task:nested -->\n- [ ] ID-less\n- [ ] Same title\n- [ ] Same title\n- [x] Completed <!-- hub-task:complete -->\n- [ ] Future <!-- hub-task:future -->\n- [ ] Malformed metadata <!-- hub-task:malformed -->\n- [ ] Copied parent <!-- hub-task:copied -->\n- [ ] Copied Step parent <!-- hub-task:steps-parent -->\n    - [ ] Copied Step <!-- hub-task:step-copy -->\n- [ ] Parent collides with Step <!-- hub-task:parent-step -->\n");
 f.add("Projects/Itacan/Tasks.md","- [ ] Itacan task <!-- hub-task:itacan-task -->\n");f.add("Projects/Obsidian Hub/Tasks.md","- [ ] Hub task <!-- hub-task:hub-task -->\n");
 f.add("Resources/Knowledge/Mounted/Tasks.md","- [ ] Resource presentation conflict <!-- hub-task:resource-task -->\n");f.pages.get("Resources/Knowledge/Mounted/Tasks.md").project={path:"Projects/Itacan/Itacan.md"};
 for(const o of f.owners.filter(o=>o.contextKind==="resource"&&o.resourceType!=="study"))f.add(o.root+"/Tasks.md","- [ ] "+o.name+" task <!-- hub-task:"+o.resourceType+"-task -->\n");
 f.add("Outside/Conflicts.md","- [ ] Copy <!-- hub-task:copied -->\n- [ ] Outside parent <!-- hub-task:outside -->\n    - [ ] Copied step <!-- hub-task:step-copy -->\n    - [ ] Parent ID on Step <!-- hub-task:parent-step -->\n");
 f.add("Projects/Private/Nested/Tasks.md","- [ ] Nested parent <!-- hub-task:deep -->\n");
 f.add("Projects/Future/Tasks.md","- [ ] Inactive workspace task <!-- hub-task:inactive -->\n");
 for(let i=0;i<count;i++){const owner=f.owners.filter(o=>o.projectId!=="deleted")[i%9];f.add(owner.root+"/Synthetic-"+i+".md",`- [ ] Task ${i}${i%13===0?"":` <!-- hub-task:synthetic-${i%19===0?"copy":i} -->`}\n${i%3===0?"    - [ ] Step\n":""}`);}
 f.plugin.taskService=f.service;f.plugin.register=fn=>cleanup.push(fn);
 const dv={index:{initialized:true},pages:()=>({array:()=>[...f.pages.values()]})};f.plugin.app.plugins.getPlugin=()=>({api:dv});
 f.wizard.getResourceTypes=()=>f.owners.filter(o=>o.contextKind==="resource");f.wizard.getResourceFolders=()=>[{path:"Resources/Knowledge/Mounted"}];
 f.plugin.dataStore.deviceId="candidate-device";let saved=null,failPersist=false;
 f.plugin.dataStore.save=async data=>{counts.persists++;if(failPersist)throw Error("Synthetic commitment persistence failure");saved=structuredClone(data);};
 const pages=f.plugin.taskData.readPages.bind(f.plugin.taskData);f.plugin.taskData.readPages=(...args)=>{counts.queries++;return pages(...args);};
 const read=f.vault.read;f.vault.read=(...args)=>{counts.sources++;return read(...args);};
 const full={restore(){},isFull:()=>false,enter:async()=>true,exit:async()=>{},destroy(){}};
 const Oath=oathClass(original),oath=new Oath(f.plugin,full,{now:()=>now,notice:()=>{}});f.plugin.oath=oath;
 return{...f,oath,dv,counts,cleanup,now,read:ref=>oath.workspaceTasks(ref),draft:tasks=>({start:"scheduled",scheduledAt:now+60000,durationMs:1500000,workspace:{type:"project",id:"private"},tasks}),get saved(){return saved;},failPersist:value=>{failPersist=value;},async close(){oath.destroy();cleanup.splice(0).forEach(fn=>fn());await f.close();}};
}
function facts(tasks){return tasks.map(t=>({key:taskKey(t),path:t.path,line:t.line,text:t.text,hubTaskId:t.hubTaskId??null,completed:t.completed,necessity:t.necessity,fromDate:t.fromDate,fromTime:t.fromTime??null,dueDate:t.dueDate,dueTime:t.dueTime??null,description:t.description??"",steps:(t.steps??[]).map(s=>({text:s.text,line:s.line,parent:s.parent??null,hubTaskId:s.hubTaskId??null,completed:s.completed}))}));}
function proposedBridge(tasks,owner){return tasks.map(task=>legacyReadTask(legacyReadView(task,workspaceRef(owner),"indexed")));}
module.exports={fixture,facts,proposedBridge,workspaceRef};
if(require.main===module){const browser=process.argv.includes("--browser-input"),target=path.join(__dirname,browser?"oath-candidate-input.json":"oath-candidate-baseline.json");if(fs.existsSync(target))throw Error("Original capture already exists");const f=fixture({original:true});const result=browser?{owners:f.owners,files:[...f.contents],pages:[...f.pages],metadata:f.wizard.data.taskMetadata,now:f.now}:f.owners.map(owner=>({workspace:workspaceRef(owner),candidates:facts(f.read(workspaceRef(owner)))}));fs.writeFileSync(target,JSON.stringify(result,null,2)+"\n");console.log("Captured original "+(browser?"browser inputs":"candidates for "+result.length+" workspace identities")+"; writes="+f.state.writes);f.close();}
