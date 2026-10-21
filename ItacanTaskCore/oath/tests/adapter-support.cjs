"use strict";
const assert = require("node:assert/strict"), H = require("./legacy-harness.cjs"), { createProvider } = require("./completion-proof-provider.cjs"), { createOathAdapter } = require("../adapter"), I = require("../../tests/history-import-support.cjs");
const pure = require(H.root + "/" + H.lib + "/domain/oath.js");
const gate = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
async function settle(adapter) { for (let i = 0; i < 3; i++) { await Promise.resolve(); await adapter.refresh(); } return adapter.getSnapshot(); }
function head(repo) { const i = repo.info(); return { authorityId: i.storeId, repositoryRevision: i.revision, revisionId: i.revisionId }; }
async function acknowledgeAndCut(v, acknowledge) {
 const saved = await acknowledge(); assert(saved && typeof saved === "object", "Save acknowledgement must supply the exact saved synthetic snapshot");
 const state = await I.stateOf(v.f), targets = v.targets ?? [v.target];
 assert(targets.every(t => { const task = state.tasks.find(x => x.id === t.authority.taskId); return task && !task.completed && task.archivedAt === null && task.deletedAt === null && require("../completion-proof").same(task.owner, t.owner); }));
 return { version: 1, kind: "closed-synthetic", session: H.clone(targets[0].session), targets: H.clone(targets), save: { acknowledgement: "observed", snapshotDigest: H.sha(Buffer.from(JSON.stringify(saved))) }, cut: head(v.f.repo), openTasks: targets.map(t => { const task = state.tasks.find(x => x.id === t.authority.taskId); return { taskId: task.id, taskRevision: task.revision }; }) };
}
async function bind(t, v, { order, capture, ownerContextPin = "closed-owner-context-v1" } = {}) {
 capture ??= async () => { const e = H.baseEvidence(); e.native = { state: await I.stateOf(v.f), readiness: "ready", recovery: { state: "intact", taskIds: [], stepIds: [] } }; e.registry = e.native.state.partitions.map((p, i) => ({ owner: H.clone(p.owner), partitionId: p.id, root: H.registry.find(r => require("../completion-proof").same(r.owner, p.owner))?.root ?? ["Projects/Itacan", "Projects/Obsidian Hub", "Projects/Private", "Resources/Knowledge"][i] ?? "Synthetic/Owner" + i, shared: p.kind === "git-project", status: "active", available: true, shareApproval: null })); e.identity = v.identity ?? null; return e; };
 const provider = createProvider({ capture, repo: v.f.repo, ownerContextPin }); t?.after(() => provider.close());
 const options = { commitment: { session: H.clone(v.target.session), owner: H.clone(v.target.owner), targets: H.clone(v.targets ?? [v.target]) }, authorityId: v.target.authority.authorityId, ownerContextPin, reads: provider.reads, evidence: provider.evidence, enrollmentOrder: order ?? { version: 1, kind: "unproven", reason: "PREPARATION_ONLY" } };
 const adapter = createOathAdapter(options); t?.after(() => adapter.dispose()); return { v, provider, options, adapter, order: options.enrollmentOrder };
}
async function fixture(t, extra = {}) { const v = await H.nativeFixture(t, extra.owner ?? "private", extra.task ?? {}); const order = extra.unproven ? undefined : await acknowledgeAndCut(v, async () => ({ syntheticOnly: true, session: v.target.session, references: [v.target.original] })); return bind(t, v, { order }); }
async function actualHost(t, v, mode = "standard", state = "active", setup = null) {
 const h = H.legacy(), f = h.fixture(); t.after(() => f.close()); h.commit(f, ["parent"], { type: "project", id: "private" }, state);
 const current = f.wizard.data.oathsByDevice[f.oath.deviceId].current;
 if (mode === "strict") { current.policy = { mode: "strict" }; current.strictSessionId = "fixture-host"; f.oath.strict = { owns: () => true, health: { status: "active" }, release: async () => {}, configureEnabled() {}, detach() {} }; }
 const setupResult = await setup?.(f);
 const identity = await H.S.fixture("memory", t, { idFactory: () => v.task.id }); await H.S.published(identity.repo, H.S.snapshot([{ entryId: "parent", legacyId: current.tasks[0].id }])); v.identity = { snapshot: identity.repo.snapshot(), planId: "plan-1" };
 v.target = H.aliasTarget(v, v.identity, current.tasks[0].id); v.target.original.reference = H.clone(current.tasks[0]); v.target.session = { deviceId: f.oath.deviceId, oathId: current.id };
 const order = await acknowledgeAndCut(v, async () => { await f.oath.persist(current); return setupResult?.saved ? await setupResult.saved() : f.saved; }); const b = await bind(t, v, { order });
 let snapshot;
 const work = qualified => snapshot.rows.map(r => ({ ref: H.clone(current.tasks[r.targetIndex]), task: r.task ? { ...H.clone(r.task), completed: qualified ? r.eligibility.state === "eligible" : r.task.completed } : null }));
 f.oath.resolveWork = async () => { snapshot = await b.adapter.refresh(); f.oath.work = work(false); return true; };
 const originalCapture = f.oath.captureFulfilment;
 f.oath.captureFulfilment = function () { const display = this.work; try { if (snapshot) this.work = work(true); return originalCapture.call(this); } finally { this.work = display; } };
 return { ...b, f, async refresh() { await f.oath.resolveWork(); return snapshot; }, progress: () => pure.oathProgress(f.oath.work), pure };
}
module.exports = { H, I, pure, assert, gate, settle, head, acknowledgeAndCut, bind, fixture, actualHost };
