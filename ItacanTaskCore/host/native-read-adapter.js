"use strict";
const V = require("../src/value"), { freeze } = require("../src/snapshot-read"), { contexts, safeError } = require("./repository-host");
const { TASK_SERVICE_OPERATIONS } = require("../../.obsidian/plugins/hub-project-menu/lib/services/task-service");
const { READ_FEATURES, READ_OPERATIONS } = require("../../.obsidian/plugins/hub-project-menu/lib/services/task-read-contract");
const same = (a, b) => V.canonical(a) === V.canonical(b);
function taskDTO(t) {
    const keys = ["id", "revision", "owner", "location", "title", "description", "completed", "completedAt", "importance", "start", "due", "phase", "archivedAt", "deletedAt"];
    return { kind: "native-task-read", handle: { kind: "native", id: t.id }, ...Object.fromEntries(keys.map(k => [k, V.clone(t[k])])), steps: t.steps.map(s => ({ kind: "native-step-read", id: s.id, taskId: s.taskId, parentStepId: s.parentStepId, order: s.order, title: s.title, completed: s.completed, completedAt: s.completedAt })), presentation: { state: "unresolved", reason: "PRESENTATION_NOT_INFERRED" } };
}
function createNativeReadAdapter(host) {
    const internal = contexts.get(host); if (!internal) throw safeError("HOST_CONTRACT");
    let closed = false; const stops = new Set();
    const unsupported = { state: "unsupported", reason: "N2_CAPABILITY_DEFERRED" }, supported = { state: "supported" };
    const capabilities = freeze({ backend: "native", operations: Object.fromEntries(READ_OPERATIONS.map(k => [k, k === "history" ? unsupported : supported])), features: Object.fromEntries(READ_FEATURES.map(k => [k, ["hierarchy", "physical-owner", "navigation", "completion", "lifecycle", "stable-id", "oath-candidates", "oath-committed", "invalidation", "source-independent"].includes(k) ? supported : unsupported])) });
    function failure(request, code, status = "unavailable") { return freeze({ backend: "native", operation: request.operation, status, code, reason: code }); }
    function subscribe(callback, reads) {
        if (closed || typeof callback !== "function") throw safeError("HOST_CONTRACT");
        const stop = host.subscribe(() => callback(reads ? { backend: "native", kind: "snapshot-invalidated", durability: "ephemeral" } : { type: "invalidation" }));
        const owned = () => { stop(); stops.delete(owned); }; stops.add(owned); return owned;
    }
    return Object.freeze({
        capabilities: () => freeze({ backend: "native", operations: Object.fromEntries(TASK_SERVICE_OPERATIONS.map(k => [k, false])), guarantees: { durableRevisions: true, atomicTaskHistory: false, persistentIdempotency: false, nativeLocations: true, portableSharing: false, existingGitSharing: false, crossWorkspaceRelocation: false, creationRetry: "unsupported", completion: "unsupported", notifications: "invalidation" }, restrictions: ["Inactive disposable private reads only; no writer routing, History DTOs, transport or production authority."] }),
        async readiness() { const info = closed ? host.info() : await host.refresh(); return freeze({ backend: "native", state: closed ? "unavailable" : info.readiness.state, reason: closed ? "ADAPTER_CLOSED" : info.readiness.reason, capabilities }); },
        subscribe: cb => subscribe(cb, false), subscribeReads: cb => subscribe(cb, true),
        async read(input) {
            if (closed) return failure(input, "ADAPTER_CLOSED");
            const request = V.clone(input);
            if (request.backend !== "native" || !READ_OPERATIONS.includes(request.operation)) return failure(request, "BACKEND_MISMATCH", "unsupported");
            if (request.operation === "history" || request.operation === "navigation" && request.mode === "provenance") return failure(request, "N2_CAPABILITY_DEFERRED", "unsupported");
            const info = await host.refresh(); if (info.readiness.state !== "ready") return failure(request, info.readiness.reason, info.readiness.state === "unsupported" ? "unsupported" : "unavailable");
            const context = internal.context(), owners = context.registry.owners;
            let targets = null, references = null;
            if (request.operation === "committed") {
                references = request.references; if (!Array.isArray(references)) throw safeError("HOST_CONTRACT");
                targets = references.map(ref => {
                    if (ref.kind === "native") return { id: ref.id };
                    if (ref.kind !== "legacy-id") throw safeError("HOST_CONTRACT");
                    const s = context.identity?.snapshot, matches = s?.aliases.filter(a => a.legacyId === ref.id) ?? [];
                    const a = matches.length === 1 ? matches[0] : null, plan = a && s.plans.find(p => p.id === a.planId);
                    return a?.status === "active" && a.kind === "task" && plan?.status === "published" && same(a.owner, request.workspace) ? { id: a.nativeId } : { id: null };
                });
            } else if (["target", "navigation"].includes(request.operation)) targets = [{ id: request.handle.id }];
            const requestedOwners = request.workspace ? [request.workspace] : request.owner ? [request.owner] : owners.map(o => o.owner);
            const q = { version: 1, authorityId: info.authorityId, ownerContextPin: info.ownerContextPin, owners: requestedOwners, selection: targets ? "targets" : "tasks", ...(targets ? { targets: targets.filter(t => t.id !== null).map(t => { const owner = request.workspace ? owners.find(o => same(o.owner, request.workspace)) : null; return { taskId: t.id, owner: owner?.owner ?? requestedOwners[0], partitionId: owner?.partitionId ?? owners[0].partitionId }; }) } : { includeArchived: request.includeArchived ?? false, includeDeleted: request.includeDeleted ?? false }) };
            // Native handles do not encode ownership. Locate them only within the explicit registry scope.
            let result;
            if (targets && !request.workspace) {
                const { targets: ignored, ...selection } = q;
                result = await host.read({ ...selection, selection: "tasks", includeArchived: true, includeDeleted: true });
            } else result = await host.read(q);
            if (closed) return failure(request, "ADAPTER_CLOSED");
            if (result.status !== "ok") return failure(request, result.code);
            if (result.snapshot.readiness.state !== "ready") return failure(request, "RECOVERY_FENCED");
            if (request.operation === "structured" || request.operation === "candidates") {
                const owner = request.workspace && owners.find(o => same(o.owner, request.workspace));
                const rows = result.snapshot.tasks.filter(t => request.operation !== "candidates" || !t.completed && t.archivedAt === null && t.deletedAt === null && (owner.owner.type === "resource" || owner.status === "active")).map(taskDTO);
                return freeze({ backend: "native", operation: request.operation, status: "ok", ...(request.operation === "candidates" ? { workspace: V.clone(request.workspace) } : { consistency: "native-records" }), rows });
            }
            if (request.operation === "committed") {
                let index = 0; const rows = references.map((reference, i) => { if (targets[i].id === null) return { reference, state: "unsupported-alias", task: null }; const r = result.snapshot.targets[index++]; return { reference, state: r.disposition === "resolved" ? "resolved" : ["deleted", "owner-mismatch"].includes(r.disposition) ? r.disposition : "missing", task: r.task && ["resolved", "deleted"].includes(r.disposition) ? taskDTO(r.task) : null }; });
                return freeze({ backend: "native", operation: "committed", status: "ok", workspace: V.clone(request.workspace), rows });
            }
            const t = result.snapshot.tasks.find(t => t.id === request.handle.id), task = t ? taskDTO(t) : null;
            if (request.operation === "target") { const step = request.stepId ? task?.steps.find(s => s.id === request.stepId) ?? null : null; return freeze({ backend: "native", operation: "target", status: "ok", state: !task ? "missing" : task.deletedAt !== null ? "deleted" : request.stepId && !step ? "missing-step" : "resolved", task, step }); }
            let state = !task ? "none" : task.deletedAt !== null ? "deleted-task" : request.mode === "location" && !task.location ? "missing-location" : "available";
            return freeze({ backend: "native", operation: "navigation", status: "ok", state, target: state !== "available" ? null : request.mode === "location" ? { kind: "native-location", owner: task.owner, location: task.location } : { kind: "native-task", id: task.id } });
        },
        async close() { if (closed) return; closed = true; for (const stop of [...stops]) stop(); }
    });
}
module.exports = { createNativeReadAdapter, taskDTO };
