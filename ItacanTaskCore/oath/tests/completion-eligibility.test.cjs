"use strict";
const test = require("node:test"), { assert, H, I, fixture, bind, acknowledgeAndCut, settle, gate } = require("./adapter-support.cjs");
const B = require("../../tests/recurrence-generation-support.cjs");
for (const timestamp of [null, 1, 1792224000000]) test("actual genuine receipt and retry use publication order: " + timestamp, async t => {
 const b = await fixture(t); await b.adapter.refresh(); const command = { type: "task.complete", operationId: "real", taskId: b.v.task.id, expectedRevision: b.v.task.revision, payload: { completed: true, completedAt: timestamp } };
 await b.v.f.repo.execute(command); const first = await settle(b.adapter); assert.equal(first.rows[0].eligibility.state, "eligible"); assert.equal(first.rows[0].task.completedAt, timestamp);
 assert((await b.v.f.repo.execute(command)).replayed); assert.deepEqual((await b.adapter.refresh()).rows, first.rows); assert.equal(b.v.f.repo.queryHistory().length, 1);
 await b.v.mutate("task.complete", { completed: false }, "open"); assert.equal((await settle(b.adapter)).rows[0].eligibility.reason, "TARGET_OPEN");
 await b.v.mutate("task.complete", { completed: true, completedAt: null }, "again"); assert.equal((await settle(b.adapter)).rows[0].eligibility.state, "eligible"); assert.equal(b.v.f.repo.queryHistory().length, 2);
 assert(b.provider.counts.f1Assessments > 0);
});
test("F1 preparation comparison is necessary but cannot prove independent enrollment", async t => {
 const b = await fixture(t, { unproven: true }); await b.v.mutate("task.complete", { completed: true }, "during-enrollment-save");
 assert.equal(H.O.assessCompletionEligibility(b.v.target, b.v.evidence()).state, "eligible");
 const r = (await b.adapter.refresh()).rows[0]; assert.equal(r.task.completed, true); assert.equal(r.eligibility.state, "unknown"); assert.equal(r.eligibility.reason, "ENROLLMENT_ORDER_UNPROVEN");
});
for (const stage of ["failed", "acknowledgement-lost", "completed-before-cut"]) test("no closed witness from uncertain enrollment: " + stage, async t => {
 const v = await H.nativeFixture(t);
 if (stage === "completed-before-cut") { await v.mutate("task.complete", { completed: true }); await assert.rejects(acknowledgeAndCut(v, async () => ({ saved: true }))); }
 else await assert.rejects(acknowledgeAndCut(v, async () => { if (stage === "acknowledgement-lost") await v.mutate("task.complete", { completed: true }); throw Error(stage); }));
 const b = await bind(t, v); if (!v.f.repo.getTask(v.task.id).completed) await v.mutate("task.complete", { completed: true }); assert.notEqual((await b.adapter.refresh()).rows[0].eligibility.state, "eligible");
});
test("completion between save start and publication is not post-enrollment work", async t => {
 const v = await H.nativeFixture(t), save = gate(), started = gate();
 const witness = acknowledgeAndCut(v, async () => { started.resolve(); await save.promise; return { saved: true }; }); await started.promise;
 await v.mutate("task.complete", { completed: true }, "before-durable-save"); save.resolve(); await assert.rejects(witness);
 const b = await bind(t, v); assert.equal((await b.adapter.refresh()).rows[0].eligibility.state, "unknown");
});
const corruptions = {
 "missing-binding": p => p.rows[0].binding = null,
 "missing-event": p => p.rows[0].event = null,
 "missing-receipt": p => p.rows[0].creation = null,
 "foreign-binding-task": p => p.rows[0].binding.taskId = H.S.id(999),
 "step-binding": p => p.rows[0].binding.stepId = H.S.id(999),
 "wrong-binding-event": p => p.rows[0].binding.eventId = H.S.id(999),
 "wrong-event-target": p => p.rows[0].event.taskId = H.S.id(999),
 "event-step": p => p.rows[0].event.stepId = H.S.id(999),
 "uncounted": p => p.rows[0].event.counted = false,
 "reopened": p => p.rows[0].event.reopenedAt = 1,
 "wrong-receipt-operation": p => p.rows[0].creation.operationId = "other",
 "wrong-receipt-task": p => p.rows[0].creation.commandTaskId = H.S.id(999),
 "wrong-receipt-owner": p => p.rows[0].creation.taskAfter.owner.id = "other",
 "wrong-receipt-partition": p => p.rows[0].creation.taskAfter.partitionId = "other",
 "wrong-event-owner": p => p.rows[0].event.ownerAtEvent.id = "other",
 "wrong-event-time": p => p.rows[0].event.timestamp = null,
 "uncommitted-receipt": p => p.rows[0].creation.repositoryRevision = p.head.repositoryRevision + 1,
 "wrong-publication-id": p => p.rows[0].creation.revisionId = H.S.id(999),
 "not-a-transition": p => p.rows[0].creation.requestedCompletion = false,
 "wrong-creation-event": p => p.rows[0].creation.createdEventId = H.S.id(999),
 "unproven-cut": p => p.cutEvidence.state = "unproven",
 "wrong-authority": p => p.head.authorityId = H.S.id(999),
 "wrong-request": p => p.requestGeneration++,
 "wrong-context": p => p.ownerContextPin = "another-owner-snapshot",
 "missing-head": p => p.head = null
};
for (const [name, change] of Object.entries(corruptions)) test("scoped proof corruption cannot qualify: " + name, async t => {
 const b = await fixture(t); await b.v.mutate("task.complete", { completed: true }); b.provider.settings.afterProof = p => { change(p); return p; }; const r = await b.adapter.refresh(); assert(r.rows.every(row => row.eligibility.state !== "eligible"));
});
for (const origin of ["historical-import", "history-record", "historical-only", "initial-completed-creation", "step-completion", "unverifiable"]) test("non-genuine provenance never qualifies: " + origin, async t => {
 const b = await fixture(t); await b.v.mutate("task.complete", { completed: true }); b.provider.settings.afterProof = p => { p.rows[0].event.origin = origin; return p; }; assert.notEqual((await b.adapter.refresh()).rows[0].eligibility.state, "eligible");
});
for (const time of [null, I.NOW - 1000]) test("actual imported binding excluded; genuine work after open enrollment qualifies: " + time, async t => {
 const iv = await I.imported("memory", t, await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: true, completedAt: time }]));
 const v = { f: iv.f, task: iv.result.tasks[0] }; v.target = H.nativeTarget(v.f.repo, v.task); const b = await bind(t, v);
 assert.equal((await b.adapter.refresh()).rows[0].task.completed, true); assert.notEqual(b.adapter.getSnapshot().rows[0].eligibility.state, "eligible");
 await v.f.repo.execute(I.mutate(v.f.repo.getTask(v.task.id), "task.complete", { completed: false }, "open-import")); b.adapter.dispose();
 v.target = H.nativeTarget(v.f.repo, v.f.repo.getTask(v.task.id)); const order = await acknowledgeAndCut(v, async () => ({ references: [v.target.original] })); const next = await bind(t, v, { order });
 await v.f.repo.execute(I.mutate(v.f.repo.getTask(v.task.id), "task.complete", { completed: true, completedAt: null }, "new-work")); assert.equal((await next.adapter.refresh()).rows[0].eligibility.state, "eligible"); assert.equal(v.f.repo.queryHistory().length, 2);
});
test("actual B2 E1 and recompletion E2 qualify A without following B", async t => {
 const r = await B.prepared("memory", t, {}, [B.node()]), v = { f: r.f, task: r.f.repo.getTask(r.task.id) }; v.target = H.nativeTarget(v.f.repo, v.task);
 const order = await acknowledgeAndCut(v, async () => ({ session: v.target.session })), b = await bind(t, v, { order });
 const first = await r.f.repo.execute(B.complete(r)); const successor = first.recurrence.completion.outcome.result.taskId;
 assert.equal((await b.adapter.refresh()).rows[0].eligibility.state, "eligible"); assert.equal(b.adapter.getSnapshot().rows[0].task.id, v.task.id); assert.notEqual(successor, v.task.id);
 await r.f.repo.execute(B.complete(r, successor)); assert.equal((await settle(b.adapter)).rows[0].task.id, v.task.id);
 await r.f.repo.execute(B.mutate(r.f.repo.getTask(v.task.id), "task.complete", { completed: false }, "reopen-A")); assert.equal((await settle(b.adapter)).rows[0].eligibility.state, "ineligible");
 const second = await r.f.repo.execute(B.complete(r)); assert(second.recurrence.completion.reused); assert.notEqual(second.recurrence.completion.completionEventId, first.recurrence.completion.completionEventId); assert.equal((await settle(b.adapter)).rows[0].eligibility.state, "eligible");
 await r.f.repo.execute(B.editTemplate(r, { taskContent: B.taskContent({ title: "Future" }) })); assert.equal((await settle(b.adapter)).rows[0].task.title, v.task.title);
 b.provider.settings.recovery = "unknown"; b.provider.invalidate(); assert.equal((await settle(b.adapter)).readiness.state, "recovering");
});
test("four-level actual Step edits and historical append cannot complete parent", async t => {
 const ids = [1,2,3,4].map(i => H.S.id(51000 + i)); const b = await fixture(t, { task: { steps: ids.map((id, i) => ({ id, title: "Same", parentStepId: i ? ids[i-1] : null, order: 0 })) } });
 await b.v.mutate("step.complete", { stepId: ids[3], completed: true }, "step"); assert.equal((await b.adapter.refresh()).rows[0].eligibility.reason, "TARGET_OPEN");
 await b.v.mutate("step.update", { stepId: ids[3], patch: { parentStepId: null, order: 1 } }, "reparent"); await b.v.mutate("step.reorder", { parentStepId: null, stepIds: [ids[3], ids[0]] }, "reorder"); assert.equal((await settle(b.adapter)).rows[0].task.steps.length, 4);
 await b.v.mutate("step.delete", { stepId: ids[0], cascade: true }, "retire"); assert.equal((await settle(b.adapter)).rows[0].task.steps.length, 1);
 const event = { id: H.S.id(59000), operationId: "history", partitionId: b.v.task.partitionId, kind: "task", taskId: null, stepId: null, timestamp: null, recordedAt: null, ownerAtEvent: b.v.task.owner, workingContext: null, oathId: null, sessionId: null, snapshot: { title: "Historical", parentTitle: null }, counted: true, reopenedAt: null, legacy: { private: "SENTINEL" } };
 await b.v.f.repo.execute({ type: "history.record", operationId: "history", payload: { record: event } }); assert.equal((await settle(b.adapter)).rows[0].eligibility.reason, "TARGET_OPEN");
 await b.v.mutate("task.complete", { completed: true }, "parent"); assert.equal((await settle(b.adapter)).rows[0].eligibility.state, "eligible");
});
