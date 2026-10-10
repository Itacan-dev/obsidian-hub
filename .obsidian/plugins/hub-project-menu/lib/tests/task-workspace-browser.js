"use strict";
HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);e.className=o.cls||"";if(o.text!=null)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);if(o.type)e.type=o.type;this.append(e);return e};
HTMLElement.prototype.createDiv=function(o){return this.createEl("div",o)};
HTMLElement.prototype.createSpan=function(o){return this.createEl("span",o)};
HTMLElement.prototype.empty=function(){this.replaceChildren()};
class Component{constructor(){this.children=new Set();this.cleanup=[]}register(fn){this.cleanup.push(fn)}registerEvent(ref){this.register(()=>ref.emitter.offref(ref))}addChild(child){this.children.add(child)}removeChild(child){child.unload();this.children.delete(child)}unload(){this.cleanup.splice(0).forEach(fn=>fn());this.children.forEach(c=>c.unload());this.children.clear()}}
class Emitter{constructor(){this.events=new Map()}on(name,fn){const ref={emitter:this,name,fn};if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(ref);return ref}offref(ref){this.events.get(ref.name)?.delete(ref)}emit(name,...args){for(const ref of this.events.get(name)||[])ref.fn(...args)}}
class Modal{constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:"modal-container"});this.modalEl=this.containerEl.createDiv({cls:"modal"});this.modalEl.createEl("button",{text:"×",cls:"modal-close-button"}).onclick=()=>this.close();this.contentEl=this.modalEl.createDiv();this.escape=e=>{if(e.key==="Escape")this.close()};document.addEventListener("keydown",this.escape)}open(){window.lastModal=this;this.onOpen?.()}close(){this.onClose?.();this.containerEl.remove();document.removeEventListener("keydown",this.escape)}}
Modal.prototype.setTitle = function(title) { this.modalEl.setAttribute("aria-label", title); };
class FuzzySuggestModal extends Modal{onOpen(){for(const item of this.getItems())this.contentEl.createEl("button",{text:this.getItemText(item)}).onclick=()=>{this.onChooseItem(item);this.close()}}}
class Menu {
 constructor(){this.items=[];this.hideHandlers=[];}
 addItem(fn){const item={setTitle(value){this.title=value;return this},setIcon(){return this},setWarning(){return this},setChecked(value){this.checked=value;return this},onClick(fn){this.action=fn;return this}};fn(item);this.items.push(item);return this}
 onHide(fn){this.hideHandlers.push(fn);return this}
 showAtMouseEvent(event){this.showAtPosition({x:event.clientX,y:event.clientY})}
 showAtPosition({x,y}){
  this.el=document.body.createDiv({cls:"menu hub-fixture-menu",attr:{role:"menu"}});
  this.el.style.cssText="position:fixed;z-index:999;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:6px;padding:4px;box-shadow:0 3px 12px #0005;min-width:130px";
  for(const item of this.items){const button=this.el.createEl("button",{text:item.title,cls:"menu-item",attr:{role:"menuitem"}});button.style.cssText="display:block;width:100%;text-align:left;border:0;background:transparent;font-size:12px";button.onclick=()=>{this.hide();item.action?.()};}
  const r=this.el.getBoundingClientRect();this.el.style.left=Math.max(0,Math.min(x,innerWidth-r.width))+"px";this.el.style.top=Math.max(0,Math.min(y,innerHeight-r.height))+"px";
  this.outside=event=>{if(!this.el.contains(event.target))this.hide()};this.key=event=>{if(event.key==="Escape"){event.preventDefault();this.hide();return;}if(["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();const buttons=[...this.el.querySelectorAll("button")],i=buttons.indexOf(document.activeElement);buttons[(i+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length].focus()}};
  queueMicrotask(()=>{if(this.el?.isConnected){document.addEventListener("pointerdown",this.outside);document.addEventListener("keydown",this.key);this.el.querySelector("button")?.focus();}});
 }
 hide(){if(!this.el)return;this.el.remove();document.removeEventListener("pointerdown",this.outside);document.removeEventListener("keydown",this.key);this.el=null;this.hideHandlers.splice(0).forEach(fn=>fn())}
}
const notices=[],assert=(condition,message)=>{if(!condition)throw Error(message)};
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))};
const icons={route:"M3 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M15 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M9 17h8a4 4 0 0 0 0-8H7a4 4 0 0 1 0-8h8","grip-vertical":"M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01","chevron-up":"m5 15 7-7 7 7",folder:"M3 7h6l2-3h9v16H3z","list-todo":"M9 6h11M9 12h11M9 18h11M3 6h2M3 12h2M3 18h2",search:"M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",plus:"M12 5v14M5 12h14","chevron-right":"m9 5 7 7-7 7","chevron-left":"m15 5-7 7 7 7","chevron-down":"m5 9 7 7 7-7",x:"m5 5 14 14M5 19 19 5"};
Object.assign(icons, {"clock-alert":"M12 6v6l4 2 M20 12v5 M20 21h.01 M21.25 8.2A10 10 0 1 0 16 21.16",sun:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 m4.93 4.93 1.41 1.41 m17.66 17.66 1.41 1.41 M2 12h2 M20 12h2 m6.34 17.66-1.41 1.41 m19.07 4.93-1.41 1.41","calendar-clock":"M16 14v2.2l1.6 1 M16 2v4 M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5 M3 10h5 M8 2v4 M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12","calendar-off":"M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18 M21 15.5V6a2 2 0 0 0-2-2H9.5 M16 2v4 M3 10h7 M21 10h-5.5 m2 2 20 20"});
const obsidian={getIcon:()=>null,Component,Modal,FuzzySuggestModal,Menu,Notice:class{constructor(text){notices.push(text)}},setIcon(el,name){el.replaceChildren();el.dataset.icon=name;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");for(const[k,v]of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round","stroke-linejoin":"round"}))svg.setAttribute(k,v);const p=document.createElementNS(svg.namespaceURI,"path");p.setAttribute("d",icons[name]||icons.folder);svg.append(p);el.append(svg)},MarkdownRenderer:{render:async(app,text,el)=>el.createEl("p",{text})}};
window.onerror=(message,source,line,col,error)=>document.getElementById("result").textContent="FAIL: "+(error?.stack||message);
window.onload=async()=>{try{
 const names=["ui/focus-restoration","ui/window-title","config","domain/files","domain/workspace-explorer","ui/file-icons","ui/workspace-explorer","domain/tasks","domain/dates","domain/task-planning","domain/task-form","ui/date-time","ui/task-form","domain/task-views","domain/task-progress","domain/oath","domain/oath-workspace",
 "domain/roadmap-milestones","ui/disclosure","domain/project-planning","services/project-planning","ui/planning-editor","ui/project-roadmap","ui/tooltips","ui/list-reorder","ui/pointer-list-reorder","ui/schedule-toolbar","ui/full-view-layout","domain/context-search","services/context-search","ui/context-search","ui/icons","services/task-writes","services/task-locations","services/task-data","services/task-editor","ui/markdown","ui/completion-audio","ui/task-steps","ui/oath-tasks","ui/tasks","ui/task-editor","ui/task-view-primitives","ui/task-view-upcoming","ui/task-view-table","ui/task-view-location","ui/task-view-calendar","ui/task-view-timeline","ui/task-workspace","ui/app-shortcuts"];
 const sources=Object.fromEntries(await Promise.all(names.map(async name=>[name,await(await fetch("../"+name+".js")).text()]))),cache={};
 const load=name=>{if(name==="obsidian")return obsidian;if(name==="crypto")return{randomUUID:()=>crypto.randomUUID()};if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};if(!sources[name])throw Error("Missing module "+name);new Function("module","require","process",sources[name])(module,request=>{if(["obsidian","crypto"].includes(request))return load(request);const parts=(name.slice(0,name.lastIndexOf("/"))+"/"+request).split("/"),out=[];for(const part of parts){if(part==="..")out.pop();else if(part!==".")out.push(part)}return load(out.join("/"))},{env:{}});return module.exports};
 const domain=load("domain/tasks"),planning=load("domain/task-planning"),dates=load("domain/dates"),progress=load("domain/task-progress");
 const sharedHost=document.body.createDiv({cls:"hub-task-form hub-button-scope"});
 const sharedState={text:"Canonical task",fromDate:"2026-10-03",dueDate:"2026-10-05",dueTime:"00:00",steps:[
  {text:"Parent Step",line:4,end:7},{text:"Nested Step",line:5,end:6},{text:"Sibling Step",line:7,end:8}
 ]};
 const {mountTaskFields,mountTaskRelationshipFields}=load("ui/task-form");
 mountTaskFields({host:sharedHost,state:sharedState});
 const startDate=sharedHost.querySelector('[aria-label="Start date"]'),dueDate=sharedHost.querySelector('[aria-label="Due date"]');
 assert(!sharedHost.textContent.includes("Include time")&&!sharedState.fromTime&&sharedState.dueTime==="00:00","Shared fields preserve untimed and explicit midnight values without a toggle");
 const enterDate=(input,value)=>{input.value=value;input.dispatchEvent(new Event("input"))};
 startDate.click();let datePicker=window.lastModal;enterDate(datePicker.date,"2026-10-04");
 assert(sharedState.fromDate==="2026-10-04"&&!sharedState.fromTime,"Calendar-only selection remains untimed");
 enterDate(datePicker.time,"09:30");
 assert(sharedState.fromTime==="09:30","Choosing time in native picker retains the selected time");
 datePicker.clearTime.click();assert(!sharedState.fromTime&&sharedState.fromDate==="2026-10-04","Picker Clear time keeps the date");datePicker.close();
 dueDate.click();datePicker=window.lastModal;enterDate(datePicker.date,"");
 assert(!sharedState.dueDate&&!sharedState.dueTime,"Native Clear removes date/time together");datePicker.close();
 dueDate.click();datePicker=window.lastModal;
 assert(!datePicker.date.value&&!sharedState.dueDate,"Opening an empty picker does not preselect or persist a date");datePicker.close();
 assert(!sharedState.dueDate,"Dismissing empty picker preserves absent date");
 dueDate.click();datePicker=window.lastModal;enterDate(datePicker.date,"2026-10-05");
 assert(sharedState.dueDate==="2026-10-05"&&!sharedState.dueTime,"First date selection does not persist an automatic default time");
 enterDate(datePicker.time,"00:00");assert(sharedState.dueTime==="00:00","Picker supports explicitly selecting midnight");datePicker.close();
 sharedHost.querySelector('[aria-label="Remove step 1"]').click();
 assert(sharedState.steps.length===1&&sharedState.steps[0].text==="Sibling Step","Shared Step removal preserves Markdown descendant deletion rule");
 mountTaskRelationshipFields({host:sharedHost,state:sharedState,service:{context:()=>{throw Error("No location must not query a workspace")},phases:()=>{throw Error("No location must not query phases")}},location:()=>undefined});
 sharedHost.remove();
 let scheduleUi;
 if(new URLSearchParams(location.search).has('focus-test')){const tasksUi=load('ui/tasks'),factory=tasksUi.createTaskUi;tasksUi.createTaskUi=options=>(scheduleUi=factory(options))}
 const {HubTaskDataService}=load("services/task-data"),{HubTaskEditor}=load("services/task-editor"),{mountTaskWorkspace}=load("ui/task-workspace");
 const project={root:"Projects/Thesis",projectId:"p1",name:"Master’s thesis",contextKind:"project",status:"active",categoryId:"research"};
 const resource={root:"Resources/Knowledge",projectId:"resource:study",name:"Knowledge",contextKind:"resource"};
 const shelved={...project,root:"Projects/Old",projectId:"p2",name:"Old project",status:"shelved"};
 const vault=new Emitter(),metadataCache=new Emitter(),workspace=new Emitter(),objects=new Map(),contents=new Map();
 const folder=path=>objects.set(path,{path,name:path.split("/").at(-1),children:[]});
 const note=(path,text)=>{const file={path,name:path.split("/").at(-1),basename:path.split("/").at(-1).replace(/\.md$/,""),extension:"md",parent:objects.get(path.slice(0,path.lastIndexOf("/")))};objects.set(path,file);contents.set(path,text);return file};
 for(const path of [project.root,resource.root,resource.root+"/Mathematics",resource.root+"/Mathematics/Topology",resource.root+"/Mathematics/Topology/Assignments",resource.root+"/Mathematics/Topology/Lectures",resource.root+"/Physics",resource.root+"/Empty",resource.root+"/System",resource.root+"/System/Templates"])folder(path);
 const today=dates.localISODate(),shift=n=>{const date=new Date();date.setDate(date.getDate()+n);return dates.localISODate(date)};
 const wizard={data:{taskMetadata:{}},categories:[{id:"research",shortcuts:["overleaf","chatgpt"]}],getProjectRecords:()=>[project,shelved],getResourceTypes:()=>[resource],
 getProjectById:id=>[project,shelved].find(p=>p.projectId===id),getResourceById:id=>id===resource.projectId?resource:null,
 getContextForPath:path=>[project,resource,shelved].find(w=>path===w.root||path.startsWith(w.root+"/"))};
 const seed=(path,items)=>note(path,items.map((task,i)=>{const id="id-"+Math.random().toString(36).slice(2);wizard.data.taskMetadata[id]=planning.taskMetadata(task);return "- ["+(task.completed?"x":" ")+"] "+task.text+" <!-- hub-task:"+id+" -->\n"+(task.steps||[]).map((step,j)=>"    - ["+(step.completed?"x":" ")+"] "+step.text+" <!-- hub-task:"+id+"-s"+j+" -->\n").join("")}).join(""));
 const steps=[{text:"Read source material",completed:true},{text:"Draft solution",completed:false},{text:"Review",completed:false}];
 seed(project.root+"/Tasks.md",[
 {text:"Finalize research questions",necessity:"must",dueDate:shift(-2),steps},
 {text:"Literature review: neural rendering",necessity:"must",fromDate:today,dueDate:today,steps},
 {text:"Analyze initial results",necessity:"should",dueDate:shift(1),steps},
 {text:"Write methodology draft",fromDate:shift(2),dueDate:shift(10),steps},
 {text:"Meeting with supervisor",fromDate:shift(1),fromTime:"09:00"},
 {text:"Explore additional datasets"}, {text:"Completed task",completed:true,dueDate:today}
 ]);
 seed(resource.root+"/Mathematics/Topology/Assignments/Assignment 5.md",[
 {text:"Solve problem set 4 (Compactness)",linkedProjectId:"p1",necessity:"must",dueDate:shift(-1),steps},
 {text:"Write up solutions for problem set 5",necessity:"should",dueDate:today,steps}
 ]);
 seed(resource.root+"/Mathematics/Topology/Lectures/Tasks.md",[
 {text:"Review lecture 8 (Sections 6.1–6.4)",linkedProjectId:"p1",dueDate:shift(1),steps},
 {text:"Summarise key definitions",steps}
 ]);
 seed(resource.root+"/Physics/Notes.md",[{text:"Read related work",dueDate:shift(5),steps}]);
 seed(resource.root+"/System/Templates/Example.md",[{text:"Hidden template task"}]);
 let reads=0,checks=[],history=[],oathChanges=0,filesVisits=0;
 Object.assign(vault,{getAbstractFileByPath:path=>objects.get(path),getAllLoadedFiles:()=>[...objects.values()],getMarkdownFiles:()=>[...objects.values()].filter(f=>f.extension==="md"),
 cachedRead:async file=>contents.get(file.path),read:async file=>contents.get(file.path),create:async(path,text)=>{const file=note(path,text);queueMicrotask(()=>metadataCache.emit("dataview:metadata-change","update",file));return file},
 process:async(file,transform)=>{contents.set(file.path,transform(contents.get(file.path)));queueMicrotask(()=>metadataCache.emit("dataview:metadata-change","update",file))},getResourcePath:()=>""});
 workspace.getActiveFile=()=>objects.get(project.root+"/Tasks.md");workspace.openLinkText=()=>{};
 const plugin={app:{vault,metadataCache,workspace},projectWizard:wizard,dataStore:{save:async()=>{}},
 enqueueTaskMutation:fn=>{const result=(plugin.queue??Promise.resolve()).then(fn);plugin.queue=result.catch(()=>{});return result},
 markProjectChangedByPath(){},notifyCompletedTasksChanged(){},oath:{changed(){oathChanges++}},
 register:fn=>cleanup.register(fn),registerEvent:ref=>cleanup.registerEvent(ref),registerDomEvent:(el,event,fn)=>{el.addEventListener(event,fn);cleanup.register(()=>el.removeEventListener(event,fn))},openAppShortcut:async id=>{plugin.lastShortcut=id}};
 wizard.recordTaskMutation=async(edit,owner,time)=>{const result=progress.taskProgressMutation(checks,history,edit,owner,time,()=>crypto.randomUUID());checks=result.checks;history=result.history;return result.changed};
 plugin.taskEditor=new HubTaskEditor(plugin);plugin.taskData=new HubTaskDataService(plugin.app,{metadata:id=>plugin.taskEditor.metadata(id)});
 plugin.mutateTask=request=>plugin.enqueueTaskMutation(async()=>{const file=objects.get(request.path);const content=contents.get(file.path);
 const result=request.operation==="step"?planning.toggleTaskStep(content,request):domain.editTaskContent(content,request,line=>line.replace(/\[([ xX])\]/,(_,marker)=>marker===" "?"[x]":"[ ]"));
 await vault.process(file,()=>result.content);await wizard.recordTaskMutation(result.edit,wizard.getContextForPath(file.path),Date.now());plugin.oath.changed(result.edit);return result.edit});
 const pages=()=>[...contents].map(([path,text])=>{const tasks=[],lines=text.split(/\r?\n/);lines.forEach((line,i)=>{const details=domain.taskLineDetails(line);if(!details||/^\s/.test(line))return;const snapshot=planning.readTaskSnapshot(text,{path,line:i,text:details.text});const children=snapshot.steps.map(step=>({...step,path,task:true,parent:i,children:[]}));tasks.push({...snapshot,text:details.text,children},...children)});return{file:{path,tasks}}});
 const container=document.getElementById("fixture"),cleanup=new Component();
 const dv={container,pages:()=>({array:()=>{reads++;return pages()}})};
 note(project.root+"/Analyze initial results.md","Notes on measurements");
 plugin.planning=new (load("services/project-planning").ProjectPlanningService)(plugin);
 project.path=project.root+"/Thesis.md";note(project.path,"Project dashboard");
 const firstTask=plugin.taskData.readWorkspace(dv,project)[0];
 const phase=await plugin.planning.savePhase("p1",{name:"Research",start:today,end:shift(30)},[{task:firstTask,included:true}]);
 await plugin.planning.savePhase("p1",{name:"Prototype",start:shift(15),end:shift(90)});
 const milestone=await plugin.planning.saveMilestone("p1",{name:"Internal demo",date:shift(21),achieved:false});
 const finderService = new (load("services/context-search").ContextSearchService)(plugin);
 plugin.workspaceModes={openProjectNote:async(path)=>{plugin.opened=path;return true},openProjectFull:async()=>true};
 let component,controller,root,grid,toolbar,finder;
 const mount=owner=>{component?.unload();container.empty();component=new Component();
 root=container.createDiv({cls:"project-dashboard hub-button-scope",attr:{"data-hub-context-id":owner.projectId}});
 const cover=root.createDiv({cls:"project-cover"});cover.createEl("img",{cls:"project-cover-image",attr:{src:"../../../../../Assets/ResourceCards/study.jpg",alt:""}});
 const header=root.createDiv({cls:"project-header"}),title=header.createDiv();title.createEl("h1",{cls:"project-title",text:owner.name});title.createDiv({cls:"project-category",text:owner===resource?"Concepts and material from established knowledge":"Research, writing and finalizing my master’s thesis."});
 header.createDiv({cls:"project-date",text:new Date().toLocaleDateString("en-US",{weekday:"long",day:"numeric",month:"long",year:"numeric"})});
 toolbar=root.createDiv({cls:"project-shortcuts"});grid=root.createDiv({cls:"project-main-grid"});
 const left=grid.createDiv({cls:"project-left-column"}),filesPanel=left.createDiv({cls:"project-folder-stack"});
 const right=grid.createDiv({cls:"project-right-column"});
 right.createDiv({cls:"project-panel project-tasks",text:"Tasks"});right.createDiv({cls:"project-panel project-progress",text:"Progress / History"});
 const folderStates={};
 for(const item of objects.values())if(item.children)item.children=[...objects.values()].filter(child=>child.path.slice(0,child.path.lastIndexOf("/"))===item.path);
 const explorer=load("ui/workspace-explorer").mountWorkspaceExplorer({parent:filesPanel,workspacePath:owner.root,dashboardPath:owner.path,
  descriptors:()=>[{path:owner.root,title:"Meta",isRoot:true}],getByPath:path=>objects.get(path),states:()=>folderStates,persist:()=>{},
  setIcon:obsidian.setIcon,openFile:()=>{},createItem:()=>{},contextMenu:()=>{}});
 component.register(()=>explorer.destroy());
 finder=load("ui/context-search").mountContextSearch({service:finderService,component,dv,root,toolbar,scope:owner});
 controller=mountTaskWorkspace({plugin,component,dv,root,toolbar,filesGrid:grid,filesPanel,roadmapParent:left,workspace:owner,onFiles:()=>filesVisits++,openSource:path=>{plugin.opened=path}});
 finderService.registerWorkspace(component,root,owner,()=>controller.showFiles(),(kind,id)=>controller.focusPlanning(kind,id));
 workspace.activeLeaf={view:{containerEl:root,file:objects.get(owner.root+"/Tasks.md")}};
 return controller};
 const click=label=>{const el=[...root.querySelectorAll("button")].find(button=>button.textContent===label&&!button.closest("[hidden]"));assert(el,"Button "+label);el.click();return el};
 const select=(label,value)=>{
  if(label==="Roadmap range"){root.querySelector('button[aria-label="Roadmap range"]').click();const title={all:"Entire project",3:"3 months",6:"6 months",12:"1 year"}[value];[...document.querySelectorAll(".hub-fixture-menu button")].find(button=>button.textContent===title).click();return;}
  const el=root.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event("change",{bubbles:true}));
 };
 const type=async text=>{finder.input.focus();finder.input.value=text;finder.input.dispatchEvent(new Event("input"));await new Promise(resolve=>setTimeout(resolve,130));await settle()};
 const rect=selector=>root.querySelector(selector).getBoundingClientRect();
 const checkGap=surface=>assert(Math.abs(surface.getBoundingClientRect().top-toolbar.getBoundingClientRect().bottom-12)<.1,"Shared panel gutter below search");
 const checkWork=()=>{
  const modes=root.querySelector(".hub-task-primary-modes"),border=parseFloat(getComputedStyle(modes).borderRightWidth);
  assert(Math.abs(modes.getBoundingClientRect().right-border-rect(".hub-explorer-details").left)<.1,"Mode separator aligns with Files divider");
  assert(Math.abs(rect(".hub-workspace-explorer").bottom-rect(".project-right-column").bottom)<.1,"Files bottom aligns with complete sidebar");
  assert(Math.abs(rect(".hub-explorer-footer").bottom-rect(".hub-workspace-explorer").bottom+1)<.1,"New folder stays at panel bottom");
  assert(getComputedStyle(root.querySelector(".hub-explorer-tree")).overflowY==="auto","Files retain internal scrolling");
  checkGap(grid);
 };
 mount(project);await settle();assert(!grid.hidden&&!controller.active(),"Project starts in existing Files");
 checkWork();
 assert([...toolbar.querySelectorAll("button")].map(x=>x.textContent).join("|")==="Work|Schedule|Roadmap","Exactly three Project modes");
 assert(!toolbar.querySelector("button svg"),"Mode buttons have no icons");
 const widths=[...toolbar.querySelectorAll("button")].map(x=>x.getBoundingClientRect().width);
 assert(Math.max(...widths)-Math.min(...widths)<1,"Mode buttons have equal widths");
 const barHeight=toolbar.getBoundingClientRect().height;
 await type("Analyze initial results");
 assert(!grid.hidden,"Typing does not mutate Files mode");
 const headings=[...root.querySelectorAll(".hub-context-result-heading")].map(x=>x.textContent);
 assert(headings.includes("Files")&&headings.includes("Tasks"),"Similar file/task results clearly grouped");
 finder.input.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true}));
 assert(finder.input.getAttribute("aria-activedescendant"),"Keyboard result selection");
 finder.input.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));await settle();
 assert(plugin.opened===project.root+"/Analyze initial results.md","File result opens canonical Note source");
 assert(root.querySelector(".hub-context-results").hidden,"Result navigation closes dropdown");
 click("Roadmap");await settle();
 assert(grid.hidden&&!controller.active()&&root.querySelector(".hub-roadmap-panel"),"Roadmap removes Work and its sidebar from layout");
 assert(Math.abs(rect(".hub-roadmap-panel").width-toolbar.getBoundingClientRect().width)<.1,"Roadmap spans full Project width");
 checkGap(root.querySelector(".hub-roadmap-host"));
 assert(root.querySelector(".hub-work-files").hidden&&!root.querySelector(".hub-task-timeline"),"Phases replace task Gantt");
 assert(root.querySelectorAll(".hub-roadmap-phase-bar").length===2&&root.querySelectorAll(".hub-roadmap-milestone").length===1,"Independent phase/milestone models");
 assert(root.querySelector(".hub-roadmap-today"),"Real-date Today guide");
 const roadmapRange=load("domain/project-planning").roadmapViewport(plugin.planning.read("p1"),controller.state);
 const initialMarker=root.querySelector(".hub-roadmap-milestone");
 const initialGlyph=root.querySelector(".hub-roadmap-diamond polygon"),initialSvg=initialGlyph.ownerSVGElement;
 assert(Math.abs(initialGlyph.points.getItem(0).x/initialSvg.viewBox.baseVal.width*100-roadmapRange.position(milestone.date))<.0001,"Milestone sits at its actual calendar-day position");
 const secondMilestone=await plugin.planning.saveMilestone("p1",{name:"Another event on a crowded date",date:shift(22),achieved:false});await settle();
 const markers=[...root.querySelectorAll(".hub-roadmap-diamond")];
 assert(Math.abs(markers[0].getBoundingClientRect().top-markers[1].getBoundingClientRect().top)<.1,"Crowded diamonds share a baseline");
 const captions=[...root.querySelectorAll(".hub-roadmap-milestone-caption")].map(e=>e.getBoundingClientRect());
 assert(captions[0].right<=captions[1].left||captions[0].bottom<=captions[1].top,"Crowded milestone labels wrap in distinct lanes without overlap");
 const phaseBar=root.querySelector(".hub-roadmap-phase-bar");
 assert(parseFloat(phaseBar.style.width)>0&&parseFloat(phaseBar.style.width)<100,"Phase duration derived from dates");
 select("Roadmap range","12");assert(root.querySelectorAll(".hub-roadmap-month").length===12,"Year scale");select("Roadmap range","3");assert(root.querySelectorAll(".hub-roadmap-month").length===3,"Three-month scale");select("Roadmap range","6");
 const timelineBefore=root.querySelector(".hub-roadmap-timeline");
 await type("Research");assert(root.querySelector(".hub-roadmap-timeline")===timelineBefore,"Finder does not filter Roadmap");
 assert(root.querySelector(".hub-context-result-group[aria-labelledby$=phases]"),"Search groups phases");
 root.querySelector(".hub-context-result-group[aria-labelledby$=phases] .hub-context-result").click();await settle();
 assert(document.activeElement.dataset.planningId===phase.id,"Phase search focuses actual roadmap object");
 const dateBefore=plugin.planning.read("p1").phases[0].start;
 const phaseHandle=root.querySelector('button[aria-label="Reorder phase Research"]');
 for(const key of [" ","ArrowDown"," "])phaseHandle.dispatchEvent(new KeyboardEvent("keydown",{key,bubbles:true,cancelable:true}));await settle();
 assert(plugin.planning.read("p1").phases[1].id===phase.id&&plugin.planning.read("p1").phases[1].start===dateBefore,"Manual order keeps dates");
 click("Phase");await settle();let phaseModal=lastModal;
 phaseModal.contentEl.querySelector('input[aria-label="Title"]').value="Testing";
 phaseModal.contentEl.querySelector('button[type="submit"]').click();await settle();
 assert(plugin.planning.read("p1").phases.length===3,"Phase modal creation persists");
 click("Testing");await settle();phaseModal=lastModal;
 assert(phaseModal.contentEl.textContent.includes("No associated tasks"),"Phase details derive associations");
 [...phaseModal.contentEl.querySelectorAll("button")].find(b=>b.textContent==="Add tasks").click();await settle();
 lastModal.contentEl.querySelector("button").click();await settle();
 phaseModal.contentEl.querySelector('button[type="submit"]').click();await settle();
 assert(plugin.planning.tasks(dv,"p1").some(t=>t.phaseId===plugin.planning.read("p1").phases[2].id),"Phase picker writes canonical membership");
 root.querySelector(".hub-roadmap-milestone").click();await settle();
 lastModal.contentEl.querySelector('input[type="checkbox"]').click();lastModal.contentEl.querySelector('button[type="submit"]').click();await settle();
 assert(root.querySelector(".hub-roadmap-milestone.is-achieved"),"Achieved milestone stays visible");
 assert(history.length===0&&oathChanges===0,"Planning edits do not produce completion events");
 click("Schedule");await settle();
 assert(grid.hidden&&Math.abs(rect(".hub-task-workspace").width-toolbar.getBoundingClientRect().width)<.1,"Schedule remains full width without sidebar");
 checkGap(root.querySelector(".hub-task-workspace"));
 assert(controller.state.scheduleView==="upcoming"&&root.querySelectorAll(".hub-task-column").length===5,"Overview is Schedule default");
 assert(root.querySelectorAll(".hub-full-add-task").length===1&&!root.querySelector(".hub-task-column-add"),"Single Add task in shared toolbar");
 assert(!root.querySelector('select[aria-label="Location"]')&&!root.querySelector(".hub-task-planning-controls"),"No standalone locations row");
 assert(root.querySelector(".hub-task-phase"),"Overview shows neutral phase chip");
 assert(root.textContent.includes("Solve problem set 4"),"Schedule includes canonical linked Resource tasks");
 if(new URLSearchParams(location.search).has('focus-test')){
  const key=value=>new Promise(resolve=>{window.hubTestKeyDone=resolve;window.hubTestKeyRequest=value});
  const pointer=async element=>{element.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const box=element.getBoundingClientRect();await new Promise(resolve=>{window.hubTestPointerDone=resolve;window.hubTestPointerRequest={x:box.left+box.width/2,y:box.top+box.height/2}})};
  async function activate(id,input){
   const before=root.querySelector('[data-schedule-control="'+id+'"]');assert(before,'Schedule control '+id);
   if(input==='keyboard'){await key('Tab');before.focus();assert(before.matches(':focus-visible'),'Schedule keyboard focus');await key(id==='next'?' ':'Enter')}else await pointer(before);
   await settle();const after=root.querySelector('[data-schedule-control="'+id+'"]');assert(after&&!before.isConnected,'Toolbar rebuilt before restoration');
   assert(input==='keyboard'?document.activeElement===after:document.activeElement!==after,'Schedule '+id+' '+input+' focus intent');
   if(input==='keyboard')assert(after.matches(':focus-visible')&&!after.disabled&&after.getClientRects().length,'Visible enabled keyboard destination');
  }
  for(const input of ['keyboard','pointer'])for(const view of ['week','month','upcoming']){
   await activate('view-'+view,input);assert(controller.state.scheduleView===view,'View semantics preserved');
   const first=root.querySelector('[data-schedule-control="'+(view==='upcoming'?'view-upcoming':'previous')+'"]');first.focus();await key('Tab');assert(document.activeElement.dataset.scheduleControl===(view==='upcoming'?'view-week':'next'),'Schedule Tab order');
   if(view!=='upcoming'){
    const anchor=new Date(controller.state.anchor);await activate('previous',input);assert(view==='week'?Math.round((anchor-controller.state.anchor)/86400000)===7:controller.state.anchor.getMonth()===(anchor.getMonth()+11)%12,'Previous date semantics');
    await activate('next',input);assert(controller.state.anchor.getFullYear()===anchor.getFullYear()&&controller.state.anchor.getMonth()===anchor.getMonth(),'Next date semantics');
    await activate('today',input);const today=new Date();assert(controller.state.anchor.toDateString()===today.toDateString(),'Today semantics');
   }
  }
  const begin=scheduleUi.beginRender;
  for(const input of ['keyboard','pointer']){
   let deferred;scheduleUi.beginRender=render=>{deferred=render;return false};
   const old=root.querySelector('[data-schedule-control=view-week]');await key('Tab');old.focus();
   if(input==='keyboard')await key('Enter');else await pointer(old);
   assert(old.isConnected&&deferred,'Shared renderer deferred toolbar replacement');scheduleUi.beginRender=begin;deferred();
   const replacement=root.querySelector('[data-schedule-control=view-week]');assert(input==='keyboard'?document.activeElement===replacement:document.activeElement!==replacement,'Deferred '+input+' navigation intent preserved');
  }
  let deferred;scheduleUi.beginRender=render=>{deferred=render;return false};const old=root.querySelector('[data-schedule-control=view-month]');await key('Tab');old.focus();await key('Enter');
  const surviving=root.querySelector('[data-workspace-mode=schedule]');surviving.focus();scheduleUi.beginRender=begin;deferred();assert(document.activeElement===surviving,'Deferred navigation does not steal focus after user moves away');
  const schedule=root.querySelector('[data-workspace-mode=schedule]');schedule.focus();await key('ArrowLeft');assert(controller.state.mode==='work'&&document.activeElement.dataset.workspaceMode==='work','Existing workspace keyboard mode navigation');await key('ArrowRight');assert(controller.state.mode==='schedule'&&document.activeElement.dataset.workspaceMode==='schedule','Schedule mode shortcut preserved');
  component.unload();document.getElementById('result').textContent='PASS: actual mounted Schedule; Overview/Week/Month and previous/next/Today rebuilds with Enter/Space and real pointer input; keyboard focus restoration, Tab traversal, unchanged dates, deferred render intent/cancellation and workspace arrow navigation.';return;
 }
 const scheduleHeight=root.querySelector(".hub-schedule-toolbar").getBoundingClientRect().height;
 assert(toolbar.getBoundingClientRect().height===barHeight,"Context bar stable across modes");
 click("Week");assert(root.querySelectorAll(".hub-task-calendar-day").length===7,"Week calendar supported");
 assert(root.querySelector(".hub-schedule-toolbar").getBoundingClientRect().height===scheduleHeight,"Schedule toolbar keeps height");
 click("Work");click("Schedule");assert(controller.state.scheduleView==="week","Schedule preserves warm selection");click("Month");
 const dayButton=root.querySelector(".hub-task-calendar-day .hub-task-icon-button");dayButton.click();await settle();
 let form=lastModal.contentEl;form.querySelector('[aria-label="Due date"]').click();const prefilledPicker=window.lastModal,prefilledDate=prefilledPicker.date.value;assert(prefilledDate,"Day creation prefills date");
 assert(prefilledPicker.time.value==="","Prefilled date-only tasks do not gain a midnight time");prefilledPicker.close();
 assert(form.querySelectorAll('.hub-date-time-trigger').length===2&&!form.querySelector('input[type="date"]'),"Task dates use the shared optional-time picker");
 assert(![...form.querySelectorAll("h3")].some(h=>h.textContent==="Dates")&&!form.textContent.includes("Clear time"),"Task dates use explicit labels without redundant heading/actions");
 form.querySelector(".hub-task-title-input").value="Create from Schedule";form.querySelector("button[type=submit]").click();await settle();
 assert(contents.get(project.root+"/Tasks.md").includes("Create from Schedule"),"New task writes canonical Markdown");
 const createdTask=plugin.taskData.readWorkspace(dv,project).find(t=>t.text==="Create from Schedule");
 assert(createdTask.dueDate===prefilledDate&&!createdTask.dueTime,"Standalone creation preserves date-only task semantics");
 root.querySelector(".project-task-text").click();await settle();form=lastModal.contentEl;
 assert(form.querySelector("h2").textContent==="Edit task","Calendar opens shared editor");
 const phaseField=form.querySelector('select[aria-label="Project phase (optional)"]');
 assert(phaseField&&!phaseField.closest("section").hidden&&phaseField.options.length===4,"Project task editor lists local phases plus No phase");phaseField.value=phase.id;
 form.querySelector(".hub-task-title-input").value="Edited in Schedule";form.querySelector("button[type=submit]").click();await settle();
 assert([...contents.values()].some(text=>text.includes("Edited in Schedule")),"Editing preserves canonical task writes");
 assert(plugin.planning.tasks(dv,"p1").find(t=>t.text==="Edited in Schedule").phaseId===phase.id,"Task editor writes the same canonical phase link");
 root.querySelector(".project-task-text").click();await settle();
 const clearModal=lastModal,clearForm=clearModal.contentEl;
 clearForm.querySelector('select[aria-label="Project phase (optional)"]').value="";
 [...clearForm.querySelectorAll("button")].find(b=>b.textContent.startsWith("Choose location")).click();await settle();
 const locationPicker=lastModal;locationPicker.onChooseItem(locationPicker.getItems().find(item=>item.path===project.root+"/Tasks.md"));locationPicker.close();
 assert(clearForm.querySelector('select[aria-label="Project phase (optional)"]').value==="","No phase remains selected after choosing location");
 const phaseHistory=history.length,phaseOath=oathChanges;
 clearForm.querySelector('button[type="submit"]').click();await settle();
 assert(!plugin.planning.tasks(dv,"p1").find(t=>t.text==="Edited in Schedule").phaseId,"Task editor clears membership");
 assert(history.length===phaseHistory&&oathChanges===phaseOath,"Removing phase has no completion/Oath effects");
 const resourceTask=plugin.taskData.readWorkspace(dv,resource)[0];
 load("ui/task-editor").openTaskEditor(plugin.taskEditor,resourceTask);await settle();
 assert(lastModal.contentEl.querySelector('select[aria-label="Project phase (optional)"]').closest("section").hidden,"Resource task editor hides Phase");lastModal.close();
 const before=history.length;root.querySelector(".hub-task-calendar input[type=checkbox]").click();await settle();
 assert(history.length===before+1&&oathChanges>0,"Completion updates Progress history and Oath");
 click("Work");assert(!grid.hidden&&filesVisits>0,"Returning Files restores existing panels");
 click("Roadmap");
 click("Testing");await settle();const deletionModal=lastModal;
 const countBeforeDelete=plugin.planning.tasks(dv,"p1").length;
 deletionModal.contentEl.querySelector(".hub-task-remove").click();deletionModal.contentEl.querySelector(".hub-task-remove").click();await settle();
 assert(!plugin.planning.read("p1").phases.some(p=>p.name==="Testing")&&plugin.planning.tasks(dv,"p1").length===countBeforeDelete,"Phase modal deletion keeps tasks");
 click("Milestone");await settle();lastModal.contentEl.querySelector('input[aria-label="Title"]').value="Release";
 lastModal.contentEl.querySelector('button[type="submit"]').click();await settle();
 const release=plugin.planning.read("p1").milestones.find(m=>m.name==="Release");assert(release,"Milestone modal creation persists");
 root.querySelector('[data-planning-id="'+release.id+'"]').click();await settle();
 lastModal.contentEl.querySelector(".hub-task-remove").click();lastModal.contentEl.querySelector(".hub-task-remove").click();await settle();
 assert(!plugin.planning.read("p1").milestones.some(m=>m.id===release.id),"Milestone modal deletion persists");
 const beforeRail=filesVisits;
 container.classList.add("hub-project-rail");document.body.classList.add("hub-project-note-mode");await settle();
 assert(!controller.active()&&filesVisits>beforeRail,"Note rail refreshes existing Files panel");
 assert(getComputedStyle(toolbar).display==="none"&&getComputedStyle(grid).display==="grid","Note hides context bar and keeps Files");
 container.classList.remove("hub-project-rail");document.body.classList.remove("hub-project-note-mode");await settle();
 assert(!controller.active()&&controller.state.mode==="roadmap"&&grid.hidden,"Return from Note retains full-width Roadmap");
 mount(resource);await settle();
 assert(!toolbar.querySelector("button")&&!root.querySelector(".hub-task-workspace")&&!grid.hidden,"Resource has Files workspace without mode selector");
 assert(finder.input.placeholder==="Search Knowledge\u2026","Resource has contextual placeholder");
 assert(toolbar.getBoundingClientRect().height===barHeight,"Resource/Project shared bar height");
 checkGap(grid);
 assert(root.querySelector(".hub-explorer-heading [data-icon='folder-tree']"),"Resource Files keeps folder-tree heading");
 await type("research questions");assert(root.querySelector(".hub-context-empty"),"Resource finder excludes unrelated Project tasks");
 await type("Solve problem");assert(root.querySelector(".hub-context-result"),"Resource retains structurally owned linked task");
 finder.input.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));assert(root.querySelector(".hub-context-results").hidden,"Escape closes finder");
 for(const width of [1800,1440,1040]) {
  container.style.maxWidth="none";container.style.width=width+"px";mount(project);click("Work");await settle();checkWork();
  container.style.width=(width+80)+"px";await settle();checkWork();
  click("Roadmap");container.style.width=width+"px";await settle();click("Work");await settle();checkWork();
 }
 container.style.maxWidth="100%";
 for(const width of [1040,760,420,300]) {
  container.style.width=width+"px";mount(project);await settle();
  for(const label of ["Work","Roadmap","Schedule"]) { click(label);await settle();assert(label === "Work" ? toolbar.scrollWidth <= toolbar.clientWidth + 1 : root.scrollWidth <= root.clientWidth + 1,"Workspace controls fit at "+width+" "+label); }
  const region=root.querySelector(".hub-context-search").getBoundingClientRect(),bar=toolbar.getBoundingClientRect();
  assert(region.right<=bar.right&&region.width>30,"Search fills available width without overflow at "+width);
 }
 container.style.width="1040px";mount(resource);await settle();
 const home=document.body.createDiv({cls:"home-dashboard hub-button-scope"});home.style.width="1040px";
 const homeBar=home.createDiv();const homeFinder=load("ui/context-search").mountContextSearch({service:finderService,component,dv,root:home,toolbar:homeBar});
 assert(homeFinder.input.placeholder==="Search Itacan\u2026"&&homeBar.getBoundingClientRect().height===barHeight,"Home uses full-width shared row");
 assert(!homeBar.querySelector("button"),"Home search has no workspace modes");
 const homeGrid=home.createDiv({cls:"home-main-grid"});homeGrid.style.height="450px";
 assert(Math.abs(homeGrid.getBoundingClientRect().top-homeBar.getBoundingClientRect().bottom-12)<.1,"Home content uses panel gutter without moving search");
 const homePanel=homeGrid.createDiv({cls:"home-panel"});
 const piercing=homePanel.createDiv({cls:"home-panel-title",text:"Projects"});piercing.style.cssText="position:relative;z-index:10;height:40px";
 piercing.createEl("button",{text:"Active"});
 const floaty=homePanel.createDiv({cls:"home-project-card",text:"Project card"});floaty.style.cssText="position:relative;z-index:20;transform:translateZ(0);height:120px";
 home.scrollIntoView();homeFinder.input.focus();homeFinder.input.value="task";homeFinder.input.dispatchEvent(new Event("input"));await new Promise(r=>setTimeout(r,130));await settle();
 const popup=home.querySelector(".hub-context-results"),bounds=popup.getBoundingClientRect();
 assert(!popup.hidden&&bounds.height>80,"Home results open across panels");
 for(const offset of [20,55,85]) { const hit=document.elementFromPoint(bounds.left+35,bounds.top+offset);assert(popup.contains(hit),"Search covers underlying z-index headings/cards at "+offset); }
 const modal=new Modal(plugin.app);modal.open();await settle();
 assert(modal.containerEl.contains(document.elementFromPoint(bounds.left+35,bounds.top+20)),"Native modal remains above search");modal.close();
 const homePreview=home.cloneNode(true);homePreview.querySelector(".hub-context-results").hidden=true;
 home.remove();
 const bar=document.querySelector(".status-bar"),left=bar.createDiv({cls:"hub-oath-control hub-button-scope"});
 for(const label of ["The Oath","Daily brief","Music","Settings"])left.createEl("button",{cls:"hub-oath-button",text:label});
 bar.createDiv({cls:"status-bar-item",text:"0 backlinks   4 properties"});
 const shortcuts=load("ui/app-shortcuts").mountAppShortcuts(plugin,left);await settle();assert(shortcuts&&!bar.querySelector(".hub-shell-shortcut"),"Resource with no shortcuts has no placeholder");
 mount(project);workspace.emit("active-leaf-change");await settle();assert(bar.querySelectorAll(".hub-shell-shortcut").length===2,"Configured project shortcuts in bottom shell");bar.querySelector(".hub-shell-shortcut").click();await settle();assert(plugin.lastShortcut==="overleaf","Shortcut preserves launcher");
 const group=bar.querySelector(".hub-shell-shortcuts").getBoundingClientRect(),leftRect=left.getBoundingClientRect();assert(group.left>=leftRect.right,"Centered shortcuts do not overlap global controls");
 assert(notices.length===0,"No runtime notices: "+notices.join(";"));
 mount({...project,projectId:"empty"});click("Roadmap");await settle();
 assert(grid.hidden&&root.querySelector(".hub-task-view-empty")&&Math.abs(rect(".hub-roadmap-panel").width-toolbar.getBoundingClientRect().width)<.1,"Empty Roadmap also uses full width without sidebar");
 mount(project);
 click("Roadmap");
 window.layoutPreview=async view=>{
  container.style.width="1400px";
  mount(view==="Resource"?resource:view==="Empty Roadmap"?{...project,projectId:"empty"}:project);
  if(view==="Home"){container.replaceChildren(homePreview);homePreview.style.width="100%";window.scrollTo(0,0);await settle();return;}
  if(view.includes("Roadmap"))click("Roadmap");
  else if(["Overview","Month","Week"].includes(view)){click("Schedule");click(view);}
  else if(view==="Work")click("Work");
  await settle();root.querySelector(".project-cover").style.display="none";window.scrollTo(0,0);await settle();
 };
 if(window.hubTestFullView) await window.hubTestFullView({mount,click,plugin,load,project,resource,dv,container,settle,assert,objects,contents,
  get root(){return root},get component(){return component},get controller(){return controller}});
 if(window.hubTestProjectPolish) await window.hubTestProjectPolish({mount,click,plugin,load,project,resource,dv,container,settle,assert,
  get root(){return root},get component(){return component},get controller(){return controller}});
 if(window.hubTestRoadmapAnchors) await window.hubTestRoadmapAnchors({mount,click,plugin,load,project,resource,dv,container,settle,assert,
  get root(){return root},get component(){return component},get controller(){return controller}});
 if(window.hubTestRoadmap) await window.hubTestRoadmap({mount,click,plugin,load,project,resource,dv,container,settle,assert,
  get root(){return root},get component(){return component},get controller(){return controller}});
 if(window.hubTestWorkspaceControls) await window.hubTestWorkspaceControls({mount,click,plugin,load,project,resource,container,settle,assert,
  get root(){return root},get component(){return component}});
 shortcuts.destroy();cleanup.unload();plugin.taskData.destroy();
 document.getElementById("result").textContent=(window.hubTestRoadmapAnchors ? "PASS: shared SVG vertices, literal path origins, projected screen tip/card joins, transforms/CSS zoom, all ranges, pan/Today, scroll/resize/reflow, edge clusters and milestone mutations. " : "") + (window.hubTestProjectPolish ? "PASS: shared Roadmap/Schedule titles, centered axis-corner navigation, title-only two-line equal-height annotations, native hover metadata and keyboard date tooltips; transparent cards and exact-tip leaders, all ranges, edge collisions and Work header baselines at 900/1040/1440px. " : "") + (window.hubTestRoadmap ? "PASS: Roadmap extent/zoom/pan/Today, Presets pointer and keyboard phase ordering, caption collision lanes, colors, warm state and unchanged Full-view geometry. " : "") + (window.hubTestWorkspaceControls ? "PASS: equal primary/secondary controls, compact planning navigation/actions, Project/Tasks shared plus and unchanged Add workflows. " : "") + (window.hubTestFullView ? "PASS: Home-aligned Full-view boundaries, local search/button focus, sparse/overflowing Work and all Resources, Overview/Month/Week, empty/overflowing Roadmap, resizing, short windows and Note isolation. " : "") + "PASS: shared 12px search gutters; Files/mode-divider and bottom alignment at 1040/1440/1800px plus resizing; full-width empty/populated Roadmap and Schedule; Home overlay/modal hit testing; phases/milestones CRUD and search focus; Schedule creation/edit/completion; linked tasks; Oath/Progress integration; warm Note mode; shortcuts and overflow at 1040/760/420/300px.";
}catch(error){document.getElementById("result").textContent="FAIL: "+error.stack}};
