"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const H = require("./legacy-harness.cjs"), { O, S, clone } = H;
const vectors = require("./decision-vectors-v1.json");
test("every versioned observation/policy row is accounted for without recapture", () => {
    assert.equal(H.sha(fs.readFileSync(path.join(__dirname, "oath-source-graph-v1.json"))), vectors.sourceGraphSha256);
    assert.equal(vectors.legacyObservations.length, Object.keys(H.legacy().scenarios).length + 2); assert.equal(vectors.policyVectors.length, 12);
    const ids = [...vectors.legacyObservations, ...vectors.policyVectors].map(v => v.id); assert.equal(new Set(ids).size, ids.length);
});
for (const vector of vectors.policyVectors) test("reviewed policy vector: " + vector.id, async t => {
    const v = await H.nativeFixture(t), e = v.evidence(), change = vector.input.change;
    if (["not-ready", "unavailable", "recovering", "unsupported"].includes(change)) e.native.readiness = change;
    if (change === "wrong-authority") v.target.authority.authorityId = S.id(999);
    if (change === "wrong-anchor") v.target.authority.enrollment.revisionId = S.id(999);
    if (change === "missing") v.target.authority.taskId = v.target.original.taskId = S.id(999);
    if (change === "unknown-recovery") e.native.recovery.state = "unknown";
    if (change.startsWith("fenced-")) e.native.recovery = { state: "fenced", taskIds: [change === "fenced-target" ? v.task.id : S.id(999)], stepIds: [] };
    if (change === "owner-unavailable") e.registry[0].available = false;
    assert.equal(O.resolveCommitmentTarget(v.target, e).state, vector.expected.state);
});
test("frozen graph retains exact source bytes and every original hash", () => {
    assert.equal(H.graph.version, 1); assert(H.graph.files.length >= 35);
    for (const f of H.graph.files) { assert.equal(H.sha(Buffer.from(f.base64, "base64")), f.sha256); assert.equal(H.sha(fs.readFileSync(path.join(H.root, f.path))), f.sha256, f.path); }
});
for (const name of Object.keys(H.legacy().scenarios)) test("actual current and actual frozen Oath resolution: " + name, async t => {
    const frozen = H.frozenRoot(t), vectors = require("./decision-vectors-v1.json");
    const observed = await H.observe(name), original = await H.observe(name, frozen);
    assert.deepEqual(observed, original); assert.deepEqual(observed, vectors.legacyObservations.find(v => v.name === name).observed);
});
for (const name of ["bridge-new", "bridge-existing"]) test("both enrollment-established bridges: " + name, async t => {
    const frozen = H.frozenRoot(t), a = await H.observe(name), b = await H.observe(name, frozen);
    assert.deepEqual(a, b); assert.equal(a.pending.pending.length, 1); assert.equal(a.indexed.pending.length, 0);
    assert.deepEqual(a, require("./decision-vectors-v1.json").legacyObservations.find(v => v.name === name).observed);
});
for (const preexisting of [false, true]) test("resolver retains actual index bridge disposition: " + preexisting, async () => {
    const h = H.legacy(), f = h.fixture(); try { const b = await h.bridge(f, { preexisting }); const t = H.legacyTarget(f);
        assert.equal(O.resolveCommitmentTarget(t, await H.legacyEvidence(f)).state, "awaiting-index"); b.import(); assert.equal(O.resolveCommitmentTarget(t, await H.legacyEvidence(f)).state, "resolved-legacy");
    } finally { await f.close(); }
});
for (const id of [null, "", "bad id", "a_b", "<!-- hub-task:x -->"]) test("legacy missing/invalid ID never uses title/path: " + id, async () => {
    const h = H.legacy(), f = h.fixture(); try { h.commit(f); const t = H.legacyTarget(f), e = await H.legacyEvidence(f); t.original.reference.id = id; assert.throws(() => O.resolveCommitmentTarget(t, e)); } finally { await f.close(); }
});
test("restart does not reconstruct either index bridge", async () => {
    for (const preexisting of [false, true]) { const h = H.legacy(), f = h.fixture(); try {
        await h.bridge(f, { preexisting }); await f.oath.resolveWork(); assert(f.oath.work[0].task);
        const Constructor = f.oath.constructor; f.oath.destroy(); f.oath = new Constructor(f.plugin, { restore() {}, enter: async () => true, exit: async () => {}, destroy() {} }, { now: () => f.now, notice() {} });
        assert.equal(f.oath.awaitingIndex.size, 0); await f.oath.resolveWork(); assert.equal(f.oath.work[0].task, null);
    } finally { await f.close(); } }
});
for (const name of ["unique", "title", "line", "rename", "move", "between-notes", "cross-owner", "copy-step", "same-title", "delete-task", "complete"]) test("private legacy resolver consumes actual source proof: " + name, async () => {
    const h = H.legacy(), f = h.fixture(); try {
        h.commit(f); const target = H.legacyTarget(f); h.scenarios[name](f); const e = await H.legacyEvidence(f), before = clone(e);
        const r = O.resolveCommitmentTarget(target, e); assert.deepEqual(e, before); assert.deepEqual(r.target, target);
        if (["unique", "title", "line", "rename", "move", "between-notes", "complete"].includes(name)) assert.equal(r.state, "resolved-legacy"); else assert.notEqual(r.state, "resolved-legacy");
        assert.equal(O.assessCompletionEligibility(target, e).state, r.task ? "unsupported" : "unknown");
    } finally { await f.close(); }
});
for (const owner of H.registry) test("exact native identity and source-independent navigation: " + owner.partitionId, async t => {
    const v = await H.nativeFixture(t, owner.partitionId), e = v.evidence(), before = clone(e);
    const r = O.resolveCommitmentTarget(v.target, e); assert.equal(r.state, "resolved-native"); assert.deepEqual(r.navigation, { kind: "native-task", id: v.task.id }); assert(!JSON.stringify(r.navigation).includes("path"));
    r.task.title = "Detached"; assert.deepEqual(e, before);
});
for (const readiness of ["not-ready", "unavailable", "recovering", "unsupported"]) test("native readiness cannot fall back: " + readiness, async t => {
    const v = await H.nativeFixture(t), e = v.evidence(); e.native.readiness = readiness;
    assert.equal(O.resolveCommitmentTarget(v.target, e).state, "unavailable"); assert.equal(O.assessCompletionEligibility(v.target, e).state, "unknown");
});
for (const [name, change, expected] of [
    ["wrong authority", (v, e) => { v.target.authority.authorityId = S.id(999); }, "authority-mismatch"],
    ["stale anchor", v => { v.target.authority.enrollment.revisionId = S.id(999); }, "unavailable"],
    ["wrong task revision", v => { v.target.authority.enrollment.taskRevision++; }, "unavailable"],
    ["missing target", v => { v.target.authority.taskId = v.target.original.taskId = S.id(999); }, "missing"],
    ["unknown scope", (v, e) => { e.native.recovery.state = "unknown"; }, "unavailable"],
    ["affected fence", (v, e) => { e.native.recovery = { state: "fenced", taskIds: [v.task.id], stepIds: [] }; }, "unavailable"],
    ["unrelated scope", (v, e) => { e.native.recovery = { state: "fenced", taskIds: [S.id(999)], stepIds: [] }; }, "resolved-native"],
    ["missing registry", (v, e) => { e.registry[0].available = false; }, "unavailable"]
]) test(name, async t => { const v = await H.nativeFixture(t), e = v.evidence(); change(v, e); assert.equal(O.resolveCommitmentTarget(v.target, e).state, expected); });
for (const legacyId of ["old-parent", "MIXED-Case", "mixed-case", S.id(50000)]) test("actual published N1-B alias plus actual native publication: " + legacyId, async t => {
    const i = await S.fixture("memory", t, { idFactory: () => S.id(50000) }), snapshot = S.snapshot([{ entryId: "parent", legacyId }]);
    await S.published(i.repo, snapshot); const identity = { snapshot: i.repo.snapshot(), planId: "plan-1" };
    const v = await H.nativeFixture(t), target = H.aliasTarget(v, identity, legacyId), e = v.evidence(); e.identity = identity;
    assert.equal(O.resolveCommitmentTarget(target, e).state, "resolved-native");
    const direct = clone(v.target); e.candidates = [target, direct]; const a = O.analyzeOathEvidence(e); assert.equal(a.candidateGroups.length, 1); assert.deepEqual(a.candidateGroups[0].indexes, [0, 1]);
    for (const key of ["ledgerRevision", "planDigest", "snapshotDigest", "storeId"]) { const bad = clone(target); bad.authority.aliasPin[key] = key === "ledgerRevision" ? 0 : key === "storeId" ? S.id(999) : "0".repeat(64); assert.equal(O.resolveCommitmentTarget(bad, e).state, "quarantined"); }
    if (legacyId !== legacyId.toUpperCase()) { const changed = clone(target); changed.original.reference.id = changed.authority.aliasPin.legacyId = legacyId.toUpperCase(); assert.notEqual(O.resolveCommitmentTarget(changed, e).state, "resolved-native"); }
});
test("published aliases are identity-only until task publication; no legacy fallback", async t => {
    const i = await S.fixture("memory", t), snapshot = S.snapshot(); await S.published(i.repo, snapshot);
    const identity = { snapshot: i.repo.snapshot(), planId: "plan-1" }, alias = identity.snapshot.aliases[0];
    const v = await H.nativeFixture(t), target = H.aliasTarget(v, identity, "old-parent"), e = v.evidence(); e.identity = identity;
    target.authority.taskId = alias.nativeId; assert.equal(O.resolveCommitmentTarget(target, e).state, "pending-native-publication");
});
for (const kind of ["task", "step", "resource"]) test("global copied aliases retain no winner: " + kind, async t => {
    const items = [{ entryId: "parent", legacyId: "COPY" }, kind === "step" ? { entryId: "copy", kind: "step", parent: "parent", legacyId: "COPY" } : { entryId: "copy", legacyId: "COPY", ownerKey: kind === "resource" ? "knowledge" : "private" }];
    const i = await S.fixture("memory", t); await S.published(i.repo, S.snapshot(items)); const identity = { snapshot: i.repo.snapshot(), planId: "plan-1" }, v = await H.nativeFixture(t), e = v.evidence(); e.identity = identity;
    assert.equal(O.resolveCommitmentTarget(H.aliasTarget(v, identity, "COPY"), e).state, "ambiguous");
});
test("Step alias never becomes a parent commitment", async t => {
    const i = await S.fixture("memory", t); await S.published(i.repo, S.snapshot([{ entryId: "p", legacyId: "p" }, { entryId: "s", legacyId: "s", kind: "step", parent: "p" }]));
    const identity = { snapshot: i.repo.snapshot(), planId: "plan-1" }, v = await H.nativeFixture(t), e = v.evidence(); e.identity = identity;
    assert.equal(O.resolveCommitmentTarget(H.aliasTarget(v, identity, "s"), e).reason, "ALIAS_KIND_MISMATCH");
});
test("mixed authoritative streams cannot offer two independently selectable commitments", async t => {
    const h = H.legacy(), f = h.fixture(), v = await H.nativeFixture(t); try { h.commit(f); const e = v.evidence(); e.legacy = (await H.legacyEvidence(f)).legacy; e.candidates = [v.target, H.legacyTarget(f)];
        const a = O.analyzeOathEvidence(e); assert.equal(a.candidateGroups.length, 2); assert(a.candidateGroups.every(g => !g.selectable && g.reason === "MIXED_AUTHORITIES_BLOCK_ENROLLMENT"));
    } finally { await f.close(); }
});
test("prepared N1-B definitions are pending, never usable aliases", async t => {
    const i = await S.fixture("memory", t); await S.prepared(i.repo); const identity = { snapshot: i.repo.snapshot(), planId: "plan-1" }, v = await H.nativeFixture(t), e = v.evidence(); e.identity = identity;
    assert.equal(O.resolveCommitmentTarget(H.aliasTarget(v, identity, "old-parent"), e).state, "pending-native-publication");
});
for (const kind of ["same-tree", "unknown-step", "empty"]) test("recovery scope protects descendant identities and fails closed: " + kind, async t => {
    const stepId = S.id(51000), v = await H.nativeFixture(t, "private", { steps: [{ id: stepId, title: "Step", order: 0 }] }), e = v.evidence();
    e.native.recovery = { state: "fenced", taskIds: [], stepIds: kind === "empty" ? [] : [kind === "same-tree" ? stepId : S.id(999)] };
    assert.equal(O.resolveCommitmentTarget(v.target, e).reason, "RECOVERY_FENCED");
});
for (const [name, mutate] of [
    ["version", (t, e) => { e.version = 2; }], ["decision", (t, e) => { e.decisionRevision = "future"; }], ["privacy", (t, e) => { e.privacy = "public"; }],
    ["scope", (t, e) => { e.scope = "live"; }], ["missing ID", t => { delete t.original.taskId; }], ["invalid UUID", t => { t.original.taskId = t.authority.taskId = "old-parent"; }],
    ["unknown fields", t => { t.titleFallback = "Same title"; }], ["Step enrollment", t => { t.original.kind = "native-step"; }], ["missing anchor", t => { delete t.authority.enrollment; }]
]) test("strict evidence contract rejects " + name, async tt => { const v = await H.nativeFixture(tt), t = clone(v.target), e = v.evidence(); mutate(t, e); assert.throws(() => O.resolveCommitmentTarget(t, e)); });
