"use strict";
const V = require("../src/value"), D = require("../src/domain"), { check, fail } = require("../src/errors"), { sha256 } = require("../src/source-content"), { freeze } = require("../src/snapshot-read");
const task = Object.freeze(["task.create","task.createMany","task.save","task.createRich","task.update","task.relocate","task.complete","task.archive","task.delete","task.editStructure"]);
const step = Object.freeze(["step.add","step.update","step.reorder","step.delete","step.complete"]);
const recurrence = Object.freeze([...require("../src/recurrence").RECURRENCE_COMMANDS,...require("../src/recurrence").RECURRENCE_GENERATION_COMMANDS.commands]);
const same = (a,b) => V.canonical(a) === V.canonical(b), hash = v => sha256(V.canonical(v));
function policy(input) {
 V.jsonValue(input);V.fields(input,["version","owners","commands","inventory","phases"],["version","owners","commands","inventory","phases"]);check(input.version===1,"Unsupported writer policy.");
 check(Array.isArray(input.owners)&&input.owners.length>0&&Array.isArray(input.commands)&&input.commands.length>0,"Explicit writer scopes required.");
 const keys=new Set();for(const p of input.owners){V.fields(p,["owner","partitionId"],["owner","partitionId"]);D.workspace(p.owner);V.referenceId(p.partitionId);check(!keys.has(V.canonical(p.owner)),"Duplicate policy owner.");keys.add(V.canonical(p.owner));}
 check(new Set(input.commands).size===input.commands.length&&input.commands.every(c=>[...task,...step,...recurrence].includes(c)),"Unsupported policy command.");
 require("../src/recurrence").validateExternalReservations(input.inventory);
 V.fields(input.phases,["version","revision","values"],["version","revision","values"]);check(input.phases.version===1&&Array.isArray(input.phases.values),"Explicit Phase snapshot required.");V.text(input.phases.revision);for(const p of input.phases.values){V.fields(p,["projectId","phaseId"],["projectId","phaseId"]);V.referenceId(p.projectId);V.referenceId(p.phaseId);}
 return freeze(V.clone(input));
}
function request(input,family) {
 V.jsonValue(input);V.fields(input,["version","reason","scope","command"],["version","reason","scope","command"]);check(input.version===1,"Unsupported writer request.");V.text(input.reason);const s=input.scope;
 V.fields(s,["authorityId","ownerContextPin","identityPin","inventoryPin","phasePin","partitions"],["authorityId","ownerContextPin","identityPin","inventoryPin","phasePin","partitions"]);V.uuid(s.authorityId);for(const k of ["ownerContextPin","inventoryPin","phasePin"])V.text(s[k]);if(s.identityPin!==null)V.text(s.identityPin);check(Array.isArray(s.partitions)&&s.partitions.length>0,"Explicit partition guards required.");
 for(const p of s.partitions){V.fields(p,["id","owner","expectedRevision"],["id","owner","expectedRevision"]);V.referenceId(p.id);D.workspace(p.owner);V.revision(p.expectedRevision);}
 const c=input.command;check(({task,step,recurrence})[family].includes(c.type),"Wrong writer command family.");check(c.coordination===undefined,"Coordination is reserved for writer admission.");V.revision(c.expectedRepositoryRevision);require("../src/commands").validateCommand(c);
 const clean=t=>{check(!Object.hasOwn(t,"migration")&&!Object.hasOwn(t,"captureSource")&&!Object.hasOwn(t,"createdAt")&&!Object.hasOwn(t,"modifiedAt")&&!Object.hasOwn(t,"archivedAt")&&!Object.hasOwn(t,"deletedAt"),"Creation/provenance fields are reserved.");for(const s of t.steps??[])check(!Object.hasOwn(s,"createdAt")&&!Object.hasOwn(s,"modifiedAt"),"Source Step clocks are reserved.");};
 if(c.type==="task.create")clean(c.payload.task);if(c.type==="task.createMany")c.payload.tasks.forEach(clean);if(c.type==="step.add")clean(c.payload.step);
 if(c.type==="task.update")check(!Object.hasOwn(c.payload.patch,"captureSource"),"Capture provenance is reserved.");
 if(c.type==="task.editStructure")check(Array.isArray(c.payload.content?.appendOriginals)&&c.payload.content.appendOriginals.length===0,"Original evidence cannot be appended by the writer.");
 return freeze(V.clone(input));
}
function candidate(p,state,prior,inventory) {
 const old=new Set(prior.tasks.flatMap(t=>[t.id,...t.steps.map(s=>s.id)]).concat(prior.retiredStepIds,prior.history.map(e=>e.id)));
 const used=new Set();for(const id of state.tasks.flatMap(t=>[t.id,...t.steps.map(s=>s.id)]).concat(state.retiredStepIds,state.history.map(e=>e.id))){if(used.has(id))fail("IDENTITY_CONFLICT","Native identity namespaces overlap.");used.add(id);if(inventory.ids.includes(id)&&!require("../src/history-import").claimedExternal(state,id))fail("IDENTITY_CONFLICT","External identity remains reserved.");if(!old.has(id)&&require("../src/recurrence").nativeReservedIds(prior).has(id))fail("IDENTITY_CONFLICT","Native identity remains reserved.");}
 const guards=p.scope.partitions;for(const t of state.tasks){const before=prior.tasks.find(x=>x.id===t.id);if(!before||!same(before,t)){check(guards.some(g=>g.id===t.partitionId&&same(g.owner,t.owner)),"Candidate exceeds admitted partition scope.");if(before)check(same(before.owner,t.owner),"Owner transfer is deferred.");}}
}
module.exports=Object.freeze({task,step,recurrence,same,hash,policy,request,candidate});
