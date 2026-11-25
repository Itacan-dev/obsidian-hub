"use strict";
const {setIcon,Notice}=require("obsidian");
const {ownNoticeColors}=require("./color-system");
const {createPointerListReorder}=require("./pointer-list-reorder");
const {createTaskRow,mountTaskCardPresentation}=require("./task-card");
const {fileIcon}=require("./file-icons");
const {runNativeTaskToggle}=require("./task-operation");
function mountPlanList({root,component,plan,editable=false,onRelink=()=>{},scroller=root,interactive=true,execute=interactive,historicalNavigation=false,emptyMessage=true,onRendered}){
 let generation=0,disposed=false,reorder;const report=error=>ownNoticeColors(new Notice(error.message));
 const edit=action=>{try{action();}catch(error){report(error);}};
 async function render(){const gen=++generation;let items;try{items=await plan.references.resolve();}catch(error){if(gen===generation){root.classList.remove("is-empty-plan");root.empty();root.createDiv({text:error.message});}return;}if(disposed||gen!==generation||reorder?.busy)return;
  const focus=root.ownerDocument.activeElement,focused=focus?.closest?.("[data-plan-id]")?.dataset.planId,control=focus?.dataset.planControl,scroll=Number(scroller.dataset.planScrollRestore??scroller.scrollTop);delete scroller.dataset.planScrollRestore;reorder?.cancel();root.empty();root.classList.toggle('is-empty-plan',editable&&!items.length);
  if(editable&&!items.length&&emptyMessage)root.createDiv({cls:'hub-plan-editor-empty',text:'This Plan has no items.'});
  if(!editable&&!items.length&&emptyMessage)root.createDiv({cls:"home-empty",text:"Add something to your plan when it helps."});
  const list=root.createDiv({cls:"hub-plan-list"});
  const live=root.createDiv({cls:"hub-plan-announcement",attr:{"aria-live":"polite"}});
  reorder=createPointerListReorder({container:list,scroller,placeholderClass:"hub-plan-placeholder",sortingClass:"is-sorting-plan",focusTarget:row=>row.querySelector("[data-plan-control=grip]"),commit:(rows,moved)=>plan.move(moved.dataset.planId,rows.indexOf(moved)),onError:report});
  items.forEach((item,index)=>{const {entry,task}=item,available=item.availability==="current";const row=list.createDiv({cls:"hub-plan-row"+((item.historical?item.snapshot.taskState==="completed":task?.completed)?" is-completed":""),attr:{"data-plan-id":entry.id}});
   if(editable){const grip=row.createEl("button",{cls:"hub-button-plain hub-plan-hover",attr:{"aria-label":"Reorder "+item.label,"data-plan-control":"grip","aria-keyshortcuts":"Alt+ArrowUp Alt+ArrowDown Alt+Home Alt+End","aria-description":"Drag to reorder. Alt+Up or Down moves one position; Alt+Home or End moves to the first or last position.",title:"Drag to reorder \u00b7 Alt+\u2191/\u2193 to move"}});setIcon(grip,"grip-vertical");grip.disabled=!!plan.busy;grip.onpointerdown=e=>{e.preventDefault();reorder.begin(e,row,list);};grip.onkeydown=e=>{if(e.altKey&&["ArrowUp","ArrowDown","Home","End"].includes(e.key)){e.preventDefault();const to=e.key==="Home"?0:e.key==="End"?items.length-1:index+(e.key==="ArrowUp"?-1:1);edit(()=>{plan.move(entry.id,to);live.textContent=`Moved to position ${Math.max(1,Math.min(items.length,to+1))}`;});}};}
   let content,title;
   if(task&&!item.historical&&execute){
    const native=createTaskRow(row,task,task.completed,{variant:"home",leadingSlot:true});
    native.row.classList.add("hub-plan-native-task");
    const check=native.checkbox;check.disabled=!available||task.nativeReadOnly||plan.busy;
    check.onchange=()=>void runNativeTaskToggle({checkbox:check,task,completed:check.checked,run:done=>{(plan.assertExecutable??plan.assertEditable)?.call(plan);return plan.trackNative?plan.trackNative(plan.references.tasks.toggle(task,done)):plan.references.tasks.toggle(task,done);},onEdit:()=>plan.emit(),report});
    check.dataset.planControl="complete";
    mountTaskCardPresentation(native.row,native.textEl,task,()=>task.path??"",{importance:false,dates:false,description:false});
    content=native.info;title=native.textEl;title.classList.add("hub-plan-title");title.tabIndex=available?0:-1;title.setAttribute("role","button");title.setAttribute("aria-disabled",String(!available));
    title.onclick=()=>{if(available)void plan.references.open(item).catch(report);};title.onkeydown=e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();title.click();}};
   }else{
    const taskState=item.historical?item.snapshot.taskState:task?.completed?"completed":undefined;
    const leading = row.createSpan({ cls: "hub-plan-icon hub-plan-leading", attr: { "aria-hidden": "true" } });
    if (entry.kind === "task") {
     const checkbox = leading.createEl("input", { cls: "home-task-checkbox hub-plan-readonly-checkbox", attr: { type: "checkbox", tabindex: "-1" } });
     checkbox.checked = taskState === "completed";
     checkbox.disabled = true;
    } else setIcon(leading, entry.kind === "workspace" ? item.context?.icon ?? "folder" : fileIcon(entry.reference.path));
    const canOpen=entry.kind!=="task"&&(item.historical?historicalNavigation:interactive);
    content=row.createDiv({cls:"hub-plan-content"});title=content.createEl(canOpen?"button":"span",{cls:"hub-button-plain hub-plan-title",text:item.label||"Unavailable reference"});if(canOpen){title.disabled=item.historical?item.navigationAvailability!=="current":!available;title.onclick=()=>void plan.references.open(item).catch(report);}
    if(item.historical){
     content.createDiv({cls:"hub-plan-metadata",text:item.snapshot.route});
     if(entry.kind==="task")content.createDiv({cls:"hub-plan-metadata",text:taskState==="completed"?"Completed":taskState==="incomplete"?"Incomplete":"Task state unknown"});
     if(canOpen&&title.disabled)content.createDiv({cls:"hub-oath-muted",text:"Reference unavailable"});
    }else if(entry.kind==="task")content.createDiv({cls:"hub-plan-metadata",text:item.context?.name??item.context?.label??""});
    else require("./plan-presentation").renderPlanMetadata(content.createDiv({cls:"hub-plan-metadata"}),item,plan);
   }
   if(!available&&!item.historical)content.createDiv({cls:"hub-oath-muted",text:item.fileState==="deleted"?"File deleted":item.fileState==="unresolved"?"File reference needs relinking":item.fileState==="missing"?"File not found":entry.kind==="file"&&item.availability==="missing"?"File reference needs relinking":item.availability==="missing"?"Source unavailable":"Temporarily unavailable"});
   if(editable){row.append(row.querySelector("[data-plan-control=grip]"));if(entry.kind==="file"&&!available){const relink=row.createEl("button",{text:"Relink"});relink.disabled=!!plan.busy;relink.dataset.planControl="relink";relink.onclick=()=>onRelink(entry,relink);}const remove=row.createEl("button",{cls:"hub-button-plain hub-plan-hover",attr:{"aria-label":"Remove from plan: "+item.label,title:"Remove from plan","data-plan-control":"remove"}});setIcon(remove,"x");remove.disabled=!!plan.busy;remove.onclick=()=>edit(()=>{plan.remove(entry.id);queueMicrotask(()=>root.querySelectorAll(".hub-plan-title")[Math.min(index,items.length-2)]?.focus());});}
  });scroller.scrollTop=scroll;onRendered?.();if(focused){const row=[...list.children].find(r=>r.dataset.planId===focused);row?.querySelector(control?`[data-plan-control="${control}"]`:".hub-plan-title")?.focus({preventScroll:true});}
 }
 plan.subscribe(component,()=>void render());component.register(()=>{disposed=true;generation++;reorder?.cancel();});void render();return {render};
}
module.exports={mountPlanList};
