"use strict";
const { test } = require("node:test"), S = require("./support.cjs"), { assert } = S;
const { createMusicPreferences } = require(S.services + "/application-storage/music-preferences");
const { MusicLibrary } = require(S.services + "/music-library");
const { musicDefaults, createMusicItem, MUSIC_PROVIDERS } = require(S.services + "/../domain/music");
async function fixture(t, music = musicDefaults(), wrapper = x => x) {
    const directory = await S.root(), cfg = S.config(directory), store = S.api.createTransactionalApplicationStore(cfg);
    const data = { unrelated: { private: "sentinel" }, categories: [{ id: "excluded" }], taskMetadata: { private: "retain" }, workspaceMode: { value: 0 } };
    if (music !== undefined) data.music = music;
    await store.create({ version: 1, data, allowedScopes: [{ field: "music", dependencies: [] }, { field: "workspaceMode", dependencies: [] }] });
    t.after(() => store.close());
    const plugin = { app: { get vault() { throw Error("Vault access forbidden"); } }, projectWizard: { data: structuredClone(data) }, dataStore: { save() { throw Error("Legacy save forbidden"); } } };
    const port = createMusicPreferences({ store, authorityId: cfg.authorityId, applicationContextId: cfg.applicationContextId });
    const library = new MusicLibrary(plugin, { transactionalPreferences: wrapper(port), metadata: false });
    t.after(() => library.destroy());
    return { store, cfg, directory, plugin, port, library, disk: async () => JSON.parse(await S.fs.readFile(S.path.join(directory, "data.json"), "utf8")) };
}
const populated = () => ({ ...musicDefaults(), items: [
    { ...createMusicItem({ provider: "youtube", source: "https://youtu.be/dQw4w9WgXcQ", name: "Private song" }, "stable-music-id"), metadata: { videoId: "dQw4w9WgXcQ", extra: { private: [1, 2] } }, artwork: "https://example.com/art" },
    createMusicItem({ provider: "local", source: "Assets/Music/song.ogg" }, "local-id") ] });
