"use strict";
HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);e.className=o.cls||"";if(o.text!=null)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);if(o.type)e.type=o.type;this.append(e);return e};
HTMLElement.prototype.createDiv=function(o){return this.createEl("div",o)};
HTMLElement.prototype.createSpan=function(o){return this.createEl("span",o)};
HTMLElement.prototype.empty=function(){this.replaceChildren()};
class Component{constructor(){this.children=new Set();this.cleanup=[]}register(fn){this.cleanup.push(fn)}registerEvent(ref){this.register(()=>ref.emitter.offref(ref))}addChild(child){this.children.add(child)}removeChild(child){child.unload();this.children.delete(child)}unload(){this.cleanup.splice(0).forEach(fn=>fn());this.children.forEach(c=>c.unload());this.children.clear()}}
class Emitter{constructor(){this.events=new Map()}on(name,fn){const ref={emitter:this,name,fn};if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(ref);return ref}offref(ref){this.events.get(ref.name)?.delete(ref)}emit(name,...args){for(const ref of this.events.get(name)||[])ref.fn(...args)}}
class Modal{constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:"modal-container"});this.modalEl=this.containerEl.createDiv({cls:"modal"});this.modalEl.createEl("button",{text:"×",cls:"modal-close-button"}).onclick=()=>this.close();this.contentEl=this.modalEl.createDiv();this.escape=e=>{if(e.key==="Escape")this.close()};document.addEventListener("keydown",this.escape)}open(){window.lastModal=this;this.onOpen?.()}close(){this.onClose?.();this.containerEl.remove();document.removeEventListener("keydown",this.escape)}}
class FuzzySuggestModal extends Modal{onOpen(){for(const item of this.getItems())this.contentEl.createEl("button",{text:this.getItemText(item)}).onclick=()=>{this.onChooseItem(item);this.close()}}}
class Menu{addItem(fn){const item={setTitle(){return this},setIcon(){return this},setWarning(){return this},onClick(){return this}};fn(item)}showAtMouseEvent(){}}
const notices=[],assert=(condition,message)=>{if(!condition)throw Error(message)};
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))};
const icons={folder:"M3 7h6l2-3h9v16H3z","list-todo":"M9 6h11M9 12h11M9 18h11M3 6h2M3 12h2M3 18h2",search:"M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",plus:"M12 5v14M5 12h14","chevron-right":"m9 5 7 7-7 7","chevron-left":"m15 5-7 7 7 7","chevron-down":"m5 9 7 7 7-7",x:"m5 5 14 14M5 19 19 5"};
const obsidian={Component,Modal,FuzzySuggestModal,Menu,Notice:class{constructor(text){notices.push(text)}},setIcon(el,name){el.replaceChildren();el.dataset.icon=name;const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");for(const[k,v]of Object.entries({viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round","stroke-linejoin":"round"}))svg.setAttribute(k,v);const p=document.createElementNS(svg.namespaceURI,"path");p.setAttribute("d",icons[name]||icons.folder);svg.append(p);el.append(svg)},MarkdownRenderer:{render:async(app,text,el)=>el.createEl("p",{text})}};
window.onerror=(message,source,line,col,error)=>document.getElementById("result").textContent="FAIL: "+(error?.stack||message);
window.onload=async()=>{try{
 const names=["config","domain/tasks","domain/dates","domain/task-planning","domain/task-views","domain/task-progress","domain/oath","domain/oath-workspace",
 "services/task-writes","services/task-locations","services/task-data","services/task-editor","ui/markdown","ui/completion-audio","ui/task-steps","ui/oath-tasks","ui/tasks","ui/task-editor","ui/task-view-primitives","ui/task-view-upcoming","ui/task-view-table","ui/task-view-location","ui/task-view-calendar","ui/task-view-timeline","ui/task-workspace","ui/app-shortcuts"];
 const sources=Object.fromEntries(await Promise.all(names.map(async name=>[name,await(await fetch("../"+name+".js")).text()]))),cache={};
 const load=name=>{if(name==="obsidian")return obsidian;if(name==="crypto")return{randomUUID:()=>crypto.randomUUID()};if(cache[name])return cache[name].exports;const module=cache[name]={exports:{}};if(!sources[name])throw Error("Missing module "+name);new Function("module","require","process",sources[name])(module,request=>{if(["obsidian","crypto"].includes(request))return load(request);const parts=(name.slice(0,name.lastIndexOf("/"))+"/"+request).split("/"),out=[];for(const part of parts){if(part==="..")out.pop();else if(part!==".")out.push(part)}return load(out.join("/"))},{env:{}});return module.exports};
 const domain=load("domain/tasks"),planning=load("domain/task-planning"),dates=load("domain/dates"),progress=load("domain/task-progress");
 const {HubTaskDataService}=load("services/task-data"),{HubTaskEditor}=load("services/task-editor"),{mountTaskWorkspace}=load("ui/task-workspace");
 const project={root:"Projects/Thesis",projectId:"p1",name:"Master’s thesis",contextKind:"project",status:"active",categoryId:"research"};
 const resource={root:"Resources/Knowledge",projectId:"resource:study",name:"Knowledge",contextKind:"resource"};
 const shelved={...project,root:"Projects/Old",projectId:"p2",name:"Old project",status:"shelved"};
 const vault=new Emitter(),metadataCache=new Emitter(),workspace=new Emitter(),objects=new Map(),contents=new Map();
 const folder=path=>objects.set(path,{path,children:[]});
 const note=(path,text)=>{const file={path,extension:"md",parent:objects.get(path.slice(0,path.lastIndexOf("/")))};objects.set(path,file);contents.set(path,text);return file};
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
 read:async file=>contents.get(file.path),create:async(path,text)=>{const file=note(path,text);queueMicrotask(()=>metadataCache.emit("dataview:metadata-change","update",file));return file},
 process:async(file,transform)=>{contents.set(file.path,transform(contents.get(file.path)));queueMicrotask(()=>metadataCache.emit("dataview:metadata-change","update",file))},getResourcePath:()=>""});
 workspace.getActiveFile=()=>objects.get(project.root+"/Tasks.md");workspace.openLinkText=()=>{};
 const plugin={app:{vault,metadataCache,workspace},projectWizard:wizard,dataStore:{save:async()=>{}},
 enqueueTaskMutation:fn=>{const result=(plugin.queue??Promise.resolve()).then(fn);plugin.queue=result.catch(()=>{});return result},
 markProjectChangedByPath(){},notifyCompletedTasksChanged(){},oath:{changed(){oathChanges++}},
 registerEvent:ref=>cleanup.registerEvent(ref),registerDomEvent:(el,event,fn)=>{el.addEventListener(event,fn);cleanup.register(()=>el.removeEventListener(event,fn))},openAppShortcut:async id=>{plugin.lastShortcut=id}};
 wizard.recordTaskMutation=async(edit,owner,time)=>{const result=progress.taskProgressMutation(checks,history,edit,owner,time,()=>crypto.randomUUID());checks=result.checks;history=result.history;return result.changed};
 plugin.taskEditor=new HubTaskEditor(plugin);plugin.taskData=new HubTaskDataService(plugin.app,{metadata:id=>plugin.taskEditor.metadata(id)});
 plugin.mutateTask=request=>plugin.enqueueTaskMutation(async()=>{const file=objects.get(request.path);const content=contents.get(file.path);
 const result=request.operation==="step"?planning.toggleTaskStep(content,request):domain.editTaskContent(content,request,line=>line.replace(/\[([ xX])\]/,(_,marker)=>marker===" "?"[x]":"[ ]"));
 await vault.process(file,()=>result.content);await wizard.recordTaskMutation(result.edit,wizard.getContextForPath(file.path),Date.now());plugin.oath.changed(result.edit);return result.edit});
 const pages=()=>[...contents].map(([path,text])=>{const tasks=[],lines=text.split(/\r?\n/);lines.forEach((line,i)=>{const details=domain.taskLineDetails(line);if(!details||/^\s/.test(line))return;const snapshot=planning.readTaskSnapshot(text,{path,line:i,text:details.text});const children=snapshot.steps.map(step=>({...step,path,task:true,parent:i,children:[]}));tasks.push({...snapshot,text:details.text,children},...children)});return{file:{path,tasks}}});
 const container=document.getElementById("fixture"),cleanup=new Component();
 const dv={container,pages:()=>({array:()=>{reads++;return pages()}})};
 let component,controller,root,grid,toolbar;
 const mount=owner=>{component?.unload();container.empty();component=new Component();
 root=container.createDiv({cls:"project-dashboard hub-button-scope",attr:{"data-hub-context-id":owner.projectId}});
 const cover=root.createDiv({cls:"project-cover"});cover.createEl("img",{cls:"project-cover-image",attr:{src:"../../../../../Assets/ResourceCards/study.jpg",alt:""}});
 const header=root.createDiv({cls:"project-header"}),title=header.createDiv();title.createEl("h1",{cls:"project-title",text:owner.name});title.createDiv({cls:"project-category",text:owner===resource?"Concepts and material from established knowledge":"Research, writing and finalizing my master’s thesis."});
 header.createDiv({cls:"project-date",text:new Date().toLocaleDateString("en-US",{weekday:"long",day:"numeric",month:"long",year:"numeric"})});
 toolbar=root.createDiv({cls:"project-shortcuts"});grid=root.createDiv({cls:"project-main-grid"});
 grid.createDiv({cls:"project-left-column project-panel",text:"Existing Files workspace"});grid.createDiv({cls:"project-right-column project-panel",text:"Tasks · Progress · History"});
 controller=mountTaskWorkspace({plugin,component,dv,root,toolbar,filesGrid:grid,workspace:owner,onFiles:()=>filesVisits++,openSource:path=>{plugin.opened=path}});
 workspace.activeLeaf={view:{containerEl:root,file:objects.get(owner.root+"/Tasks.md")}};
 return controller};
 const click=label=>{const el=[...root.querySelectorAll("button")].find(button=>button.textContent===label&&!button.closest("[hidden]"));assert(el,"Button "+label);el.click();return el};
 const tab=view=>{const el=root.querySelector('[data-task-view="'+view+'"]');assert(el,"Tab "+view);el.click()};
 const select=(label,value)=>{const el=root.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event("change",{bubbles:true}))};
 const titles=()=>[...root.querySelectorAll(".hub-full-task-title,.project-task-text")].map(el=>el.textContent);
 mount(project);assert(!grid.hidden&&!controller.active(),"Project starts in existing Files");click("Tasks");await settle();
 assert(grid.hidden&&controller.state.view==="upcoming","Project defaults to Upcoming with sidebar hidden");
 assert([...root.querySelectorAll("[role=tab]")].map(x=>x.textContent).join("|")==="Upcoming|Calendar|Timeline|All tasks","Project tabs exact");
 assert([...root.querySelectorAll(".hub-task-column h3")].map(x=>x.textContent).join("|")==="Past due|Today|Tomorrow|Later|Unscheduled","Five buckets exact");
 assert(root.textContent.includes("Solve problem set 4"),"Project includes canonical Resource association");
 const readCount=reads;const search=root.querySelector("input[type=search]");search.value="research questions";search.dispatchEvent(new Event("input"));assert(titles().length===1,"Search scopes board");search.value="";search.dispatchEvent(new Event("input"));assert(reads===readCount,"Search does not reparse tasks");
 select("Location",project.root+"/Tasks.md");assert(!root.textContent.includes("Solve problem set"),"Location scopes linked board");select("Location","");
 root.querySelector(".hub-full-card-context .hub-full-location").click();assert(plugin.opened,"Source breadcrumb opens location");
 root.querySelector(".is-today .hub-task-column-add").click();await settle();
 let form=lastModal.contentEl;assert(lastModal.contentEl.querySelectorAll("input[type=date]")[1].value===today,"Today creation prefills existing due metadata");
 form.querySelector(".hub-task-title-input").value="Create from Today";form.querySelector("button[type=submit]").click();await settle();
 assert(contents.get(project.root+"/Tasks.md").includes("Create from Today"),"New task is Markdown in current workspace");
 assert(plugin.taskData.readWorkspace(dv,project,[resource]).find(t=>t.text==="Create from Today").dueDate===today,"Creator persists contextual metadata");
 tab("calendar");await settle();assert(root.querySelectorAll(".hub-task-weekday").length===7,"Month calendar renders weekdays");
 click("Week");assert(root.querySelectorAll(".hub-task-calendar-day").length===7,"Week calendar supported");click("Month");
 const dayButton=root.querySelector(".hub-task-calendar-day .hub-task-icon-button");dayButton.click();await settle();assert(lastModal.contentEl.querySelectorAll("input[type=date]")[1].value,"Day creation prefills date");lastModal.close();
 root.querySelector(".project-task-text").click();await settle();assert(lastModal.contentEl.querySelector("h2").textContent==="Edit task","Calendar opens shared editor");lastModal.close();
 tab("timeline");await settle();assert(root.querySelector(".is-start")&&root.querySelector(".is-due")&&root.querySelector(".is-range"),"Timeline honors start-only, due-only, range");
 assert(root.querySelector(".hub-task-timeline-today"),"Timeline has current-date line");assert(root.textContent.includes("undated"),"No position fabricated for undated tasks");
 tab("all");await settle();assert(![...root.querySelectorAll("th")].some(th=>th.textContent==="Project"),"Project table omits Project");
 select("Status","all");assert(titles().includes("Completed task"),"All status reveals completed tasks");
 select("Status","open");select("Necessity","must");assert(root.querySelectorAll("tbody tr").length>=2,"Necessity filters");select("Necessity","");
 const sort=[...root.querySelectorAll(".hub-task-sort")].find(el=>el.textContent.startsWith("Task"));sort.click();assert(root.querySelector('[aria-sort="ascending"]'),"Table sortable");
 const before=history.length;let check=root.querySelector("tbody input[type=checkbox]");check.click();await settle();assert(history.length===before+1,"Check records canonical completion");
 select("Status","completed");check=root.querySelector("tbody input[type=checkbox]");assert(check,"Completed task available to uncheck");check.click();await settle();assert(history.length===before,"Uncheck removes completion");
 select("Status","open");
 const firstTitle=root.querySelector(".hub-full-task-title");firstTitle.click();await settle();form=lastModal.contentEl;form.querySelector(".hub-task-title-input").value="Edited in full view";form.querySelector("button[type=submit]").click();await settle();
 assert([...contents.values()].some(text=>text.includes("Edited in full view")),"Edit writes canonical task text");
 assert(oathChanges>0,"Mutations notify existing Oath integration");
 click("Files");assert(!grid.hidden&&filesVisits===1,"Project returns to unchanged Files");click("Tasks");assert(controller.state.view==="all","Task subview stays warm");
 const beforeRail=filesVisits;
 container.classList.add("hub-project-rail");document.body.classList.add("hub-project-note-mode");await settle();
 assert(!controller.active()&&filesVisits>beforeRail,"Entering note rail refreshes the existing Files task panel");
 assert(getComputedStyle(root.querySelector(".hub-task-workspace")).display==="none"&&getComputedStyle(grid).display==="grid","Rail keeps Files visible and hides full Tasks");
 container.classList.remove("hub-project-rail");document.body.classList.remove("hub-project-note-mode");await settle();
 assert(controller.active()&&controller.state.view==="all","Returning from note rail preserves full Tasks state");
 mount(resource);click("Tasks");await settle();assert(controller.state.view==="location","Resource defaults By location");
 assert([...root.querySelectorAll("[role=tab]")].map(x=>x.textContent).join("|")==="By location|Upcoming|All tasks","Resource tabs exact regardless dates");
 assert(!root.querySelector('[data-task-view="calendar"],[data-task-view="timeline"]'),"No Resource Calendar/Timeline");
 assert(root.textContent.includes("Mathematics")&&root.textContent.includes("Physics")&&!root.textContent.includes("System"),"Real hierarchy without system locations");
 const heading=[...root.querySelectorAll(".hub-task-location-heading")].find(el=>el.textContent.startsWith("Mathematics"));heading.click();assert([...root.querySelectorAll(".hub-task-location-heading")].find(el=>el.textContent.startsWith("Mathematics")).getAttribute("aria-expanded")==="false","Hierarchy can collapse");
 tab("upcoming");await settle();assert(root.querySelector(".hub-task-project-link"),"Linked project shown on Resource card");
 tab("all");await settle();assert([...root.querySelectorAll("th")].some(th=>th.textContent==="Project"),"Resource table includes Project");
 assert(!root.textContent.match(/High|Medium|Low|No project/),"No invented priorities or empty project labels");
 root.querySelector(".hub-full-add-task").click();await settle();form=lastModal.contentEl;
 const association=form.querySelector('select[aria-label="Project (optional)"]');assert(!association.closest("section").hidden,"Resource creator offers Project");
 assert([...association.options].map(x=>x.value).join("|")==="|p1","Only active Project selectable");
 assert(form.querySelector(".hub-task-source").textContent==="Knowledge · Folder","Current workspace Location prefilled");
 form.querySelector(".hub-task-title-input").value="Linked resource task";association.value="p1";form.querySelector("button[type=submit]").click();await settle();
 assert(contents.get(resource.root+"/Tasks.md").includes("Linked resource task"),"Folder creation lazily uses Tasks.md");
 assert(plugin.taskData.readWorkspace(dv,project,[resource]).some(t=>t.text==="Linked resource task"),"One newly linked task appears in both workspaces");
 // Move the new task through the real shared editor picker.
 const created=[...root.querySelectorAll(".hub-full-task-title")].find(el=>el.textContent==="Linked resource task");created.click();await settle();
 const editModal=lastModal;[...editModal.contentEl.querySelectorAll("button")].find(el=>el.textContent==="Choose location…").click();await settle();
 const picker=lastModal;[...picker.contentEl.querySelectorAll("button")].find(el=>el.textContent==="Physics › Notes").click();
 editModal.contentEl.querySelector("button[type=submit]").click();await settle();
 assert(!contents.get(resource.root+"/Tasks.md").includes("Linked resource task")&&contents.get(resource.root+"/Physics/Notes.md").includes("Linked resource task"),"Location picker moves canonical task");
 const bar=document.querySelector(".status-bar"),left=bar.createDiv({cls:"hub-oath-control hub-button-scope"});
 for(const label of ["The Oath","Daily brief","Music","Settings"])left.createEl("button",{cls:"hub-oath-button",text:label});
 bar.createDiv({cls:"status-bar-item",text:"0 backlinks   4 properties"});
 const shortcuts=load("ui/app-shortcuts").mountAppShortcuts(plugin,left);await settle();assert(shortcuts&&!bar.querySelector(".hub-shell-shortcut"),"Resource with no shortcuts has no placeholder");
 mount(project);workspace.emit("active-leaf-change");await settle();assert(bar.querySelectorAll(".hub-shell-shortcut").length===2,"Configured project shortcuts in bottom shell");bar.querySelector(".hub-shell-shortcut").click();await settle();assert(plugin.lastShortcut==="overleaf","Shortcut preserves launcher");
 const group=bar.querySelector(".hub-shell-shortcuts").getBoundingClientRect(),leftRect=left.getBoundingClientRect();assert(group.left>=leftRect.right,"Centered shortcuts do not overlap global controls");
 mount(resource);click("Tasks");tab("all");await settle();workspace.emit("active-leaf-change");
 for(const width of [1040,760,420]){container.style.width=width+"px";await settle();
  assert(document.documentElement.scrollWidth<=window.innerWidth,"No whole-page overflow at "+width);
  for(const view of ["location","upcoming","all"]){tab(view);await settle();assert(root.scrollWidth<=root.clientWidth+1,"Resource local overflow at "+width+" "+view)}
 }
 container.style.width="1040px";mount(project);click("Tasks");for(const width of [1040,760,420]){container.style.width=width+"px";for(const view of ["upcoming","calendar","timeline","all"]){tab(view);await settle();assert(root.scrollWidth<=root.clientWidth+1,"Project local overflow at "+width+" "+view)}}
 container.style.width="1040px";mount(resource);click("Tasks");tab("all");await settle();
 assert(notices.length===0,"No runtime notices: "+notices.join(";"));
 window.hubShowTaskPreview=async(kind,view,width=1240)=>{
  container.style.maxWidth="none";container.style.width=width+"px";mount(kind==="project"?project:resource);
  if(!controller.active())click("Tasks");tab(view);await settle();
 };
 shortcuts.destroy();cleanup.unload();component.unload();plugin.taskData.destroy();
 document.getElementById("result").textContent="PASS: Project and Resource Files/Tasks flows, exact tabs/defaults, linked canonical tasks, search/location/status/necessity/sort, month/week/date creation, timeline semantics, add/edit/check/uncheck/move, Oath notification, lazy folder notes, active Project picker, shortcuts, and local overflow at 1040/760/420px.";
}catch(error){document.getElementById("result").textContent="FAIL: "+error.stack}};
