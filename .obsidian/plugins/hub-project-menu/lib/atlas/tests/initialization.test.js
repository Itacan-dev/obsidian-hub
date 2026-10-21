"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const { fixture, CONFIG } = require("./helpers");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");

test("foreign ownership is diagnosed without reclaiming, resetting or importing permissions", async t => {
    const f = await fixture(t); f.repository.close();
    const before = f.repository.read("authority.json");
    const lock = JSON.stringify({ machine: "another-computer", pid: 123, id: "foreign-owner" });
    fs.writeFileSync(f.repository.file("owner.lock"), lock);
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try {
        const runtime = createAtlasRuntime({ repository, clock: { now: () => 1001 }, configuration: CONFIG });
        await runtime.open(); await runtime.command({ kind: "RECOVER" });
        assert.equal(runtime.view().status, "UNAVAILABLE");
        assert.equal(runtime.view().repositoryIssue, "FOREIGN_OWNER");
        assert.equal(runtime.view().snapshot, null);
        assert.equal((await runtime.command({ kind: "INITIALIZE_CURATED", configuration: CONFIG })).type, "BLOCKED");
        assert.equal(repository.read("authority.json"), before);
        assert.equal(repository.read("owner.lock"), lock);
    } finally { repository.close(); }
});

test("unrelated journal and valid authority remain fenced with an actionable mismatch diagnosis", async t => {
    const f = await fixture(t); f.loseAcknowledgement(true);
    const commitId = "unrelated-transaction";
    await f.repository.commit({ expectedStorageVersion: f.runtime.view().storageVersion, commitId,
        next: { schemaVersion: 2, snapshot: f.snapshot() } });
    f.repository.close();
    const value = JSON.parse(f.repository.read("authority.json")); value.storageVersion = "another-valid-version";
    fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(value));
    const before = f.repository.read("authority.json"), journal = f.repository.read("pending.json");
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try {
        const runtime = createAtlasRuntime({ repository, clock: { now: () => 1001 }, configuration: CONFIG });
        await runtime.open();
        assert.equal(runtime.view().repositoryIssue, "COMMIT_UNRESOLVED");
        await runtime.command({ kind: "RECOVER" });
        assert.equal(runtime.view().status, "RECONCILING");
        assert.equal(runtime.view().repositoryIssue, "JOURNAL_AUTHORITY_MISMATCH");
        assert.equal(runtime.view().snapshot, null);
        assert.equal(repository.read("authority.json"), before);
        assert.equal(repository.read("pending.json"), journal);
    } finally { repository.close(); }
});

test("application schema 1 migrates preserving policy, configuration, labels, pins and revisions", async t => {
    const f = await fixture(t); f.repository.close();
    const legacy = JSON.parse(f.repository.read("authority.json"));
    legacy.application.schemaVersion = 1; delete legacy.application.recovery;
    legacy.application.destinations[0].label = "My saved destination";
    legacy.application.destinations[0].pinned = true;
    fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(legacy));
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try {
        const runtime = createAtlasRuntime({ repository, clock: { now: () => 1001 }, configuration: CONFIG });
        await runtime.open();
        assert.equal(runtime.view().status, "READY"); assert.equal(runtime.view().repositoryIssue, null);
        assert.deepEqual(runtime.view().snapshot.policy, legacy.snapshot.policy);
        assert.deepEqual(runtime.view().snapshot.configuration, legacy.snapshot.configuration);
        assert.deepEqual(runtime.view().application, { ...legacy.application, schemaVersion: 2, recovery: null });
        assert.equal(repository.read("pending.json"), null);
    } finally { repository.close(); }
});

test("fresh missing state requires explicit setup and persists its exact policy across owners", async t => {
    const f = await fixture(t), directory = path.join(f.directory, "fresh");
    const repository = new AtlasFileRepository(directory, { configuration: CONFIG });
    const policy = { whitelist: ["chosen.test"], blacklist: ["blocked.test"] };
    try {
        const runtime = createAtlasRuntime({ repository, clock: { now: () => 1001 }, configuration: CONFIG });
        await runtime.open(); assert.equal(runtime.view().status, "UNINITIALIZED");
        assert.equal(repository.read("authority.json"), null);
        await runtime.command({ kind: "INITIALIZE", policy, configuration: CONFIG });
        assert.equal(runtime.view().status, "READY"); assert.deepEqual(runtime.view().snapshot.policy, policy);
    } finally { repository.close(); }
    const restarted = new AtlasFileRepository(directory, { configuration: CONFIG });
    try {
        const runtime = createAtlasRuntime({ repository: restarted, clock: { now: () => 1002 }, configuration: CONFIG });
        await runtime.open(); assert.equal(runtime.view().status, "READY");
        assert.deepEqual(runtime.view().snapshot.policy, policy);
    } finally { restarted.close(); }
});
