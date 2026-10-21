"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const S = require("./history-import-support.cjs");
for (const kind of ["memory", "json"]) {
    test(`${kind}: preparation commits schema 4 and stable allocations without completion activity`, async t => {
        const v = await S.prepared(kind, t), state = await S.stateOf(v.f);
        assert.equal(state.schemaVersion, 4); assert.equal(state.tasks.length, 0); assert.equal(state.history.length, 0); assert.equal(state.bindings.length, 0); assert.equal(v.prepared.historyImport.accounting.allocatedEvents, 1);
        assert.throws(() => v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }), e => e.code === "HISTORY_NOT_IMPORTED");
        const before = structuredClone(v.prepared); await v.f.reopen(); const retry = await v.f.repo.execute(v.prepareCommand); assert.deepEqual(retry, { ...before, replayed: true });
    });
    test(`${kind}: completed historical task/event/binding publish once with explicit null source clocks`, async t => {
        const v = await S.imported(kind, t), state = await S.stateOf(v.f), task = state.tasks[0];
        assert.equal(state.tasks.length, 1); assert.equal(state.history.length, 1); assert.equal(state.bindings.length, 1); assert.equal(task.completed, true); assert.equal(task.createdAt, null); assert.equal(task.modifiedAt, null); assert.equal(state.history[0].recordedAt, null);
        assert.equal(task.migration.evidence.originals.length, 1); assert.equal(state.history[0].legacy.captureDigest, v.capture.digest);
        assert.deepEqual(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, v.capture.history);
        await v.f.reopen(); assert.deepEqual(await v.f.repo.execute(v.publishCommand), { ...v.result, replayed: true }); assert.equal(v.f.repo.queryHistory().length, 1);
    });
    test(`${kind}: nested independent Step binding and bodies retain exact published identities`, async t => {
        const c = await S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: true }, { entryId: "a", legacyId: "a", parent: "parent", kind: "step", completed: false }, { entryId: "b", legacyId: "b", parent: "parent", stepParent: "a", kind: "step", completed: true }, { entryId: "c", legacyId: "c", parent: "parent", stepParent: "b", kind: "step", completed: false }]);
        const v = await S.imported(kind, t, c), state = await S.stateOf(v.f), task = state.tasks[0]; assert.equal(task.steps.length, 3); assert.equal(state.history.length, 2); assert.equal(state.bindings.length, 2);
        assert.equal(task.steps[1].parentStepId, task.steps[0].id); assert.equal(task.steps[2].parentStepId, task.steps[1].id); assert(task.steps.every(s => s.createdAt === null && s.modifiedAt === null)); assert.equal(task.migration.evidence.revisions[0].current.stepBodies[0].body, "Lossless body 日本語\n");
    });
    test(`${kind}: one missing completed Step binding quarantines the full tree but retains supported History`, async t => {
        const c = await S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: true }, { entryId: "a", legacyId: "a", parent: "parent", kind: "step", completed: true, noEvent: true }]);
        const v = await S.imported(kind, t, c); assert.equal(v.f.repo.queryTasks().length, 0); assert.equal(v.f.repo.queryHistory().length, 1); assert.equal(v.f.repo.queryHistory()[0].taskId, null); assert.deepEqual(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, c.history);
    });
    test(`${kind}: genuine reopen/recomplete retains original import evidence and counts only the new event`, async t => {
        const v = await S.imported(kind, t), original = v.f.repo.queryHistory()[0], task = v.f.repo.queryTasks()[0];
        await v.f.repo.execute(S.mutate(task, "task.complete", { completed: false })); assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records.length, 0);
        await v.f.repo.execute(S.mutate(v.f.repo.getTask(task.id), "task.complete", { completed: true }));
        assert.equal(v.f.repo.queryHistory().length, 2); assert.equal(v.f.repo.queryHistory({ counted: true }).length, 1); assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records.length, 1); assert.equal(v.f.repo.queryHistory().find(e => e.id === original.id).counted, false);
        await v.f.reopen(); assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records.length, 1);
    });
    test(`${kind}: deleted imported tasks retain History and block direct provenance-stripping exports`, async t => {
        const c = await S.mappingCapture([{ entryId: "parent", legacyId: "p", ownerKey: "itacan", completed: true }]), v = await S.imported(kind, t, c), task = v.f.repo.queryTasks()[0];
        assert.throws(() => v.f.repo.exportSharedPartition(task.partitionId), e => e.code === "UNSUPPORTED_OPERATION");
        assert.throws(() => require("../src").serializeSharedPartition({ partition: v.f.repo.info().partitions.find(p => p.id === task.partitionId), tasks: [task] }), e => e.code === "UNSUPPORTED_OPERATION");
        await v.f.repo.execute(S.mutate(task, "task.delete", {})); assert.equal(v.f.repo.queryHistory({ counted: true }).length, 1); assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records.length, 1);
    });
    test(`${kind}: unknown completion time remains null on task/event/current binding`, async t => { const v = await S.imported(kind, t, await S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: true, completedAt: null }])); assert.equal(v.f.repo.queryTasks()[0].completedAt, null); assert.equal(v.f.repo.queryHistory()[0].timestamp, null); });
    test(`${kind}: changed operation payload, second allocation set and wrong publication operation reject atomically`, async t => {
        const v = await S.prepared(kind, t); await S.rejectAtomic(v, { ...v.prepareCommand, payload: { ...v.prepareCommand.payload, reason: "changed" } }, "OPERATION_CONFLICT");
        await S.rejectAtomic(v, { ...S.prepare(v), operationId: "another-prepare" }, "HISTORY_IMPORT_CAPTURE_CONFLICT"); await S.rejectAtomic(v, { ...S.publish(v), operationId: "another-publication" });
        await v.f.repo.execute(S.publish(v)); await S.rejectAtomic(v, { ...S.publish(v), operationId: "again" }, "HISTORY_IMPORT_ALREADY_PUBLISHED");
    });
    test(`${kind}: source changes after preparation reject without a partial imported subset`, async t => { const v = await S.prepared(kind, t); v.current.capture.history[0].text = "Changed after capture"; await S.rejectAtomic(v, S.publish(v), "SOURCE_CONFLICT"); });
    test(`${kind}: ordinary commands cannot inject reserved import provenance`, async t => {
        const v = await S.fixture(kind, t); await S.rejectAtomic(v, { type: "task.create", operationId: "bypass", payload: { task: { owner: S.partitions[0].owner, title: "Injected", migration: { source: "history-import-v1", sourceId: "fake", importedAt: null, evidence: null } } } });
    });
}
for (const [name, change] of [
    ["History order", o => o.capture.history.reverse().push({ id: "changed" })],
    ["checks", o => o.capture.checks.push({ historyId: "another" })],
    ["registry", o => o.capture.registryRevision = "registry-r2"],
    ["identity snapshot", o => o.capture.identity.revision++],
    ["source bytes", o => o.capture.identity.snapshot.plans[0].snapshot.files[0].content += "Edited\n"],
    ["source path", o => o.capture.identity.snapshot.plans[0].snapshot.files[0].path = "Moved.md"],
    ["source envelope", o => o.capture.content[0].envelope.raw.hex += "00"],
    ["owner labels", o => o.ownerSnapshots[0].label = "Changed label"],
    ["exclusive coordination", o => o.exclusive = false],
    ["external inventory", o => o.externalInventory.ids.push(S.support.id(9999))]
]) test("E2 freshness conflict: " + name, async t => { const v = await S.prepared("memory", t); change(v.current); await S.rejectAtomic(v, S.publish(v)); });
for (const [name, change] of [
    ["missing event", c => c.history = []], ["competing checks", c => c.checks.push(structuredClone(c.checks[0]))],
    ["wrong owner", c => c.history[0].projectId = "hub"], ["wrong kind", c => c.history[0].kind = "step"],
    ["locator-only check", c => delete c.checks[0].hubTaskId], ["unknown owner", c => c.history[0].projectId = "gone"],
    ["archive time", c => c.history[0].archivedAt = S.NOW], ["contradictory duplicate", c => c.history.push({ ...c.history[0], text: "Contradiction" })]
]) test("E2 reviewed quarantine retains evidence: " + name, async t => {
    const c = await S.mappingCapture(); change(c); const sealed = S.seal(c), v = await S.imported("memory", t, sealed);
    assert.equal(v.f.repo.queryTasks().length, 0); assert.deepEqual(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, sealed.history);
});
test("E2 exact N1-B claims coexist with B1 and B2; recurrence commands preserve schema 4", async t => {
    const v = await S.fixture("memory", t), R = require("./recurrence-support.cjs");
    const task = (await v.f.repo.execute({ type: "task.create", operationId: "fresh-series-task", payload: { task: { owner: S.partitions[0].owner, title: "Authored A", due: { date: "2026-10-17", time: null } } } })).task;
    const base = { version: 1, owner: task.owner, partitionId: task.partitionId, expectedInventoryRevision: v.inventory.revision, reason: "Reviewed native series" };
    const definition = (await v.f.repo.execute({ type: "recurrence.defineSeries", operationId: "define-series", taskId: task.id, expectedRevision: task.revision, expectedRepositoryRevision: v.f.repo.info().revision, payload: { ...base, rule: R.rule() } })).recurrence;
    await v.f.repo.execute({ type: "recurrence.defineTemplate", operationId: "define-template", taskId: task.id, expectedRevision: task.revision, expectedRepositoryRevision: v.f.repo.info().revision, payload: { ...base, seriesId: definition.series.id, expectedSeriesRevision: definition.series.revision, description: "Empty", nodes: [] } });
    await v.f.repo.execute(S.prepare(v)); await v.f.repo.execute(S.publish(v)); assert.equal(v.f.repo.info().schemaVersion, 4);
    const request = (type, patch = {}) => { const s = v.f.repo.getRecurrenceSeries(definition.series.id, { version: 2 }).series; return { type, operationId: S.base.randomUUID(), taskId: task.id, expectedRevision: v.f.repo.getTask(task.id).revision, expectedRepositoryRevision: v.f.repo.info().revision, payload: { version: 2, seriesId: s.id, owner: task.owner, partitionId: task.partitionId, expectedPartitionRevision: v.f.repo.info().partitions.find(p => p.id === task.partitionId).revision, expectedSeriesRevision: s.revision, expectedRuleRevision: s.ruleRevision, expectedTemplateRevision: s.templateRevision, expectedInventoryRevision: v.inventory.revision, reason: "Schema coexistence", ...patch } }; };
    await v.f.repo.execute(request("recurrence.prepareGeneration", { description: "Complete", taskContent: { title: "Future", description: "", continuation: "", importance: null, location: null, phase: null }, nodes: [], deletions: [], effectiveAfterOccurrenceId: task.id }));
    const importBefore = structuredClone((await S.stateOf(v.f)).historyImport.outcome), generated = await v.f.repo.execute(request("recurrence.complete"));
    assert.equal(v.f.repo.info().schemaVersion, 4); assert.deepEqual((await S.stateOf(v.f)).historyImport.outcome, importBefore); assert.equal(v.f.repo.queryTasks().length, 3); assert.equal(generated.recurrence.completion.reused, false);
    await v.f.repo.execute(S.mutate(v.f.repo.getTask(task.id), "task.complete", { completed: false })); const again = await v.f.repo.execute(request("recurrence.complete")); assert.equal(again.recurrence.completion.reused, true); assert.equal(v.f.repo.queryTasks().length, 3);
});
test("E2 all seven physical owners and mounted Resources retain identity, privacy and Step history", async t => {
    const c = await S.mappingCapture(S.support.registry.map(r => ({ entryId: r.key, legacyId: "alias-" + r.key, ownerKey: r.key, completed: true })));
    c.history.forEach(r => { if (r.contextKind === "resource") r.workingContext = { type: "project", id: "hub" }; });
    const v = await S.imported("memory", t, S.seal(c)); assert.equal(v.f.repo.queryTasks().length, 7); assert.equal(v.f.repo.queryHistory().length, 7);
    for (const task of v.f.repo.queryTasks()) { assert.deepEqual(task.owner, S.partitions.find(p => p.id === task.partitionId).owner); assert.throws(() => v.f.repo.exportSharedPartition(task.partitionId)); }
});
test("E2 current Step edits/deletion preserve original import mappings and source bytes", async t => {
    const c = await S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: false }, { entryId: "step", legacyId: "s", kind: "step", parent: "parent", completed: true }]), v = await S.imported("memory", t, c), task = v.f.repo.queryTasks()[0], step = task.steps[0], original = structuredClone(v.result.historyImport.outcome);
    await v.f.repo.execute(S.mutate(task, "step.update", { stepId: step.id, patch: { title: "Edited Step" } }));
    await v.f.repo.execute(S.mutate(v.f.repo.getTask(task.id), "step.delete", { stepId: step.id }));
    assert.equal(v.f.repo.queryHistory({ counted: true }).length, 1); assert.deepEqual((await S.stateOf(v.f)).historyImport.outcome, original); assert((await S.stateOf(v.f)).retiredStepIds.includes(step.id));
    assert.equal(v.f.repo.getTask(task.id).migration.evidence.originals.find(e => e.target.stepId === step.id).raw.hex, c.content.find(e => e.entryId === "step").envelope.raw.hex);
});
test("E2 collision retries are bounded and a live/retired native target cannot be claimed", async t => {
    let collided = false; const v = await S.fixture("memory", t, undefined, { idFactory: () => collided ? S.support.id(8888) : S.base.randomUUID() });
    const occupied = (await v.f.repo.execute({ type: "task.create", operationId: "occupy", payload: { task: { id: S.support.id(8888), owner: S.partitions[0].owner, title: "Occupied" } } })).task;
    collided = true; await S.rejectAtomic(v, S.prepare(v), "IDENTITY_EXHAUSTED"); collided = false;
    const target = v.capture.identity.snapshot.plans[0].entries[0].nativeId;
    await v.f.repo.execute({ type: "step.add", operationId: "occupy-approved-id", taskId: occupied.id, expectedRevision: occupied.revision, payload: { step: { id: target, title: "Collision", order: 0 } } });
    await S.rejectAtomic(v, S.prepare(v), "IDENTITY_CONFLICT");
});
test("E2 concurrent commands produce one committed preparation/publication and exact retry", async t => {
    const v = await S.fixture("memory", t), command = S.prepare(v), results = await Promise.all([v.f.repo.execute(command), v.f.repo.execute(command)]);
    assert.equal(results.filter(r => r.replayed).length, 1); const pub = S.publish(v), publications = await Promise.all([v.f.repo.execute(pub), v.f.repo.execute(pub)]); assert.equal(publications.filter(r => r.replayed).length, 1); assert.equal(v.f.repo.queryHistory().length, 1);
});
