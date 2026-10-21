"use strict";
// Test-only composition of actual helpers. Never constructs plugin startup or a physical host.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../.."), lib = ".obsidian/plugins/hub-project-menu/lib", O = require("../index");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex"), clone = structuredClone;
const graph = require("./oath-source-graph-v1.json");
const S = require("../../identity/tests/support.cjs");
const registry = S.registry.map(({ key, owner, root, shared }) => ({ owner, root, shared, status: "active", available: true, partitionId: key, shareApproval: shared ? { version: 1, projectId: owner.id, root, reviewDigest: "a".repeat(64) } : null }));
function frozenRoot(t) {
    const temp = fs.realpathSync(os.tmpdir()), directory = fs.mkdtempSync(path.join(temp, "itacan-oath-frozen-"));
    for (const f of graph.files) {
        const bytes = Buffer.from(f.base64, "base64"), destination = path.resolve(directory, f.path);
        assert(destination.startsWith(directory + path.sep)); assert.equal(bytes.length, f.byteLength); assert.equal(sha(bytes), f.sha256);
        fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
    }
    t.after(() => { assert.equal(path.dirname(fs.realpathSync(directory)), temp); assert(path.basename(directory).startsWith("itacan-oath-frozen-")); fs.rmSync(directory, { recursive: true }); });
    return directory;
}
function legacy(base = root) { return require(path.join(base, lib, "tests/oath-committed-fixture.cjs")); }
function projected(f) {
    return { references: clone(f.oath.current.tasks), work: legacy().projection(f.oath.work), pending: [...f.oath.awaitingIndex.keys()], diagnostics: (f.oath.readDiagnostics ?? []).map(d => d.code), state: f.oath.current.state, fulfilledAt: f.oath.current.fulfilledAt };
}
async function observe(name, base = root) {
    const h = legacy(base), f = h.fixture();
    try {
        if (name.startsWith("bridge-")) {
            const b = await h.bridge(f, { preexisting: name === "bridge-existing" });
            await f.oath.resolveWork(); const pending = projected(f); b.import(); await f.oath.resolveWork();
            return { pending, indexed: projected(f) };
        }
        h.commit(f); h.scenarios[name](f); await f.oath.resolveWork(); return projected(f);
    } finally { await f.close(); }
}
function baseEvidence() { return { format: "itacan-oath-evidence", version: 1, decisionRevision: O.DECISION, privacy: "local-private", scope: "closed-synthetic", registry: clone(registry), native: null, identity: null, legacy: null }; }
function legacyTarget(f) { return { version: 1, session: { deviceId: f.oath.deviceId, oathId: f.oath.current.id }, original: { kind: "legacy-task", reference: clone(f.oath.current.tasks[0]) }, owner: { type: "project", id: "private" }, authority: { kind: "legacy-markdown", sourceAuthority: "synthetic-markdown" } }; }
async function legacyEvidence(f) { const e = baseEvidence(); e.legacy = { sourceAuthority: "synthetic-markdown", readiness: "ready", read: await f.service.resolveOathWork(legacy().request(f)) }; return e; }
function evidenceOf(f, identity = null) { const e = baseEvidence(); e.native = { state: clone(f.storage.state), readiness: "ready", recovery: { state: "intact", taskIds: [], stepIds: [] } }; e.identity = identity; return e; }
function nativeTarget(repo, task) { const info = repo.info(); return { version: 1, session: { deviceId: "synthetic-device", oathId: "synthetic-oath" }, original: { kind: "native-task", taskId: task.id, text: task.title }, owner: clone(task.owner), authority: { kind: "native", authorityId: info.storeId, partitionId: task.partitionId, taskId: task.id, enrollment: { repositoryRevision: info.revision, revisionId: info.revisionId, taskRevision: task.revision }, aliasPin: null } }; }
async function nativeFixture(t, owner = "private", extra = {}) {
    const base = require("../../tests/support.cjs"); let seq = 70000;
    const f = await base.fixture("memory", t, { partitions: registry.map(r => ({ id: r.partitionId, owner: r.owner, kind: r.owner.type === "resource" ? "resource" : r.shared ? "git-project" : "private-project" })), idFactory: () => S.id(++seq), clock: () => 1792224000000 });
    const r = registry.find(r => r.partitionId === owner);
    const created = await f.repo.execute({ type: "task.create", operationId: "create", payload: { task: { id: S.id(50000), owner: r.owner, title: "Same title", steps: [], ...extra } } });
    return { f, task: created.task, target: nativeTarget(f.repo, created.task), evidence: () => evidenceOf(f), mutate: (type, payload, operationId = type) => f.repo.execute(base.mutate(f.repo.getTask(created.task.id), type, payload, operationId)) };
}
function aliasTarget(v, identity, legacyId) {
    const t = clone(v.target), s = identity.snapshot, p = s.plans.find(p => p.id === identity.planId);
    t.original = { kind: "legacy-task", reference: { id: legacyId, path: "Projects/Private/Old.md", text: "Original snapshot" } };
    t.authority.aliasPin = { legacyId, storeId: s.storeId, ledgerRevision: s.revision, planId: p.id, planDigest: p.digest, snapshotDigest: p.snapshotDigest }; return t;
}
module.exports = { root, lib, O, S, registry, sha, clone, graph, frozenRoot, legacy, observe, baseEvidence, legacyTarget, legacyEvidence, evidenceOf, nativeTarget, nativeFixture, aliasTarget };
