"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs");
const { fixture, CONFIG } = require("./helpers");
const { createAtlasRuntime } = require("../obsidian/runtime");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createClock } = require("../obsidian/clock");
const { formatMilliseconds } = require("../obsidian/ui");
const outcome = response => response.decision?.outcome;

test("Whitelist releases the original request only after Core commits", async t => {
    const f = await fixture(t), c = f.attach();
    assert.equal(outcome(await f.navigate(c, "https://trusted.test/path")), "ALLOW");
    assert.equal(f.effects.releases.length, 1);
    assert.equal(JSON.parse(fs.readFileSync(f.repository.file("authority.json"))).snapshot.journeyState.journeys[0].phase, "STARTED");
    await f.arrive(c); assert.equal(c.phase, "DISPLAYED");
    assert.equal(f.snapshot().journeyState.journeys[0].endReason, "REACHED");
});
test("manual Blacklist beats overlapping Whitelist and blocks", async t => {
    const f = await fixture(t, { whitelist: ["blocked.test"], blacklist: ["blocked.test"] });
    assert.equal(outcome(await f.navigate(f.attach(), "https://blocked.test/")), "DENY");
    assert.equal(f.effects.releases.length, 0);
});
test("Greylist does not create a request until explicit action, repeated Start keeps one frozen request", async t => {
    const f = await fixture(t), c = f.attach();
    assert.equal(outcome(await f.navigate(c, "https://unknown.test/login?token=private")), "GREYLIST");
    assert.equal(f.snapshot().accessState.pendingRequests.length, 0);
    await f.command(c, "START_ACCESS"); const first = f.snapshot().accessState.pendingRequests[0];
    f.advance(2); await f.command(c, "START_ACCESS");
    assert.deepEqual(f.snapshot().accessState.pendingRequests, [first]);
    assert.equal(c.response.decision.outcome, "WAIT");
});
test("waiting alone never grants; explicit confirmation persists fixed grant and opens sanitized fresh home", async t => {
    const f = await fixture(t), c = f.attach();
    await f.navigate(c, "https://unknown.test/login?token=private"); await f.command(c, "START_ACCESS");
    f.advance(10); await f.runtime.observe();
    assert.equal(c.response.decision.outcome, "REQUIRE_CONFIRMATION");
    assert.equal(f.snapshot().accessState.grants.length, 0);
    assert.equal((await f.command(c, "CONFIRM_ACCESS_AND_OPEN")).type, "COMMITTED");
    const grant = f.snapshot().accessState.grants[0];
    assert.equal(grant.expiresAt, 1070); assert.deepEqual(f.effects.opened, ["https://unknown.test/"]);
    const saved = JSON.parse(fs.readFileSync(f.repository.file("authority.json"))).snapshot;
    assert.deepEqual(saved.accessState.grants, [grant]);
    assert.deepEqual(saved.policy.whitelist, ["trusted.test"]);
    f.advance(1); assert.equal((await f.command(c, "CONFIRM_ACCESS_AND_OPEN")).reason, "STALE_REQUEST");
    assert.deepEqual(f.snapshot().accessState.grants, [grant]);
});
test("expiry blocks navigation and removes retained temporary content", async t => {
    const f = await fixture(t), c = f.attach();
    await f.navigate(c, "https://unknown.test/"); await f.command(c, "START_ACCESS"); f.advance(10); await f.runtime.observe();
    await f.command(c, "CONFIRM_ACCESS_AND_OPEN");
    const loaded = f.attach(); await f.navigate(loaded, "https://unknown.test/"); await f.arrive(loaded);
    f.advance(60); await f.runtime.observe();
    assert.equal(loaded.phase, "BLOCKED"); assert.equal(loaded.displayed, null);
    assert.equal(outcome(await f.navigate(f.attach(), "https://unknown.test/")), "GREYLIST");
});
test("exact host grants and policy do not broaden apex, www, or subdomain scope", async t => {
    const f = await fixture(t);
    for (const hostname of ["www.trusted.test", "sub.trusted.test", "trusted.test.evil.test"]) {
        assert.equal(outcome(await f.navigate(f.attach(), `https://${hostname}/`)), "GREYLIST");
    }
});
test("malformed and ambiguous targets fail closed before release", async t => {
    const f = await fixture(t);
    for (const url of ["https://user:password@trusted.test/", "https://127.0.0.1/", "https://éxample.test/", "https://*.trusted.test/", "file:///secret", "javascript:alert(1)", "https://trusted.test\\@evil.test/"]) {
        assert.notEqual(outcome(await f.navigate(f.attach(), url)), "ALLOW", url);
    }
    assert.equal(f.effects.releases.length, 0);
});
test("Vault wait does not apply policy; review and explicit confirmation apply persisted revision", async t => {
    const f = await fixture(t);
    const candidatePolicy = { whitelist: ["trusted.test", "new.test"], blacklist: ["blocked.test"] };
    const proposal = await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy });
    assert.equal(proposal.type, "COMMITTED");
    f.advance(30); await f.runtime.observe(); assert.equal(f.snapshot().policyRevision, 0);
    const review = await f.runtime.command({ kind: "REVIEW_POLICY", proposalId: proposal.referenceId });
    assert.equal(review.review.phase, "READY"); assert.equal(review.review.classifications[0].hostname, "new.test");
    assert.equal((await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: proposal.referenceId })).type, "COMMITTED");
    assert.equal(f.snapshot().policyRevision, 1);
    assert.equal(JSON.parse(fs.readFileSync(f.repository.file("authority.json"))).snapshot.policyRevision, 1);
});
test("Vault policy and settings share one frozen slot; settings preserve old in-flight terms", async t => {
    const f = await fixture(t);
    const candidateConfiguration = structuredClone(CONFIG); candidateConfiguration.accessTiming.grantDurationMs = 500;
    const proposal = await f.runtime.command({ kind: "PROPOSE_SETTINGS", candidateConfiguration });
    assert.equal((await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: [], blacklist: [] } })).reason, "PROPOSAL_PENDING");
    candidateConfiguration.accessTiming.grantDurationMs = 999;
    f.advance(30); await f.runtime.observe();
    await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: proposal.referenceId });
    assert.equal(f.snapshot().configuration.accessTiming.grantDurationMs, 500);
    assert.equal(f.snapshot().configurationRevision, 1); assert.equal(f.snapshot().policyRevision, 0);
});
test("failed persistence never publishes Vault policy and blocks until explicit recovery", async t => {
    const f = await fixture(t);
    const proposal = await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["new.test"], blacklist: [] } });
    f.advance(30); await f.runtime.observe(); f.failWrites(true);
    assert.equal((await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: proposal.referenceId })).type, "BLOCKED");
    assert.equal(f.snapshot().policyRevision, 0); assert.notEqual(f.runtime.view().status, "READY");
    f.failWrites(false); await f.runtime.open();
    assert.equal(f.snapshot().policyRevision, 0); assert.equal(f.snapshot().vaultState.pendingProposal.id, proposal.referenceId);
});
test("lost acknowledgement reconciles written candidate without replaying confirmation", async t => {
    const f = await fixture(t), c = f.attach();
    await f.navigate(c, "https://unknown.test/"); await f.command(c, "START_ACCESS"); f.advance(10); await f.runtime.observe();
    f.loseAcknowledgement(true);
    assert.equal((await f.command(c, "CONFIRM_ACCESS_AND_OPEN")).type, "BLOCKED");
    assert.equal(f.effects.opened.length, 0);
    f.loseAcknowledgement(false); await f.runtime.open();
    assert.equal(f.snapshot().accessState.grants.length, 1); assert.equal(f.effects.opened.length, 0);
});
test("valid correlated redirect chain adopts intermediate before release and completes only on actual root arrival", async t => {
    const f = await fixture(t), c = f.attach();
    await f.navigate(c, "https://trusted.test/start"); const rootRequest = c.flight.requestId;
    await f.navigate(c, "https://idp.test/auth", { redirectedFrom: rootRequest, redirectTarget: "https://idp.test/auth" });
    assert.equal(c.response.decision.reason, "ACTIVE_JOURNEY");
    assert.equal(f.snapshot().journeyState.journeys[0].currentHostname, "idp.test"); await f.arrive(c);
    await f.navigate(c, "https://trusted.test/callback", { method: "POST", initiatorURL: c.displayed.url, initiatorIsMainFrame: true });
    assert.equal(f.snapshot().journeyState.journeys[0].phase, "IN_TRANSIT");
    const callbackRequest = c.flight.requestId;
    await f.navigate(c, "https://idp.test/check", { redirectedFrom: callbackRequest, redirectTarget: "https://idp.test/check" });
    assert.equal(c.response.decision.reason, "ACTIVE_JOURNEY");
    const request = c.flight.requestId;
    await f.navigate(c, "https://trusted.test/done", { redirectedFrom: request, redirectTarget: "https://trusted.test/done" });
    await f.arrive(c); assert.equal(f.snapshot().journeyState.journeys[0].endReason, "RETURNED");
});
test("a physically loaded Whitelist root can attest one departure and intermediate POST continuation", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/"); await f.arrive(c);
    await f.navigate(c, "https://idp.test/login", { initiatorURL: c.displayed.url, initiatorIsMainFrame: true }); await f.arrive(c);
    await f.navigate(c, "https://account.test/post", { method: "POST", initiatorURL: c.displayed.url, initiatorIsMainFrame: true });
    assert.equal(c.response.decision.reason, "ACTIVE_JOURNEY"); assert.equal(f.snapshot().journeyState.journeys[0].hopCount, 2);
});
test("unrelated script/GET navigation terminates a Journey; blacklisted redirects never release", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/");
    const previous = c.flight.requestId;
    await f.navigate(c, "https://idp.test/", { redirectedFrom: previous, redirectTarget: "https://idp.test/" }); await f.arrive(c);
    assert.notEqual(outcome(await f.navigate(c, "https://unrelated.test/", { initiatorURL: c.displayed.url, initiatorIsMainFrame: true })), "ALLOW");
    assert.equal(f.snapshot().journeyState.journeys[0].endReason, "UNRELATED_NAVIGATION");
    const d = f.attach(); await f.navigate(d, "https://trusted.test/");
    assert.equal(outcome(await f.navigate(d, "https://blocked.test/", { redirectedFrom: d.flight.requestId, redirectTarget: "https://blocked.test/" })), "DENY");
});
test("iframe promotion and forged/mismatched source do not borrow a root departure", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/"); await f.arrive(c);
    assert.notEqual(outcome(await f.navigate(c, "https://idp.test/", { initiatorURL: c.displayed.url, initiatorIsMainFrame: false })), "ALLOW");
    const d = f.attach(); await f.navigate(d, "https://trusted.test/"); await f.arrive(d);
    assert.notEqual(outcome(await f.navigate(d, "https://idp.test/", { initiatorURL: "https://trusted.test/other", initiatorIsMainFrame: true })), "ALLOW");
});
test("Journey lifetime and hop budget do not renew through reload or redirects", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/");
    const id = c.flight.requestId; await f.navigate(c, "https://idp.test/", { redirectedFrom: id, redirectTarget: "https://idp.test/" }); await f.arrive(c);
    const deadline = f.snapshot().journeyState.journeys[0].expiresAt;
    f.advance(2); await f.navigate(c, "https://idp.test/"); await f.arrive(c);
    assert.equal(f.snapshot().journeyState.journeys[0].expiresAt, deadline);
    f.setTime(deadline); await f.runtime.observe(); assert.equal(c.phase, "BLOCKED");
    assert.equal(f.snapshot().journeyState.journeys[0].endReason, "EXPIRED");
});
test("a Journey never authorizes another webviewer; closed binding and stale UI command cannot be reused", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/");
    await f.navigate(c, "https://idp.test/", { redirectedFrom: c.flight.requestId, redirectTarget: "https://idp.test/" });
    assert.notEqual(outcome(await f.navigate(f.attach(), "https://idp.test/")), "ALLOW");
    const generation = c.generation; await f.runtime.close(c);
    assert.equal((await f.runtime.command({ kind: "CANCEL_JOURNEY", contextId: c.id, generation })).reason, "STALE_CONTEXT");
    assert.notEqual(outcome(await f.navigate(c, "https://idp.test/")), "ALLOW");
});
test("restart restores grants, requests, Vault and policy but ends old Journey bindings", async t => {
    const f = await fixture(t), access = f.attach();
    await f.navigate(access, "https://unknown.test/"); await f.command(access, "START_ACCESS"); f.advance(10); await f.runtime.observe();
    await f.command(access, "CONFIRM_ACCESS_AND_OPEN");
    const pending = f.attach(); await f.navigate(pending, "https://pending.test/"); await f.command(pending, "START_ACCESS");
    const c = f.attach(); await f.navigate(c, "https://trusted.test/");
    await f.runtime.command({ kind: "PROPOSE_SETTINGS", candidateConfiguration: { ...CONFIG, journeyLimits: { lifetimeMs: 500, maxHops: 4 } } });
    f.repository.close();
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    const saved = f.snapshot();
    const runtime = createAtlasRuntime({ repository, clock: { now: () => 1011 }, configuration: CONFIG }); await runtime.open();
    assert.equal(runtime.view().status, "READY"); assert.ok(runtime.view().snapshot.vaultState.pendingProposal);
    assert.equal(runtime.view().snapshot.journeyState.journeys[0].endReason, "CONTEXT_CLOSED");
    assert.deepEqual(runtime.view().snapshot.accessState.grants, saved.accessState.grants);
    assert.deepEqual(runtime.view().snapshot.accessState.pendingRequests, saved.accessState.pendingRequests);
    assert.deepEqual(runtime.view().snapshot.policy, saved.policy);
    repository.close();
});
test("policy revision invalidates old grants and loaded pages immediately", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://unknown.test/"); await f.command(c, "START_ACCESS");
    f.advance(10); await f.runtime.observe(); await f.command(c, "CONFIRM_ACCESS_AND_OPEN");
    const loaded = f.attach(); await f.navigate(loaded, "https://unknown.test/"); await f.arrive(loaded);
    const proposal = await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["trusted.test"], blacklist: ["blocked.test", "unknown.test"] } });
    f.advance(30); await f.runtime.observe(); await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: proposal.referenceId });
    assert.equal(loaded.phase, "BLOCKED"); assert.equal(loaded.response.decision.outcome, "DENY");
    assert.equal(outcome(await f.navigate(f.attach(), "https://unknown.test/")), "DENY");
});
test("rollback, external replacement, corruption and deleted authority remain unavailable, never fresh setup", async t => {
    const f = await fixture(t); f.setTime(999); await f.runtime.observe(); assert.equal(f.runtime.view().reason, "CLOCK_ROLLBACK");
    f.setTime(1001); await f.runtime.open(); assert.equal(f.runtime.view().status, "READY");
    const file = f.repository.file("authority.json"), stored = JSON.parse(fs.readFileSync(file));
    stored.storageVersion = "external"; fs.writeFileSync(file, JSON.stringify(stored));
    await f.runtime.open(); assert.equal(f.runtime.view().status, "UNAVAILABLE");
    fs.writeFileSync(file, "{"); await f.runtime.open(); assert.equal(f.runtime.view().status, "UNAVAILABLE");
    fs.unlinkSync(file); await f.runtime.open(); assert.equal(f.runtime.view().reason, "CORRUPT_STATE");
    assert.equal((await f.runtime.command({ kind: "INITIALIZE", policy: { whitelist: [], blacklist: [] }, configuration: CONFIG })).reason, "ALREADY_INITIALIZED");
});
test("clock elapsed floor cannot extend deadlines on wall-clock rewind", () => {
    let wall = 1000, elapsed = 50; const clock = createClock(() => wall, () => elapsed);
    wall = 900; elapsed = 150; assert.equal(clock.now(), 1100);
    wall = NaN; assert.ok(Number.isNaN(clock.now()));
});
test("protected settings display preserves every safe integer millisecond exactly", () => {
    assert.equal(formatMilliseconds(Number.MAX_SAFE_INTEGER), "9007199254740.991");
    assert.equal(formatMilliseconds(1), "0.001"); assert.equal(formatMilliseconds(1000), "1");
});
