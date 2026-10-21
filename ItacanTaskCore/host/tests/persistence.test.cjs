"use strict";
const test = require("node:test"), H = require("./support.cjs"), { assert, fs, path } = H;
const { spawn } = require("node:child_process"), { createHash } = require("node:crypto");
const hash = b => createHash("sha256").update(b).digest("hex");
for (const pointer of ["CURRENT.json", "RECOVERY.json"]) test("live " + pointer + " changes fail closed without a new authority", async t => { const v = await H.fixture(t); await v.create(); const file = path.join(v.directory, pointer), raw = await fs.readFile(file, "utf8"); await fs.writeFile(file, raw + " "); const r = await v.read(); assert.notEqual(r.status, "ok"); assert.equal(v.host.info().authorityId, v.authorityId); assert.equal(await fs.readFile(file, "utf8"), raw + " "); });
test("in-place generation damage rejects a live read and performs no ancestry recovery", async t => { const v = await H.fixture(t); await v.create(); const m = JSON.parse(await fs.readFile(path.join(v.directory, "CURRENT.json"), "utf8")).payload; await fs.writeFile(path.join(v.directory, m.current.file), "damaged"); assert.notEqual((await v.read()).status, "ok"); assert.equal((await fs.readdir(v.directory)).includes("RECURRENCE-FENCE.json"), false); });
for (const kind of ["v1", "partial", "future"]) test("late fence " + kind + " blocks proof and remains byte-preserved", async t => {
    const v = await H.fixture(t), task = await v.create(), target = v.target(task); await v.mutate(task.id, "task.complete", { completed: true });
    const payload = { format: "itacan-recurrence-recovery-fence", version: kind === "future" ? 99 : 1, storeId: v.authorityId, reason: "verified-ancestor-fallback", recovery: null };
    const raw = kind === "partial" ? '{"payload":' : H.V.canonical({ payload, sha256: H.J.digest(H.V.canonical(payload)) }) + "\n", file = path.join(v.directory, "RECURRENCE-FENCE.json");
    await fs.writeFile(file, raw); const p = await v.proof([target]); assert.notEqual(p.readiness.state, "ready"); assert.equal(p.rows[0].creation, null); assert.equal(await fs.readFile(file, "utf8"), raw);
    if (kind === "v1") { assert.equal(v.host.info().readiness.state, "recovering"); const { TaskService } = require(H.root + "/.obsidian/plugins/hub-project-menu/lib/services/task-service"), service = new TaskService(H.API.createNativeReadAdapter(v.host)); t.after(() => service.close()); assert.equal((await service.read({ backend: "native", operation: "structured" })).status, "unavailable"); await v.create({ title: "Unrelated permitted work" }); await assert.rejects(v.mutate(task.id, "recurrence.complete", {})); assert.equal(await fs.readFile(file, "utf8"), raw); }
});
test("pointer changes during projection cannot publish accepted proof", async t => {
    let armed = false, directory; const v = await H.fixture(t, { repositoryOptions: { fault: async stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; await fs.appendFile(path.join(directory, "RECOVERY.json"), " "); } } } }); directory = v.directory; await v.create(); armed = true; const r = await v.read(); assert.notEqual(r.status, "ok");
});
test("root replacement loses admission and preserves the old lock", async t => {
    const v = await H.fixture(t), moved = v.directory + "-preserved"; await fs.rename(v.directory, moved); await fs.mkdir(v.directory);
    try { assert.notEqual((await v.host.refresh()).readiness.state, "ready"); assert((await fs.readdir(moved)).includes("WRITER.lock")); await assert.rejects(v.host.close()); }
    finally { await fs.rmdir(v.directory); await fs.rename(moved, v.directory); } await v.host.close();
});
for (const stage of ["beforeTemporaryWrite", "afterGenerationPublish", "beforeManifestReplace", "afterManifestCommit"]) test("creation exception at " + stage + " never silently creates another root", async t => {
    const v = await H.fixture(t, { unopened: true, repositoryOptions: { fault: s => { if (s === stage) throw Error("PRIVATE_FAULT"); } } });
    await assert.rejects(v.host.create({ version: 1, authorityId: v.authorityId, partitions: H.partitions, reason: "Synthetic fault", syntheticOnly: true })); assert.notEqual(v.host.info().readiness.state, "ready"); assert(!JSON.stringify(v.host.info()).includes("PRIVATE_FAULT"));
    if (stage === "afterManifestCommit") { const reopened = H.API.createNativeRepositoryHost(v.config, { registry: v.reg }); t.after(() => reopened.dispose()); assert.equal((await reopened.open(H.openArgs(v))).storeId, v.authorityId); }
});
async function interrupted(t, mode, stage) {
    let v, directory, authorityId;
    if (mode === "recover") {
        const I = require("../../tests/history-import-support.cjs"), iv = await I.prepared("json", null, await I.mappingCapture([{ entryId: "p", legacyId: "p", completed: false }]));
        await iv.f.repo.execute({ type: "task.create", operationId: "later-unrelated", payload: { task: { owner: H.owners[2].owner, title: "Later" } } }); directory = iv.f.directory; authorityId = iv.f.repo.info().storeId; await iv.f.close(); await fs.writeFile(path.join(directory, "CURRENT.json"), "damaged-current");
        const reg = H.registry(); reg.change(value => { for (const o of value.owners) { o.partitionId = I.partitions.find(p => H.same(p.owner, o.owner)).id; o.locations = [{ type: "folder", id: "folder-" + o.partitionId }]; } }, false);
        v = await H.fixture(t, { directory, authorityId, registry: reg, unopened: true, repositoryOptions: iv.f.options });
    } else { v = await H.fixture(t, { unopened: mode === "create" }); directory = v.directory; authorityId = v.authorityId; if (mode !== "create") { if (mode === "complete") await v.create(); await v.host.close(); } }
    const audit = process.env.ITACAN_N2_AUDIT, control = await fs.mkdtemp(path.join(audit || H.os.tmpdir(), "n2-interruption-")), signalFile = path.join(control, "signal.json");
    const guardAt = process.execArgv.indexOf("--require"), guard = guardAt >= 0 ? process.execArgv[guardAt + 1] : null;
    const args = [...(guard ? ["--require", guard] : []), path.join(__dirname, "crash-worker.cjs"), directory, authorityId, mode, stage, signalFile];
    const child = spawn(process.execPath, args, { cwd: H.root, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = ""; child.stdout.on("data", b => { out += b; }); child.stderr.on("data", b => { err += b; }); const exited = new Promise(resolve => child.once("exit", (code, signal) => resolve({ code, signal })));
    let signal;
    for (let i = 0; i < 1000; i++) { signal = await fs.readFile(signalFile, "utf8").then(JSON.parse, () => null); if (signal || child.exitCode !== null) break; await new Promise(r => setTimeout(r, 10)); }
    if (!signal) { child.kill(); await exited; await fs.writeFile(path.join(control, "failed.err.log"), err); assert.fail("Child stage not reached: " + stage + " " + err); }
    assert.equal(signal.pid, child.pid); assert.equal(signal.host, H.os.hostname());
    child.kill(); const exit = await exited; let dead = false; try { process.kill(child.pid, 0); } catch (error) { dead = error.code === "ESRCH"; } assert(dead, "Exact child must be dead before lock movement");
    const lockFile = path.join(directory, "WRITER.lock"), lock = await fs.readFile(lockFile, "utf8").catch(() => null);
    const evidence = { mode, stage, executable: process.execPath, arguments: args, pid: child.pid, host: signal.host, requestedSignal: "SIGTERM", exit, dead, token: signal.token, lock, lockSha256: lock === null ? null : hash(lock) };
    await fs.writeFile(path.join(control, "stdout.log"), out); await fs.writeFile(path.join(control, "stderr.log"), err); await fs.writeFile(path.join(control, "interruption.json"), JSON.stringify(evidence, null, 2));
    if (signal.lock !== null) { assert.equal(lock, signal.lock); assert.equal(JSON.parse(lock).token, signal.token); await fs.rename(lockFile, path.join(directory, "dead-writer-" + signal.token + ".evidence")); } else assert.equal(lock, null);
    let opened = false, errorCode = null;
    try { const result = await v.host.open(H.openArgs(v)); opened = true;
        assert.equal(result.storeId, authorityId);
        if (mode === "recover") { assert.equal(result.readiness.state, "recovering"); const marker = await fs.readFile(path.join(directory, "RECURRENCE-FENCE.json"), "utf8"); await v.create({ title: "Allowed independent work" }); await v.host.close(); await v.host.open(H.openArgs(v)); assert.equal(await fs.readFile(path.join(directory, "RECURRENCE-FENCE.json"), "utf8"), marker); assert.equal(v.host.info().storage.minimumLogicalSchemaVersion, 4); }
        if (mode === "complete") { const task = v.repo.queryTasks()[0], count = v.repo.queryHistory().length; const replay = await v.repo.execute({ type: "task.complete", operationId: "child-completion", taskId: task.id, expectedRevision: 1, payload: { completed: true } }); assert.equal(replay.replayed, true); assert.equal(count, 1); assert.equal(v.repo.queryHistory().length, 1); }
    } catch (error) { errorCode = error.code; if (mode !== "create") throw error; }
    if (mode === "create" && ["beforeSerialize", "afterGenerationPublish", "beforeManifestReplace", "open-afterAcquire"].includes(stage)) assert.equal(opened, false);
    if (mode === "create" && stage === "afterManifestCommit") assert.equal(opened, true);
    await v.host.close(); await fs.cp(directory, path.join(control, "preserved-storage"), { recursive: true }); await fs.writeFile(path.join(control, "outcome.json"), JSON.stringify({ opened, errorCode, noReplacementAuthority: true }));
}
for (const [mode, stage] of [
    ["create", "open-afterAcquire"], ["create", "beforeSerialize"], ["create", "afterGenerationPublish"], ["create", "beforeManifestReplace"], ["create", "afterManifestCommit"],
    ["open", "open-ready"], ["read", "snapshot:beforeAcceptance"], ["complete", "afterManifestCommit"], ["close", "close-beforeRelease"], ["close", "close-afterRelease"],
    ["recover", "beforeRecurrenceFenceWrite"], ["recover", "fence:duringTemporaryWrite"], ["recover", "afterRecurrenceFenceWrite"]
]) test("actual parent termination: " + mode + "/" + stage, { timeout: 25000 }, t => interrupted(t, mode, stage));
