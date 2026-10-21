"use strict";
// Inactive B2 transaction participant. Never opens a store or hosts production work.
const {check,fail}=require("./errors");
const {fields,canonical,clone,uuid,text,revision,timestamp}=require("./value");
const content=require("./source-content");
const {calculateRecurrenceEndpoints}=require("./recurrence-calendar");
const record=(v,keys)=>fields(v,keys,keys);
const digest=v=>content.sha256(canonical({...v,digest:null}));
const stamp=v=>({...v,digest:digest(v)});
function activeTemplate(n,s){return n.templateRevisions.find(r=>r.templateId===s.templateId&&r.revision===s.templateRevision);}
function preparedMember(state,id){const n=state.recurrence,o=n?.memberships.find(o=>o.taskId===id),s=n?.series.find(s=>s.id===o?.seriesId);return !!s&&n.version===2&&activeTemplate(n,s)?.version===2;}
function validateTaskContent(v){
 record(v,["title","description","continuation","importance","location","phase"]);
 check(typeof v.title==="string"&&!!v.title.trim()&&!/[\r\n]/.test(v.title),"Complete template requires a task title.");
 check(typeof v.description==="string"&&typeof v.continuation==="string","Explicit lossless task content required.");
 check([null,"should","must"].includes(v.importance),"Invalid template importance.");require("./domain").location(v.location);
 if(v.phase!==null){record(v.phase,["projectId","phaseId"]);text(v.phase.projectId);text(v.phase.phaseId);}
}
function validateCommand(command){
 check(command.expectedRepositoryRevision!==undefined,"Expected repository revision required.");
 const p=command.payload;if(p.version!==2)fail("UNSUPPORTED_SCHEMA","B2 commands require payload version 2.");
 const keys=["version","seriesId","owner","partitionId","expectedPartitionRevision","expectedSeriesRevision","expectedRuleRevision","expectedTemplateRevision","expectedInventoryRevision","reason"];
 if(command.type==="recurrence.complete")fields(p,[...keys,"completedAt"],keys);
 else record(p,[...keys,"description","taskContent","nodes","deletions","effectiveAfterOccurrenceId"]);
 uuid(p.seriesId);require("./domain").workspace(p.owner);text(p.partitionId);text(p.expectedInventoryRevision);text(p.reason);
 for(const key of ["expectedPartitionRevision","expectedSeriesRevision","expectedRuleRevision","expectedTemplateRevision"]){revision(p[key]);check(p[key]>0,"Expected positive revision required.");}
 if(command.type==="recurrence.complete"){if(p.completedAt!==undefined)timestamp(p.completedAt);}
 else{validateTaskContent(p.taskContent);check(typeof p.description==="string"&&Array.isArray(p.nodes)&&Array.isArray(p.deletions),"Explicit complete template draft required.");uuid(p.effectiveAfterOccurrenceId);}
}
function dateOnly(task){
 check(task.start!==null||task.due!==null,"Date-only recurrence requires an endpoint.");
 for(const e of [task.start,task.due]){require("./domain").dateEndpoint(e);if(e?.time!=null)fail("UNSUPPORTED_OPERATION","Timed recurrence is deferred.");}
}
function snapshot(state,s,taskId=s.initialOccurrenceId,completion=null){
 const n=state.recurrence;
 return{version:2,series:clone(s),rule:clone(n.ruleRevisions.find(r=>r.ruleId===s.ruleId&&r.revision===s.ruleRevision)),template:s.templateId===null?null:{definition:clone(n.templates.find(t=>t.id===s.templateId)),revision:clone(activeTemplate(n,s))},membership:clone(n.memberships.find(o=>o.taskId===taskId)),frontierMembership:clone(n.memberships.find(o=>o.taskId===s.frontierOccurrenceId)),completion:clone(completion)};
}
function readiness(state,seriesId,fence){
 const n=state.recurrence,s=n?.series.find(s=>s.id===seriesId),t=state.tasks.find(t=>t.id===s?.frontierOccurrenceId),blockers=[];
 if(fence)blockers.push("RECURRENCE_RECOVERY_FENCED");
 if(!s)blockers.push("SERIES_NOT_FOUND");
 else{if(!preparedMember(state,s.initialOccurrenceId))blockers.push("PREPARATION_REQUIRED");if(s.state!=="active")blockers.push("SERIES_NOT_ACTIVE");if(!t||t.deletedAt!==null)blockers.push("FRONTIER_NOT_LIVE");else{if(t.archivedAt!==null)blockers.push("FRONTIER_ARCHIVED");if(t.completed)blockers.push("FRONTIER_COMPLETED");try{dateOnly(t);}catch(_){blockers.push("INCOMPATIBLE_ENDPOINTS");}if(preparedMember(state,t.id))try{calculateRecurrenceEndpoints(n.ruleRevisions.find(r=>r.ruleId===s.ruleId&&r.revision===s.ruleRevision),s.committedOccurrenceCount+1);}catch(_){blockers.push("CALCULATION_UNAVAILABLE");}}}
 return{version:2,seriesId,generationSupported:true,eligible:blockers.length===0,blockers,recoveryFence:clone(fence??null),inventoryRevision:n?.externalInventory.revision??null};
}
function allocator(state,ctx,operationId){
 const ids=require("./recurrence").nativeReservedIds(state);
 ids.add(operationId);
 const reserve=id=>{uuid(id);if(ids.has(id))fail("IDENTITY_CONFLICT","Identity is live, retired, staged or externally reserved.",{id});ids.add(id);return id;};
 const next=()=>{for(let i=0;i<16;i++){const id=ctx.nextId();uuid(id);if(!ids.has(id))return id;}fail("IDENTITY_EXHAUSTED","No unreserved identity in sixteen attempts.");};
 return{reserve,next,allocate:()=>reserve(next())};
}
function revisedNodes(n,s,prior,p,reserve){
 const removed=new Set();
 for(const d of p.deletions){record(d,["nodeId","cascade","descendantIds"]);uuid(d.nodeId);check(prior.nodes.some(x=>x.id===d.nodeId)&&typeof d.cascade==="boolean"&&Array.isArray(d.descendantIds),"Invalid template deletion.");const tree=new Set([d.nodeId]);let grew=true;while(grew){grew=false;for(const node of prior.nodes)if(tree.has(node.parentNodeId)&&!tree.has(node.id)){tree.add(node.id);grew=true;}}const descendants=[...tree].filter(id=>id!==d.nodeId).sort();check(canonical(descendants)===canonical([...d.descendantIds].sort())&&(descendants.length===0||d.cascade),"Template subtree confirmation changed.");for(const id of tree){check(!removed.has(id),"Overlapping deletions.");removed.add(id);}}
 const nodes=p.nodes.map(d=>{record(d,["state","id","parentNodeId","order","title","body"]);check(["new","existing"].includes(d.state)&&!removed.has(d.id),"Explicit node intent required.");if(d.state==="existing")check(prior.nodes.some(x=>x.id===d.id),"Existing node not in selected template.");else{reserve(d.id);n.reservations.push({id:d.id,kind:"node",seriesId:s.id,templateId:s.templateId,retired:false});}const{state:ignored,...node}=d;return clone(node);});
 for(const node of prior.nodes)check(nodes.some(n=>n.id===node.id)||removed.has(node.id),"Omission is not deletion.");for(const id of removed)n.reservations.find(r=>r.id===id).retired=true;return nodes;
}
async function applyGenerationCommand(state,command,ctx){
 const n=state.recurrence,p=command.payload,s=n?.series.find(s=>s.id===p.seriesId),task=state.tasks.find(t=>t.id===command.taskId),member=n?.memberships.find(o=>o.taskId===command.taskId);
 if(!task)fail("NOT_FOUND","Occurrence not found.");
 if(task.revision!==command.expectedRevision)fail("REVISION_CONFLICT","Occurrence revision changed.");
 check(s&&member?.seriesId===s.id&&canonical(p.owner)===canonical(s.owner)&&canonical(task.owner)===canonical(s.owner)&&p.partitionId===s.partitionId&&task.partitionId===s.partitionId,"Series/occurrence owner mismatch.");
 const partition=state.partitions.find(x=>x.id===s.partitionId);
 if(partition.revision!==p.expectedPartitionRevision||s.revision!==p.expectedSeriesRevision||s.ruleRevision!==p.expectedRuleRevision||s.templateRevision!==p.expectedTemplateRevision)fail("REVISION_CONFLICT","Partition or recurrence revision changed.");
 if(!ctx.externalReservations)fail("EXTERNAL_RESERVATION_REQUIRED","Explicit external inventory required.");require("./recurrence").validateExternalReservations(ctx.externalReservations);
 if(ctx.externalReservations.revision!==p.expectedInventoryRevision||canonical(n.externalInventory)!==canonical(ctx.externalReservations))fail("RESERVATION_CONFLICT","External inventory changed.");
 check(s.state==="active"&&task.deletedAt===null&&task.archivedAt===null,"Live active occurrence required.");
 const template=activeTemplate(n,s);check(!!template,"Explicit approved template required, including empty templates.");
 const allocation=allocator(state,ctx,command.operationId);await ctx.fault?.("beforeRecurrenceIdentityChecks");
 if(command.type!=="recurrence.complete"){
  if(command.type==="recurrence.prepareGeneration"){
   check(member.ordinal===1&&task.id===s.initialOccurrenceId&&s.committedOccurrenceCount===1&&!n.generationLedger.some(e=>e.seriesId===s.id),"Only an authored initial definition can be prepared.");
   if(task.completed)fail("RECURRENCE_RECONCILIATION_REQUIRED","Completed B1 occurrence requires separately reviewed reconciliation.");
   check(template.version===1,"Series already prepared.");dateOnly(task);
  }else check(preparedMember(state,task.id),"Complete template preparation required.");
  check(task.id===s.frontierOccurrenceId&&p.effectiveAfterOccurrenceId===task.id,"Complete future template boundary must be current frontier.");
  await ctx.fault?.("beforeRecurrenceTemplateNormalization");
  const nodes=revisedNodes(n,s,template,p,allocation.reserve),def=n.templates.find(t=>t.id===s.templateId);
  const next=stamp({version:2,templateId:s.templateId,seriesId:s.id,revision:template.revision+1,parentRevision:template.revision,previousDigest:template.digest,effectiveAfterOccurrenceId:task.id,reason:p.reason,operationId:command.operationId,createdAt:ctx.now,description:p.description,taskContent:clone(p.taskContent),nodes,digest:null});
  require("./recurrence").validateTemplateRevision(next);
  const{continuation:ignored,...taskFields}=p.taskContent;
  const specimen=require("./commands").newTask({owner:s.owner,...taskFields},s.partitionId,ctx.now,()=>task.id);
  require("./domain").validateTask(specimen);
  require("./domain").phase(p.taskContent.phase,s.owner);await require("./domain").validateReferences(specimen,ctx.resolvers);
  state.schemaVersion=Math.max(state.schemaVersion,3);n.version=2;n.requiredCapabilities=["recurrence-foundation-v1","recurrence-generation-v2"];
  n.templateRevisions.push(next);def.revision=next.revision;s.templateRevision=next.revision;s.revision++;s.modifiedAt=ctx.now;
  return{taskIds:[],eventIds:[],partitionIds:[s.partitionId],recurrence:snapshot(state,s,task.id)};
 }
 check([3,4].includes(state.schemaVersion)&&preparedMember(state,task.id),"Explicit committed B2 preparation required.");
 if(task.completed)fail("RECURRENCE_ALREADY_COMPLETED","Occurrence is already completed.");
 dateOnly(task);
 const key=require("./recurrence").generationKey(s.owner,s.id,task.id),existing=n.generationLedger.find(e=>e.key===key),eventIds=[],before=clone(task);
 if(!existing)check(task.id===s.frontierOccurrenceId&&member.successorId===null,"Open historical occurrence has no committed outcome.");
 let calculation=null,successor=null,mappings=[];
 if(!existing){
  await ctx.fault?.("beforeRecurrenceCalculation");const rule=n.ruleRevisions.find(r=>r.ruleId===s.ruleId&&r.revision===s.ruleRevision);calculation=calculateRecurrenceEndpoints(rule,member.ordinal+1);
  await ctx.fault?.("beforeRecurrenceReservation");const id=allocation.allocate(),nodeIds=new Map(template.nodes.map(node=>[node.id,allocation.allocate()]));
  const steps=template.nodes.map(node=>({id:nodeIds.get(node.id),parentStepId:node.parentNodeId===null?null:nodeIds.get(node.parentNodeId),order:node.order,title:node.title}));
  const{continuation,...taskFields}=template.taskContent;
  successor=require("./commands").newTask({id,owner:clone(s.owner),...clone(taskFields),...clone(calculation.endpoints),steps},s.partitionId,ctx.now,allocation.next);
  mappings=template.nodes.map(node=>({stepId:nodeIds.get(node.id),templateNodeId:node.id,completed:false,completedAt:null,completionBinding:null}));
  await ctx.fault?.("beforeRecurrenceContent");const initial=clone(successor),intent=content.setContentIntent(successor,initial,{version:1,expectedRevision:0,appendOriginals:[],continuation},template.nodes.map(node=>({id:nodeIds.get(node.id),body:node.body})));
  content.finishContentRevision(successor,initial,command.operationId,intent);require("./domain").validateTask(successor);await require("./domain").validateReferences(successor,ctx.resolvers);
 }
 await ctx.fault?.("beforeRecurrenceCompletion");
 require("./completion-transition").completionTransition(state,command,{now:ctx.now,nextId:allocation.next,reserve:allocation.reserve,eventIds}).transition(task,null,true,p.completedAt);
 task.revision++;task.modifiedAt=ctx.now;content.finishContentRevision(task,before,command.operationId);
 await ctx.fault?.("afterRecurrenceCompletion");
 let outcome=existing;
 if(!existing){
  state.tasks.push(successor);await ctx.fault?.("beforeRecurrenceLineage");member.successorId=successor.id;
  n.memberships.push({version:1,taskId:successor.id,seriesId:s.id,owner:clone(s.owner),partitionId:s.partitionId,ordinal:member.ordinal+1,predecessorId:task.id,successorId:null,ruleId:s.ruleId,ruleRevision:s.ruleRevision,templateId:s.templateId,templateRevision:template.revision,generationOperationId:command.operationId,generationKey:key,originalEndpoints:clone(calculation.endpoints)});
  s.frontierOccurrenceId=successor.id;s.committedOccurrenceCount++;s.revision++;s.modifiedAt=ctx.now;
  await ctx.fault?.("beforeRecurrenceLedger");
  outcome=stamp({version:2,key,seriesId:s.id,predecessorId:task.id,operationId:command.operationId,receiptOperationId:command.operationId,completionEventId:eventIds[0],committedRevision:state.revision+1,ruleRevision:s.ruleRevision,ruleDigest:calculation.ruleDigest,templateRevision:template.revision,templateDigest:template.digest,calculation,generatedAt:ctx.now,result:{kind:"successor",taskId:successor.id,steps:mappings},creationTask:clone(successor),digest:null});
  n.generationLedger.push(outcome);
 }
 await ctx.fault?.("afterRecurrenceLedger");
 return{taskIds:[task.id,...(successor?[successor.id]:[])].sort(),eventIds,partitionIds:[s.partitionId],recurrence:snapshot(state,s,task.id,{version:2,completionEventId:eventIds[0],reused:!!existing,outcome:clone(outcome)})};
}
function validateGenerationState(state){
 const n=state.recurrence,members=new Map(n.memberships.map(o=>[o.taskId,o])),keys=new Set(),steps=new Set(),events=new Set(),successors=new Set();
 const nativeIds=[...state.tasks.flatMap(t=>[t.id,...t.steps.map(s=>s.id)]),...state.retiredStepIds,...state.history.map(e=>e.id)];check(new Set(nativeIds).size===nativeIds.length,"Native task/Step/event identities collide.");
 for(const s of n.series){const list=n.memberships.filter(o=>o.seriesId===s.id).sort((a,b)=>a.ordinal-b.ordinal);check(list.length===s.committedOccurrenceCount&&list.at(-1)?.taskId===s.frontierOccurrenceId,"Series frontier/count mismatch.");if(list.length>1)check(preparedMember(state,s.initialOccurrenceId),"Unprepared series generated work.");for(let i=0;i<list.length;i++){const o=list[i];check(o.ordinal===i+1&&o.predecessorId===(list[i-1]?.taskId??null)&&o.successorId===(list[i+1]?.taskId??null),"Nonreciprocal occurrence lineage.");}}
 for(const e of n.generationLedger){
  record(e,["version","key","seriesId","predecessorId","operationId","receiptOperationId","completionEventId","committedRevision","ruleRevision","ruleDigest","templateRevision","templateDigest","calculation","generatedAt","result","creationTask","digest"]);
  if(e.version!==2)fail("UNSUPPORTED_SCHEMA","Unsupported generation outcome version.");
  check(e.digest===digest(e),"Generation outcome digest mismatch.");timestamp(e.generatedAt);check(e.generatedAt!==null,"Generation clock required.");
  record(e.result,["kind","taskId","steps"]);check(e.result.kind==="successor"&&Array.isArray(e.result.steps),"B2 requires an explicit successor outcome.");uuid(e.result.taskId);
  const a=members.get(e.predecessorId),b=members.get(e.result.taskId),s=n.series.find(s=>s.id===e.seriesId),rule=n.ruleRevisions.find(r=>r.seriesId===e.seriesId&&r.revision===e.ruleRevision),template=n.templateRevisions.find(r=>r.seriesId===e.seriesId&&r.revision===e.templateRevision);
  check(a&&b&&s&&rule&&template?.version===2&&a.seriesId===s.id&&b.seriesId===s.id,"Generation definitions/members missing.");
  check(e.key===require("./recurrence").generationKey(s.owner,s.id,a.taskId)&&!keys.has(e.key)&&!successors.has(b.taskId),"Duplicate/retargeted generation outcome.");keys.add(e.key);successors.add(b.taskId);
  check(a.successorId===b.taskId&&b.predecessorId===a.taskId&&b.generationOperationId===e.operationId&&b.generationKey===e.key&&b.ruleRevision===e.ruleRevision&&b.templateId===template.templateId&&b.templateRevision===e.templateRevision,"Outcome/membership mismatch.");
  check(e.ruleDigest===rule.digest&&e.ruleRevision===s.ruleRevision&&e.templateDigest===template.digest&&canonical(e.calculation)===canonical(calculateRecurrenceEndpoints(rule,b.ordinal))&&canonical(b.originalEndpoints)===canonical(e.calculation.endpoints),"Generation calculation/definition evidence changed.");
  const receipt=state.receipts.find(r=>r.operationId===e.receiptOperationId),event=state.history.find(h=>h.id===e.completionEventId);
  check(e.operationId===e.receiptOperationId&&e.completionEventId!==e.operationId&&receipt?.result.repositoryRevision===e.committedRevision&&JSON.parse(receipt.payload).type==="recurrence.complete"&&JSON.parse(receipt.payload).taskId===a.taskId&&receipt.result.recurrence?.template?.revision.digest===template.digest&&event?.taskId===a.taskId&&event.stepId===null&&event.kind==="task"&&event.operationId===e.operationId&&event.recordedAt===e.generatedAt&&!events.has(event.id),"Generation receipt/event missing or retargeted.");events.add(event.id);
  const created=e.creationTask;require("./domain").validateTask(created);
  const c=content.contentOf(created),tc=template.taskContent;
  check(created.id===b.taskId&&created.revision===1&&created.partitionId===s.partitionId&&canonical(created.owner)===canonical(s.owner)&&created.completed===false&&created.completedAt===null&&created.archivedAt===null&&created.deletedAt===null&&created.captureSource===null&&created.createdAt===e.generatedAt&&created.modifiedAt===e.generatedAt&&created.migration?.source==="private-native-content-v1"&&created.migration.sourceId===created.id&&created.migration.importedAt===null&&c?.originals.length===0&&c.previousEvidence===null&&c.revisions.length===1&&c.revisions[0].operationId===e.operationId,"Invalid successor creation snapshot.");
  for(const k of ["title","description","importance","location","phase"])check(canonical(created[k])===canonical(tc[k]),"Generated task metadata differs from selected template.");
  check(c.revisions[0].current.continuation===tc.continuation&&canonical({start:created.start,due:created.due})===canonical(e.calculation.endpoints),"Generated task body/dates differ.");
  record(e.result,["kind","taskId","steps"]);check(e.result.kind==="successor"&&Array.isArray(e.result.steps)&&e.result.steps.length===template.nodes.length&&created.steps.length===template.nodes.length,"Missing creation Step mappings.");
  const mapping=new Map();for(const m of e.result.steps){record(m,["stepId","templateNodeId","completed","completedAt","completionBinding"]);uuid(m.stepId);uuid(m.templateNodeId);check(!steps.has(m.stepId)&&!mapping.has(m.templateNodeId)&&m.completed===false&&m.completedAt===null&&m.completionBinding===null,"Duplicate/inherited creation Step.");steps.add(m.stepId);mapping.set(m.templateNodeId,m.stepId);}
  const current=state.tasks.find(t=>t.id===b.taskId);
  for(const node of template.nodes){const id=mapping.get(node.id),step=created.steps.find(x=>x.id===id);check(step&&step.parentStepId===(node.parentNodeId===null?null:mapping.get(node.parentNodeId))&&step.order===node.order&&step.title===node.title&&step.completed===false&&step.completedAt===null&&step.createdAt===e.generatedAt&&step.modifiedAt===e.generatedAt&&c.revisions[0].current.stepBodies.find(x=>x.id===id)?.body===node.body,"Incorrect original Step instantiation.");check(current.steps.some(x=>x.id===id)||state.retiredStepIds.includes(id),"Generated Step identity lost without native retirement.");}
  check(canonical(receipt.result.tasks.find(t=>t.id===created.id))===canonical(created),"Original successor receipt was rewritten.");
  check(canonical(receipt.result.recurrence?.completion?.outcome)===canonical(e),"Original outcome receipt differs.");
 }
 check(n.memberships.filter(o=>o.ordinal>1).every(o=>keys.has(o.generationKey))&&n.generationLedger.length===n.memberships.filter(o=>o.ordinal>1).length,"Generated membership/outcome cardinality mismatch.");
 for(const receipt of state.receipts){const v=receipt.result.recurrence;if(v?.version!==2)continue;const command=JSON.parse(receipt.payload);if(command.type==="recurrence.complete"){
  const c=v.completion;record(c,["version","completionEventId","reused","outcome"]);check(c.version===2&&typeof c.reused==="boolean"&&c.outcome!==null&&typeof c.outcome==="object","Invalid completion result.");const original=n.generationLedger.find(e=>e.key===c.outcome.key),event=state.history.find(e=>e.id===c.completionEventId);check(original&&canonical(original)===canonical(c.outcome)&&event?.taskId===v.membership.taskId&&event.stepId===null&&event.operationId===receipt.operationId&&receipt.result.change.eventIds.includes(event.id)&&c.reused===(original.operationId!==receipt.operationId),"Recompletion result/event/outcome mismatch.");
 }else check(v.completion===null,"Template commands cannot create completion evidence.");}
}
module.exports={preparedMember,validateTaskContent,validateCommand,applyGenerationCommand,validateGenerationState,snapshot,readiness};
