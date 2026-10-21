"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const Core = require("../core/index");
const { createPresentation, createViewJSON } = require("../obsidian/presentation");
const { fixture, CONFIG } = require("./helpers");
const record = hostname => ({ id: hostname, hostname, label: hostname, category: "Test", aliases: [], destinations: [], pinned: false });
test("M3: indexed descriptions agree with fresh Core planning across exact scopes, precedence and deadlines", () => {
    const policy = { whitelist: ["trusted.test", "overlap.test"], blacklist: ["blocked.test", "overlap.test"] };
    let accessState = Core.createAccessState();
    const context = now => ({ policy, policyRevision: 0, state: accessState, now });
    accessState = Core.startAccess("grey.test", context(1000), CONFIG.accessTiming, ["grey.test", "alias.grey.test"]).nextState;
    const started = Core.startAccess("grant.test", context(1000), CONFIG.accessTiming); accessState = started.nextState;
    accessState = Core.confirmAccess(started.request.id, context(1010)).nextState;
    const snapshot = Core.validateAtlasSnapshot({ policy, policyRevision: 0, configuration: CONFIG, configurationRevision: 0,
        accessState, vaultState: Core.createVaultState(), journeyState: Core.createJourneyState() }).snapshot;
    const application = { destinations: ["trusted.test","blocked.test","overlap.test","grey.test","alias.grey.test","grant.test","other.test","www.grey.test"].map(record) };
    const managed = Core.compileManagedBlacklist(["trusted.test", "overlap.test", "other.test"]), describe = createPresentation();
    for (const now of [1010,1020,1069,1070,1080]) {
        const display = describe({ status: "READY", snapshot }, application, true, now, managed, true);
        for (const d of display.destinations) {
            const planned = Core.planAtlasOperation({ kind: "CHECK_NAVIGATION", target: { hostname: d.hostname }, context: { contextId: "atlas-home-description", journeyId: null } },
                { snapshot, now, configuration: CONFIG, managedBlacklist: managed });
            assert.equal(planned.result.type, "ASSESSMENT"); assert.deepEqual(d.decision, planned.result.decision, d.hostname + " at " + now);
        }
    }
});
test("M3: warm descriptions are immutable and display-only edits invalidate their metadata", async t => {
    const f = await fixture(t), before = f.runtime.view(), again = f.runtime.view();
    assert.equal(before.destinations, again.destinations); assert.ok(Object.isFrozen(before.destinations[0]));
    assert.throws(() => { before.destinations[0].hostname = "forged.test"; }, TypeError);
    const d = before.application.destinations[0];
    const saved = await f.runtime.command({ kind: "SAVE_DISPLAY_DETAILS", destinationId: d.id, label: "New display", category: d.category, pinned: !d.pinned,
        basePolicyRevision: before.snapshot.policyRevision, baseApplicationRevision: before.application.revision });
    assert.equal(saved.type, "COMMITTED"); const after = f.runtime.view();
    assert.notEqual(after.destinations, before.destinations); assert.equal(after.destinations[0].label, "New display");
    assert.deepEqual(after.snapshot.policy, before.snapshot.policy);
});
test("M3: a frozen timing proposal and its verified configuration commit invalidate presentation safely", async t => {
    const f = await fixture(t), before = f.runtime.view(), configuration = structuredClone(CONFIG); configuration.accessTiming.grantDurationMs++;
    await f.runtime.command({ kind: "PROPOSE_SETTINGS", candidateConfiguration: configuration });
    let view = f.runtime.view(); const pending = view.snapshot.vaultState.pendingProposal;
    assert.equal(view.destinations, before.destinations, "Host descriptions stay stable while a timing proposal is pending"); assert.ok(pending); assert.throws(() => { pending.candidateConfiguration.accessTiming.waitMs = 0; }, TypeError);
    assert.deepEqual(f.snapshot().configuration, CONFIG); f.advance(30);
    assert.equal((await f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: pending.id })).type, "COMMITTED");
    assert.notEqual(f.runtime.view().destinations, before.destinations); assert.equal(f.snapshot().configurationRevision, 1); assert.equal(f.snapshot().configuration.accessTiming.grantDurationMs, configuration.accessTiming.grantDurationMs);
});
test("M3: managed identity, unavailable authority and time rollback cannot reuse a permissive display", () => {
    const snapshot = { policy: { whitelist: [], blacklist: [] }, policyRevision: 0, configuration: CONFIG, configurationRevision: 0,
        accessState: Core.createAccessState(), vaultState: Core.createVaultState(), journeyState: Core.createJourneyState() };
    const application = { destinations: [record("grey.test")] }, state = { status: "READY", snapshot }, describe = createPresentation();
    const empty = Core.compileManagedBlacklist([]), blocked = Core.compileManagedBlacklist(["grey.test"]);
    const first = describe(state, application, true, 1000, empty, true);
    assert.equal(first.destinations[0].decision.outcome, "GREYLIST");
    const changed = describe(state, application, true, 1000, blocked, true); assert.notEqual(changed, first); assert.equal(changed.destinations[0].decision.reason, "MANAGED_BLACKLISTED");
    assert.equal(describe(state, application, true, 1000, null, true).destinations[0].decision.outcome, "DENY");
    assert.equal(describe({ ...state, status: "RECONCILING" }, application, true, 1000, empty, true).destinations[0].decision.outcome, "DENY");
    snapshot.accessState.lastObservedAt = 1001; assert.equal(describe(state, application, true, 1000, empty, true).destinations[0].decision.outcome, "DENY");
});
test("M3: unchanged observation retains security checkpoints without redundant presentation publications", async t => {
    const f = await fixture(t); let notifications = 0, writes = 0; const write = f.io.writeFileSync;
    f.io.writeFileSync = (...args) => { writes++; return write(...args); };
    const unsubscribe = f.runtime.subscribe(() => notifications++);
    for (let i = 0; i < 3; i++) { f.advance(1000); await f.runtime.observe(); }
    assert.equal(notifications, 0); assert.ok(writes >= 6, "Core time checkpoints still persist");
    assert.equal(f.snapshot().accessState.lastObservedAt, 4000); unsubscribe();
});
test("M3: request and Vault phase changes still publish once and never confirm automatically", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://grey.test/"); await f.command(c, "START_ACCESS");
    let notifications = 0; const unsubscribe = f.runtime.subscribe(() => notifications++);
    f.advance(1); await f.runtime.observe(); assert.equal(notifications, 0);
    f.advance(9); await f.runtime.observe(); assert.equal(notifications, 1); assert.equal(c.response.decision.outcome, "REQUIRE_CONFIRMATION");
    f.advance(1); await f.runtime.observe(); assert.equal(notifications, 1);
    f.advance(60); await f.runtime.observe(); assert.equal(notifications, 2); assert.equal(c.response.decision.reason, "REQUEST_EXPIRED");
    assert.equal(f.snapshot().accessState.grants.length, 0);
    await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["trusted.test", "new.test"], blacklist: ["blocked.test"] } }); notifications = 0;
    f.advance(1); await f.runtime.observe(); assert.equal(notifications, 0);
    f.advance(29); await f.runtime.observe(); assert.equal(notifications, 1);
    f.advance(1); await f.runtime.observe(); assert.equal(notifications, 1);
    f.advance(60); await f.runtime.observe(); assert.equal(notifications, 2); assert.equal(f.snapshot().policyRevision, 0); unsubscribe();
});
test("M3: cached ALLOW descriptions never release a request after disk authority changes", async t => {
    const f = await fixture(t), cached = f.runtime.view(), c = f.attach();
    assert.equal(cached.destinations.find(d => d.hostname === "trusted.test").decision.outcome, "ALLOW");
    const file = path.join(f.directory, "authority.json"), envelope = JSON.parse(fs.readFileSync(file, "utf8"));
    envelope.snapshot.policy.blacklist.push("trusted.test"); fs.writeFileSync(file, JSON.stringify(envelope));
    await f.navigate(c, "https://trusted.test/"); assert.equal(f.effects.releases.length, 0);
    assert.equal(f.runtime.view().status, "UNAVAILABLE"); assert.equal(f.runtime.view().destinations.find(d => d.hostname === "trusted.test").decision.outcome, "DENY");
});
test("M3: lost acknowledgement invalidates the cache and reconciliation exposes the saved proposal without replay", async t => {
    const f = await fixture(t), before = f.runtime.view(); f.loseAcknowledgement(true);
    const result = await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["trusted.test", "new.test"], blacklist: ["blocked.test"] } });
    assert.equal(result.type, "BLOCKED"); assert.equal(f.runtime.view().status, "RECONCILING");
    assert.equal(f.runtime.view().destinations[0].decision.outcome, "DENY"); f.loseAcknowledgement(false);
    await f.runtime.command({ kind: "RECOVER" }); const after = f.runtime.view();
    assert.equal(after.status, "READY"); assert.ok(after.snapshot.vaultState.pendingProposal); assert.equal(after.snapshot.policyRevision, before.snapshot.policyRevision);
});
test("M3: serialized transport reuses identical data and invalidates actual state and managed changes", () => {
    let encodings = 0, state = { status: "READY", enabled: true, storageVersion: "one", contexts: [], destinations: [], temporaryDestinations: [], managed: { status: "ACTIVE" } };
    const read = createViewJSON(() => state, value => { encodings++; return JSON.stringify(value); });
    const first = read(); assert.equal(read(), first); assert.equal(encodings, 1);
    state = { ...state, managed: { status: "UPDATING" } }; assert.notEqual(read(), first); assert.equal(encodings, 2);
    state = { ...state, storageVersion: "two" }; read(); assert.equal(encodings, 3);
    state = { ...state, destinations: [{ id: "new" }] }; read(); assert.equal(encodings, 4);
});

