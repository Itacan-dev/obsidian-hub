"use strict";
const test = require("node:test"), instrumentation = require("../../perf/instrument.cjs").install();
const H = require("./support.cjs"), { assert, fs, path } = H;
const q = (v, patch = {}) => ({ version: 2, authorityId: v.authorityId, selection: "tasks", owners: [H.owners[2].owner], ...patch });
const read = (v, patch, signal) => v.host.readScoped(q(v, patch), signal);
const count = (record, label) => record.groups.filter(g => g.label === label).reduce((n, g) => n + g.calls, 0);
test("actual JSON captures fall from two/ten validations to one/five with equivalent scoped data", async t => {
    const v = await H.fixture(t); await v.create({ completed: true, completedAt: null }); await H.settle(v.host);
    const old = await instrumentation.measure("two-capture", async () => { const info = await v.host.refresh(); return v.host.read({ ...q(v), version: 1, ownerContextPin: info.ownerContextPin }); });
    const current = await instrumentation.measure("single-capture", () => read(v));
    assert.equal(old.value.status, "ok"); assert.equal(current.value.status, "ok");
    assert.deepEqual(current.value.snapshot, old.value.snapshot);
    for (const [r, captures, validations] of [[old, 2, 10], [current, 1, 5]]) { assert.equal(count(r.record, "src/repository.js.TaskRepository.readSnapshot"), captures); assert.equal(count(r.record, "src/domain.js.validateState"), validations); }
    const r = current.value; assert.equal(r.version, 2); assert.equal(r.kind, "scoped-capture");
    assert.deepEqual(r.info.head, r.stamp.head); assert.deepEqual(r.snapshot.head, r.stamp.head); assert.deepEqual(r.info.readiness, r.snapshot.readiness);
    assert.equal(r.info.ownerContextPin, r.stamp.ownerContextPin); assert.equal(r.info.hostEpoch, r.stamp.hostEpoch); assert(Object.isFrozen(r.info));
    if (process.env.ITACAN_DEMO_AUDIT) { await fs.mkdir(process.env.ITACAN_DEMO_AUDIT, { recursive: true }); await fs.writeFile(path.join(process.env.ITACAN_DEMO_AUDIT, "counts.json"), JSON.stringify({ old: old.record, current: current.record }, null, 2)); }
});
for (const change of ["unavailable", "dashboard", "removed", "partition"]) test("unrelated owner " + change + " still blocks scoped admission", async t => {
    const v = await H.fixture(t); await v.create(); v.reg.change(r => { if (change === "removed") r.owners.splice(0, 1); else if (change === "unavailable") r.owners[0].available = false; else if (change === "dashboard") r.owners[0].dashboard = null; else r.owners[0].partitionId = "wrong-partition"; });
    assert.notEqual((await v.host.refresh()).readiness.state, "ready"); const r = await read(v); assert.notEqual(r.status, "ok"); assert(!JSON.stringify(r).includes("Parent"));
});
test("v1 scoped behavior stays unchanged while v2 preserves global preflight", async t => {
    const v = await H.fixture(t); await v.create(); v.reg.change(r => r.owners[0].available = false);
    const r = await v.host.read({ ...q(v), version: 1, ownerContextPin: v.reg.snapshot().digest }); assert.equal(r.status, "ok"); assert.notEqual((await read(v)).status, "ok");
});
for (const patch of [{ version: 1 }, { authorityId: H.id() }, { owners: [] }, { selection: "status" }, { selection: "completions" }, { execute: true }, { cut: null }, { selection: "editor", targets: [] }]) test("bounded negotiation refuses " + JSON.stringify(patch), async t => { const v = await H.fixture(t); await assert.rejects(read(v, patch), e => e.code === "HOST_CONTRACT"); });
test("stale context and identity expectations fail without task data", async t => { const v = await H.fixture(t); for (const patch of [{ ownerContextPin: "stale" }, { identityPin: "foreign" }]) { const r = await read(v, patch); assert.notEqual(r.status, "ok"); assert.equal(r.version, 2); assert.equal(r.kind, "scoped-capture"); assert.equal(r.snapshot, undefined); } });
test("invalid identity evidence is not hidden by a successful selected partition", async t => { let evidence = null; const v = await H.fixture(t, { identity: { read: async () => evidence, subscribe: () => () => {} } }); await v.create(); evidence = { version: 99, snapshot: {}, planId: "PRIVATE_ALIAS" }; const r = await read(v); assert.notEqual(r.status, "ok"); assert(!JSON.stringify(r).includes("PRIVATE_ALIAS")); });
test("write before and during capture returns only a coherent accepted head", async t => {
    let armed = false; const entered = H.gate(), release = H.gate(); const v = await H.fixture(t, { repositoryOptions: { fault: async stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; entered.resolve(); await release.promise; } } } });
    const task = await v.create(); await v.mutate(task.id, "task.update", { patch: { title: "Before" } }); armed = true;
    const reading = read(v); await entered.promise; const writing = v.mutate(task.id, "task.complete", { completed: true }); release.resolve(); const r = await reading; const written = await writing;
    if (r.status === "ok") { assert.equal(r.snapshot.tasks[0].title, "Before"); assert.deepEqual(r.info.head, r.snapshot.head); assert.equal(r.snapshot.tasks[0].completed, r.stamp.head.repositoryRevision === written.repositoryRevision); }
    const next = await read(v); assert.equal(next.status, "ok"); assert.equal(next.snapshot.tasks[0].completed, true); assert.equal(next.info.head.repositoryRevision, written.repositoryRevision);
});
test("registry changes during acceptance retry with fresh context, never old status", async t => { let armed = false; const v = await H.fixture(t, { repositoryOptions: { fault: stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; v.reg.change(r => r.owners[0].status = "shelved", false); } } } }); await v.create(); armed = true; const r = await read(v); assert.equal(r.status, "ok"); assert.equal(r.stamp.ownerContextPin, v.reg.snapshot().digest); assert.equal(r.info.ownerContextPin, r.stamp.ownerContextPin); });
test("repeated unstable context is bounded at three captures", async t => { const v = await H.fixture(t); let calls = 0; v.reg.settings.before = () => { calls++; v.reg.change(() => {}, false); }; const r = await read(v); assert.equal(r.code, "SNAPSHOT_UNSTABLE"); assert.equal(r.state, "recovering"); assert.equal(calls, 6); });
for (const action of ["close", "dispose", "abort"]) test(action + " revokes late asynchronous scoped result", async t => { const v = await H.fixture(t), entered = H.gate(), release = H.gate(), controller = new AbortController(); v.reg.settings.before = async () => { entered.resolve(); await release.promise; }; const pending = read(v, {}, controller.signal); await entered.promise; const ending = action === "abort" ? (controller.abort(), Promise.resolve()) : v.host[action](); release.resolve(); const r = await pending; await ending; assert.notEqual(r.status, "ok"); assert.equal(r.snapshot, undefined); });
for (const changed of ["CURRENT.json", "RECOVERY.json", "generation", "missing-current", "unsupported-capability", "new-schema"]) test("live " + changed + " evidence cannot be bypassed", async t => {
    const v = await H.fixture(t); await v.create(); const pointer = path.join(v.directory, "CURRENT.json"), manifest = JSON.parse(await fs.readFile(pointer, "utf8"));
    if (changed === "generation") await fs.appendFile(path.join(v.directory, manifest.payload.current.file), "corruption");
    else if (changed === "missing-current") await fs.rename(pointer, path.join(v.directory, "preserved-current.evidence"));
    else if (["unsupported-capability", "new-schema"].includes(changed)) { if (changed === "new-schema") manifest.payload.schemaVersion = 99; else manifest.payload.capabilities = ["unreviewed-v99"]; manifest.sha256 = H.J.digest(H.V.canonical(manifest.payload)); await fs.writeFile(pointer, H.V.canonical(manifest)); }
    else await fs.appendFile(path.join(v.directory, changed), " ");
    const r = await read(v); assert.notEqual(r.status, "ok"); assert.equal(r.snapshot, undefined);
});
test("changed head during final acceptance fails through the existing storage check", async t => { let armed = false; const v = await H.fixture(t, { repositoryOptions: { fault: async stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; await fs.appendFile(path.join(v.directory, "RECOVERY.json"), " "); } } } }); await v.create(); armed = true; assert.notEqual((await read(v)).status, "ok"); });
test("readable late recovery fence remains recovering and never returns an editor draft", async t => { const v = await H.fixture(t), task = await v.create(); const payload = { format: "itacan-recurrence-recovery-fence", version: 1, storeId: v.authorityId, reason: "verified-ancestor-fallback", recovery: null }; const raw = H.V.canonical({ payload, sha256: H.J.digest(H.V.canonical(payload)) }) + "\n"; await fs.writeFile(path.join(v.directory, "RECURRENCE-FENCE.json"), raw); const r = await read(v); assert.equal(r.status, "ok"); assert.equal(r.info.readiness.state, "recovering"); assert.equal(r.snapshot.readiness.state, "recovering"); const e = await read(v, { selection: "editor", targets: [{ taskId: task.id, owner: task.owner, partitionId: task.partitionId }] }); assert.equal(e.snapshot.editor.code, "RECOVERY_FENCED"); assert.equal(e.snapshot.editor.draft, undefined); assert.equal(await fs.readFile(path.join(v.directory, "RECURRENCE-FENCE.json"), "utf8"), raw); });
test("lost lease blocks scoped reads and cleanup never removes a foreign lock", async t => { const v = await H.fixture(t), file = path.join(v.directory, "WRITER.lock"), raw = await fs.readFile(file, "utf8"), lock = JSON.parse(raw); await fs.writeFile(file, JSON.stringify({ ...lock, token: "foreign-token" })); try { assert.notEqual((await read(v)).status, "ok"); await assert.rejects(v.host.close()); assert.equal(JSON.parse(await fs.readFile(file, "utf8")).token, "foreign-token"); } finally { await fs.writeFile(file, raw); } await v.host.close(); });
test("physical root replacement cannot substitute a scoped authority", async t => { const v = await H.fixture(t), preserved = v.directory + "-preserved"; await fs.rename(v.directory, preserved); await fs.mkdir(v.directory); try { assert.notEqual((await read(v)).status, "ok"); await assert.rejects(v.host.close()); } finally { await fs.rmdir(v.directory); await fs.rename(preserved, v.directory); } await v.host.close(); });