for (const initial of [musicDefaults, populated]) test("real Music toggles retain items/metadata and unrelated fields: " + initial.name, async t => {
    const music = initial(), f = await fixture(t, music), before = await f.disk(); let notices = 0;
    f.library.onChange(() => notices++);
    assert.throws(() => f.library.state, { code: "MUSIC_PREFERENCES_UNAVAILABLE" });
    for (const enabled of [true, false]) {
        assert.equal((await f.library.setEnabled(enabled)).status, "committed"); assert.equal(f.library.state.enabled, enabled);
    }
    for (const provider of MUSIC_PROVIDERS) for (const enabled of [false, true]) {
        assert.equal((await f.library.setProviderEnabled(provider.id, enabled)).status, "committed");
        assert.equal(f.library.state.providers[provider.id], enabled);
        assert.deepEqual(f.library.state.items, music.items);
    }
    const after = await f.disk(); assert.equal(notices, 10);
    for (const k of ["unrelated", "categories", "taskMetadata", "workspaceMode"]) assert.deepEqual(after.data[k], before.data[k]);
    assert.deepEqual(after.allowedScopes, before.allowedScopes);
    assert.deepEqual(f.plugin.projectWizard.data.music, after.data.music);
});
test("absent field uses defaults without a read-time conversion", async t => {
    const f = await fixture(t); await f.store.close();
    // Separate profile seeded without Music; no existing profile is converted.
    const dir = await S.root(), cfg = S.config(dir), store = S.api.createTransactionalApplicationStore(cfg); t.after(() => store.close());
    await store.create({ version: 1, data: { private: "keep" }, allowedScopes: [{ field: "music", dependencies: [] }] });
    const port = createMusicPreferences({ store, authorityId: cfg.authorityId, applicationContextId: cfg.applicationContextId });
    const read = await port.read(); assert.equal(read.field.present, false);
    const p = port.prepare({ kind: "set-enabled", enabled: true }, read);
    assert.deepEqual(p.request.changes[0].expected, { present: false, digest: null });
    assert.equal((await port.submit(p)).status, "committed");
    assert.deepEqual((await port.read()).field.value, { ...musicDefaults(), enabled: true });
});
for (const value of [{}, { ...musicDefaults(), enabled: 1 }, { ...musicDefaults(), version: 2 }, { ...musicDefaults(), privateUnknown: "keep" }, { ...populated(), items: [{ provider: "local", source: "song.ogg" }] }]) test("present repair/migration is refused: " + JSON.stringify(value).slice(0, 65), async t => {
    const f = await fixture(t, value), before = await f.disk(); await assert.rejects(f.library.setEnabled(true), { code: "MUSIC_REPAIR_REQUIRED" });
    assert.deepEqual(await f.disk(), before); assert.deepEqual(f.plugin.projectWizard.data.music, value);
});
test("invalid provider and unknown intents/fields reject before transaction", async t => {
    const f = await fixture(t), r = await f.port.read();
    for (const i of [{ kind: "set-provider-enabled", provider: "other", enabled: true }, { kind: "replace", enabled: true }, { kind: "set-enabled", enabled: true, items: [] }]) assert.throws(() => f.port.prepare(i, r));
    await assert.rejects(f.library.setProviderEnabled("other", true)); assert.equal((await f.disk()).revision, 0);
});
test("disjoint stale request preserves unrelated change; intervening Music conflicts", async t => {
    const f = await fixture(t), p = f.port.prepare({ kind: "set-enabled", enabled: true }, await f.port.read());
    const r = await f.store.readScopes({ version: 1, authorityId: f.cfg.authorityId, applicationContextId: f.cfg.applicationContextId, fields: ["workspaceMode"] });
    const q = S.request({ cfg: f.cfg }, r, { workspaceMode: { value: 42 } });
    assert.equal((await f.store.transact(q)).status, "committed");
    assert.equal((await f.library.replayPreferences(p)).status, "committed"); assert.equal((await f.disk()).data.workspaceMode.value, 42);
    const stale = f.port.prepare({ kind: "set-enabled", enabled: false }, await f.port.read());
    await f.library.setProviderEnabled("local", false);
    const memory = structuredClone(f.plugin.projectWizard.data.music);
    assert.equal((await f.library.replayPreferences(stale)).code, "FIELD_CONFLICT");
    assert.deepEqual(f.plugin.projectWizard.data.music, memory);
    await assert.rejects(f.library.setEnabled(false), { code: "MUSIC_PREFERENCE_REVIEW_REQUIRED" });
});
test("exact replay reads later current Music, not historical result; changed intent conflicts", async t => {
    const f = await fixture(t); await f.library.setEnabled(true); const p = f.library.getPreferenceStatus().prepared;
    await f.library.setProviderEnabled("local", false); const revision = (await f.disk()).revision;
    assert.equal((await f.library.replayPreferences(p)).status, "replayed"); assert.equal(f.library.state.providers.local, false); assert.equal((await f.disk()).revision, revision);
    const changed = f.port.prepare({ kind: "set-enabled", enabled: false }, p.original, p.request.operationId);
    assert.equal((await f.library.replayPreferences(changed)).code, "OPERATION_CONFLICT");
    assert.deepEqual(f.library.getPreferenceStatus().prepared, p, "original evidence survives a conflicting retry");
    const copy = f.library.getPreferenceStatus(); copy.prepared.request.reason = "mutated"; assert.deepEqual(f.library.getPreferenceStatus().prepared, p);
    assert.equal((await f.library.reconcilePreferences()).status, "replayed");
});
for (const tamper of [p => p.request.changes[0].value.items.push({}), p => p.request.changes[0].field = "workspaceMode", p => p.request.reason = "changed", p => p.original.field.digest = "0".repeat(64)]) test("prepared evidence cannot become arbitrary writing: " + tamper.toString(), async t => {
    const f = await fixture(t), p = structuredClone(f.port.prepare({ kind: "set-enabled", enabled: true }, await f.port.read())); tamper(p);
    await assert.rejects(f.port.submit(p)); assert.equal((await f.disk()).revision, 0);
});
test("commit survives refresh outage; unavailable memory cannot masquerade as current", async t => {
    let fail = false;
    const f = await fixture(t, musicDefaults(), port => ({ ...port, read: () => fail ? Promise.reject(Error("private error sentinel")) : port.read(), submit: async (...args) => { const o = await port.submit(...args); fail = true; return o; } }));
    assert.equal((await f.library.setEnabled(true)).status, "committed");
    assert.equal(f.library.getPreferenceStatus().readiness, "unavailable"); assert.throws(() => f.library.state, { code: "MUSIC_PREFERENCES_UNAVAILABLE" });
    assert.equal(f.plugin.projectWizard.data.music.enabled, false); assert.equal((await f.disk()).data.music.enabled, true);
    fail = false; await f.library.refreshPreferences(); assert.equal(f.library.state.enabled, true);
});
test("current authoritative refresh uses latest application object and contains listener failures", async t => {
    let replacement; const f = await fixture(t, populated(), port => ({ ...port, submit: async (...args) => { const out = await port.submit(...args); replacement = { unrelated: "latest", music: musicDefaults() }; f.plugin.projectWizard.data = replacement; return out; } }));
    const prior = f.plugin.projectWizard.data; let notices = 0; const log = console.error; console.error = () => {}; t.after(() => console.error = log);
    f.library.onChange(() => { throw Error("listener failure"); }); f.library.onChange(() => notices++);
    await f.library.setEnabled(true); assert.equal(f.plugin.projectWizard.data, replacement); assert.equal(replacement.unrelated, "latest"); assert.equal(prior.music.enabled, false); assert.equal(notices, 1);
    assert.deepEqual(replacement.music.items, populated().items);
});
test("unadopted mutations and Spotify's generic queue fail before side effects", async t => {
    const f = await fixture(t); let effects = 0;
    for (const work of [() => f.library.enqueue(() => effects++), () => f.library.save(musicDefaults()), () => f.library.add({}), () => f.library.addLocalFiles(["missing"]), () => f.library.update("id", {}), () => f.library.remove("id"), () => f.library.move("id", 1), () => f.library.reorder([])]) await assert.rejects(work(), { code: "MUSIC_MUTATION_NOT_ADOPTED" });
    assert.equal(effects, 0); assert.equal((await f.disk()).revision, 0);
});
test("unknown/uncertain keeps exact original, blocks further actions, and requires explicit reconciliation", async t => {
    let response = "uncertain", submissions = 0;
    const f = await fixture(t, musicDefaults(), port => ({ ...port, submit: async p => { submissions++; return response === "commit" ? port.submit(p) : { version: 1, privacy: "local-private", status: response, code: "SYNTHETIC_UNCERTAINTY" }; } }));
    assert.equal((await f.library.setEnabled(true)).status, "uncertain"); const p = f.library.getPreferenceStatus().prepared;
    await assert.rejects(f.library.setEnabled(false), { code: "MUSIC_PREFERENCE_REVIEW_REQUIRED" }); assert.equal(submissions, 1);
    assert.equal((await f.library.reconcilePreferences()).status, "unknown"); assert.deepEqual(f.library.getPreferenceStatus().prepared, p);
    response = "commit"; assert.equal((await f.library.replayPreferences(p)).status, "committed"); assert.equal(f.library.state.enabled, true);
});
test("disposal during read prevents memory/listener publication, without undoing commitment", async t => {
    const gate = S.gate(); let reads = 0, entered = S.gate();
    const f = await fixture(t, musicDefaults(), port => ({ ...port, read: async () => { const r = await port.read(); if (++reads === 2) { entered.resolve(); await gate.promise; } return r; } }));
    let notices = 0; f.library.onChange(() => notices++); const pending = f.library.setEnabled(true); await entered.promise; f.library.destroy(); gate.resolve();
    assert.equal((await pending).status, "committed"); assert.equal((await f.disk()).data.music.enabled, true); assert.equal(f.plugin.projectWizard.data.music.enabled, false); assert.equal(notices, 0);
    await assert.rejects(f.library.setEnabled(false), { code: "MUSIC_DISPOSED" });
});
test("pre-aborted exact submission has no revision; absent/current returns are detached", async t => {
    const f = await fixture(t), r = await f.port.read(), p = f.port.prepare({ kind: "set-enabled", enabled: true }, r), controller = new AbortController(); controller.abort();
    assert(Object.isFrozen(p.request.changes[0].value)); assert.equal((await f.port.submit(p, controller.signal)).status, "cancelled"); assert.equal((await f.disk()).revision, 0);
});

