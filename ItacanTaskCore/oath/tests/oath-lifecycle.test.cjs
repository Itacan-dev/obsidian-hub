"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), H = require("./legacy-harness.cjs"), { O, clone } = H;
const pure = require(H.root + "/" + H.lib + "/domain/oath.js");
for (const mode of ["standard", "strict"]) test("actual Oath latch, duplicate notifications and one terminal outcome: " + mode, async () => {
    const h = H.legacy(), f = h.fixture(); try {
        h.commit(f, ["parent", "complete"]); await f.oath.resolveWork();
        if (mode === "strict") {
            f.wizard.data.oathsByDevice[f.oath.deviceId].current.policy = { mode: "strict", applications: [] };
            f.wizard.data.oathsByDevice[f.oath.deviceId].current.strictSessionId = "fake-session";
            f.oath.strict = { owns: () => true, release: async () => {}, configureEnabled() {}, detach() {} };
        }
        const current = f.oath.current; assert.equal(pure.oathProgress(f.oath.work).completed, 1);
        f.contents.set("Projects/Private/Tasks.md", f.contents.get("Projects/Private/Tasks.md").replace("- [ ] Parent", "- [x] Parent"));
        await f.oath.resolveWork(); await f.oath.markFulfilled(); const at = f.oath.current.fulfilledAt; assert.equal(at, f.now);
        for (let i = 0; i < 10; i++) await f.oath.markFulfilled(); assert.equal(f.counts.persists, 1);
        f.contents.set("Projects/Private/Tasks.md", f.contents.get("Projects/Private/Tasks.md").replace("- [x] Parent", "- [ ] Parent")); await f.oath.resolveWork();
        assert.equal(pure.oathProgress(f.oath.work).completed, 1); assert.equal(f.oath.current.fulfilledAt, at);
        assert.equal(await f.oath.end(current.id, "broken"), "ended"); assert.equal(await f.oath.end(current.id, "broken"), "inactive"); assert.equal(f.oath.bucket.history.length, 1); assert.equal(f.oath.bucket.history[0].state, "fulfilled");
    } finally { await f.close(); }
});
test("actual partial progress can fall before latch; Steps never complete parent", async () => {
    const h = H.legacy(), f = h.fixture(); try { h.commit(f, ["parent", "complete"]); await f.oath.resolveWork(); assert.equal(pure.oathProgress(f.oath.work).completed, 1);
        f.contents.set("Projects/Private/Tasks.md", f.contents.get("Projects/Private/Tasks.md").replace("- [x] Completed", "- [ ] Completed").replace("- [ ] Nested", "- [x] Nested")); await f.oath.resolveWork(); await f.oath.markFulfilled();
        assert.equal(pure.oathProgress(f.oath.work).completed, 0); assert.equal(f.oath.current.fulfilledAt, null);
    } finally { await f.close(); }
});
test("actual scheduled completion, deadline and cancellation remain distinct", async () => {
    const h = H.legacy(), f = h.fixture(); try { h.commit(f, ["complete"], { type: "project", id: "private" }, "scheduled"); await f.oath.resolveWork(); await f.oath.markFulfilled(); assert.equal(f.oath.current.fulfilledAt, null);
        assert.equal(await f.oath.end(f.oath.current.id, "cancel"), "cancelled"); assert.equal(f.oath.bucket.history.length, 0);
        h.commit(f, ["absent"]); const deadline = f.oath.current.startedAt + f.oath.current.durationMs; f.oath.now = () => deadline;
        await f.oath.resolveWork(); await f.oath.markFulfilled(); assert.equal(f.oath.current.fulfilledAt, deadline); assert.equal(f.oath.active, true); assert.equal(f.oath.bucket.history.length, 0);
    } finally { await f.close(); }
});
test("failed save retains actual in-process latch; restart after reopen exposes the explicit limit", async () => {
    const h = H.legacy(), f = h.fixture(); try {
        h.commit(f, ["complete"]); await f.oath.resolveWork(); f.failPersist(true); await assert.rejects(f.oath.markFulfilled()); assert(f.oath.pendingFulfilment);
        f.contents.set("Projects/Private/Tasks.md", f.contents.get("Projects/Private/Tasks.md").replace("- [x] Completed", "- [ ] Completed")); await f.oath.resolveWork(); assert(f.oath.fulfilled);
        const Constructor = f.oath.constructor; f.oath.destroy(); f.oath = new Constructor(f.plugin, { restore() {}, exit: async () => {}, destroy() {} }, { now: () => f.now, notice() {} });
        await f.oath.resolveWork(); assert.equal(f.oath.pendingFulfilment, undefined); assert.equal(f.oath.fulfilled, false); assert.equal(f.oath.current.fulfilledAt, null);
    } finally { await f.close(); }
});
test("Strict missing host session records interruption without preparing a host", async () => {
    const h = H.legacy(), f = h.fixture(); try { h.commit(f); const c = f.wizard.data.oathsByDevice[f.oath.deviceId].current; c.policy = { mode: "strict" }; c.strictSessionId = "lost"; c.lastObservedAt = f.now - 5000;
        let prepares = 0; f.oath.strict = { owns: () => false, prepare: () => { prepares++; throw Error("No physical host"); }, detach() {} };
        await f.oath.recoverStrict(); assert.equal(prepares, 0); assert.equal(f.oath.current.state, "interrupted"); assert.equal(f.oath.bucket.history.length, 1); assert.equal(f.oath.current.interruptionTimeUnknown, true);
    } finally { await f.close(); }
});
for (const state of ["scheduled", "active", "fulfilled", "broken", "interrupted", "invalid"]) test("migration protection preserves terminal versus committed semantics: " + state, async t => {
    const v = await H.nativeFixture(t), r = O.assessMigrationProtection([{ id: v.target.session.oathId, deviceId: v.target.session.deviceId, state, fulfilledAt: 123, targets: [v.target] }], v.evidence());
    assert.equal(r.migrationAuthorized, false); assert.equal(r.protectedTrees.length, ["scheduled", "active"].includes(state) ? 1 : 0);
});
test("unresolved or competing active snapshots block migration proof", async t => {
    const v = await H.nativeFixture(t), o = { id: v.target.session.oathId, deviceId: v.target.session.deviceId, state: "active", targets: [v.target] };
    for (const entries of [[{ ...o, targets: [] }], [o, o], [{ state: "active" }]]) assert.equal(O.assessMigrationProtection(entries, v.evidence()).state, "protection-unknown");
});
for (const timestamp of [null, 1, 1792224000000]) test("genuine completion eligibility uses receipt order, not timestamp: " + timestamp, async t => {
    const v = await H.nativeFixture(t); assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).reason, "TARGET_OPEN");
    const command = { type: "task.complete", operationId: "genuine", taskId: v.task.id, expectedRevision: v.task.revision, payload: { completed: true, completedAt: timestamp } };
    const first = await v.f.repo.execute(command), e = v.evidence(); const eligibility = O.assessCompletionEligibility(v.target, e); assert.equal(eligibility.state, "eligible"); assert.equal(eligibility.eventId, first.change.eventIds[0]);
    assert.equal((await v.f.repo.execute(command)).replayed, true); assert.deepEqual(O.assessCompletionEligibility(v.target, v.evidence()), eligibility);
    await v.mutate("task.complete", { completed: false }, "reopen"); assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).reason, "TARGET_OPEN");
    await v.mutate("task.complete", { completed: true, completedAt: null }, "recomplete"); const second = O.assessCompletionEligibility(v.target, v.evidence()); assert.equal(second.state, "eligible"); assert.notEqual(second.eventId, eligibility.eventId);
    assert.equal(v.f.repo.queryHistory({ taskId: v.task.id, counted: true }).length, 1);
});
test("native archive preserves existing target; enrollment after archive blocks", async t => {
    const v = await H.nativeFixture(t); await v.mutate("task.complete", { completed: true }); await v.mutate("task.archive", { archived: true });
    assert.equal(O.resolveCommitmentTarget(v.target, v.evidence()).reason, "RETAINED_ARCHIVED_TARGET"); assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).state, "eligible");
    const later = H.nativeTarget(v.f.repo, v.f.repo.getTask(v.task.id)); assert.equal(O.resolveCommitmentTarget(later, v.evidence()).reason, "ENROLLMENT_PROOF_UNAVAILABLE");
});
test("native deletion retains identity and History, never resurrects a commitment", async t => {
    const v = await H.nativeFixture(t); await v.mutate("task.complete", { completed: true }); await v.mutate("task.delete", {});
    assert.equal(O.resolveCommitmentTarget(v.target, v.evidence()).state, "deleted"); assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).state, "unknown"); assert.equal(v.f.repo.queryHistory().length, 1);
    await assert.rejects(v.f.repo.execute({ type: "task.create", operationId: "recreate", payload: { task: { id: v.task.id, owner: v.task.owner, title: "Same title" } } }), e => e.code === "IDENTITY_CONFLICT");
});
test("optional Oath context neither grants nor removes completion eligibility", async t => {
    const v = await H.nativeFixture(t); await v.f.repo.execute({ type: "task.complete", operationId: "other-context", taskId: v.task.id, expectedRevision: v.task.revision, context: { oathId: "different-oath", sessionId: "different-host", workingContext: { type: "project", id: "elsewhere" } }, payload: { completed: true, completedAt: null } });
    assert.equal(O.assessCompletionEligibility(v.target, v.evidence()).state, "eligible");
});
for (const fault of ["missing-binding", "wrong-event-receipt", "missing-event-change", "wrong-creation-time"]) test("corrupted or contradictory completion evidence cannot qualify: " + fault, async t => {
    const v = await H.nativeFixture(t); await v.mutate("task.complete", { completed: true }); const e = v.evidence(), s = e.native.state, event = s.history[0], receipt = s.receipts.find(r => r.operationId === event.operationId);
    if (fault === "missing-binding") s.bindings = [];
    if (fault === "wrong-event-receipt") event.operationId = "create";
    if (fault === "missing-event-change") receipt.result.change.eventIds = [];
    if (fault === "wrong-creation-time") { receipt.result.task.completedAt = null; receipt.result.tasks[0].completedAt = null; }
    try { assert.notEqual(O.assessCompletionEligibility(v.target, e).state, "eligible"); } catch (error) { assert.equal(error.code, "VALIDATION"); }
});