const editorQuery = task => ({ selection: "editor", owners: [task.owner], targets: [{ taskId: task.id, owner: task.owner, partitionId: task.partitionId }] });
for (const notified of [false, true]) test("editor pins registry across the logical request; new request acquires updated context, notify=" + notified, async t => {
    let armed = false, injected = 0;
    const v = await H.fixture(t, { repositoryOptions: { fault: stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; injected++; v.reg.change(r => r.owners[2].status = "shelved", notified); } } } }), task = await v.create(), old = v.reg.snapshot().digest;
    armed = true; const r = await read(v, editorQuery(task)); assert.equal(injected, 1); assert.equal(r.code, "OWNER_CONTEXT_MISMATCH"); assert.equal(r.snapshot, undefined);
    const next = await read(v, editorQuery(task)); assert.equal(next.status, "ok"); assert.notEqual(next.stamp.ownerContextPin, old); assert.equal(next.stamp.ownerContextPin, v.reg.snapshot().digest);
});
test("editor keeps the original context after transient repository failure", async t => {
    let armed = false, attempts = 0;
    const v = await H.fixture(t, { repositoryOptions: { fault: stage => { if (armed && stage === "snapshot:beforeAcceptance" && ++attempts === 1) { const e = Error("Synthetic transient"); e.code = "SNAPSHOT_UNSTABLE"; throw e; } } } }), task = await v.create(), pin = v.reg.snapshot().digest;
    armed = true; const r = await read(v, editorQuery(task)); assert.equal(r.status, "ok"); assert.equal(attempts, 2); assert.equal(r.stamp.ownerContextPin, pin);
});
test("editor cannot reacquire changed context after a failed transient attempt", async t => {
    let armed = false, attempts = 0;
    const v = await H.fixture(t, { repositoryOptions: { fault: stage => { if (armed && stage === "snapshot:beforeAcceptance") { attempts++; v.reg.change(r => r.owners[2].status = "shelved", false); const e = Error("Synthetic transient"); e.code = "SNAPSHOT_UNSTABLE"; throw e; } } } }), task = await v.create();
    armed = true; const r = await read(v, editorQuery(task)); assert.equal(r.code, "OWNER_CONTEXT_MISMATCH"); assert.equal(attempts, 1);
});
test("stable-context editor instability still stops after three attempts", async t => {
    let armed = false, attempts = 0;
    const v = await H.fixture(t, { repositoryOptions: { fault: stage => { if (armed && stage === "snapshot:beforeAcceptance") { attempts++; const e = Error("Synthetic transient"); e.code = "SNAPSHOT_UNSTABLE"; throw e; } } } }), task = await v.create();
    armed = true; const r = await read(v, editorQuery(task)); assert.equal(r.code, "SNAPSHOT_UNSTABLE"); assert.equal(r.state, "recovering"); assert.equal(attempts, 3);
});
test("editor pins actual validated identity evidence, separately requested updated evidence may succeed", async t => {
    let identity = null, armed = false; const provider = { read: async () => identity, subscribe: () => () => {} };
    const v = await H.fixture(t, { identity: provider, repositoryOptions: { fault: stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; identity = published; } } } }), task = await v.create();
    const I = require("../../identity/tests/support.cjs"), ledger = await I.fixture("memory", t, { idFactory: () => task.id }); await I.published(ledger.repo, I.snapshot([{ entryId: "parent", legacyId: "Exact-private-alias" }]));
    const published = { version: 1, snapshot: ledger.repo.snapshot(), planId: "plan-1" };
    armed = true; const r = await read(v, editorQuery(task)); assert.equal(r.code, "IDENTITY_CONTEXT_MISMATCH"); assert.equal(r.snapshot, undefined);
    const next = await read(v, editorQuery(task)); assert.equal(next.status, "ok"); assert.equal(typeof next.stamp.identityPin, "string"); assert(!JSON.stringify(next).includes("Exact-private-alias"));
});
