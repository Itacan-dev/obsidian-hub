"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const proposal=require("./specification-vectors.json");
const {cases,chainCases}=require("./cases.cjs");
const observedIDs=new Set([...cases,...chainCases].map(x=>x.id));
const services=path.resolve(__dirname,"../../../.obsidian/plugins/hub-project-menu/lib/services");

// This checks a document format, never computes recurrence or executes proposed commands.
function validateDocument(doc){
 assert.equal(doc.format,"itacan-d10-proposed-specification-vectors");
 assert.equal(doc.version,1);assert.equal(doc.approved,false);assert.equal(doc.implemented,false);assert.equal(doc.syntheticOnly,true);
 const seen=new Set();
 for(const row of doc.cases){
  assert.match(row.caseId,/^B0-P\d{2}$/);assert(!seen.has(row.caseId));seen.add(row.caseId);
  assert.equal(row.version,1);assert.equal(row.approved,false);
  for(const key of ["scenario","proposedNativeResult","seriesEffect","occurrenceEffect","stepEffect","eventReceiptRelationship"]){assert.equal(typeof row[key],"string");assert(row[key].trim().length>0,`${row.caseId}.${key} must be explicit`);}
  assert(row.decisionIds.length>0);for(const id of row.decisionIds)assert.match(id,/^D10-(?:0[1-9]|1\d|2[0-6])$/);
  assert(Array.isArray(row.unresolvedDependencies));assert(row.evidenceReferences.length>0);
  if(row.observedLegacy){assert(observedIDs.has(row.observedLegacy.caseId),row.observedLegacy.caseId);assert.equal(row.observedLegacy.reference,"evidence.json");}
  if(row.identityExample){
   const {priorIds,newIds,nodeIds,completed,completedAt,completionBinding}=row.identityExample;
   assert.equal(new Set([...priorIds,...newIds,...nodeIds]).size,priorIds.length+newIds.length+nodeIds.length);
   assert.equal(completed,false);assert.equal(completedAt,null);assert.equal(completionBinding,null);
  }
 }
 return true;
}
test("B0 proposed vector document is versioned, unapproved and separate from observations",()=>assert(validateDocument(proposal)));
test("B0 document consistency check rejects duplicate cases and fictitious observed IDs",()=>{
 const duplicate=structuredClone(proposal);duplicate.cases.push(duplicate.cases[0]);assert.throws(()=>validateDocument(duplicate));
 const invented=structuredClone(proposal);invented.cases[0].observedLegacy.caseId="NOT-EXECUTED";assert.throws(()=>validateDocument(invented));
});
test("B0 document consistency rejects approval/version escalation",()=>{
 for(const patch of [{approved:true},{implemented:true},{version:2}])assert.throws(()=>validateDocument({...proposal,...patch}));
 const row=structuredClone(proposal);row.cases[0].approved=true;assert.throws(()=>validateDocument(row));
});
test("B0 template examples forbid reused identities or inherited completion bindings",()=>{
 for(const mutate of [x=>x.newIds[0]=x.priorIds[0],x=>x.completed=true,x=>x.completedAt=123,x=>x.completionBinding="OLD-EVENT"]){
  const doc=structuredClone(proposal);mutate(doc.cases.find(x=>x.identityExample).identityExample);assert.throws(()=>validateDocument(doc));
 }
});
test("B0 every proposal decision reference resolves in the review sheet",()=>{
 const text=fs.readFileSync(path.join(services,"TASK-SERVICE-D10-DECISIONS.md"),"utf8");
 for(const row of proposal.cases)for(const id of row.decisionIds)assert(text.includes(`| ${id} |`),id);
 for(const status of ["Established — Preserve","Recommended — Awaiting approval","Unresolved — Additional evidence required"])assert(text.includes(status));
});
test("B0 contract/handoff documents keep critical recovery, reservation and activation limits explicit",()=>{
 const contracts=fs.readFileSync(path.join(services,"TASK-SERVICE-D10-CONTRACTS.md"),"utf8");
 const handoff=fs.readFileSync(path.join(services,"TASK-SERVICE-PHASE-N1-D-B-IMPLEMENTATION.md"),"utf8");
 for(const token of ["Unimplemented proposals","generationKey","templateNodeId","completionEventId","recovery fence","reservation authority","exhausted","quarantine"])assert(contracts.includes(token),token);
 for(const token of ["N1-E","N1-F","N3","N4","process-crash","STOP FOR REVIEW","D10 remains unapproved"])assert(handoff.includes(token),token);
});
test("B0 proposal coverage distinguishes terminal/calculation failure, recompletion, deletion and rollback",()=>{
 assert.equal(proposal.cases.length,32);
 const row=id=>proposal.cases.find(x=>x.caseId===id);
 assert.match(row("B0-P02").eventReceiptRelationship,/terminal/);
 assert.match(row("B0-P07").eventReceiptRelationship,/No event/);
 assert.match(row("B0-P15").eventReceiptRelationship,/E2/);
 assert.match(row("B0-P17").proposedNativeResult,/never recreate/);
 assert.match(row("B0-P24").proposedNativeResult,/Fence/);
 assert.match(row("B0-P26").proposedNativeResult,/both branches/);
});
