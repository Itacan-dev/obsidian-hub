"use strict";
const test = require("node:test"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), { fork } = require("node:child_process"), { createHash } = require("node:crypto"), S = require("./adapter-support.cjs"), J = require("../../src/json-repository");
const cases = [ ...["enrollment", "fulfillment"].flatMap(mode => ["file-flushed", "before-publication", "after-publication"].map(stage => [mode, stage])), ["native-ack", "native-ack"], ["unsaved-latch", "unsaved-latch"], ["terminal", "before-release"] ];
test("actual lost acknowledged imported completion stays fenced through unrelated work and restart", async t => {
 let draw = 950000; const iv = await S.I.imported("json", t, await S.I.mappingCapture([{ entryId: "p", legacyId: "p", completed: false }]), { idFactory: () => S.H.S.id(++draw) });
 const f = iv.f, task = iv.result.tasks[0], target = S.H.nativeTarget(f.repo, task);
 const command = S.I.mutate(task, "task.complete", { completed: true, completedAt: null }, "lost-completion"); await f.repo.execute(command);
 const manifest = J.decodeManifest(await fs.readFile(path.join(f.directory, "CURRENT.json"), "utf8")); await f.close(); await fs.writeFile(path.join(f.directory, manifest.current.file), "lost acknowledged generation"); await f.reopen();
 S.assert.equal(f.repo.info().storage.fenced, true); const marker = await fs.readFile(path.join(f.directory, "RECURRENCE-FENCE.json"), "utf8");
 for (let i=0;i<2;i++) {
  const b = await S.bind(t, { f, task, target }); const r = await b.adapter.refresh(); S.assert.equal(r.readiness.state, "recovering"); S.assert(r.rows.every(row => row.eligibility.state !== "eligible")); b.adapter.dispose(); await b.provider.close();
  await S.assert.rejects(f.repo.execute(command), e => e.code === "HISTORY_IMPORT_RECOVERY_FENCED");
  await f.repo.execute({ type: "task.create", operationId: "unrelated-" + i, payload: { task: { owner: task.owner, title: "Unrelated" } } });
  S.assert.throws(() => f.repo.exportSharedPartition(task.partitionId));
  const serializer = require("../../src/serialization"); S.assert.throws(() => serializer.serializeSharedPartition({ partition: f.repo.info().partitions.find(p => p.id === task.partitionId), tasks: [f.repo.getTask(task.id)] }), e => e.code === "UNSUPPORTED_OPERATION");
  await f.reopen(); S.assert.equal(await fs.readFile(path.join(f.directory, "RECURRENCE-FENCE.json"), "utf8"), marker); S.assert.equal(f.repo.info().storage.minimumLogicalSchemaVersion, 4);
 }
});
for (const [mode, stage] of cases) test("actual parent interruption: " + mode + " / " + stage, { timeout: 25000 }, async t => {
 const disk = await S.I.base.disposable(); t.after(() => disk.cleanup());
 const child = fork(path.join(__dirname, "adapter-crash-worker.cjs"), [disk.root, mode, stage], { execPath: process.execPath, execArgv: process.execArgv.filter(x => x !== "--test"), windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
 let stderr = "", stdout = "", reached = null;
 child.stderr.on("data", b => stderr += b); child.stdout.on("data", b => stdout += b);
 const termination = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill("SIGKILL"); reject(Error("No pause reached: " + stderr)); }, 18000);
  child.on("message", msg => { try { S.assert.equal(msg.pid, child.pid); S.assert.equal(msg.stage, stage); S.assert.equal(msg.mode, mode); reached = msg; child.kill("SIGKILL"); } catch (e) { child.kill("SIGKILL"); reject(e); } });
  child.on("error", e => { clearTimeout(timer); reject(e); }); child.on("close", (code, signal) => { clearTimeout(timer); reached ? resolve({ code, signal }) : reject(Error("Child exited before pause: " + stderr)); });
 });
 const directory = path.join(disk.root, "native"), lockRaw = await fs.readFile(path.join(directory, "WRITER.lock"), "utf8"), lock = JSON.parse(lockRaw);
 S.assert.equal(lock.pid, child.pid); S.assert.equal(lock.host, os.hostname()); S.assert.match(lock.token, /^[a-f0-9-]{36}$/); S.assert.throws(() => process.kill(child.pid, 0), e => e.code === "ESRCH");
 const options = { directory, storageFormat: "private-v4", expectedAuthorityId: S.H.S.id(800000), idFactory: (() => { let n = 900000; return () => S.H.S.id(++n); })(), clock: () => 1792224000000 };
 await S.assert.rejects(J.openJsonRepository(options), e => e.code === "LOCK_HELD");
 const real = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir()); S.assert(real.startsWith(temp + path.sep));
 // Preserve the exact verified dead lock inside its own disposable root; never clear a recovery fence.
 await fs.rename(path.join(real, "WRITER.lock"), path.join(real, "dead-child-lock-" + lock.token + ".json"));
 const data = JSON.parse(await fs.readFile(path.join(disk.root, "plugin", "data.json"), "utf8")); const bucket = data.oathsByDevice["candidate-device"];
 const repo = await J.openJsonRepository(options); t.after(() => repo.close()); const task = repo.getTask(S.H.S.id(50000));
 if (mode === "enrollment") S.assert.equal(bucket.current === null, stage !== "after-publication");
 if (mode === "fulfillment") { S.assert.equal(bucket.current.fulfilledAt !== null, stage === "after-publication"); S.assert(task.completed); }
 if (mode === "native-ack") { S.assert(task.completed); S.assert.equal(bucket.current.fulfilledAt, null); S.assert.equal((await repo.execute({ type: "task.complete", operationId: "genuine", taskId: task.id, expectedRevision: 1, payload: { completed: true, completedAt: null } })).replayed, true); }
 if (mode === "unsaved-latch") { S.assert.equal(bucket.current.fulfilledAt, null); S.assert.equal(task.completed, false); }
 if (mode === "terminal") { S.assert.equal(bucket.current.state, "fulfilled"); S.assert.equal(bucket.history.length, 1); const fixture = S.H.legacy().fixture(); try { fixture.wizard.data.oathsByDevice = data.oathsByDevice; S.assert.equal(await fixture.oath.end(bucket.current.id, "fulfilled"), "inactive"); S.assert.equal(fixture.oath.bucket.history.length, 1); } finally { await fixture.close(); } }
 const state = await S.I.stateOf({ repo, directory, options }); await repo.close();
 const evidence = { mode, stage, ...termination, pid: child.pid, verifiedDead: true, lockRaw, lockSha256: createHash("sha256").update(lockRaw).digest("hex"), data, nativeState: state, stdout, stderr };
 if (process.env.ITACAN_F2_EVIDENCE_DIR) { const dest = await fs.realpath(process.env.ITACAN_F2_EVIDENCE_DIR); S.assert(dest.startsWith(temp + path.sep)); await fs.mkdir(path.join(dest, "f2-crashes"), { recursive: true }); await fs.writeFile(path.join(dest, "f2-crashes", mode + "-" + stage + ".json"), JSON.stringify(evidence, null, 2)); }
 process.stdout.write("F2-PARENT-TERMINATION " + JSON.stringify({ mode, stage, ...termination, pid: child.pid, verifiedDead: true, lockRaw, lockSha256: evidence.lockSha256, evidenceRetained: !!process.env.ITACAN_F2_EVIDENCE_DIR }) + "\n");
});
