"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), { spawn } = require("node:child_process");
const { createJsonRepository, openJsonRepository, decodeManifest, encodeManifest, digest } = require("../src/json-repository");
const { NodeDirectory } = require("../src/node-directory");
const { createMemoryRepository } = require("../src");
const { fixture, disposable, partitions, owners, create, mutate, rejected, randomUUID } = require("./support.cjs");
const current = async directory => decodeManifest(await fs.readFile(path.join(directory, "CURRENT.json"), "utf8"));

for (const stage of ["beforeCommit", "beforeSerialize", "beforeTemporaryWrite", "duringTemporaryWrite", "beforeFlush", "afterFlush", "beforeGenerationVerify", "afterGenerationPublish", "beforeManifestReplace"]) {
    test(`JSON: failure at ${stage} commits neither completion nor history/receipt`, async t => {
        let armed = false;
        const f = await fixture("json", t, { fault(point) { if (armed && point === stage) throw Error("injected " + stage); } });
        const task = (await f.repo.execute(create())).task, command = mutate(task, "task.complete", { completed: true });
        const notifications = []; f.repo.subscribe(change => notifications.push(change)); armed = true;
        await assert.rejects(() => f.repo.execute(command));
        assert.equal(f.repo.getTask(task.id).completed, false); assert.equal(f.repo.queryHistory().length, 0); assert.equal(f.repo.getReceipt(command.operationId), null);
        assert.equal(f.repo.info().revision, 1); assert.equal(notifications.length, 0);
        armed = false; const r = await f.reopen(); assert.equal(r.info().revision, 1); assert.equal(r.queryHistory().length, 0);
        const result = await r.execute(command); assert.equal(result.task.completed, true); assert.equal(r.queryHistory().length, 1);
    });
}
test("JSON: after-manifest acknowledgment failure is committed and retry-safe", async t => {
    let armed = false; const f = await fixture("json", t, { fault(point) { if (armed && point === "afterManifestCommit") { armed = false; throw Error("ack lost"); } } });
    const task = (await f.repo.execute(create())).task, command = mutate(task, "task.complete", { completed: true });
    const events = []; f.repo.subscribe(change => events.push(change)); armed = true;
    await rejected(assert, () => f.repo.execute(command), "ACKNOWLEDGEMENT_LOST");
    assert.equal(f.repo.getTask(task.id).completed, true); assert.equal(f.repo.queryHistory().length, 1); assert.equal(events.length, 1);
    const r = await f.reopen(); assert.equal((await r.execute(command)).replayed, true); assert.equal(r.info().revision, 2); assert.equal(r.queryHistory().length, 1);
});
test("JSON: corrupt temporary generation is rejected before publication", async t => {
    const disk = await disposable(); const port = new NodeDirectory(disk.directory); let corrupt = false, r;
    t.after(async () => { try { await r?.close(); } finally { await disk.cleanup(); } });
    const original = port.writeNew.bind(port);
    port.writeNew = async (name, data, hook) => original(name, corrupt && name.startsWith("candidate-") ? data + "damage" : data, hook);
    r = await createJsonRepository({ directory: disk.directory, storagePort: port, partitions });
    const task = (await r.execute(create())).task; corrupt = true;
    await rejected(assert, () => r.execute(mutate(task, "task.complete", { completed: true })), "INTEGRITY");
    assert.equal(r.getTask(task.id).completed, false); assert.equal(r.queryHistory().length, 0); assert.equal((await current(disk.directory)).current.revision, 1);
});
test("JSON: replacement succeeded but its acknowledgment failed is detected as committed", async t => {
    const disk = await disposable(), port = new NodeDirectory(disk.directory); let r, armed = false;
    t.after(async () => { try { await r?.close(); } finally { await disk.cleanup(); } });
    const replace = port.replace.bind(port);
    port.replace = async (source, destination) => { await replace(source, destination); if (armed && destination === "CURRENT.json") { armed = false; throw Object.assign(Error("lost replacement response"), { code: "EIO" }); } };
    r = await createJsonRepository({ directory: disk.directory, storagePort: port, partitions }); const task = (await r.execute(create())).task;
    const command = mutate(task, "task.complete", { completed: true }); armed = true;
    await rejected(assert, () => r.execute(command), "ACKNOWLEDGEMENT_LOST");
    assert.equal(r.getTask(task.id).completed, true); assert.equal(r.queryHistory().length, 1); assert.equal((await r.execute(command)).replayed, true);
});
for (const systemCode of ["EACCES", "EPERM", "EBUSY"]) {
    test(`JSON: manifest replacement ${systemCode} leaves previous commit authoritative`, async t => {
        const disk = await disposable(); const port = new NodeDirectory(disk.directory); let armed = false, r, reopened;
        t.after(async () => { try { await reopened?.close(); await r?.close(); } finally { await disk.cleanup(); } });
        const replace = port.replace.bind(port); port.replace = async (source, destination) => {
            if (armed && destination === "CURRENT.json") throw Object.assign(Error("replacement denied"), { code: systemCode });
            return replace(source, destination);
        };
        r = await createJsonRepository({ directory: disk.directory, storagePort: port, partitions });
        const task = (await r.execute(create())).task; armed = true;
        await rejected(assert, () => r.execute(mutate(task, "task.complete", { completed: true })), "IO_ERROR");
        assert.equal(r.info().revision, 1); assert.equal(r.queryHistory().length, 0); armed = false; await r.close();
        reopened = await openJsonRepository({ directory: disk.directory });
        assert.equal(reopened.getTask(task.id).completed, false); assert.equal(reopened.queryHistory().length, 0);
    });
}
test("JSON: corrupted current generation follows manifest ancestry, never orphan maximum", async t => {
    const f = await fixture("json", t); let task = (await f.repo.execute(create())).task;
    task = (await f.repo.execute(mutate(task, "task.complete", { completed: true }))).task;
    const manifest = await current(f.directory); await f.close();
    await fs.writeFile(path.join(f.directory, manifest.current.file), "corruption");
    await fs.writeFile(path.join(f.directory, `gen-999999-${randomUUID()}.json`), JSON.stringify({ title: "uncommitted impostor" }));
    const r = await f.reopen(); assert.equal(r.info().revision, 1); assert.equal(r.info().recovery.recoveredRevision, 1);
    assert.equal(r.getTask(task.id).completed, false); assert.equal(r.queryHistory().length, 0);
    await r.execute(mutate(r.getTask(task.id), "task.complete", { completed: true }));
    assert.equal(r.queryHistory().length, 1); assert((await fs.readdir(f.directory)).some(name => name.startsWith("evidence-current-")));
});
test("JSON: corrupted manifest recovers only the saved committed predecessor", async t => {
    const f = await fixture("json", t), task = (await f.repo.execute(create())).task;
    await f.repo.execute(mutate(task, "task.complete", { completed: true })); await f.close();
    await fs.writeFile(path.join(f.directory, "CURRENT.json"), "broken manifest");
    const r = await f.reopen(); assert.equal(r.info().revision, 1); assert.equal(r.info().recovery.source, "RECOVERY.json");
    assert.equal(r.getTask(task.id).completed, false); assert.equal(r.queryHistory().length, 0);
});
test("JSON: missing immediate predecessor can recover an older recorded generation", async t => {
    const f = await fixture("json", t), task = (await f.repo.execute(create())).task;
    await f.repo.execute(mutate(task, "task.complete", { completed: true })); const manifest = await current(f.directory); await f.close();
    await fs.writeFile(path.join(f.directory, manifest.current.file), "broken"); await fs.unlink(path.join(f.directory, manifest.ancestry[0].file));
    const r = await f.reopen(); assert.equal(r.info().revision, 0); assert.equal(r.info().recovery.recoveredRevision, 0);
    assert.equal(r.queryTasks().length, 0, "This is a verified committed empty generation, not a silently initialized store");
    await r.execute(create({ title: "Explicit post-recovery task" })); await f.reopen(); assert.equal(f.repo.queryTasks().length, 1);
});
test("JSON: no verified committed generation produces recovery-required, preserving evidence", async t => {
    const f = await fixture("json", t); await f.repo.execute(create()); const manifest = await current(f.directory); await f.close();
    for (const ref of [manifest.current, ...manifest.ancestry]) await fs.writeFile(path.join(f.directory, ref.file), "broken " + ref.file);
    const before = await fs.readdir(f.directory);
    await rejected(assert, () => openJsonRepository({ directory: f.directory }), "RECOVERY_REQUIRED");
    assert.deepEqual(await fs.readdir(f.directory), before); assert.equal(await fs.readFile(path.join(f.directory, manifest.current.file), "utf8"), "broken " + manifest.current.file);
});
test("JSON: unsupported newer manifest never silently downgrades", async t => {
    const f = await fixture("json", t); await f.repo.execute(create()); const m = await current(f.directory); await f.close(); m.schemaVersion = 999;
    await fs.writeFile(path.join(f.directory, "CURRENT.json"), encodeManifest(m));
    await rejected(assert, () => openJsonRepository({ directory: f.directory }), "UNSUPPORTED_SCHEMA");
});
test("JSON: invalid generation schema is detected even with a matching checksum", async t => {
    const f = await fixture("json", t); await f.repo.execute(create()); const m = await current(f.directory); await f.close();
    const state = JSON.parse(await fs.readFile(path.join(f.directory, m.current.file), "utf8")); state.schemaVersion = 2;
    const raw = JSON.stringify(state); await fs.writeFile(path.join(f.directory, m.current.file), raw); m.current.sha256 = digest(raw);
    await fs.writeFile(path.join(f.directory, "CURRENT.json"), encodeManifest(m));
    await rejected(assert, () => openJsonRepository({ directory: f.directory }), "UNSUPPORTED_SCHEMA");
});
test("JSON: manifest/lock changes are refused by a live writer", async t => {
    const f = await fixture("json", t), task = (await f.repo.execute(create())).task;
    const raw = await fs.readFile(path.join(f.directory, "CURRENT.json"), "utf8");
    await fs.writeFile(path.join(f.directory, "CURRENT.json"), raw + " ");
    await rejected(assert, () => f.repo.execute(mutate(task, "task.update", { patch: { title: "Unsafe" } })), "REPOSITORY_CONFLICT");
    assert.equal(f.repo.getTask(task.id).title, "Task α"); await fs.writeFile(path.join(f.directory, "CURRENT.json"), raw);
    const lockPath = path.join(f.directory, "WRITER.lock"), lock = await fs.readFile(lockPath, "utf8");
    await fs.writeFile(lockPath, JSON.stringify({ token: randomUUID() }));
    await rejected(assert, () => f.repo.execute(mutate(task, "task.complete", { completed: true })), "LOCK_LOST");
    await fs.writeFile(lockPath, lock); assert.equal(f.repo.queryHistory().length, 0);
});
test("JSON: independent writer rejected, lock is never automatically stolen", async t => {
    const f = await fixture("json", t); await f.repo.execute(create()); const before = await current(f.directory);
    await rejected(assert, () => openJsonRepository({ directory: f.directory }), "LOCK_HELD");
    assert.deepEqual(await current(f.directory), before); await f.close();
    await fs.writeFile(path.join(f.directory, "WRITER.lock"), JSON.stringify({ token: "unfamiliar", pid: 999999999 }));
    await rejected(assert, () => openJsonRepository({ directory: f.directory }), "LOCK_HELD");
    assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, "WRITER.lock"), "utf8")).token, "unfamiliar");
    // This synthetic directory and deliberately created lock belong to this test.
    await fs.unlink(path.join(f.directory, "WRITER.lock"));
});
test("JSON: bounded committed retention preserves unfamiliar evidence", async t => {
    const f = await fixture("json", t, { retention: 3 }); let task = (await f.repo.execute(create())).task;
    await fs.writeFile(path.join(f.directory, "unfamiliar.txt"), "do not touch"); await fs.writeFile(path.join(f.directory, "candidate-unfamiliar.tmp"), "do not touch");
    for (let i = 0; i < 9; i++) task = (await f.repo.execute(mutate(task, "task.update", { patch: { title: "Revision " + i } }))).task;
    const names = await fs.readdir(f.directory); assert.equal(names.filter(name => name.startsWith("gen-")).length, 4);
    assert.equal(await fs.readFile(path.join(f.directory, "unfamiliar.txt"), "utf8"), "do not touch");
    assert(names.includes("candidate-unfamiliar.tmp")); assert.equal((await f.reopen()).getTask(task.id).title, "Revision 8");
});
test("JSON: explicit empty-directory creation and invalid retention are safe", async t => {
    const disk = await disposable(); t.after(() => disk.cleanup());
    await rejected(assert, () => createJsonRepository({ partitions }), "VALIDATION");
    await rejected(assert, () => createJsonRepository({ directory: "relative/path", partitions }), "VALIDATION");
    await rejected(assert, () => createJsonRepository({ directory: disk.directory, partitions, retention: 1 }), "VALIDATION");
    assert.deepEqual(await fs.readdir(disk.directory), []);
    await fs.writeFile(path.join(disk.directory, "personal.txt"), "untouched");
    await rejected(assert, () => createJsonRepository({ directory: disk.directory, partitions }), "ALREADY_EXISTS");
    assert.deepEqual(await fs.readdir(disk.directory), ["personal.txt"]);
    await rejected(assert, () => openJsonRepository({ directory: disk.directory }), "RECOVERY_REQUIRED");
    assert.equal(await fs.readFile(path.join(disk.directory, "personal.txt"), "utf8"), "untouched");
});
test("memory: missing external resolvers reject associations, not workspace-only tasks", async t => {
    const f = await fixture("memory", t, { resolvers: {} });
    await rejected(assert, () => f.repo.execute(create({ location: { type: "note", id: "note-a" } })), "REFERENCE_UNRESOLVED");
    await rejected(assert, () => f.repo.execute(create({ phase: { projectId: owners.a.id, phaseId: "phase-a" } })), "REFERENCE_UNRESOLVED");
    await f.repo.execute(create()); assert.equal(f.repo.queryTasks().length, 1);
    assert.throws(() => f.repo.queryTasks({ scope: { subtree: "x" } }), error => error.code === "REFERENCE_UNRESOLVED");
});
test("partitions: malformed declarations fail before persistence", async () => {
    for (const definitions of [
        [{ id: "bad", kind: "git-project", owner: owners.resource }],
        [{ id: "bad", kind: "resource", owner: owners.a }],
        [partitions[0], partitions[0]], [partitions[0], { ...partitions[0], id: "duplicate-owner" }],
        [{ ...partitions[0], extra: "unknown" }], [{ ...partitions[0], id: "C:/absolute" }]
    ]) await rejected(assert, () => createMemoryRepository({ partitions: definitions, idFactory: randomUUID }), "VALIDATION");
});

