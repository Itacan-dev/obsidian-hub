"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), os = require("node:os"), { createHash } = require("node:crypto"), { spawnSync } = require("node:child_process");
const S = require("./history-import-support.cjs"), core = require("../src"), J = require("../src/json-repository");
const { fs, path } = S;
const diskStages = ["beforeSerialize", "beforeTemporaryWrite", "duringTemporaryWrite", "beforeFlush", "afterFlush", "beforeGenerationVerify", "afterGenerationPublish", "beforeManifestReplace"];
const prepareStages = ["beforeCommandValidation", "history:beforePlanValidation", "history:beforeEvidenceValidation", "history:beforeReservation", "history:beforeEventAllocation", "history:beforeStepConstruction", "history:beforeContentAttachment", "history:afterPreparation", "history:beforeProjectionMetadata", "beforeReceiptPersistence", "history:beforeCandidateValidation", "beforeCommit"];
const publishStages = ["history:beforePlanValidation", "history:beforeReservation", "history:beforeTaskConstruction", "history:beforeStepConstruction", "history:beforeContentAttachment", "history:afterContentAttachment", "history:beforeEventInsertion", "history:beforeBindingInsertion", "history:beforeImportOutcome", "history:afterImportOutcome", "history:beforeProjectionMetadata", "beforeReceiptPersistence", "history:beforeCandidateValidation", "beforeCommit"];
const nested = () => S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: true }, { entryId: "step", legacyId: "s", parent: "parent", kind: "step", completed: true }]);
for (const kind of ["memory", "json"]) for (const phase of ["prepare", "publish"]) for (const stage of [...(phase === "prepare" ? prepareStages : publishStages), ...(kind === "json" ? diskStages : [])]) test(`${kind}: E2 ${phase} exception at ${stage} preserves whole prior state`, async t => {
    let armed = false; const options = { fault: at => { if (armed && at === stage) throw Error("Injected " + stage); } };
    const v = phase === "prepare" ? await S.fixture(kind, t, await nested(), options) : await S.prepared(kind, t, await nested(), options);
    const command = phase === "prepare" ? S.prepare(v) : S.publish(v); armed = true; await S.rejectAtomic(v, command); armed = false;
    const result = await v.f.repo.execute(command); assert.equal(result.replayed, false); assert.equal(v.f.repo.queryHistory().length, phase === "prepare" ? 0 : 2);
});
for (const kind of ["memory", "json"]) for (const phase of ["prepare", "publish"]) test(`${kind}: E2 ${phase} lost acknowledgement replays committed allocation/outcome`, async t => {
    let armed = false; const options = { fault: at => { if (armed && at === "beforeAcknowledgement") throw Error("Lost reply"); } }, v = phase === "prepare" ? await S.fixture(kind, t, undefined, options) : await S.prepared(kind, t, undefined, options), command = phase === "prepare" ? S.prepare(v) : S.publish(v);
    armed = true; await assert.rejects(() => v.f.repo.execute(command), e => e.code === "ACKNOWLEDGEMENT_LOST"); armed = false; const result = await v.f.repo.execute(command); assert.equal(result.replayed, true); await v.f.reopen(); assert.equal((await v.f.repo.execute(command)).replayed, true);
});
for (const [label, corrupt] of [
    ["plan digest", s => s.historyImport.plan.digest = "0".repeat(64)],
    ["allocation", s => s.historyImport.plan.groups[0].eventId = S.support.id(12345)],
    ["reservation", s => s.historyImport.plan.reservations.pop()],
    ["capture payload", s => { const r = s.receipts[0], c = JSON.parse(r.payload); c.payload.bundle.proposal.capture.history[0].timestamp = null; r.payload = JSON.stringify(c); }],
    ["original binding", s => s.historyImport.outcome.bindings[0].eventId = S.support.id(12345)],
    ["current binding", s => s.bindings[0].eventId = S.support.id(12345)],
    ["event timestamp", s => s.history[0].timestamp = null],
    ["creation evidence", s => s.historyImport.outcome.events[0].counted = false],
    ["projection omission", s => s.historyImport.projection.publications.push({})],
    ["unproven suppression", s => s.historyImport.projection.suppressions.push({ version: 1, groupKey: s.historyImport.plan.groups[0].key, eventId: s.history[0].id, operationId: "missing", repositoryRevision: s.revision })]
]) test("E2 portable deep validation rejects corruption: " + label, async t => { const v = await S.imported("memory", t), state = await S.stateOf(v.f); corrupt(state); assert.throws(() => core.validateState(state)); });
for (const [label, corrupt] of [["namespace version", s => s.historyImport.version = 2], ["capability", s => s.historyImport.requiredCapabilities.push("future")], ["missing namespace", s => delete s.historyImport]]) test("E2 unknown contract never downcasts: " + label, async t => { const v = await S.prepared("memory", t), state = await S.stateOf(v.f); corrupt(state); assert.throws(() => core.validateState(state), e => e.code === "UNSUPPORTED_SCHEMA"); });
const manifest = async f => J.decodeManifest(await fs.readFile(path.join(f.directory, "CURRENT.json"), "utf8"));
async function interrupt(v, stage, command) {
    await v.f.close(); const requestFile = path.join(path.dirname(v.f.directory), "history-crash-request.json");
    await fs.writeFile(requestFile, JSON.stringify({ command, observation: v.current, clock: S.NOW + 1000, authorityId: v.f.options.expectedAuthorityId }));
    const child = spawnSync(process.execPath, [...process.execArgv.filter(x => x !== "--test"), path.join(__dirname, "history-import-crash-worker.cjs"), v.f.directory, stage, requestFile], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, encoding: "utf8", timeout: 30000 });
    assert.equal(child.status, 73, child.stdout + child.stderr); await assert.rejects(() => J.openJsonRepository({ directory: v.f.directory }), e => e.code === "LOCK_HELD");
    const file = path.join(v.f.directory, "WRITER.lock"), raw = await fs.readFile(file, "utf8"), lock = JSON.parse(raw);
    assert.equal(lock.pid, child.pid); assert.equal(lock.host, os.hostname()); assert.match(lock.token, /^[0-9a-f-]{36}$/); assert.throws(() => process.kill(child.pid, 0), e => e.code === "ESRCH");
    await fs.rename(file, path.join(v.f.directory, "abandoned-lock-" + lock.token + ".json"));
    process.stdout.write("E2-DEAD-CHILD-LOCK " + JSON.stringify({ stage, pid: child.pid, status: child.status, verifiedDead: true, raw, sha256: createHash("sha256").update(raw).digest("hex") }) + "\n");
}
for (const phase of ["prepare", "publish", "reopen", "recomplete"]) for (const stage of ["duringTemporaryWrite", "beforeFlush", "afterFlush", "afterGenerationPublish", "beforeManifestReplace", "afterManifestCommit", "beforeAcknowledgement"]) test(`JSON actual E2 child interruption: ${phase} at ${stage}`, async t => {
    const v = phase === "prepare" ? await S.fixture("json", t) : phase === "publish" ? await S.prepared("json", t) : await S.imported("json", t);
    let command = phase === "prepare" ? S.prepare(v) : phase === "publish" ? S.publish(v) : S.mutate(v.f.repo.queryTasks()[0], "task.complete", { completed: false });
    if (phase === "recomplete") { await v.f.repo.execute(command); command = S.mutate(v.f.repo.queryTasks()[0], "task.complete", { completed: true }); }
    await interrupt(v, stage, command); await v.f.reopen(); const committed = ["afterManifestCommit", "beforeAcknowledgement"].includes(stage);
    assert.equal(!!v.f.repo.getReceipt(command.operationId), committed); const result = await v.f.repo.execute(command); assert.equal(result.replayed, committed); core.validateState(await S.stateOf(v.f));
    assert.equal(v.f.repo.queryHistory().length, phase === "prepare" ? 0 : phase === "recomplete" ? 2 : 1);
});
test("JSON E2 acknowledged import loss remains scoped/fenced across unrelated writes and restart", async t => {
    const v = await S.imported("json", t), m = await manifest(v.f), task = v.f.repo.queryTasks()[0]; await v.f.close(); await fs.writeFile(path.join(v.f.directory, m.current.file), "corrupt acknowledged import"); await v.f.reopen();
    assert.equal(v.f.repo.getTask(task.id), null); assert.equal(v.f.repo.getReceipt(v.publishId), null); assert.equal((await manifest(v.f)).schemaVersion, 4);
    const marker = await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"); assert.equal(JSON.parse(marker).payload.version, 2);
    for (let i = 0; i < 2; i++) {
        await S.rejectAtomic(v, v.publishCommand, "HISTORY_IMPORT_RECOVERY_FENCED"); await S.rejectAtomic(v, S.mutate(task, "task.complete", { completed: false }), "HISTORY_IMPORT_RECOVERY_FENCED");
        const unrelated = await v.f.repo.execute({ type: "task.create", operationId: "unrelated-" + i, payload: { task: { owner: S.partitions[0].owner, title: "Allowed unrelated" } } }); assert(unrelated.task);
        assert.throws(() => v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }), e => e.code === "HISTORY_UNAVAILABLE"); await v.f.reopen(); assert.equal((await manifest(v.f)).schemaVersion, 4); assert.equal(await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"), marker);
    }
});
for (const stage of ["beforeRecurrenceFenceWrite", "fence:duringTemporaryWrite", "afterRecurrenceFenceWrite"]) test("JSON actual E2 fence interruption: " + stage, async t => {
    const v = await S.imported("json", t), m = await manifest(v.f); await v.f.close(); await fs.writeFile(path.join(v.f.directory, m.current.file), "damaged acknowledged import");
    await interrupt(v, stage, "OPEN"); await v.f.reopen(); await S.rejectAtomic(v, v.publishCommand, "HISTORY_IMPORT_RECOVERY_FENCED"); await v.f.reopen(); assert.equal(v.f.repo.queryTasks().length, 0);
});
for (const name of ["schema1", "B1", "B2"]) for (const barrier of ["manifest", "generation"]) test(`Actual frozen ${name} reader rejects E2 ${barrier} without fallback`, async t => {
    const v = await S.imported("json", t), fixture = require("./fixtures/history-pre-e2-readers-v1.json"), files = name === "B1" ? require("./fixtures/recurrence-b1-reader-v1.json").files : fixture.graphs.find(g => g.name === name).files;
    await v.f.close(); const root = path.join(path.dirname(v.f.directory), "old-reader-" + name); await fs.mkdir(root);
    for (const f of files) { assert.equal(createHash("sha256").update(f.text).digest("hex").toUpperCase(), f.sha256.toUpperCase()); await fs.writeFile(path.join(root, f.path), f.text); }
    if (barrier === "generation") { const m = await manifest(v.f); delete m.requiredCapabilities; delete m.importRecoveryScope; m.schemaVersion = name === "schema1" ? 1 : name === "B1" ? 2 : 3; await fs.writeFile(path.join(v.f.directory, "CURRENT.json"), J.encodeManifest(m)); }
    const before = await fs.readdir(v.f.directory), source = `require(${JSON.stringify(path.join(root, "json-repository.js"))}).openJsonRepository({directory:${JSON.stringify(v.f.directory)}}).then(()=>process.exit(2)).catch(e=>{process.stdout.write(e.code);process.exitCode=e.code==='UNSUPPORTED_SCHEMA'?0:3;})`;
    const child = spawnSync(process.execPath, [...process.execArgv.filter(x => x !== "--test"), "-e", source], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, encoding: "utf8" }); assert.equal(child.status, 0, child.stderr + child.stdout); assert.equal(child.stdout, "UNSUPPORTED_SCHEMA"); assert.deepEqual(await fs.readdir(v.f.directory), before);
});
test("Memory E2 fence arriving before commit blocks replay and imported Step/parent writes", async t => {
    let active = false; const v = await S.imported("memory", t, await nested(), { fault: stage => { if (active && stage === "beforeCommit") v.f.storage.recurrenceFence = { reason: "late synthetic fence" }; } }), task = v.f.repo.queryTasks()[0]; active = true;
    await S.rejectAtomic(v, S.mutate(task, "step.complete", { stepId: task.steps[0].id, completed: false }), "HISTORY_IMPORT_RECOVERY_FENCED");
    await S.rejectAtomic(v, v.publishCommand, "HISTORY_IMPORT_RECOVERY_FENCED");
});
