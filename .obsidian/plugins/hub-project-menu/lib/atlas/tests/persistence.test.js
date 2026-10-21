"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), os = require("os");
const { fixture, CONFIG } = require("./helpers");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");

test("exclusive local owner refuses a second controller and foreign/stale-invalid locks", async t => {
    const f = await fixture(t), other = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    assert.equal((await other.load()).type, "UNAVAILABLE"); assert.equal(other.issue, "STORAGE_LOCKED");
    f.repository.close();
    fs.writeFileSync(f.repository.file("owner.lock"), JSON.stringify({ machine: "another-device", pid: process.pid, id: "foreign" }));
    assert.equal((await other.load()).type, "UNAVAILABLE");
    assert.equal(JSON.parse(fs.readFileSync(f.repository.file("owner.lock"))).id, "foreign");
});
test("CAS conflict never replaces authority or creates a journal", async t => {
    const f = await fixture(t), before = fs.readFileSync(f.repository.file("authority.json"), "utf8");
    const result = await f.repository.commit({ expectedStorageVersion: "stale", commitId: "conflict", next: { schemaVersion: 2, snapshot: f.snapshot() } });
    assert.equal(result.type, "CONFLICT"); assert.equal(f.repository.read("pending.json"), null);
    assert.equal(fs.readFileSync(f.repository.file("authority.json"), "utf8"), before);
});
test("failure before the journal is definitively NOT_WRITTEN; failure after it stays unresolved", async t => {
    const f = await fixture(t), open = f.io.openSync;
    f.io.openSync = (file, ...args) => { if (file.includes(".authority-")) throw new Error("disk full"); return open(file, ...args); };
    const request = { expectedStorageVersion: f.runtime.view().storageVersion, commitId: "write-failed", next: { schemaVersion: 2, snapshot: f.snapshot() } };
    assert.equal((await f.repository.commit(request)).type, "NOT_WRITTEN");
    f.io.openSync = open; f.failWrites(true);
    assert.equal((await f.repository.commit({ ...request, commitId: "rename-failed" })).type, "UNKNOWN");
    assert.equal((await f.repository.load()).type, "UNRESOLVED");
    f.failWrites(false);
    assert.equal((await f.repository.resolveCommit("rename-failed")).type, "NOT_WRITTEN");
    assert.equal((await f.repository.load()).type, "READY");
});
test("unresolved external replacement cannot be guessed as a committed write", async t => {
    const f = await fixture(t); f.loseAcknowledgement(true);
    const commitId = "lost-ack";
    assert.equal((await f.repository.commit({ expectedStorageVersion: f.runtime.view().storageVersion, commitId, next: { schemaVersion: 2, snapshot: f.snapshot() } })).type, "UNKNOWN");
    const authority = JSON.parse(f.repository.read("authority.json")); authority.storageVersion = "unexpected";
    fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(authority));
    assert.equal((await f.repository.resolveCommit(commitId)).type, "UNKNOWN");
    assert.equal((await f.repository.load()).type, "UNRESOLVED");
});
test("known schema 1 migrates once through the same journal/CAS path", async t => {
    const f = await fixture(t); f.repository.close();
    const legacy = JSON.parse(f.repository.read("authority.json")); legacy.schemaVersion = 1;
    delete legacy.snapshot.configuration; delete legacy.snapshot.configurationRevision;
    fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(legacy));
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try {
        const loaded = await repository.load(); assert.equal(loaded.type, "READY");
        assert.equal(loaded.envelope.schemaVersion, 2); assert.deepEqual(loaded.envelope.snapshot.configuration, CONFIG);
        assert.equal(loaded.envelope.snapshot.configurationRevision, 0);
        assert.equal(JSON.parse(repository.read("authority.json")).schemaVersion, 2);
        assert.equal(repository.read("pending.json"), null);
    } finally { repository.close(); }
});
test("deleting initialized authority after a fresh process cannot expose setup", async t => {
    const f = await fixture(t); f.repository.close(); fs.unlinkSync(f.repository.file("authority.json"));
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try { assert.deepEqual(await repository.load(), { type: "READY", envelope: null }); assert.equal(await repository.initialize(f.snapshot()), false); }
    finally { repository.close(); }
});
test("an interrupted reclamation is fail-closed, rather than removing another owner", async t => {
    const f = await fixture(t); f.repository.close();
    fs.writeFileSync(f.repository.file("owner.lock"), JSON.stringify({ machine: os.hostname(), pid: process.pid, id: "other-owner" }));
    fs.writeFileSync(f.repository.file("reclaim.lock"), "interrupted recovery");
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    assert.equal((await repository.load()).type, "UNAVAILABLE");
    assert.equal(JSON.parse(repository.read("owner.lock")).id, "other-owner");
});
test("a cached READY view never authorizes a new request after disk replacement", async t => {
    const f = await fixture(t), staleView = f.runtime.view();
    const data = JSON.parse(f.repository.read("authority.json")); data.storageVersion = "replaced";
    fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(data));
    assert.equal(staleView.status, "READY");
    assert.equal((await f.navigate(f.attach(), "https://trusted.test/")).type, "BLOCKED");
    assert.equal(f.effects.releases.length, 0);
});
test("UI cannot directly confirm raw IDs, mint Journeys or attach arbitrary target/scope facts", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://unknown.test/");
    for (const input of [
        { kind: "CONFIRM_ACCESS", requestId: 1 },
        { kind: "START_JOURNEY", root: { hostname: "trusted.test" }, contextId: c.id },
        { kind: "START_ACCESS", contextId: c.id, generation: c.generation, target: "https://evil.test" },
        { kind: "START_ACCESS", contextId: c.id, generation: c.generation, scopeHostnames: ["unknown.test", "extra.test"] }
    ]) assert.equal((await f.runtime.command(input)).reason, "INVALID_OPERATION");
    assert.equal(f.snapshot().accessState.grants.length, 0); assert.equal(f.snapshot().accessState.pendingRequests.length, 0);
});
test("restart reconciles an applied uncertain grant without replaying its confirmation or opening a page", async t => {
    const f = await fixture(t), context = f.attach();
    await f.navigate(context, "https://unknown.test/"); await f.command(context, "START_ACCESS"); f.advance(10); await f.runtime.observe();
    f.loseAcknowledgement(true); assert.equal((await f.command(context, "CONFIRM_ACCESS_AND_OPEN")).type, "BLOCKED");
    const savedGrant = JSON.parse(f.repository.read("authority.json")).snapshot.accessState.grants[0];
    f.repository.close();
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try {
        const runtime = createAtlasRuntime({ repository, clock: { now: () => 1011 }, configuration: CONFIG });
        await runtime.open(); if (runtime.view().status !== "READY") await runtime.open();
        assert.equal(runtime.view().status, "READY"); assert.deepEqual(runtime.view().snapshot.accessState.grants, [savedGrant]);
        assert.equal(runtime.view().repositoryIssue, null);
        assert.equal(f.effects.opened.length, 0); assert.equal(repository.read("pending.json"), null);
    } finally { repository.close(); }
});