function childRun(args) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let output = ""; child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { output += data; });
        const timer = setTimeout(() => { child.kill(); reject(Error("Child test timed out: " + output)); }, 20000);
        child.on("error", error => { clearTimeout(timer); reject(error); }); child.on("close", code => { clearTimeout(timer); resolve({ code, output, pid: child.pid }); });
    });
}
test("JSON: a second local process cannot acquire an active writer", async t => {
    const f = await fixture("json", t); const task = (await f.repo.execute(create())).task, before = await current(f.directory);
    const child = await childRun([path.join(__dirname, "crash-child.cjs"), f.directory, "none", JSON.stringify(mutate(task, "task.complete", { completed: true }))]);
    assert.equal(child.code, 1); assert.match(child.output, /Another writer or an abandoned lock/);
    assert.deepEqual(await current(f.directory), before); assert.equal(f.repo.getTask(task.id).completed, false); assert.equal(f.repo.queryHistory().length, 0);
});
for (const stage of ["duringTemporaryWrite", "afterGenerationPublish", "beforeManifestReplace", "afterManifestCommit"]) {
    test(`process interruption: ${stage} retains an explicit abandoned lock and recovers exact state`, async t => {
        const f = await fixture("json", t), task = (await f.repo.execute(create())).task, command = mutate(task, "task.complete", { completed: true }); await f.close();
        const child = await childRun([path.join(__dirname, "crash-child.cjs"), f.directory, stage, JSON.stringify(command)]);
        assert.equal(child.code, 73, child.output); await rejected(assert, () => openJsonRepository({ directory: f.directory }), "LOCK_HELD");
        const lockPath = path.join(f.directory, "WRITER.lock"), lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
        assert.equal(lock.pid, child.pid); assert.equal(lock.host, os.hostname()); assert.match(lock.token, /^[0-9a-f-]{36}$/);
        // Test-only manual recovery: this exact child has exited, and this exact
        // token/PID belongs to our uniquely created disposable directory.
        await fs.unlink(lockPath);
        const r = await f.reopen(), committed = stage === "afterManifestCommit";
        assert.equal(r.getTask(task.id).completed, committed); assert.equal(r.queryHistory().length, committed ? 1 : 0);
        assert.equal(r.getReceipt(command.operationId) !== null, committed); assert.equal(r.info().revision, committed ? 2 : 1);
        const result = await r.execute(command); assert.equal(result.replayed, committed); assert.equal(r.queryHistory().length, 1);
    });
}
test("standalone: portable entry imports with all platform/UI modules denied", async () => {
    const script = `const Module=require('node:module'); const original=Module._load; Module._load=function(id){if(!id.startsWith('.')&&!id.includes('ItacanTaskCore'))throw Error('Forbidden dependency '+id);return original.apply(this,arguments)};
        if(typeof window!=='undefined'||typeof document!=='undefined')throw Error('Unexpected DOM');
        const core=require(process.argv[1]);let id=0;const ids=()=> '00000000-0000-4000-8000-'+String(++id).padStart(12,'0');
        (async()=>{const repo=await core.createMemoryRepository({idFactory:ids,partitions:[{id:'p',kind:'private-project',owner:{type:'project',id:'p'}}]});
        await repo.execute({operationId:'standalone',type:'task.create',payload:{task:{owner:{type:'project',id:'p'},title:'No Obsidian'}}});
        if(repo.queryTasks().length!==1)throw Error('Missing task');await repo.close();process.stdout.write('portable-pass')})().catch(e=>{process.stderr.write(e.stack);process.exitCode=1});`;
    const child = await childRun(["-e", script, path.resolve(__dirname, "../src")]); assert.equal(child.code, 0, child.output); assert.match(child.output, /portable-pass/);
});
