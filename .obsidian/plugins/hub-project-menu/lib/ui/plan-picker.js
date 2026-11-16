"use strict";
const {Modal,Component,Menu}=require("obsidian");
const {ownModalColors,ownMenuColors}=require("./color-system");
const {createModalHeader,layoutModal}=require("./window-title");
const {identity,refOf,clone}=require("../domain/global-plan");
const {setHubIcon}=require("./icons");
const {fileIcon}=require("./file-icons");
const {createTaskRow,mountTaskCardPresentation}=require("./task-card");
const {taskGroups}=require("../domain/task-planning");
const {appendRouteSeparator}=require("./route-breadcrumb");
class PlanPicker extends Modal {
 constructor(plugin,{relink=null}={}){super(plugin.app);this.plugin=plugin;this.plan=plugin.globalPlan;this.relink=relink;this.planId=this.plan.active()?.id;this.selected=new Map();this.category=relink?"file":"task";this.returnFocus=document.activeElement;this.fileInitialized=false;this.invocation=plugin.workspaceModes?.currentContext?.()??null;if(!plugin.workspaceModes?.currentContext){const path=plugin.app.workspace?.getActiveFile?.()?.path;this.invocation=path?plugin.projectWizard.getContextForPath?.(path):null;}this.invocationPath=plugin.app.workspace?.getActiveFile?.()?.path;}
 onOpen(){
  ownModalColors(this);this.modalEl.classList.add("hub-plan-modal","hub-plan-picker");this.contentEl.classList.add("hub-button-scope");this.component=new Component();this.component.load();
  createModalHeader(this.contentEl,{title:this.relink?"Relink file":"Add to plan",icon:"list-plus",subtitle:this.relink?undefined:"Choose what to include in your plan."});
  const controls=this.contentEl.createDiv({cls:"hub-plan-picker-controls"});
  this.categoryEl=controls.createEl("select",{attr:{"aria-label":"Item type",hidden:""}});this.categoryButtons=[];
  const tabs=controls.createDiv({cls:"hub-plan-picker-tabs",attr:{role:"group","aria-label":"Item type"}});
  for(const [value,text]of [["task","Tasks"],["file","Files"],["workspace","Workspaces"]]){
   this.categoryEl.createEl("option",{attr:{value},text});const b=tabs.createEl("button",{text,attr:{type:"button"}});b.disabled=!!this.relink&&value!=="file";b.onclick=()=>{this.categoryEl.value=value;this.categoryEl.onchange();};this.categoryButtons.push({b,value});
  }
  this.categoryEl.value=this.category;this.categoryEl.onchange=()=>{if(this.category==="file")this.fileLocation={scope:this.workspaceScope.value,folder:this.folder};this.category=this.categoryEl.value;if(this.category==="file"){this.ensureFileLocation();if(this.fileLocation){this.workspaceScope.value=this.fileLocation.scope;this.folder=this.fileLocation.folder;}}this.render();};
  this.search=controls.createEl("input",{attr:{type:"search",placeholder:"Search","aria-label":"Search plan items"}});this.search.oninput=()=>this.render();
  this.workspaceScope=controls.createEl("select",{attr:{"aria-label":"Workspace scope",hidden:""}});this.workspaceScope.createEl("option",{attr:{value:""},text:"All workspaces"});
  for(const w of this.plan.references.workspaces())this.workspaceScope.createEl("option",{attr:{value:JSON.stringify(refOf(w))},text:w.name??w.label});
  this.workspaceScope.onchange=()=>{this.folder="";if(this.category==="file")this.fileLocation={scope:this.workspaceScope.value,folder:""};this.render();};
  this.workspaceButton=controls.createEl("button",{cls:"hub-task-location-workspace-row",attr:{"aria-haspopup":"menu"}});
  this.workspaceButton.onclick=()=>{const menu=ownMenuColors(new Menu());for(const option of this.workspaceScope.options)menu.addItem(i=>i.setTitle(option.text).setChecked(option.value===this.workspaceScope.value).onClick(()=>{this.workspaceScope.value=option.value;this.workspaceScope.onchange();}));const r=this.workspaceButton.getBoundingClientRect();menu.showAtPosition({x:r.left,y:r.bottom});};
  this.breadcrumbs=controls.createEl("nav",{cls:"hub-task-location-breadcrumbs",attr:{"aria-label":"Folder",hidden:""}});
  this.body=this.contentEl.createDiv({cls:"hub-plan-picker-body"});this.results=this.body.createDiv();this.results.onkeydown=e=>{if(!["ArrowDown","ArrowUp","Home","End"].includes(e.key))return;const controls=[...this.results.querySelectorAll("button,[data-selection-key]")].filter(el=>!el.disabled);const index=controls.indexOf(e.target);if(index<0)return;e.preventDefault();controls[e.key==="Home"?0:e.key==="End"?controls.length-1:Math.max(0,Math.min(controls.length-1,index+(e.key==="ArrowDown"?1:-1)))]?.focus();};this.error=this.contentEl.createDiv({cls:"hub-task-error",attr:{role:"alert"}});
  this.review=this.contentEl.createDiv({cls:"hub-plan-review",attr:{hidden:""}});this.reviewToggle=this.review.createEl("button",{text:"Review selection",cls:"hub-button-plain",attr:{"aria-expanded":"false"}});this.reviewList=this.review.createDiv({cls:"hub-plan-review-list hub-scrollbar",attr:{hidden:""}});this.reviewToggle.onclick=()=>{this.reviewOpen=!this.reviewOpen;this.renderReview();};this.announcement=this.contentEl.createDiv({cls:"hub-plan-announcement",attr:{role:"status","aria-live":"polite"}});
  const footer=this.contentEl.createDiv({cls:"hub-project-advancement-actions"});const cancel=footer.createEl("button",{text:"Cancel"});cancel.onclick=()=>this.close();this.add=footer.createEl("button",{text:"Add selected (0)",cls:"mod-cta"});this.add.disabled=true;this.add.onclick=()=>this.commit();
  layoutModal(this,{headerEnd:controls,body:this.body,footer});this.plan.subscribe(this.component,()=>this.render());void this.load();
 }
 async load(){try{this.items=await this.plan.references.candidates();if(this.category==="file")this.ensureFileLocation();if(this.contentEl.isConnected){this.render();if(this.plan.references.taskError)this.error.textContent="Tasks are temporarily unavailable. Files and Workspaces are still available.";}}catch(error){if(this.isOpen)this.error.textContent=error.message;}}
 existing(){return new Set(this.plan.draft.entries.filter(e=>e.id!==this.relink?.id).map(identity));}
 render(){
  if(!this.items)return;this.modalEl.dataset.category=this.category;
  const scroll=this.body.scrollTop,active=this.results.ownerDocument.activeElement,key=active?.dataset.selectionKey;
  this.results.empty();this.breadcrumbs.empty();this.breadcrumbs.hidden=this.category!=="file";const scope=this.category==="workspace"?null:this.workspaceScope.value?JSON.parse(this.workspaceScope.value):null,q=this.search.value.trim().toLocaleLowerCase();
  for(const {b,value}of this.categoryButtons){b.classList.toggle("is-selected",value===this.category);b.setAttribute("aria-pressed",String(value===this.category));}
  this.workspaceButton.hidden=this.category==="workspace";this.workspaceButton.empty();
  const workspace=scope?this.plan.references.workspace(scope):null;
  if(workspace)require("./workspace-thumbnail").mountWorkspaceThumbnail(this.workspaceButton,this.plugin,workspace);
  const workspaceCopy=this.workspaceButton.createSpan({cls:"hub-plan-workspace-copy"});workspaceCopy.createSpan({text:workspace?.name??workspace?.label??"All workspaces"});if(workspace)workspaceCopy.createSpan({cls:"hub-plan-metadata",text:scope.type==="project"?"Project":"Resource"});setHubIcon(this.workspaceButton.createSpan({cls:"hub-plan-scope-chevron"}),"chevron-right");
  let items=this.items.filter(i=>i.entry.kind===this.category&&(i.entry.kind!=="task"||!i.completed&&i.task?.nativeReadOnly!==true));
  if(this.category==="task")items=this.orderTasks(items);
  if(scope)items=items.filter(i=>JSON.stringify(i.workspace)===JSON.stringify(scope)||i.entry.kind==="file"&&this.sharedIn(scope,i.path));
  items=items.filter(i=>!q||[i.label,i.path,this.plan.references.workspace(i.workspace)?.name].join(" ").toLocaleLowerCase().includes(q));
  if(this.category==="file"){
   if(!scope&&!this.folder){this.breadcrumbs.hidden=true;
    const owners=new Map();for(const item of items)owners.set(JSON.stringify(item.workspace),item.workspace);
    if(!q)for(const owner of owners.values()){const w=this.plan.references.workspace(owner);if(!w)continue;const b=this.results.createEl("button",{cls:"hub-button-plain hub-task-location-entry hub-plan-folder"});setHubIcon(b.createSpan(),w.icon??"folder");b.createSpan({text:w.name??w.label});setHubIcon(b.createSpan(),"chevron-right");b.onclick=()=>{this.workspaceScope.value=JSON.stringify(owner);this.workspaceScope.onchange();};}if(!q)items=[];
   }else{
    const workspaceRoot=workspace?.root??"";
    const physicalOwner=this.folder&&this.plugin.projectWizard.getContextForPath?.(this.folder);
    const physical=this.folder&&items.find(i=>i.path.startsWith(this.folder+"/"));
    const root=physicalOwner?.root??(physical?this.plan.references.workspace(physical.workspace)?.root??workspaceRoot:workspaceRoot),current=this.folder||root;
    const nav=this.breadcrumbs;
    const segments=current.slice(root.length).split("/").filter(Boolean);let path=root;
    const crumb=(text,target)=>{const b=nav.createEl("button",{cls:"hub-button-plain",attr:{type:"button",title:target}});b.createSpan({cls:"hub-task-location-segment-label",text});b.dataset.locationPath=target;b.onclick=()=>{this.folder=target;this.render();};};
    if(root!==workspaceRoot){crumb(workspace?.name??workspace?.label??"Project",workspaceRoot);appendRouteSeparator(nav,"hub-task-location-separator");}
    const physicalWorkspace=physicalOwner??(physical&&this.plan.references.workspace(physical.workspace));
    crumb(physicalWorkspace?.name??workspace?.name??workspace?.label??"Files",root);for(const segment of segments){path+=(path?"/":"")+segment;appendRouteSeparator(nav,"hub-task-location-separator");crumb(segment,path);}
    const endpoint=nav.querySelector("button:last-child");endpoint?.setAttribute("aria-current","location");endpoint?.removeAttribute("title");
    const changed=this.breadcrumbPath!==current,oldScroll=this.breadcrumbScroll??0;this.breadcrumbPath=current;
    queueMicrotask(()=>{if(nav.isConnected){nav.scrollLeft=changed?nav.scrollWidth:oldScroll;}});nav.onscroll=()=>{this.breadcrumbScroll=nav.scrollLeft;};
    const folders=new Set();
    const directory=this.plugin.app.vault.getAbstractFileByPath(current);for(const child of directory?.children??[])if(Array.isArray(child.children))folders.add(child.path);
    if(scope?.type==="project"&&(!this.folder||this.folder===workspaceRoot))for(const item of items){if(this.sharedIn(scope,item.path)){const source=this.plan.references.workspace(item.workspace);if(source?.root&&source.root!==workspaceRoot)folders.add(source.root);}}
    if(!q)items=items.filter(i=>{if(current&&!i.path.startsWith(current+"/"))return false;const relative=current?i.path.slice(current.length+1):i.path;if(relative.includes("/")){folders.add((current?current+"/":"")+relative.split("/")[0]);return false;}return true;});
    if(!q)for(const folder of [...folders].sort()){const b=this.results.createEl("button",{cls:"hub-button-plain hub-task-location-entry hub-plan-folder"});setHubIcon(b.createSpan({cls:"hub-task-location-icon"}),"folder");b.createSpan({cls:"hub-task-location-name",text:folder.split("/").at(-1)});setHubIcon(b.createSpan({cls:"hub-task-location-icon"}),"chevron-right");b.onclick=()=>{this.folder=folder;this.render();};}
   }
  }
  const existing=this.existing();for(const k of existing)this.selected.delete(k);
  for(const item of items){
   const k=identity(item.entry),inPlan=existing.has(k),pending=this.selected.has(k),row=this.results.createDiv({cls:"hub-plan-picker-row"+(inPlan?" is-in-plan":pending?" is-new":""),attr:{role:"button",tabindex:"0","aria-pressed":String(inPlan||pending),"aria-disabled":String(inPlan),"aria-label":item.label+(inPlan?", already in plan":pending?", selected for plan":"")}});row.dataset.selectionKey=k;
   if(item.entry.kind==="task"&&item.task){const task=createTaskRow(row,item.task,false,{variant:"home",decorativeCheckbox:true});mountTaskCardPresentation(task.row,task.textEl,item.task,()=>item.task.path??"",{selection:true,normalSource:true});
    if(item.task.steps?.length)task.info.createDiv({cls:"hub-plan-task-step-summary",text:require("./task-card").taskStepSummary(item.task.steps)});
   }else{
    if(item.entry.kind==="workspace"){const w=this.plan.references.workspace(item.workspace);if(w)require("./workspace-thumbnail").mountWorkspaceThumbnail(row,this.plugin,w);}
    else setHubIcon(row.createSpan({cls:"hub-plan-icon"}),fileIcon(item.path));
    const copy=row.createDiv({cls:"hub-plan-content"});copy.createDiv({text:item.label});
    if(item.entry.kind!=="file"||q){const meta=copy.createDiv({cls:"hub-plan-metadata"});require("./plan-presentation").renderPlanMetadata(meta,item,this.plan);}
   }
   row.createSpan({cls:"hub-plan-selection-status",text:inPlan?"In plan":pending?"New":""});
   const toggle=()=>{if(inPlan)return;if(this.selected.has(k))this.selected.delete(k);else{if(this.relink)this.selected.clear();const chosen=clone(item.entry);if(chosen.kind==="file"&&scope)chosen.intendedContext=scope;this.selected.set(k,chosen);}this.render();};
   row.onclick=toggle;row.onkeydown=e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();toggle();}};
  }
  if(!this.results.children.length)this.results.createDiv({cls:"home-empty",text:"No matching items."});
  this.add.disabled=!this.selected.size;this.add.textContent=this.relink?"Relink selected":"Add selected ("+this.selected.size+")";this.body.scrollTop=scroll;this.renderReview();
  if(key)[...this.results.querySelectorAll("[data-selection-key]")].find(b=>b.dataset.selectionKey===key)?.focus({preventScroll:true});
 }
 ensureFileLocation(){
  if(this.fileInitialized)return;this.fileInitialized=true;
  const workspaces=this.plan.references.workspaces(),available=w=>w?.root&&Array.isArray(this.plugin.app.vault.getAbstractFileByPath(w.root)?.children);
  const wanted=this.relink?this.plan.references.workspace(this.relink.intendedContext??this.relink.reference.sourceWorkspace):this.invocation;
  const exploration=require("../config").RESOURCE_TYPES.find(w=>w.label==="Explorations");
  const workspace=available(wanted)?wanted:workspaces.find(w=>w.resourceType===exploration?.id&&available(w))??workspaces.find(available);
  if(!workspace)return;this.workspaceScope.value=JSON.stringify(refOf(workspace));this.folder=workspace.root;
  const path=this.relink?.reference.path??(wanted===workspace?this.invocationPath:null),file=path&&this.plugin.app.vault.getAbstractFileByPath(path),parent=file?.parent?.path??path?.slice(0,path.lastIndexOf("/"));
  if(parent&&(parent===workspace.root||parent.startsWith(workspace.root+"/")||this.sharedIn(refOf(workspace),parent))&&Array.isArray(this.plugin.app.vault.getAbstractFileByPath(parent)?.children))this.folder=parent;
  this.fileLocation={scope:this.workspaceScope.value,folder:this.folder};
 }
 orderTasks(items){
  const owners=this.plan.references.workspaces(),rank=i=>{const n=owners.findIndex(w=>JSON.stringify(refOf(w))===JSON.stringify(i.workspace));return n<0?owners.length:n;};
  const ordered=[...items].sort((a,b)=>rank(a)-rank(b)),oath=this.plugin.oath;
  const pinned=oath?.active?require("../domain/oath-workspace").oathTaskOrder(oath.current):new Map();
  const key=i=>require("../domain/oath-workspace").taskKey(i.task),ordinary=ordered.filter(i=>!pinned.has(key(i))),groups=taskGroups(ordinary);
  return [...ordered.filter(i=>pinned.has(key(i))).sort((a,b)=>pinned.get(key(a))-pinned.get(key(b))),...groups.active,...groups.future];
 }
 renderReview(){
  const active=this.contentEl.ownerDocument.activeElement,focused=active?.dataset.reviewKey,scroll=this.reviewList.scrollTop;
  this.review.hidden=!this.selected.size;if(!this.selected.size)this.reviewOpen=false;
  this.reviewToggle.setAttribute("aria-expanded",String(!!this.reviewOpen));this.reviewList.hidden=!this.reviewOpen;this.reviewList.empty();
  if(this.reviewOpen)for(const kind of ["task","file","workspace"]){const entries=[...this.selected].filter(([,e])=>e.kind===kind);if(!entries.length)continue;
   this.reviewList.createEl("strong",{text:{task:"Tasks",file:"Files",workspace:"Workspaces"}[kind]});
   for(const [k,e]of entries){const row=this.reviewList.createDiv({cls:"hub-plan-review-row"}),copy=row.createDiv();copy.createDiv({text:e.lastKnownLabel});const item=this.items.find(i=>identity(i.entry)===k);if(item){const meta=copy.createDiv({cls:"hub-plan-metadata"});if(kind==="task")meta.textContent=this.plan.references.workspace(item.workspace)?.name??"";else require("./plan-presentation").renderPlanMetadata(meta,item,this.plan);}
    const remove=row.createEl("button",{cls:"hub-button-plain",text:"Remove",attr:{"aria-label":"Remove "+e.lastKnownLabel+" from selection"}});remove.dataset.reviewKey=k;remove.onclick=()=>{const keys=[...this.reviewList.querySelectorAll("[data-review-key]")].map(b=>b.dataset.reviewKey),index=keys.indexOf(k);this.selected.delete(k);this.render();const buttons=[...this.reviewList.querySelectorAll("button")];(buttons[Math.min(index,buttons.length-1)]??(this.review.hidden?this.categoryButtons.find(x=>x.value===this.category).b:this.reviewToggle)).focus();};
   }
  }
  this.reviewList.scrollTop=scroll;if(focused)[...this.reviewList.querySelectorAll("button")].find(b=>b.dataset.reviewKey===focused)?.focus({preventScroll:true});
  const message=this.selected.size+" selected for plan";if(this.announcement.textContent!==message)this.announcement.textContent=message;
 }
 sharedIn(scope,path){if(scope.type!=="project")return false;const project=this.plan.references.workspace(scope),ids=project?.resourceFolderIds??[];const folders=this.plugin.projectWizard.data.resourceFolders??[];return (Array.isArray(folders)?folders:Object.values(folders)).some(f=>ids.includes(f.id)&&(path===f.path||path.startsWith(f.path+"/")));}
 async commit(){this.add.disabled=true;try{this.plan.assertEditable(this.planId);
  const current=await this.plan.references.candidates();if(!this.isOpen)return;this.items=current;this.plan.assertEditable(this.planId);
  const eligible=new Set(current.filter(i=>i.entry.kind!=="task"||!i.completed&&i.task?.nativeReadOnly!==true).map(i=>identity(i.entry))),existing=this.existing();let invalid=false;
  for(const key of this.selected.keys()){if(existing.has(key))this.selected.delete(key);else if(!eligible.has(key)){this.selected.delete(key);invalid=true;}}
  if(invalid){this.render();throw Error("A selected item became completed or unavailable. Review the remaining selection and add again.");}
  if(!this.selected.size){this.render();return;}
  if(this.relink){const chosen=[...this.selected.values()][0];this.plan.mutate(p=>{const e=p.entries.find(e=>e.id===this.relink.id);if(!e)throw Error("This entry was removed.");if(p.entries.some(x=>x.id!==e.id&&identity(x)===identity(chosen)))throw Error("Already in plan.");e.reference=chosen.reference;e.lastKnownLabel=chosen.lastKnownLabel;delete e.unavailableReason;});}else this.plan.add([...this.selected.values()]);
  await this.plan.flush();this.close();
 }catch(error){if(this.isOpen){this.error.textContent=error.message;this.add.disabled=!this.selected.size;}}}
 onClose(){if(this.plugin.planPicker===this)this.plugin.planPicker=null;this.component?.unload();this.selected.clear();const target=this.returnFocus?.isConnected?this.returnFocus:this.plugin.planModal?.modalEl;target?.focus?.();}
}
function openPlanPicker(plugin,options){if(plugin.planPicker?.containerEl?.isConnected){plugin.planPicker.modalEl.focus();return plugin.planPicker;}const modal=new PlanPicker(plugin,options);plugin.planPicker=modal;try{modal.open();return modal;}catch(error){modal.close();plugin.planPicker=null;throw error;}}
module.exports={PlanPicker,openPlanPicker};
