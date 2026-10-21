"use strict";
// Inactive versioned recurrence contracts. Production TaskService does not load this core.
const {check,fail}=require("./errors");
const {fields,canonical,clone,uuid,text,revision,timestamp}=require("./value");
const {sha256}=require("./source-content");
const TYPES=Object.freeze(["recurrence.defineSeries","recurrence.reviseRule","recurrence.defineTemplate","recurrence.reviseTemplate"]);
const GENERATION_TYPES=Object.freeze({version:2,commands:Object.freeze(["recurrence.prepareGeneration","recurrence.complete"])});
const STATES=Object.freeze(["active","paused","exhausted","stopped","quarantined","conflicted"]);
const record=(v,n)=>fields(v,n,n), positive=v=>{revision(v);check(v>0,"Revision/interval must be positive.");};
const digest=v=>sha256(canonical({...v,digest:null}));
function freshNative(task){const c=require("./source-content").contentOf(task);return task.captureSource===null&&(task.migration===null||task.migration.source==="private-native-content-v1"&&task.migration.sourceId===task.id&&task.migration.importedAt===null&&c?.originals.length===0&&c.previousEvidence===null);}
function version(v){if(v!==1)fail("UNSUPPORTED_SCHEMA","Unsupported recurrence contract; refusing downgrade.");}
function integrity(v){check(v.digest===digest(v),"Recurrence integrity digest mismatch.");}
function stamped(v){v.digest=digest(v);return v;}
function validateExternalReservations(v){
 record(v,["version","revision","ids"]);version(v.version);text(v.revision);check(Array.isArray(v.ids),"Explicit external inventory required.");
 const ids=new Set();for(const id of v.ids){uuid(id);check(!ids.has(id),"Duplicate external reservation.");ids.add(id);}
}
function validateCalendar(v){record(v,["calendar","zone"]);check(v.calendar==="gregory","Gregorian calendar required.");text(v.zone);try{new Intl.DateTimeFormat("en",{timeZone:v.zone});}catch(_){fail("VALIDATION","Explicit supported IANA series zone required.");}}
function validateRuleInput(v){
 record(v,["version","frequency","interval","referencePolicy","calendar"]);version(v.version);
 if(!["DAILY","WEEKLY"].includes(v.frequency)||v.referencePolicy!=="fixed-origin")fail("UNSUPPORTED_OPERATION","B1 supports only unbounded fixed DAILY/WEEKLY definitions.");
 positive(v.interval);validateCalendar(v.calendar);
}
// Civil-day difference only: validates offsets, never advances recurrence dates.
function civilDay(date){const[y,m,d]=date.split("-").map(Number),p=y-1;return 365*p+Math.floor(p/4)-Math.floor(p/100)+Math.floor(p/400)+[0,31,59,90,120,151,181,212,243,273,304,334][m-1]+(m>2&&y%4===0&&(y%100!==0||y%400===0)?1:0)+d;}
function endpoints(v){
 record(v,["start","due"]);const {dateEndpoint}=require("./domain");
 for(const e of [v.start,v.due]){dateEndpoint(e);if(e&&e.time!==null)fail("UNSUPPORTED_OPERATION","Timed recurrence, including explicit midnight, is deferred.");}
 check(v.start!==null||v.due!==null,"Explicit Due or Start anchor required.");check(!v.start||!v.due||v.start.date<=v.due.date,"Reversed endpoints cannot define a series.");
 const anchor=v.due??v.start;return{anchor: v.due?"due":"start",date:anchor.date,startDays:v.start?civilDay(v.start.date)-civilDay(anchor.date):null,dueDays:v.due?0:null};
}
function validateRuleRevision(v){
 record(v,["version","ruleId","seriesId","revision","previousDigest","rule","origin","originOrdinal","offsets","effectiveAfterOccurrenceId","reason","operationId","createdAt","originalEvidenceRef","digest"]);
 version(v.version);uuid(v.ruleId);uuid(v.seriesId);positive(v.revision);validateRuleInput(v.rule);check(v.originOrdinal===1,"B1 only supports an initial-occurrence rule boundary.");
 const expected=endpoints(v.origin);check(canonical(expected)===canonical(v.offsets),"Rule origin/offset mismatch.");uuid(v.effectiveAfterOccurrenceId);text(v.reason);text(v.operationId);timestamp(v.createdAt);check(v.createdAt!==null,"Known creation clock required.");
 check(v.originalEvidenceRef===null,"Fresh-native B1 cannot fabricate or adopt legacy evidence.");check(v.previousDigest===null||/^[0-9a-f]{64}$/.test(v.previousDigest),"Invalid prior rule digest.");integrity(v);
}
function validateTemplateRevision(v){
 if(![1,2].includes(v.version))fail("UNSUPPORTED_SCHEMA","Unsupported complete template version.");
 record(v,["version","templateId","seriesId","revision","parentRevision","previousDigest","effectiveAfterOccurrenceId","reason","operationId","createdAt","description","nodes","digest",...(v.version===2?["taskContent"]:[])]);
 if(v.version===2)require("./recurrence-generation").validateTaskContent(v.taskContent);
 uuid(v.templateId);uuid(v.seriesId);positive(v.revision);check(v.parentRevision===(v.revision===1?null:v.revision-1),"Template revision ancestry mismatch.");
 uuid(v.effectiveAfterOccurrenceId);text(v.reason);text(v.operationId);timestamp(v.createdAt);check(v.createdAt!==null&&typeof v.description==="string","Invalid template creation/content.");
 check(v.previousDigest===null||/^[0-9a-f]{64}$/.test(v.previousDigest),"Invalid prior template digest.");check(Array.isArray(v.nodes),"Template nodes required.");
 const groups=new Map();for(const n of v.nodes){record(n,["id","parentNodeId","order","title","body"]);uuid(n.id);if(n.parentNodeId!==null)uuid(n.parentNodeId);check(typeof n.body==="string","Lossless string body required.");const g=groups.get(n.parentNodeId)??[];g.push(n.order);groups.set(n.parentNodeId,g);}
 // Validation views only; no occurrence Step is allocated or persisted.
 require("./domain").validateSteps(v.nodes.map(n=>({id:n.id,taskId:v.templateId,parentStepId:n.parentNodeId,order:n.order,title:n.title,completed:false,completedAt:null,createdAt:null,modifiedAt:null})),v.templateId);
 for(const g of groups.values())check(canonical([...g].sort((a,b)=>a-b))===canonical(g.map((_,i)=>i)),"Template sibling ordering must be contiguous from zero.");
 integrity(v);
}
function generationKey(owner,seriesId,predecessorOccurrenceId){require("./domain").workspace(owner);uuid(seriesId);uuid(predecessorOccurrenceId);return canonical(["native-generation",1,owner.type,owner.id,seriesId,predecessorOccurrenceId]);}
function validateMembership(v){
 record(v,["version","taskId","seriesId","owner","partitionId","ordinal","predecessorId","successorId","ruleId","ruleRevision","templateId","templateRevision","generationOperationId","generationKey","originalEndpoints"]);
 version(v.version);uuid(v.taskId);uuid(v.seriesId);require("./domain").workspace(v.owner);text(v.partitionId);positive(v.ordinal);uuid(v.ruleId);positive(v.ruleRevision);
 for(const key of ["predecessorId","successorId","templateId"])if(v[key]!==null)uuid(v[key]);
 check((v.templateId===null)===(v.templateRevision===null),"Template reference incomplete.");if(v.templateRevision!==null)positive(v.templateRevision);
 endpoints(v.originalEndpoints);
 if(v.ordinal===1)check(v.predecessorId===null&&v.generationOperationId===null&&v.generationKey===null,"Initial occurrence is authored, not generated.");
 else{uuid(v.predecessorId);text(v.generationOperationId);check(v.generationKey===generationKey(v.owner,v.seriesId,v.predecessorId),"Noncanonical generation key.");}
}
function validateSeries(v){
 record(v,["version","id","owner","partitionId","revision","state","ruleId","ruleRevision","calendar","templateId","templateRevision","initialOccurrenceId","frontierOccurrenceId","committedOccurrenceCount","createdAt","modifiedAt"]);
 version(v.version);uuid(v.id);require("./domain").workspace(v.owner);text(v.partitionId);positive(v.revision);check(STATES.includes(v.state),"Invalid series lifecycle vocabulary.");
 uuid(v.ruleId);positive(v.ruleRevision);validateCalendar(v.calendar);uuid(v.initialOccurrenceId);uuid(v.frontierOccurrenceId);positive(v.committedOccurrenceCount);
 check((v.templateId===null)===(v.templateRevision===null),"Incomplete active template reference.");if(v.templateId!==null){uuid(v.templateId);positive(v.templateRevision);}
 timestamp(v.createdAt);timestamp(v.modifiedAt);check(v.createdAt!==null&&v.modifiedAt!==null,"Known series creation/modification clocks required.");
}
function validateGenerationGraph(v){
 record(v,["version","occurrences","ledger","retiredSuccessorIds"]);version(v.version);check(Array.isArray(v.occurrences)&&Array.isArray(v.ledger)&&Array.isArray(v.retiredSuccessorIds),"Generation graph arrays required.");
 const tasks=new Map(),keys=new Set(),successors=new Set(),allocated=new Set(),events=new Set(),seriesRoots=new Map(),ordinals=new Set(),templateNodes=new Set(v.ledger.flatMap(e=>e.result?.steps?.map(s=>s.templateNodeId)??[]));
 for(const o of v.occurrences){validateMembership(o);check(!tasks.has(o.taskId),"Task belongs to multiple occurrence records.");tasks.set(o.taskId,o);allocated.add(o.taskId);const ordinal=canonical([o.seriesId,o.ordinal]);check(!ordinals.has(ordinal),"Duplicate series occurrence ordinal.");ordinals.add(ordinal);if(o.ordinal===1){check(!seriesRoots.has(o.seriesId),"Series has multiple initial occurrences.");seriesRoots.set(o.seriesId,o);}}
 check(new Set(v.retiredSuccessorIds).size===v.retiredSuccessorIds.length,"Duplicate retired successor identity.");for(const id of v.retiredSuccessorIds)uuid(id);
 for(const o of v.occurrences){
  check(seriesRoots.has(o.seriesId),"Occurrence series has no authored root.");
  for(const [id,back] of [[o.predecessorId,"successorId"],[o.successorId,"predecessorId"]])if(id!==null){const other=tasks.get(id);check(!!other&&other[back]===o.taskId&&other.seriesId===o.seriesId&&other.ruleId===o.ruleId&&other.partitionId===o.partitionId&&canonical(other.owner)===canonical(o.owner),"Nonreciprocal or cross-owner occurrence lineage.");}
  if(o.predecessorId!==null)check(tasks.get(o.predecessorId).ordinal+1===o.ordinal,"Occurrence ordinals must follow lineage.");
 }
 for(const e of v.ledger){
  record(e,["version","key","seriesId","predecessorId","operationId","receiptOperationId","completionEventId","committedRevision","ruleRevision","templateRevision","referenceEvidence","result"]);version(e.version);uuid(e.seriesId);uuid(e.predecessorId);uuid(e.completionEventId);text(e.operationId);check(e.receiptOperationId===e.operationId&&e.completionEventId!==e.operationId,"Event and operation receipt relationships differ.");positive(e.committedRevision);positive(e.ruleRevision);if(e.templateRevision!==null)positive(e.templateRevision);record(e.referenceEvidence,["version","policy","originOrdinal","origin","zone"]);version(e.referenceEvidence.version);check(e.referenceEvidence.policy==="fixed-origin"&&e.referenceEvidence.originOrdinal===1,"Unsupported captured reference policy.");endpoints(e.referenceEvidence.origin);validateCalendar({calendar:"gregory",zone:e.referenceEvidence.zone});
  const a=tasks.get(e.predecessorId);check(!!a&&a.seriesId===e.seriesId&&e.key===generationKey(a.owner,e.seriesId,a.taskId),"Generation predecessor/key mismatch.");
  check(!keys.has(e.key),"Two outcomes for one generation key.");keys.add(e.key);check(!allocated.has(e.completionEventId)&&!templateNodes.has(e.completionEventId)&&!events.has(e.completionEventId),"Completion event is not a reused occurrence/template identity.");events.add(e.completionEventId);
  if(e.result.kind==="successor"){
   record(e.result,["kind","taskId","steps"]);uuid(e.result.taskId);const b=tasks.get(e.result.taskId);check(!!b&&b.predecessorId===a.taskId&&a.successorId===b.taskId&&b.generationKey===e.key&&b.generationOperationId===e.operationId&&b.ruleRevision===e.ruleRevision&&b.templateRevision===e.templateRevision,"Retargeted generation result.");
   check(!successors.has(b.taskId),"Successor retarget/reuse.");successors.add(b.taskId);check(Array.isArray(e.result.steps),"Step mappings required.");
   const nodes=new Set();for(const s of e.result.steps){record(s,["stepId","templateNodeId","completed","completedAt","completionBinding"]);uuid(s.stepId);uuid(s.templateNodeId);check(!templateNodes.has(s.stepId)&&!allocated.has(s.stepId)&&!allocated.has(s.templateNodeId)&&!events.has(s.stepId)&&!nodes.has(s.templateNodeId),"Reused Step/template-node identity.");nodes.add(s.templateNodeId);allocated.add(s.stepId);check(s.completed===false&&s.completedAt===null&&s.completionBinding===null,"Generated Step cannot inherit completion.");}
  }else{record(e.result,["kind","reason","proof"]);check(e.result.kind==="exhausted"&&["count","until","both"].includes(e.result.reason)&&typeof e.result.proof==="string"&&e.result.proof.length>0&&a.successorId===null,"Exhaustion needs explicit validated proof and no successor.");}
 }
 for(const o of v.occurrences)if(o.ordinal>1)check(keys.has(o.generationKey),"Generated membership has no durable outcome.");
 for(const id of v.retiredSuccessorIds)check(successors.has(id),"Retired successor must retain spent generation outcome.");
 return true;
}
function nativeReservedIds(state){
 return new Set([...state.tasks.flatMap(t=>[t.id,...t.steps.map(s=>s.id)]),...state.retiredStepIds,...state.history.map(e=>e.id),...(state.recurrence?.reservations.map(r=>r.id)??[]),...(state.recurrence?.externalInventory.ids??[]),...require("./history-import").reservedIds(state)]);
}
function validateNamespace(state){
 const n=state.recurrence,b2=n.version===2;
 if(![1,2].includes(n.version))fail("UNSUPPORTED_SCHEMA","Unsupported recurrence namespace.");
 if(canonical(n.requiredCapabilities??null)!==canonical(b2?["recurrence-foundation-v1","recurrence-generation-v2"]:["recurrence-foundation-v1"]))fail("UNSUPPORTED_SCHEMA","Unknown mandatory recurrence capability; refusing downgrade.");
 record(n,["version","format","requiredCapabilities","externalInventory","series","ruleRevisions","templates","templateRevisions","memberships","reservations","generationLedger"]);
 if(n.format!=="itacan-recurrence-foundation")fail("UNSUPPORTED_SCHEMA","Unsupported recurrence namespace format.");validateExternalReservations(n.externalInventory);
 for(const key of ["series","ruleRevisions","templates","templateRevisions","memberships","reservations","generationLedger"])check(Array.isArray(n[key]),"Recurrence collection required.");
 if(b2)for(const key of ["series","ruleRevisions","templates","templateRevisions","memberships","reservations","generationLedger"])for(const value of n[key])check(value!==null&&typeof value==="object"&&!Array.isArray(value),"Recurrence entries must be records.");
 if(!b2)check(n.generationLedger.length===0&&n.templateRevisions.every(r=>r.version===1),"B1 cannot commit generation outcomes or complete templates.");
 const occupied=new Set([...state.tasks.flatMap(t=>[t.id,...t.steps.map(s=>s.id)]),...state.retiredStepIds,...state.history.map(e=>e.id)]),reserved=new Map(),series=new Map(),members=new Map(),templates=new Map();
 for(const id of n.externalInventory.ids)check(!occupied.has(id)||require("./history-import").claimedExternal(state,id),"External reservation collides with a published native identity.");
 for(const r of n.reservations){record(r,["id","kind","seriesId","templateId","retired"]);uuid(r.id);uuid(r.seriesId);if(r.templateId!==null)uuid(r.templateId);check(["series","rule","template","node"].includes(r.kind)&&typeof r.retired==="boolean","Invalid native reservation kind.");check(!occupied.has(r.id)&&!reserved.has(r.id)&&!n.externalInventory.ids.includes(r.id),"Native recurrence identity collision.");reserved.set(r.id,r);}
 const demand=(id,kind,sid,tid=null)=>{const r=reserved.get(id);check(r?.kind===kind&&r.seriesId===sid&&r.templateId===tid,"Missing/mismatched native identity reservation.");return r;};
 const used=new Set(),use=(...args)=>{used.add(args[0]);return demand(...args);};
 for(const s of n.series){validateSeries(s);check(!series.has(s.id),"Duplicate series identity.");series.set(s.id,s);check(!use(s.id,"series",s.id).retired&&!use(s.ruleId,"rule",s.id).retired,"Live series/rule cannot be retired.");const p=state.partitions.find(p=>p.id===s.partitionId);check(p&&canonical(p.owner)===canonical(s.owner),"Series owner/partition mismatch.");check(s.state==="active"&&s.revision===s.ruleRevision+(s.templateRevision??0)+s.committedOccurrenceCount-1&&(b2||s.committedOccurrenceCount===1&&s.frontierOccurrenceId===s.initialOccurrenceId),"Unsupported lifecycle or incoherent revision counts.");}
 for(const t of n.templates){record(t,["version","id","seriesId","owner","partitionId","revision"]);version(t.version);uuid(t.id);positive(t.revision);const s=series.get(t.seriesId);check(s&&canonical(t.owner)===canonical(s.owner)&&t.partitionId===s.partitionId&&s.templateId===t.id&&s.templateRevision===t.revision&&!templates.has(t.id),"Template ownership/reference mismatch.");templates.set(t.id,t);check(!use(t.id,"template",s.id,t.id).retired,"Active template cannot be retired.");}
 const checkRevisions=(records,idKey,id,latest,validate)=>{
  const list=records.filter(r=>r[idKey]===id).sort((a,b)=>a.revision-b.revision);check(list.length===latest,"Missing immutable revision.");let previous=null;
  for(let i=0;i<list.length;i++){const r=list[i];validate(r);check(r.revision===i+1&&r.previousDigest===(previous?.digest??null),"Immutable revision chain mismatch.");previous=r;}return list;
 };
 for(const s of series.values()){
  const rules=checkRevisions(n.ruleRevisions,"ruleId",s.ruleId,s.ruleRevision,validateRuleRevision);for(const r of rules)check(r.seriesId===s.id&&r.effectiveAfterOccurrenceId===s.initialOccurrenceId,"Rule series/boundary mismatch.");check(canonical(rules.at(-1).rule.calendar)===canonical(s.calendar),"Active calendar differs from rule.");
  if(s.templateId!==null){check(templates.has(s.templateId),"Active template missing.");const list=checkRevisions(n.templateRevisions,"templateId",s.templateId,s.templateRevision,validateTemplateRevision),seen=new Set(),retired=new Set();let prior=new Set();
   let complete=false;
   for(const r of list){check(r.seriesId===s.id&&(r.version===1?r.effectiveAfterOccurrenceId===s.initialOccurrenceId:n.memberships.some(o=>o.seriesId===s.id&&o.taskId===r.effectiveAfterOccurrenceId)),"Template series/boundary mismatch.");check(!complete||r.version===2,"Complete template cannot downgrade.");complete ||= r.version===2;const now=new Set(r.nodes.map(x=>x.id));for(const node of r.nodes){check(!retired.has(node.id),"Retired template node reappeared.");use(node.id,"node",s.id,s.templateId);seen.add(node.id);}for(const id of prior)if(!now.has(id))retired.add(id);prior=now;}
   for(const id of seen)check(reserved.get(id).retired===retired.has(id),"Node retirement differs from immutable history.");
  }
 }
 check(n.ruleRevisions.every(r=>series.get(r.seriesId)?.ruleId===r.ruleId)&&n.templateRevisions.every(r=>templates.get(r.templateId)?.seriesId===r.seriesId),"Orphan immutable revision.");
 check(used.size===reserved.size,"Orphan native identity reservation.");
 for(const o of n.memberships){validateMembership(o);const s=series.get(o.seriesId),t=state.tasks.find(t=>t.id===o.taskId);check(s&&t&&!members.has(o.taskId),"Missing/duplicate occurrence.");members.set(o.taskId,o);check(freshNative(t)&&canonical(t.owner)===canonical(s.owner)&&canonical(o.owner)===canonical(s.owner)&&t.partitionId===s.partitionId&&o.partitionId===s.partitionId,"Occurrence is not fresh-native or crosses owners.");check(o.ruleId===s.ruleId,"Occurrence rule identity mismatch.");if(o.ordinal===1)check(o.taskId===s.initialOccurrenceId&&o.templateId===null&&o.ruleRevision===1&&canonical(o.originalEndpoints)===canonical(n.ruleRevisions.find(r=>r.ruleId===s.ruleId&&r.revision===1).origin),"Initial captured rule evidence changed.");else check(b2,"B1 cannot contain generated members.");if(!b2)check(o.successorId===null&&t.deletedAt===null,"Invalid B1 initial occurrence.");}
 for(const s of series.values())check(n.memberships.filter(o=>o.seriesId===s.id&&o.ordinal===1).length===1,"Every series needs one authored root.");
 for(const receipt of state.receipts)if(receipt.result.recurrence){const snapshot=receipt.result.recurrence;check(b2||snapshot.version===1,"B1 store cannot contain B2 snapshots.");validateSnapshot(snapshot);const s=series.get(snapshot.series.id);check(s&&s.revision>=snapshot.series.revision,"Committed series removed/reversed.");const rule=n.ruleRevisions.find(r=>r.ruleId===snapshot.rule.ruleId&&r.revision===snapshot.rule.revision);check(canonical(rule)===canonical(snapshot.rule),"Committed rule revision was rewritten.");if(snapshot.template){const r=n.templateRevisions.find(r=>r.templateId===snapshot.template.revision.templateId&&r.revision===snapshot.template.revision.revision);check(canonical(r)===canonical(snapshot.template.revision),"Committed template revision was rewritten.");}for(const old of [snapshot.membership,...(snapshot.version===2?[snapshot.frontierMembership]:[])]){const current=members.get(old.taskId);check(current&&canonical({...current,successorId:old.successorId})===canonical(old)&&(!old.successorId||current.successorId===old.successorId),"Captured occurrence membership was rewritten.");}}
 if(b2)require("./recurrence-generation").validateGenerationState(state);
}
function validateSnapshot(v){record(v,["version","series","rule","template","membership",...(v.version===2?["frontierMembership","completion"]:[])]);if(![1,2].includes(v.version))fail("UNSUPPORTED_SCHEMA","Unsupported recurrence snapshot.");validateSeries(v.series);validateRuleRevision(v.rule);validateMembership(v.membership);if(v.version===2){validateMembership(v.frontierMembership);check(v.frontierMembership.taskId===v.series.frontierOccurrenceId&&v.frontierMembership.seriesId===v.series.id,"Snapshot frontier mismatch.");}else check(v.template?.revision.version!==2,"B1 snapshot cannot represent complete templates.");check(v.series.id===v.rule.seriesId&&v.membership.seriesId===v.series.id&&v.series.ruleId===v.rule.ruleId&&v.series.ruleRevision===v.rule.revision,"Receipt recurrence references differ.");if(v.template!==null){record(v.template,["definition","revision"]);const d=v.template.definition;record(d,["version","id","seriesId","owner","partitionId","revision"]);version(d.version);validateTemplateRevision(v.template.revision);check(d.id===v.template.revision.templateId&&d.seriesId===v.series.id&&d.revision===v.template.revision.revision&&canonical(d.owner)===canonical(v.series.owner)&&d.partitionId===v.series.partitionId&&v.series.templateId===d.id&&v.series.templateRevision===d.revision,"Receipt template mismatch.");}else check(v.series.templateId===null,"Receipt active template missing.");}
function validateRecurrenceCommand(command){
 if(GENERATION_TYPES.commands.includes(command.type)||command.type==="recurrence.reviseTemplate"&&command.payload.version===2)return require("./recurrence-generation").validateCommand(command);
 if(!TYPES.includes(command.type))fail("UNSUPPORTED_OPERATION","B1 does not support recurrence lifecycle or generation operations.");
 check(command.expectedRepositoryRevision!==undefined,"Recurrence commands require expected repository revision.");
 const p=command.payload;version(p.version);text(p.expectedInventoryRevision);
 const base=["version","expectedInventoryRevision","seriesId","owner","partitionId"];
 let allowed;
 if(command.type==="recurrence.defineSeries")allowed=[...base,"ruleId","rule","reason"];
 else{positive(p.expectedSeriesRevision);uuid(p.seriesId);allowed=[...base,"expectedSeriesRevision","reason"];
  if(command.type==="recurrence.reviseRule")allowed.push("expectedRuleRevision","rule","origin","effectiveAfterOccurrenceId");
  else if(command.type==="recurrence.defineTemplate")allowed.push("templateId","description","nodes");
  else allowed.push("expectedTemplateRevision","description","nodes","deletions","effectiveAfterOccurrenceId");}
 fields(p,allowed,allowed.filter(k=>!["seriesId","ruleId","templateId"].includes(k)));if(command.type!=="recurrence.defineSeries")uuid(p.seriesId);
 require("./domain").workspace(p.owner);text(p.partitionId);text(p.reason);
}
async function applyRecurrence(state,command,ctx){
 if(GENERATION_TYPES.commands.includes(command.type)||command.type==="recurrence.reviseTemplate"&&command.payload.version===2)return require("./recurrence-generation").applyGenerationCommand(state,command,ctx);
 const p=command.payload,t=state.tasks.find(t=>t.id===command.taskId);
 if(!t)fail("NOT_FOUND","Initial task does not exist.");if(t.revision!==command.expectedRevision)fail("REVISION_CONFLICT","Initial occurrence task revision changed.");
 check(t.deletedAt===null&&t.archivedAt===null&&freshNative(t),"B1 requires an existing live fresh-native task.");
 check(canonical(t.owner)===canonical(p.owner)&&t.partitionId===p.partitionId,"Owner/partition does not match initial task.");
 const inventory=ctx.externalReservations;if(!inventory)fail("EXTERNAL_RESERVATION_REQUIRED","Explicit captured immutable external reservation inventory required.");validateExternalReservations(inventory);
 if(inventory.revision!==p.expectedInventoryRevision)fail("RESERVATION_CONFLICT","External reservation revision changed.");
 if(state.recurrence&&canonical(state.recurrence.externalInventory)!==canonical(inventory))fail("RESERVATION_CONFLICT","Concurrent/changing external inventories are unsupported.");
 if(!state.recurrence){check(command.type==="recurrence.defineSeries","Define a series before revising recurrence state.");state.schemaVersion=Math.max(state.schemaVersion,2);state.recurrence={version:1,format:"itacan-recurrence-foundation",requiredCapabilities:["recurrence-foundation-v1"],externalInventory:clone(inventory),series:[],ruleRevisions:[],templates:[],templateRevisions:[],memberships:[],reservations:[],generationLedger:[]};}
 const n=state.recurrence,ids=nativeReservedIds(state);await ctx.fault?.("beforeRecurrenceIdentityChecks");
 function allocate(input,kind,sid,tid=null){let id=input;if(id===undefined){for(let i=0;i<16;i++){id=ctx.nextId();if(!ids.has(id))break;if(i===15)fail("IDENTITY_EXHAUSTED","No unreserved native identity supplied in sixteen attempts.");}}uuid(id);if(ids.has(id))fail("IDENTITY_CONFLICT","Native identity is already live, retired or externally reserved.",{id});ids.add(id);n.reservations.push({id,kind,seriesId:sid??id,templateId:tid??(kind==="template"?id:null),retired:false});return id;}
 let s=n.series.find(s=>s.id===p.seriesId);
 if(command.type==="recurrence.defineSeries"){
  check(!n.memberships.some(o=>o.taskId===t.id),"Task already belongs to a recurrence series.");endpoints({start:t.start,due:t.due});await ctx.fault?.("beforeRecurrenceRuleValidation");validateRuleInput(p.rule);
  const sid=allocate(p.seriesId,"series"),rid=allocate(p.ruleId,"rule",sid);s={version:1,id:sid,owner:clone(t.owner),partitionId:t.partitionId,revision:1,state:"active",ruleId:rid,ruleRevision:1,calendar:clone(p.rule.calendar),templateId:null,templateRevision:null,initialOccurrenceId:t.id,frontierOccurrenceId:t.id,committedOccurrenceCount:1,createdAt:ctx.now,modifiedAt:ctx.now};n.series.push(s);
  n.ruleRevisions.push(stamped({version:1,ruleId:rid,seriesId:sid,revision:1,previousDigest:null,rule:clone(p.rule),origin:{start:clone(t.start),due:clone(t.due)},originOrdinal:1,offsets:endpoints({start:t.start,due:t.due}),effectiveAfterOccurrenceId:t.id,reason:p.reason,operationId:command.operationId,createdAt:ctx.now,originalEvidenceRef:null,digest:null}));
  n.memberships.push({version:1,taskId:t.id,seriesId:sid,owner:clone(t.owner),partitionId:t.partitionId,ordinal:1,predecessorId:null,successorId:null,ruleId:rid,ruleRevision:1,templateId:null,templateRevision:null,generationOperationId:null,generationKey:null,originalEndpoints:{start:clone(t.start),due:clone(t.due)}});
 }else{
  check(s&&s.initialOccurrenceId===t.id&&canonical(s.owner)===canonical(p.owner)&&s.partitionId===p.partitionId,"Series/initial occurrence ownership mismatch.");if(s.revision!==p.expectedSeriesRevision)fail("REVISION_CONFLICT","Series revision changed.");
  if(command.type==="recurrence.reviseRule"){
   if(s.committedOccurrenceCount>1)fail("UNSUPPORTED_OPERATION","Rule edits after generation require separately reviewed reanchoring.");
   if(s.ruleRevision!==p.expectedRuleRevision)fail("REVISION_CONFLICT","Rule revision changed.");check(p.effectiveAfterOccurrenceId===t.id,"B1 rule boundary must be initial occurrence.");await ctx.fault?.("beforeRecurrenceRuleValidation");validateRuleInput(p.rule);const offsets=endpoints(p.origin),prior=n.ruleRevisions.find(r=>r.ruleId===s.ruleId&&r.revision===s.ruleRevision);
   s.ruleRevision++;s.calendar=clone(p.rule.calendar);n.ruleRevisions.push(stamped({version:1,ruleId:s.ruleId,seriesId:s.id,revision:s.ruleRevision,previousDigest:prior.digest,rule:clone(p.rule),origin:clone(p.origin),originOrdinal:1,offsets,effectiveAfterOccurrenceId:t.id,reason:p.reason,operationId:command.operationId,createdAt:ctx.now,originalEvidenceRef:null,digest:null}));
  }else{
   if(n.templateRevisions.some(r=>r.seriesId===s.id&&r.version===2))fail("UNSUPPORTED_OPERATION","Prepared series require version-2 complete template revisions.");
   await ctx.fault?.("beforeRecurrenceTemplateNormalization");check(Array.isArray(p.nodes),"Full explicit node draft required.");let def,prior=null,removed=new Set();
   if(command.type==="recurrence.defineTemplate"){check(s.templateId===null,"Initial template is already defined.");const id=allocate(p.templateId,"template",s.id);def={version:1,id,seriesId:s.id,owner:clone(s.owner),partitionId:s.partitionId,revision:1};n.templates.push(def);s.templateId=id;s.templateRevision=1;}
   else{
    if(s.templateRevision!==p.expectedTemplateRevision)fail("REVISION_CONFLICT","Template revision changed.");check(p.effectiveAfterOccurrenceId===t.id,"B1 template boundary must be initial occurrence.");def=n.templates.find(x=>x.id===s.templateId);check(!!def,"Template missing.");prior=n.templateRevisions.find(x=>x.templateId===def.id&&x.revision===def.revision);check(Array.isArray(p.deletions),"Explicit subtree deletion confirmations required.");
    for(const d of p.deletions){record(d,["nodeId","cascade","descendantIds"]);uuid(d.nodeId);check(prior.nodes.some(x=>x.id===d.nodeId)&&typeof d.cascade==="boolean"&&Array.isArray(d.descendantIds),"Invalid explicit template deletion.");const tree=new Set([d.nodeId]);let grew=true;while(grew){grew=false;for(const node of prior.nodes)if(tree.has(node.parentNodeId)&&!tree.has(node.id)){tree.add(node.id);grew=true;}}const descendants=[...tree].filter(id=>id!==d.nodeId).sort();check(canonical(descendants)===canonical([...d.descendantIds].sort())&&(descendants.length===0||d.cascade),"Template deletion descendant confirmation changed.");for(const id of tree){check(!removed.has(id),"Overlapping template deletion.");removed.add(id);}}
    def.revision++;s.templateRevision=def.revision;
   }
   const nodes=p.nodes.map(d=>{record(d,["state","id","parentNodeId","order","title","body"]);check(["new","existing"].includes(d.state),"Explicit new/existing node intent required.");check(!removed.has(d.id),"Deleted node cannot remain in draft.");if(d.state==="existing")check(prior?.nodes.some(x=>x.id===d.id),"Existing template node missing/foreign.");else allocate(d.id,"node",s.id,def.id);const{state:ignored,...node}=d;return clone(node);});
   if(prior)for(const node of prior.nodes)check(nodes.some(n=>n.id===node.id)||removed.has(node.id),"Omission is not template deletion.");
   for(const id of removed)n.reservations.find(r=>r.id===id).retired=true;
   const next=stamped({version:1,templateId:def.id,seriesId:s.id,revision:def.revision,parentRevision:prior?.revision??null,previousDigest:prior?.digest??null,effectiveAfterOccurrenceId:t.id,reason:p.reason,operationId:command.operationId,createdAt:ctx.now,description:p.description,nodes,digest:null});validateTemplateRevision(next);n.templateRevisions.push(next);
  }
  s.revision++;s.modifiedAt=ctx.now;
 }
 const snapshot={version:1,series:clone(s),rule:clone(n.ruleRevisions.find(r=>r.ruleId===s.ruleId&&r.revision===s.ruleRevision)),template:s.templateId===null?null:{definition:clone(n.templates.find(d=>d.id===s.templateId)),revision:clone(n.templateRevisions.find(r=>r.templateId===s.templateId&&r.revision===s.templateRevision))},membership:clone(n.memberships.find(o=>o.taskId===t.id))};
 return{taskIds:[],eventIds:[],partitionIds:[s.partitionId],recurrence:snapshot.template?.revision.version===2?require("./recurrence-generation").snapshot(state,s,t.id):snapshot};
}
module.exports={RECURRENCE_COMMANDS:TYPES,RECURRENCE_GENERATION_COMMANDS:GENERATION_TYPES,RECURRENCE_STATES:STATES,validateExternalReservations,validateRuleInput,validateRuleRevision,validateTemplateRevision,validateSeries,validateMembership,validateGenerationGraph,generationKey,nativeReservedIds,validateNamespace,validateSnapshot,validateRecurrenceCommand,applyRecurrence};
