"use strict";
const V = require("../src/value"), D = require("../src/domain"), I = require("../identity/domain");
const { sha256 } = require("../src/source-content"), { check } = require("../src/errors");
function registryDigest(value) { const { digest, ...body } = value; return sha256(V.canonical(body)); }
function validateRegistry(input, config) {
    V.jsonValue(input); V.fields(input, ["version", "registryId", "applicationContextId", "revision", "digest", "owners"], ["version", "registryId", "applicationContextId", "revision", "digest", "owners"]);
    check(input.version === 1 && input.registryId === config.registryId && input.applicationContextId === config.applicationContextId, "Registry context mismatch.");
    V.text(input.revision); check(input.digest === registryDigest(input), "Registry digest mismatch.");
    check(Array.isArray(input.owners) && input.owners.length > 0, "Explicit registry owners required.");
    I.registry(input.owners.map(({ owner, root, shared }) => ({ owner, root, shared })));
    const partitions = new Set();
    for (const o of input.owners) {
        V.fields(o, ["owner", "partitionId", "root", "dashboard", "status", "available", "shared", "shareApproval", "locations", "mounts"], ["owner", "partitionId", "root", "dashboard", "status", "available", "shared", "shareApproval", "locations", "mounts"]);
        D.workspace(o.owner); V.referenceId(o.partitionId); check(!partitions.has(o.partitionId), "Duplicate partition mapping."); partitions.add(o.partitionId);
        check(["active", "future", "shelved", "archived"].includes(o.status) && typeof o.available === "boolean" && (o.dashboard === null || typeof o.dashboard === "string"), "Invalid owner context.");
        if (o.dashboard !== null) check(o.dashboard.startsWith(o.root + "/") && !o.dashboard.includes("\\") && !o.dashboard.split("/").some(p => p === "." || p === ".." || p === ""), "Dashboard is outside its physical owner.");
        check(Array.isArray(o.locations) && Array.isArray(o.mounts), "Explicit location/mount evidence required.");
        o.locations.forEach(D.location); o.mounts.forEach(D.workspace);
        if (o.shareApproval !== null) { V.fields(o.shareApproval, ["version", "projectId", "root", "reviewDigest"], ["version", "projectId", "root", "reviewDigest"]); check(o.owner.type === "project" && o.shared && o.shareApproval.version === 1 && o.shareApproval.projectId === o.owner.id && o.shareApproval.root === o.root && /^[0-9a-f]{64}$/.test(o.shareApproval.reviewDigest), "Invalid sharing evidence."); }
    }
    return V.clone(input);
}
function identityPin(input) {
    if (input === null) return null;
    V.fields(input, ["version", "snapshot", "planId"], ["version", "snapshot", "planId"]); check(input.version === 1, "Unsupported identity observation."); I.validateState(input.snapshot); V.text(input.planId);
    check(input.snapshot.plans.some(p => p.id === input.planId), "Pinned plan missing."); return sha256(V.canonical(input));
}
function aliasDisposition(target, evidence) {
    if (target.original.kind !== "legacy-task") return null;
    if (!evidence) return { state: "quarantined", reason: "ALIAS_EVIDENCE_UNAVAILABLE" };
    const s = evidence.snapshot, p = target.authority.aliasPin, plan = s.plans.find(x => x.id === p.planId);
    if (s.storeId !== p.storeId || s.revision !== p.ledgerRevision || evidence.planId !== p.planId || !plan || plan.digest !== p.planDigest || plan.snapshotDigest !== p.snapshotDigest) return { state: "quarantined", reason: "STALE_ALIAS_PIN" };
    if (plan.status !== "published") return { state: "pending-native-publication", reason: "IDENTITY_PLAN_NOT_PUBLISHED" };
    const aliases = s.aliases.filter(a => a.legacyId === p.legacyId);
    if (aliases.length !== 1) return { state: aliases.length ? "ambiguous" : "missing", reason: "EXACT_ALIAS_NOT_UNIQUE" };
    const a = aliases[0];
    if (a.status !== "active") return { state: a.status === "ambiguous" ? "ambiguous" : "quarantined", reason: "ALIAS_NOT_ACTIVE" };
    if (a.kind !== "task") return { state: "quarantined", reason: "ALIAS_KIND_MISMATCH" };
    if (a.nativeId !== target.authority.taskId || a.planId !== p.planId) return { state: "ambiguous", reason: "ALIAS_TARGET_MISMATCH" };
    if (V.canonical(a.owner) !== V.canonical(target.owner)) return { state: "owner-mismatch", reason: "ALIAS_OWNER_MISMATCH" };
    return null;
}
module.exports = { registryDigest, validateRegistry, identityPin, aliasDisposition };
