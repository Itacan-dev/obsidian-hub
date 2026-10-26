"use strict";
const { randomUUID, createHash } = require("node:crypto");
const B = require("../../../../../ItacanTaskCore/product-ui/bridge.cjs");
const { canonical } = require("../../../../../ItacanTaskCore/src/value");
const { taskFormValues } = require("../domain/task-form");
const { taskTitle } = require("../domain/inbox");
const { taskWorkspaces } = require("./task-locations");
const { createNativeTaskLocations } = require("./native-task-locations");
const hash = value => createHash("sha256").update(canonical(value)).digest("hex");
const workspaceId = w => w.contextKind === "resource" ? "resource:" + (w.resourceType ?? w.id) : w.projectId;
const ownerOf = w => w.contextKind === "resource" ? {type:"resource",id:w.resourceType ?? w.id} : {type:"project",id:w.projectId};
function workspaces(service) { return taskWorkspaces(service.plugin).map(w=>({...w,id:workspaceId(w)})); }
function sourceDestination(service, source = {}) {
    const physical = source.path && service.plugin.projectWizard.getContextForPath(source.path);
    const workspace = workspaces(service).find(w=>w.id === (physical ? workspaceId(physical) : source.workspaceId));
    if (!workspace) return {};
    let location = workspace.root;
    const file = source.path && service.app.vault.getAbstractFileByPath(source.path);
    if (file && source.path !== workspace.path && (source.path === workspace.root || source.path.startsWith(workspace.root + "/"))) location = Array.isArray(file.children) ? file.path : file.parent?.path ?? workspace.root;
    return {workspaceId:workspace.id,location};
}
function draft(service, values = {}, capture = {}) {
    const text = String(values.text ?? capture.text ?? ""), lines = text.split(/\r?\n/), first = lines.findIndex(l=>l.trim());
    const title = values.taskTitle ?? taskTitle(text), description = values.description ?? (first < 0 ? "" : lines.slice(first+1).join("\n"));
    const initial=sourceDestination(service,capture.source ?? values.source);if(values.workspaceId && initial.workspaceId!==values.workspaceId)delete initial.location;return {...initial,...values,text,taskTitle:title,description};
}
function payload(service, values, capture) {
    const v=draft(service,values,capture),w=workspaces(service).find(w=>w.id===v.workspaceId);
    if(!w)throw Error("Choose an available task workspace.");
    const owner=ownerOf(w),host=service.plugin.nativeTaskHost;
    if(!host?.matches(owner))throw Error("Native task authority is unavailable. Markdown fallback is disabled.");
    const status=host.status?.(),states=status?.owners??(status?[status]:[]);
    if(states.length && !states.some(s=>s.owner?.type===owner.type&&s.owner.id===owner.id&&s.state==='ready'))throw Error("Native task workspace is initializing or unavailable.");
    if(service.plugin.oath?.canOpen(w)===false)throw Error("This workspace is unavailable during your Oath.");
    if(v.attachments?.length || capture?.attachments?.length)throw Error("Files cannot be converted to native task attachments. Organize the files as a note or move them.");
    if(v.phaseId || v.milestoneId || v.recurrence || v.steps?.some(s=>s.parentStepId != null))throw Error("Recorded Phase, recurrence or nested-Step details require review; native capture does not support them.");
    const fields=taskFormValues({...v,text:v.taskTitle}),locations=createNativeTaskLocations(service.plugin);
    let location=null;
    if(Object.hasOwn(v,"nativeLocation")) {
        if(v.nativeLocation) { const selected=locations.resolveId(owner,v.nativeLocation);if(!selected)throw Error("Saved task location is unavailable. Choose a replacement.");location=selected.reference; }
    } else if(v.location) {
        const file=service.app.vault.getAbstractFileByPath(v.location);
        if(!file)throw Error("Saved task location is unavailable. Choose a replacement.");
        location=locations.select(owner,v.location,Array.isArray(file.children)?"folder":"note").reference;
    }
    const data={text:fields.text,description:v.description ?? "",necessity:fields.necessity ?? null,fromDate:fields.fromDate ?? null,fromTime:fields.fromTime ?? null,dueDate:fields.dueDate ?? null,dueTime:fields.dueTime ?? null,completed:!!v.completed,steps:fields.steps.map(s=>({text:s.text,completed:!!s.completed,...(Object.hasOwn(s,"completedAt")?{completedAt:s.completedAt}:{})}))};
    if(Object.hasOwn(v,"completedAt"))data.completedAt=v.completedAt;
    return {workspace:w,owner,location,data};
}
function operationId(operation) { if(!/^native-op:[0-9a-f-]{36}$/i.test(operation?.requestKey ?? ""))throw Error("Native capture request evidence is invalid.");return operation.requestKey.slice(10); }
function sameValues(operation, values) {
    if(values.type && values.type!=="task" || values.workspaceId!==undefined && values.workspaceId!==operation.workspaceId)throw Error("Retry the original native task operation before changing its destination.");
    for(const key of ["description","necessity","fromDate","fromTime","dueDate","dueTime","steps","completed","completedAt"])if(values[key]!==undefined&&canonical(values[key]??null)!==canonical(operation.values[key]??null))throw Error("Retry this task's original saved details.");
    if(values.taskTitle!==undefined&&values.taskTitle!==operation.values.text || values.nativeLocation!==undefined&&values.nativeLocation!==(operation.location?.id??""))throw Error("Retry this task's original title and location.");
}
function validateLink(service, operation) {
    const owner=JSON.parse(operation.ownerKey),w=workspaces(service).find(w=>w.id===operation.workspaceId);
    if(!w||canonical(ownerOf(w))!==canonical(owner)||hash({owner,location:operation.location,data:operation.values})!==operation.fingerprint)throw Error("Native capture operation binding is invalid.");
    operationId(operation);return owner;
}
function validateRetained(operation, retained) {
    const i=retained.intent,d=i.action?.draft,v=operation.values;
    if(i.operationId!==operationId(operation)||i.action?.kind!=="rich-create"||canonical(i.owner)!==canonical(JSON.parse(operation.ownerKey))||!d)throw Error("Native capture retained operation differs.");
    const m=d.metadata,initial=v=>v.completed?{completed:true,...(Object.hasOwn(v,"completedAt")?{completedAt:v.completedAt}:{})}:{completed:false,completedAt:null};
    if(m.title!==v.text||m.description!==v.description||m.importance!==v.necessity||canonical(m.location)!==canonical(operation.location)||canonical(m.start)!==canonical(v.fromDate?{date:v.fromDate,time:v.fromTime}:null)||canonical(m.due)!==canonical(v.dueDate?{date:v.dueDate,time:v.dueTime}:null)||m.phase!==null||d.continuation!==""||canonical(d.initial)!==canonical(initial(v))||d.steps.length!==v.steps.length)throw Error("Native capture retained task evidence differs.");
    for(let n=0;n<d.steps.length;n++)if(d.steps[n].title!==v.steps[n].text||canonical(d.steps[n].initial)!==canonical(initial(v.steps[n]))||d.steps[n].parentStepId!==null||d.steps[n].body!==""||d.steps[n].order!==n)throw Error("Native capture retained Step evidence differs.");
}
async function submit(service, values, captureId, attempt = {}) {
    let capture=captureId?service.required(captureId):null,operation=capture?.operation;
    try {
        if(operation && operation.kind!=="native-task")throw Error("This item retains an earlier saved operation. Review that operation before choosing a new authority.");
        let p;
        if(operation){service.assertInput(capture,values);sameValues(operation,values);p={owner:validateLink(service,operation),location:operation.location,data:operation.values};}
        else {
            p=payload(service,values,capture ?? {});
            const fingerprint=hash({owner:p.owner,location:p.location,data:p.data});
            if(attempt.operation && attempt.operation.fingerprint!==fingerprint)throw Error("Keep the original native request until its outcome is reviewed.");
            operation=attempt.operation ?? {kind:"native-task",state:"reserved",requestKey:"native-op:"+randomUUID(),ownerKey:JSON.stringify(p.owner),workspaceId:p.workspace.id,location:p.location,values:p.data,fingerprint,...(capture?{input:service.input(capture,values)}:{})};
            if(capture){capture=await service.prepareCapture(capture,{...values,type:"task"});operation.input=service.input(capture,values);capture=await service.replace({...capture,operation});}
            else attempt.operation=operation;
        }
        // A matching authoritative receipt wins even if Inbox cleanup changed
        // application evidence or its acknowledgement was interrupted.
        if(capture?.operation){
            const runtime=service.plugin.nativeTaskHost.runtime(p.owner),id=operationId(operation);
            let held=null;try{held=await runtime.getRetained(id)}catch(e){if(e.code!=="ENOENT")throw e}
            if(held){validateRetained(operation,held);const review=await runtime.recovery.inspect(id);
                if(["confirmed-committed","committed-refresh-unavailable"].includes(review.classification)){await service.finish(capture);service.scheduleNativeRefresh();return{backend:"native",taskId:held.intent.action.draft.id,operationId:id,reconciled:true,message:"Task created."};}}
        }
        // A new Inbox reservation changes the immutable session policy. Drain
        // and reopen through the production host; do not regenerate old guards.
        await service.refreshNativeInventory(p.owner);
        const runtime=service.plugin.nativeTaskHost.runtime(p.owner),id=operationId(operation);
        let retained=null;try{retained=await runtime.getRetained(id)}catch(e){if(e.code!=="ENOENT")throw e}
        let result,taskId;
        if(retained){
            validateRetained(operation,retained);
            const review=await runtime.recovery.inspect(id);
            taskId=retained.intent.action.draft.id;
            if(["confirmed-committed","committed-refresh-unavailable"].includes(review.classification))result={status:"committed",receipt:review.receipt,operationId:id};
            else result=await runtime.mutate(retained.intent);
        } else {
            if(attempt.intent && attempt.intent.operationId!==id)throw Error("Native request identity changed.");
            const intent=attempt.intent ?? B.create(await runtime.creationContext(),p.data,id);
            if(!intent.action.draft.id)intent.action.draft.id=randomUUID();intent.action.draft.metadata.location=p.location;
            attempt.intent=intent;taskId=intent.action.draft.id;result=await runtime.mutate(intent);
        }
        if(!["committed","replayed"].includes(result.status))throw Error("Native task outcome requires review ("+(result.code??result.status)+"). Original request retained: "+id);
        if(result.receipt?.operationId!==id)throw Error("Native task receipt identity differs.");
        if(capture)await service.finish(capture);
        // Cleanup is no longer an outcome authority. A subsequent refresh error
        // must never turn a known committed task into another creation request.
        service.scheduleNativeRefresh();
        return {backend:"native",taskId,operationId:id,message:"Task created."};
    }catch(error){if(capture)error.captureId=capture.id;throw error;}
}
module.exports={workspaces,ownerOf,sourceDestination,draft,payload,sameValues,submit};
