"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict");
const legacy = require("../history/tests/legacy-harness.cjs"), I = require("../src/history-import"), base = require("./support.cjs");
const partitions = legacy.support.registry.map(r => ({ id: r.key, kind: r.owner.type === "resource" ? "resource" : r.shared ? "git-project" : "private-project", owner: r.owner }));
const owners = partitions.map(p => ({ owner: p.owner, label: "Recorded " + p.id, status: "active", evidence: "reviewed-closed-synthetic" }));
function bundle(capture, overrides = {}) {
    const proposal = legacy.H.proposeImportBundle(capture, legacy.review(capture)), a = proposal.analysis;
    const drafts = a.trees.filter(t => t.disposition === "eligible-evidence-only").map(tree => ({ entryId: tree.taskEntryId, title: "Reviewed parent", description: "Explicit description", continuation: "Retained continuation\n", steps: a.targets.filter(t => t.taskEntryId === tree.taskEntryId && t.kind === "step").map(t => ({ entryId: t.entryId, title: "Reviewed Step", body: "Lossless body 日本語\n" })) }));
    return I.stamp({ format: "itacan-reviewed-history-import-bundle", version: 1, proposal, drafts, partitionMappings: partitions.map(p => ({ owner: p.owner, partitionId: p.id })), ownerSnapshots: structuredClone(owners), nativeHistoryWitnesses: [], ...overrides, digest: null });
}
async function fixture(kind, t, capture, extra = {}) {
    capture ??= await legacy.mappingCapture();
    const inventory = extra.inventory ?? { version: 1, revision: "closed-inventory-1", ids: capture.identity?.snapshot.reservations.map(r => r.id) ?? [] };
    const current = { version: 1, exclusive: true, capture: structuredClone(capture), externalInventory: structuredClone(inventory), ownerSnapshots: structuredClone(owners) };
    const f = await base.fixture(kind, t, { partitions, clock: () => legacy.NOW + 1000, externalReservations: inventory, resolvers: { location: r => { const p = partitions.find(p => "folder-" + p.id === r.id); return p ? { ...r, owner: p.owner } : null; } }, historyImportEvidence: { version: 1, mode: "closed-synthetic", read: () => current }, ...(kind === "json" ? { storageFormat: "private-v4", storeId: extra.storeId ?? (extra.idFactory ?? base.randomUUID)() } : {}), ...extra });
    if (kind === "json") f.options.expectedAuthorityId = f.repo.info().storeId;
    return { f, capture, current, inventory, bundle: bundle(capture), planId: legacy.support.id(9000), prepareId: "prepare-history", publishId: "publish-history" };
}
function guards(v, ids) { return v.f.repo.info().partitions.filter(p => !ids || ids.includes(p.id)).map(p => ({ owner: p.owner, partitionId: p.id, expectedRevision: p.revision })); }
function prepare(v, patch = {}) {
    const a = v.bundle.proposal.analysis, ids = [...new Set([...a.targets.filter(t => t.nativeId).map(t => partitions.find(p => I.hash(p.owner) === I.hash(t.owner))?.id), ...a.groups.map(g => partitions.find(p => I.hash(p.owner) === I.hash(g.owner))?.id)].filter(Boolean))];
    return { type: "history.prepareImport", operationId: v.prepareId, expectedRepositoryRevision: v.f.repo.info().revision, payload: { version: 1, decisionRevision: I.DECISION, planId: v.planId, publicationOperationId: v.publishId, bundle: v.bundle, bundleDigest: v.bundle.digest, pins: I.pinsFor(v.capture, v.inventory), partitions: guards(v, ids), syntheticOnly: true, reason: "Reviewed disposable capture", ...patch } };
}
function publish(v, patch = {}) { const plan = v.f.repo.getHistoryImportPlan(v.planId, { version: 1 }).plan; return { type: "history.importBundle", operationId: v.publishId, expectedRepositoryRevision: v.f.repo.info().revision, payload: { version: 1, decisionRevision: I.DECISION, planId: plan.id, expectedPlanRevision: 1, preparedPlanDigest: plan.digest, bundleDigest: plan.bundleDigest, pins: plan.pins, partitions: guards(v, plan.partitionIds), syntheticOnly: true, reason: "Publish exact prepared evidence", ...patch } }; }
async function prepared(kind, t, capture, extra) { const v = await fixture(kind, t, capture, extra); v.prepareCommand = prepare(v); v.prepared = await v.f.repo.execute(v.prepareCommand); return v; }
async function imported(kind, t, capture, extra) { const v = await prepared(kind, t, capture, extra); v.publishCommand = publish(v); v.result = await v.f.repo.execute(v.publishCommand); return v; }
async function stateOf(f) {
    if (!f.directory) return structuredClone(f.storage.state);
    const J = require("../src/json-repository"), C = require("../src/private-storage-codec"); let ref;
    for (const name of ["CURRENT.json", "RECOVERY.json"]) { try { const m = J.decodeManifest(await fs.readFile(path.join(f.directory, name), "utf8")); ref = [m.current, ...m.ancestry].find(r => r.revisionId === f.repo.info().revisionId); if (ref) break; } catch (_) {} }
    assert(ref, "Opened generation must remain in verified pointer ancestry");
    const raw = await fs.readFile(path.join(f.directory, ref.file), "utf8"); return f.options.storageFormat === "private-v4" ? C.decodePrivateGeneration(raw, f.repo.info().storeId).state : JSON.parse(raw);
}
async function rejectAtomic(v, command, code) { const before = await stateOf(v.f); await assert.rejects(() => v.f.repo.execute(command), e => !code || e.code === code); assert.deepEqual(await stateOf(v.f), before); }
module.exports = { ...legacy, I, base, partitions, owners, bundle, fixture, prepare, publish, prepared, imported, stateOf, rejectAtomic, mutate: base.mutate, fs, path };
