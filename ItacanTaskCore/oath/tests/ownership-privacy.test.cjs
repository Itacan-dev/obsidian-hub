"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const H = require("./legacy-harness.cjs"), { O, clone, S } = H;
const serializer = require("../../src/serialization");
for (const row of H.registry) test("physical-owner sharing classification: " + row.partitionId, async t => {
    const v = await H.nativeFixture(t, row.partitionId), result = O.classifyTaskSharing(v.task, H.registry);
    assert.equal(result.state, row.shared ? "canonical-fields-only" : "private"); assert.equal(result.packet, null);
    const e = v.evidence(); e.candidates = [v.target]; e.registry.find(r => r.partitionId === row.partitionId).status = "shelved";
    assert.equal(O.resolveCommitmentTarget(v.target, e).state, "resolved-native"); assert.equal(O.analyzeOathEvidence(e).candidateGroups[0].selectable, row.owner.type === "resource");
});
for (const shared of ["itacan", "hub"]) for (const resource of ["study", "literature", "references", "inspiration"]) test("mount presentation never changes physical enrollment or export: " + shared + "/" + resource, async t => {
    const r = H.registry.find(r => r.owner.id === resource), v = await H.nativeFixture(t, r.partitionId), e = v.evidence();
    const wrong = clone(v.target); wrong.owner = clone(H.registry.find(r => r.partitionId === shared).owner); wrong.authority.partitionId = shared;
    assert.equal(O.resolveCommitmentTarget(wrong, e).state, "owner-mismatch"); assert.equal(O.classifyTaskSharing(v.task, e.registry).state, "private");
    const partition = e.native.state.partitions.find(p => p.id === r.partitionId); assert.throws(() => serializer.serializeSharedPartition({ partition, tasks: [v.task] }), x => x.code === "PARTITION_PRIVATE");
});
test("renaming or missing registry cannot silently grant sharing", async t => {
    const v = await H.nativeFixture(t, "itacan"), rows = clone(H.registry); rows[1].root = "Projects/Renamed";
    assert.throws(() => O.classifyTaskSharing(v.task, rows)); rows[1].shareApproval = null; assert.equal(O.classifyTaskSharing(v.task, rows).state, "private");
    rows[1].available = false; assert.equal(O.classifyTaskSharing(v.task, rows).state, "blocked");
});
test("cross-owner relocation leaves pinned commitment unresolved and historical owner unchanged", async t => {
    const v = await H.nativeFixture(t); await v.mutate("task.complete", { completed: true }, "complete-original"); const original = v.f.repo.queryHistory()[0];
    const next = H.registry.find(r => r.partitionId === "knowledge");
    await v.mutate("task.relocate", { owner: next.owner, location: null, phase: null }, "transfer");
    assert.equal(O.resolveCommitmentTarget(v.target, v.evidence()).state, "owner-mismatch"); assert.deepEqual(v.f.repo.queryHistory()[0].ownerAtEvent, original.ownerAtEvent);
});
for (const shared of ["itacan", "hub"]) test("actual serializer strips private evidence and never contains Oath/Strict/resource sentinels: " + shared, async t => {
    const sentinel = "F1_PRIVATE_SENTINEL", v = await H.nativeFixture(t, shared, { migration: { source: "synthetic", sourceId: "private-note", importedAt: null, evidence: { oath: sentinel, receipt: sentinel, alias: sentinel, sourceBytes: sentinel, strictApplications: sentinel, resource: sentinel } }, captureSource: { origin: sentinel, path: sentinel } });
    const partition = v.f.repo.info().partitions.find(p => p.id === shared), packet = JSON.parse(serializer.serializeSharedPartition({ partition, tasks: [v.task] }));
    assert(!JSON.stringify(packet).includes(sentinel)); assert(!("migration" in packet.tasks[0])); assert(!("captureSource" in packet.tasks[0]));
    assert.equal(O.classifyTaskSharing(v.task, H.registry).packet, null);
});
test("import-dependent direct and repository export guards remain active", async t => {
    const I = require("../../tests/history-import-support.cjs"), capture = await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: false, ownerKey: "itacan" }]), v = await I.imported("memory", t, capture), task = v.result.tasks[0];
    assert.equal(O.classifyTaskSharing(task, H.registry).state, "blocked");
    assert.throws(() => v.f.repo.exportSharedPartition(task.partitionId), e => e.code === "UNSUPPORTED_OPERATION");
    assert.throws(() => serializer.serializeSharedPartition({ partition: v.f.repo.info().partitions.find(p => p.id === task.partitionId), tasks: [task] }), e => e.code === "UNSUPPORTED_OPERATION");
});
test("legacy sharing exception is frozen as an observation, never adopted as native policy", () => {
    const { selectShared } = require(H.root + "/" + H.lib + "/services/shared-projects.js");
    const data = { categories: [], taskMetadata: { parent: { captureSource: { origin: "synthetic-private", path: "Inbox/PRIVATE_SENTINEL" } } }, oathsByDevice: { device: { secret: "OATH_SENTINEL" } } };
    const selected = selectShared(data, { projects: { itacan: { root: "Projects/Itacan", categoryId: null } }, taskIds: new Set(["parent"]) });
    assert.equal(selected.taskMetadata.parent.captureSource.path, "Inbox/PRIVATE_SENTINEL"); assert(!JSON.stringify(selected).includes("OATH_SENTINEL"));
    assert(O.PRIVATE_CLASSES.includes("source-path"));
});
test("standalone analysis loads without filesystem, platform, storage or allocator calls", () => {
    const entry = path.resolve(__dirname, "../index.js"), original = Module._load, before = new Set(Object.keys(require.cache));
    for (const p of Object.keys(require.cache)) if (p.startsWith(path.dirname(entry) + path.sep) && !p.includes(path.sep + "tests" + path.sep)) delete require.cache[p];
    Module._load = function(name, parent, main) { if (["fs", "node:fs", "obsidian", "electron"].includes(name) || /json-repository|memory-repository|node-store|\/repository$/.test(name)) throw Error("Forbidden runtime dependency " + name); return original.call(this, name, parent, main); };
    try { const api = require(entry), e = H.baseEvidence(), snapshot = clone(e); assert.equal(api.analyzeOathEvidence(e).accounting.owners, 7); assert.deepEqual(e, snapshot); assert.equal(typeof api.execute, "undefined"); } finally { Module._load = original; }
    for (const p of Object.keys(require.cache)) if (!before.has(p) && p.startsWith(path.dirname(entry))) assert(!p.endsWith("adapter.js"));
});
test("older fixtures, production startup and all nonallowlisted source remain frozen", () => {
    const plugin = fs.readFileSync(path.join(H.root, ".obsidian/plugins/hub-project-menu/plugin.js"), "utf8");
    assert.equal((plugin.match(/createLegacyTaskService\(this\)/g) ?? []).length, 1); assert(!plugin.includes("ItacanTaskCore/oath"));
    const entry = fs.readFileSync(path.join(H.root, "ItacanTaskCore/src/index.js"), "utf8"); assert(!entry.includes("../oath"));
});
test("cold process proves allocation-free analysis without filesystem/platform/storage imports", () => {
    const cp = require("node:child_process"), entry = path.resolve(__dirname, "../index.js");
    const source = `const M=require('module'),old=M._load;require('crypto').randomUUID=()=>{throw Error('Allocation forbidden')};M._load=function(n){if(/^(node:)?fs(?:\\/|$)/.test(n)||/obsidian|electron|json-repository|memory-repository|node-store|\\/repository$/.test(n))throw Error('Forbidden '+n);return old.apply(this,arguments)};const O=require(process.argv[1]);const e=JSON.parse(process.argv[2]);if(O.analyzeOathEvidence(e).accounting.owners!==7)process.exit(2);`;
    const child = cp.spawnSync(process.execPath, ["-e", source, entry, JSON.stringify(H.baseEvidence())], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 10000, windowsHide: true });
    assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
});
