"use strict";
// TEST ONLY: extracts scoped facts from actual validated logical captures, never public History inference.
const H = require("./legacy-harness.cjs"), P = require("../completion-proof"), V = require("../../src/value"), { validateState } = require("../../src/domain");
const N = require(H.root + "/" + H.lib + "/tests/native-read-fixture.cjs");
const { TaskService } = require(H.root + "/" + H.lib + "/services/task-service.js");
const { READ_FEATURES, READ_OPERATIONS } = require(H.root + "/" + H.lib + "/services/task-read-contract.js");
function createProvider({ capture, repo, ownerContextPin = "closed-owner-context-v1" }) {
 const readListeners = new Set(), proofListeners = new Set();
 const settings = { state: "ready", epoch: 0, recovery: null, beforeRead: null, afterRead: null, beforeProof: null, afterProof: null, freshness: "current-snapshot" };
 const counts = { reads: 0, proofs: 0, f1Resolutions: 0, f1Assessments: 0, readStops: 0, proofStops: 0 };
 const basis = new N.SyntheticNativeAdapter();
 const caps = basis.readiness().capabilities;
 const adapter = {
  capabilities: () => basis.capabilities(),
  readiness: () => ({ ...basis.readiness(), state: settings.state, reason: "CLOSED_SYNTHETIC_PROVIDER" }),
  subscribe: callback => { readListeners.add(callback); return () => readListeners.delete(callback); },
  subscribeReads(callback) { readListeners.add(callback); return () => { counts.readStops++; readListeners.delete(callback); }; },
  async read(request) {
   counts.reads++; await settings.beforeRead?.(request); const e = await capture(); validateState(e.native.state);
   const rows = request.references.map(reference => { const task = e.native.state.tasks.find(t => t.id === reference.id); return { reference: H.clone(reference), state: !task ? "missing" : task.deletedAt !== null ? "deleted" : !P.same(task.owner, request.workspace) ? "owner-mismatch" : "resolved", task: task ? N.taskView(task) : null }; });
   const value = { backend: "native", operation: "committed", status: "ok", workspace: H.clone(request.workspace), rows };
   return settings.afterRead ? await settings.afterRead(value) : value;
  },
  async close() { readListeners.clear(); }
 };
 const reads = new TaskService(adapter);
 const evidence = {
  subscribeInvalidations(callback) { proofListeners.add(callback); return () => { counts.proofStops++; proofListeners.delete(callback); }; },
  async readCurrentCompletionProof(request) {
   counts.proofs++; await settings.beforeProof?.(request); const e = await capture(); validateState(e.native.state); H.O.analyzeOathEvidence(e);
   const s = e.native.state, info = repo.info();
   const affected = settings.recovery ?? (info.storage?.fenced ? "unknown" : "intact");
   const rows = request.targets.map((target, targetIndex) => {
    const resolution = H.O.resolveCommitmentTarget(target, e); counts.f1Resolutions++;
    H.O.assessCompletionEligibility(target, e); counts.f1Assessments++;
    const task = s.tasks.find(t => t.id === target.authority.taskId), binding = s.bindings.find(b => b.taskId === target.authority.taskId && b.stepId === null), event = s.history.find(h => h.id === binding?.eventId), receipt = s.receipts.find(r => r.operationId === event?.operationId), command = receipt ? JSON.parse(receipt.payload) : null;
    const origin = !event ? null : event.legacy?.format === "itacan-imported-history-ref" ? "historical-import" : command?.type === "history.record" ? "history-record" : event.taskId === null ? "historical-only" : command?.type === "recurrence.complete" ? "recurrence-completion" : command?.type === "task.complete" ? "task-completion" : event.kind === "step" ? "step-completion" : ["task.create", "task.createMany"].includes(command?.type) ? "initial-completed-creation" : "unverifiable";
    const created = receipt?.result.tasks.find(t => t.id === target.authority.taskId);
    return { targetIndex, resolution: { state: resolution.state, reason: resolution.reason }, task: task ? P.taskState(N.taskView(task), task.partitionId) : null, binding: binding ? H.clone(binding) : null,
     event: event ? { eventId: event.id, operationId: event.operationId, taskId: event.taskId, stepId: event.stepId, partitionId: event.partitionId, kind: event.kind, ownerAtEvent: H.clone(event.ownerAtEvent), timestamp: event.timestamp, counted: event.counted, reopenedAt: event.reopenedAt, origin } : null,
     creation: event && receipt && created && receipt.result.change.eventIds.includes(event.id) ? { operationId: receipt.operationId, commandType: command.type, commandTaskId: command.taskId ?? null, requestedCompletion: command.type === "task.complete" ? command.payload.completed : null, repositoryRevision: receipt.result.repositoryRevision, revisionId: receipt.result.revisionId, receiptDigest: H.sha(Buffer.from(V.canonical(receipt))), createdEventId: event.id, taskAfter: { id: created.id, owner: H.clone(created.owner), partitionId: created.partitionId, completed: created.completed, completedAt: created.completedAt } } : null,
     navigation: resolution.navigation?.kind === "native-task" ? H.clone(resolution.navigation) : null };
   });
   const cutReceipt = request.enrollmentCut && s.receipts.find(r => r.result.repositoryRevision === request.enrollmentCut.repositoryRevision && r.result.revisionId === request.enrollmentCut.revisionId);
   const value = { version: 1, privacy: "local-private", requestGeneration: request.requestGeneration, ownerContextPin, providerEpoch: settings.epoch, readiness: { state: settings.state, reason: "VALIDATED_CLOSED_CAPTURE" }, freshness: settings.freshness, head: { authorityId: s.storeId, repositoryRevision: s.revision, revisionId: s.revisionId }, partitions: s.partitions.map(p => ({ id: p.id, revision: p.revision, head: p.head })), recovery: affected, cutEvidence: request.enrollmentCut ? { cut: H.clone(request.enrollmentCut), state: cutReceipt && request.enrollmentCut.authorityId === s.storeId ? "verified-current-lineage" : "unproven", receiptOperationId: cutReceipt?.operationId ?? null } : null, rows };
   return settings.afterProof ? await settings.afterProof(value) : value;
  }
 };
 function invalidate() { for (const cb of [...readListeners]) cb({ backend: "native", kind: "snapshot-invalidated", durability: "ephemeral" }); for (const cb of [...proofListeners]) cb({ version: 1, kind: "proof-invalidated", providerEpoch: settings.epoch }); }
 const stop = repo.subscribe(invalidate);
 return { reads, evidence, settings, counts, invalidate, readListeners, proofListeners, async close() { stop(); readListeners.clear(); proofListeners.clear(); await reads.close(); await basis.close(); } };
}
module.exports = { createProvider };
