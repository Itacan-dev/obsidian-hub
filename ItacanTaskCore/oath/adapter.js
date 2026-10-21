"use strict";
// Inactive private adapter. Providers remain host-owned; this module performs no writes.
const P = require("./completion-proof");
const FEATURES = ["hierarchy", "physical-owner", "completion", "lifecycle", "stable-id", "oath-committed", "invalidation", "source-independent"];
function createOathAdapter(options) {
 const { reads, evidence } = options; const proofVersion = options.completionProofVersion ?? 1; P.check([1,2].includes(proofVersion)); const scope = P.clone({ commitment: options.commitment, authorityId: options.authorityId, ownerContextPin: options.ownerContextPin, enrollmentOrder: options.enrollmentOrder });
 P.validateTargets(scope.commitment.targets, scope.authorityId, scope.commitment.session, scope.commitment.owner); P.validateOrder(scope.enrollmentOrder, scope);
 P.check(typeof scope.ownerContextPin === "string" && scope.ownerContextPin.length > 0 && reads && evidence && ["read", "readiness", "subscribeReads"].every(k => typeof reads[k] === "function") && ["readCurrentCompletionProof", "subscribeInvalidations"].every(k => typeof evidence[k] === "function")); P.freeze(scope);
 let disposed = false, generation = 0, stops = null, current = null, scheduled = false, controller = null, providerEpoch = null, orderIntact = true;
 const listeners = new Set();
 const emptyRows = () => scope.commitment.targets.map((_, targetIndex) => ({ targetIndex, resolution: { state: "unavailable", reason: "NOT_READ" }, task: null, eligibility: { version: 1, state: "unknown", reason: "NOT_READ", displayCompleted: null }, navigation: null }));
 let snapshot = P.freeze({ version: 1, privacy: "local-private", generation, readiness: { state: "not-ready", reason: "NOT_READ" }, rows: emptyRows(), diagnostics: [] });
 function emit(value) { if (disposed) return; snapshot = P.freeze(P.clone(value)); for (const listener of [...listeners]) { try { listener(); } catch (_) { /* Private observer failure cannot alter evidence. */ } } }
 function unavailable(state, reason, token = generation) { if (disposed || token !== generation) return; emit({ ...snapshot, generation: token, readiness: { state, reason }, rows: snapshot.rows.map(r => ({ ...r, eligibility: { version: 1, state: "unknown", reason, displayCompleted: r.task?.completed ?? null }, navigation: null })), diagnostics: [reason] }); }
 function invalidate(change, proofEvent = false) {
  if (disposed) return;
  if (proofEvent && (!change || change.version !== 1 || change.kind !== "proof-invalidated" || !Number.isSafeInteger(change.providerEpoch))) { orderIntact = false; generation++; unavailable("unavailable", "INVALID_PROOF_INVALIDATION"); return; }
  if (!proofEvent && (change?.backend !== "native" || change.kind !== "snapshot-invalidated" || change.durability !== "ephemeral")) { orderIntact = false; generation++; unavailable("unsupported", "READ_BACKEND_MISMATCH"); return; }
  if (proofEvent && providerEpoch !== null && providerEpoch !== change.providerEpoch) orderIntact = false;
  generation++; controller?.abort(); current = null; unavailable("not-ready", "SNAPSHOT_INVALIDATED");
  if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; if (!disposed) void refresh(); }); }
 }
 function subscribeProviders() {
  if (stops) return true; const acquired = [];
  try { acquired.push(reads.subscribeReads(c => invalidate(c))); acquired.push(evidence.subscribeInvalidations(c => invalidate(c, true))); P.check(acquired.every(s => typeof s === "function")); stops = acquired; return true; }
  catch (_) { for (const stop of acquired) { try { stop?.(); } catch (_) {} } unavailable("unavailable", "SUBSCRIPTION_UNAVAILABLE"); return false; }
 }
 const ready = r => r?.backend === "native" && r.state === "ready" && Array.isArray(r.missing) && r.missing.length === 0 && FEATURES.every(f => r.capabilities?.features?.[f]?.state === "supported");
 async function capture(token, signal) {
  for (let attempt = 0; attempt < 3; attempt++) {
   if (disposed || token !== generation) return snapshot;
   try {
    const before = await reads.readiness(FEATURES);
    if (disposed || token !== generation) return snapshot;
    if (!ready(before)) { orderIntact = false; unavailable(before?.backend !== "native" ? "unsupported" : ["not-ready", "unavailable", "recovering", "unsupported"].includes(before?.state) ? before.state : "unsupported", "TASK_READ_NOT_READY", token); return snapshot; }
    const request = { version: proofVersion, requestGeneration: token, authorityId: scope.authorityId, ownerContextPin: scope.ownerContextPin, targets: P.clone(scope.commitment.targets), enrollmentCut: scope.enrollmentOrder.kind === "closed-synthetic" ? P.clone(scope.enrollmentOrder.cut) : null };
    const [read, proof] = await Promise.all([reads.read({ backend: "native", operation: "committed", workspace: P.clone(scope.commitment.owner), references: scope.commitment.targets.map(t => ({ kind: "native", id: t.authority.taskId })) }), evidence.readCurrentCompletionProof(request, signal)]);
    if (disposed || token !== generation) return snapshot;
    P.validateRead(proof, request);
    if (providerEpoch !== null && providerEpoch !== proof.providerEpoch) orderIntact = false; providerEpoch = proof.providerEpoch;
    if (proof.readiness.state !== "ready" || proof.recovery !== "intact") { orderIntact = false; unavailable(proof.recovery !== "intact" ? "recovering" : proof.readiness.state, "PROOF_NOT_READY", token); return snapshot; }
    if (proof.freshness !== "current-snapshot") continue;
    if (read?.backend !== "native" || read.operation !== "committed" || read.status !== "ok") { unavailable(read?.status === "unsupported" || read?.backend !== "native" ? "unsupported" : "unavailable", "COMMITTED_READ_UNAVAILABLE", token); return snapshot; }
    P.check(P.same(read.workspace, scope.commitment.owner) && Array.isArray(read.rows) && read.rows.length === scope.commitment.targets.length);
    let mismatch = false;
    const rows = scope.commitment.targets.map((target, targetIndex) => {
     const display = read.rows[targetIndex], p = proof.rows.find(r => r.targetIndex === targetIndex);
     P.check(P.same(display.reference, { kind: "native", id: target.authority.taskId }));
     const task = display.task === null ? null : P.taskView(display.task);
     if (!P.same(task === null ? null : P.taskState(task, target.authority.partitionId), p.task)) mismatch = true;
     if (task && (!P.same(task.owner, target.owner) || task.id !== target.authority.taskId)) mismatch = true;
     const partition = proof.partitions.filter(x => x.id === target.authority.partitionId);
     if (task && (partition.length !== 1 || !Number.isSafeInteger(partition[0].revision) || typeof partition[0].head !== "string")) mismatch = true;
     const resolved = p.resolution.state === "resolved-native" && display.state === "resolved";
     if (p.resolution.state === "resolved-native" && display.state !== "resolved") mismatch = true;
     return { targetIndex, resolution: P.clone(p.resolution), task, eligibility: P.assessQualifiedCompletion(target, p, proof, scope.enrollmentOrder, orderIntact), navigation: resolved ? P.navigation(p.navigation, target) : null };
    });
    if (mismatch) continue;
    const after = await reads.readiness(FEATURES);
    if (disposed || token !== generation) return snapshot;
    if (!ready(after) || !P.same(before, after)) { orderIntact = false; continue; }
    emit({ version: 1, privacy: "local-private", generation: token, readiness: { state: "ready", reason: "COHERENT_PRIVATE_SNAPSHOT" }, rows, diagnostics: [] }); return snapshot;
   } catch (_) { if (!disposed && token === generation) { orderIntact = false; unavailable("unavailable", "PRIVATE_EVIDENCE_UNAVAILABLE", token); } return snapshot; }
  }
  unavailable("recovering", "SNAPSHOT_UNSTABLE", token); return snapshot;
 }
 function refresh() {
  if (disposed) { const error = Error("Oath adapter disposed."); error.code = "ADAPTER_DISPOSED"; return Promise.reject(error); }
  if (current) return current;
  if (!subscribeProviders()) return Promise.resolve(snapshot);
  const token = ++generation; controller?.abort(); controller = new AbortController();
  const signal = controller.signal, work = Promise.resolve().then(() => capture(token, signal)); current = work;
  unavailable("not-ready", "REFRESHING", token);
  void work.finally(() => { if (current === work) current = null; }); return work;
 }
 return {
  getSnapshot: () => snapshot,
  refresh,
  subscribe(listener) { P.check(typeof listener === "function" && !disposed); listeners.add(listener); return () => listeners.delete(listener); },
  dispose() { if (disposed) return; disposed = true; generation++; controller?.abort(); for (const stop of stops ?? []) { try { stop(); } catch (_) {} } stops = null; listeners.clear(); current = null; snapshot = P.freeze({ version: 1, privacy: "local-private", generation, readiness: { state: "unavailable", reason: "DISPOSED" }, rows: [], diagnostics: ["DISPOSED"] }); }
 };
}
module.exports = { createOathAdapter };
