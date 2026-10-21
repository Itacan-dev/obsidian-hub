"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const { fixture, CONFIG } = require("./helpers");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");
const { serviceHostnames } = require("../presets/curated-whitelist");
const entry = (hostname, changes = {}) => ({ id: "destination:" + hostname, label: "Saved work", category: "Work",
    hostname, aliases: [], destinations: [], pinned: false, ...changes });
const propose = (f, destination, previousId = null, hostAccess = serviceHostnames(destination).map(hostname => ({ hostname, access: "WHITELIST" }))) =>
    f.runtime.command({ kind: "PROPOSE_DESTINATION", destination, hostAccess, previousId,
        basePolicyRevision: f.snapshot().policyRevision, baseApplicationRevision: f.runtime.view().application.revision });
async function confirm(f) {
    f.advance(31); return f.runtime.command({ kind: "CONFIRM_POLICY", proposalId: f.snapshot().vaultState.pendingProposal.id });
}
async function expired(f) {
    // Use the original closed operation to isolate persistence from editor changes.
    await f.runtime.command({ kind: "PROPOSE_DESTINATION", destination: entry("saved.test"), previousId: null, access: "WHITELIST",
        basePolicyRevision: 0, baseApplicationRevision: 0 });
    const pending = structuredClone(f.snapshot().vaultState.pendingProposal); f.advance(91); return pending;
}
const restore = f => f.runtime.command({ kind: "RESTORE_RECOVERY", recoveryId: f.runtime.view().application.recovery.id,
    basePolicyRevision: f.snapshot().policyRevision, baseConfigurationRevision: f.snapshot().configurationRevision,
    baseApplicationRevision: f.runtime.view().application.revision });