test("same service queue serializes adopted actions without losing either preference", async t => {
    const f = await fixture(t); const outcomes = await Promise.all([f.library.setEnabled(true), f.library.setProviderEnabled("local", false), f.library.setProviderEnabled("spotify", false)]);
    assert.deepEqual(outcomes.map(o => o.status), ["committed", "committed", "committed"]); assert.equal(f.library.state.enabled, true); assert.equal(f.library.state.providers.local, false); assert.equal(f.library.state.providers.spotify, false); assert.equal((await f.disk()).revision, 3);
});
test("actual Spotify save cannot use the opted-in Music queue", async t => {
    const f = await fixture(t), { SpotifyConnectBackend } = require(S.services + "/spotify-connect"); f.plugin.musicLibrary = f.library;
    const backend = new SpotifyConnectBackend(f.plugin, { safeStorage: false, request() { throw Error("Network forbidden"); } }); t.after(() => backend.destroy());
    const memory = structuredClone(f.plugin.projectWizard.data);
    await assert.rejects(backend.save({ clientId: "synthetic" }), { code: "MUSIC_MUTATION_NOT_ADOPTED" });
    assert.deepEqual(f.plugin.projectWizard.data, memory); assert.equal((await f.disk()).revision, 0);
});
test("lost caller response after actual commitment retains pending identity and blocks a new action", async t => {
    const f = await fixture(t, musicDefaults(), port => ({ ...port, submit: async p => { await port.submit(p); throw Error("response lost"); } }));
    assert.equal((await f.library.setEnabled(true)).status, "uncertain"); const p = f.library.getPreferenceStatus().prepared;
    await assert.rejects(f.library.setEnabled(false), { code: "MUSIC_PREFERENCE_REVIEW_REQUIRED" });
    assert.equal((await f.library.reconcilePreferences()).status, "replayed"); assert.equal(f.library.state.enabled, true); assert.deepEqual(f.library.getPreferenceStatus().prepared, p); assert.equal((await f.disk()).revision, 1);
});
test("Music without a declared independent scope cannot access additional fields", async t => {
    const directory = await S.root(), cfg = S.config(directory), store = S.api.createTransactionalApplicationStore(cfg); t.after(() => store.close());
    await store.create({ version: 1, data: { music: musicDefaults(), workspaceMode: {} }, allowedScopes: [{ field: "music", dependencies: ["workspaceMode"] }] });
    const port = createMusicPreferences({ store, authorityId: cfg.authorityId, applicationContextId: cfg.applicationContextId });
    await assert.rejects(port.read(), { code: "SCOPE_UNSUPPORTED" });
});

test("externally retained retry is detached before it waits in the existing queue", async t => {
    const f = await fixture(t), p = structuredClone(f.port.prepare({ kind: "set-enabled", enabled: true }, await f.port.read()));
    const pending = f.library.replayPreferences(p); p.request.reason = "mutated after invocation"; p.intent.enabled = false;
    assert.equal((await pending).status, "committed"); assert.equal(f.library.state.enabled, true);
    assert.notEqual(f.library.getPreferenceStatus().prepared.request.reason, p.request.reason);
});

test("caller retry detachment rejects nonportable extras rather than silently dropping evidence", async t => {
    const f = await fixture(t), p = structuredClone(f.port.prepare({ kind: "set-enabled", enabled: true }, await f.port.read()));
    p.unsupported = undefined;
    assert.throws(() => f.library.replayPreferences(p), { code: "APPLICATION_CONTRACT" });
    assert.equal((await f.disk()).revision, 0);
});
