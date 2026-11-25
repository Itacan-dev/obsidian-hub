"use strict";
const {entryFor,refOf,clone}=require("../domain/global-plan");
const {sameOrInside}=require("../domain/plan-relevance");
const same=(a,b)=>a?.type===b?.type&&a?.id===b?.id;
class PlanReferences {
 constructor(plugin,plan){this.plugin=plugin;this.plan=plan;this.known=new Map();this.verified=false;this.tasks=plugin.nativeTaskHost.nativeTasks.createReferenceRead({component:plugin,changed:()=>plan.emit()});
  if(plugin.app.vault.on){for(const event of ["rename","delete"])plugin.registerEvent(plugin.app.vault.on(event,(file,oldPath)=>{
   try{const from=event==="rename"?oldPath:file.path;if(!from)return;const coordinated=[...this.known.values()].some(i=>from===i.from||from.startsWith(i.from+"/"));if(coordinated)return;const affected=plan.referenceEntries().some(e=>e.kind==="file"&&(e.reference.path===from||e.reference.path.startsWith(from+"/")));if(!affected)return;plan.mutateReferences(p=>{for(const e of p.entries){if(e.kind!=="file"||e.unavailableReason)continue;const path=e.reference.path;if(path!==from&&!path.startsWith(from+"/"))continue;if(event==="delete")e.unavailableReason="deleted";else{e.reference.path=file.path+path.slice(from.length);const source=plugin.projectWizard.getContextForPath(e.reference.path);e.reference.sourceWorkspace=source?refOf(source):null;}}});}catch(error){console.error("Plan external file event",error);}
  }));}
}
 workspaces(){return [...this.plugin.projectWizard.getProjectRecords(),...this.plugin.projectWizard.getResourceTypes()];}
 workspace(ref){return this.workspaces().find(w=>same(refOf(w),ref));}
 taskEntry(task){return entryFor("task",{authorityId:task.nativeReference.authorityId,taskId:task.id,ownerHint:task.owner},{lastKnownLabel:task.text});}
 fileEntry(file,context){const source=this.plugin.projectWizard.getContextForPath(file.path);return entryFor("file",{path:file.path,sourceWorkspace:source?refOf(source):null},{intendedContext:context??(source?refOf(source):undefined),lastKnownLabel:file.name});}
 workspaceEntry(w){return entryFor("workspace",refOf(w),{lastKnownLabel:w.name??w.label});}
 observe(stage,operationId,intent){
  try{
   if(stage==="prepared"){
    const saved=this.plan.pendingFile?.operationId===operationId?this.plan.pendingFile.intent:null;
    const tracked=saved??{...clone(intent),planBindings:this.plan.referenceEntries()
     .filter(entry=>entry.kind==="file"&&sameOrInside(entry.reference.path,intent.from))
     .map(entry=>({id:entry.id,path:entry.reference.path}))};
    this.known.set(operationId,tracked);
    this.plan.pendingFile={operationId,intent:tracked};
    this.plan.checkpoint();
   }else if(stage==="cancelled"){
    this.known.delete(operationId);
    if(this.pending?.operationId===operationId)this.pending=null;
    if(this.plan.pendingFile?.operationId===operationId){
     this.plan.pendingFile=null;
     this.plan.checkpoint();
    }
   }else{
    if(intent&&!this.known.has(operationId))this.known.set(operationId,clone(intent));
    const current=this.auditing;
    const read=current?current.catch(()=>{}).then(()=>this.audit()):this.audit();
    void read.catch(error=>console.error("Plan reference audit",error));
   }
  }catch(error){console.error("Plan observer",error);}
 }
 fileOperationPending(path){
  return [...this.known.values(),this.pending?.intent].some(intent=>intent&&intent.kind!=="copy"&&sameOrInside(path,intent.from));
 }
 async audit(){if(this.auditing)return this.auditing;this.auditing=this.auditInside().catch(error=>{this.verified=false;this.plan.emit();throw error;}).finally(()=>{this.auditing=null;});return this.auditing;}
 async auditInside(){const authority=this.plugin.nativeTaskHost.runtime(this.plugin.nativeTaskHost.nativeTasks.owners[0]).info().authority.authorityId;let cursor=this.plan.draft.fileOperationCursor;const wrong=cursor&&cursor.authorityId!==authority;
  let page=await this.plugin.nativeTaskHost.files.request({action:"receiptsSince",cursor:wrong?null:cursor});
  if(!cursor&&(!this.plan.referenceEntries().some(e=>e.kind==="file")||page.head.sequence===0)){this.plan.mutateReferences(p=>p.fileOperationCursor={...page.head,authorityId:authority});this.pending=page.pending;this.verified=true;this.plan.emit();return;}
  if(wrong||!page.valid||!cursor){this.plan.mutateReferences(p=>{for(const e of p.entries)if(e.kind==="file")e.unavailableReason="unresolved";p.fileOperationCursor={...page.head,authorityId:authority};});this.pending=page.pending;this.verified=true;this.plan.emit();return;}
  do{for(const receipt of page.receipts){const intent=this.known.get(receipt.operationId)??(this.plan.pendingFile?.operationId===receipt.operationId?this.plan.pendingFile.intent:null);
    this.plan.mutateReferences(p=>{
     if(receipt.fileOperation&&!receipt.cancelled&&receipt.kind!=="copy")for(const entry of p.entries){
      if(entry.kind!=="file"||entry.unavailableReason)continue;
      if(!intent){entry.unavailableReason="unresolved";continue;}
      const path=entry.reference.path;
      if(intent.planBindings&&!intent.planBindings.some(binding=>binding.id===entry.id&&binding.path===path))continue;
      if(!sameOrInside(path,intent.from))continue;
      if(receipt.partial){
       entry.unavailableReason=receipt.kind==="trash"&&!this.plugin.app.vault.getAbstractFileByPath(path)?"deleted":"unresolved";
      }else if(receipt.kind==="trash"){
       // A confirmed trash receipt records the old file, even if the path has been reused.
       entry.unavailableReason="deleted";
      }else{
       entry.reference.path=intent.to+path.slice(intent.from.length);
       const owner=this.plugin.projectWizard.getContextForPath(entry.reference.path);
       entry.reference.sourceWorkspace=owner?refOf(owner):null;
      }
     }
     p.fileOperationCursor={authorityId:authority,operationId:receipt.operationId,sequence:receipt.sequence};
    });
    this.known.delete(receipt.operationId);if(this.plan.pendingFile?.operationId===receipt.operationId)this.plan.pendingFile=null;
   }if(!page.more)break;page=await this.plugin.nativeTaskHost.files.request({action:"receiptsSince",cursor:this.plan.draft.fileOperationCursor});}while(true);
  this.pending=page.pending;this.verified=true;this.plan.checkpoint();this.plan.emit();
 }
 async resolve(entries=this.plan.draft.entries){
  const taskEntries=entries.filter(entry=>entry.kind==="task");
  const tasks=taskEntries.length?await this.tasks.read(taskEntries.map(entry=>entry.reference))
   .catch(()=>taskEntries.map(()=>({availability:"unavailable"}))):[];
  let taskIndex=0;
  return entries.map(entry=>{
   if(entry.kind==="task"){
    const result=tasks[taskIndex++];
    return {entry,...result,label:result.task?.text??entry.lastKnownLabel,context:this.workspace(result.task?.owner??entry.reference.ownerHint)};
   }
   if(entry.kind==="workspace"){
    const context=this.workspace(entry.reference);
    return {entry,context,label:context?.name??context?.label??entry.lastKnownLabel,availability:context?"current":"missing"};
   }
   const path=entry.reference.path,file=this.plugin.app.vault.getAbstractFileByPath(path);
   const fileState=entry.unavailableReason??(!this.verified||this.fileOperationPending(path)?"temporary":
    !file||Array.isArray(file.children)?"missing":"available");
   return {entry,file,context:this.workspace(entry.intendedContext),label:file?.name??entry.lastKnownLabel,fileState,
    availability:fileState==="available"?"current":fileState==="temporary"?"unavailable":"missing"};
  });
 }
 async open(item){if(item.entry.kind==="file")await this.audit();const plan=item.planId&&this.plan.readPlan(item.planId);
  const entry=(plan?(plan.content?.entries??plan.navigation):this.plan.draft.entries).find(e=>e.id===item.entry.id);
  if(!entry)throw Error("This reference is no longer in the Plan.");
  const [fresh]=await this.resolve([entry]);if(fresh.availability!=="current")throw Error("This reference is unavailable. Retry or relink it in Plans.");if(fresh.entry.kind==="task")return this.tasks.edit(fresh.task);const path=fresh.entry.kind==="file"?fresh.entry.reference.path:fresh.context.path;if(this.plugin.oath?.canOpen(path)===false)return;if(fresh.entry.kind==="workspace"&&this.plugin.workspaceModes)return this.plugin.workspaceModes.openProjectFull(fresh.context);if(this.plugin.workspaceModes)return this.plugin.workspaceModes.openProjectNote(path);await this.plugin.app.workspace.getLeaf(false).openFile(this.plugin.app.vault.getAbstractFileByPath(path));}
 async recommendation(){await this.plan.ensureLifecycle();if(!this.plan.active())return null;await this.audit();await this.plan.flush();const committed=clone(this.plan.base);const items=await this.resolve(committed.entries);for(const item of items){if(item.availability!=="current"||item.task?.completed)continue;const context=item.context,path=item.entry.kind==="file"?item.entry.reference.path:context?.path;if(this.plugin.oath?.active&&(item.entry.kind==="task"||this.plugin.oath.canOpen(path,false)===false))continue;const workspaceId=context?(context.contextKind==="resource"?"resource:"+context.resourceType:context.projectId):null;const target=item.entry.kind==="task"?{kind:"native-task",authorityId:item.task.nativeReference.authorityId,taskId:item.task.id,owner:item.task.owner,workspaceId}:item.entry.kind==="file"?{kind:"file",path:item.entry.reference.path,workspaceId}:{kind:"workspace",workspaceId};return {title:item.label,explanation:"From your saved plan.",actionLabel:"Open "+item.label,target,reason:"global-plan"};}if(committed.note||committed.entries.length)return {title:"Your plan",explanation:committed.note.slice(0,300)||"Review your completed or unavailable planned items.",actionLabel:"Review plan",target:{kind:"plan",planId:this.plan.active()?.id},reason:"global-plan"};return null;}
 async candidates(){await this.audit().catch(()=>{this.verified=false;});const tasks=await this.tasks.all().catch(error=>{this.taskError=error;return [];}),workspaces=this.workspaces();return [...tasks.map(t=>({entry:this.taskEntry(t),label:t.text,workspace:t.owner,completed:t.completed,task:t})),...this.plugin.contextSearch.fileSnapshot().files.filter(f=>f.kind==="files").map(f=>({entry:this.fileEntry(f.file),label:f.title,workspace:refOf(f.owner),path:f.path})),...workspaces.map(w=>({entry:this.workspaceEntry(w),label:w.name??w.label,workspace:refOf(w)}))];}
}
module.exports={PlanReferences};