function failPhase(f, phase, after = false) {
    const original = f.io.renameSync; let injected = false;
    f.io.renameSync = (from, to) => {
        const next = JSON.parse(fs.readFileSync(from, 'utf8')), draft = next.application?.recovery, pending = next.snapshot?.vaultState.pendingProposal;
        const hit = !injected && draft && (phase === 'copy' ? pending?.id === draft.sourceProposalId && next.lastCommitId.startsWith('presentation:') :
            phase === 'cancel' ? !pending : pending && pending.id !== draft.sourceProposalId);
        if (hit) { injected = true; if (!after) throw Error('injected before ' + phase); }
        original(from, to); if (hit && after) throw Error('injected lost acknowledgement after ' + phase);
    };
    return () => { f.io.renameSync = original; assert.ok(injected, 'failure reached ' + phase); };
}
test("F02: edited curated identity survives import, repeat import, and overlapping aliases without closing an authorized context", async t => {
    const f = await fixture(t, { whitelist: ["github.com", "www.github.com", "trusted.test"], blacklist: ["www.chatgpt.com"] });
    const old = f.runtime.view().application.destinations.find(d => d.hostname === "github.com");
    const edited = { ...old, hostname: "code.test", label: "My code", category: "Private", pinned: false,
        aliases: ["www.github.com", "chatgpt.com"] };
    await f.runtime.command({ kind: "PROPOSE_DESTINATION", destination: edited, previousId: old.id, access: "WHITELIST",
        basePolicyRevision: 0, baseApplicationRevision: 0 }); await confirm(f);
    const context = f.attach(); await f.navigate(context, "https://trusted.test/"); await f.arrive(context);
    const blocks = f.effects.blocks.length, before = structuredClone(f.snapshot().policy);
    const imported = await f.runtime.command({ kind: "IMPORT_CURATED" });
    assert.equal(imported.type, "COMMITTED"); assert.equal(f.effects.blocks.length, blocks); assert.equal(context.response.decision.outcome, "ALLOW");
    assert.deepEqual(f.snapshot().policy, before);
    const draft = f.runtime.view().application.pending.destinations;
    assert.equal(new Set(draft.map(d => d.id)).size, draft.length);
    assert.deepEqual(draft.find(d => d.id === old.id), edited);
    assert.notEqual(draft.find(d => d.hostname === "github.com").id, old.id);
    assert.equal(draft.some(d => d.hostname === "chatgpt.com"), false, "an existing explicit alias is not imported as a new primary");
    assert.ok(f.snapshot().vaultState.pendingProposal.candidatePolicy.blacklist.includes("www.chatgpt.com"));
    await confirm(f);
    const committed = structuredClone(f.runtime.view().application.destinations);
    const again = await f.runtime.command({ kind: "IMPORT_CURATED" });
    assert.notEqual(again.type, "BLOCKED"); assert.deepEqual(f.runtime.view().application.destinations, committed);
    assert.equal(f.effects.blocks.length, blocks);
});
test("F03: a failure before cancellation preserves the expired proposal and its exact display draft", async t => {
    const f = await fixture(t), old = await expired(f), draft = structuredClone(f.runtime.view().application.pending);
    const reset = failPhase(f, "copy"); const result = await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id }); reset();
    assert.equal(result.type, "BLOCKED"); await f.runtime.open();
    assert.equal(f.snapshot().vaultState.pendingProposal.id, old.id); assert.deepEqual(f.runtime.view().application.pending, draft);
    assert.equal(f.snapshot().policy.whitelist.includes("saved.test"), false);
});
test("F03: cancellation or replacement failure retains a durable non-authoritative draft across a new repository owner", async t => {
    const f = await fixture(t), old = await expired(f);
    const reset = failPhase(f, "replacement");
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "BLOCKED"); reset();
    f.repository.close();
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    const runtime = createAtlasRuntime({ repository, clock: { now: () => 1092 }, configuration: CONFIG });
    try {
        await runtime.open(); assert.equal(runtime.view().status, 'RECONCILING');
        await runtime.command({ kind: 'RECOVER' });
        assert.equal(runtime.view().status, "READY"); assert.equal(runtime.view().snapshot.vaultState.pendingProposal, null);
        const recovery = runtime.view().application.recovery;
        assert.ok(recovery); assert.deepEqual(recovery.policy, old.candidatePolicy);
        assert.equal(recovery.destinations.find(d => d.hostname === "saved.test").label, "Saved work");
        assert.equal(runtime.view().snapshot.policy.whitelist.includes("saved.test"), false);
        const result = await runtime.command({ kind: "RESTORE_RECOVERY", recoveryId: recovery.id,
            basePolicyRevision: 0, baseConfigurationRevision: 0, baseApplicationRevision: 0 });
        assert.equal(result.type, "COMMITTED");
        const replacement = runtime.view().snapshot.vaultState.pendingProposal;
        assert.notEqual(replacement.id, old.id); assert.equal(replacement.readyAt - replacement.createdAt, CONFIG.vaultTiming.waitMs);
        assert.equal((await runtime.command({ kind: "CONFIRM_POLICY", proposalId: replacement.id })).reason, "NOT_READY");
    } finally { repository.close(); }
});
test("F03: cancellation write failure leaves both original proposal and recovery copy", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "cancel");
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "BLOCKED"); reset(); await f.runtime.open();
    assert.equal(f.snapshot().vaultState.pendingProposal.id, old.id);
    assert.deepEqual(f.runtime.view().application.recovery.policy, old.candidatePolicy);
    assert.equal((await restore(f)).type, "COMMITTED"); assert.notEqual(f.snapshot().vaultState.pendingProposal.id, old.id);
    assert.equal(f.snapshot().policy.whitelist.includes("saved.test"), false);
});
test("F03: lost replacement acknowledgement is reconciled, never retried or confirmed automatically", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "replacement", true);
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "BLOCKED"); reset();
    const disk = JSON.parse(fs.readFileSync(f.repository.file("authority.json"), "utf8"));
    assert.ok(disk.application.recovery); const replacementId = disk.snapshot.vaultState.pendingProposal.id;
    assert.notEqual(replacementId, old.id); await f.runtime.open();
    assert.equal(f.snapshot().vaultState.pendingProposal.id, replacementId);
    assert.equal((await restore(f)).reason, "REPLACEMENT_ALREADY_SAVED");
    assert.equal(f.snapshot().vaultState.pendingProposal.id, replacementId); assert.equal(f.snapshot().policyRevision, 0);
    await confirm(f); assert.ok(f.snapshot().policy.whitelist.includes("saved.test")); assert.equal(f.runtime.view().application.recovery, null);
});
test("F03: recovery checks current revisions and requires explicit review after another policy commits", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "replacement");
    await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id }); reset(); await f.runtime.open();
    const saved = structuredClone(f.runtime.view().application.recovery);
    await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: { ...f.snapshot().policy, whitelist: [...f.snapshot().policy.whitelist, "concurrent.test"] } }); await confirm(f);
    assert.equal((await f.runtime.command({ kind: "RESTORE_RECOVERY", recoveryId: saved.id,
        basePolicyRevision: saved.basePolicyRevision, baseConfigurationRevision: saved.baseConfigurationRevision,
        baseApplicationRevision: saved.baseApplicationRevision })).reason, "STALE_DRAFT");
    assert.deepEqual(f.runtime.view().application.recovery, saved);
    assert.equal((await restore(f)).type, "COMMITTED", "a fresh explicit review may propose the exact saved values");
    assert.ok(f.snapshot().policy.whitelist.includes("concurrent.test")); assert.equal(f.snapshot().policy.whitelist.includes("saved.test"), false);
    assert.equal(f.snapshot().vaultState.pendingProposal.readyAt - f.snapshot().vaultState.pendingProposal.createdAt, 30);
});
test("F05: per-host intent preserves mixed policy on metadata-only edits and hostname changes", async t => {
    const f = await fixture(t, { whitelist: ["github.com"], blacklist: ["www.github.com"] });
    const old = f.runtime.view().application.destinations.find(d => d.hostname === "github.com"), before = structuredClone(f.snapshot().policy);
    const hostAccess = [{ hostname: "github.com", access: "WHITELIST" }, { hostname: "www.github.com", access: "BLACKLIST" }];
    assert.equal((await propose(f, { ...old, label: "Only a name", category: "Work", pinned: false }, old.id, hostAccess)).type, "COMMITTED");
    assert.deepEqual(f.snapshot().policy, before); assert.equal(f.snapshot().vaultState.pendingProposal, null);
    const current = f.runtime.view().application.destinations.find(d => d.id === old.id);
    assert.equal((await propose(f, { ...current, hostname: "code.test" }, old.id,
        [{ hostname: "code.test", access: "WHITELIST" }, hostAccess[1]])).type, "COMMITTED");
    const id = f.snapshot().vaultState.pendingProposal.id, result = await f.runtime.command({ kind: "REVIEW_POLICY", proposalId: id });
    assert.equal(result.review.classifications.some(c => c.hostname === "www.github.com"), false);
    await confirm(f); assert.deepEqual(f.snapshot().policy, { whitelist: ["code.test"], blacklist: ["www.github.com"] });
});
test("F05: grey primary and white alias survive display edits; explicit multi-host change appears in Core review and commit", async t => {
    const f = await fixture(t);
    const d = entry("grey.test", { aliases: ["white.test"] }), mixed = [{ hostname: "grey.test", access: "GREYLIST" }, { hostname: "white.test", access: "WHITELIST" }];
    assert.equal((await propose(f, d, null, mixed)).type, "COMMITTED"); await confirm(f);
    const before = structuredClone(f.snapshot().policy);
    assert.equal((await propose(f, { ...d, category: "Mixed", pinned: true }, d.id, mixed)).type, "COMMITTED");
    assert.deepEqual(f.snapshot().policy, before); assert.equal(f.snapshot().vaultState.pendingProposal, null);
    assert.equal((await propose(f, d, d.id, mixed.map(h => ({ ...h, access: "BLACKLIST" })))).type, "COMMITTED");
    const id = f.snapshot().vaultState.pendingProposal.id, result = await f.runtime.command({ kind: "REVIEW_POLICY", proposalId: id });
    assert.deepEqual(result.review.classifications.map(c => [c.hostname, c.after]), [["grey.test", "BLACKLIST"], ["white.test", "BLACKLIST"]]);
    await confirm(f); assert.ok(f.snapshot().policy.blacklist.includes("grey.test")); assert.ok(f.snapshot().policy.blacklist.includes("white.test"));
});
test("F05: per-host operations reject missing, duplicate or foreign host scope without changing authority", async t => {
    const f = await fixture(t), d = entry("scope.test");
    for (const hosts of [[], [{ hostname: "else.test", access: "WHITELIST" }], [{ hostname: "scope.test", access: "WHITELIST" }, { hostname: "scope.test", access: "GREYLIST" }]]) {
        assert.equal((await propose(f, d, null, hosts)).reason, "INVALID_HOST_ACCESS");
    }
    assert.equal(f.snapshot().policyRevision, 0); assert.equal(f.snapshot().vaultState.pendingProposal, null);
});

