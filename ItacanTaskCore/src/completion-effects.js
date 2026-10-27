"use strict";
// Portable evidence interpretation only. Never mutates state or completes work.
const V = require("./value"), C = require("./source-content"), { check, fail } = require("./errors");
const isAtomic = type => type === "task.save" || type === "task.createRich";
const same = (a, b) => V.canonical(a) === V.canonical(b), hash = v => C.sha256(V.canonical(v));
function ordered(steps) {
 const groups = new Map(); for (const s of steps) { const list = groups.get(s.parentStepId) ?? []; list.push(s); groups.set(s.parentStepId, list); }
 const out = [], seen = new Set(); const visit = parent => { for (const s of (groups.get(parent) ?? []).sort((a,b) => a.order-b.order)) { check(!seen.has(s.id), "Cyclic or duplicate Step hierarchy."); seen.add(s.id); out.push(s); visit(s.id); } }; visit(null); check(out.length === steps.length, "Unreachable Step hierarchy."); return out;
}
const contentRevision = task => C.contentOf(task)?.revisions.length ?? 0;
function bindingsFor(state, task) { return [null, ...ordered(task.steps).map(s=>s.id)].map(stepId => ({ stepId, eventId: state.bindings.find(b=>b.taskId===task.id && b.stepId===stepId)?.eventId ?? null })); }
function taskIn(receipt, id) { return receipt.result.tasks.find(t=>t.id===id) ?? (receipt.result.task?.id===id ? receipt.result.task : null); }
function priorTask(state, id, revision) { return state.receipts.filter(r=>r.result.repositoryRevision<revision).sort((a,b)=>b.result.repositoryRevision-a.result.repositoryRevision).map(r=>taskIn(r,id)).find(Boolean) ?? null; }
function creationKind(receipt, event) {
 if (!receipt || !receipt.result.change.eventIds.includes(event.id) || receipt.operationId!==event.operationId) return null;
 const c=JSON.parse(receipt.payload), task=taskIn(receipt,event.taskId), target=event.stepId===null?task:task?.steps.find(s=>s.id===event.stepId);
 if (!target?.completed || target.completedAt!==event.timestamp || task.partitionId!==event.partitionId || !same(task.owner,event.ownerAtEvent)) return null;
 if (event.legacy?.format==="itacan-imported-history-ref") return c.type==="history.importBundle" && receipt.result.historyImport?.outcome.bindings.some(b=>b.eventId===event.id && b.taskId===event.taskId && b.stepId===event.stepId) ? "historical-import" : null;
 if (event.legacy!==null) return null;
 if (isAtomic(c.type)) { const e=receipt.result.atomicTask?.effects.find(e=>e.eventId===event.id && e.taskId===event.taskId && e.stepId===event.stepId && ["initial","complete"].includes(e.transition)); return e?.origin ?? null; }
 if (c.type==="task.complete" && c.taskId===event.taskId && event.stepId===null && c.payload.completed===true) return "genuine-parent-completion";
 if (c.type==="step.complete" && c.taskId===event.taskId && c.payload.stepId===event.stepId && c.payload.completed===true) return "genuine-step-completion";
 if (c.type==="recurrence.complete" && c.taskId===event.taskId && event.stepId===null && receipt.result.recurrence?.completion?.completionEventId===event.id) return "recurrence-completion";
 if (["task.create","task.createMany"].includes(c.type)) { const inputs=(c.type==="task.create"?[c.payload.task]:c.payload.tasks).filter(i=>i.id===undefined || i.id===task.id);if(!receipt.result.change.taskIds.includes(task.id))return null;return event.stepId===null?inputs.some(i=>i.completed===true)?"initial-parent-completion":null:inputs.some(i=>i.steps?.some(s=>(s.id===undefined||s.id===event.stepId)&&s.completed===true))?"initial-step-completion":null; }
 if(c.type==="step.add"&&c.taskId===event.taskId&&event.stepId!==null&&(c.payload.step.id===undefined||c.payload.step.id===event.stepId)&&c.payload.step.completed===true)return "initial-step-completion";
 return null;
}
function bindingsAt(state, task, revision) {
 return [null,...ordered(task.steps).map(s=>s.id)].map(stepId=>{
  const target=stepId===null?task:task.steps.find(s=>s.id===stepId);if(!target.completed)return{stepId,eventId:null};
  const candidates=state.history.filter(e=>e.taskId===task.id&&e.stepId===stepId&&e.timestamp===target.completedAt).map(e=>({e,r:state.receipts.find(r=>r.operationId===e.operationId)})).filter(x=>x.r?.result.repositoryRevision<=revision&&creationKind(x.r,x.e)).sort((a,b)=>b.r.result.repositoryRevision-a.r.result.repositoryRevision);
  check(candidates.length>0,"Completed historical snapshot lacks a proven creation binding.");return{stepId,eventId:candidates[0].e.id};
 });
}
function effectState(task,stepId,bindings) { const target=stepId===null?task:task.steps.find(s=>s.id===stepId),eventId=bindings.find(b=>b.stepId===stepId)?.eventId??null;check(target,"Effect target is missing.");check(target.completed ? eventId!==null : eventId===null,"Effect completion/binding disagreement.");return{completed:target.completed,completedAt:target.completedAt,binding:eventId===null?null:{taskId:task.id,stepId,eventId}}; }
function describe(state,command,before,beforeBindings,after,afterBindings) {
 const effects=[],append=(stepId,transition,origin,eventId,old,next)=>effects.push({version:1,index:effects.length,taskId:after.id,stepId,transition,origin,eventId,before:old,after:next});
 if(before)for(const s of ordered(before.steps))if(!after.steps.some(n=>n.id===s.id)){const old=effectState(before,s.id,beforeBindings);append(s.id,"detach","deletion-detachment",old.binding?.eventId??null,old,null);}
 const steps=ordered(after.steps),intentFor=stepId=>stepId===null?command.payload.draft.parentCompletion:command.payload.draft.steps.find(s=>s.id===stepId)?.completion;
 if(before)for(const stepId of[null,...steps.filter(s=>before.steps.some(b=>b.id===s.id)).map(s=>s.id)])if(intentFor(stepId)?.kind==="reopen"){const old=effectState(before,stepId,beforeBindings);append(stepId,"reopen","reopening",old.binding.eventId,old,effectState(after,stepId,afterBindings));}
 for(const stepId of[null,...steps.map(s=>s.id)]){
  const initial=!before || stepId!==null&&!before.steps.some(s=>s.id===stepId),target=stepId===null?after:steps.find(s=>s.id===stepId);
  if(initial ? target.completed : intentFor(stepId)?.kind==="complete") {const next=effectState(after,stepId,afterBindings);append(stepId,initial?"initial":"complete",initial?stepId===null?"initial-parent-completion":"initial-step-completion":stepId===null?"genuine-parent-completion":"genuine-step-completion",next.binding.eventId,initial?null:effectState(before,stepId,beforeBindings),next);}
 }
 const descriptor={version:1,kind:before?"save":"initialize",taskId:after.id,changed:!before||!same(before,after),before:before?{taskRevision:before.revision,contentRevision:contentRevision(before),taskDigest:hash(before),treeDigest:hash(before.steps),bindingsDigest:hash(beforeBindings)}:null,after:{taskRevision:after.revision,contentRevision:contentRevision(after),taskDigest:hash(after)},retainedStepIds:before?steps.filter(s=>before.steps.some(b=>b.id===s.id)).map(s=>s.id):[],insertedStepIds:steps.filter(s=>!before?.steps.some(b=>b.id===s.id)).map(s=>s.id),retiredStepIds:before?ordered(before.steps).filter(s=>!after.steps.some(n=>n.id===s.id)).map(s=>s.id):[],effects,digest:null};descriptor.digest=hash(descriptor);return descriptor;
}
function transitionMatches(before,after,intent,clock) { check(before&&after,"Missing retained completion target.");if(intent.kind==="keep")check(before.completed===after.completed&&before.completedAt===after.completedAt,"Keep changed completion evidence.");else if(intent.kind==="complete")check(!before.completed&&after.completed&&after.completedAt===(intent.completedAt===undefined?clock:intent.completedAt),"Invalid genuine completion transition.");else check(intent.kind==="reopen"&&before.completed&&!after.completed&&after.completedAt===null,"Invalid reopening transition."); }
function initialMatches(target,initial,clock) { check(target.completed===initial.completed&&target.completedAt===(initial.completed?(initial.completedAt===undefined?clock:initial.completedAt):null),"Invalid initial completion state."); }
function validateReceipt(state,receipt) {
 if(state.personalShared)return require("./personal-shared").atomicReceipt(state,receipt);
 if(state.gitShared)return require("./git-shared").atomicReceipt(state,receipt);
 const command=JSON.parse(receipt.payload),d=receipt.result.atomicTask;check(isAtomic(command.type),"Atomic descriptor on an unrelated command.");require("./atomic-task").validateCommand(command);
 const after=receipt.result.task;check(after&&after.id===d?.taskId,"Missing atomic result task.");const before=command.type==="task.save"?priorTask(state,command.taskId,receipt.result.repositoryRevision):null;
 check(command.type!=="task.save"||before,"Atomic Save has no original committed task snapshot.");
 const beforeBindings=before?bindingsAt(state,before,receipt.result.repositoryRevision-1):[],afterBindings=bindingsAt(state,after,receipt.result.repositoryRevision),expected=describe(state,command,before,beforeBindings,after,afterBindings);
 check(same(d,expected),"Atomic receipt effects disagree with authoritative creation relationships.");
 const p=command.payload, draft=p.draft;check(p.scope.authorityId===state.storeId&&command.expectedRepositoryRevision===receipt.result.repositoryRevision-1&&receipt.result.change.partitions.length===1&&receipt.result.change.partitions[0].revision===p.scope.expectedPartitionRevision+1,"Atomic receipt publication guards mismatch.");check(after.partitionId===p.scope.partitionId&&same(after.owner,p.scope.owner),"Atomic receipt owner/partition mismatch.");
 for(const key of Object.keys(draft.metadata))check(same(after[key],draft.metadata[key]),"Atomic receipt metadata differs from complete draft.");
 const current=C.contentOf(after)?.revisions.at(-1).current;
 check((current?.continuation??"")===draft.continuation,"Atomic current continuation mismatch.");
 check(after.steps.length===draft.steps.length,"Atomic Step set mismatch.");
 for(const input of draft.steps){const s=input.id===undefined?after.steps.find(s=>s.parentStepId===input.parentStepId&&s.order===input.order):after.steps.find(s=>s.id===input.id);check(s&&s.parentStepId===input.parentStepId&&s.order===input.order&&s.title===input.title&&(current?.stepBodies.find(b=>b.id===s.id)?.body??"")===input.body,"Atomic Step content/hierarchy mismatch.");if(input.state==="existing"){const old=before.steps.find(b=>b.id===s.id);transitionMatches(old,s,input.completion,after.modifiedAt);check(s.createdAt===old.createdAt&&(s.modifiedAt===old.modifiedAt||s.modifiedAt===after.modifiedAt),"Retained Step source clocks changed.");}else{initialMatches(s,input.initial,after.modifiedAt);check(s.createdAt===after.modifiedAt&&s.modifiedAt===after.modifiedAt,"Inserted Step clocks must be fresh.");}}
 if(before){check(before.revision===command.expectedRevision&&same(before.owner,after.owner)&&before.partitionId===after.partitionId,"Save target/revision changed.");check(p.expectedContentRevision===contentRevision(before)&&p.expectedTreeDigest===hash(before.steps)&&same(p.expectedBindings,beforeBindings),"Save receipt guards do not describe its authoritative before-state.");transitionMatches(before,after,draft.parentCompletion,after.modifiedAt);check(after.revision===before.revision+(d.changed?1:0),"Save task revision advanced incorrectly.");check(after.createdAt===before.createdAt&&after.archivedAt===before.archivedAt&&after.deletedAt===before.deletedAt&&same(after.captureSource,before.captureSource),"Save rewrote lifecycle/provenance.");if(before.migration)for(const key of["source","sourceId","importedAt"])check(same(before.migration[key],after.migration?.[key]),"Save rewrote migration attribution.");const old=C.contentOf(before),next=C.contentOf(after);if(d.changed){check(next&&contentRevision(after)===contentRevision(before)+1,"Changed Save must finalize one content revision.");check(same(next.originals,old?.originals??[])&&same(next.previousEvidence,old?old.previousEvidence:before.migration?.evidence??null),"Save rewrote original source evidence.");}else check(same(before,after),"No-op Save changed task state.");}
 else {check(after.revision===1&&after.createdAt===after.modifiedAt&&after.archivedAt===null&&after.deletedAt===null&&after.captureSource===null,"Rich creation used historical lifecycle clocks.");check(draft.id===undefined||after.id===draft.id,"Rich creation changed explicit task identity.");initialMatches(after,draft.initial,after.modifiedAt);check(after.migration.source==="private-native-content-v1"&&after.migration.sourceId===after.id&&after.migration.importedAt===null,"Rich creation fabricated source attribution.");const c=C.contentOf(after);check(c&&c.originals.length===0&&c.previousEvidence===null&&c.revisions.length===1,"Rich creation fabricated original evidence.");}
 const creationIds=[],changedIds=[];
 for(const e of d.effects){
  check(e.stepId===null||after.steps.some(s=>s.id===e.stepId)||d.retiredStepIds.includes(e.stepId),"Foreign effect target.");
  if(e.transition==="detach"){check(state.retiredStepIds.includes(e.stepId),"Deleted Step identity was not retired.");continue;}
  const event=state.history.find(x=>x.id===e.eventId);check(event&&event.taskId===after.id&&event.stepId===e.stepId,"Effect event target mismatch.");changedIds.push(event.id);
  if(e.transition==="reopen"){check(event.counted===false&&event.reopenedAt===after.modifiedAt,"Reopening did not retain/uncount its original event.");continue;}
  creationIds.push(event.id);const target=e.stepId===null?after:after.steps.find(s=>s.id===e.stepId);check(event.operationId===receipt.operationId&&event.partitionId===after.partitionId&&same(event.ownerAtEvent,after.owner)&&event.kind===(e.stepId===null?"task":"step")&&event.timestamp===target.completedAt&&event.recordedAt===after.modifiedAt&&same(event.snapshot,{title:target.title,parentTitle:e.stepId===null?null:after.title})&&event.legacy===null,"Effect creation event/provenance mismatch.");check(same(event.workingContext,command.context?.workingContext??null)&&event.oathId===(command.context?.oathId??null)&&event.sessionId===(command.context?.sessionId??null),"Effect event context mismatch.");
 }
 check(same(receipt.result.change.eventIds,changedIds),"Atomic event order/membership mismatch.");check(same(state.history.filter(e=>e.operationId===receipt.operationId).map(e=>e.id),creationIds),"Atomic creation operation has omitted or extra events.");
 check(same(receipt.result.change.taskIds,d.changed?[after.id]:[])&&same(receipt.partitionIds,[after.partitionId]),"Atomic changed-task/partition membership mismatch.");
 return d;
}
function validateState(state) { const receipts=state.receipts.filter(r=>isAtomic(JSON.parse(r.payload).type));if(receipts.length){const ids=new Set(state.tasks.flatMap(t=>[t.id,...t.steps.map(s=>s.id)]).concat(state.retiredStepIds));check(state.history.every(e=>!ids.has(e.id)),"Atomic task/event identity namespaces overlap.");}for(const r of receipts.sort((a,b)=>a.result.repositoryRevision-b.result.repositoryRevision))validateReceipt(state,r); }
function selectedEffect(state,receipt,eventId) { if(!isAtomic(JSON.parse(receipt.payload).type))return null;const d=validateReceipt(state,receipt),e=d.effects.find(e=>e.eventId===eventId&&["initial","complete"].includes(e.transition));return e?{version:1,effectsDigest:d.digest,index:e.index,taskId:e.taskId,stepId:e.stepId,eventId:e.eventId,transition:e.transition,origin:e.origin}:null; }
function summary(task,d) { return{version:1,kind:d.kind,taskId:d.taskId,stepIds:ordered(task.steps).map(s=>s.id),createdEventIds:d.effects.filter(e=>["initial","complete"].includes(e.transition)).map(e=>e.eventId),reopenedEventIds:d.effects.filter(e=>e.transition==="reopen").map(e=>e.eventId),retiredStepIds:V.clone(d.retiredStepIds),effectsDigest:d.digest}; }
module.exports={isAtomic,same,hash,ordered,contentRevision,bindingsFor,bindingsAt,priorTask,creationKind,describe,validateReceipt,validateState,selectedEffect,summary};
