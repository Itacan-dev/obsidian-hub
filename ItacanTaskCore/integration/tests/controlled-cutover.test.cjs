"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { fixture, fs, path, C, R, A } = require("./cutover-support.cjs");
test("plan is read-only, exact owner/bytes; durable package preserves all twelve installed originals", async t => {
    const f = await fixture(t), original = await fs.readFile(path.join(f.vault, f.source)), s = f.plan.sources[0];
    assert.equal(f.plan.owner.id, A.PROJECT); assert(original.equals(await fs.readFile(path.join(f.vault, f.source))));
    assert(Buffer.from(s.proposedBase64, "base64").equals(Buffer.from(original.toString().replace("[ ] ", ""))));
    await assert.rejects(fs.stat(f.plan.options.config.directory), { code: "ENOENT" });
    const target = path.join(f.local, "package"); await C.stagePackage(f.plan, f.staged, target); for (const a of f.plan.assets) assert.equal(A.digest(await fs.readFile(path.join(target, "previous", a.name))), a.before);
    await assert.rejects(C.stagePackage(f.plan, f.staged, target), { code: "EEXIST" });
});
test("full cutover holds actual exclusive source lock, starts empty and preserves History and other owners", async t => {
    const f = await fixture(t), history = await fs.readFile(path.join(f.packageRoot, "data.json")), seen = [];
    const result = await f.execute({ stage: async stage => { seen.push(stage); if (stage === "prepared") { await assert.rejects(fs.writeFile(path.join(f.vault, f.source), "competing writer")); const o = await R.loadActivation(f.plugin); assert.equal(o.blocked, true); } } });
    assert.equal(result.state, "active"); assert.deepEqual(seen, ["incomplete", "installed", "prepared", "retired", "active"]);
    const opts = await R.loadActivation(f.plugin); assert.equal(opts.blocked, undefined); assert.equal(opts.creating, false); await opts.assertActivation();
    assert(history.equals(await fs.readFile(path.join(f.packageRoot, "data.json")))); assert.equal(await fs.readFile(path.join(f.vault, "Projects/Other/Tasks.md"), "utf8"), "- [ ] Other legacy\n"); assert.equal(await fs.readFile(path.join(f.vault, "Resources/Knowledge/Tasks.md"), "utf8"), "- [ ] Resource legacy\n");
    assert(!(await fs.readdir(f.plan.options.config.directory)).includes("WRITER.lock")); await assert.rejects(f.execute(), { code: "EXISTING_AUTHORITY_REQUIRES_SEPARATE_REVIEW" });
});
for (const stage of ["incomplete", "installed", "prepared", "retired"]) test("interrupted at " + stage + ": preserve evidence and block both authorities", async t => {
    const f = await fixture(t); await assert.rejects(f.execute({ stage: async s => { if (s === stage) throw Error("injected interruption"); } }), /injected interruption/);
    assert((await R.loadActivation(f.plugin)).blocked); await assert.rejects(fs.stat(path.join(f.folder, "ACTIVATION-v1.json")), { code: "ENOENT" });
    assert((await fs.readFile(path.join(f.vault, f.source), "utf8")).includes(stage === "retired" ? "- Retain" : "- [ ] Retain"));
});
test("changed source, invalid backup, missing build and changed installed assets abort before authority evidence", async t => {
    const f = await fixture(t); await f.write(f.vault, f.source, "- [ ] Changed\n"); await assert.rejects(f.execute(), /prerequisites/); await assert.rejects(fs.stat(f.folder), { code: "ENOENT" });
    const g = await fixture(t); await fs.writeFile(path.join(g.plan.archive, "TASKS.txt"), "damaged"); await assert.rejects(g.execute(), /HASH_MISMATCH/);
    const h = await fixture(t); await fs.unlink(path.join(h.savedPackage, "candidate/main.js")); await assert.rejects(h.execute(), { code: "ENOENT" });
    const j = await fixture(t); await fs.writeFile(path.join(j.packageRoot, "main.js"), "changed"); await assert.rejects(j.execute(), /Installed build changed/);
});
test("device/authority/source/activation changes reject; damaged marker reserves owner", async t => {
    const f = await fixture(t); await f.execute(); f.plugin.dataStore.deviceId = "another-device"; assert((await R.loadActivation(f.plugin)).blocked); f.plugin.dataStore.deviceId = f.deviceId;
    await fs.writeFile(path.join(f.folder, "ACTIVATION-v1.json"), "{}"); assert((await R.loadActivation(f.plugin)).blocked);
    await fs.writeFile(path.join(f.folder, "CUTOVER-v1.json"), "broken"); assert((await R.loadActivation(f.plugin)).blocked);
});
test("wrong owner, shared/cloud/Git/vault path and synthetic authorization cannot admit permanent authority", async t => {
    const f = await fixture(t), b = f.plan.options.config.binding;
    await assert.rejects(A.validateBinding({ ...b, projectId: "other" }, f.plan.options.config.directory));
    await assert.rejects(A.validateBinding(b, path.join(f.vault, "repository"))); await assert.rejects(A.validateBinding(b, path.join(f.local, "elsewhere")));
    await fs.mkdir(path.join(f.local, ".git")); await assert.rejects(A.validateBinding(b, f.plan.options.config.directory), /Git/);
    const host = require("../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-host"); await assert.rejects(host.authorizeNativeTaskRehearsal(f.plugin, { ...f.plan.options, root: f.root, syntheticOnly: true }));
});
test("active Oath or Inbox selected-owner references block before writes", async t => {
    const f = await fixture(t); const file = path.join(f.packageRoot, "data.json"); await fs.writeFile(file, JSON.stringify({ oathsByDevice: { d: { current: { state: "active", workspace: f.plan.owner } } } })); await assert.rejects(f.execute(), /Oath/);
    await fs.writeFile(file, JSON.stringify({ inbox: { captures: [{ intent: { workspaceId: A.PROJECT } }] } })); await assert.rejects(f.execute(), /Inbox/);
});
test("permanent admission rejects another registry owner, partition, missing retention and synthetic permits before creation", async t => {
    const f = await fixture(t), H = require("../../host"), G = require("../../host/registry"), config = f.plan.options.config;
    await fs.mkdir(config.directory, { recursive: true });
    const body = { version: 1, registryId: config.registryId, applicationContextId: config.applicationContextId, revision: "pin", owners: [{ owner: { type: "project", id: "other" }, partitionId: "private", root: f.projectRoot, dashboard: f.dashboard, status: "active", available: true, shared: false, shareApproval: null, locations: [], mounts: [] }] };
    const registry = { read: async () => ({ ...body, digest: G.registryDigest(body) }), subscribe: () => () => {} };
    const host = H.createNativeRepositoryHost(config, { registry });
    const args = { version: 2, authorityId: config.authorityId, partitions: [{ id: "private", owner: f.plan.owner, kind: "private-project" }], reason: "Explicit fixture", verifiedCutover: true, taskMutationVersion: 1 };
    await assert.rejects(host.create(args)); assert.deepEqual(await fs.readdir(config.directory), []);
    body.owners[0].owner = f.plan.owner; await assert.rejects(host.create({ ...args, partitions: [{ ...args.partitions[0], owner: { type: "project", id: "other" } }] })); assert.deepEqual(await fs.readdir(config.directory), []);
    const { verifiedCutover, ...without } = args; await assert.rejects(host.create({ ...without, syntheticOnly: true }));
    assert.throws(() => require("../../writer").createNativeWriterSession(config, { registry, writerPolicy: {} })); await host.dispose();
});
test("exclusive acquisition rejects a same-byte intervening rewrite and releases its handle", async t => {
    const f = await fixture(t), file = path.join(f.vault, f.source), before = await fs.readFile(file);
    await new Promise(r => setTimeout(r, 20)); await fs.writeFile(file, before);
    await assert.rejects(C.sourceLock(f.plan), /write stamp changed/);
    const h = await fs.open(file, "r+"); await h.close(); assert(before.equals(await fs.readFile(file)));
});
test("new authority occupancy aborts before installation, source changes or activation evidence", async t => {
    const f = await fixture(t), before = await fs.readFile(path.join(f.packageRoot, "main.js")); await fs.mkdir(f.plan.options.config.directory, { recursive: true }); await fs.writeFile(path.join(f.plan.options.config.directory, "WRITER.lock"), "unrelated ownership evidence; never move");
    await assert.rejects(f.execute()); await assert.rejects(fs.stat(f.folder), { code: "ENOENT" }); assert(before.equals(await fs.readFile(path.join(f.packageRoot, "main.js"))));
    assert.equal(A.digest(await fs.readFile(path.join(f.vault, f.source))), f.plan.sources[0].sourceHash);
});
