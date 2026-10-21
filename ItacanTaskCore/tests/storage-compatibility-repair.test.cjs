"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { spawnSync } = require("node:child_process"), { createHash } = require("node:crypto");
const S = require("./history-import-support.cjs"), J = require("../src/json-repository"), C = require("../src/private-storage-codec"), core = require("../src"), { canonical } = require("../src/value");
const { fs, path } = S;
const pointer = async directory => J.decodeManifest(await fs.readFile(path.join(directory, "CURRENT.json"), "utf8"));
const files = async directory => Object.fromEntries(await Promise.all((await fs.readdir(directory)).sort().map(async n => [n, createHash("sha256").update(await fs.readFile(path.join(directory, n))).digest("hex")])));
async function disk(t) { const d = await S.base.disposable(); t.after(() => d.cleanup()); return d; }
async function flat(t) {
    const v = await S.imported("memory", t, await S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: true }, { entryId: "step", legacyId: "s", parent: "parent", kind: "step", completed: true }])), state = await S.stateOf(v.f), d = await disk(t), raw = canonical(state) + "\n";
    const current = { file: `gen-${state.revision}-${state.revisionId}.json`, sha256: J.digest(raw), revision: state.revision, revisionId: state.revisionId, parentRevisionId: state.parentRevisionId };
    const m = { format: "itacan-task-manifest", schemaVersion: 4, storeId: state.storeId, retention: 4, current, ancestry: [], requiredCapabilities: ["private-history-import-v1"], importRecoveryScope: S.I.scopeOf(state) };
    await fs.writeFile(path.join(d.directory, current.file), raw); for (const n of ["CURRENT.json", "RECOVERY.json"]) await fs.writeFile(path.join(d.directory, n), J.encodeManifest(m));
    return { ...v, ...d, state };
}
function mutations(v) {
    const task = v.state.tasks[0], step = task.steps[0];
    return [
        { type: "task.create", operationId: "ordinary-create", payload: { task: { owner: task.owner, title: "Never written" } } },
        ...[["task.update", { patch: { title: "Never edited" } }], ["task.delete", {}], ["task.archive", { archived: true }], ["task.complete", { completed: false }],
            ["step.add", { step: { title: "Never added", order: 1 } }], ["step.update", { stepId: step.id, patch: { title: "Never edited" } }], ["step.delete", { stepId: step.id }], ["step.complete", { stepId: step.id, completed: false }],
            ["step.reorder", { parentStepId: null, stepIds: [step.id] }], ["task.editStructure", { version: 1, draft: { version: 1, taskId: task.id, expectedRevision: task.revision, steps: [] } }]
        ].map(([type, payload]) => S.mutate(task, type, payload)),
        { type: "recurrence.defineSeries", operationId: "recurrence-attempt", taskId: task.id, expectedRevision: task.revision, expectedRepositoryRevision: v.state.revision, payload: { version: 1, rule: require("./recurrence-support.cjs").rule(), owner: task.owner, partitionId: task.partitionId, expectedInventoryRevision: v.inventory.revision, reason: "Blocked writer attempt" } },
        v.prepareCommand, v.publishCommand
    ];
}
for (let index = 0; index < 14; index++) test("Flat schema-4 legacy admission rejects mutation category " + index, async t => {
    const v = await flat(t), command = mutations(v)[index], before = await files(v.directory); assert(command);
    await assert.rejects(async () => { const repo = await J.openJsonRepository({ directory: v.directory }); try { await repo.execute(command); } finally { await repo.close(); } }, e => e.code === "STORAGE_PROFILE_REQUIRED");
    assert.deepEqual(await files(v.directory), before);
});
test("Flat E2 forensic snapshot preserves exact evidence and exposes no writer", async t => {
    const v = await flat(t), before = await files(v.directory), inspected = await J.inspectJsonRepository({ directory: v.directory, sourceFormat: "stopped-e2-flat-v1", expectedAuthorityId: v.state.storeId });
    assert.deepEqual(inspected.snapshot, v.state); assert.equal(inspected.writable, false); assert.equal(inspected.authority, "forensic"); assert.equal(inspected.execute, undefined); assert.deepEqual(await files(v.directory), before);
    await fs.writeFile(path.join(v.directory, "CURRENT.json"), "damaged"); const broken = await J.inspectJsonRepository({ directory: v.directory, sourceFormat: "stopped-e2-flat-v1", expectedAuthorityId: v.state.storeId }); assert.equal(broken.snapshot, null); assert.equal(broken.diagnostics.length, 1);
});
test("Legacy commit participant rejects flat E2 for all callers before any publication", async t => {
    const v = await flat(t), { NodeDirectory } = require("../src/node-directory"), port = new NodeDirectory(v.directory); await port.acquire();
    try { const storage = new J.JsonGenerationStorage(port, {}), before = await files(v.directory); await assert.rejects(() => storage.commit(v.state, null), e => e.code === "STORAGE_PROFILE_REQUIRED"); assert.deepEqual(await files(v.directory), before); } finally { await port.release(); }
});
test("Retained legacy handle cannot write after external flat-schema-4 pointer substitution", async t => {
    const v = await flat(t), legacy = await S.base.fixture("json", t); for (const name of await fs.readdir(v.directory)) await fs.copyFile(path.join(v.directory, name), path.join(legacy.directory, name));
    const before = await files(legacy.directory);
    for (const command of mutations(v)) await assert.rejects(() => legacy.repo.execute(command), e => e.code === "STORAGE_PROFILE_REQUIRED");
    assert.deepEqual(await files(legacy.directory), before); assert.equal(legacy.repo.queryTasks().length, 0);
});
for (const mode of ["corrupt-CURRENT", "both-pointers-lowered", "retained-handle-new-flat-generation"]) test("Flat schema-4 write prohibition survives " + mode, async t => {
    const v = await flat(t), legacy = await S.base.fixture("json", t), legacyRaw = await fs.readFile(path.join(legacy.directory, "CURRENT.json"), "utf8"), flatFile = (await pointer(v.directory)).current.file;
    if (mode === "retained-handle-new-flat-generation") {
        await fs.copyFile(path.join(v.directory, flatFile), path.join(legacy.directory, flatFile)); const before = await files(legacy.directory);
        for (const command of mutations(v)) await assert.rejects(() => legacy.repo.execute(command), e => e.code === "STORAGE_PROFILE_REQUIRED"); assert.deepEqual(await files(legacy.directory), before); return;
    }
    await legacy.close(); const original = JSON.parse(legacyRaw).payload; await fs.copyFile(path.join(legacy.directory, original.current.file), path.join(v.directory, original.current.file));
    await fs.writeFile(path.join(v.directory, "RECOVERY.json"), legacyRaw); await fs.writeFile(path.join(v.directory, "CURRENT.json"), mode === "corrupt-CURRENT" ? "broken flat pointer" : legacyRaw);
    const before = await files(v.directory); for (const command of mutations(v)) await assert.rejects(async () => { const r = await J.openJsonRepository({ directory: v.directory }); try { await r.execute(command); } finally { await r.close(); } }, e => e.code === "STORAGE_PROFILE_REQUIRED"); assert.deepEqual(await files(v.directory), before);
});
test("Private root is wire version 4 from empty creation; logical state stays schema 1", async t => {
    const v = await S.fixture("json", t), m = JSON.parse(await fs.readFile(path.join(v.f.directory, "CURRENT.json"), "utf8")).payload;
    assert.equal(v.f.repo.info().schemaVersion, 1); assert.equal(v.f.repo.info().storage.wireVersion, 4); assert.equal(m.schemaVersion, 4);
    assert.deepEqual(Object.keys(m).sort(), ["format", "schemaVersion", "storeId", "retention", "current", "ancestry"].sort());
    const wire = JSON.parse(await fs.readFile(path.join(v.f.directory, m.current.file), "utf8")); assert.equal(wire.schemaVersion, 4); assert.equal(wire.receipts.logicalSchemaVersion, 1); assert.equal(wire.receipts.historyImport, null); await v.f.reopen(); assert.equal(v.f.repo.queryHistory().length, 0);
});
for (const mode of ["missing", "empty", "file", "invalid", "wrong-id", "legacy-root", "mixed-legacy-generation", "mixed-flat-generation", "unexplained-damaged-generation"]) test("Private opening fails closed without creating/substituting authority: " + mode, async t => {
    const d = await disk(t), id = S.support.id(7000); let directory = d.directory, expectedAuthorityId = id, before, options = { directory, storageFormat: "private-v4", expectedAuthorityId, idFactory: () => { throw Error("Opening must never allocate identities"); } };
    if (mode === "missing") { directory = path.join(d.root, "absent"); options.directory = directory; }
    else if (mode === "file") { directory = path.join(d.root, "file"); await fs.writeFile(directory, "not a directory"); options.directory = directory; }
    else if (mode === "invalid") await fs.writeFile(path.join(directory, "CURRENT.json"), "invalid");
    else if (mode === "legacy-root") { const r = await J.createJsonRepository({ directory, partitions: S.partitions, storeId: id }); await r.close(); }
    else if (mode.startsWith("mixed") || mode === "wrong-id" || mode === "unexplained-damaged-generation") {
        const r = await J.createJsonRepository({ directory, partitions: S.partitions, storeId: id, storageFormat: "private-v4" }); await r.close();
        if (mode === "wrong-id") options.expectedAuthorityId = S.support.id(7001);
        else { const name = `gen-17-${S.support.id(7017)}.json`; const raw = mode === "unexplained-damaged-generation" ? "unknown corruption" : canonical({ schemaVersion: mode === "mixed-legacy-generation" ? 1 : 4, storeId: id, receipts: [] }); await fs.writeFile(path.join(directory, name), raw); }
    }
    before = await files(d.directory); await assert.rejects(() => J.openJsonRepository(options)); assert.deepEqual(await files(d.directory), before); if (mode === "missing") await assert.rejects(() => fs.access(directory));
});
test("Private creation is explicit, requires an authority and a verified empty existing directory", async t => {
    const d = await disk(t), id = S.support.id(7100); let allocations = 0; const options = { directory: d.directory, partitions: S.partitions, storageFormat: "private-v4", idFactory: () => { allocations++; return S.base.randomUUID(); } };
    await assert.rejects(() => J.createJsonRepository(options)); assert.equal(allocations, 0);
    await fs.writeFile(path.join(d.directory, "sentinel"), "retain"); const before = await files(d.directory); await assert.rejects(() => J.createJsonRepository({ ...options, storeId: id }), e => e.code === "ALREADY_EXISTS"); assert.deepEqual(await files(d.directory), before); assert.equal(allocations, 0);
    await assert.rejects(() => J.createJsonRepository({ ...options, directory: path.join(d.root, "missing"), storeId: id })); assert.equal(allocations, 0);
});
test("An injected port cannot substitute another repository behind an empty private path", async t => {
    const target = await disk(t), other = await S.fixture("json", t), { NodeDirectory } = require("../src/node-directory");
    await other.f.close(); const before = await files(other.f.directory);
    await assert.rejects(() => J.openJsonRepository({ directory: target.directory, storageFormat: "private-v4", expectedAuthorityId: other.f.options.expectedAuthorityId, storagePort: new NodeDirectory(other.f.directory) }), e => e.code === "STORAGE_AUTHORITY_MISMATCH");
    assert.deepEqual(await fs.readdir(target.directory), []); assert.deepEqual(await files(other.f.directory), before);
});
for (const phase of ["prepared", "published"]) test("Portable private codec roundtrips exact " + phase + " evidence without Node/E1 validators", async t => {
    const v = await (phase === "prepared" ? S.prepared : S.imported)("memory", t), state = await S.stateOf(v.f), barrier = C.makeBarrier(state.storeId, 4, S.I.scopeOf(state)), raw = C.encodePrivateGeneration(state, barrier); assert.deepEqual(C.decodePrivateGeneration(raw, state.storeId).state, state);
    const d = await disk(t), input = path.join(d.root, "private-input.json"); await fs.writeFile(input, JSON.stringify({ raw, id: state.storeId, command: S.prepare(v) }));
    const source = `const input=require(${JSON.stringify(input)}),Module=require('node:module'),load=Module._load;Module._load=function(id,...rest){if(/^(?:node:)?(?:fs|crypto|path|os)$/.test(id)||/history[\\/]index|identity[\\/]repository/.test(id))throw Error('Forbidden '+id);return load.call(this,id,...rest);};const C=require(${JSON.stringify(require.resolve("../src/private-storage-codec"))}),core=require(${JSON.stringify(require.resolve("../src"))}),state=C.decodePrivateGeneration(input.raw,input.id).state;core.validateState(state);const storage=new core.MemoryStorage();storage.state=state;let n=90000;core.openMemoryRepository({storage,idFactory:()=> '10000000-0000-4000-8000-'+(++n).toString(16).padStart(12,'0'),clock:()=>${S.NOW + 2000},resolvers:{location:ref=>{const t=state.tasks.find(t=>t.location?.id===ref.id);return t?{...ref,owner:t.owner}:null;}}}).then(async r=>{if(r.queryTasks().length){const t=r.queryTasks()[0];await r.execute({type:'task.update',operationId:'portable-edit',taskId:t.id,expectedRevision:t.revision,payload:{patch:{title:'Portable edit'}}});}const saved=process;input.command.operationId='unsupported-environment';input.command.expectedRepositoryRevision=r.info().revision;global.process=undefined;let rejected=false;try{await r.execute(input.command);}catch(e){rejected=e.code==='UNSUPPORTED_OPERATION';}finally{global.process=saved;}if(!rejected)throw Error('Import write did not reject unsupported environment');await r.close();process.stdout.write('portable-private-ok');}).catch(e=>{process.stderr.write(e.stack);process.exitCode=1;});`;
    const p = spawnSync(process.execPath, [...process.execArgv.filter(x => x !== "--test"), "-e", source], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, encoding: "utf8" }); assert.equal(p.status, 0, p.stderr); assert.equal(p.stdout, "portable-private-ok");
});
for (const [name, change, code] of [
    ["wire schema", w => w.schemaVersion = 5, "UNSUPPORTED_SCHEMA"], ["logical schema", w => w.receipts.logicalSchemaVersion = 5, "UNSUPPORTED_SCHEMA"],
    ["capability", w => w.receipts.barrier.requiredCapabilities.push("future"), "UNSUPPORTED_SCHEMA"], ["missing capability", w => delete w.receipts.barrier.requiredCapabilities, "UNSUPPORTED_SCHEMA"],
    ["namespace", w => w.receipts.historyImport.version = 2, "UNSUPPORTED_SCHEMA"], ["missing namespace", w => w.receipts.historyImport = null, "UNSUPPORTED_SCHEMA"],
    ["binding", w => w.bindings = []], ["reservation", w => w.receipts.historyImport.plan.reservations.pop()],
    ["allocation", w => w.receipts.historyImport.plan.groups[0].eventId = S.support.id(42)], ["receipt", w => w.receipts.records[0].payload = "{}"],
    ["owner", w => w.tasks[0].owner.id = "foreign"], ["provenance", w => w.tasks[0].migration.evidence.previousEvidence.captureDigest = "bad"],
    ["projection", w => w.receipts.historyImport.projection.publications.push({})]
]) test("Portable private validation rejects " + name, async t => {
    const v = await S.imported("memory", t), s = await S.stateOf(v.f), w = JSON.parse(C.encodePrivateGeneration(s, C.makeBarrier(s.storeId, 4, S.I.scopeOf(s)))); change(w);
    assert.throws(() => C.decodePrivateGeneration(canonical(w), s.storeId), e => !code || e.code === code);
});
test("Portable validation proves publication order against actual creation receipt", async t => {
    const v = await S.imported("memory", t); await v.f.repo.execute({ type: "task.create", operationId: "native-complete", payload: { task: { owner: S.partitions[0].owner, title: "New activity", completed: true } } });
    const s = await S.stateOf(v.f); s.historyImport.projection.publications[0].index = 99; assert.throws(() => core.validateState(s));
});
for (const mode of ["absent", "B1", "B2"]) test("Private JSON logical schema and recurrence coexistence: " + mode, async t => {
    const v = await S.fixture("json", t), R = require("./recurrence-support.cjs"); let task, sid;
    const define = async () => {
        task = (await v.f.repo.execute({ type: "task.create", operationId: "authored-series", payload: { task: { owner: S.partitions[0].owner, title: "Authored", due: { date: "2026-10-17", time: null } } } })).task;
        const payload = { version: 1, owner: task.owner, partitionId: task.partitionId, expectedInventoryRevision: v.inventory.revision, reason: "Private recurrence definition" };
        const result = await v.f.repo.execute({ type: "recurrence.defineSeries", operationId: "define-private", taskId: task.id, expectedRevision: task.revision, expectedRepositoryRevision: v.f.repo.info().revision, payload: { ...payload, rule: R.rule() } }); sid = result.recurrence.series.id;
        await v.f.repo.execute({ type: "recurrence.defineTemplate", operationId: "template-private", taskId: task.id, expectedRevision: task.revision, expectedRepositoryRevision: v.f.repo.info().revision, payload: { ...payload, seriesId: sid, expectedSeriesRevision: result.recurrence.series.revision, description: "Explicit empty", nodes: [] } });
    };
    const command = (type, extra = {}) => { const s = v.f.repo.getRecurrenceSeries(sid, { version: 2 }).series; return { type, operationId: S.base.randomUUID(), taskId: task.id, expectedRevision: v.f.repo.getTask(task.id).revision, expectedRepositoryRevision: v.f.repo.info().revision, payload: { version: 2, seriesId: sid, owner: task.owner, partitionId: task.partitionId, expectedPartitionRevision: v.f.repo.info().partitions.find(p => p.id === task.partitionId).revision, expectedSeriesRevision: s.revision, expectedRuleRevision: s.ruleRevision, expectedTemplateRevision: s.templateRevision, expectedInventoryRevision: v.inventory.revision, reason: "Private B2 lifecycle", ...extra } }; };
    const prepare = () => v.f.repo.execute(command("recurrence.prepareGeneration", { description: "Complete future template", taskContent: { title: "Future", description: "", continuation: "", importance: null, location: null, phase: null }, nodes: [], deletions: [], effectiveAfterOccurrenceId: task.id }));
    if (mode !== "absent") { await define(); assert.equal(v.f.repo.info().schemaVersion, 2); if (mode === "B2") { await prepare(); assert.equal(v.f.repo.info().schemaVersion, 3); } }
    await v.f.repo.execute(S.prepare(v)); await v.f.repo.execute(S.publish(v)); await v.f.reopen();
    const state = await S.stateOf(v.f), original = structuredClone(state.historyImport.outcome); assert.equal(state.recurrence?.version, mode === "absent" ? undefined : mode === "B1" ? 1 : 2);
    if (mode === "absent") await define(); if (mode !== "B2") await prepare(); assert.equal(v.f.repo.info().schemaVersion, 4);
    await v.f.repo.execute(command("recurrence.complete")); await v.f.repo.execute(S.mutate(v.f.repo.getTask(task.id), "task.complete", { completed: false }));
    assert.equal((await v.f.repo.execute(command("recurrence.complete"))).recurrence.completion.reused, true); await v.f.reopen(); assert.deepEqual((await S.stateOf(v.f)).historyImport.outcome, original); assert.equal(v.f.repo.info().schemaVersion, 4);
});
for (const phase of ["empty", "prepared", "published"]) for (const reader of ["schema1", "B1", "B2"]) for (const barrier of ["manifest", "generation"]) test(`Actual ${reader} refuses ${phase} private authority at ${barrier}`, async t => {
    const v = await (phase === "empty" ? S.fixture : phase === "prepared" ? S.prepared : S.imported)("json", t), dir = v.f.directory;
    const fixture = require("./fixtures/history-pre-e2-readers-v1.json"), graph = reader === "B1" ? require("./fixtures/recurrence-b1-reader-v1.json").files : fixture.graphs.find(g => g.name === reader).files;
    await v.f.close(); const root = path.join(path.dirname(dir), "actual-" + reader); await fs.mkdir(root);
    for (const f of graph) { assert.equal(createHash("sha256").update(f.text).digest("hex").toUpperCase(), f.sha256.toUpperCase()); await fs.writeFile(path.join(root, f.path), f.text); }
    if (barrier === "generation") { const m = await pointer(dir); delete m.requiredCapabilities; delete m.importRecoveryScope; m.schemaVersion = reader === "schema1" ? 1 : reader === "B1" ? 2 : 3; await fs.writeFile(path.join(dir, "CURRENT.json"), J.encodeManifest(m)); }
    const before = await files(dir), source = `require(${JSON.stringify(path.join(root, "json-repository.js"))}).openJsonRepository({directory:${JSON.stringify(dir)}}).then(()=>process.exit(2)).catch(e=>{process.stdout.write(e.code);process.exitCode=e.code==='UNSUPPORTED_SCHEMA'?0:3;})`;
    const p = spawnSync(process.execPath, [...process.execArgv.filter(x => x !== "--test"), "-e", source], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, encoding: "utf8" }); assert.equal(p.status, 0, p.stdout + p.stderr); assert.equal(p.stdout, "UNSUPPORTED_SCHEMA"); assert.deepEqual(await files(dir), before);
});
