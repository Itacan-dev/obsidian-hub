"use strict";
const { test } = require("node:test"), S = require("./support.cjs"), { assert } = S;
test("frozen graph retains actual baseline bytes, origins and every current hash", () => {
 assert.equal(S.H(S.fs.readFileSync(S.path.join(__dirname, "source-graph-v1.json"))), S.vectors.sourceGraphSha256);
 const names = new Set(); for (const f of S.graph.files) { const b = Buffer.from(f.base64, "base64"); assert.equal(b.length, f.byteLength); assert.equal(S.H(b), f.sha256); assert.equal(S.H(S.fs.readFileSync(S.path.join(S.root, f.path))), f.sha256, f.path); assert(f.origin.startsWith("completed-fresh-baseline/originals/")); assert(!names.has(f.path)); names.add(f.path); }
 for (const n of ["commands.js", "completion-transition.js", "private-storage-codec.js", "history-import.js", "snapshot-read.js"]) assert(names.has("ItacanTaskCore/src/" + n));
 assert.equal(S.graph.existingSourceEdits, 0);
});
test("all decisions have unique complete accounting and proposed behavior is not executed evidence", () => {
 const rows = S.vectors.rows; assert.equal(rows.length, 107); assert.equal(new Set(rows.map(r => r.id)).size, rows.length); assert.equal(S.vectors.commandsImplemented, false);
 for (const r of rows) { assert(["proposed-contract", "current-source-executable", "explicit-limit"].includes(r.evidenceClass)); assert(r.area && r.expected && r.reason && r.source); }
 assert(rows.some(r => r.id === "storage-standalone-fallback" && r.expected === "all-writes-blocked")); assert(rows.some(r => r.id === "prepared-complete-with-edits" && r.expected === "RECURRENCE_COMMAND_REQUIRED"));
 const mounts = rows.filter(r => r.id.startsWith("mount-")); assert.equal(mounts.length, 8); assert.equal(rows.filter(r => r.id.startsWith("owner-")).length, 7);
 S.record("decision-accounting", { total: rows.length, proposed: rows.filter(r => r.evidenceClass === "proposed-contract").length, currentObservations: rows.filter(r => r.evidenceClass === "current-source-executable").length, explicitLimits: rows.filter(r => r.evidenceClass === "explicit-limit").length });
});
for (const type of ["task.save", "task.createRich"]) test("actual current core rejects unimplemented " + type + " without state or identity effects", async t => {
 let calls = 0; const draw = S.factory(), f = await S.fixture(t, { idFactory: () => { calls++; return draw(); } }), before = S.clone(f.storage.state), count = calls;
 assert.throws(() => f.repo.execute({ type, operationId: type, payload: {} }), e => e.code === "VALIDATION"); assert.deepEqual(f.storage.state, before); assert.equal(calls, count);
 S.record("unsupported-" + type.replace(".", "-"), { command: type, observed: "VALIDATION", stateUnchanged: true, newIdentityDraws: 0 });
});
test("actual old writer catalogue excludes both proposed commands", () => { const p = require("../../writer/policy"); assert(!p.task.includes("task.save")); assert(!p.task.includes("task.createRich")); });
test("actual v1 application rejects full Save and rich create before dispatch", async t => {
 const A = require("../../application/tests/support.cjs"), f = await A.fixture(t), created = await f.create(), before = await f.state();
 for (const action of [{ kind: "full-save", target: A.target(f, created), draft: { title: "No partial write", completed: true } }, { kind: "rich-create", draft: { title: "No partial create", continuation: "Private" } }]) {
  const intent = await f.intent(action); assert.equal((await f.app.capabilities(intent)).state, "requires-atomic-extension"); assert.equal((await f.app.mutate(intent)).status, "unsupported");
 }
 assert.equal(f.calls, 0); assert.deepEqual(await f.state(), before);
});
test("actual simple creation emits initial checked parent and Step once, including null completion time", async t => {
 const f = await S.fixture(t), command = { type: "task.create", operationId: "initial", payload: { task: { owner: S.base.owners.a, title: "Checked", completed: true, completedAt: null, steps: [{ id: S.id(2), title: "Same", order: 0, completed: true, completedAt: null }] } } }, r = await f.repo.execute(command), before = S.clone(f.storage.state);
 assert.equal(r.change.eventIds.length, 2); assert.equal(before.bindings.length, 2); assert(before.history.every(e => e.timestamp === null)); assert(before.history.every(e => e.operationId === "initial")); assert.deepEqual((await f.repo.execute(command)).change.eventIds, r.change.eventIds); assert.deepEqual(f.storage.state, before);
 const R = require("../../src/snapshot-read"), proof = R.projectSnapshot(before, { version: 1, authorityId: before.storeId, owners: [r.task.owner], selection: "completions", targets: [{ taskId: r.task.id, owner: r.task.owner, partitionId: r.task.partitionId }] }); assert.equal(proof.completions[0].event.origin, "initial-completed-creation");
 S.record("initial-checked-creation", { eventIds: r.change.eventIds, bindingCount: before.bindings.length, parentOrigin: proof.completions[0].event.origin, timestamp: null, replayUnchanged: true });
});
for (const mode of ["existing-completion", "checked-insertion", "omitted-step", "unconfirmed-cascade", "cycle", "stale-content"]) test("actual N1-C keeps its strict boundary: " + mode, async t => {
 const f = await S.fixture(t), r = await S.create(f, { steps: [{ id: S.id(3), title: "Same", order: 0 }, { id: S.id(4), parentStepId: S.id(3), title: "Same", order: 0 }] }), d = S.structure(r.task);
 if (mode === "existing-completion") d.draft.steps[0].completed = true;
 if (mode === "checked-insertion") d.draft.steps.push({ state: "new", id: S.id(5), parentStepId: null, order: 1, title: "Same", body: "Checked body", completed: true });
 if (mode === "omitted-step") d.draft.steps.pop();
 if (mode === "unconfirmed-cascade") { d.draft.steps = []; d.deletions = [{ stepId: S.id(3), cascade: true, descendantIds: [] }]; }
 if (mode === "cycle") d.draft.steps[0].parentStepId = S.id(4);
 if (mode === "stale-content") d.content.expectedRevision = 4;
 const before = S.clone(f.storage.state); await assert.rejects(() => f.repo.execute(S.mutation(r.task, "task.editStructure", d))); assert.deepEqual(f.storage.state, before);
});
test("actual N1-C preserves four-level identities, exact bodies and independent completion", async t => {
 const f = await S.fixture(t), steps = [10, 11, 12, 13].map((n, i) => ({ id: S.id(n), parentStepId: i === 0 ? null : S.id(n - 1), order: 0, title: "Same" })), r = await S.create(f, { steps }), d = S.structure(r.task); d.content.continuation = "Exact\r\n**Continuation** 日本語"; d.draft.steps.forEach((s, i) => s.body = "Body " + i + "\r\n"); d.taskPatch = { title: "One structural save", description: "Separate description" };
 const saved = await f.repo.execute(S.mutation(r.task, "task.editStructure", d)), c = S.content.contentOf(saved.task); assert.equal(c.revisions.length, 1); assert.equal(c.revisions[0].current.continuation, d.content.continuation); assert.deepEqual(c.revisions[0].current.stepBodies.map(x => x.body), d.draft.steps.map(x => x.body)); assert.equal(c.originals.length, 0); assert.equal(f.repo.queryHistory().length, 0); assert.deepEqual(saved.task.steps.map(s => s.id), steps.map(s => s.id));
 S.record("structural-content", { taskRevision: saved.task.revision, contentRevision: c.revisions.length, originalCount: 0, stepCount: 4, completionEvents: 0 });
});
test("actual shared helper stages multiple independent transitions in one detached experiment, without publication", async t => {
 const f = await S.fixture(t), r = await S.create(f, { completed: true, steps: [{ id: S.id(20), order: 0, title: "Same", completed: true }, { id: S.id(21), order: 1, title: "Same" }] }), before = S.clone(f.storage.state), candidate = S.clone(before), task = candidate.tasks[0], eventIds = [], reserved = new Set([...candidate.tasks.flatMap(t => [t.id, ...t.steps.map(s => s.id)]), ...candidate.history.map(e => e.id)]), nextId = S.factory(50000);
 const h = require("../../src/completion-transition").completionTransition(candidate, { type: "evidence-experiment-not-a-command", operationId: "detached-experiment" }, { now: S.NOW + 1, nextId, reserve: id => { assert(!reserved.has(id)); reserved.add(id); }, eventIds });
 h.transition(task, null, false); h.transition(task, task.steps[0], false); h.transition(task, null, true, null); h.transition(task, task.steps[1], true, S.NOW - 50);
 assert.equal(eventIds.length, 4); assert.equal(candidate.bindings.length, 2); assert.equal(candidate.history.filter(e => e.counted).length, 2); assert.equal(task.completedAt, null); assert.equal(task.steps[0].completed, false); assert.equal(task.steps[1].completedAt, S.NOW - 50); assert.deepEqual(f.storage.state, before); assert.equal(f.repo.getReceipt("detached-experiment"), null);
 S.record("detached-shared-transitions", { notACommand: true, published: false, transitionEventOrder: eventIds, parentCompletedAt: null, stepIndependent: true });
});
test("actual unchanged checked transition preserves binding and emits no new event", async t => {
 const f = await S.fixture(t), r = await S.create(f, { completed: true }), before = S.clone(f.storage.state), result = await f.repo.execute(S.mutation(r.task, "task.complete", { completed: true }, "same-state")); assert.equal(result.taskRevision, r.task.revision); assert.equal(result.change.eventIds.length, 0); assert.deepEqual(f.storage.state.history, before.history); assert.deepEqual(f.storage.state.bindings, before.bindings); assert.equal(f.storage.state.receipts.length, before.receipts.length + 1);
});
test("actual completed Step subtree deletion retains activity and retires all descendants", async t => {
 const f = await S.fixture(t), r = await S.create(f, { steps: [{ id: S.id(31), order: 0, title: "Same", completed: true }, { id: S.id(32), parentStepId: S.id(31), order: 0, title: "Same", completed: true }] }), original = S.clone(f.storage.state.history);
 await f.repo.execute(S.mutation(r.task, "step.delete", { stepId: S.id(31), cascade: true })); assert.equal(f.repo.getTask(r.task.id).steps.length, 0); assert.deepEqual(f.storage.state.history, original); assert.deepEqual(f.storage.state.retiredStepIds.sort(), [S.id(31), S.id(32)].sort()); assert.equal(f.storage.state.bindings.length, 0);
});
test("actual imported reopen/recomplete retains raw evidence and original bytes without duplicate import", async t => {
 const I = S.imports, v = await I.imported("memory", t), task = v.f.repo.queryTasks()[0], before = await I.stateOf(v.f), original = S.clone(S.content.contentOf(task).originals), raw = v.f.repo.historyCompatibility({ version: 1, projection: "recorded" });
 await v.f.repo.execute(I.mutate(task, "task.complete", { completed: false }, "import-reopen")); assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).kind, "statistics-completion-input-specimen"); const afterOpen = await I.stateOf(v.f); assert.equal(afterOpen.historyImport.projection.suppressions.length, 1); assert.deepEqual(afterOpen.historyImport.outcome, before.historyImport.outcome);
 const open = v.f.repo.getTask(task.id); await v.f.repo.execute(I.mutate(open, "task.complete", { completed: true }, "import-recomplete")); assert.equal(v.f.repo.queryHistory().length, before.history.length + 1); assert.deepEqual(S.content.contentOf(v.f.repo.getTask(task.id)).originals, original); const finalState = await I.stateOf(v.f); assert.deepEqual(I.I.bundleOf(finalState).proposal.capture.history, v.capture.history); assert.deepEqual(raw.records, v.capture.history); assert.equal(v.f.repo.historyCompatibility({ version: 1, projection: "recorded" }).records.length, 0);
 S.record("import-lifecycle", { originalHistoryCount: before.history.length, finalHistoryCount: v.f.repo.queryHistory().length, suppressedGroups: afterOpen.historyImport.projection.suppressions.length, originalEnvelopeDigests: original.map(o => o.checksum), outcomeUnchanged: true });
});
test("actual recurrence reopening/recompletion reuses successor and immutable generation outcome", async t => {
 const G = S.recurrence, v = await G.prepared("memory", t, { idFactory: S.factory(60000) }), a = v.f.repo.getTask(v.task.id), first = await v.f.repo.execute(G.complete(v, a.id, {}, "generation-E1")), b = first.recurrence.completion.outcome.result.taskId, outcome = S.clone(first.recurrence.completion.outcome);
 await v.f.repo.execute(S.mutation(v.f.repo.getTask(a.id), "task.complete", { completed: false }, "reopen-A")); const second = await v.f.repo.execute(G.complete(v, a.id, {}, "completion-E2")); assert.equal(second.recurrence.completion.outcome.result.taskId, b); assert.deepEqual(second.recurrence.completion.outcome, outcome); assert.notEqual(second.recurrence.completion.completionEventId, first.recurrence.completion.completionEventId); assert.equal(second.recurrence.completion.reused, true);
 S.record("recurrence-reuse", { predecessor: a.id, successor: b, originalEventId: first.recurrence.completion.completionEventId, currentEventId: second.recurrence.completion.completionEventId, outcomeUnchanged: true });
});
