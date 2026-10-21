"use strict";
const V = require("../src/value"), I = require("./intents"), { freeze } = require("../src/snapshot-read"), { createReadAfterWrite } = require("./read-after-write");
const recovery = new Set(["RECOVERY_REQUIRED", "RECURRENCE_RECOVERY_FENCED", "HISTORY_IMPORT_RECOVERY_FENCED", "ATOMIC_TASK_RECOVERY_FENCED"]);
const conflicts = new Set(["OPERATION_CONFLICT", "REVISION_CONFLICT", "REPOSITORY_CONFLICT", "PARTITION_CONFLICT", "WRITER_EVIDENCE_CONFLICT", "CONTENT_REVISION_CONFLICT"]);
const bounded = new Set([...recovery, ...conflicts, "ATOMIC_TASK_CAPABILITY_REQUIRED", "WRITER_CAPABILITY_REVOKED", "WRITER_SCOPE", "HOST_NOT_OPEN", "HOST_CLOSING", "LOCK_LOST", "ROOT_IDENTITY_CHANGED", "STORAGE_AUTHORITY_MISMATCH", "WRITER_ADMISSION_REQUIRED", "IDENTITY_CONFLICT", "IDENTITY_EXHAUSTED", "NOT_FOUND", "TASK_DELETED", "RECURRENCE_COMMAND_REQUIRED", "UNSUPPORTED_OPERATION", "UNSUPPORTED_SCHEMA", "REFERENCE_UNRESOLVED", "VALIDATION", "IO_ERROR", "WRITER_UNAVAILABLE"]);
function createNativeApplicationAdapter(options) {
    const { authority: input, host, writer, capability } = options;
    V.fields(input, ["backend", "authorityId", "applicationContextId"], ["backend", "authorityId", "applicationContextId"]);
    I.check(input?.backend === "native" && typeof input.applicationContextId === "string"); V.uuid(input.authorityId);
    const authority = freeze(V.clone(input)); I.check(["task", "step", "recurrence"].every(k => typeof writer?.[k] === "function") && typeof host?.read === "function" && typeof host?.info === "function");
    const reads = createReadAfterWrite(host, authority); let disposed = false;
    function scope(intent) { const info = host.info(); return I.same(intent.authority, authority) && info.authorityId === authority.authorityId && info.applicationContextId === authority.applicationContextId; }
    function prepare(input) { try { return I.compile(input); } catch (_) { I.contract(); } }
    const base = r => ({ version: 1, privacy: "local-private", operationId: r.operationId, authority: V.clone(authority) });
    function unsupported(c) { return freeze({ ...base(c.intent), status: c.state === "requires-coordination" ? "requires-coordination" : "unsupported", code: c.code, capability: c.state, attempt: "not-started", priorOutcome: "not-checked" }); }
    return Object.freeze({
        backend: "native", authority,
        async capabilities(input) {
            const c = prepare(input); if (disposed) return freeze({ version: 1, state: "authority-unavailable", code: "ADAPTER_DISPOSED" });
            if (!scope(c.intent)) return freeze({ version: 1, state: "authority-unavailable", code: "AUTHORITY_MISMATCH" });
            if (!c.request) return freeze({ version: 1, state: c.state, code: c.code });
            try { const info = await host.refresh(); if(c.intent.version===2&&info.readiness.state==="ready"&&info.storage?.taskMutationVersion!==1)return freeze({version:1,state:"requires-atomic-extension",code:"ATOMIC_TASK_CAPABILITY_REQUIRED"});return freeze({ version: 1, state: info.readiness.state === "ready" ? c.state : info.readiness.state === "recovering" ? "recovery-blocked" : "authority-unavailable", code: info.readiness.state === "ready" ? c.code : "AUTHORITY_NOT_READY" }); }
            catch (_) { return freeze({ version: 1, state: "authority-unavailable", code: "AUTHORITY_NOT_READY" }); }
        },
        async mutate(input, signal) {
            const c = prepare(input), r = c.intent, b = base(r);
            if (disposed || !scope(r)) return freeze({ ...b, status: "rejected", code: disposed ? "ADAPTER_DISPOSED" : "AUTHORITY_MISMATCH", attempt: "not-started", priorOutcome: "not-checked" });
            if (!c.request) return unsupported(c);
            let result;
            try { result = await writer[c.family](capability, c.request, signal); }
            catch (_) { return freeze({ ...b, status: "uncertain", code: "OUTCOME_RECONCILIATION_REQUIRED", retry: "identical-operation-after-authoritative-reconciliation" }); }
            if (result?.status === "committed") {
                // A failed projection after commitment cannot become definitive failure.
                try {
                    I.check(result.operationId === r.operationId && result.receipt.operationId === r.operationId); V.revision(result.receipt.repositoryRevision); V.uuid(result.receipt.revisionId);
                    I.check(result.receipt.repositoryRevision > 0 && typeof result.replayed === "boolean" && Array.isArray(result.tasks) && Array.isArray(result.eventIds));
                    for (const t of result.tasks) { V.uuid(t.id); V.revision(t.revision); V.referenceId(t.partitionId); } result.eventIds.forEach(V.uuid);
                    const recurrence = result.recurrence ? Object.fromEntries(["seriesId", "completionEventId", "successorId", "reused", "originalGenerationOperationId"].map(k => [k, V.clone(result.recurrence[k])])) : null;
                    const receipt = Object.fromEntries(["operationId", "repositoryRevision", "revisionId"].map(k => [k, result.receipt[k]]));
                    const committed = { ...b, status: result.replayed ? "replayed" : "committed", receipt, taskIds: result.tasks.map(t => t.id), eventIds: V.clone(result.eventIds), ...(recurrence ? { recurrence } : {}) };
                    if(result.atomicTask){const a=result.atomicTask;V.fields(a,["version","kind","taskId","stepIds","createdEventIds","reopenedEventIds","retiredStepIds","effectsDigest"],["version","kind","taskId","stepIds","createdEventIds","reopenedEventIds","retiredStepIds","effectsDigest"]);I.check(a.version===1&&["save","initialize"].includes(a.kind)&&/^[a-f0-9]{64}$/.test(a.effectsDigest));V.uuid(a.taskId);for(const k of["stepIds","createdEventIds","reopenedEventIds","retiredStepIds"]){I.check(Array.isArray(a[k]));a[k].forEach(V.uuid);}committed.atomicTask=V.clone(a);}
                    return freeze({ ...committed, readAfterWrite: await reads.capture(r, result) });
                } catch (_) { return freeze({ ...b, status: "uncertain", code: "OUTCOME_RECONCILIATION_REQUIRED", retry: "identical-operation-after-authoritative-reconciliation" }); }
            }
            if (result?.status === "uncertain") {
                const operationId = typeof result.operationId === "string" && result.operationId ? result.operationId : r.operationId;
                return freeze({ ...b, operationId, ...(operationId !== r.operationId ? { requestedOperationId: r.operationId } : {}), status: "uncertain", code: ["ACKNOWLEDGEMENT_LOST", "PUBLICATION_UNCERTAIN", "OUTCOME_RECONCILIATION_REQUIRED", "OPERATION_CONFLICT"].includes(result.code) ? result.code : "OUTCOME_RECONCILIATION_REQUIRED", retry: "identical-operation-after-authoritative-reconciliation" });
            }
            if (result?.status === "cancelled" && ["before-admission", "before-publication"].includes(result.boundary)) return freeze({ ...b, status: "cancelled", boundary: result.boundary, priorOutcome: "not-checked" });
            if (result?.status === "rejected" && ["not-started", "not-published"].includes(result.attempt)) return freeze({ ...b, status: recovery.has(result.code) ? "recovery-blocked" : conflicts.has(result.code) ? "conflict" : "rejected", code: bounded.has(result.code) ? result.code : "WRITER_UNAVAILABLE", attempt: result.attempt, priorOutcome: "not-checked", retry: result.retry === "explicit-reopen" ? "explicit-reopen" : "review-or-refresh" });
            return freeze({ ...b, status: "uncertain", code: "OUTCOME_RECONCILIATION_REQUIRED", retry: "identical-operation-after-authoritative-reconciliation" });
        },
        dispose() { if (disposed) return; disposed = true; reads.dispose(); }
    });
}
module.exports = Object.freeze({ createNativeApplicationAdapter });
