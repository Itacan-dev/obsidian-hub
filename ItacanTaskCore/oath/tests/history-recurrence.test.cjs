"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), H = require("./legacy-harness.cjs"), { O, clone, S } = H;
const I = require("../../tests/history-import-support.cjs"), B = require("../../tests/recurrence-generation-support.cjs");
for (const time of [null, I.NOW - 1000]) test("actual imported binding is historical; only later genuine recompletion qualifies: " + time, async t => {
    const capture = await I.mappingCapture([{ entryId: "p", legacyId: "old-p", completed: true, completedAt: time }]);
    const v = await I.imported("memory", t, capture), task = v.result.tasks[0]; assert(task.completed);
    const before = clone(v.f.storage.state), premature = H.nativeTarget(v.f.repo, task);
    const historical = O.assessCompletionEligibility(premature, H.evidenceOf(v.f));
    assert.equal(historical.state, "unknown"); assert.equal(historical.displayCompleted, true);
    assert.equal(O.resolveCommitmentTarget(premature, H.evidenceOf(v.f)).navigation, null);
    assert.equal(v.f.repo.queryHistory().length, 1); assert.equal(v.f.repo.queryHistory()[0].recordedAt, null);
    await v.f.repo.execute(I.mutate(task, "task.complete", { completed: false }, "reopen-import"));
    const open = v.f.repo.getTask(task.id), target = H.nativeTarget(v.f.repo, open);
    assert.equal(O.assessCompletionEligibility(target, H.evidenceOf(v.f)).reason, "TARGET_OPEN");
    const second = await v.f.repo.execute(I.mutate(open, "task.complete", { completed: true, completedAt: null }, "genuine-after-import"));
    const r = O.assessCompletionEligibility(target, H.evidenceOf(v.f)); assert.equal(r.state, "eligible"); assert.equal(r.eventId, second.change.eventIds[0]);
    assert.equal(v.f.repo.queryHistory().length, 2); assert.equal(before.history[0].legacy.format, "itacan-imported-history-ref");
    assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).version, 1);
});
test("completed target without proven event quarantines its entire tree without an Oath target", async t => {
    const capture = await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: false }, { entryId: "s", kind: "step", parent: "p", legacyId: "s", completed: true, noEvent: true }]);
    const v = await I.imported("memory", t, capture); assert.equal(v.result.tasks.length, 0); assert.equal(v.f.repo.queryHistory().length, 0);
    assert.equal(v.f.repo.getHistoryImportPlan(v.planId, { version: 1 }).plan.treeDispositions[0].disposition, "quarantined-tree");
    const plan = v.f.repo.getHistoryImportPlan(v.planId, { version: 1 }).plan, reservation = plan.reservations.find(r => r.kind === "task");
    const target = { version: 1, session: { deviceId: "synthetic", oathId: "unpublished" }, original: { kind: "native-task", taskId: reservation.id, text: "Snapshot" }, owner: reservation.owner, authority: { kind: "native", authorityId: v.f.repo.info().storeId, partitionId: reservation.partitionId, taskId: reservation.id, enrollment: { repositoryRevision: v.f.repo.info().revision, revisionId: v.f.repo.info().revisionId, taskRevision: 1 }, aliasPin: null } };
    assert.equal(O.resolveCommitmentTarget(target, H.evidenceOf(v.f)).state, "quarantined");
});
test("explicit preparation is pending publication, never a live commitment", async t => {
    const v = await I.prepared("memory", t, await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: false }])), reservation = v.prepared.historyImport.plan.reservations.find(r => r.kind === "task");
    const target = { version: 1, session: { deviceId: "synthetic", oathId: "unpublished" }, original: { kind: "native-task", taskId: reservation.id, text: "Snapshot" }, owner: reservation.owner, authority: { kind: "native", authorityId: v.f.repo.info().storeId, partitionId: reservation.partitionId, taskId: reservation.id, enrollment: { repositoryRevision: v.f.repo.info().revision, revisionId: v.f.repo.info().revisionId, taskRevision: 1 }, aliasPin: null } };
    assert.equal(O.resolveCommitmentTarget(target, H.evidenceOf(v.f)).state, "pending-native-publication");
    assert.equal(O.assessCompletionEligibility(target, H.evidenceOf(v.f)).state, "unknown"); assert.equal(v.f.repo.queryTasks().length, 0);
});
test("imported nested Step bindings do not complete their open parent", async t => {
    const capture = await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: false }, { entryId: "s", kind: "step", parent: "p", legacyId: "s", completed: true }, { entryId: "n", kind: "step", parent: "p", stepParent: "s", legacyId: "n", completed: true }]);
    const v = await I.imported("memory", t, capture), task = v.result.tasks[0], target = H.nativeTarget(v.f.repo, task);
    assert(!task.completed); assert.equal(task.steps.filter(s => s.completed).length, 2); assert.equal(O.assessCompletionEligibility(target, H.evidenceOf(v.f)).reason, "TARGET_OPEN");
    assert.equal(v.f.repo.queryHistory().length, 2);
});
function recurrenceEvidence(v) {
    const e = H.evidenceOf(v.f);
    e.registry = e.native.state.partitions.map((p, i) => ({ owner: p.owner, partitionId: p.id, root: ["Projects/Itacan", "Projects/Obsidian Hub", "Projects/Private", "Resources/Knowledge"][i], shared: p.kind === "git-project", status: "active", available: true, shareApproval: null }));
    return e;
}
test("actual B2 A/E1/B and A/E2 preserve occurrence commitment and current completion proof", async t => {
    const nodes = [B.node()], v = await B.prepared("memory", t, {}, nodes), target = H.nativeTarget(v.f.repo, v.f.repo.getTask(v.task.id));
    const first = await v.f.repo.execute(B.complete(v)), original = first.recurrence.completion, b = v.f.repo.getTask(original.outcome.result.taskId);
    assert.equal(O.resolveCommitmentTarget(target, recurrenceEvidence(v)).task.id, v.task.id);
    assert.equal(O.assessCompletionEligibility(target, recurrenceEvidence(v)).eventId, original.completionEventId);
    assert.notEqual(b.id, v.task.id); assert(b.steps.every(s => !nodes.some(n => n.id === s.id)));
    const bTarget = H.nativeTarget(v.f.repo, b); assert.equal(O.assessCompletionEligibility(bTarget, recurrenceEvidence(v)).reason, "TARGET_OPEN");
    await v.f.repo.execute(B.complete(v, b.id)); assert.equal(O.resolveCommitmentTarget(target, recurrenceEvidence(v)).task.id, v.task.id);
    await v.f.repo.execute(B.mutate(v.f.repo.getTask(v.task.id), "task.complete", { completed: false }, "reopen-A"));
    assert.equal(O.assessCompletionEligibility(target, recurrenceEvidence(v)).reason, "TARGET_OPEN");
    const second = (await v.f.repo.execute(B.complete(v))).recurrence.completion;
    assert.equal(second.reused, true); assert.deepEqual(second.outcome, original.outcome); assert.notEqual(second.completionEventId, original.completionEventId);
    assert.equal(O.assessCompletionEligibility(target, recurrenceEvidence(v)).eventId, second.completionEventId);
    await v.f.repo.execute(B.editTemplate(v, { taskContent: B.taskContent({ title: "Future only" }) }));
    assert.equal(O.resolveCommitmentTarget(target, recurrenceEvidence(v)).task.id, v.task.id);
    const fenced = recurrenceEvidence(v); fenced.native.recovery = { state: "unknown", taskIds: [], stepIds: [] }; assert.equal(O.assessCompletionEligibility(target, fenced).reason, "RECOVERY_FENCED");
});
test("four-level Steps retain identity through reorder/reparent and retire after deletion", async t => {
    const ids = [1, 2, 3, 4].map(n => S.id(51000 + n));
    const v = await H.nativeFixture(t, "private", { steps: ids.map((id, n) => ({ id, title: "Same title", parentStepId: n ? ids[n - 1] : null, order: 0 })) });
    await v.mutate("step.complete", { stepId: ids[3], completed: true }, "step-only"); assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).reason, "TARGET_OPEN");
    await v.mutate("step.update", { stepId: ids[3], patch: { parentStepId: null, order: 1 } }, "reparent");
    await v.mutate("step.reorder", { parentStepId: null, stepIds: [ids[3], ids[0]] }, "reorder");
    assert.equal(O.resolveCommitmentTarget(v.target, v.evidence()).task.id, v.task.id);
    await v.mutate("step.delete", { stepId: ids[0], cascade: true }, "retire"); const bad = clone(v.target); bad.original.taskId = bad.authority.taskId = ids[0];
    assert.equal(O.resolveCommitmentTarget(bad, v.evidence()).state, "retired-step");
    await assert.rejects(v.mutate("step.add", { step: { id: ids[0], title: "Replacement", order: 1 } }, "reuse"), e => e.code === "IDENTITY_CONFLICT");
});
test("historical-only append cannot create a current completion or binding", async t => {
    const v = await H.nativeFixture(t), event = { id: S.id(55000), operationId: "historical-only", partitionId: v.task.partitionId, kind: "task", taskId: null, stepId: null, timestamp: null, recordedAt: null, ownerAtEvent: v.task.owner, workingContext: null, oathId: null, sessionId: null, snapshot: { title: "Recorded", parentTitle: null }, counted: true, reopenedAt: null, legacy: { raw: "private" } };
    await v.f.repo.execute({ type: "history.record", operationId: event.operationId, payload: { record: event } });
    assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).reason, "TARGET_OPEN"); assert.equal(v.f.storage.state.bindings.length, 0);
});
