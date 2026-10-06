"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("path");
const { parseHostsFeed, validateFeed, sourceUrl } = require("../managed/hosts-feed");
const { createManagedService, readBundle, digest, refreshIntervalMs } = require("../managed/service");
const Core = require("../core/index"), { fixture, CONFIG } = require("./helpers");
function feed(extra = [], count = 50_000) {
    const hosts = Array.from({ length: count }, (_, i) => `host${i}.test`).concat(extra);
    return `# Title: StevenBlack/hosts combined\n# Project home page: https://github.com/StevenBlack/hosts\n# Extensions added to this file: fakenews, gambling, porn, social\n# Date: 06 October 2026\n# Number of unique domains: ${hosts.length}\n127.0.0.1 localhost\n${hosts.map(h => `0.0.0.0 ${h}`).join("\n")}\n`;
}
const good = feed();
function managerFixture(options = {}) {
    let saved = options.cached ?? null, requests = 0, failSave = false, clock = 1000, responder = options.response ?? (() => new Response(feed(["new.test"]), { headers: { etag: '"version-2"', "last-modified": "Tue, 06 Oct 2026 10:00:00 GMT" } }));
    const repository = { loadManagedCache: () => saved, saveManagedCache: value => { if (failSave) return false; saved = structuredClone(value); return true; } };
    const record = { text: good, sourceUrl, sha256: digest(good), fetchedAt: null, upstreamVersion: null, etag: null, lastModified: null };
    const manager = createManagedService({ repository, bundle: () => record, now: () => clock,
        fetch: async (...args) => { requests++; return responder(...args); }, publish: options.publish ?? (work => work()) });
    return { manager, repository, record, saved: () => saved, count: () => requests,
        respond: fn => { responder = fn; }, setTime: value => { clock = value; }, failSave: value => { failSave = value; } };
}
test("hosts parser ignores comments/local mappings, normalizes exact domains, deduplicates and counts malformed names", () => {
    const parsed = parseHostsFeed("# comment\n127.0.0.1 localhost local\n::1 localhost\n0.0.0.0 Example.COM. example.com other.example.com # trailing\n0.0.0.0 bad_name.test *.test\nnot-a-host-record\n0.0.0.0\n");
    assert.deepEqual(parsed.domains, ["example.com", "other.example.com"]); assert.equal(parsed.malformedLines, 2); assert.equal(parsed.ignoredNames, 2);
});
test("remote validation rejects corrupt, empty, truncated, wrong-source and major-loss feeds", () => {
    assert.ok(validateFeed(good));
    for (const candidate of ["", "<html>error</html>", good.slice(0, 20000), good.replace("50000", "1"), good.replace("StevenBlack/hosts", "unknown/source"), good + "bad record\n"]) assert.ok(validateFeed(candidate) === null, "Malformed remote feed must be rejected");
    assert.equal(validateFeed(good, 100_000), null);
});
test("bundled snapshot verifies pinned bytes/notices and compiles the same combined source offline", () => {
    const record = readBundle(path.join(__dirname, "../managed/data")), valid = validateFeed(record.text);
    assert.ok(valid); assert.equal(valid.compiled.size, 163850); assert.equal(valid.parsed.ignoredNames, 6);
    assert.equal(record.sha256, digest(record.text));
});
test("refresh commits cache before activation, persists validators, supports 304 and survives restart", async () => {
    let publishing = false; const f = managerFixture({ publish: async work => { publishing = true; assert.equal(f.manager.lookup("new.test"), false); return work(); } });
    await f.manager.ready; assert.equal(f.count(), 0); await f.manager.refresh();
    assert.equal(publishing, true); assert.equal(f.manager.lookup("new.test"), true); assert.equal(f.saved().feed.etag, '"version-2"');
    const restarted = managerFixture({ cached: f.saved() }); await restarted.manager.ready;
    assert.equal(restarted.manager.lookup("new.test"), true); await restarted.manager.refresh(); assert.equal(restarted.count(), 0);
    restarted.setTime(1000 + refreshIntervalMs); restarted.respond((_url, options) => { assert.equal(options.headers["If-None-Match"], '"version-2"'); assert.ok(options.headers["If-Modified-Since"]); return new Response(null, { status: 304 }); });
    await restarted.manager.refresh(); assert.equal(restarted.manager.view().status, "NOT_MODIFIED"); assert.equal(restarted.manager.lookup("new.test"), true);
});
test("network, invalid-feed and failed-cache updates retain last-known-good and daily failures are throttled", async () => {
    const f = managerFixture(); await f.manager.ready;
    f.respond(() => { throw Error("offline"); }); await f.manager.refresh(); assert.equal(f.manager.view().status, "NETWORK_UPDATE_FAILED"); assert.equal(f.manager.lookup("host4.test"), true);
    await f.manager.refresh(); assert.equal(f.count(), 1); assert.equal(f.saved().lastAttemptAt, 1000);
    for (const text of ["", "bad bytes", good.slice(0, 50000)]) { f.respond(() => new Response(text)); await f.manager.refresh({ force: true }); assert.equal(f.manager.view().status, "INVALID_FEED"); assert.equal(f.manager.lookup("host4.test"), true); }
    f.failSave(true); f.respond(() => new Response(feed(["new.test"]))); await f.manager.refresh({ force: true }); assert.equal(f.manager.view().status, "CACHE_WRITE_FAILED"); assert.equal(f.manager.lookup("new.test"), false);
    const restart = managerFixture({ cached: f.saved() }); await restart.manager.ready; assert.equal(restart.manager.lookup("host4.test"), true);
});
test("corrupt cache falls back to verified bundle; invalid bundle remains unavailable", async () => {
    const f = managerFixture({ cached: { schemaVersion: 1, feed: { text: "corrupt" }, lastAttemptAt: 1000 } }); await f.manager.ready;
    assert.equal(f.manager.view().origin, "BUNDLE"); assert.equal(f.manager.lookup("host1.test"), true);
    const bad = createManagedService({ repository: f.repository, bundle: () => ({ ...f.record, sha256: "bad" }), fetch: async () => new Response(""), now: () => 0 });
    // Force a corrupt cache for this construction too.
    f.repository.saveManagedCache({ schemaVersion: 1, feed: { text: "corrupt" } }); await bad.ready;
    assert.equal(bad.getBlacklist(), null); assert.equal(bad.view().status, "MANAGED_AUTHORITY_UNAVAILABLE");
});
test("filesystem managed cache survives failed refresh and Core preserves manual Blacklist > Whitelist > managed > grants", async t => {
    const f = await fixture(t, { whitelist: ["exception.test", "manual.test"], blacklist: ["manual.test"] });
    const manager = createManagedService({ repository: f.repository, bundle: () => ({ text: good, sourceUrl, sha256: digest(good), fetchedAt: null, upstreamVersion: null, etag: null, lastModified: null }), fetch: async () => { throw Error("offline"); }, now: () => 1000 });
    await manager.ready; await manager.refresh(); assert.equal(f.repository.loadManagedCache().lastResult, "NETWORK_UPDATE_FAILED");
    const managed = Core.compileManagedBlacklist(["exception.test", "manual.test", "unknown.test"]);
    for (const [hostname, reason] of [["manual.test", "BLACKLISTED"], ["exception.test", "WHITELISTED"], ["unknown.test", "MANAGED_BLACKLISTED"]]) {
        const plan = Core.planAtlasOperation({ kind: "CHECK_NAVIGATION", target: { hostname }, context: { contextId: "test-display", journeyId: null } }, { snapshot: f.snapshot(), configuration: CONFIG, now: 1000, managedBlacklist: managed });
        assert.equal(plan.result.decision.reason, reason);
    }
    const request = Core.planAtlasOperation({ kind: "START_ACCESS", target: { hostname: "unknown.test" } }, { snapshot: f.snapshot(), configuration: CONFIG, now: 1000, managedBlacklist: managed });
    assert.equal(request.result.reason, "MANAGED_BLACKLISTED");
});