test("M3: durable recovery copy creation and discard invalidate metadata without changing active policy", async t => {
    const f = await fixture(t); await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { whitelist: ["trusted.test", "saved.test"], blacklist: ["blocked.test"] } });
    f.advance(91); const before = f.runtime.view(), id = before.snapshot.vaultState.pendingProposal.id, rename = f.io.renameSync; let injected = false;
    f.io.renameSync = (from,to) => { const next = JSON.parse(fs.readFileSync(from,"utf8")); if (next.application?.recovery && next.snapshot.vaultState.pendingProposal === null) { injected = true; throw Error("stop after durable copy"); } return rename(from,to); };
    assert.equal((await f.runtime.command({kind:"RECREATE_POLICY",proposalId:id})).type,"BLOCKED"); f.io.renameSync = rename; assert.ok(injected);
    await f.runtime.command({kind:"RECOVER"}); const saved = f.runtime.view();
    assert.ok(saved.application.recovery); assert.notEqual(saved.destinations,before.destinations);
    assert.deepEqual(saved.snapshot.policy,before.snapshot.policy);
    await f.runtime.command({kind:"DISCARD_RECOVERY",recoveryId:saved.application.recovery.id});
    const after = f.runtime.view(); assert.equal(after.application.recovery,null); assert.notEqual(after.destinations,saved.destinations); assert.deepEqual(after.snapshot.policy,before.snapshot.policy);
});
test("M3: grant expiry invalidates a warm description and the native runtime still refuses release", async t => {
    const f=await fixture(t),context=f.attach(); await f.navigate(context,"https://grey.test/"); await f.command(context,"START_ACCESS"); f.advance(10); await f.command(context,"CONFIRM_ACCESS_AND_OPEN");
    const before=f.runtime.view();assert.equal(before.temporaryDestinations[0].decision.reason,"ACTIVE_GRANT");
    f.advance(60);const after=f.runtime.view();assert.notEqual(after.temporaryDestinations,before.temporaryDestinations);assert.equal(after.temporaryDestinations[0].decision.reason,"GRANT_EXPIRED");
    const fresh=f.attach(),released=f.effects.releases.length;await f.navigate(fresh,"https://grey.test/");assert.equal(f.effects.releases.length,released);assert.equal(fresh.response.decision.outcome,"GREYLIST");
});