test("F02: recoverable import validation rejects locally without taking down browsing", async t => {
    const f = await fixture(t), context = f.attach();
    await f.navigate(context, "https://trusted.test/"); await f.arrive(context);
    const before = structuredClone(f.snapshot()), blocks = f.effects.blocks.length, stage = f.repository.stageApplication;
    f.repository.stageApplication = () => { throw Error("recoverable metadata validation"); };
    assert.deepEqual(await f.runtime.command({ kind: "IMPORT_CURATED" }), { type: "REJECTED", reason: "CURATED_METADATA_CONFLICT" });
    f.repository.stageApplication = stage;
    assert.equal(f.effects.blocks.length, blocks); assert.equal(context.response.decision.outcome, "ALLOW"); assert.equal(f.runtime.view().status, "READY");
    assert.deepEqual(f.snapshot(), before);
});
test("F02: a primary edit cannot replace a record identity", async t => {
    const f = await fixture(t), old = f.runtime.view().application.destinations[0];
    assert.equal((await propose(f, { ...old, id: "different-identity" }, old.id)).reason, "DESTINATION_ID_CHANGED");
    assert.equal(f.snapshot().vaultState.pendingProposal, null);
});
test("F03: legacy application metadata migrates atomically without altering Core or user destination data", async t => {
    const f = await fixture(t); await f.runtime.command({ kind: "PROPOSE_DESTINATION", destination: entry("legacy.test"), access: "WHITELIST", previousId: null,
        basePolicyRevision: 0, baseApplicationRevision: 0 });
    const disk = JSON.parse(fs.readFileSync(f.repository.file("authority.json"), "utf8"));
    disk.application.schemaVersion = 1; delete disk.application.recovery; f.repository.close();
    fs.writeFileSync(f.repository.file("authority.json"), JSON.stringify(disk));
    const repository = new AtlasFileRepository(f.directory, { configuration: CONFIG });
    try {
        const loaded = await repository.load(); assert.equal(loaded.type, "READY");
        assert.deepEqual(loaded.envelope.snapshot, disk.snapshot);
        assert.deepEqual(repository.application(), { ...disk.application, schemaVersion: 2, recovery: null });
        assert.notEqual(loaded.envelope.storageVersion, disk.storageVersion);
        const committedVersion = loaded.envelope.storageVersion;
        assert.equal((await repository.load()).envelope.storageVersion, committedVersion, "migration is not repeated");
    } finally { repository.close(); }
});
test("F03: corrupt, extended or authoritative-looking recovery data is rejected by the closed metadata schema", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "replacement");
    await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id }); reset(); await f.runtime.open();
    const { validateApplication } = require("../obsidian/application"), app = f.runtime.view().application;
    assert.ok(validateApplication(app, f.snapshot()));
    for (const recovery of [{ ...app.recovery, active: true }, { ...app.recovery, operation: "CONFIRM_POLICY" },
        { ...app.recovery, policy: { whitelist: ["*.test"], blacklist: [] } }, { ...app.recovery, configuration: {} },
        { ...app.recovery, destinations: [...app.recovery.destinations, app.recovery.destinations[0]] }]) {
        assert.equal(validateApplication({ ...app, recovery }, f.snapshot()), null);
    }
    assert.equal((await f.runtime.command({ kind: "RESTORE_RECOVERY", recoveryId: app.recovery.id,
        basePolicyRevision: 0, baseConfigurationRevision: 0, baseApplicationRevision: 0, confirm: true })).reason, "INVALID_OPERATION");
});
test("F03: a failed recovery-copy cleanup leaves the verified replacement and never activates it", async t => {
    const f = await fixture(t), old = await expired(f), rename = f.io.renameSync; let injected = false;
    f.io.renameSync = (from, to) => {
        const next = JSON.parse(fs.readFileSync(from, "utf8")), p = next.snapshot.vaultState.pendingProposal;
        const hit = p && p.id !== old.id && next.application.recovery === null;
        rename(from, to); if (hit) { injected = true; throw Error("cleanup acknowledgement lost"); }
    };
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "BLOCKED");
    f.io.renameSync = rename; assert.ok(injected); await f.runtime.open();
    assert.notEqual(f.snapshot().vaultState.pendingProposal.id, old.id); assert.equal(f.runtime.view().application.recovery, null);
    assert.equal(f.snapshot().policy.whitelist.includes("saved.test"), false);
});
test("F03: explicit recovery of already-current policy saves reviewed display values without a security change", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "replacement");
    await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id }); reset(); await f.runtime.open();
    await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: old.candidatePolicy }); await confirm(f);
    assert.ok(f.runtime.view().application.recovery); const before = structuredClone(f.snapshot().policy), revision = f.snapshot().policyRevision;
    assert.equal((await restore(f)).type, "COMMITTED");
    assert.deepEqual(f.snapshot().policy, before); assert.equal(f.snapshot().policyRevision, revision); assert.equal(f.snapshot().vaultState.pendingProposal, null);
    assert.equal(f.runtime.view().application.destinations.find(d => d.hostname === "saved.test").label, "Saved work");
    assert.equal(f.runtime.view().application.recovery, null);
});
test("F03: recovered timing draft retains concurrent policy and is protected by current timing terms", async t => {
    const f = await fixture(t), candidateConfiguration = { ...CONFIG, vaultTiming: { waitMs: 80, confirmationWindowMs: 90 } };
    await f.runtime.command({ kind: "PROPOSE_SETTINGS", candidateConfiguration }); const old = f.snapshot().vaultState.pendingProposal; f.advance(91);
    const reset = failPhase(f, "replacement"); await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id }); reset(); await f.runtime.open();
    const policy = { ...f.snapshot().policy, whitelist: [...f.snapshot().policy.whitelist, "concurrent.test"].sort() };
    await f.runtime.command({ kind: "PROPOSE_POLICY", candidatePolicy: policy }); await confirm(f);
    assert.equal((await restore(f)).type, "COMMITTED");
    const p = f.snapshot().vaultState.pendingProposal;
    assert.deepEqual(p.candidateConfiguration, candidateConfiguration); assert.deepEqual(p.candidatePolicy, policy);
    assert.equal(p.readyAt - p.createdAt, CONFIG.vaultTiming.waitMs);
    assert.deepEqual(f.snapshot().configuration, CONFIG); assert.deepEqual(f.snapshot().policy, policy);
    await confirm(f); assert.deepEqual(f.snapshot().configuration, candidateConfiguration); assert.deepEqual(f.snapshot().policy, policy);
});
test("F05: untouched blacklist precedence also preserves overlapping list membership exactly", async t => {
    const f = await fixture(t, { whitelist: ["github.com", "www.github.com"], blacklist: ["www.github.com"] });
    const old = f.runtime.view().application.destinations.find(d => d.hostname === "github.com"), before = structuredClone(f.snapshot().policy);
    const result = await propose(f, { ...old, pinned: !old.pinned, label: "Display only" }, old.id,
        [{ hostname: "github.com", access: "WHITELIST" }, { hostname: "www.github.com", access: "BLACKLIST" }]);
    assert.equal(result.type, "COMMITTED"); assert.deepEqual(f.snapshot().policy, before); assert.equal(f.snapshot().vaultState.pendingProposal, null);
});

