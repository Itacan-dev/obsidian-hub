"use strict";
const V = require("../src/value"), F1 = require("../oath/evidence"), F2 = require("../oath/completion-proof");
const { contexts, safeError } = require("./repository-host"), { aliasDisposition } = require("./registry");
function createCompletionEvidencePort(host) {
    const privateHost = contexts.get(host); if (!privateHost) throw safeError("HOST_CONTRACT");
    let disposed = false; const stops = new Set();
    const unresolved = (index, reason) => ({ targetIndex: index, resolution: { state: "unavailable", reason }, task: null, binding: null, event: null, creation: null, navigation: null });
    return Object.freeze({
        async readCurrentCompletionProof(request, signal) {
            try {
                V.jsonValue(request); V.fields(request, ["version", "requestGeneration", "authorityId", "ownerContextPin", "targets", "enrollmentCut"], ["version", "requestGeneration", "authorityId", "ownerContextPin", "targets", "enrollmentCut"]);
                F2.check([1,2].includes(request.version) && request.authorityId === privateHost.config.authorityId && typeof request.ownerContextPin === "string"); V.revision(request.requestGeneration);
                F2.check(Array.isArray(request.targets) && request.targets.length > 0); request.targets.forEach(F1.validateTarget);
                F2.validateTargets(request.targets, request.authorityId, request.targets[0].session, request.targets[0].owner);
                if (request.enrollmentCut !== null) { V.fields(request.enrollmentCut, ["authorityId", "repositoryRevision", "revisionId"], ["authorityId", "repositoryRevision", "revisionId"]); V.uuid(request.enrollmentCut.authorityId); V.revision(request.enrollmentCut.repositoryRevision); V.uuid(request.enrollmentCut.revisionId); }
            } catch (_) { throw safeError("HOST_CONTRACT"); }
            const q = V.clone(request);
            const failed = code => F2.freeze({ version: q.version, privacy: "local-private", requestGeneration: q.requestGeneration, ownerContextPin: q.ownerContextPin, providerEpoch: host.info().hostEpoch, readiness: { state: "unavailable", reason: code }, freshness: "unknown", head: null, partitions: [], recovery: "unknown", cutEvidence: q.enrollmentCut ? { cut: q.enrollmentCut, state: "unproven", receiptOperationId: null } : null, rows: q.targets.map((t, i) => unresolved(i, code)) });
            if (disposed) return failed("PROOF_PORT_DISPOSED");
            const result = await privateHost.capture({ proofVersion: q.version, selection: "completions", ownerContextPin: q.ownerContextPin, owners: [q.targets[0].owner], targets: q.targets.map(t => ({ taskId: t.authority.taskId, owner: t.owner, partitionId: t.authority.partitionId, preparation: t.authority.enrollment })), cut: q.enrollmentCut }, signal);
            if (disposed) return failed("PROOF_PORT_DISPOSED");
            if (result.failure) return failed(result.failure.code);
            const { snapshot: s, stamp } = result.value, context = result.context;
            const rows = q.targets.map((target, index) => {
                const record = s.targets[index], c = s.completions[index]; let resolution;
                if (s.readiness.state !== "ready") resolution = { state: "unavailable", reason: "RECOVERY_FENCED" };
                else resolution = aliasDisposition(target, context.identity);
                if (!resolution) {
                    const states = { resolved: "resolved-native", "kind-mismatch": "quarantined", "missing-step": "quarantined" };
                    const reasons = { resolved: record.task?.archivedAt === null ? "EXACT_NATIVE_ID" : "RETAINED_ARCHIVED_TARGET", missing: "TARGET_NOT_PUBLISHED", deleted: "TASK_DELETED", "owner-mismatch": "PHYSICAL_OWNER_CHANGED", quarantined: "IMPORT_TREE_QUARANTINED", "pending-native-publication": "IMPORT_PREPARED_NOT_PUBLISHED", "retired-step": "RETIRED_ID_IS_NOT_A_TASK", "kind-mismatch": "TARGET_KIND_MISMATCH", "missing-step": "TARGET_KIND_MISMATCH" };
                    resolution = { state: states[record.disposition] ?? record.disposition, reason: reasons[record.disposition] };
                    if (record.disposition === "missing" && target.original.kind === "legacy-task") resolution.state = "pending-native-publication";
                    if (resolution.state === "resolved-native" && !record.preparation) resolution = { state: "unavailable", reason: "ENROLLMENT_PROOF_UNAVAILABLE" };
                }
                const t = record.task;
                const task = t ? { id: t.id, revision: t.revision, owner: V.clone(t.owner), partitionId: t.partitionId, completed: t.completed, completedAt: t.completedAt, archivedAt: t.archivedAt, deletedAt: t.deletedAt, steps: t.steps.map(x => ({ id: x.id, taskId: x.taskId, parentStepId: x.parentStepId, order: x.order, completed: x.completed, completedAt: x.completedAt })) } : null;
                const visible = resolution.state === "resolved-native";
                return { targetIndex: index, resolution, task, binding: visible ? c.binding : null, event: visible ? c.event : null, creation: visible ? c.creation : null, navigation: visible ? { kind: "native-task", id: target.authority.taskId } : null };
            });
            const proof = { version: q.version, privacy: "local-private", requestGeneration: q.requestGeneration, ownerContextPin: q.ownerContextPin, providerEpoch: stamp.hostEpoch, readiness: s.readiness, freshness: "current-snapshot", head: s.head, partitions: s.partitions.filter(p => p.head !== null).map(p => ({ id: p.id, revision: p.revision, head: p.head })), recovery: s.recovery.state === "intact" ? "intact" : "affected", cutEvidence: s.cutEvidence, rows };
            F2.validateRead(proof, q); return F2.freeze(proof);
        },
        subscribeInvalidations(listener) {
            if (disposed || typeof listener !== "function") throw safeError("HOST_CONTRACT");
            const stop = host.subscribe(() => listener({ version: 1, kind: "proof-invalidated", providerEpoch: host.info().hostEpoch }));
            const owned = () => { stop(); stops.delete(owned); }; stops.add(owned); return owned;
        },
        dispose() { if (disposed) return; disposed = true; for (const stop of [...stops]) stop(); }
    });
}
module.exports = { createCompletionEvidencePort };
