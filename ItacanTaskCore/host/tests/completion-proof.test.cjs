"use strict";
const test = require("node:test"), H = require("./support.cjs"), { assert } = H;
for (const completedAt of [undefined, null, 1]) test("coherent genuine completion and F1 parity, time=" + completedAt, async t => {
    const v = await H.fixture(t), task = await v.create(), target = v.target(task);
    const r = await v.mutate(task.id, "task.complete", { completed: true, ...(completedAt !== undefined ? { completedAt } : {}) });
    const proof = await v.proof([target]), row = proof.rows[0], f1 = H.f1Evidence(await v.state(), v.reg);
    assert.equal(row.resolution.state, H.O.resolveCommitmentTarget(target, f1).state); assert.equal(H.O.assessCompletionEligibility(target, f1).eventId, row.event.eventId);
    assert.equal(row.binding.eventId, r.change.eventIds[0]); assert.equal(row.creation.createdEventId, row.event.eventId); assert.equal(row.creation.repositoryRevision, r.repositoryRevision); assert.equal(row.event.origin, "task-completion");
    assert.equal(H.F2.assessQualifiedCompletion(target, row, proof, { version: 1, kind: "unproven", reason: "NO_OATH_SAVE_ORDER" }).reason, "ENROLLMENT_ORDER_UNPROVEN");
    assert(!JSON.stringify(proof).includes('"payload"')); assert(!JSON.stringify(proof).includes('"workingContext"'));
});
test("actual F2 consumes N2 ports; only closed synthetic acknowledged ordering qualifies", async t => {
    const v = await H.fixture(t), task = await v.create(), target = v.target(task); await H.settle(v.host);
    const cut = { authorityId: v.authorityId, repositoryRevision: v.repo.info().revision, revisionId: v.repo.info().revisionId };
    const order = { version: 1, kind: "closed-synthetic", session: target.session, targets: [target], save: { acknowledgement: "observed", snapshotDigest: "a".repeat(64) }, cut, openTasks: [{ taskId: task.id, taskRevision: task.revision }] };
    const { TaskService } = require(H.root + "/.obsidian/plugins/hub-project-menu/lib/services/task-service"), reads = new TaskService(H.API.createNativeReadAdapter(v.host)), port = H.API.createCompletionEvidencePort(v.host);
    const adapter = require("../../oath/adapter").createOathAdapter({ commitment: { session: target.session, owner: task.owner, targets: [target] }, authorityId: v.authorityId, ownerContextPin: v.host.info().ownerContextPin, reads, evidence: port, enrollmentOrder: order });
    t.after(async () => { adapter.dispose(); port.dispose(); await reads.close(); }); await adapter.refresh();
    await v.mutate(task.id, "task.complete", { completed: true, completedAt: null });
    let result; for (let i = 0; i < 3; i++) result = await adapter.refresh();
    assert.equal(result.rows[0].task.completed, true); assert.equal(result.rows[0].eligibility.state, "eligible");
    await v.mutate(task.id, "task.complete", { completed: false }); result = await adapter.refresh(); assert.notEqual(result.rows[0].eligibility.state, "eligible");
});
test("recompletion exposes E2, retries retain the same creation receipt", async t => {
    const v = await H.fixture(t), task = await v.create(), target = v.target(task); const first = await v.mutate(task.id, "task.complete", { completed: true });
    await v.mutate(task.id, "task.complete", { completed: false }); assert.equal((await v.proof([target])).rows[0].binding, null);
    const op = H.id(), before = v.repo.getTask(task.id), command = { type: "task.complete", taskId: task.id, operationId: op, expectedRevision: before.revision, payload: { completed: true } };
    const second = await v.repo.execute(command), replay = await v.repo.execute(command), proof = await v.proof([target]);
    assert.equal(replay.replayed, true); assert.notEqual(first.change.eventIds[0], second.change.eventIds[0]); assert.equal(proof.rows[0].event.eventId, second.change.eventIds[0]); assert.equal(proof.rows[0].creation.operationId, op); assert.equal(v.repo.queryHistory({ counted: true }).length, 1);
});
test("multi-parent batch shares one head and excludes unrelated receipt/context secrets", async t => {
    const v = await H.fixture(t), a = await v.create(), b = await v.create(), targets = [v.target(a), v.target(b)];
    await v.repo.execute({ type: "task.complete", operationId: H.id(), taskId: a.id, expectedRevision: a.revision, context: { oathId: "OATH_SECRET", sessionId: "DEVICE_SECRET" }, payload: { completed: true } });
    const p = await v.proof(targets); assert.equal(p.rows.length, 2); assert(p.rows[0].creation.repositoryRevision <= p.head.repositoryRevision); assert.equal(p.rows[1].binding, null); assert(!JSON.stringify(p).includes("OATH_SECRET")); assert(!JSON.stringify(p).includes("DEVICE_SECRET"));
});
for (const change of ["wrong-authority", "wrong-owner", "wrong-partition", "wrong-anchor", "missing", "deleted", "retired-step", "kind-step"]) test("exact proof target: " + change, async t => {
    const v = await H.fixture(t), task = await v.create(), target = v.target(task);
    if (change === "wrong-authority") { target.authority.authorityId = H.id(); await assert.rejects(v.proof([target]), e => e.code === "HOST_CONTRACT"); return; }
    if (change === "wrong-owner") target.owner = H.clone(H.owners[0].owner);
    if (change === "wrong-partition") target.authority.partitionId = "itacan";
    if (change === "wrong-anchor") target.authority.enrollment.revisionId = H.id();
    if (change === "missing") target.original.taskId = target.authority.taskId = H.id();
    if (change === "deleted") await v.mutate(task.id, "task.delete", {});
    if (["retired-step", "kind-step"].includes(change)) { const sid = H.id(); await v.mutate(task.id, "step.add", { step: { id: sid, title: "Same", order: 0 } }); if (change === "retired-step") await v.mutate(task.id, "step.delete", { stepId: sid }); target.original.taskId = target.authority.taskId = sid; }
    const p = await v.proof([target]); assert.notEqual(p.rows[0].resolution.state, "resolved-native"); assert.equal(p.rows[0].binding, null);
});
test("initial checked creation is classified, never genuine parent work", async t => {
    const v = await H.fixture(t), task = await v.create({ completed: true, completedAt: null });
    const s = await v.repo.readSnapshot({ version: 1, authorityId: v.authorityId, owners: [task.owner], selection: "completions", targets: [{ taskId: task.id, partitionId: task.partitionId, owner: task.owner }] });
    assert.equal(s.completions[0].event.origin, "initial-completed-creation"); assert.equal((await v.proof([v.target(task)])).rows[0].resolution.reason, "ENROLLMENT_PROOF_UNAVAILABLE");
});
test("Step completion and historical append cannot supply a parent binding", async t => {
    const v = await H.fixture(t), sid = H.id(), task = await v.create({ steps: [{ id: sid, title: "Step", order: 0 }] }), target = v.target(task);
    await v.mutate(task.id, "step.complete", { stepId: sid, completed: true });
    const record = { id: H.id(), operationId: H.id(), partitionId: task.partitionId, taskId: null, stepId: null, kind: "task", timestamp: null, recordedAt: null, ownerAtEvent: task.owner, workingContext: null, oathId: null, sessionId: null, snapshot: { title: "Historical", parentTitle: null }, counted: true, reopenedAt: null, legacy: { raw: "HISTORY_SECRET" } };
    await v.repo.execute({ type: "history.record", operationId: record.operationId, payload: { record } }); const p = await v.proof([target]); assert.equal(p.rows[0].task.completed, false); assert.equal(p.rows[0].event, null); assert(!JSON.stringify(p).includes("HISTORY_SECRET"));
});
test("actual published alias evidence is required and case-sensitive", async t => {
    let identity = null; const provider = { read: async () => identity, subscribe: () => () => {} }, v = await H.fixture(t, { identity: provider }), task = await v.create(), target = v.target(task);
    const S = require("../../identity/tests/support.cjs"), f = await S.fixture("memory", t, { idFactory: () => task.id }); await S.published(f.repo, S.snapshot([{ entryId: "parent", legacyId: "Mixed-Alias" }])); identity = { version: 1, snapshot: f.repo.snapshot(), planId: "plan-1" };
    const old = require("../../oath/tests/legacy-harness.cjs"); const mapped = old.aliasTarget({ target }, identity, "Mixed-Alias"); assert.equal((await v.proof([mapped])).rows[0].resolution.state, "resolved-native");
    mapped.original.reference.id = mapped.authority.aliasPin.legacyId = "mixed-alias"; const p = await v.proof([mapped]); assert.notEqual(p.rows[0].resolution.state, "resolved-native");
});
test("actual B2 generation/recompletion stays on A and uses current E2", async t => {
    const B = require("../../tests/recurrence-generation-support.cjs"), v = await H.fixture(t, { repositoryOptions: { externalReservations: B.inventory() } });
    const a = await v.create({ start: { date: "2026-10-16", time: null }, due: { date: "2026-10-17", time: null } });
    const definition = await v.repo.execute(B.define(v.repo, a)), template = await v.repo.execute(B.template(v.repo, v.repo.getTask(a.id), definition.recurrence, [B.node()]));
    const b = { f: { repo: v.repo }, task: a, sid: template.recurrence.series.id }; await v.repo.execute(B.prepare(b)); const target = v.target(v.repo.getTask(a.id));
    const first = await v.repo.execute(B.complete(b)), successor = first.recurrence.completion.outcome.result.taskId; assert.notEqual(successor, a.id);
    assert.equal((await v.proof([target])).rows[0].event.origin, "recurrence-completion"); await v.mutate(a.id, "task.complete", { completed: false });
    const second = await v.repo.execute(B.complete(b)), p = await v.proof([target]); assert.equal(p.rows[0].task.id, a.id); assert.equal(p.rows[0].event.eventId, second.recurrence.completion.completionEventId); assert.notEqual(p.rows[0].event.eventId, first.recurrence.completion.completionEventId); assert.equal(v.repo.getTask(successor).completed, false);
});
for (const time of [null, 1800000000]) test("actual E2 import is preserved as historical, time=" + time, async t => {
    const I = require("../../tests/history-import-support.cjs"), capture = await I.mappingCapture([{ entryId: "parent", legacyId: "import-parent", completed: true, completedAt: time }]); const iv = await I.fixture("memory", null, capture), originalFixture = iv.f; t.after(() => originalFixture.close());
    const reg = H.registry(); reg.change(value => { for (const o of value.owners) { o.partitionId = I.partitions.find(p => H.same(p.owner, o.owner)).id; o.locations = [{ type: "folder", id: "folder-" + o.partitionId }]; } }, false);
    const v = await H.fixture(t, { registry: reg, partitions: I.partitions, repositoryOptions: iv.f.options }); iv.f = { repo: v.repo };
    await v.repo.execute(I.prepare(iv)); const published = await v.repo.execute(I.publish(iv)), task = published.tasks[0];
    const s = await v.repo.readSnapshot({ version: 1, authorityId: v.authorityId, owners: [task.owner], selection: "completions", targets: [{ taskId: task.id, owner: task.owner, partitionId: task.partitionId }] }); assert.equal(s.completions[0].event.origin, "historical-import"); assert.equal(s.completions[0].event.timestamp, time);
    await assert.rejects(async () => v.repo.exportSharedPartition(task.partitionId), e => e.code === "UNSUPPORTED_OPERATION");
    await v.mutate(task.id, "task.complete", { completed: false }); const target = v.target(v.repo.getTask(task.id)); await v.mutate(task.id, "task.complete", { completed: true, completedAt: null }); assert.equal((await v.proof([target])).rows[0].event.origin, "task-completion");
});
for (const damage of ["missing-receipt", "event-membership", "command-target", "owner", "completion-time", "legacy-provenance"]) test("validated current state does not promote inconsistent creation evidence: " + damage, async t => {
    const { MemoryStorage, createMemoryRepository } = require("../../src/memory-repository"), storage = new MemoryStorage(), repo = await createMemoryRepository({ storage, idFactory: H.id, partitions: H.partitions, clock: () => 1800000000000 }); t.after(() => repo.close());
    const a = (await repo.execute({ type: "task.create", operationId: H.id(), payload: { task: { owner: H.owners[2].owner, title: "A" } } })).task;
    await repo.execute({ type: "task.complete", operationId: H.id(), taskId: a.id, expectedRevision: a.revision, payload: { completed: true } });
    const s = storage.state, e = s.history[0], r = s.receipts[1];
    if (damage === "missing-receipt") e.operationId = "not-committed";
    if (damage === "event-membership") r.result.change.eventIds = [];
    if (damage === "command-target") { const c = JSON.parse(r.payload); c.taskId = H.id(); r.payload = H.V.canonical(c); }
    if (damage === "owner") r.result.tasks[0].owner = H.clone(H.owners[0].owner);
    if (damage === "completion-time") r.result.tasks[0].completedAt = 1;
    if (damage === "legacy-provenance") e.legacy = { raw: "UNPROVEN_HISTORY" };
    const result = await repo.readSnapshot({ version: 1, authorityId: repo.info().storeId, owners: [a.owner], selection: "completions", targets: [{ taskId: a.id, partitionId: a.partitionId, owner: a.owner }] });
    if (damage === "legacy-provenance") assert.equal(result.completions[0].event.origin, "unverifiable"); else assert.equal(result.completions[0].creation, null);
});
