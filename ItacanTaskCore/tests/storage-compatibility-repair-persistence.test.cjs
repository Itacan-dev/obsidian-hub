"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), os = require("node:os"), { fork } = require("node:child_process"), { createHash } = require("node:crypto");
const S = require("./history-import-support.cjs"), J = require("../src/json-repository"), C = require("../src/private-storage-codec"), core = require("../src"), { canonical } = require("../src/value");
const { fs, path } = S;
const manifest = async f => J.decodeManifest(await fs.readFile(path.join(f.directory, "CURRENT.json"), "utf8"));
const nested = () => S.mappingCapture([{ entryId: "parent", legacyId: "p", completed: true }, { entryId: "step", legacyId: "s", parent: "parent", kind: "step", completed: true }]);
for (const phase of ["prepare", "publish"]) for (const stage of ["private:beforeGenerationEncoding", "private:beforeRecoveryBarrierMirror", "private:afterRecoveryBarrierMirror"]) test(`Private ${phase} exception at ${stage}`, async t => {
    let armed = false, v; const opts = { fault: async at => {
        if (armed && phase === "publish" && stage.includes("RecoveryBarrierMirror") && at === "beforeManifestReplace") await fs.writeFile(path.join(v.f.directory, "RECOVERY.json"), "damaged prior pointer");
        if (armed && at === stage) throw Error("Injected private stage");
    } }; v = phase === "prepare" ? await S.fixture("json", t, undefined, opts) : await S.prepared("json", t, undefined, opts); const command = phase === "prepare" ? S.prepare(v) : S.publish(v), before = await S.stateOf(v.f);
    armed = true; await assert.rejects(() => v.f.repo.execute(command), e => e.code === (stage === "private:beforeGenerationEncoding" ? undefined : "ACKNOWLEDGEMENT_LOST") || stage === "private:beforeGenerationEncoding"); armed = false;
    if (stage === "private:beforeGenerationEncoding") assert.deepEqual(await S.stateOf(v.f), before);
    const r = await v.f.repo.execute(command); assert.equal(r.replayed, stage !== "private:beforeGenerationEncoding"); await v.f.reopen(); assert.equal((await v.f.repo.execute(command)).replayed, true);
});
for (const phase of ["prepare", "publish"]) for (const damage of ["generation", "CURRENT", "valid-older-CURRENT"]) test(`Private lost acknowledged ${phase}: ${damage} retains scope across unrelated writes`, async t => {
    const v = await S.fixture("json", t), initial = await fs.readFile(path.join(v.f.directory, "CURRENT.json"), "utf8"); v.prepareCommand = S.prepare(v); const preparation = await v.f.repo.execute(v.prepareCommand);
    if (phase === "publish") { v.publishCommand = S.publish(v); await v.f.repo.execute(v.publishCommand); }
    const m = await manifest(v.f), scope = S.I.scopeOf(await S.stateOf(v.f)), command = phase === "prepare" ? v.prepareCommand : v.publishCommand;
    await v.f.close(); if (damage === "generation") await fs.writeFile(path.join(v.f.directory, m.current.file), "acknowledged bytes lost"); else await fs.writeFile(path.join(v.f.directory, "CURRENT.json"), damage === "CURRENT" ? "broken CURRENT" : initial);
    await v.f.reopen(); const marker = await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"); assert.equal(JSON.parse(marker).payload.version, 2);
    for (let i = 0; i < 3; i++) {
        await assert.rejects(() => v.f.repo.execute(command), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED");
        const changed = structuredClone(command); changed.payload.reason += " changed"; await assert.rejects(() => v.f.repo.execute(changed), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED");
        for (const id of [scope.taskIds[0], scope.eventIds[0]]) await assert.rejects(() => v.f.repo.execute({ type: "task.create", operationId: "reuse-" + id + "-" + i, payload: { task: { id, owner: S.partitions[0].owner, title: "Never reuse" } } }), e => e.code === "IDENTITY_CONFLICT");
        await v.f.repo.execute({ type: "task.create", operationId: "independent-" + i, payload: { task: { owner: S.partitions[0].owner, title: "Independent" } } });
        assert.throws(() => v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }), e => e.code === "HISTORY_UNAVAILABLE");
        await v.f.reopen(); assert.equal(v.f.repo.info().storage.minimumLogicalSchemaVersion, 4); assert.equal(await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"), marker);
    }
    assert.equal(v.f.repo.queryHistory().length, 0); assert.equal(preparation.historyImport.plan.groups[0].eventId, scope.eventIds[0]);
});
test("Private corrupt RECOVERY retains verified head and never substitutes an authority", async t => {
    const v = await S.imported("json", t), before = await S.stateOf(v.f); await v.f.close(); await fs.writeFile(path.join(v.f.directory, "RECOVERY.json"), "invalid backup"); await v.f.reopen(); assert.deepEqual(await S.stateOf(v.f), before); assert.equal(v.f.repo.info().storeId, before.storeId);
});
for (const kind of ["partial", "bad-checksum", "v1"]) test("Private existing " + kind + " marker stays byte-for-byte blocking", async t => {
    const v = await S.imported("json", t), id = v.f.repo.info().storeId; await v.f.close();
    const payload = { format: "itacan-recurrence-recovery-fence", version: 1, storeId: id, reason: "retained-test-evidence", recovery: {} };
    const raw = kind === "partial" ? '{"payload":' : canonical({ payload, sha256: kind === "bad-checksum" ? "0".repeat(64) : J.digest(canonical(payload)) }) + "\n";
    await fs.writeFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), raw); await v.f.reopen();
    await assert.rejects(() => v.f.repo.execute(v.publishCommand), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED"); await v.f.repo.execute({ type: "task.create", operationId: "safe-work", payload: { task: { owner: S.partitions[0].owner, title: "Safe" } } }); await v.f.reopen(); assert.equal(await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"), raw);
});
for (const damage of ["scope", "unknown-scope-marker", "future-wire", "future-logical", "future-capability", "missing-capability"]) test("Private unprovable/unsupported boundary fails closed: " + damage, async t => {
    const v = damage === "unknown-scope-marker" ? await S.fixture("json", t) : await S.prepared("json", t); await v.f.close();
    if (damage === "unknown-scope-marker") await fs.writeFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "unknown scope");
    else for (const name of ["CURRENT.json", ...(damage === "scope" ? ["RECOVERY.json"] : [])]) {
        const m = JSON.parse(await fs.readFile(path.join(v.f.directory, name), "utf8")).payload;
        if (damage === "scope") m.ancestry.barrier.importRecoveryScope = null;
        if (damage === "future-wire") m.schemaVersion = 5;
        if (damage === "future-logical") m.ancestry.barrier.minimumLogicalSchemaVersion = 5;
        if (damage === "future-capability") m.ancestry.barrier.requiredCapabilities.push("future-capability");
        if (damage === "missing-capability") delete m.ancestry.barrier.requiredCapabilities;
        await fs.writeFile(path.join(v.f.directory, name), J.encodeManifest(m));
    }
    const before = await fs.readdir(v.f.directory); await assert.rejects(() => v.f.reopen(), e => ["scope", "unknown-scope-marker"].includes(damage) ? e.code === "RECOVERY_REQUIRED" : e.code === "UNSUPPORTED_SCHEMA"); assert.deepEqual(await fs.readdir(v.f.directory), before);
});
test("A persisted fence arriving at final publication blocks import, parent/Step mutations and receipt replay", async t => {
    let armed = false, v; v = await S.prepared("json", t, await nested(), { fault: async at => {
        if (!armed || at !== "beforeManifestReplace") return;
        const payload = { format: "itacan-recurrence-recovery-fence", version: 2, storeId: v.f.repo.info().storeId, minimumSchemaVersion: 4, requiredCapabilities: ["private-history-import-v1"], importScope: S.I.scopeOf(await S.stateOf(v.f)), reason: "late-fence", recovery: {} };
        await fs.writeFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), canonical({ payload, sha256: J.digest(canonical(payload)) }));
    } });
    armed = true; await S.rejectAtomic(v, S.publish(v), "HISTORY_IMPORT_RECOVERY_FENCED"); armed = false;
    await assert.rejects(() => v.f.repo.execute(v.prepareCommand), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED");
    const ids = S.I.scopeOf(await S.stateOf(v.f)); for (const type of ["task.complete", "step.complete", "task.delete", "step.delete", "task.editStructure"]) await assert.rejects(() => v.f.repo.execute({ type, operationId: "fenced-" + type, taskId: ids.taskIds[0], expectedRevision: 1, payload: { completed: false, stepId: ids.stepIds[0] } }), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED");
});
async function terminate(v, stage, command, creating = false) {
    await v.f.close(); const requestFile = path.join(path.dirname(v.f.directory), "parent-kill-request.json");
    const request = { command, observation: v.current, clock: S.NOW + 1000, authorityId: v.f.options.expectedAuthorityId, partitions: S.partitions, creating, interruptMode: "parent-kill", idSeed: 5000000 };
    await fs.writeFile(requestFile, JSON.stringify(request));
    const child = fork(path.join(__dirname, "history-import-crash-worker.cjs"), [v.f.directory, stage, requestFile], { execPath: process.execPath, execArgv: process.execArgv.filter(x => x !== "--test"), env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    let stderr = ""; child.stderr.on("data", b => stderr += b);
    const termination = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { child.kill("SIGKILL"); reject(Error("Child did not reach " + stage + ": " + stderr)); }, 15000);
        child.once("message", msg => { try { assert.equal(msg.stage, stage); assert.equal(msg.pid, child.pid); child.kill("SIGKILL"); } catch (e) { reject(e); } });
        child.once("error", e => { clearTimeout(timer); reject(e); }); child.once("close", (code, signal) => { clearTimeout(timer); if (code === 1 && stderr) reject(Error(stderr)); else resolve({ code, signal }); });
    });
    const raw = await fs.readFile(path.join(v.f.directory, "WRITER.lock"), "utf8"), lock = JSON.parse(raw); assert.equal(lock.pid, child.pid); assert.equal(lock.host, os.hostname()); assert.match(lock.token, /^[a-f0-9-]{36}$/); assert.throws(() => process.kill(child.pid, 0), e => e.code === "ESRCH");
    await assert.rejects(() => J.openJsonRepository(v.f.options), e => e.code === "LOCK_HELD");
    const real = await fs.realpath(v.f.directory), temp = await fs.realpath(os.tmpdir()); assert(real.startsWith(temp + path.sep));
    await fs.rename(path.join(real, "WRITER.lock"), path.join(real, "parent-terminated-lock-" + lock.token + ".json"));
    process.stdout.write("E2R-PARENT-TERMINATION " + JSON.stringify({ stage, pid: child.pid, ...termination, verifiedDead: true, requestedSignal: "SIGKILL", raw, sha256: createHash("sha256").update(raw).digest("hex") }) + "\n");
}
for (const phase of ["bootstrap", "prepare", "publish", "recovered-ordinary"]) for (const stage of ["beforeManifestReplace", "afterManifestCommit"]) test(`Parent-terminated actual private child: ${phase} ${stage}`, async t => {
    let v = phase === "publish" ? await S.prepared("json", t) : phase === "recovered-ordinary" ? await S.imported("json", t) : await S.fixture("json", t), command;
    if (phase === "bootstrap") {
        // Use a fresh empty child-created root; preserve the parent's initial
        // authority separately rather than deleting its committed generation.
        const directory = path.join(path.dirname(v.f.directory), "new-private-root"); await fs.mkdir(directory); await v.f.close();
        const old = v.f, authority = S.support.id(33333); v.f = { ...old, directory, options: { ...old.options, directory, storeId: authority, expectedAuthorityId: authority }, close: async () => {}, reopen: async () => J.openJsonRepository(v.f.options) };
        command = "OPEN";
    } else if (phase === "prepare") command = S.prepare(v);
    else if (phase === "publish") command = S.publish(v);
    else {
        const m = await manifest(v.f); await v.f.close(); await fs.writeFile(path.join(v.f.directory, m.current.file), "lost acknowledged publication"); await v.f.reopen();
        command = { type: "task.create", operationId: "independent-child", payload: { task: { owner: S.partitions[0].owner, title: "Independent child" } } };
    }
    await terminate(v, stage, command, phase === "bootstrap"); const committed = stage === "afterManifestCommit";
    if (phase === "bootstrap" && !committed) { await assert.rejects(() => J.openJsonRepository(v.f.options), e => e.code === "RECOVERY_REQUIRED"); await assert.rejects(() => J.createJsonRepository(v.f.options), e => e.code === "ALREADY_EXISTS"); return; }
    const repo = await v.f.reopen(); if (phase === "bootstrap") { try { assert.equal(repo.info().schemaVersion, 1); } finally { await repo.close(); } return; }
    assert.equal(!!repo.getReceipt(command.operationId), committed); assert.equal((await repo.execute(command)).replayed, committed); core.validateState(await S.stateOf(v.f));
    if (phase === "recovered-ordinary") assert.throws(() => repo.historyCompatibility({ version: 1, projection: "statistics" }), e => e.code === "HISTORY_UNAVAILABLE");
});
for (const stage of ["fence:duringTemporaryWrite", "afterRecurrenceFenceWrite"]) test("Parent-terminated actual scoped fence: " + stage, async t => {
    const v = await S.imported("json", t), m = await manifest(v.f); await v.f.close(); await fs.writeFile(path.join(v.f.directory, m.current.file), "lost acknowledged import"); await terminate(v, stage, "OPEN");
    const marker = await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"); await v.f.reopen(); await assert.rejects(() => v.f.repo.execute(v.publishCommand), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED"); await v.f.reopen(); assert.equal(await fs.readFile(path.join(v.f.directory, "RECURRENCE-FENCE.json"), "utf8"), marker);
});
