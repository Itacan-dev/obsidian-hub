"use strict";
const V = require("../src/value"), E = require("./evidence");
const { check } = require("../src/errors");
function resolveCommitmentTarget(target, evidence) {
    E.validateTarget(target); E.validateEvidence(evidence);
    const result = (state, reason, task = null, navigation = null) => ({ version: 1, privacy: "local-private", state, reason, target: V.clone(target), task: task === null ? null : V.clone(task), navigation });
    const a = target.authority, owner = E.ownerRow(evidence, target.owner);
    if (a.kind === "legacy-markdown") {
        const l = evidence.legacy;
        if (!l || l.sourceAuthority !== a.sourceAuthority) return result("authority-mismatch", "LEGACY_AUTHORITY_MISMATCH");
        if (l.readiness !== "ready" || !l.read) return result("unavailable", "LEGACY_" + l.readiness.toUpperCase().replaceAll("-", "_"));
        if (!owner?.available) return result("unavailable", "OWNER_UNAVAILABLE");
        if (!l.read.workspace || l.read.workspace.type !== target.owner.type || l.read.workspace.id !== target.owner.id) return result("owner-mismatch", "WRONG_COMMITTED_WORKSPACE");
        const rows = l.read.rows.filter(r => E.same(r.reference, target.original.reference));
        if (rows.length !== 1) return result(rows.length ? "ambiguous" : "missing", "ORIGINAL_REFERENCE_NOT_UNIQUE");
        const row = rows[0];
        if (row.state === "ambiguous") return result("ambiguous", "AMBIGUOUS_REFERENCE");
        if (row.task === null) return result("unavailable", row.diagnostics[0]?.code ?? "SOURCE_UNAVAILABLE");
        if (!(row.task.path === owner.root || row.task.path.startsWith(owner.root + "/"))) return result("owner-mismatch", "WRONG_PHYSICAL_OWNER");
        return result(row.state === "awaiting-index" ? "awaiting-index" : "resolved-legacy", row.state === "awaiting-index" ? "ENROLLMENT_BRIDGE" : "EXACT_LEGACY_ID", row.task, { kind: "legacy-source", path: row.task.path, line: row.task.line, existingId: row.task.hubTaskId });
    }
    const n = evidence.native;
    if (!n || n.readiness !== "ready" || !n.state) return result("unavailable", n ? "NATIVE_" + n.readiness.toUpperCase().replaceAll("-", "_") : "NATIVE_UNAVAILABLE");
    if (n.state.storeId !== a.authorityId) return result("authority-mismatch", "NATIVE_AUTHORITY_MISMATCH");
    if (E.recoveryBlocks(evidence, a.taskId)) return result("unavailable", "RECOVERY_FENCED");
    if (!owner?.available) return result("unavailable", "OWNER_UNAVAILABLE");
    if (owner.partitionId !== a.partitionId) return result("owner-mismatch", "PINNED_PARTITION_MISMATCH");
    if (target.original.kind === "legacy-task") {
        const i = evidence.identity, p = a.aliasPin;
        if (!i) return result("quarantined", "ALIAS_EVIDENCE_UNAVAILABLE");
        const s = i.snapshot, plan = s.plans.find(x => x.id === p.planId);
        if (s.storeId !== p.storeId || s.revision !== p.ledgerRevision || i.planId !== p.planId || !plan || plan.digest !== p.planDigest || plan.snapshotDigest !== p.snapshotDigest) return result("quarantined", "STALE_ALIAS_PIN");
        if (plan.status !== "published") return result("pending-native-publication", "IDENTITY_PLAN_NOT_PUBLISHED");
        const aliases = s.aliases.filter(x => x.legacyId === p.legacyId);
        if (aliases.length !== 1) return result(aliases.length ? "ambiguous" : "missing", "EXACT_ALIAS_NOT_UNIQUE");
        const alias = aliases[0];
        if (alias.status !== "active") return result(alias.status === "ambiguous" ? "ambiguous" : "quarantined", "ALIAS_" + alias.status.toUpperCase());
        if (alias.kind !== "task") return result("quarantined", "ALIAS_KIND_MISMATCH");
        if (alias.nativeId !== a.taskId || alias.planId !== p.planId) return result("ambiguous", "ALIAS_TARGET_MISMATCH");
        if (!E.same(alias.owner, target.owner)) return result("owner-mismatch", "ALIAS_OWNER_MISMATCH");
    }
    const task = n.state.tasks.find(x => x.id === a.taskId);
    if (!task) {
        const reservation = n.state.historyImport?.plan.reservations.find(r => r.id === a.taskId && r.kind === "task");
        if (reservation?.purpose === "quarantined-target") return result("quarantined", "IMPORT_TREE_QUARANTINED");
        if (reservation?.purpose === "eligible-target" && n.state.historyImport.outcome === null) return result("pending-native-publication", "IMPORT_PREPARED_NOT_PUBLISHED");
        if (n.state.retiredStepIds.includes(a.taskId)) return result("retired-step", "RETIRED_ID_IS_NOT_A_TASK");
        if (n.state.tasks.some(t => t.steps.some(s => s.id === a.taskId))) return result("quarantined", "TARGET_KIND_MISMATCH");
        return result(target.original.kind === "legacy-task" ? "pending-native-publication" : "missing", "TARGET_NOT_PUBLISHED");
    }
    if (task.deletedAt !== null) return result("deleted", "TASK_DELETED");
    if (!E.same(task.owner, target.owner) || task.partitionId !== a.partitionId) return result("owner-mismatch", "PHYSICAL_OWNER_CHANGED");
    // Identity/owner can establish display state without authorizing enrollment or fulfillment.
    if (!E.enrollmentProof(target, evidence)) return result("unavailable", "ENROLLMENT_PROOF_UNAVAILABLE", task);
    return result("resolved-native", task.archivedAt === null ? "EXACT_NATIVE_ID" : "RETAINED_ARCHIVED_TARGET", task, { kind: "native-task", id: task.id });
}
function assessMigrationProtection(oaths, evidence) {
    E.validateEvidence(evidence); check(Array.isArray(oaths), "Explicit Oath records required.");
    const protectedTrees = [], unknown = [], sessions = new Set();
    for (const o of oaths) {
        V.jsonValue(o); check(o && typeof o === "object", "Invalid Oath record.");
        if (!["scheduled", "active"].includes(o.state)) continue;
        const key = V.canonical([o.deviceId ?? null, o.id ?? null]);
        if (sessions.has(key)) { unknown.push({ reason: "COMPETING_SESSION_SNAPSHOTS", session: { deviceId: o.deviceId ?? null, oathId: o.id ?? null } }); continue; } sessions.add(key);
        if (typeof o.id !== "string" || !o.id || typeof o.deviceId !== "string" || !o.deviceId || !Array.isArray(o.targets) || !o.targets.length) { unknown.push({ reason: "PROTECTION_UNKNOWN", session: { deviceId: o.deviceId ?? null, oathId: o.id ?? null } }); continue; }
        for (const target of o.targets) {
            try {
                if (target.session.deviceId !== o.deviceId || target.session.oathId !== o.id) throw Error("Session mismatch");
                const r = resolveCommitmentTarget(target, evidence);
                if (!["resolved-native", "resolved-legacy", "awaiting-index"].includes(r.state)) { unknown.push({ reason: r.reason, session: V.clone(target.session) }); continue; }
                const id = target.authority.kind === "native" ? target.authority.taskId : target.original.reference.id;
                protectedTrees.push({ session: V.clone(target.session), authority: V.clone(target.authority), taskId: id, stepIds: r.task.steps.map(s => s.id ?? s.hubTaskId).filter(Boolean), protectsWholeTree: true });
            } catch (_) { unknown.push({ reason: "PROTECTION_UNKNOWN", session: { deviceId: o.deviceId, oathId: o.id } }); }
        }
    }
    return { version: 1, privacy: "local-private", state: unknown.length ? "protection-unknown" : "known", protectedTrees, unknown, migrationAuthorized: false };
}
module.exports = { resolveCommitmentTarget, assessMigrationProtection };
