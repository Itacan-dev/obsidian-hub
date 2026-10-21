"use strict";
const V = require("../src/value"), D = require("../src/domain"), I = require("../identity/domain");
const { check, fail } = require("../src/errors");
const DECISION = "N1-F1-F01-F10-r1";
const READINESS = ["ready", "not-ready", "unavailable", "recovering", "unsupported"];
const same = (a, b) => V.canonical(a) === V.canonical(b);
function version(value) { if (value !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported Oath evidence version."); }
function registryValue(registry) {
    check(Array.isArray(registry), "Explicit owner registry required.");
    I.registry(registry.map(({ owner, root, shared }) => ({ owner, root, shared })));
    const partitions = new Set();
    for (const r of registry) {
        V.fields(r, ["owner", "root", "shared", "status", "available", "partitionId", "shareApproval"], ["owner", "root", "shared", "status", "available", "partitionId", "shareApproval"]);
        check(typeof r.available === "boolean" && ["active", "future", "shelved"].includes(r.status), "Invalid owner availability.");
        V.referenceId(r.partitionId); check(!partitions.has(r.partitionId), "Duplicate owner partition."); partitions.add(r.partitionId);
        if (r.shareApproval !== null) {
            V.fields(r.shareApproval, ["version", "projectId", "root", "reviewDigest"], ["version", "projectId", "root", "reviewDigest"]); version(r.shareApproval.version);
            check(r.owner.type === "project" && r.shared && r.shareApproval.projectId === r.owner.id && r.shareApproval.root === r.root, "Invalid sharing approval scope.");
            check(["Projects/Itacan", "Projects/Obsidian Hub"].includes(r.root), "Project is outside the reviewed sharing roots.");
            check(/^[0-9a-f]{64}$/.test(r.shareApproval.reviewDigest), "Sharing approval needs a reviewed digest.");
        }
    }
}
function validateEvidence(e) {
    V.jsonValue(e);
    V.fields(e, ["format", "version", "decisionRevision", "privacy", "scope", "registry", "legacy", "native", "identity", "candidates"], ["format", "version", "decisionRevision", "privacy", "scope", "registry", "legacy", "native", "identity"]);
    version(e.version); check(e.format === "itacan-oath-evidence" && e.privacy === "local-private" && e.scope === "closed-synthetic", "Private closed-synthetic evidence required.");
    if (e.decisionRevision !== DECISION) fail("UNSUPPORTED_DECISION", "Unknown Oath decision revision.");
    registryValue(e.registry);
    if (e.identity !== null) {
        V.fields(e.identity, ["snapshot", "planId"], ["snapshot", "planId"]); I.validateState(e.identity.snapshot); V.text(e.identity.planId);
        check(e.identity.snapshot.plans.some(p => p.id === e.identity.planId), "Pinned identity plan missing.");
    }
    if (e.native !== null) {
        V.fields(e.native, ["state", "readiness", "recovery"], ["state", "readiness", "recovery"]);
        check(READINESS.includes(e.native.readiness), "Unknown native readiness.");
        if (e.native.state !== null) {
            D.validateState(e.native.state);
            for (const p of e.native.state.partitions) check(e.registry.some(r => same(r.owner, p.owner) && r.partitionId === p.id), "Native owner/partition is not pinned.");
        }
        const r = e.native.recovery;
        V.fields(r, ["state", "taskIds", "stepIds"], ["state", "taskIds", "stepIds"]);
        check(["intact", "fenced", "unknown"].includes(r.state), "Unknown recovery observation.");
        for (const ids of [r.taskIds, r.stepIds]) { check(Array.isArray(ids), "Recovery scope required."); ids.forEach(V.uuid); check(new Set(ids).size === ids.length, "Duplicate recovery identity."); }
        check(r.state !== "intact" || r.taskIds.length + r.stepIds.length === 0, "Intact evidence cannot carry lost identity scope.");
    }
    if (e.legacy !== null) {
        const l = e.legacy;
        V.fields(l, ["sourceAuthority", "readiness", "read"], ["sourceAuthority", "readiness", "read"]); V.text(l.sourceAuthority); check(READINESS.includes(l.readiness), "Unknown legacy readiness.");
        if (l.read !== null) {
            check(l.read.consistency === "legacy-source-checked" && Array.isArray(l.read.rows) && Array.isArray(l.read.diagnostics), "Actual committed read evidence required.");
            if (l.read.workspace !== null) D.workspace({ type: l.read.workspace.type, id: l.read.workspace.id });
            for (const row of l.read.rows) {
                legacyReference(row.reference); check(["resolved", "awaiting-index", "unavailable", "ambiguous"].includes(row.state), "Invalid legacy disposition.");
                check(typeof row.indexed === "boolean" && typeof row.retireAwaitingIndex === "boolean" && Array.isArray(row.diagnostics), "Invalid index evidence.");
                check(["resolved", "awaiting-index"].includes(row.state) === (row.task !== null), "Legacy state/task contradiction.");
                if (row.task !== null) check(row.task.hubTaskId === row.reference.id && row.task.identityConflict === false && typeof row.task.completed === "boolean" && Array.isArray(row.task.steps), "Legacy identity/state contradiction.");
            }
        }
    }
    if (e.candidates !== undefined) { check(Array.isArray(e.candidates), "Candidate specimens must be an array."); e.candidates.forEach(validateTarget); }
    return e;
}
function legacyReference(ref) {
    V.fields(ref, ["id", "path", "text"], ["id", "path", "text"]);
    check(typeof ref.id === "string" && /^[a-zA-Z0-9-]+$/.test(ref.id), "Exact Hub ID required; no locator rescue.");
    V.text(ref.path); check(typeof ref.text === "string", "Original text snapshot required.");
}
function validateTarget(t) {
    V.jsonValue(t); V.fields(t, ["version", "session", "original", "owner", "authority"], ["version", "session", "original", "owner", "authority"]); version(t.version);
    V.fields(t.session, ["deviceId", "oathId"], ["deviceId", "oathId"]); V.text(t.session.deviceId); V.text(t.session.oathId); D.workspace(t.owner);
    check(["legacy-task", "native-task"].includes(t.original.kind), "Only parent task commitments are supported.");
    if (t.original.kind === "legacy-task") { V.fields(t.original, ["kind", "reference"], ["kind", "reference"]); legacyReference(t.original.reference); }
    else { V.fields(t.original, ["kind", "taskId", "text"], ["kind", "taskId", "text"]); V.uuid(t.original.taskId); check(typeof t.original.text === "string", "Display snapshot required."); }
    const a = t.authority;
    if (a.kind === "legacy-markdown") {
        V.fields(a, ["kind", "sourceAuthority"], ["kind", "sourceAuthority"]); V.text(a.sourceAuthority); check(t.original.kind === "legacy-task", "Native target cannot fall back to legacy.");
    } else {
        check(a.kind === "native", "Explicit authority required.");
        V.fields(a, ["kind", "authorityId", "partitionId", "taskId", "enrollment", "aliasPin"], ["kind", "authorityId", "partitionId", "taskId", "enrollment", "aliasPin"]);
        V.uuid(a.authorityId); V.uuid(a.taskId); V.referenceId(a.partitionId);
        V.fields(a.enrollment, ["repositoryRevision", "revisionId", "taskRevision"], ["repositoryRevision", "revisionId", "taskRevision"]);
        V.revision(a.enrollment.repositoryRevision); V.uuid(a.enrollment.revisionId); V.revision(a.enrollment.taskRevision); check(a.enrollment.taskRevision >= 1, "Enrollment task revision required.");
        if (t.original.kind === "native-task") check(a.taskId === t.original.taskId && a.aliasPin === null, "Original native identity cannot change.");
        else {
            const p = a.aliasPin; check(p !== null, "Legacy-origin native resolution requires a pin.");
            V.fields(p, ["legacyId", "storeId", "ledgerRevision", "planId", "planDigest", "snapshotDigest"], ["legacyId", "storeId", "ledgerRevision", "planId", "planDigest", "snapshotDigest"]);
            check(p.legacyId === t.original.reference.id, "Alias must retain exact original ID."); V.uuid(p.storeId); V.revision(p.ledgerRevision); V.text(p.planId);
            for (const key of ["planDigest", "snapshotDigest"]) check(/^[0-9a-f]{64}$/.test(p[key]), "Pinned digest required.");
        }
    }
    return t;
}
function ownerRow(e, owner) { return e.registry.find(r => same(r.owner, owner)) ?? null; }
function recoveryBlocks(e, taskId, stepId = null) {
    const r = e.native?.recovery;
    if (!r || r.state === "unknown") return true;
    if (r.state === "intact") return false;
    if (!r.taskIds.length && !r.stepIds.length || r.taskIds.includes(taskId) || stepId !== null && r.stepIds.includes(stepId)) return true;
    const tasks = [...(e.native.state?.tasks ?? []), ...(e.native.state?.receipts.flatMap(x => x.result.tasks) ?? [])];
    for (const id of r.stepIds) {
        const parents = new Set(tasks.filter(t => t.steps.some(s => s.id === id)).map(t => t.id));
        if (!parents.size || parents.has(taskId)) return true;
    }
    return false;
}
function enrollmentProof(t, e) {
    const s = e.native?.state, a = t.authority; if (!s || a.kind !== "native") return null;
    const anchor = s.receipts.find(r => r.result.repositoryRevision === a.enrollment.repositoryRevision && r.result.revisionId === a.enrollment.revisionId);
    if (!anchor) return null;
    const previous = s.receipts.filter(r => r.result.repositoryRevision <= a.enrollment.repositoryRevision).sort((x, y) => y.result.repositoryRevision - x.result.repositoryRevision).flatMap(r => r.result.tasks).find(task => task.id === a.taskId);
    if (!previous || previous.revision !== a.enrollment.taskRevision || previous.completed || previous.deletedAt !== null || previous.archivedAt !== null || previous.partitionId !== a.partitionId || !same(previous.owner, t.owner)) return null;
    return previous;
}
function analyzeOathEvidence(e) {
    validateEvidence(e);
    const groups = new Map(), unresolvedCandidates = [];
    for (const [index, target] of (e.candidates ?? []).entries()) {
        const r = require("./resolution").resolveCommitmentTarget(target, e);
        if (!["resolved-native", "resolved-legacy", "awaiting-index"].includes(r.state)) { unresolvedCandidates.push({ index, state: r.state, reason: r.reason }); continue; }
        const a = target.authority, key = V.canonical(a.kind === "native" ? [a.kind, a.authorityId, a.taskId] : [a.kind, a.sourceAuthority, target.original.reference.id]);
        const g = groups.get(key) ?? { key, indexes: [], selectable: false, reason: "" }; g.indexes.push(index);
        const owner = ownerRow(e, target.owner); g.selectable = !r.task.completed && r.task.archivedAt == null && (owner.owner.type === "resource" || owner.status === "active");
        g.reason = g.selectable ? "OPEN_PHYSICAL_PARENT" : "COMPLETED_ARCHIVED_OR_INACTIVE"; groups.set(key, g);
    }
    if (new Set([...groups.keys()].map(k => JSON.parse(k)[0])).size > 1) for (const g of groups.values()) { g.selectable = false; g.reason = "MIXED_AUTHORITIES_BLOCK_ENROLLMENT"; }
    return { version: 1, privacy: "local-private", decisionRevision: DECISION, accounting: { owners: e.registry.length, legacyRows: e.legacy?.read?.rows.length ?? 0, nativeTasks: e.native?.state?.tasks.length ?? 0, nativeEvents: e.native?.state?.history.length ?? 0, publishedAliases: e.identity?.snapshot.aliases.length ?? 0, candidateRows: e.candidates?.length ?? 0 }, candidateGroups: [...groups.values()], unresolvedCandidates, limitations: ["closed-synthetic-evidence; not a lease", "no authority transfer", "no durable unsaved-latch recovery", "no cross-store atomicity"] };
}
module.exports = { DECISION, READINESS: Object.freeze(READINESS), registryValue, validateEvidence, validateTarget, legacyReference, ownerRow, recoveryBlocks, enrollmentProof, same, analyzeOathEvidence };
