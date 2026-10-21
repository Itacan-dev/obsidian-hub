"use strict";
// Pure analysis only. N1-B's actual validator is reused at this separate Node
// entry point; this is not an extension of the portable native core entry.
const { check, fail } = require("../src/errors");
const { fields, canonical, clone, text, timestamp, jsonValue } = require("../src/value");
const source = require("../src/source-content");
const identity = require("../identity/domain");
const native = require("../src/domain");
const HISTORY_DECISION = "N1-E1-E01-E09-r1";
const HISTORY_POLICIES = Object.freeze(Array.from({ length: 9 }, (_, i) => "E" + String(i + 1).padStart(2, "0")));
const record = (v, keys) => fields(v, keys, keys);
const evidenceDigest = v => source.sha256(canonical({ ...v, digest: null }));
const own = (v, key) => Object.hasOwn(v, key);
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => canonical(a) === canonical(b);
const unique = xs => [...new Set(xs)].sort();
const portableVersion = v => { if (v !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported History evidence version; no downgrade."); };
function historyRowKey(capture, ordinal) { return canonical(["history-row", 1, capture.lineage, capture.id, ordinal]); }
function rawIdentity(row) {
    if (!object(row) || !own(row, "id")) return { present: false, type: "absent", value: null };
    const value = row.id, type = value === null ? "null" : typeof value;
    return { present: true, type: ["null", "string", "number", "boolean"].includes(type) ? type : "unsupported", value: clone(value) };
}
function readRawSource(capture) {
    const raw = capture.rawSource;
    if (raw === null) return true; // Exact portable values; no byte-origin claim.
    record(raw, ["encoding", "hex", "sha256", "byteLength"]);
    check(["utf-8", "opaque"].includes(raw.encoding) && typeof raw.hex === "string" && /^(?:[0-9a-f]{2})*$/.test(raw.hex), "Invalid exact raw History bytes.");
    const bytes = Uint8Array.from(raw.hex.match(/../g) ?? [], x => parseInt(x, 16));
    check(raw.byteLength === bytes.length && raw.sha256 === source.sha256(bytes), "Raw History byte integrity mismatch.");
    if (raw.encoding === "opaque") return false;
    let parsed;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch (_) { return false; }
    // Unsupported JSON keys/representations stay opaque, never become [] totals.
    try { jsonValue(parsed); } catch (_) { return false; }
    record(parsed, ["history", "checks"]);
    if (!same(parsed.history, capture.history) || !same(parsed.checks, capture.checks)) fail("SOURCE_CONFLICT", "Raw History/check bytes differ from the supplied parsed capture.");
    return true;
}
function validateHistoryCapture(c) {
    jsonValue(c);
    record(c, ["format", "version", "parserVersion", "decisionRevision", "privacy", "scope", "id", "lineage", "revision", "registryRevision", "registry", "sourceRevision", "historyRevision", "checksRevision", "rawSource", "history", "checks", "identity", "content", "targets", "digest"]);
    portableVersion(c.version); portableVersion(c.parserVersion);
    if (c.format !== "itacan-history-capture" || c.decisionRevision !== HISTORY_DECISION || c.privacy !== "local-private" || c.scope !== "global-synthetic") fail("UNSUPPORTED_SCHEMA", "Unsupported private synthetic History capture contract.");
    for (const key of ["id", "lineage", "revision", "registryRevision", "sourceRevision", "historyRevision", "checksRevision"]) text(c[key]);
    identity.registry(c.registry);
    for (const key of ["history", "checks", "content", "targets"]) check(Array.isArray(c[key]), "History collections must be explicit arrays.");
    check(c.digest === evidenceDigest(c), "History capture digest mismatch.");
    readRawSource(c);
    let plan = null;
    if (c.identity !== null) {
        record(c.identity, ["version", "storeId", "revision", "planId", "planDigest", "snapshot"]); portableVersion(c.identity.version);
        identity.validateState(c.identity.snapshot);
        const state = c.identity.snapshot;
        check(c.identity.storeId === state.storeId && c.identity.revision === state.revision && state.registryRevision === c.registryRevision && same(state.registry, c.registry), "Pinned identity ledger/registry mismatch.");
        plan = state.plans.find(p => p.id === c.identity.planId);
        check(plan && plan.digest === c.identity.planDigest && plan.snapshot.revision === c.sourceRevision, "Pinned identity plan/source mismatch.");
    }
    const entries = new Map(plan?.entries.map(e => [e.entryId, e]) ?? []), seen = new Set();
    for (const target of c.targets) {
        record(target, ["entryId", "completed", "completedAt", "metadata"]); text(target.entryId);
        check(entries.has(target.entryId) && !seen.has(target.entryId) && typeof target.completed === "boolean", "Target missing, duplicate or foreign to identity capture.");
        seen.add(target.entryId); timestamp(target.completedAt); check(target.completed || target.completedAt === null, "Open evidence target cannot carry completion time.");
        if (entries.get(target.entryId).kind === "step") check(target.metadata === null, "Step metadata is carried by its parent task.");
        else { record(target.metadata, ["start", "due", "importance", "location", "phase", "recurrence"]); jsonValue(target.metadata); }
    }
    check(seen.size === entries.size, "Every captured identity occurrence needs a current-state disposition; omission is not deletion.");
    const contentEntries = new Set();
    for (const item of c.content) {
        record(item, ["entryId", "envelope"]); check(entries.has(item.entryId) && !contentEntries.has(item.entryId), "Duplicate/foreign source content association.");
        contentEntries.add(item.entryId); source.validateEnvelope(item.envelope);
        const e = entries.get(item.entryId), root = entries.get(e.kind === "task" ? e.entryId : e.parentEntryId), env = item.envelope;
        const file = plan.snapshot.files.find(f => f.id === e.evidence.fileId);
        check(e.nativeId !== null && root && root.nativeId !== null && env.target.taskId === root.nativeId && env.target.stepId === (e.kind === "task" ? null : e.nativeId) && env.target.taskRevision === 1, "Source content native target mismatch.");
        check(env.source.documentId === file.id && env.source.path === file.path && env.source.revision === file.revision && env.region.line === e.evidence.line && same(env.source.owner, e.owner) && env.source.root === c.registry.find(r => same(r.owner, e.owner))?.root, "Source content/identity evidence mismatch.");
        source.verifySourceEnvelope(env, new TextEncoder().encode(file.content), env.source);
    }
    return c;
}
function recordedOwner(row, registry) {
    if (!object(row)) return { owner: null, reason: "EVENT_ROW_INVALID" };
    const kinds = [row.targetKind, row.contextKind].filter(x => x != null);
    if (kinds.some(x => !["project", "resource"].includes(x)) || new Set(kinds).size > 1) return { owner: null, reason: "OWNER_CONFLICT" };
    const pid = row.projectId, resourceId = typeof pid === "string" && pid.startsWith("resource:") ? pid.slice(9) : null;
    if (row.resourceType != null && (typeof row.resourceType !== "string" || resourceId !== null && row.resourceType !== resourceId)) return { owner: null, reason: "OWNER_CONFLICT" };
    const kind = kinds[0] ?? (resourceId !== null || row.resourceType ? "resource" : typeof pid === "string" && pid ? "project" : null);
    if (kind === "project" && (resourceId !== null || row.resourceType) || kind === "resource" && pid != null && resourceId === null) return { owner: null, reason: "OWNER_CONFLICT" };
    const id = kind === "resource" ? resourceId ?? row.resourceType : pid;
    const match = registry.find(r => r.owner.type === kind && r.owner.id === id);
    return match ? { owner: clone(match.owner), reason: null } : { owner: null, reason: "OWNER_UNRESOLVED" };
}
function groupsFor(c) {
    const byKey = new Map();
    for (const [ordinal, row] of c.history.entries()) {
        const raw = rawIdentity(row), rowKey = historyRowKey(c, ordinal), truthy = raw.present && raw.type !== "unsupported" && !!raw.value;
        const key = canonical(["history-event-group", 1, c.lineage, c.id, truthy ? [raw.type, raw.value] : ["row", ordinal]]);
        let group = byKey.get(key);
        if (!group) {
            const owner = recordedOwner(row, c.registry), reasons = [];
            if (!object(row) || typeof row.text !== "string" || !row.text.trim() || /[\r\n]/.test(row.text) || row.kind != null && !["task", "step"].includes(row.kind)) reasons.push("EVENT_SNAPSHOT_UNSUPPORTED");
            if (raw.type === "unsupported") reasons.push("EVENT_ID_UNSUPPORTED");
            if (owner.reason) reasons.push(owner.reason);
            group = { key, rowKeys: [], ordinals: [], rawIdentity: raw, kind: object(row) && row.kind === "step" ? "step" : "task", owner: owner.owner, nativeEventId: null,
                canonicalTimestamp: null, timeQuality: object(row) && own(row, "archivedAt") ? "archive-time-unverified" : "recorded-time-unverified", reasons, disposition: "historical-event-evidence" };
            byKey.set(key, group);
        } else if (!same(row, c.history[group.ordinals[0]])) group.reasons.push("EVENT_ID_CONFLICT");
        group.rowKeys.push(rowKey); group.ordinals.push(ordinal);
    }
    for (const group of byKey.values()) { group.reasons = unique(group.reasons); if (group.reasons.length) group.disposition = "quarantined-event-evidence"; }
    return [...byKey.values()];
}
function analyzeHistoryCapture(input) {
    const c = validateHistoryCapture(input), plan = c.identity?.snapshot.plans.find(p => p.id === c.identity.planId), groups = groupsFor(c);
    const entries = new Map(plan?.entries.map(e => [e.entryId, e]) ?? []), globalBlockers = [], content = new Map(c.content.map(x => [x.entryId, x.envelope]));
    if (!readRawSource(c)) globalBlockers.push("RAW_SOURCE_UNAVAILABLE");
    if (c.checks.some(check => !object(check))) globalBlockers.push("CHECK_EVIDENCE_UNAVAILABLE");
    const alias = e => e.evidence.legacyId !== null && c.identity?.snapshot.aliases.some(a => a.status === "active" && a.legacyId === e.evidence.legacyId && a.nativeId === e.nativeId && a.kind === e.kind && same(a.owner, e.owner) && a.planId === plan.id);
    const orphanChecks = c.checks.flatMap((check, ordinal) => {
        const found = object(check) && [...entries.values()].some(e => check.hubTaskId && check.hubTaskId === e.evidence.legacyId && (check.kind === "step" ? "step" : "task") === e.kind);
        return found ? [] : [{ ordinal, reason: object(check) ? "CHECK_IDENTITY_UNRESOLVED" : "CHECK_EVIDENCE_UNAVAILABLE" }];
    });
    const targets = c.targets.map(target => {
        const e = entries.get(target.entryId), root = entries.get(e.kind === "task" ? e.entryId : e.parentEntryId), env = content.get(e.entryId), reasons = [...e.reasons, ...globalBlockers];
        if (plan.status !== "published") reasons.push("IDENTITY_PLAN_NOT_PUBLISHED");
        if (e.identityBlocked || !e.nativeId || e.processing !== "planned-only") reasons.push("IDENTITY_UNAVAILABLE");
        if (!e.owner || !root || !same(e.owner, root.owner)) reasons.push("OWNER_UNRESOLVED");
        if (e.folder.state !== "resolved") reasons.push("FOLDER_UNRESOLVED");
        if (!env) reasons.push("CONTENT_MISSING");
        else {
            if (env.parsed.status !== "supported-region") reasons.push("CONTENT_UNRESOLVED");
            if (env.parsed.marker === null || ![" ", "x", "X"].includes(env.parsed.marker) || target.completed !== /^[xX]$/.test(env.parsed.marker)) reasons.push("SOURCE_STATE_CONFLICT");
            if (!same(env.parsed.metadata, target.metadata)) reasons.push("SOURCE_METADATA_CONFLICT");
        }
        if (target.metadata !== null) {
            const m = target.metadata;
            try {
                native.dateEndpoint(m.start); native.dateEndpoint(m.due);
                check(!m.start || !m.due || m.start.date < m.due.date || m.start.date === m.due.date && (m.start.time ?? "00:00") <= (m.due.time ?? "23:59"), "Reversed dates/times.");
            } catch (_) { reasons.push("D07_DATE_INCOMPATIBLE"); }
            if (m.recurrence !== null) reasons.push("D09_LEGACY_RECURRENCE");
            if (![null, "should", "must"].includes(m.importance)) reasons.push("IMPORTANCE_UNSUPPORTED");
            try { native.location(m.location); native.phase(m.phase, e.owner); } catch (_) { reasons.push("REFERENCE_UNRESOLVED"); }
            if (e.folder.state === "resolved" && (m.location?.type !== "folder" || m.location.id !== e.folder.locationId)) reasons.push("FOLDER_MAPPING_UNRESOLVED");
            if (m.phase !== null) reasons.push("PHASE_RESOLUTION_DEFERRED");
        }
        // Missing IDs in old checks are uncertainty, never locator-based matches.
        if (orphanChecks.some(o => object(c.checks[o.ordinal]) && !c.checks[o.ordinal].hubTaskId && c.checks[o.ordinal].path === e.evidence.path)) reasons.push("UNRESOLVED_CHECK_IN_SOURCE");
        const checks = c.checks.map((check, ordinal) => ({ check, ordinal })).filter(x => object(x.check) && e.evidence.legacyId !== null && x.check.hubTaskId === e.evidence.legacyId);
        let binding = null;
        if (!target.completed) { if (checks.length) reasons.push("STALE_CURRENT_CHECK"); }
        else if (!alias(e)) reasons.push("EXACT_ALIAS_REQUIRED");
        else if (checks.length !== 1) reasons.push(checks.length ? "CURRENT_CHECK_CONFLICT" : "CURRENT_CHECK_MISSING");
        else {
            const { check: current, ordinal } = checks[0], kind = current.kind === "step" ? "step" : "task";
            if (kind !== e.kind || e.kind === "step" && current.parentTaskId !== root.evidence.legacyId) reasons.push("CHECK_TARGET_CONFLICT");
            // The alias establishes identity; a contradictory current locator is
            // stale evidence, never permission to follow a copied alias.
            if (own(current, "path") && current.path !== e.evidence.path) reasons.push("CHECK_SOURCE_CONFLICT");
            if (["projectId", "targetKind", "contextKind", "resourceType"].some(key => own(current, key))) {
                const checkedOwner = recordedOwner(current, c.registry);
                if (checkedOwner.reason || !same(checkedOwner.owner, e.owner)) reasons.push("CHECK_OWNER_CONFLICT");
            }
            const group = current.historyId && groups.find(g => g.rawIdentity.present && g.rawIdentity.type !== "unsupported" && g.rawIdentity.type === typeof current.historyId && g.rawIdentity.value === current.historyId);
            if (!group) reasons.push("CURRENT_EVENT_MISSING");
            else {
                const row = c.history[group.ordinals[0]];
                if (group.reasons.length) reasons.push(...group.reasons);
                if (group.kind !== e.kind || row.hubTaskId !== e.evidence.legacyId || e.kind === "step" && row.parentTaskId !== root.evidence.legacyId) reasons.push("EVENT_TARGET_CONFLICT");
                if (!same(group.owner, e.owner)) reasons.push("EVENT_OWNER_CONFLICT");
                if (group.timeQuality === "archive-time-unverified") reasons.push("ARCHIVE_TIME_NOT_COMPLETION");
                const times = [target.completedAt, current.timestamp, row.timestamp].filter(v => v !== null && v !== undefined);
                if (times.some(v => !Number.isSafeInteger(v) || v < 0)) reasons.push("COMPLETION_TIME_UNSUPPORTED");
                else if (new Set(times).size > 1) reasons.push("COMPLETION_TIME_CONFLICT");
                const timestamp = times[0] ?? null;
                if (!reasons.length) binding = { entryId: e.entryId, taskEntryId: root.entryId, groupKey: group.key, rowKeys: clone(group.rowKeys), checkOrdinal: ordinal, canonicalTimestamp: timestamp };
            }
        }
        return { entryId: e.entryId, taskEntryId: root?.entryId ?? e.entryId, kind: e.kind, nativeId: e.nativeId, owner: clone(e.owner), completed: target.completed, sourceCompletedAt: target.completedAt, binding, reasons: unique(reasons), disposition: "pending-tree" };
    });
    // One event cannot bind two targets. Never choose a check-order winner.
    const bindingGroups = new Map();
    for (const target of targets) if (target.binding) { const list = bindingGroups.get(target.binding.groupKey) ?? []; list.push(target); bindingGroups.set(target.binding.groupKey, list); }
    for (const list of bindingGroups.values()) if (list.length > 1) for (const target of list) { target.binding = null; target.reasons.push("EVENT_BINDING_CONFLICT"); }
    const trees = [...entries.values()].filter(e => e.kind === "task").map(root => {
        const members = targets.filter(t => t.taskEntryId === root.entryId), reasons = unique(members.flatMap(t => t.reasons));
        const disposition = reasons.length ? "quarantined-tree" : "eligible-evidence-only";
        for (const member of members) member.disposition = disposition;
        return { taskEntryId: root.entryId, entryIds: members.map(t => t.entryId), disposition, reasons };
    });
    const bindings = targets.filter(t => t.disposition === "eligible-evidence-only" && t.binding).map(t => t.binding);
    for (const binding of bindings) { const group = groups.find(g => g.key === binding.groupKey); group.canonicalTimestamp = binding.canonicalTimestamp; group.timeQuality = "current-check-proven"; }
    return { version: 1, kind: "history-analysis-only", decisionRevision: HISTORY_DECISION, captureDigest: c.digest, privacy: "local-private", globalBlockers,
        groups, targets, trees, bindings, orphanChecks,
        accounting: { historyRows: c.history.length, groupedRows: groups.reduce((n, g) => n + g.rowKeys.length, 0), eventGroups: groups.length, targets: targets.length, eligibleTrees: trees.filter(t => t.disposition === "eligible-evidence-only").length, quarantinedTrees: trees.filter(t => t.disposition === "quarantined-tree").length, importedTasks: 0, importedEvents: 0, allocatedEventIds: 0 },
        readiness: { evidenceAnalyzed: true, nativeImportImplemented: false, productionAuthority: false, crossStoreConsumption: false } };
}
function proposeImportBundle(capture, review) {
    const analysis = analyzeHistoryCapture(capture);
    jsonValue(review);
    record(review, ["version", "decisionRevision", "captureDigest", "reviewer", "syntheticOnly", "policyIds", "expectedIdentityRevision", "expectedPlanDigest", "expectedRegistryRevision", "expectedSourceRevision", "expectedHistoryRevision", "expectedChecksRevision", "priorCaptures"]);
    portableVersion(review.version); text(review.reviewer);
    check(review.decisionRevision === HISTORY_DECISION && review.syntheticOnly === true && same(review.policyIds, HISTORY_POLICIES), "Explicit synthetic policy review required.");
    if (review.captureDigest !== capture.digest || review.expectedIdentityRevision !== (capture.identity?.revision ?? null) || review.expectedPlanDigest !== (capture.identity?.planDigest ?? null) || review.expectedRegistryRevision !== capture.registryRevision || review.expectedSourceRevision !== capture.sourceRevision || review.expectedHistoryRevision !== capture.historyRevision || review.expectedChecksRevision !== capture.checksRevision) fail("SOURCE_CONFLICT", "Review no longer matches captured History/source/identity evidence.");
    check(Array.isArray(review.priorCaptures), "Explicit prior-capture inventory required.");
    const files = capture.identity?.snapshot.plans.find(p => p.id === capture.identity.planId).snapshot.files ?? [];
    for (const prior of review.priorCaptures) {
        record(prior, ["lineage", "digest", "sourceFiles"]); text(prior.lineage); text(prior.digest); check(Array.isArray(prior.sourceFiles), "Prior source inventory required.");
        for (const file of prior.sourceFiles) { record(file, ["id", "path"]); text(file.id); text(file.path); }
        if (prior.lineage === capture.lineage || prior.sourceFiles.some(old => files.some(f => f.id === old.id || f.path === old.path))) fail("SOURCE_CONFLICT", "Repeated/overlapping History/source lineage requires separate reconciliation.");
    }
    const proposal = { format: "itacan-history-import-proposal", version: 1, decisionRevision: HISTORY_DECISION, privacy: "local-private", mode: "evidence-only", canExecute: false, capture: clone(capture), review: clone(review), analysis, digest: null };
    proposal.digest = evidenceDigest(proposal); return proposal;
}
function captureOf(evidence) {
    jsonValue(evidence);
    if (evidence?.format !== "itacan-history-import-proposal") return validateHistoryCapture(evidence);
    record(evidence, ["format", "version", "decisionRevision", "privacy", "mode", "canExecute", "capture", "review", "analysis", "digest"]);
    portableVersion(evidence.version); check(evidence.digest === evidenceDigest(evidence), "Import proposal digest mismatch.");
    check(same(proposeImportBundle(evidence.capture, evidence.review), evidence), "Evidence-only proposal was rewritten or misrepresented as executable.");
    return evidence.capture;
}
module.exports = { HISTORY_DECISION, HISTORY_POLICIES, evidenceDigest, historyRowKey, validateHistoryCapture, analyzeHistoryCapture, proposeImportBundle, captureOf };
