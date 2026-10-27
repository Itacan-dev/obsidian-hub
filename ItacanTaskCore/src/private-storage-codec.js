"use strict";
// Private persistence only. The historical outer grammars deliberately remain
// recognizable to frozen readers so their version checks are terminal.
const { check, fail } = require("./errors");
const { canonical, clone, plain, fields, uuid, revision } = require("./value");
const { sha256 } = require("./source-content");
const BASE = "private-native-storage-v1", IMPORT = "private-history-import-v1", ATOMIC = "atomic-task-mutations-v1", GIT = "git-shared-compact-proofs-v2", PERSONAL = "personal-sync-proofs-v1", PERSONAL2 = "personal-sync-proofs-v2";
const OUTER = ["schemaVersion", "storeId", "revision", "revisionId", "parentRevisionId", "partitions", "tasks", "history", "bindings", "receipts", "retiredStepIds"];
const MANIFEST = ["format", "schemaVersion", "storeId", "retention", "current", "ancestry"];
function supported(version, values = [1]) { if (!values.includes(version)) fail("UNSUPPORTED_SCHEMA", "Unsupported private storage version."); }
function parse(raw) { try { return JSON.parse(raw); } catch (_) { fail("INTEGRITY", "Invalid private storage JSON."); } }
function authority(id, expected) { uuid(id); if (id !== expected) fail("STORAGE_AUTHORITY_MISMATCH", "Storage authority differs from the explicitly selected authority."); }
function validateBarrier(b, expected) {
    check(b && typeof b === "object", "Missing private authority barrier."); supported(b.version, [1, 2, 3, 4, 5]); supported(b.minimumLogicalSchemaVersion, [1, 2, 3, 4]);
    const caps = [BASE, ...(b.minimumLogicalSchemaVersion === 4 ? [IMPORT] : []), ...(b.version >= 2 ? [ATOMIC] : []), ...(b.version === 3 ? [GIT] : []), ...(b.version === 4 ? [PERSONAL] : b.version === 5 ? [PERSONAL2] : [])];
    if (canonical(b.requiredCapabilities ?? null) !== canonical(caps)) fail("UNSUPPORTED_SCHEMA", "Missing/unknown mandatory private storage capability.");
    fields(b, ["version", "authorityId", "minimumLogicalSchemaVersion", "requiredCapabilities", "importRecoveryScope", ...(b.version>=4?["personalScope"]:[])], ["version", "authorityId", "minimumLogicalSchemaVersion", "requiredCapabilities", "importRecoveryScope", ...(b.version>=4?["personalScope"]:[])]);
    if(b.version>=4){const p=b.personalScope,keys=["version","spaceId","seedDigest","bindingDigest","replicaId","rootOperationId","rootCommandDigest","sourceRevisionId",...(b.version===5?["profileDigest","transition"]:[])];fields(p,keys,keys);check(p.version===(b.version===5?2:1),"Personal scope version differs.");[p.spaceId,p.replicaId,p.sourceRevisionId].forEach(uuid);for(const d of [p.seedDigest,p.bindingDigest,p.rootCommandDigest,...(b.version===5?[p.profileDigest]:[])])check(/^[a-f0-9]{64}$/.test(d),"Personal scope commitment required.");require("./value").text(p.rootOperationId);if(b.version===5){const t=p.transition;fields(t,["operationId","commandDigest","predecessorRevisionId","predecessorCapability"],["operationId","commandDigest","predecessorRevisionId","predecessorCapability"]);require("./value").text(t.operationId);uuid(t.predecessorRevisionId);check(/^[a-f0-9]{64}$/.test(t.commandDigest)&&["atomic-task-mutations-v1","personal-sync-proofs-v1"].includes(t.predecessorCapability),"Personal transition evidence differs.");}}

    authority(b.authorityId, expected);
    if (b.minimumLogicalSchemaVersion === 4) { check(b.importRecoveryScope !== null, "Import barrier lacks protected identity scope."); require("./history-import").validateScope(b.importRecoveryScope); }
    else check(b.importRecoveryScope === null, "Unexpected import scope before schema 4.");
    return b;
}
function makeBarrier(id, minimum, scope, taskMutationVersion, gitSharedVersion, personalScope = null) { check(gitSharedVersion === undefined || gitSharedVersion === 2, "Unsupported Git proof capability."); check(taskMutationVersion === undefined || taskMutationVersion === 1, "Unsupported task mutation capability."); return clone(validateBarrier({ version: personalScope ? (personalScope.version===2?5:4) : gitSharedVersion === 2 ? 3 : taskMutationVersion === 1 ? 2 : 1, authorityId: id, minimumLogicalSchemaVersion: minimum, requiredCapabilities: [BASE, ...(minimum === 4 ? [IMPORT] : []), ...(taskMutationVersion === 1 ? [ATOMIC] : []), ...(gitSharedVersion === 2 ? [GIT] : []), ...(personalScope ? [personalScope.version===2?PERSONAL2:PERSONAL] : [])], ...(personalScope ? {personalScope} : {}), importRecoveryScope: scope }, id)); }
function descriptor(d) {
    fields(d, ["file", "sha256", "revision", "revisionId", "parentRevisionId"], ["file", "sha256", "revision", "revisionId", "parentRevisionId"]);
    revision(d.revision); uuid(d.revisionId); if (d.parentRevisionId !== null) uuid(d.parentRevisionId);
    check(d.file === `gen-${d.revision}-${d.revisionId}.json` && /^[0-9a-f]{64}$/.test(d.sha256) && (d.revision === 0) === (d.parentRevisionId === null), "Invalid private generation descriptor.");
}
function decodePrivateManifest(raw, expected) {
    const w = parse(raw); fields(w, ["payload", "sha256"], ["payload", "sha256"]); supported(w.payload?.schemaVersion, [4]);
    check(sha256(canonical(w.payload)) === w.sha256, "Private manifest checksum mismatch.");
    const m = w.payload; fields(m, MANIFEST, MANIFEST); authority(m.storeId, expected); check(m.format === "itacan-task-manifest", "Invalid private manifest format.");
    const a = m.ancestry; if (a?.format !== "itacan-private-lineage") fail("STORAGE_PROFILE_MISMATCH", "A private root cannot use a flat or legacy manifest.");
    supported(a.version, [1, 2, 3, 4, 5]); fields(a, ["format", "version", "barrier", "entries"], ["format", "version", "barrier", "entries"]); validateBarrier(a.barrier, expected);
    if (a.version !== a.barrier.version) fail("UNSUPPORTED_SCHEMA", "Private lineage/capability version mismatch.");
    check(Number.isInteger(m.retention) && m.retention >= 2 && m.retention <= 32 && Array.isArray(a.entries) && a.entries.length < m.retention, "Invalid private retention/ancestry.");
    const chain = [m.current, ...a.entries]; chain.forEach(descriptor);
    for (let i = 1; i < chain.length; i++) check(chain[i - 1].revision === chain[i].revision + 1 && chain[i - 1].parentRevisionId === chain[i].revisionId, "Broken private ancestry.");
    return { manifest: clone({ ...m, ancestry: a.entries }), barrier: clone(a.barrier) };
}
function encodePrivateManifest(manifest, barrier) {
    fields(manifest, MANIFEST, MANIFEST); supported(manifest.schemaVersion, [4]);
    validateBarrier(barrier, manifest.storeId);
    const payload = { format: manifest.format, schemaVersion: 4, storeId: manifest.storeId, retention: manifest.retention, current: manifest.current,
        ancestry: { format: "itacan-private-lineage", version: barrier.version, barrier, entries: manifest.ancestry } };
    const raw = canonical({ payload, sha256: sha256(canonical(payload)) }) + "\n"; decodePrivateManifest(raw, manifest.storeId); return raw;
}
// Only decodePrivateGeneration may call this after validateState has completed
// its root jsonValue scan. The remaining barrier checks are synchronous and
// nonmutating. Keep canonical reconstruction and JSON normalization identical
// to value.clone; this is not a general unchecked-copy API.
function copyValidatedGeneration(state) {
    const sort = item => Array.isArray(item) ? item.map(sort) : plain(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
    return JSON.parse(JSON.stringify(sort(state)));
}
function decodePrivateGeneration(raw, expected) {
    const w = parse(raw); supported(w.schemaVersion, [4]); fields(w, OUTER, OUTER); authority(w.storeId, expected);
    const e = w.receipts; if (e?.format !== "itacan-private-state") fail("STORAGE_PROFILE_MISMATCH", "A private root cannot use a flat or legacy generation.");
    supported(e.version, [1, 2, 3, 4, 5]); supported(e.logicalSchemaVersion, [1, 2, 3, 4]);
    const keys = ["format", "version", "barrier", "logicalSchemaVersion", "records", "recurrence", "historyImport", ...(e.version === 3 ? ["gitShared"] : []), ...(e.version >= 4 ? ["personalShared"] : [])]; fields(e, keys, keys);
    validateBarrier(e.barrier, expected); check(e.barrier.minimumLogicalSchemaVersion >= e.logicalSchemaVersion, "Private barrier regressed below logical state.");
    if (e.version !== e.barrier.version) fail("UNSUPPORTED_SCHEMA", "Private state/capability version mismatch.");
    const state = { ...w, schemaVersion: e.logicalSchemaVersion, receipts: e.records };
    if (e.recurrence !== null) state.recurrence = e.recurrence;
    if (e.historyImport !== null) state.historyImport = e.historyImport;
    if (e.version >= 4) {check(e.personalShared !== null && e.personalShared.version===(e.version===5?2:1),"Personal capability requires matching proof evidence.");state.personalShared=e.personalShared;}
    if (e.version === 3) { check(e.gitShared !== null, "Git capability requires origin evidence."); state.gitShared = e.gitShared; }
    require("./domain").validateState(state);
    if (e.version < 2 && state.receipts.some(r => Object.hasOwn(r.result, "atomicTask"))) fail("UNSUPPORTED_SCHEMA", "Atomic task effects require the version-2 private barrier.");
    if (state.historyImport) {
        const scope = require("./history-import").scopeOf(state), merged = require("./history-import").mergeScope(e.barrier.importRecoveryScope, scope);
        check(canonical(merged) === canonical(e.barrier.importRecoveryScope), "Generation barrier omits imported identities/partitions.");
    }
    return { state: copyValidatedGeneration(state), barrier: clone(e.barrier) };
}
function encodePrivateGeneration(state, barrier) {
    require("./domain").validateState(state); validateBarrier(barrier, state.storeId);
    check(!!state.personalShared === (barrier.version >= 4), "Personal capability cannot be added/removed through ordinary publication.");
    check(!!state.gitShared === (barrier.version === 3), "Git capability cannot be added/removed through publication.");
    const wire = Object.fromEntries(OUTER.map(k => [k, state[k]])); wire.schemaVersion = 4;
    wire.receipts = { format: "itacan-private-state", version: barrier.version, barrier, logicalSchemaVersion: state.schemaVersion, records: state.receipts, recurrence: state.recurrence ?? null, historyImport: state.historyImport ?? null, ...(barrier.version === 3 ? { gitShared: state.gitShared } : {}), ...(barrier.version >= 4 ? {personalShared:state.personalShared} : {}) };
    const raw = canonical(wire) + "\n"; decodePrivateGeneration(raw, state.storeId); return raw;
}
module.exports = { makeBarrier, validateBarrier, decodePrivateManifest, encodePrivateManifest, decodePrivateGeneration, encodePrivateGeneration };
