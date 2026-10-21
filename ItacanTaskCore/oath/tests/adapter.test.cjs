"use strict";
const test = require("node:test"), fs = require("node:fs"), path = require("node:path"), { assert, H, I, fixture, bind, settle } = require("./adapter-support.cjs"), { createOathAdapter } = require("../adapter");
for (const row of H.registry) test("physical owner and source-independent navigation: " + row.partitionId, async t => {
 const b = await fixture(t, { owner: row.partitionId }); const before = await I.stateOf(b.v.f), r = await b.adapter.refresh();
 assert.equal(r.privacy, "local-private"); assert.deepEqual(r.rows[0].task.owner, row.owner); assert.deepEqual(r.rows[0].navigation, { kind: "native-task", id: b.v.task.id }); assert(!("path" in r.rows[0].task)); assert.deepEqual(await I.stateOf(b.v.f), before);
 await b.v.mutate("task.complete", { completed: true }); assert.equal((await settle(b.adapter)).rows[0].eligibility.state, "eligible");
});
for (const project of ["itacan", "hub"]) for (const resource of H.registry.filter(r => r.owner.type === "resource")) test("mount into " + project + " retains private " + resource.partitionId, async t => {
 const b = await fixture(t, { owner: resource.partitionId }); await b.adapter.refresh();
 const input = H.clone(b.options.commitment); input.owner = H.registry.find(r => r.partitionId === project).owner;
 assert.throws(() => createOathAdapter({ ...b.options, commitment: input }), e => e.code === "OATH_PROOF_CONTRACT");
 assert.deepEqual(b.adapter.getSnapshot().rows[0].task.owner, resource.owner); assert.equal(H.O.classifyTaskSharing(b.v.task, H.registry).state, "private");
});
test("private receipt/context/source sentinels do not enter adapter snapshots", async t => {
 const b = await fixture(t); await b.v.f.repo.execute({ type: "task.complete", taskId: b.v.task.id, expectedRevision: b.v.task.revision, operationId: "work", context: { oathId: "OATH_SECRET", sessionId: "STRICT_SECRET", workingContext: { type: "project", id: "DEVICE_SECRET" } }, payload: { completed: true } });
 b.provider.settings.afterProof = p => { p.privateSource = "RAW_SECRET"; p.rows[0].creation.rawPayload = "RECEIPT_SECRET"; return p; };
 const observations = []; b.adapter.subscribe(() => observations.push(JSON.stringify(b.adapter.getSnapshot()))); const result = await b.adapter.refresh(); assert.equal(result.rows[0].eligibility.state, "eligible");
 for (const secret of ["OATH_SECRET", "STRICT_SECRET", "DEVICE_SECRET", "RAW_SECRET", "RECEIPT_SECRET", "receiptDigest", "creation", "binding"]) assert(!JSON.stringify(observations).includes(secret), secret);
 assert(Object.isFrozen(result.rows[0].task.steps)); assert.throws(() => result.rows[0].task.owner.id = "mutated");
});
for (const field of ["source", "path", "line", "hubTaskId", "legacy", "captureSource", "migration"]) test("native DTO cannot smuggle private field: " + field, async t => {
 const b = await fixture(t); b.provider.settings.afterRead = r => { r.rows[0].task[field] = "PRIVATE_SENTINEL"; return r; }; const r = await b.adapter.refresh(); assert.notEqual(r.readiness.state, "ready"); assert(!JSON.stringify(r).includes("PRIVATE_SENTINEL"));
});
test("explicit native adapter never falls back to legacy backend", async t => {
 const b = await fixture(t); b.adapter.dispose(); const legacy = H.legacy().fixture(); t.after(() => legacy.close()); const a = createOathAdapter({ ...b.options, reads: legacy.service }); t.after(() => a.dispose()); const r = await a.refresh(); assert.equal(r.readiness.state, "unsupported"); assert.equal(b.provider.counts.proofs, 0);
});
test("input mutations cannot rebind session, owner, authority or reference", async t => {
 const b = await fixture(t); b.options.commitment.targets[0].authority.taskId = H.S.id(999); b.options.commitment.session.oathId = "changed"; const r = await b.adapter.refresh(); assert.equal(r.rows[0].task.id, b.v.task.id); assert.equal(r.rows[0].resolution.state, "resolved-native");
});
for (const mode of ["deleted", "archived", "missing", "retired-step", "owner-unavailable", "shelved", "root-moved"]) test("retained target lifecycle: " + mode, async t => {
 const b = await fixture(t);
 if (mode === "deleted") await b.v.mutate("task.delete", {});
 if (mode === "archived") { await b.v.mutate("task.complete", { completed: true }, "done"); await b.v.mutate("task.archive", { archived: true }, "archive"); }
 if (["missing", "retired-step"].includes(mode)) { b.adapter.dispose(); const target = H.clone(b.v.target); target.original.taskId = target.authority.taskId = H.S.id(888); if (mode === "retired-step") { await b.v.mutate("step.add", { step: { id: H.S.id(888), title: "Step", order: 0 } }, "add"); await b.v.mutate("step.delete", { stepId: H.S.id(888) }, "delete-step"); } const other = await bind(t, { ...b.v, target }); const r = await other.adapter.refresh(); assert.equal(r.rows[0].resolution.state, mode === "missing" ? "missing" : "retired-step"); return; }
 if (["owner-unavailable", "shelved", "root-moved"].includes(mode)) { const source = async () => { const e = b.v.evidence(); const owner = e.registry.find(r => r.partitionId === b.v.task.partitionId); if (mode === "owner-unavailable") owner.available = false; if (mode === "shelved") owner.status = "shelved"; if (mode === "root-moved") owner.root = "Projects/Moved"; return e; }; b.adapter.dispose(); const other = await bind(t, b.v, { order: b.order, capture: source }); const r = await other.adapter.refresh(); assert.equal(r.rows[0].resolution.state, mode === "owner-unavailable" ? "unavailable" : "resolved-native"); return; }
 const r = await b.adapter.refresh(); assert.equal(r.rows[0].resolution.state, mode === "deleted" ? "deleted" : "resolved-native"); assert.equal(r.rows[0].eligibility.state, mode === "archived" ? "eligible" : "unknown");
});
test("production-free runtime graph and prior graph remain frozen", () => {
 for (const file of ["adapter.js", "completion-proof.js"]) { const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8"); const imports = [...source.matchAll(/require\(["']([^"']+)["']\)/g)].map(m => m[1]); assert.deepEqual(imports, file === "adapter.js" ? ["./completion-proof"] : []); }
 for (const f of H.graph.files) assert.equal(H.sha(fs.readFileSync(path.join(H.root, f.path))), f.sha256, f.path);
});
test("versioned F2 vectors have complete unique accounting", () => { const vectors = require("./adapter-vectors-v1.json"); assert.equal(vectors.version, 1); assert.equal(new Set(vectors.cases.map(c => c.id)).size, vectors.cases.length); assert(vectors.cases.every(c => ["synthetic-policy", "source-backed-limit"].includes(c.evidenceClass))); });
test("canonical native IDs retain the core's version-neutral UUID contract", async t => { const b = await fixture(t, { task: { id: "10000000-0000-7000-8000-000000050000" } }); assert.equal((await b.adapter.refresh()).rows[0].task.id, b.v.task.id); });
test("multiple parents share one proof batch and independent progress", async t => {
 const v = await H.nativeFixture(t); const created = await v.f.repo.execute({ type: "task.create", operationId: "second", payload: { task: { id: H.S.id(55000), owner: v.task.owner, title: v.task.title } } });
 v.targets = [v.target, H.nativeTarget(v.f.repo, created.task)]; const order = await require("./adapter-support.cjs").acknowledgeAndCut(v, async () => ({ references: v.targets.map(t => t.original) })); const b = await bind(t, v, { order });
 await v.mutate("task.complete", { completed: true }, "first"); let r = await b.adapter.refresh(); assert.equal(r.rows.filter(x => x.eligibility.state === "eligible").length, 1);
 await v.f.repo.execute(I.mutate(v.f.repo.getTask(created.task.id), "task.complete", { completed: true }, "second-done")); r = await settle(b.adapter); assert.equal(r.rows.filter(x => x.eligibility.state === "eligible").length, 2);
 await v.mutate("task.complete", { completed: false }, "first-open"); r = await settle(b.adapter); assert.equal(r.rows.filter(x => x.task.completed).length, 1); assert.equal(r.rows.filter(x => x.eligibility.state === "eligible").length, 1);
});
for (const outcome of ["prepared", "quarantined"]) test("actual import " + outcome + " is not a live eligible target", async t => {
 const capture = await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: outcome === "quarantined", noEvent: outcome === "quarantined" }]); const iv = outcome === "prepared" ? await I.prepared("memory", t, capture) : await I.imported("memory", t, capture); const plan = iv.f.repo.getHistoryImportPlan(iv.planId, { version: 1 }).plan, reservation = plan.reservations.find(r => r.kind === "task");
 const task = { id: reservation.id, title: "Saved", revision: 1, owner: reservation.owner, partitionId: reservation.partitionId }, v = { f: iv.f, task, target: H.nativeTarget(iv.f.repo, task) }; const b = await bind(t, v); const r = await b.adapter.refresh(); assert.equal(r.rows[0].resolution.state, outcome === "prepared" ? "pending-native-publication" : "quarantined"); assert.equal(r.rows[0].task, null); assert.notEqual(r.rows[0].eligibility.state, "eligible");
});
for (const owner of ["itacan", "hub"]) test("actual eligible Project export contains no adapter, Oath or receipt evidence: " + owner, async t => {
 const b = await fixture(t, { owner }); await b.v.f.repo.execute({ type: "task.complete", operationId: "shared-done", taskId: b.v.task.id, expectedRevision: b.v.task.revision, context: { oathId: "OATH_SENTINEL", sessionId: "STRICT_SENTINEL" }, payload: { completed: true } }); await b.adapter.refresh();
 const packet = b.v.f.repo.exportSharedPartition(b.v.task.partitionId); for (const secret of ["OATH_SENTINEL", "STRICT_SENTINEL", "receiptDigest", "enrollment", "local-private"]) assert(!packet.includes(secret));
});
