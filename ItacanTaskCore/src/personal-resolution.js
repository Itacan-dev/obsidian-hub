"use strict";
// Pure, graph-derived branch choice. No IO or independent outcome authority.
const V=require("./value"),M=require("../personal/membership"),C=require("./source-content"),{check,fail}=require("./errors");
const same=(a,b)=>V.canonical(a)===V.canonical(b),sorted=x=>[...new Set(x)].sort();
function conflictDigest(g,taskId,heads){return M.hash({format:"itacan-personal-conflict",version:2,profileDigest:g.ns.binding.profile.digest,authorityId:g.seed.authorityId,partitionId:g.seed.partition.id,taskId,heads:sorted(heads)});}
function preview(g,prior,taskId,originId){
 const heads=prior.frontier.get(taskId)??[];check(heads.length>=2&&heads.includes(originId),"Resolution requires an exact competing branch.");const source=g.read(originId),selected=source.tasks.find(t=>t.id===taskId);check(selected,"Selected origin has no task.");
 const taskNodes=[...prior.known].filter(id=>g.nodes.get(id)?.has(taskId)),versions=taskNodes.map(id=>g.read(id).tasks.find(t=>t.id===taskId)).filter(Boolean),retired=g.retirements(prior),ids=sorted(versions.flatMap(t=>t.steps.map(s=>s.id)));
 if(selected.deletedAt===null&&versions.some(t=>t.deletedAt!==null))fail("PERSONAL_RESURRECTION_UNSUPPORTED","A known deletion forbids a live resolution.");
 if(selected.deletedAt===null&&selected.steps.some(s=>retired.has(s.id)))fail("PERSONAL_RETIRED_STEP","Selected live branch contains a retired Step.");
 const task=V.clone(selected),removed=[];if(task.deletedAt!==null){task.steps=task.steps.filter(s=>{if(retired.has(s.id)){removed.push(s.id);return false}return true});}
 const liveIds=new Set(task.steps.map(s=>s.id)),retiredStepIds=sorted([...prior.retiredStepIds,...ids.filter(id=>!liveIds.has(id))]),catalog=g.catalog(prior),accounting=[],history=[];
 for(const e of catalog.values())if(e.taskId===taskId){const decision=source.accounting.get(e.id),a=decision?V.clone(decision):{disposition:"superseded",counted:false,reopenedAt:null,operationId:null};accounting.push({eventId:e.id,...a});history.push({...V.clone(e),counted:a.counted,reopenedAt:a.reopenedAt});}
 accounting.sort((a,b)=>a.eventId.localeCompare(b.eventId));history.sort((a,b)=>a.id.localeCompare(b.id));const bindings=task.deletedAt!==null?[]:source.bindings.filter(b=>b.taskId===taskId&&liveIds.has(b.stepId)||b.taskId===taskId&&b.stepId===null);
 const content=C.contentOf(selected)?.revisions.at(-1).current??{continuation:"",stepBodies:selected.steps.map(s=>({id:s.id,body:""}))};const current={continuation:content.continuation,stepBodies:content.stepBodies.filter(b=>liveIds.has(b.id))};
 const accountingChanges=accounting.map(a=>({eventId:a.eventId,before:{counted:prior.accounting.get(a.eventId)?.counted??false,reopenedAt:prior.accounting.get(a.eventId)?.reopenedAt??null,disposition:prior.accounting.get(a.eventId)?.disposition??"unresolved"},after:{counted:a.counted,reopenedAt:a.reopenedAt,disposition:a.disposition}}));
 const value={task,content:current,accounting,accountingChanges,bindings:V.clone(bindings),retiredStepIds,newlyRetiredStepIds:retiredStepIds.filter(id=>!prior.retiredStepIds.includes(id)),removedTombstoneSteps:removed.sort(),nextTaskRevision:Math.max(...versions.map(t=>t.revision),prior.tasks.find(t=>t.id===taskId)?.revision??0)+1};
 return {version:2,taskId,conflictDigest:conflictDigest(g,taskId,heads),reviewedHeads:sorted(heads),selectedOriginId:originId,previewDigest:M.hash(value),value};
}
function execute(g,prior,c,clock){
 const p=c.payload,heads=prior.frontier.get(p.taskId)??[];if(prior.personalHead!==p.expectedLocalHead||M.hash(prior.tasks.find(t=>t.id===p.taskId)??null)!==(p.expectedTaskDigest??M.hash(null))||!same(heads,p.reviewedHeads)||conflictDigest(g,p.taskId,heads)!==p.conflictDigest)fail("PERSONAL_REVIEW_STALE","Personal conflict changed; renewed review required.");
 const reviewed=preview(g,prior,p.taskId,p.choice.originId);if(reviewed.previewDigest!==p.previewDigest)fail("PERSONAL_REVIEW_STALE","Resolution consequences changed.");
 const v=reviewed.value,task=V.clone(v.task),before=V.clone(task);task.revision=v.nextTaskRevision;task.modifiedAt=clock;C.finishContentRevision(task,before,c.operationId,v.content);
 const next={tasks:prior.tasks.filter(t=>t.id!==p.taskId).concat(task).sort((a,b)=>a.id.localeCompare(b.id)),history:prior.history.filter(e=>e.taskId!==p.taskId).concat(v.accounting.map(a=>{const e=g.catalog(prior).get(a.eventId);return{...V.clone(e),counted:a.counted,reopenedAt:a.reopenedAt}})).sort((a,b)=>a.id.localeCompare(b.id)),bindings:prior.bindings.filter(b=>b.taskId!==p.taskId).concat(v.bindings).sort((a,b)=>(a.stepId??a.taskId).localeCompare(b.stepId??b.taskId)),retiredStepIds:sorted(v.retiredStepIds)};
 const accounting=new Map(prior.accounting);for(const a of v.accounting)accounting.set(a.eventId,{disposition:a.disposition,counted:a.counted,reopenedAt:a.reopenedAt,operationId:c.operationId});
 return {view:next,accounting,descriptor:{version:2,operationId:c.operationId,taskId:p.taskId,conflictDigest:p.conflictDigest,reviewedHeads:V.clone(p.reviewedHeads),selectedOriginId:p.choice.originId,previewDigest:p.previewDigest,resultingTaskDigest:M.hash(task),contentDigest:M.hash(v.content),accountingChanges:V.clone(v.accountingChanges),accounting:v.accounting.map(a=>({...a,operationId:c.operationId})),bindings:V.clone(v.bindings),retiredStepIds:next.retiredStepIds.filter(id=>!prior.retiredStepIds.includes(id)),removedTombstoneSteps:v.removedTombstoneSteps}};
}
module.exports={conflictDigest,preview,execute};