test("F03: a reconciled replacement can expire and be explicitly recreated without discarding the retained copy first", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "replacement", true);
    await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id }); reset(); await f.runtime.open();
    const savedId = f.runtime.view().application.recovery.id, replacement = f.snapshot().vaultState.pendingProposal;
    f.advance(91);
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: replacement.id })).type, "COMMITTED");
    const latest = f.snapshot().vaultState.pendingProposal;
    assert.notEqual(latest.id, replacement.id); assert.deepEqual(latest.candidatePolicy, old.candidatePolicy);
    assert.equal(latest.readyAt - latest.createdAt, CONFIG.vaultTiming.waitMs);
    assert.equal(f.runtime.view().application.recovery, null); assert.ok(savedId);
    assert.equal(f.snapshot().policy.whitelist.includes("saved.test"), false);
});

test("F03: a lost recovery-copy acknowledgement never consumes the source proposal or retries recreation", async t => {
    const f = await fixture(t), old = await expired(f), reset = failPhase(f, "copy", true);
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "BLOCKED"); reset();
    const disk = JSON.parse(fs.readFileSync(f.repository.file("authority.json"), "utf8"));
    assert.equal(disk.snapshot.vaultState.pendingProposal.id, old.id); assert.ok(disk.application.recovery);
    await f.runtime.open();
    assert.equal(f.snapshot().vaultState.pendingProposal.id, old.id, "Reconciliation does not consume the source proposal");
    assert.deepEqual(f.runtime.view().application.recovery.policy, old.candidatePolicy);
    assert.equal(f.snapshot().policy.whitelist.includes("saved.test"), false);
    assert.equal((await f.runtime.command({ kind: "RECREATE_POLICY", proposalId: old.id })).type, "COMMITTED");
    assert.notEqual(f.snapshot().vaultState.pendingProposal.id, old.id);
    assert.equal(f.snapshot().policyRevision, 0);
});
