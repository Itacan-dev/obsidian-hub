"use strict";
// Explicit Itacan operations. Native Obsidian/plugin mutations remain outside
// this boundary: no FileManager or Vault methods are replaced here.
const {randomUUID,createHash}=require("node:crypto");
const L=require("../domain/native-task-location"),{workspaceRef}=require("./native-task-locations");
const folder=file=>Array.isArray(file?.children),parent=path=>path.slice(0,path.lastIndexOf("/")),name=path=>path.split("/").at(-1);
const inside=(path,root)=>path===root||path.startsWith(root+"/");
const digest=bytes=>createHash("sha256").update(Buffer.from(bytes)).digest("hex");
const stable=value=>{const h=digest(JSON.stringify(value));return h.slice(0,8)+"-"+h.slice(8,12)+"-5"+h.slice(13,16)+"-a"+h.slice(17,20)+"-"+h.slice(20,32);};
const fail=(message,code="FILE_OPERATION_INVALID")=>{throw Object.assign(Error(message),{code});};
const normalize=paths=>[...new Set(paths)].sort((a,b)=>a.length-b.length||a.localeCompare(b)).filter((p,i,a)=>!a.slice(0,i).some(root=>inside(p,root)));
function validPath(path){if(typeof path!=="string"||!path||path.startsWith("/")||path.includes("\\")||path.split("/").some(p=>!p||p==="."||p===".."||/[\\/:*?"<>|\u0000-\u001f]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))fail("Choose a valid vault filename.");return path;}
class FileOperations {
 constructor(plugin,{bridge=null,boundary=null}={}){this.plugin=plugin;this.app=plugin.app;this.vault=this.app.vault;this.bridge=bridge;this.boundary=boundary;this.tail=Promise.resolve();this.clipboard=null;this.stopped=false;}
 get db(){const value=this.bridge??this.plugin.nativeTaskHost?.files;if(!value)fail("Native task coordination is unavailable. No files were changed.","TASKS_UNAVAILABLE");return value;}
 enqueue(run){const result=this.tail.catch(()=>{}).then(async()=>{if(this.stopped)fail("File operations are closing.");await this.db.request({action:"acquire"});try{return await run();}finally{await this.db.request({action:"release"}).catch(()=>{});}});this.tail=result;return result;}
 workspaces(){return[...this.plugin.projectWizard.getProjectRecords(),...this.plugin.projectWizard.getResourceTypes()].filter(w=>w.root&&!w.deleted).map(w=>({...w,owner:workspaceRef(w)}));}
 isWorkspaceRoot(path){return this.workspaces().some(w=>w.root===path);}
 physical(path,all){const found=all.filter(w=>inside(path,w.root)).sort((a,b)=>b.root.length-a.root.length);if(found.length>1&&found[0].root===found[1].root)fail("Ambiguous physical workspace ownership.");return found[0]??null;}
 endpoint(w,path,type){const ref=L.locationReference(w.owner,w.root,path,type);return{ownerId:this.db.ownerId(w.owner),context:ref?{kind:ref.type,reference:ref.id}:null};}
 fallback(w,path,excluded){let p=parent(path);while(p&&inside(p,w.root)){if(!inside(p,excluded)&&folder(this.vault.getAbstractFileByPath(p)))return this.endpoint(w,p,"folder");if(p===w.root)break;p=parent(p);}return{ownerId:this.db.ownerId(w.owner),context:null};}
 async manifest(path){const root=this.vault.getAbstractFileByPath(path);if(!root)fail("The source is no longer available.");const rows=[],visit=async(file,relative)=>{if(folder(file)){rows.push({relative,type:"folder"});for(const child of [...file.children].sort((a,b)=>a.path.localeCompare(b.path)))await visit(child,relative?relative+"/"+child.name:child.name);}else{const bytes=await this.vault.readBinary(file);rows.push({relative,type:"file",hash:digest(bytes),size:bytes.byteLength});}};await visit(root,"");return rows;}
 async matches(path,expected){try{const actual=await this.manifest(path);return actual.length===expected.length&&actual.every((r,i)=>["relative","type","hash","size"].every(key=>r[key]===expected[i][key]));}catch(_){return false;}}
 exact(path){const file=this.vault.getAbstractFileByPath(path);return file?.path===path?file:null;}
 phases(w){return w?.owner.type==="project"?(this.plugin.planning?.phases(w.owner.id)??[]).map(p=>p.id):[];}
 preflight(kind,from,to,options={},all=this.workspaces()){
  validPath(from);if(to)validPath(to);const source=this.vault.getAbstractFileByPath(from)??options.recoverySource;if(!source)fail("The source is no longer available.");
  if(["rename","move","copy"].includes(kind)){
   if(!to||to===from)fail("Choose a different destination.");
   if(folder(source)&&inside(to,from))fail("A folder cannot be moved or copied inside itself.");
   const existing=this.vault.getAbstractFileByPath(to);if(existing&&(existing!==source&&!options.recoverySource||kind==="copy"))fail("An item already exists at the destination.");
   if(!folder(this.vault.getAbstractFileByPath(parent(to))))fail("The destination folder is unavailable.");
   if(options.filesView&&!folder(source)&&all.some(w=>w.root===parent(to))&&!(kind==="rename"&&parent(from)===parent(to)))fail("Workspace roots accept folders, not files. Choose a subfolder.");
  }
  const structural=all.filter(w=>inside(w.root,from));
  if(structural.length&&!(options.workspaceRename&&kind==="rename"||options.workspaceDelete&&kind==="trash"))fail("Workspace roots are protected. Use their workspace actions.");
  const identity=all.some(w=>w.path&&inside(w.path,from));
  if(identity&&!options.workspaceRename&&!options.workspaceDelete)fail("Workspace dashboard identities cannot be moved, deleted or copied through ordinary file actions.");
  if(kind==="copy"&&structural.length)fail("Workspace identities cannot be duplicated.");
  if(from.split("/").some(p=>[".obsidian",".itacan-tasks",".git"].includes(p)))fail("Internal stores are protected.");
  const origin=this.physical(from,all),destination=to?this.physical(to,all):null;
  if(origin&&!destination&&["rename","move"].includes(kind)&&!options.workspaceRename&&!options.compensation)fail("Choose a destination inside a Project or Resource.");
  return{source,origin,destination,all};
 }
 async plan(kind,from,to,options,requestHash){
  const inventory=this.workspaces();
  if(options.legacyWorkspace)inventory.push({...options.legacyWorkspace,root:from,path:from+"/"+name(options.legacyWorkspace.hubPath??"Hub.md"),owner:{type:"resource",id:options.legacyWorkspace.id}});
  const recovering=!this.exact(from)&&options.captureRecoveryHash;
  if(recovering){const destination=this.exact(to);if(!destination||folder(destination)||digest(await this.vault.readBinary(destination))!==options.captureRecoveryHash)fail("Capture recovery evidence differs from the saved attachment.");options={...options,recoverySource:destination};}
  const {source,all}=this.preflight(kind,from,to,options,inventory),manifest=await this.manifest(recovering?to:from),mappings=[];
  if(kind==="copy")for(const row of manifest)if(row.relative.split("/").some(p=>[".obsidian",".itacan-tasks",".git"].includes(p)))fail("This folder contains an internal store and cannot be copied.");
  let requireUnreferenced=false;
  if(kind!=="copy")for(const row of manifest){const oldPath=row.relative?from+"/"+row.relative:from,type=row.type==="folder"?"folder":/\.md$/i.test(oldPath)?"note":null,w=this.physical(oldPath,all);if(!type||!w)continue;
   const old=this.endpoint(w,oldPath,type),fallback=this.fallback(w,oldPath,from),newPath=to?(row.relative?to+"/"+row.relative:to):null;
   let target=fallback;
   if(kind!=="trash"){
    const renamed=options.workspaceRename&&inside(w.root,from)?{...w,root:to+w.root.slice(from.length)}:null,dest=renamed??this.physical(newPath,all);
    if(dest)target=this.endpoint(dest,newPath,type);else requireUnreferenced=true;
   }
   const destOwner=all.find(candidate=>this.db.ownerId(candidate.owner)===target.ownerId),map={from:old,to:target,fallback,phases:this.phases(destOwner),path:oldPath,ancestors:this.ancestors(w,oldPath,from)};mappings.push(map);
   const compat=L.resourceReference(w.owner,oldPath,type);if(compat)mappings.push({...map,from:{ownerId:old.ownerId,context:{kind:type,reference:compat.id}}});
  }
  return{kind,from,to:to??null,requestHash,manifest,mappings,requireUnreferenced,workspaceRename:!!options.workspaceRename,workspaceDelete:!!options.workspaceDelete,sourceFolder:folder(source),...(options.compensationReceiptId?{compensationReceiptId:options.compensationReceiptId}:{})};
 }
 ancestors(w,path,excluded){const rows=[];let p=parent(path);while(p&&inside(p,w.root)){if(!inside(p,excluded))rows.push({path:p,endpoint:this.endpoint(w,p,"folder")});if(p===w.root)break;p=parent(p);}rows.push({path:null,endpoint:{ownerId:this.db.ownerId(w.owner),context:null}});return rows;}
 completion(intent,extra={}){const fallbacks={},destinations={};intent.mappings.forEach((m,i)=>{const candidate=m.ancestors?.find(a=>a.path===null||folder(this.exact(a.path)));fallbacks[i]=candidate?.endpoint??m.fallback;if(intent.kind==="trash")destinations[i]=fallbacks[i];});return{phase:"filesystem-complete",fallbacks,destinations,...extra};}
 async progress(operationId,progress){return this.db.request({action:"progress",operationId,progress});}
 async execute(kind,from,to=null,options={}){return this.enqueue(async()=>{
  await this.recoverInside();await this.db.refresh?.();const operationId=options.operationId??randomUUID(),requestHash=digest(JSON.stringify([kind,from,to??null,!!options.workspaceRename,!!options.workspaceDelete]));
  const old=await this.db.receipt(operationId);if(old){if(!old.fileOperation||old.requestHash!==requestHash)fail("Operation identity was reused.","OPERATION_ID_CONFLICT");if(old.cancelled)fail("This operation was cancelled. Start a new operation.","FILE_OPERATION_CANCELLED");if(old.partial)fail("The previous operation completed only partly. Review retained files.","FILE_OPERATION_PARTIAL");return old;}
  const intent=await this.plan(kind,from,to,options,requestHash);await this.db.request({action:"prepare",operationId,intent});await this.boundary?.("prepared",operationId);
  let apiSettled=false;
  try{
   if(!this.exact(from)&&options.captureRecoveryHash&&await this.matches(to,intent.manifest)){
    await this.progress(operationId,this.completion(intent));const result=await this.db.request({action:"commit",operationId});await this.afterCommit(result);return result;
   }
   if(!await this.matches(from,intent.manifest))fail("The source changed during preparation. No filesystem action was started.");
   await this.progress(operationId,{phase:"started"});await this.boundary?.("started",operationId);
   const source=this.vault.getAbstractFileByPath(from);
   try {
    if(kind==="trash")await(options.performTrash?options.performTrash(source):this.app.fileManager.trashFile(source));
    else if(kind==="copy")await this.copyManifest(operationId,intent);
    else await this.app.fileManager.renameFile(source,to);
   } finally { apiSettled=true; }
   await this.boundary?.("mutated",operationId);
   if(kind==="trash"){
    if(this.exact(from))fail("Deletion was not completed. Retained files will be checked.");
    await this.progress(operationId,this.completion(intent));
   }else{
    if(kind!=="copy"&&this.exact(from))fail("The original path still exists. Review the filesystem result.");
    const result=await this.manifest(to);
    if(result.length!==intent.manifest.length||result.some((r,i)=>r.relative!==intent.manifest[i].relative||r.type!==intent.manifest[i].type))fail("The destination differs from the prepared subtree.");
    await this.progress(operationId,this.completion(intent,{result}));
   }
   await this.boundary?.("verified",operationId);const result=await this.db.request({action:"commit",operationId});await this.afterCommit(result);return result;
  }catch(error){
   // The original ID remains the only retry identity. Reconcile known results;
   // never compensate by deleting a destination or replaying an uncertain trash.
   if(apiSettled){const pending=(await this.db.request({action:"list"}).catch(()=>[]))[0];if(pending?.operationId===operationId&&pending.progress.phase==="started")await this.progress(operationId,{phase:"started",apiSettled:true}).catch(()=>{});}
   const receipt=await this.db.receipt(operationId).catch(()=>null);if(receipt&&!receipt.cancelled&&!receipt.partial){await this.afterCommit(receipt);return receipt;}
   try{await this.recoverInside();const resolved=await this.db.receipt(operationId);if(resolved&&!resolved.cancelled&&!resolved.partial){await this.afterCommit(resolved);return resolved;}}catch(recovery){error.recovery=recovery.message;error.code=recovery.code??error.code;}
   error.operationId=operationId;error.message+=(error.recovery?(error.code==="FILE_OPERATION_PARTIAL"?" ":" Recovery required: ")+error.recovery:"");throw error;
  }
 });}
 async afterCommit(result){
  try{await this.db.refresh?.();}catch(error){this.plugin.fileOperationNotice?.("Files and native tasks were committed locally, but their views could not refresh: "+error.message);}
  return result;
 }
 async copyManifest(operationId,intent,progress={}){
  let writes=progress.writes??[];
  for(const row of intent.manifest){const target=row.relative?intent.to+"/"+row.relative:intent.to,existing=this.vault.getAbstractFileByPath(target);
   if(existing){if(!writes.includes(row.relative))fail("Competing destination data was found; the partial copy is retained.");if(row.type==="folder"?!folder(existing):folder(existing)||digest(await this.vault.readBinary(existing))!==row.hash)fail("A partial copy changed; review is required.");continue;}
   // Journal the next write before calling Vault. The preflight proved absence;
   // matching bytes are evidence of this intended copy after an interruption.
   writes=[...writes,row.relative];await this.progress(operationId,{phase:"started",writes});
   if(row.type==="folder")await this.vault.createFolder(target);else{const sourcePath=row.relative?intent.from+"/"+row.relative:intent.from,source=this.vault.getAbstractFileByPath(sourcePath);if(!source||digest(await this.vault.readBinary(source))!==row.hash)fail("The copy source changed. Partial results are retained.");await this.vault.copy(source,target);}
   await this.boundary?.("copyItem",operationId);
  }
 }
 async recoverInside(){
  const pending=await this.db.request({action:"list"});if(!pending.length)return[];const p=pending[0],{intent,operationId,progress}=p;
  if(progress.phase==="filesystem-complete"){await this.progress(operationId,this.completion(intent));const result=await this.db.request({action:"commit",operationId});await this.afterCommit(result);return[result];}
  if(progress.phase==="prepared"){return[await this.db.request({action:"cancel",operationId})];}
  if(progress.phase==="review")fail(progress.message??"An interrupted file operation needs review.","FILE_OPERATION_UNRESOLVED");
  const source=this.exact(intent.from),destination=intent.to?this.exact(intent.to):null;
  if(intent.kind==="copy"){
   // Resuming a partial copy is allowed only while all original bytes agree.
   if(await this.matches(intent.from,intent.manifest)){
    try{await this.copyManifest(operationId,intent,progress);if(!await this.matches(intent.to,intent.manifest))fail("The copied subtree differs from its source.");await this.progress(operationId,this.completion(intent));return this.recoverInside();}catch(error){await this.progress(operationId,{phase:"review",message:error.message});throw error;}
   }
  }else if(intent.kind==="trash"){
   const missing=intent.mappings.map((m,i)=>this.exact(m.path)?-1:i).filter(i=>i>=0);
   if(!source||missing.length){
    // No second destructive call: reassign only contexts whose original paths
    // disappeared, then surface partial completion to the initiating batch.

    await this.progress(operationId,this.completion(intent,{...(source?{indices:missing}:{}),partial:!!source}));const result=await this.db.request({action:"commit",operationId});await this.afterCommit(result);if(source)fail("Deletion completed partly. Retained files were preserved; removed locations were reassigned.","FILE_OPERATION_PARTIAL");return[result];
   }
   if(progress.apiSettled&&await this.matches(intent.from,intent.manifest)){await this.progress(operationId,{phase:"started",cancelSafe:true});return[await this.db.request({action:"cancel",operationId})];}
  }else{
   if(!source&&destination&&await this.matches(intent.to,intent.manifest)){await this.progress(operationId,this.completion(intent));return this.recoverInside();}
   if(progress.apiSettled&&source&&!destination&&await this.matches(intent.from,intent.manifest)){await this.progress(operationId,{phase:"started",cancelSafe:true});return[await this.db.request({action:"cancel",operationId})];}
  }
  const message="Filesystem evidence is ambiguous for "+intent.kind+" "+intent.from+". Files are preserved; affected tasks remain protected. Review the pending operation before continuing.";
  await this.progress(operationId,{phase:"review",message});fail(message,"FILE_OPERATION_UNRESOLVED");
 }
 recover(){return this.enqueue(()=>this.recoverInside());}
 list(){return this.db.request({action:"list"});}
 // Review is explicit and evidence checked. It cannot overwrite or remove data.
 resolve(decision="recheck"){return this.enqueue(async()=>{
  const p=(await this.list())[0];if(!p)return[];
  if(decision==="keep-copy"){
   if(p.intent.kind!=="copy"||p.progress.phase!=="review")fail("Only a reviewed partial copy can be kept this way.");
   await this.progress(p.operationId,{phase:"review",cancelSafe:true});return[await this.db.request({action:"cancel",operationId:p.operationId})];
  }
  if(decision==="keep-source"){
   if(p.progress.phase!=="review")fail("Inspect this operation in recovery before choosing a retained source.");
   if(!["rename","move"].includes(p.intent.kind)||!await this.matches(p.intent.from,p.intent.manifest))fail("The original source evidence does not match. All files remain preserved.");
   await this.progress(p.operationId,{phase:"review",cancelSafe:true});return[await this.db.request({action:"cancel",operationId:p.operationId})];
  }
  if(decision==="use-destination"){
   if(p.progress.phase!=="review")fail("Inspect this operation in recovery before confirming a destination.");
   if(!["rename","move"].includes(p.intent.kind)||this.exact(p.intent.from))fail("Confirm a moved destination only after the original source is absent.");
   const result=await this.manifest(p.intent.to);
   if(result.length!==p.intent.manifest.length||result.some((r,i)=>r.relative!==p.intent.manifest[i].relative||r.type!==p.intent.manifest[i].type))fail("Destination names or types differ from the original subtree. All files remain preserved.");
   await this.progress(p.operationId,this.completion(p.intent,{result,userReviewed:true}));return this.recoverInside();
  }
  if(decision!=="recheck")fail("Unknown recovery decision.");
  if(p.progress.phase==="review")await this.progress(p.operationId,{phase:"started",message:"Review requested",apiSettled:true});return this.recoverInside();
 });}

 async captureMove(captureId,move,reverse=false){
  await this.recover();let cycle=0;
  const identity=(direction,n)=>stable(["capture-files",captureId,move.from,move.to,direction,n]);
  while(await this.db.receipt(identity("reverse",cycle)))cycle++;
  if(reverse&&!await this.db.receipt(identity("forward",cycle))&&!this.exact(move.to))return;
  return this.move(reverse?move.to:move.from,reverse?move.from:move.to,{operationId:identity(reverse?"reverse":"forward",cycle),captureRecoveryHash:move.hash,compensation:reverse,...(reverse?{compensationReceiptId:identity("forward",cycle)}:{})});
 }
 rename(from,to,options){return this.execute("rename",from,to,options);}
 move(from,to,options){return this.execute("move",from,to,options);}
 trash(from,options){return this.execute("trash",from,null,options);}
 copy(from,to,options){return this.execute("copy",from,to,options);}
 setClipboard(paths,cut=false){this.clipboard={id:randomUUID(),paths:normalize(paths),cut};return this.db.request({action:"clipboardSet",value:this.clipboard});}
 clipboardState(){return this.clipboard;}
 async batch(kind,paths,destination=null,options={}){
  const roots=normalize(paths),all=this.workspaces(),targets=roots.map(from=>({from,to:destination?destination+"/"+name(from):null}));
  const keys=new Set();for(const item of targets){this.preflight(kind,item.from,item.to,options,all);const key=item.to?.toLocaleLowerCase();if(key&&keys.has(key))fail("The batch contains duplicate destination names.");if(key)keys.add(key);}
  const completed=[];for(let i=0;i<targets.length;i++){const item=targets[i];try{await this.execute(kind,item.from,item.to,options);completed.push(item.from);if(this.clipboard?.cut){this.clipboard.paths=this.clipboard.paths.filter(p=>p!==item.from);const latest=await this.db.request({action:"clipboardGet"});if(latest?.id===this.clipboard.id)await this.db.request({action:"clipboardSet",value:this.clipboard});}}catch(error){error.completed=completed;error.pending=item.from;error.untouched=targets.slice(i+1).map(x=>x.from);error.message+=` Completed: ${completed.length}; pending: ${item.from}; untouched: ${error.untouched.length}.`;throw error;}}return{completed};
 }
 async paste(destination,options={}){const value=await this.db.request({action:"clipboardGet"});this.clipboard=value;if(!value?.paths.length)fail("The Itacan clipboard is empty.");return this.batch(value.cut?"move":"copy",[...value.paths],destination,options);}
 close(){this.stopped=true;return this.tail.catch(()=>{});}
}
module.exports={FileOperations,normalize,validPath,stable};
