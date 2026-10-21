"use strict";
const { test } = require("node:test"), S = require("./support.cjs"), { assert } = S;
for (const schema of [1, 4]) for (const mode of ["manifest", "generation", "unknown-capability"]) test(`actual frozen pre-B2 private reader refuses proposed ${mode}, logical schema ${schema}, without fallback`, async t => {
 const v = await S.goldenRoot(t, mode, schema), entry = await S.materializeReader(v.directory, "preB2Private"), before = await S.fileHashes(v.directory); const old = S.C.decodePrivateGeneration(await S.fsp.readFile(S.path.join(v.directory, v.oldManifest.current.file), "utf8"), v.state.storeId).state; assert.equal(old.revision, 0); assert.equal(S.J.digest(await S.fsp.readFile(S.path.join(v.directory, v.oldManifest.current.file), "utf8")), v.oldManifest.current.sha256); const result = S.executeReader(entry, v.directory, v.state.storeId, true);
 assert.equal(result.status, 0, result.stdout + result.stderr); assert.equal(result.stdout, "UNSUPPORTED_SCHEMA"); assert.equal(result.signal, null); assert.deepEqual(await S.fileHashes(v.directory), before);
 await S.preserveGolden(`pre-b2-${schema}-${mode}`, v.directory);
 S.record(`pre-b2-${schema}-${mode}`, { evidenceClass: "actual-frozen-reader-on-proposed-golden", proposedFormat: true, newCodecImplemented: false, fallbackPointerPresent: true, readerEntry: "frozen " + S.graph.readers.preB2Private.entry, command: result.arguments, pid: result.pid, exitCode: result.status, stdout: result.stdout, stderr: result.stderr, filesUnchanged: true });
});
for (const reader of ["schema1", "B1", "B2"]) for (const mode of ["manifest", "lowered-manifest"]) test(`actual original ${reader} closure refuses proposed atomic private wire at ${mode}`, async t => {
 const v = await S.goldenRoot(t), entry = await S.materializeReader(v.directory, reader);
 if (mode === "lowered-manifest") {
  const m = { ...v.oldManifest, schemaVersion: reader === "schema1" ? 1 : reader === "B1" ? 2 : 3, current: v.descriptor, ancestry: [] };
  await S.fsp.writeFile(S.path.join(v.directory, "CURRENT.json"), S.J.encodeManifest(m));
 }
 const before = await S.fileHashes(v.directory), result = S.executeReader(entry, v.directory, v.state.storeId, false); assert.equal(result.status, 0, result.stdout + result.stderr); assert.equal(result.stdout, "UNSUPPORTED_SCHEMA"); assert.deepEqual(await S.fileHashes(v.directory), before);
 await S.preserveGolden(`original-${reader}-${mode}`, v.directory);
 S.record(`original-${reader}-${mode}`, { evidenceClass: "actual-frozen-reader-on-proposed-golden", fixture: S.graph.readers[reader], proposedFormat: true, command: result.arguments, pid: result.pid, exitCode: result.status, stdout: result.stdout, stderr: result.stderr, filesUnchanged: true });
});
test("current codec supports unchanged v1 contracts and cannot encode proposed version-2 barriers", async t => {
 const f = await S.fixture(t), state = S.clone(f.storage.state), barrier = S.C.makeBarrier(state.storeId, 1, null), raw = S.C.encodePrivateGeneration(state, barrier); assert.deepEqual(S.C.decodePrivateGeneration(raw, state.storeId).state, state); assert.equal(barrier.version, 1);
 const proposed = { ...barrier, version: 2, requiredCapabilities: [...barrier.requiredCapabilities, "atomic-task-mutations-v1"] }; assert.throws(() => S.C.encodePrivateGeneration(state, proposed), e => e.code === "UNSUPPORTED_SCHEMA");
});
test("actual domain does not infer new command meaning merely from a stored command name", async t => {
 const f = await S.fixture(t), r = await S.create(f), command = S.mutation(r.task, "task.complete", { completed: true }, "ordinary-work"); await f.repo.execute(command); const hypothetical = S.clone(f.storage.state), receipt = hypothetical.receipts.find(r => r.operationId === command.operationId), changed = JSON.parse(receipt.payload); changed.type = "task.save"; receipt.payload = S.V.canonical(changed); receipt.result.change.type = "task.save";
 // This is adversarial evidence of the gap, not a valid future compound receipt.
 assert.doesNotThrow(() => S.core.validateState(hypothetical)); assert.throws(() => S.core.validateState({ ...hypothetical, receipts: hypothetical.receipts.map(r => r === receipt ? { ...r, result: { ...r.result, atomicTask: { version: 1 } } } : r) }));
 S.record("unknown-command-gap", { hypotheticalAdversarialMutation: true, currentValidatorAcceptsNameOnlyChange: true, currentValidatorRejectsNewResultField: true, newCapabilityBarrierRequired: true });
});
test("actual N2/F2 v1 rejects truthful Save command substitution and preserves causal unknown", async t => {
 const A = require("../../application/tests/support.cjs"), P = require("../../oath/completion-proof"), f = await A.fixture(t), open = await f.create(), target = f.target(open);
 const complete = await f.act({ kind: "set-completion", target: A.target(f, open), completed: true }); assert.equal(complete.status, "committed"); const proof = await f.proof([target]), row = proof.rows[0], order = { version: 1, kind: "unproven", reason: "Independent enrollment save order is not established" };
 assert.equal(row.event.origin, "task-completion"); assert.equal(P.assessQualifiedCompletion(target, row, proof, order).reason, "ENROLLMENT_ORDER_UNPROVEN");
 const changed = S.clone(proof); changed.rows[0].creation.commandType = "task.save"; assert.equal(P.assessQualifiedCompletion(target, changed.rows[0], changed, order).reason, "COMPLETION_RECEIPT_MISMATCH");
 changed.rows[0].event.origin = "task-save-completion"; assert.throws(() => P.validateRead(changed, { version: 1, requestGeneration: proof.requestGeneration, authorityId: target.authority.authorityId, ownerContextPin: proof.ownerContextPin, targets: [target], enrollmentCut: null }), e => e.code === "OATH_PROOF_CONTRACT");
 S.record("v1-proof-boundary", { actualOrigin: row.event.origin, actualCommand: row.creation.commandType, genuineWithoutCausalOrder: "ENROLLMENT_ORDER_UNPROVEN", truthfulSaveWithV1: "COMPLETION_RECEIPT_MISMATCH", proposedOriginRejectedByV1: true, v2Implemented: false });
});
test("actual current replay precedes stale revision checks and changed stable payload conflicts", async t => {
 const f = await S.fixture(t), r = await S.create(f), command = S.mutation(r.task, "task.complete", { completed: true }, "stable-replay"); command.expectedRepositoryRevision = f.repo.info().revision;
 const first = await f.repo.execute(command), before = S.clone(f.storage.state), replay = await f.repo.execute(command); assert.equal(replay.replayed, true); assert.deepEqual(replay.change, first.change); assert.deepEqual(f.storage.state, before); await assert.rejects(() => f.repo.execute({ ...command, payload: { completed: true, completedAt: null } }), e => e.code === "OPERATION_CONFLICT"); assert.deepEqual(f.storage.state, before);
});
test("frozen closures and v1 graphs are preserved; no new runtime entry or command exists", () => {
 const coreSource = S.fs.readFileSync(S.path.join(S.root, "ItacanTaskCore/src/index.js"), "utf8"), oathSource = S.fs.readFileSync(S.path.join(S.root, "ItacanTaskCore/oath/index.js"), "utf8"); assert(!coreSource.includes("atomic-task")); assert(!oathSource.includes("atomic-task"));
 for (const n of ["src/atomic-task.js", "src/completion-effects.js", "atomic-task/index.js", "ATOMIC-TASKS.md"]) assert(!S.fs.existsSync(S.path.join(S.root, "ItacanTaskCore", n)), n + " is deferred to B");
});
