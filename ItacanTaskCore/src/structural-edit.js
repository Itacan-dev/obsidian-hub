"use strict";
// One narrow command implementation inside the existing task transaction.
const {check,fail}=require("./errors"),{fields,uuid,canonical,clone}=require("./value");
const {setContentIntent,contentOf}=require("./source-content");
const record=(v,n)=>fields(v,n,n);
async function applyStructuralEdit({task,payload,now,reserve,fault}){
    record(payload,["version","draft","deletions","taskPatch","content"]);if(payload.version!==1)fail("UNSUPPORTED_SCHEMA","Unsupported structural edit version.");
    const draft=payload.draft;record(draft,["version","taskId","expectedRevision","steps"]);if(draft.version!==1)fail("UNSUPPORTED_SCHEMA","Unsupported Step draft version.");
    check(draft.taskId===task.id&&draft.expectedRevision===task.revision,"Draft parent task/revision differs from command.");check(Array.isArray(draft.steps)&&Array.isArray(payload.deletions),"Explicit full hierarchy/deletions required.");
    fields(payload.taskPatch,["title","description"]);await fault?.("beforeDraftNormalization");
    const before=clone(task),old=new Map(task.steps.map(s=>[s.id,s])),removed=new Set();
    for(const deletion of payload.deletions){
        record(deletion,["stepId","cascade","descendantIds"]);uuid(deletion.stepId);check(old.has(deletion.stepId)&&typeof deletion.cascade==="boolean"&&Array.isArray(deletion.descendantIds),"Invalid explicit deletion.");
        const subtree=new Set([deletion.stepId]);let grew=true;while(grew){grew=false;for(const s of task.steps)if(subtree.has(s.parentStepId)&&!subtree.has(s.id)){subtree.add(s.id);grew=true;}}
        const descendants=[...subtree].filter(id=>id!==deletion.stepId).sort();check(canonical([...deletion.descendantIds].sort())===canonical(descendants),"Confirmed descendant set changed.");
        check(descendants.length===0||deletion.cascade===true,"Deleting a parent Step requires explicit cascade.");for(const id of subtree){check(!removed.has(id),"Overlapping or duplicate subtree deletions.");removed.add(id);}
    }
    const seen=new Set(),groups=new Map(),bodies=[],steps=[];
    for(const d of draft.steps){
        record(d,["state","id","parentStepId","order","title","body","completed"]);check(["existing","new"].includes(d.state),"Explicit new/existing Step intent required.");uuid(d.id);if(d.parentStepId!==null)uuid(d.parentStepId);
        check(Number.isSafeInteger(d.order)&&d.order>=0&&typeof d.body==="string"&&typeof d.completed==="boolean","Invalid Step order/content/completion.");check(!seen.has(d.id)&&!removed.has(d.id),"Duplicate/explicitly removed Step in draft.");seen.add(d.id);
        let s;if(d.state==="existing"){const previous=old.get(d.id);check(!!previous,"Existing Step is missing or belongs to another task.");check(d.completed===previous.completed,"Structural edits cannot change completion; use the existing completion command.");s={...clone(previous),parentStepId:d.parentStepId,order:d.order,title:d.title};
            const oldBody=contentOf(before)?.revisions.at(-1)?.current.stepBodies.find(b=>b.id===s.id)?.body??"";if(canonical(s)!==canonical(previous)||oldBody!==d.body)s.modifiedAt=now;
        }else{check(d.completed===false,"Structural creation cannot synthesize a completion event.");reserve(d.id);s={id:d.id,taskId:task.id,parentStepId:d.parentStepId,order:d.order,title:d.title,completed:false,completedAt:null,createdAt:now,modifiedAt:now};}
        steps.push(s);bodies.push({id:d.id,body:d.body});const orders=groups.get(d.parentStepId)??[];orders.push(d.order);groups.set(d.parentStepId,orders);
    }
    for(const s of before.steps)check(seen.has(s.id)||removed.has(s.id),"Omission is not deletion; every existing Step needs an explicit disposition.");
    for(const orders of groups.values())check(canonical([...orders].sort((a,b)=>a-b))===canonical(orders.map((_,i)=>i)),"Draft sibling order must be exactly zero through n-1.");
    await fault?.("beforeHierarchyValidation");task.steps=steps;Object.assign(task,clone(payload.taskPatch));
    // Reuse the core's actual hierarchy/title/cycle validation, before touching evidence.
    require("./domain").validateSteps(task.steps,task.id);
    const ordered=[];const visit=parent=>{for(const s of steps.filter(s=>s.parentStepId===parent).sort((a,b)=>a.order-b.order)){ordered.push(s);visit(s.id);}};visit(null);task.steps=ordered;
    await fault?.("beforeSourceEnvelopeAttachment");const current=setContentIntent(task,before,payload.content,ordered.map(s=>bodies.find(b=>b.id===s.id)));await fault?.("afterContentStaging");
    return{removed,current};
}
module.exports={applyStructuralEdit};
