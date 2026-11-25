"use strict";
const {renderRouteBreadcrumb}=require("./route-breadcrumb");
const {compactPathSegments}=require("../domain/native-task-location");
const {planFeedback,showPlanFeedback}=require("./plan-feedback");
function renderPlanMetadata(host,item,plan){
 const {entry}=item, refs=plan.references;
 if(entry.kind==="workspace"){host.textContent=entry.reference.type==="resource"?"Resource":"Project";return;}
 if(entry.kind!=="file")return;
 const source=refs.workspace(entry.reference.sourceWorkspace),path=entry.reference.path;
 const root=source?.root,relative=root&&(path===root||path.startsWith(root+"/"))?path.slice(root.length).replace(/^\//,""):path;
 const parts=relative.split("/").slice(0,-1);
 renderRouteBreadcrumb(host,[source?.name??source?.label??"Vault",...compactPathSegments(parts).visible.map(part=>part??"\u2026")]);
 host.title=path;
 const intended=entry.intendedContext;
 if(intended&&(intended.type!==entry.reference.sourceWorkspace?.type||intended.id!==entry.reference.sourceWorkspace?.id)){
  const context=refs.workspace(intended);if(context)host.createSpan({cls:"hub-plan-intended",text:"For "+(context.name??context.label)});
 }
}
function mountPlanPresentation({root,component,plan,context="home",scroller=root,editable=false,onRelink,noteEditor,interactive=true,execute=interactive,historicalNavigation=false,noteCaption=context==="home"?"Today":undefined,noteAction,emptyMessage=true,showStatus=true,onRendered}){
 root.classList.add("hub-plan-presentation");root.dataset.planContext=context;
 let note;
 if(context==="editor"){
  const label=root.createDiv({cls:"hub-plan-note-label"});
  note=label.createEl("textarea",{attr:{rows:"3","aria-label":"Plan note (optional)",placeholder:"Add a note…"}});noteEditor?.(note);
 }else{
  note=root.createDiv({cls:"hub-plan-note-excerpt"});
 }
 let noteText=note;
 if(context!=="editor"&&noteCaption!==undefined){
  note.classList.add("hub-plan-note-rectangle");
  note.createSpan({cls:"hub-plan-note-caption",text:noteCaption});
  noteText=note.createSpan({cls:"hub-plan-note-text"});
  if(noteAction)noteAction(note);
 }
 const collection=root.createDiv({cls:"hub-plan-collection"});
 if(context==="home")collection.classList.add("hub-scrollbar");
 const status=showStatus&&context!=="editor"?root.createDiv({cls:"hub-plan-preview-status",attr:{role:"status"}}):null;
 const update=()=>{
  if(status)showPlanFeedback(status,planFeedback(plan));
  if(context!=="editor"){
   const text=plan.draft.note??"";
   note.hidden=!noteAction&&!noteCaption&&!text.trim();
   if(noteText.textContent!==text)noteText.textContent=text;
  }
 };
 plan.subscribe(component,update);update();
 // Lazy import avoids the metadata helper/list module cycle.
 require("./plan-list").mountPlanList({root:collection,component,plan,editable,onRelink,interactive,execute,historicalNavigation,emptyMessage,onRendered,scroller:context==="home"?collection:scroller});
 return {note,collection};
}
module.exports={mountPlanPresentation,renderPlanMetadata};
