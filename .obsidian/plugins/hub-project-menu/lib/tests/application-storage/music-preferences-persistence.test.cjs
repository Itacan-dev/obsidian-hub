"use strict";
const { test } = require("node:test"), { spawn } = require("node:child_process"), { once } = require("node:events"), S = require("./support.cjs"), { assert } = S;
const { createMusicPreferences } = require(S.services + "/application-storage/music-preferences");
const { MusicLibrary } = require(S.services + "/music-library"), { musicDefaults } = require(S.services + "/../domain/music");
const audit = process.env.ITACAN_C1B_AUDIT || S.path.join(S.os.tmpdir(), "itacan-c1b-music-evidence");
async function fixture(t) {
    const directory = await S.root(), config = S.config(directory), store = S.api.createTransactionalApplicationStore(config), music = musicDefaults();
    await store.create({ version: 1, data: { music, unrelated: { preserve: true }, projectPlanning: { private: "untouched" } }, allowedScopes: [{ field: "music", dependencies: [] }] });
    t.after(() => store.close());
    const caller = (wrapper = x => x) => {
        const port = createMusicPreferences({ store, authorityId: config.authorityId, applicationContextId: config.applicationContextId });
        const plugin = { app: {}, projectWizard: { data: { music: structuredClone(music) } }, dataStore: { save() { throw Error("Legacy forbidden"); } } };
        const library = new MusicLibrary(plugin, { transactionalPreferences: wrapper(port) }); t.after(() => library.destroy()); return { library, plugin, port };
    };
    return { directory, config, store, music, caller, disk: async () => JSON.parse(await S.fs.readFile(S.path.join(directory, "data.json"), "utf8")) };
}
function child(control, stage) {
    const args = [...process.execArgv.filter(x => !x.startsWith("--test")), S.path.join(__dirname, "music-preferences-crash-worker.cjs"), control, stage];
    const p = spawn(process.execPath, args, { env: process.env, stdio: ["ignore", "pipe", "pipe", "ipc"] }), ended = once(p, "exit"), messages = [], waiters = [];
    let stdout = "", stderr = ""; p.stdout.on("data", x => stdout += x); p.stderr.on("data", x => stderr += x);
    p.on("message", m => { messages.push(m); waiters.forEach(fn => fn(m)); });
    return { p, args, ended, messages, output: () => ({ stdout, stderr }), wait(kind) { const old = messages.find(m => m.kind === kind); if (old) return Promise.resolve(old); return new Promise((resolve, reject) => { const timer = setTimeout(() => { p.kill(); reject(Error("Missing child stage: " + kind + stderr)); }, 15000); waiters.push(m => { if (m.kind === "error") { clearTimeout(timer); reject(Error(JSON.stringify(m))); } if (m.kind === kind) { clearTimeout(timer); resolve(m); } }); }); } };
}
async function snapshot(directory) {
    const files = {}; for (const n of await S.fs.readdir(directory)) { const p = S.path.join(directory, n); if ((await S.fs.lstat(p)).isFile()) { const raw = await S.fs.readFile(p); files[n] = { bytes: raw.toString("base64"), sha256: S.crypto.createHash("sha256").update(raw).digest("hex") }; } } return files;
}
test("actual caller reconstructs and reconciles retained request after later Music change", async t => {
    const f = await fixture(t), first = f.caller(); await first.library.setEnabled(true); const p = first.library.getPreferenceStatus().prepared;
    await first.library.setProviderEnabled("local", false); first.library.destroy(); await f.store.close(); await f.store.open({ version: 1 });
    const restored = f.caller(); assert.equal((await restored.library.reconcilePreferences(p)).status, "replayed"); assert.equal(restored.library.state.enabled, true); assert.equal(restored.library.state.providers.local, false);
    assert.equal((await restored.library.replayPreferences(p)).status, "replayed"); assert.equal((await f.disk()).revision, 2);
});
test("actual post-rename exception reconciles without another operation or notification", async t => {
    const f = await fixture(t), c = f.caller(), rename = S.fs.rename; let injected = false, notifications = 0; c.library.onChange(() => notifications++);
    S.fs.rename = async (...args) => { const value = await rename(...args); if (!injected && S.path.basename(String(args[1])) === "data.json") { injected = true; throw Error("lost acknowledgement"); } return value; };
    let out; try { out = await c.library.setEnabled(true); } finally { S.fs.rename = rename; }
    assert(injected); assert.equal(out.status, "uncertain"); const p = c.library.getPreferenceStatus().prepared;
    assert.equal(notifications, 0); assert.equal(c.plugin.projectWizard.data.music.enabled, false);
    await assert.rejects(c.library.setEnabled(false), { code: "MUSIC_PREFERENCE_REVIEW_REQUIRED" });
    assert.equal((await c.library.reconcilePreferences()).status, "replayed"); assert.equal(c.library.state.enabled, true); assert.equal(notifications, 1);
    assert.deepEqual(c.library.getPreferenceStatus().prepared, p); assert.equal((await f.disk()).revision, 1);
});
test("actual failed prepublication staging retains uncertainty and absent receipt across reconstruction", async t => {
    const f = await fixture(t), c = f.caller(), open = S.fs.open; let injected = false;
    S.fs.open = async (...args) => { if (String(args[0]).includes(".application.")) { injected = true; throw Error("staging unavailable"); } return open(...args); };
    let out; try { out = await c.library.setProviderEnabled("local", false); } finally { S.fs.open = open; }
    assert(injected); assert.equal(out.status, "uncertain"); const p = c.library.getPreferenceStatus().prepared;
    assert.equal((await c.library.reconcilePreferences()).status, "unknown"); await f.store.close(); await f.store.open({ version: 1 });
    const restored = f.caller(); assert.equal((await restored.library.replayPreferences(p)).status, "unknown"); assert.equal((await f.disk()).revision, 0);
    await assert.rejects(restored.library.setEnabled(true), { code: "MUSIC_PREFERENCE_REVIEW_REQUIRED" });
});
for (const stage of ["before-publication", "after-publication", "before-memory-refresh"]) for (const provider of [null, "local"]) test("parent-terminated Music caller: " + stage + "/" + (provider || "enabled"), async t => {
    const f = await fixture(t); await f.store.close(); await S.fs.mkdir(audit, { recursive: true });
    const evidence = await S.fs.mkdtemp(S.path.join(audit, stage + "-")), control = S.path.join(evidence, "control.json");
    await S.fs.writeFile(control, JSON.stringify({ config: f.config, music: f.music, provider }));
    const c = child(control, stage); t.after(async () => { if (c.p.exitCode === null && c.p.signalCode === null) c.p.kill(); await c.ended; });
    const prepared = (await c.wait("prepared")).prepared, paused = await c.wait("paused"); assert.equal(paused.stage, stage); assert.equal(paused.pid, c.p.pid);
    const lockPath = S.path.join(f.directory, "APPLICATION.lock"), raw = await S.fs.readFile(lockPath), lock = JSON.parse(raw);
    assert.equal(lock.pid, c.p.pid); assert.equal(lock.host, S.os.hostname()); S.C.uuid(lock.token); const before = await snapshot(f.directory);
    await S.fs.writeFile(S.path.join(evidence, "pause.json"), JSON.stringify({ command: { executable: process.execPath, args: c.args }, stage, provider, pid: lock.pid, host: lock.host, token: lock.token, prepared, files: before }, null, 2));
    assert(c.p.kill()); const [exitCode, signal] = await c.ended; assert(c.p.exitCode !== null || c.p.signalCode !== null); assert.throws(() => process.kill(lock.pid, 0)); assert.deepEqual(await S.fs.readFile(lockPath), raw);
    const dead = { exitCode, signal, deathProven: true, lockBytes: raw.toString("base64"), lockSha256: S.crypto.createHash("sha256").update(raw).digest("hex"), messages: c.messages, ...c.output(), files: await snapshot(f.directory) };
    await S.fs.writeFile(S.path.join(evidence, "death-before-lock-movement.json"), JSON.stringify(dead, null, 2));
    const temp = await S.fs.realpath(S.os.tmpdir()), root = await S.fs.realpath(f.directory), relative = S.path.relative(temp, root); assert(relative && !relative.startsWith("..") && !S.path.isAbsolute(relative));
    await S.fs.rename(lockPath, S.path.join(root, ".dead-application-lock-" + lock.token)); await f.store.open({ version: 1 });
    const restored = f.caller(), out = await restored.library.reconcilePreferences(prepared), committed = stage !== "before-publication";
    assert.equal(out.status, committed ? "replayed" : "unknown"); assert.equal((await restored.library.replayPreferences(prepared)).status, committed ? "replayed" : "unknown");
    const disk = await f.disk(); assert.equal(disk.revision, committed ? 1 : 0); assert.equal(disk.receipts.length, committed ? 1 : 0);
    assert.deepEqual(disk.data.unrelated, { preserve: true }); assert.deepEqual(disk.data.projectPlanning, { private: "untouched" });
    if (committed) { assert.deepEqual(restored.plugin.projectWizard.data.music, disk.data.music); assert.equal(disk.receipts[0].request.operationId, prepared.request.operationId); }
    else { assert.deepEqual(restored.plugin.projectWizard.data.music, f.music); await assert.rejects(restored.library.setEnabled(false), { code: "MUSIC_PREFERENCE_REVIEW_REQUIRED" }); }
    await f.store.close(); await S.fs.writeFile(S.path.join(evidence, "reconciliation.json"), JSON.stringify({ out, prepared, files: await snapshot(f.directory) }, null, 2));
});
