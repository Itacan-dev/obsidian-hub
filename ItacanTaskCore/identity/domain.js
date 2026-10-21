"use strict";
// Inactive N1-B identity evidence only. No task commands, source I/O or plugin imports.
const { createHash } = require("node:crypto");
const { canonical, clone, fields, text, uuid, revision, jsonValue } = require("../src/value");
const { check, fail } = require("../src/errors");
const VERSIONS = Object.freeze({ snapshot: 1, evidence: 1, plan: 1, aliases: 1, reservations: 1, quarantine: 1, receipts: 1 });
const DECISION_REVISION = "N1-B-D01-D02-D03-D17-D18-r1";
const CAPABILITIES = Object.freeze(["private-identity-planning-v1"]);
const hash = value => createHash("sha256").update(typeof value === "string" ? value : canonical(value), "utf8").digest("hex");
const isUUID = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const sameOwner = (a,b) => a?.type === b?.type && a?.id === b?.id;
const record = (v, names) => fields(v, names, names);
function version(v, name) { if (v !== VERSIONS[name]) fail("UNSUPPORTED_VERSION", "Unsupported " + name + " format."); }
function owner(ref, nullable = false) {
    if (nullable && ref === null) return;
    record(ref, ["type", "id"]); check(["project", "resource"].includes(ref.type), "Invalid owner type."); text(ref.id);
}
function registry(value) {
    check(Array.isArray(value) && value.length > 0, "Explicit owner registry required.");
    const keys = new Set(), roots = new Set();
    for (const r of value) {
        record(r, ["owner", "root", "shared"]); owner(r.owner); text(r.root); check(typeof r.shared === "boolean" && (!r.shared || r.owner.type === "project"), "Resources cannot be shared.");
        check(r.owner.type !== "resource" || ["study","literature","references","inspiration"].includes(r.owner.id), "Use registered stable Resource identities.");
        check(!keys.has(canonical(r.owner)) && !roots.has(r.root), "Duplicate registry owner/root."); keys.add(canonical(r.owner)); roots.add(r.root);
        check(!r.root.endsWith("/") && !r.root.includes("\\") && !r.root.split("/").some(p=>!p || p === "." || p === ".."), "Invalid owner root.");
    }
    for (const a of value) for (const b of value) if (a !== b) check(!a.root.startsWith(b.root + "/"), "Overlapping physical owner roots.");
}
function taskLines(file) {
    const result = new Set(); let fence = null;
    for (const [line, raw] of file.content.split(/\r?\n/).entries()) {
        const token = raw.trim().match(/^(`{3,}|~{3,})/);
        if (token) { if (!fence) fence = token[1][0]; else if (fence === token[1][0]) fence = null; continue; }
        if (!fence && /^\s*(?:[-*+]|\d+[.)])\s+\[[^\]]\](?:[ \t]+.*)?$/.test(raw)) result.add(line);
    }
    return result;
}
function validateSnapshot(s) {
    record(s, ["version", "id", "revision", "registryRevision", "parserVersion", "scope", "files", "occurrences"]);
    version(s.version, "evidence"); text(s.id); text(s.revision); text(s.registryRevision);
    if (s.parserVersion !== 1) fail("UNSUPPORTED_VERSION", "Unsupported identity evidence parser version.");
    check(s.scope === "global-synthetic", "Only explicit global synthetic capture is supported.");
    check(Array.isArray(s.files) && Array.isArray(s.occurrences), "Invalid source capture.");
    const files = new Set(), paths = new Set(), ids = new Set();
    for (const f of s.files) { record(f, ["id", "path", "revision", "content"]); text(f.id); text(f.path); text(f.revision); check(typeof f.content === "string", "Source content required."); check(!files.has(f.id) && !paths.has(f.path), "Duplicate source capture."); files.add(f.id); paths.add(f.path); }
    const positions = new Set();
    for (const o of s.occurrences) {
        record(o, ["entryId", "kind", "fileId", "line", "end", "ordinal", "parentEntryId", "parentStepEntryId", "order", "owner", "folder", "blockers", "privateEvidence"]);
        text(o.entryId); check(!ids.has(o.entryId), "Duplicate occurrence key."); ids.add(o.entryId);
        check(["task", "step"].includes(o.kind), "Invalid occurrence kind."); text(o.fileId);
        for (const key of ["line", "end", "ordinal", "order"]) revision(o[key]);
        const position = o.fileId + ":" + o.line; check(!positions.has(position), "Two captured entries occupy the same source occurrence."); positions.add(position);
        for (const key of ["parentEntryId", "parentStepEntryId"]) if (o[key] !== null) text(o[key]);
        owner(o.owner, true); record(o.folder, ["path", "locationId", "state"]); text(o.folder.path);
        check(["resolved", "unresolved"].includes(o.folder.state), "Invalid folder evidence.");
        if (o.folder.locationId !== null) text(o.folder.locationId);
        check((o.folder.state === "resolved") === (o.folder.locationId !== null), "Folder evidence must explicitly resolve or remain unresolved.");
        check(Array.isArray(o.blockers) && new Set(o.blockers).size === o.blockers.length, "Invalid semantic blockers."); o.blockers.forEach(text); jsonValue(o.privateEvidence);
    }
    for (const file of s.files) {
        for (const line of taskLines(file)) if (!positions.has(file.id + ":" + line)) fail("INCOMPLETE_CAPTURE", "Supplied global corpus omits a checkbox occurrence.");
    }
    return s;
}
function captured(s, o) {
    const file = s.files.find(f=>f.id === o.fileId), lines = file?.content.split(/\r?\n/), line = lines?.[o.line] ?? "";
    // Exact existing Hub grammar, not a more permissive hidden-comment parser.
    const legacyId = line.match(/<!-- hub-task:([a-zA-Z0-9-]+) -->/)?.[1] ?? null;
    const rawBlock = lines?.slice(o.line, o.end).join(file.content.includes("\r\n") ? "\r\n" : "\n") ?? "";
    return { version: 1, fileId: o.fileId, path: file?.path ?? null, fileRevision: file?.revision ?? null, sourceDigest: file ? hash(file.content) : null,
        line: o.line, end: o.end, ordinal: o.ordinal, rawLine: line, rawBlock, legacyId };
}
function analyze(snapshot, state) {
    validateSnapshot(snapshot); check(snapshot.registryRevision === state.registryRevision, "Owner registry revision mismatch.");
    const byId = new Map(snapshot.occurrences.map(o=>[o.entryId,o])), counts = new Map();
    const evidence = snapshot.occurrences.map(o=>captured(snapshot,o));
    for (const e of evidence) if (e.legacyId) counts.set(e.legacyId, (counts.get(e.legacyId) ?? 0) + 1);
    const entries = snapshot.occurrences.map((o,i)=> {
        const e = evidence[i], reasons = [], file = snapshot.files.find(f=>f.id === o.fileId), lines = file?.content.split(/\r?\n/) ?? [];
        const physical = state.registry.find(r=>e.path?.startsWith(r.root + "/"));
        if (!file || o.line >= o.end || o.end > lines.length || !taskLines(file).has(o.line)) reasons.push("INVALID_SOURCE_EVIDENCE");
        if (/<!--\s*hub-task\s*:/.test(e.rawLine) && !e.legacyId) reasons.push("INVALID_SOURCE_IDENTITY");
        if (!physical || !o.owner) reasons.push("OWNER_UNRESOLVED");
        else if (!sameOwner(physical.owner,o.owner)) reasons.push("OWNER_CONFLICT");
        const parentFolder = e.path?.slice(0, e.path.lastIndexOf("/"));
        if (parentFolder !== o.folder.path) reasons.push("FOLDER_EVIDENCE_CONFLICT");
        if (o.folder.state === "unresolved") reasons.push("CONTEXT_UNRESOLVED");
        const parent = byId.get(o.parentEntryId), stepParent = byId.get(o.parentStepEntryId);
        if (o.kind === "task" ? o.parentEntryId !== null || o.parentStepEntryId !== null : !parent || parent.kind !== "task" || parent.fileId !== o.fileId || o.line <= parent.line || o.end > parent.end || !sameOwner(parent.owner,o.owner)) reasons.push("STRUCTURE_UNSUPPORTED");
        if (o.parentStepEntryId !== null && (!stepParent || stepParent.kind !== "step" || stepParent.parentEntryId !== o.parentEntryId || o.line <= stepParent.line || o.end > stepParent.end)) reasons.push("STRUCTURE_UNSUPPORTED");
        if (e.legacyId && counts.get(e.legacyId) > 1) reasons.push("AMBIGUOUS_IDENTITY");
        if (isUUID(e.legacyId) && state.reservations.some(r=>r.id === e.legacyId)) reasons.push("RESERVED_IDENTITY");
        for (const blocker of o.blockers) reasons.push("DEFERRED:" + blocker);
        const identityBlocked = reasons.some(r=>["INVALID_SOURCE_EVIDENCE","INVALID_SOURCE_IDENTITY","OWNER_UNRESOLVED","OWNER_CONFLICT","FOLDER_EVIDENCE_CONFLICT","STRUCTURE_UNSUPPORTED","AMBIGUOUS_IDENTITY","RESERVED_IDENTITY"].includes(r));
        const disposition = reasons.includes("AMBIGUOUS_IDENTITY") || reasons.includes("RESERVED_IDENTITY") ? "ambiguous-identity" : reasons.some(r=>r.startsWith("INVALID")) ? "invalid-source-identity" : reasons.some(r=>r.includes("OWNER") || r.includes("CONTEXT") || r.includes("FOLDER")) ? "unresolved-owner-context" : reasons.length ? "unsupported-semantic" : !e.legacyId ? "id-allocation-required" : isUUID(e.legacyId) ? "eligible-planned" : "exact-alias-required";
        return { entryId: o.entryId, kind: o.kind, owner: clone(o.owner), parentEntryId: o.parentEntryId, parentStepEntryId: o.parentStepEntryId, order: o.order,
            evidence: e, folder: clone(o.folder), privateEvidence: clone(o.privateEvidence), reasons: [...new Set(reasons)], disposition, identityBlocked, nativeId: null, processing: "planned-only" };
    });
    // A Step cannot receive a usable alias through an unsafe parent identity.
    for (const entry of entries) if (entry.kind === "step" && entries.find(p=>p.entryId === entry.parentEntryId)?.identityBlocked) {
        entry.identityBlocked = true; entry.reasons.push("PARENT_IDENTITY_UNAVAILABLE"); entry.disposition = "unsupported-semantic";
    }
    return { version: 1, snapshotDigest: hash(snapshot), entries, accounting: accounting(entries) };
}
function accounting(entries) {
    const dispositions = {};
    for (const e of entries) dispositions[e.disposition] = (dispositions[e.disposition] ?? 0) + 1;
    return { captured: entries.length, dispositions, uniquelyIdentifiable: entries.filter(e=>!e.identityBlocked).length,
        plannedIdentities: entries.filter(e=>e.nativeId !== null).length, exactAliasCases: entries.filter(e=>e.evidence.legacyId !== null).length,
        quarantined: entries.filter(e=>e.reasons.length > 0).length, importedTasks: 0 };
}
function planDigest(plan) { return hash({ version: plan.version, id: plan.id, decisionRevision: plan.decisionRevision, capturedLedgerRevision: plan.capturedLedgerRevision,
    registryDigest: plan.registryDigest, snapshot: plan.snapshot, snapshotDigest: plan.snapshotDigest, entries: plan.entries, createdAt: plan.createdAt,
    prepareOperationId: plan.prepareOperationId, publishOperationId: plan.publishOperationId }); }
function envelope(state) {
    record(state, ["format", "versions", "decisionRevision", "requiredCapabilities", "storeId", "revision", "registryRevision", "registry", "plans", "aliases", "reservations", "quarantines", "receipts"]);
    check(state.format === "itacan-private-identity-planning", "Wrong planning format."); record(state.versions, Object.keys(VERSIONS));
    for (const key of Object.keys(VERSIONS)) version(state.versions[key],key);
    if (state.decisionRevision !== DECISION_REVISION) fail("UNSUPPORTED_DECISION", "Unsupported identity decision revision.");
    check(Array.isArray(state.requiredCapabilities) && canonical(state.requiredCapabilities) === canonical(CAPABILITIES), "Unsupported required capability.");
    uuid(state.storeId); revision(state.revision); text(state.registryRevision); registry(state.registry);
    for (const name of ["plans","aliases","reservations","quarantines","receipts"]) check(Array.isArray(state[name]), "Invalid planning collection.");
}
function validateState(state) {
    envelope(state);
    const known = ref => state.registry.some(r=>sameOwner(r.owner,ref));
    const ids = new Set(), plans = new Map(), allocated = new Map();
    for (const r of state.reservations) {
        record(r,["version","id","kind","owner","status","planId","entryId"]); version(r.version,"reservations"); uuid(r.id); owner(r.owner);
        check(known(r.owner) && ["task","step"].includes(r.kind) && ["existing","deleted","retired","planned","published","abandoned"].includes(r.status), "Invalid reservation.");
        check(!ids.has(r.id), "Duplicate global reservation."); ids.add(r.id);
        if (r.planId === null) check(r.entryId === null && ["existing","deleted","retired"].includes(r.status), "Invalid external reservation."); else { text(r.planId); text(r.entryId); }
    }
    for (const p of state.plans) {
        record(p,["version","id","decisionRevision","capturedLedgerRevision","registryDigest","snapshot","snapshotDigest","entries","createdAt","prepareOperationId","publishOperationId","digest","status","approvals","publicationOperationId"]);
        version(p.version,"plan"); text(p.id); check(!plans.has(p.id), "Duplicate plan."); plans.set(p.id,p);
        check(p.decisionRevision === DECISION_REVISION && p.registryDigest === hash(state.registry), "Plan decision/owner registry conflict."); revision(p.capturedLedgerRevision);
        validateSnapshot(p.snapshot); check(p.snapshot.registryRevision === state.registryRevision && p.snapshotDigest === hash(p.snapshot), "Plan source digest conflict.");
        text(p.prepareOperationId); text(p.publishOperationId); check(p.prepareOperationId !== p.publishOperationId, "Distinct operation identities required.");
        check(p.digest === planDigest(p) && ["prepared","approved","published","abandoned"].includes(p.status), "Plan digest/status conflict.");
        check(p.createdAt === null || Number.isSafeInteger(p.createdAt) && p.createdAt >= 0, "Invalid planning timestamp.");
        check(Array.isArray(p.entries) && p.entries.length === p.snapshot.occurrences.length, "Occurrence accounting mismatch.");
        const entryIds = new Set();
        for (const e of p.entries) {
            record(e,["entryId","kind","owner","parentEntryId","parentStepEntryId","order","evidence","folder","privateEvidence","reasons","disposition","identityBlocked","nativeId","processing"]);
            check(!entryIds.has(e.entryId), "Duplicate planned occurrence."); entryIds.add(e.entryId);
            const source = p.snapshot.occurrences.find(o=>o.entryId === e.entryId); check(source && canonical(e.evidence) === canonical(captured(p.snapshot,source)), "Missing or changed occurrence evidence.");
            check(e.kind === source.kind && sameOwner(e.owner,source.owner) || e.kind === source.kind && e.owner === null && source.owner === null, "Entry owner/kind mismatch.");
            check(canonical(e.folder) === canonical(source.folder) && canonical(e.privateEvidence) === canonical(source.privateEvidence) && e.processing === "planned-only", "Changed private evidence.");
            check(e.parentEntryId === source.parentEntryId && e.parentStepEntryId === source.parentStepEntryId && e.order === source.order, "Changed captured ancestry/order.");
            check(typeof e.identityBlocked === "boolean" && Array.isArray(e.reasons) && e.reasons.every(r=>typeof r === "string") && ["eligible-planned","exact-alias-required","id-allocation-required","ambiguous-identity","unsupported-semantic","invalid-source-identity","unresolved-owner-context"].includes(e.disposition), "Invalid disposition.");
            check(e.identityBlocked ? e.nativeId === null : isUUID(e.nativeId), "Invalid planned identity.");
            if (e.nativeId !== null) {
                check(!allocated.has(e.nativeId), "Two occurrences share a native identity."); allocated.set(e.nativeId,e);
                const r = state.reservations.find(r=>r.id === e.nativeId); check(r && r.planId === p.id && r.entryId === e.entryId && r.kind === e.kind && sameOwner(r.owner,e.owner), "Missing occurrence reservation.");
                check(r.status === (p.status === "published" ? "published" : p.status === "abandoned" ? "abandoned" : "planned"), "Reservation publication mismatch.");
            }
        }
        check(Array.isArray(p.approvals), "Invalid approval history.");
        for (const a of p.approvals) { record(a,["operationId","reviewer","planDigest","sourceDigest","registryDigest","ledgerRevision","syntheticOnly"]); text(a.operationId); text(a.reviewer); check(a.syntheticOnly === true && a.planDigest === p.digest && a.sourceDigest === p.snapshotDigest && a.registryDigest === p.registryDigest, "Invalid plan approval."); revision(a.ledgerRevision); check(a.ledgerRevision <= state.revision, "Approval revision is not committed."); }
        check(!["approved","published"].includes(p.status) || p.approvals.length > 0, "Missing explicit approval.");
        check(p.status === "published" ? p.publicationOperationId === p.publishOperationId : p.publicationOperationId === null, "Invalid publication receipt link.");
    }
    for (const r of state.reservations) if (r.planId !== null) check(plans.get(r.planId)?.entries.some(e=>e.entryId === r.entryId && e.nativeId === r.id), "Orphan reservation.");
    const aliasKeys = new Set();
    for (const a of state.aliases) {
        record(a,["version","legacyId","nativeId","kind","owner","planId","entryIds","status","ledgerRevision"]); version(a.version,"aliases");
        check(typeof a.legacyId === "string" && /^[a-zA-Z0-9-]+$/.test(a.legacyId) && !aliasKeys.has(a.legacyId), "Conflicting exact alias."); aliasKeys.add(a.legacyId);
        const p = plans.get(a.planId); check(p?.status === "published", "Unpublished usable alias."); revision(a.ledgerRevision);
        check(state.receipts.some(r=>r.operationId === p.publishOperationId && r.revision === a.ledgerRevision), "Alias ledger revision lacks publication receipt.");
        const es = p.entries.filter(e=>e.evidence.legacyId === a.legacyId); check(es.length > 0 && canonical(a.entryIds) === canonical(es.map(e=>e.entryId)), "Alias evidence mismatch.");
        check(["active","ambiguous","unavailable","retired"].includes(a.status), "Invalid alias state.");
        if (a.status === "active") check(es.length === 1 && es[0].nativeId === a.nativeId && es[0].reasons.length === 0 && es[0].kind === a.kind && sameOwner(es[0].owner,a.owner), "Alias target/owner is not verified.");
        else check(a.nativeId === null && a.owner === null && a.kind === null, "Unavailable alias cannot point at a target.");
    }
    for (const p of state.plans) if (p.status === "published") for (const e of p.entries) if (e.evidence.legacyId !== null)
        check(state.aliases.some(a=>a.planId === p.id && a.legacyId === e.evidence.legacyId), "Published plan is missing an alias disposition.");
    const quarantineIds = new Set();
    for (const q of state.quarantines) {
        record(q,["version","id","planId","decisionRevision","entryIds","reason","legacyId","evidence","candidateNativeIds","reviews","status","privacy"]); version(q.version,"quarantine"); text(q.id);
        check(!quarantineIds.has(q.id), "Duplicate quarantine."); quarantineIds.add(q.id); const p = plans.get(q.planId);
        check(p && q.decisionRevision === DECISION_REVISION && q.privacy === "local-private" && q.status === "quarantined" && q.reviews.length === 0, "Unsupported quarantine review transition.");
        const es = p.entries.filter(e=>q.entryIds.includes(e.entryId)); check(es.length > 0 && es.length === q.entryIds.length, "Missing quarantine occurrences.");
        check(canonical(q.evidence) === canonical(es.map(e=>({ entryId:e.entryId,owner:e.owner,evidence:e.evidence,privateEvidence:e.privateEvidence,reasons:e.reasons }))) && canonical(q.candidateNativeIds) === canonical(es.map(e=>e.nativeId).filter(Boolean)), "Missing quarantine evidence.");
        check(es.some(e=>e.reasons.includes(q.reason)), "Quarantine reason conflict.");
    }
    for (const p of state.plans) for (const e of p.entries) for (const reason of e.reasons) check(state.quarantines.some(q=>q.planId === p.id && q.reason === reason && q.entryIds.includes(e.entryId)), "Occurrence disappeared from quarantine.");
    const operations = new Set(), revisions = new Set();
    for (const r of state.receipts) {
        record(r,["version","operationId","payload","payloadDigest","revision","result","resultDigest"]); version(r.version,"receipts"); text(r.operationId); revision(r.revision);
        check(!operations.has(r.operationId) && !revisions.has(r.revision) && r.revision > 0 && r.revision <= state.revision, "Duplicate receipt/revision."); operations.add(r.operationId); revisions.add(r.revision);
        let command; try { command = JSON.parse(r.payload); } catch (_) { fail("INTEGRITY","Corrupt receipt payload."); }
        check(canonical(command) === r.payload && command.operationId === r.operationId && hash(r.payload) === r.payloadDigest && hash(r.result) === r.resultDigest, "Corrupt receipt digest.");
        check(r.result.operationId === r.operationId && r.result.revision === r.revision && r.result.replayed === false && plans.has(r.result.plan.id), "Invalid receipt result.");
        check(r.result.plan.id === command.payload.planId && r.result.plan.digest === plans.get(r.result.plan.id).digest && r.result.plan.digest === planDigest(r.result.plan) && canonical(r.result.accounting) === canonical(accounting(r.result.plan.entries)), "Receipt differs from immutable plan.");
    }
    check(revisions.size === state.revision, "Missing committed operation receipt.");
    for (const p of state.plans) { check(operations.has(p.prepareOperationId), "Plan missing preparation receipt."); if (p.status === "published") check(operations.has(p.publishOperationId), "Plan missing publication receipt."); for (const a of p.approvals) check(state.receipts.some(r=>r.operationId === a.operationId && r.revision === a.ledgerRevision), "Plan missing approval receipt/revision."); }
    jsonValue(state); return state;
}
module.exports = { VERSIONS, DECISION_REVISION, CAPABILITIES, hash, isUUID, sameOwner, record, version, owner, registry, validateSnapshot, captured, analyze, accounting, planDigest, validateState, clone, canonical };
