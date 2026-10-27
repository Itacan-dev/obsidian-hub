"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { createHash } = require("node:crypto");
const { fixture, CONFIG } = require("./helpers");
const { AtlasFileRepository } = require("../obsidian/persistence");
const { createAtlasRuntime } = require("../obsidian/runtime");

const names = ["owner.lock", "initialized", "authority.json", "pending.json"];
const read = (directory, name) => {
    try { return fs.readFileSync(path.join(directory, name), "utf8"); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
};
const records = directory => Object.fromEntries(names.map(name => [name, read(directory, name)]));
const unchanged = (f, expected = f.before) => assert.deepEqual(records(f.directory), expected);
const digest = text => createHash("sha256").update(text).digest("hex");
const reviewCommand = { kind: "REVIEW_STORAGE_OWNERSHIP" };
async function review(f) {
    const result = await f.runtime.command(reviewCommand);
    assert.equal(result.type, "STORAGE_OWNERSHIP_REVIEW", JSON.stringify(result));
    assert.equal(typeof result.repairId, "string");
    assert.ok(result.repairId.length > 0);
    assert.ok(Number.isSafeInteger(result.expiresAt));
    return result;
}
const repair = (f, proof, confirmed = true) => f.runtime.command({
    kind: "REPAIR_STORAGE_OWNERSHIP", repairId: proof.repairId, localCopyConfirmed: confirmed
});
function backedUp(f, proof) {
    const directory = path.join(f.directory, "ownership-backups", proof.repairId);
    for (const name of names) assert.equal(read(directory, name), f.before[name], "Exact original backup: " + name);
}
async function foreign(t, prepare = async () => {}, transform = () => {}) {
    const cleanups = [], original = await fixture({ after: fn => cleanups.push(fn) });
    let repository;
    t.after(() => {
        try { repository?.close(); }
        finally { for (const cleanup of cleanups.reverse()) cleanup(); }
    });
    await prepare(original);
    const saved = structuredClone(original.runtime.view()), time = { now: original.runtime.now() + 1 };
    original.repository.close();
    const owner = JSON.stringify({ machine: "copied-from-" + os.hostname(), pid: process.pid, id: "foreign-copy-owner" });
    fs.writeFileSync(original.repository.file("owner.lock"), owner);
    transform(original.directory);
    const before = records(original.directory), io = Object.create(fs);
    repository = new AtlasFileRepository(original.directory, { io, configuration: CONFIG });
    const runtime = createAtlasRuntime({ repository, clock: { now: () => time.now }, configuration: CONFIG });
    await runtime.open();
    const effects = { opened: [], releases: [], blocks: [], leases: [] };
    let nativeId = 0, requestId = 0;
    const attach = () => runtime.attach(++nativeId, {
        block: response => effects.blocks.push(response), lease: response => effects.leases.push(response),
        openHome: origin => effects.opened.push(origin)
    });
    const navigate = (context, url) => runtime.navigate(context,
        { requestId: "repair-r" + ++requestId, loaderId: "repair-l" + requestId, method: "GET", url },
        response => effects.releases.push(response), () => {});
    return { directory: original.directory, before, saved, repository, runtime, io, time, effects, attach, navigate };
}

test("ownership: ordinary recovery preserves a foreign owner and never silently initializes or repairs", async t => {
    const f = await foreign(t), controller = f.runtime.controller;
    assert.equal(f.runtime.view().repositoryIssue, "FOREIGN_OWNER");
    for (let i = 0; i < 3; i++) await f.runtime.command({ kind: "RECOVER" });
    await f.runtime.observe();
    assert.equal(f.runtime.controller, controller);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    assert.equal(f.runtime.view().snapshot, null);
    assert.equal(f.runtime.view().repositoryIssue, "FOREIGN_OWNER");
    assert.equal(f.runtime.view().recovery.automaticAttempts, 0);
    unchanged(f);
    assert.equal(fs.existsSync(path.join(f.directory, "ownership-backups")), false);
});

test("ownership: reviewing the copied state is read-only, bounded and does not expose browsing or owner details", async t => {
    const f = await foreign(t), beforeCounts = f.runtime.view().storage;
    const proof = await review(f);
    assert.equal(proof.authorityPresent, true);
    assert.equal(proof.policyRevision, f.saved.snapshot.policyRevision);
    assert.equal(proof.configurationRevision, f.saved.snapshot.configurationRevision);
    assert.equal(proof.destinationCount, f.saved.application.destinations.length);
    assert.equal(proof.journalPending, false);
    assert.ok(proof.expiresAt > Date.now() && proof.expiresAt <= Date.now() + 300_000);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    assert.equal(f.runtime.view().snapshot, null);
    assert.equal(f.runtime.view().storage.writeAttempts, beforeCounts.writeAttempts);
    const encoded = JSON.stringify(proof);
    for (const privateValue of [f.directory, os.hostname(), "trusted.test", "foreign-copy-owner"]) {
        assert.equal(encoded.includes(privateValue), false, "Review leaks no " + privateValue);
    }
    unchanged(f);
    assert.equal(fs.existsSync(path.join(f.directory, "ownership-backups")), false);
});

test("ownership: confirmed copy repair preserves policy, pins, frozen access/Vault terms and retires old Journeys", async t => {
    const f = await foreign(t, async original => {
        let v = original.runtime.view(), destination = v.application.destinations[0];
        assert.equal((await original.runtime.command({ kind: "SAVE_DISPLAY_DETAILS", destinationId: destination.id,
            label: "Saved research", category: "Saved category", pinned: true,
            basePolicyRevision: v.snapshot.policyRevision, baseApplicationRevision: v.application.revision })).type, "COMMITTED");
        const granted = original.attach();
        await original.navigate(granted, "https://grant.test/"); await original.command(granted, "START_ACCESS");
        original.advance(10); await original.command(granted, "CONFIRM_ACCESS_AND_OPEN");
        const pending = original.attach();
        await original.navigate(pending, "https://waiting.test/"); await original.command(pending, "START_ACCESS");
        await original.navigate(original.attach(), "https://trusted.test/departure");
        v = original.runtime.view();
        assert.equal((await original.runtime.command({ kind: "PROPOSE_POLICY",
            candidatePolicy: { ...v.snapshot.policy, whitelist: [...v.snapshot.policy.whitelist, "proposed.test"] } })).type, "COMMITTED");
    });
    const controller = f.runtime.controller, proof = await review(f);
    const result = await repair(f, proof);
    assert.equal(result.status, "READY", JSON.stringify(result));
    assert.equal(f.runtime.controller, controller);
    const view = f.runtime.view(), previous = f.saved.snapshot;
    assert.deepEqual(view.snapshot.policy, previous.policy);
    assert.deepEqual(view.snapshot.configuration, previous.configuration);
    assert.equal(view.snapshot.policyRevision, previous.policyRevision);
    assert.equal(view.snapshot.configurationRevision, previous.configurationRevision);
    assert.deepEqual(view.snapshot.accessState.pendingRequests, previous.accessState.pendingRequests);
    assert.deepEqual(view.snapshot.accessState.grants, previous.accessState.grants);
    assert.equal(view.snapshot.accessState.nextRequestId, previous.accessState.nextRequestId);
    assert.deepEqual(view.snapshot.vaultState.pendingProposal, previous.vaultState.pendingProposal);
    assert.deepEqual(view.application, f.saved.application);
    assert.ok(previous.journeyState.journeys.some(j => j.phase !== "ENDED"), "Fixture has old correlation to retire");
    for (const old of previous.journeyState.journeys) {
        const current = view.snapshot.journeyState.journeys.find(j => j.id === old.id);
        assert.equal(current.phase, "ENDED");
        assert.equal(current.startedAt, old.startedAt); assert.equal(current.expiresAt, old.expiresAt);
    }
    assert.equal(f.effects.opened.length, 0); assert.equal(f.effects.releases.length, 0);
    assert.equal(view.recovery.automaticAttempts, 0);
    assert.notEqual(f.repository.read("owner.lock"), f.before["owner.lock"]);
    backedUp(f, proof);
    await f.navigate(f.attach(), "https://blocked.test/");
    assert.equal(f.effects.releases.length, 0, "Blacklist remains effective after ownership repair");
    await f.navigate(f.attach(), "https://trusted.test/");
    assert.equal(f.effects.releases.length, 1, "Fresh valid Whitelist navigation works after acknowledgement");
});

test("ownership: a copied journal for an applied uncertain write reconciles its exact candidate without replay", async t => {
    const f = await foreign(t, async original => {
        original.loseAcknowledgement(true);
        await original.runtime.command({ kind: "PROPOSE_POLICY",
            candidatePolicy: { whitelist: ["trusted.test", "candidate.test"], blacklist: ["blocked.test"] } });
        original.loseAcknowledgement(false);
        assert.equal(original.runtime.view().status, "RECONCILING");
    });
    const diskBefore = JSON.parse(f.before["authority.json"]), proposal = diskBefore.snapshot.vaultState.pendingProposal;
    assert.ok(proposal);
    const proof = await review(f); assert.equal(proof.journalPending, true);
    const result = await repair(f, proof);
    assert.equal(result.status, "READY", JSON.stringify(result));
    assert.equal(f.repository.read("pending.json"), null);
    assert.deepEqual(f.runtime.view().snapshot.vaultState.pendingProposal, proposal);
    assert.equal(f.runtime.view().snapshot.vaultState.nextProposalId, proposal.id + 1);
    assert.equal(f.runtime.view().snapshot.policyRevision, 0);
    assert.equal(f.effects.opened.length, 0);
    backedUp(f, proof);
});

test("ownership: a copied journal whose rename never occurred is reconciled as not written", async t => {
    const f = await foreign(t, async original => {
        original.failWrites(true);
        await original.runtime.command({ kind: "PROPOSE_POLICY",
            candidatePolicy: { whitelist: ["trusted.test", "not-written.test"], blacklist: ["blocked.test"] } });
        original.failWrites(false);
    });
    assert.ok(f.before["pending.json"]);
    const proof = await review(f); assert.equal(proof.journalPending, true);
    assert.equal((await repair(f, proof)).status, "READY");
    assert.equal(f.runtime.view().snapshot.vaultState.pendingProposal, null);
    assert.equal(f.runtime.view().snapshot.vaultState.nextProposalId, f.saved.snapshot.vaultState.nextProposalId);
    assert.deepEqual(f.runtime.view().snapshot.policy, f.saved.snapshot.policy);
    assert.equal(f.repository.read("pending.json"), null);
    backedUp(f, proof);
});

test("ownership: declining the independent-copy confirmation leaves all authority untouched", async t => {
    const f = await foreign(t), proof = await review(f);
    const result = await repair(f, proof, false);
    assert.equal(result.reason, "STORAGE_REPAIR_CONFIRMATION_REQUIRED");
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    unchanged(f);
    assert.equal(fs.existsSync(path.join(f.directory, "ownership-backups")), false);
});

test("ownership: reviewing and then cancelling or leaving the page never performs a repair", async t => {
    const f = await foreign(t);
    await review(f);
    for (let i = 0; i < 4; i++) await f.runtime.observe();
    await f.runtime.command({ kind: "RECOVER" });
    unchanged(f);
    assert.equal(f.runtime.view().repositoryIssue, "FOREIGN_OWNER");
    assert.equal(fs.existsSync(path.join(f.directory, "ownership-backups")), false);
});

test("ownership: stale, superseded and malformed proof identities cannot change ownership", async t => {
    const f = await foreign(t), first = await review(f), second = await review(f);
    assert.notEqual(first.repairId, second.repairId);
    assert.equal((await repair(f, first)).reason, "STORAGE_REPAIR_STALE");
    unchanged(f);
    for (const repairId of ["not-the-reviewed-proof", "../owner.lock"]) {
        const result = await f.runtime.command({ kind: "REPAIR_STORAGE_OWNERSHIP", repairId, localCopyConfirmed: true });
        assert.ok(["STORAGE_REPAIR_STALE", "INVALID_OPERATION"].includes(result.reason), JSON.stringify(result));
        unchanged(f);
    }
});

test("ownership: a repair proof cannot be replayed after ownership has changed", async t => {
    const f = await foreign(t), proof = await review(f);
    assert.equal((await repair(f, proof)).status, "READY");
    const owner = f.repository.read("owner.lock"), state = f.repository.read("authority.json");
    const replay = await repair(f, proof);
    assert.ok(["STORAGE_REPAIR_STALE", "STORAGE_REPAIR_NOT_FOREIGN", "STORAGE_REPAIR_NOT_AVAILABLE"].includes(replay.reason), JSON.stringify(replay));
    assert.equal(f.repository.read("owner.lock"), owner);
    assert.equal(f.repository.read("authority.json"), state);
});

test("ownership: any change to the reviewed owner, authority, sentinel or journal invalidates the proof", async t => {
    for (const changed of names) {
        const f = await foreign(t), proof = await review(f);
        if (changed === "owner.lock") {
            const owner = JSON.parse(f.before[changed]); owner.id = "another-foreign-instance";
            fs.writeFileSync(path.join(f.directory, changed), JSON.stringify(owner));
        } else if (changed === "authority.json") {
            const authority = JSON.parse(f.before[changed]); authority.snapshot.policy.blacklist.push("trusted.test");
            fs.writeFileSync(path.join(f.directory, changed), JSON.stringify(authority));
        } else if (changed === "initialized") fs.writeFileSync(path.join(f.directory, changed), "changed sentinel\n");
        else {
            fs.writeFileSync(path.join(f.directory, changed), JSON.stringify({ commitId: "external-pending",
                beforeHash: digest(f.before["authority.json"]), afterHash: "1".repeat(64), storageVersion: "external-pending-version" }));
        }
        const edited = records(f.directory), result = await repair(f, proof);
        assert.equal(result.reason, "STORAGE_REPAIR_CHANGED", changed + ": " + JSON.stringify(result));
        unchanged(f, edited);
        assert.equal(f.runtime.view().status, "UNAVAILABLE");
    }
});

test("ownership: expired review proof cannot replace the foreign lock", async t => {
    const originalNow = Date.now; let now = 1_800_000_000_000;
    Date.now = () => now;
    try {
        const f = await foreign(t), proof = await review(f);
        now = proof.expiresAt + 1;
        assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_EXPIRED");
        unchanged(f);
    } finally { Date.now = originalNow; }
});

test("ownership: competing reclamation is never removed by review or repair", async t => {
    const f = await foreign(t), proof = await review(f), lock = "another repair is in progress";
    fs.writeFileSync(path.join(f.directory, "reclaim.lock"), lock);
    assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_BUSY");
    assert.equal(read(f.directory, "reclaim.lock"), lock);
    unchanged(f);
    assert.equal((await f.runtime.command(reviewCommand)).reason, "STORAGE_REPAIR_BUSY");
    assert.equal(read(f.directory, "reclaim.lock"), lock);
    unchanged(f);
});

test("ownership: corrupt, incompatible, incomplete and mismatched-journal states never offer a usable repair", async t => {
    const transforms = [
        directory => fs.writeFileSync(path.join(directory, "authority.json"), "{broken"),
        directory => { const value = JSON.parse(read(directory, "authority.json")); value.schemaVersion = 999; fs.writeFileSync(path.join(directory, "authority.json"), JSON.stringify(value)); },
        directory => { const value = JSON.parse(read(directory, "authority.json")); value.snapshot.configuration.accessTiming.waitMs = -1; fs.writeFileSync(path.join(directory, "authority.json"), JSON.stringify(value)); },
        directory => { const value = JSON.parse(read(directory, "authority.json")); value.schemaVersion = 1; delete value.snapshot.configuration; delete value.snapshot.configurationRevision; value.application.destinations[0].label = 42; fs.writeFileSync(path.join(directory, "authority.json"), JSON.stringify(value)); },
        directory => fs.unlinkSync(path.join(directory, "authority.json")),
        directory => fs.unlinkSync(path.join(directory, "initialized")),
        directory => fs.writeFileSync(path.join(directory, "pending.json"), "{broken"),
        directory => fs.writeFileSync(path.join(directory, "pending.json"), JSON.stringify({
            commitId: "unrelated", beforeHash: "1".repeat(64), afterHash: "2".repeat(64), storageVersion: "unrelated-version" }))
    ];
    for (const transform of transforms) {
        const f = await foreign(t, undefined, transform), result = await f.runtime.command(reviewCommand);
        assert.equal(result.reason, "STORAGE_REPAIR_INVALID_STATE", JSON.stringify(result));
        unchanged(f);
        assert.equal(f.runtime.view().status, "UNAVAILABLE");
    }
});

test("ownership: malformed foreign lock changed after diagnosis is preserved instead of adopted", async t => {
    const f = await foreign(t);
    fs.writeFileSync(path.join(f.directory, "owner.lock"), "{broken");
    const edited = records(f.directory), result = await f.runtime.command(reviewCommand);
    assert.equal(result.reason, "STORAGE_REPAIR_INVALID_STATE", JSON.stringify(result));
    unchanged(f, edited);
});

test("ownership: failure to back up the exact source prevents ownership replacement", async t => {
    const f = await foreign(t), proof = await review(f), open = f.io.openSync;
    let attempted = false;
    f.io.openSync = (name, ...args) => {
        if (String(name).includes(path.sep + "ownership-backups" + path.sep)) {
            attempted = true; throw Object.assign(Error("private backup path"), { code: "EACCES" });
        }
        return open(name, ...args);
    };
    try {
        const result = await repair(f, proof);
        assert.equal(result.reason, "STORAGE_REPAIR_FAILED", JSON.stringify(result));
    } finally { f.io.openSync = open; }
    assert.equal(attempted, true);
    unchanged(f);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    assert.equal(f.repository.locked, false);
});

test("ownership: owner rename failure keeps the original lock and its completed forensic backup", async t => {
    const f = await foreign(t), proof = await review(f), rename = f.io.renameSync;
    f.io.renameSync = (from, to) => {
        if (path.basename(String(to)) === "owner.lock") throw Object.assign(Error("busy owner"), { code: "EBUSY" });
        return rename(from, to);
    };
    try { assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_FAILED"); }
    finally { f.io.renameSync = rename; }
    unchanged(f);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    backedUp(f, proof);
});

test("ownership: lost owner-rename acknowledgement cannot report success and ordinary recovery validates the exact own lock", async t => {
    const f = await foreign(t), proof = await review(f), rename = f.io.renameSync;
    let lost = false;
    f.io.renameSync = (from, to) => {
        rename(from, to);
        if (!lost && path.basename(String(to)) === "owner.lock") {
            lost = true; throw Object.assign(Error("lost owner acknowledgement"), { code: "EIO" });
        }
    };
    let result;
    try { result = await repair(f, proof); }
    finally { f.io.renameSync = rename; }
    assert.equal(lost, true);
    assert.equal(result.reason, "STORAGE_REPAIR_FAILED");
    assert.notEqual(f.runtime.view().status, "READY");
    assert.equal(f.repository.read("authority.json"), f.before["authority.json"]);
    backedUp(f, proof);
    await f.runtime.command({ kind: "RECOVER" });
    assert.equal(f.runtime.view().status, "READY");
    assert.deepEqual(f.runtime.view().snapshot.policy, f.saved.snapshot.policy);
    assert.equal(f.effects.opened.length, 0); assert.equal(f.effects.releases.length, 0);
});

test("ownership: healthy local authority cannot enter the foreign-copy repair path", async t => {
    const original = await fixture(t), before = records(original.directory);
    const result = await original.runtime.command(reviewCommand);
    assert.ok(["STORAGE_REPAIR_NOT_FOREIGN", "STORAGE_REPAIR_NOT_AVAILABLE"].includes(result.reason), JSON.stringify(result));
    assert.deepEqual(records(original.directory), before);
    assert.equal(original.runtime.view().status, "READY");
});

test("ownership: an unused copied lock can be repaired without implicitly initializing Atlas", async t => {
    const f = await foreign(t, undefined, directory => {
        fs.unlinkSync(path.join(directory, "authority.json")); fs.unlinkSync(path.join(directory, "initialized"));
    });
    const proof = await review(f);
    assert.equal(proof.authorityPresent, false); assert.equal(proof.journalPending, false);
    assert.equal(proof.destinationCount, 0);
    const result = await repair(f, proof);
    assert.equal(result.status, "UNINITIALIZED", JSON.stringify(result));
    assert.equal(f.repository.read("authority.json"), null);
    assert.equal(f.repository.read("initialized"), null);
    assert.equal(f.repository.read("pending.json"), null);
    assert.equal(f.runtime.view().snapshot, null);
    backedUp(f, proof);
});

test("ownership: the command boundary requires exact repair fields and boolean attestation", async t => {
    const f = await foreign(t), proof = await review(f);
    for (const command of [
        { kind: "REVIEW_STORAGE_OWNERSHIP", extra: true },
        { kind: "REPAIR_STORAGE_OWNERSHIP", repairId: proof.repairId },
        { kind: "REPAIR_STORAGE_OWNERSHIP", repairId: proof.repairId, localCopyConfirmed: "true" },
        { kind: "REPAIR_STORAGE_OWNERSHIP", repairId: proof.repairId, localCopyConfirmed: true, force: true }
    ]) {
        const result = await f.runtime.command(command);
        assert.ok(["INVALID_OPERATION", "STORAGE_REPAIR_CONFIRMATION_REQUIRED"].includes(result.reason), JSON.stringify(result));
        unchanged(f);
    }
});


test("ownership: a source change while forensic backup is written prevents takeover and preserves the new revocation", async t => {
    const f = await foreign(t), proof = await review(f), open = f.io.openSync;
    const changed = JSON.parse(f.before["authority.json"]); changed.snapshot.policy.blacklist.push("trusted.test");
    const external = JSON.stringify(changed); let injected = false;
    f.io.openSync = (name, ...args) => {
        if (!injected && String(name).includes(path.sep + "ownership-backups" + path.sep)) {
            injected = true; fs.writeFileSync(path.join(f.directory, "authority.json"), external);
        }
        return open(name, ...args);
    };
    try { assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_CHANGED"); }
    finally { f.io.openSync = open; }
    assert.equal(injected, true);
    assert.equal(f.repository.read("authority.json"), external);
    assert.equal(f.repository.read("owner.lock"), f.before["owner.lock"]);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    assert.equal(f.effects.releases.length, 0);
});

test("ownership: a competing reclaim appearing during backup is preserved and prevents takeover", async t => {
    const f = await foreign(t), proof = await review(f), open = f.io.openSync;
    const competing = JSON.stringify({ machine: "other-reclaimer", pid: 321, id: "different-repair" }); let injected = false;
    f.io.openSync = (name, ...args) => {
        if (!injected && String(name).includes(path.sep + "ownership-backups" + path.sep)) {
            injected = true; fs.writeFileSync(path.join(f.directory, "reclaim.lock"), competing);
        }
        return open(name, ...args);
    };
    try { assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_CHANGED"); }
    finally { f.io.openSync = open; }
    assert.equal(injected, true); unchanged(f);
    assert.equal(read(f.directory, "reclaim.lock"), competing);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
});

test("ownership: corrupted backup readback prevents ownership replacement", async t => {
    const f = await foreign(t), proof = await review(f), readFile = f.io.readFileSync;
    let corrupted = false;
    f.io.readFileSync = (name, ...args) => {
        if (!corrupted && String(name).includes(path.sep + "ownership-backups" + path.sep) && path.basename(String(name)) === "authority.json") {
            corrupted = true; fs.writeFileSync(name, "corrupt forensic backup");
        }
        return readFile(name, ...args);
    };
    try { assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_INVALID_STATE"); }
    finally { f.io.readFileSync = readFile; }
    assert.equal(corrupted, true); unchanged(f);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
});

test("ownership: interrupted cleanup of this acknowledged takeover stays blocked until explicit same-instance recovery", async t => {
    const f = await foreign(t, async original => {
        const candidateConfiguration = structuredClone(CONFIG); candidateConfiguration.accessTiming.waitMs = 15;
        assert.equal((await original.runtime.command({ kind: "PROPOSE_SETTINGS", candidateConfiguration })).type, "COMMITTED");
    });
    const proof = await review(f), unlink = f.io.unlinkSync;
    let cleanupAttempted = false;
    f.io.unlinkSync = name => {
        if (path.basename(String(name)) === "reclaim.lock") {
            cleanupAttempted = true; throw Object.assign(Error("transient reclaim cleanup"), { code: "EBUSY" });
        }
        return unlink(name);
    };
    try {
        const result = await repair(f, proof);
        assert.equal(result.reason, "STORAGE_REPAIR_FAILED", JSON.stringify(result));
        assert.notEqual(f.runtime.view().status, "READY");
        assert.equal(f.effects.releases.length, 0);
    } finally { f.io.unlinkSync = unlink; }
    assert.equal(cleanupAttempted, true);
    assert.ok(read(f.directory, "reclaim.lock"));
    assert.notEqual(read(f.directory, "owner.lock"), f.before["owner.lock"]);
    assert.equal(read(f.directory, "authority.json"), f.before["authority.json"]);
    backedUp(f, proof);
    await f.runtime.command({ kind: "RECOVER" });
    assert.equal(f.runtime.view().status, "READY");
    assert.equal(read(f.directory, "reclaim.lock"), null);
    assert.deepEqual(f.runtime.view().snapshot.configuration, f.saved.snapshot.configuration);
    assert.deepEqual(f.runtime.view().snapshot.vaultState.pendingProposal, f.saved.snapshot.vaultState.pendingProposal);
    assert.equal(f.effects.opened.length, 0); assert.equal(f.effects.releases.length, 0);
});


test("ownership: malformed UTF-8 inside otherwise valid metadata cannot be normalized into a repaired authority", async t => {
    const f = await foreign(t, undefined, directory => {
        const value = JSON.parse(read(directory, "authority.json")); value.application.destinations[0].label = "UTF8-marker";
        const bytes = Buffer.from(JSON.stringify(value), "utf8"), index = bytes.indexOf(Buffer.from("UTF8-marker"));
        assert.ok(index >= 0); bytes[index] = 0xff;
        // Decoding through the replacement character would still produce valid
        // JSON and a superficially valid destination label. Repair must reject
        // that lossy conversion and leave the actual bytes available for review.
        assert.ok(JSON.parse(bytes.toString("utf8")).application.destinations[0].label.includes("\ufffd"));
        fs.writeFileSync(path.join(directory, "authority.json"), bytes);
    });
    const authority = fs.readFileSync(path.join(f.directory, "authority.json"));
    const owner = fs.readFileSync(path.join(f.directory, "owner.lock"));
    const result = await f.runtime.command(reviewCommand);
    assert.equal(result.reason, "STORAGE_REPAIR_INVALID_STATE", JSON.stringify(result));
    assert.deepEqual(fs.readFileSync(path.join(f.directory, "authority.json")), authority);
    assert.deepEqual(fs.readFileSync(path.join(f.directory, "owner.lock")), owner);
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    assert.equal(fs.existsSync(path.join(f.directory, "ownership-backups")), false);
});

test("ownership: a different claim after ownership acknowledgement remains fenced through ordinary recovery", async t => {
    const f = await foreign(t), proof = await review(f), assertOwner = f.repository.assertOwner;
    const competing = JSON.stringify({ machine: "other-reclaimer", pid: 654, id: "different-after-acquire" });
    let replaced = false;
    f.repository.assertOwner = function () {
        const result = assertOwner.call(this);
        if (this.locked && !replaced) {
            replaced = true; fs.writeFileSync(path.join(f.directory, "reclaim.lock"), competing);
        }
        return result;
    };
    try { assert.equal((await repair(f, proof)).reason, "STORAGE_REPAIR_CHANGED"); }
    finally { f.repository.assertOwner = assertOwner; }
    assert.equal(replaced, true);
    assert.equal(read(f.directory, "reclaim.lock"), competing);
    assert.notEqual(f.runtime.view().status, "READY");
    await f.runtime.command({ kind: "RECOVER" });
    assert.equal(f.runtime.view().status, "UNAVAILABLE");
    assert.equal(read(f.directory, "reclaim.lock"), competing);
    assert.equal(read(f.directory, "authority.json"), f.before["authority.json"]);
    assert.equal(f.effects.opened.length, 0); assert.equal(f.effects.releases.length, 0);
    backedUp(f, proof);
});
