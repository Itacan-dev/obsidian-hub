"use strict";
const test = require("node:test"), S = require("./history-support.cjs"), { assert } = S;
const durable = require("../../history/durable-projection").projectDurableHistoryCompatibility;
test("actual published import preserves exact raw representation once and matches existing complete E2 Statistics inputs", async t => {
 const f = await S.imported(t), r = await f.feed.read(), state = await f.state(); assert.deepEqual(r.completions, durable(state, { version: 1, projection: "statistics" }).records);
 assert.equal(r.completions.length, f.capture.history.filter(Boolean).length); assert(r.records.length); assert((await f.port.read()).history.overlap.rows.every(r => r.key && r.digest.length === 64));
});
test("imported parent/Step reopening suppression and recompletion match E2 exactly", async t => {
 const f = await S.imported(t); for (const binding of (await f.state()).bindings.slice(0, 2)) {
  let task = f.repo.getTask(binding.taskId); await f.repo.execute(S.E.base.mutate(task, binding.stepId ? "step.complete" : "task.complete", { ...(binding.stepId ? { stepId: binding.stepId } : {}), completed: false }));
  let r = await f.feed.read(); assert.deepEqual(r.completions, durable(await f.state(), { version: 1, projection: "statistics" }).records);
  task = f.repo.getTask(binding.taskId); await f.repo.execute(S.E.base.mutate(task, binding.stepId ? "step.complete" : "task.complete", { ...(binding.stepId ? { stepId: binding.stepId } : {}), completed: true }));
  r = await f.feed.read(); assert.deepEqual(r.completions, durable(await f.state(), { version: 1, projection: "statistics" }).records);
 }
});
for (const change of ["missing", "changed", "extra-identical"]) test("import overlap " + change + " is unavailable, never title/path matched", async t => {
 const f = await S.imported(t), raw = f.legacy.records; if (change === "missing") raw.shift(); else if (change === "changed") raw[0] = { ...raw[0], text: "Changed" }; else raw.push(S.V.clone(raw[0])); f.legacy.change(raw); await assert.rejects(f.feed.read(), e => e.code === "HISTORY_UNAVAILABLE");
});
test("unrelated later legacy rows survive import matching in their observed order", async t => {
 const f = await S.imported(t), addition = { id: 73, text: "Later", path: "Projects/Other/Tasks.md", timestamp: S.E.NOW, projectId: "other" }; f.legacy.change([addition, ...f.legacy.records]); const r = await f.feed.read(); assert.deepEqual(r.completions[0], addition);
});

test("atomic Save imported reopening and mixed parent/Step effects preserve exact publication order", async t => {
 const A=require("../../atomic-task/tests/runtime-support.cjs"),capture=await S.E.mappingCapture([{entryId:"p",legacyId:"p",completed:true},{entryId:"s",kind:"step",parent:"p",legacyId:"s",completed:false}]);
 const f=await S.imported(t,capture,{taskMutationVersion:1}),task=f.repo.queryTasks()[0],adapter={repo:f.repo,options:f.f.options,storage:{state:await f.state()}},save=A.save(adapter,task,{parentCompletion:{kind:"reopen"}});save.payload.draft.steps[0].completion={kind:"complete",completedAt:null};
 const out=await f.repo.execute(save),state=await f.state(),r=await f.feed.read();assert.deepEqual(r.completions,durable(state,{version:1,projection:"statistics"}).records);
 assert.equal(r.completions.length,1);assert.equal(r.records[0].kind,"step");assert.equal(r.records[0].timestamp,null);assert.equal(r.records[0].nativeHistory.origin,"genuine-step-completion");
 const e=(await f.port.read()).history.events.find(e=>e.eventId===out.change.eventIds[1]);assert.equal(e.receipt.index,1);assert.equal(state.historyImport.projection.suppressions.length,1);
});

for(const vector of S.E.vectorInputs())test("accounted full frozen compatibility vector: "+vector.id,async t=>{
 const f=await S.imported(t,S.E.rawCapture(vector.records));let expected;
 try{expected=durable(await f.state(),{version:1,projection:"statistics"}).records;}catch(e){assert.equal(e.code,"HISTORY_UNAVAILABLE");await assert.rejects(f.feed.read(),{code:"HISTORY_UNAVAILABLE"});return;}
 const {queryHistory}=require(S.lib+"domain/history"),{recordedHistoryQuery}=require(S.lib+"services/task-history-legacy-read"),{statisticsCompletions}=require(S.lib+"services/statistics");
 let safe;
 try{safe=statisticsCompletions(recordedHistoryQuery(queryHistory(expected)));}catch(e){assert.equal(e.code,"HISTORY_UNAVAILABLE");assert(["unsupported-relevant-id","unsupported-relevant-owner"].includes(vector.id));await assert.rejects(f.feed.read(),{code:"HISTORY_UNAVAILABLE"});return;}
 const r=await f.feed.read();assert.deepEqual(r.completions,safe);assert.deepEqual(f.legacy.records,f.capture.history);
 // The oracle deliberately runs queryHistory and the actual recorded adapter
 // before calculating. Preserve its complete model and malformed-row handling.
 assert.deepEqual(S.E.observe(r.completions,vector.inputs,vector.now),S.E.observe(expected,vector.inputs,vector.now));
});
