"use strict";
// Facts are supplied by a trusted private evidence capture, not authenticated here.
// No returned analysis is an admission ticket, receipt or fulfillment instruction.
const V = require("../src/value");
const kinds = ["inbox-task", "oath-enrollment", "oath-fulfillment", "oath-terminal", "phase-deletion"];
const same = (a, b) => V.canonical(a) === V.canonical(b);
function contract(ok) { if (!ok) { const e = Error("Invalid coordination evidence contract."); e.code = "COORDINATION_CONTRACT"; throw e; } }
function text(v) { contract(typeof v === "string" && v.length > 0 && v.length <= 256); }
function digest(v) { contract(typeof v === "string" && /^[a-f0-9]{64}$/.test(v)); }
function freeze(v) { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function validate(input) {
    try {
        V.jsonValue(input);
        V.fields(input, ["version", "privacy", "id", "kind", "sourceIdentity", "preparationDigest", "preparation", "originalIntent", "authority", "recovery", "source", "proof", "protocol", "native", "application"], ["version", "privacy", "id", "kind", "sourceIdentity", "preparationDigest", "preparation", "originalIntent", "authority", "recovery", "source", "proof", "protocol", "native", "application"]);
        contract(input.version === 1 && input.privacy === "local-private" && kinds.includes(input.kind));
        text(input.id); text(input.sourceIdentity); digest(input.preparationDigest);
        contract(["confirmed", "unconfirmed", "uncertain"].includes(input.preparation));
        contract(["retained", "missing"].includes(input.originalIntent) && ["matched", "mismatched", "unknown"].includes(input.authority));
        contract(["intact", "fenced", "unknown"].includes(input.recovery) && ["unchanged", "changed", "target-deleted", "terminal"].includes(input.source));
        contract(["sufficient", "missing", "not-required"].includes(input.proof) && ["observed-existing", "proposed", "unsupported"].includes(input.protocol));
        contract(Array.isArray(input.native) && Array.isArray(input.application));
        for (const [role, rows] of [["native", input.native], ["application", input.application]]) {
            const ids = new Set();
            for (const r of rows) {
                V.fields(r, ["authorityId", "operationId", "intentDigest", "state", "basis", "receipt"], ["authorityId", "operationId", "intentDigest", "state", "basis", "receipt"]);
                text(r.authorityId); text(r.operationId); digest(r.intentDigest);
                const key = r.authorityId + "/" + r.operationId; contract(!ids.has(key)); ids.add(key);
                contract(["not-issued", "confirmed", "uncertain", "rejected", "unavailable", "conflict"].includes(r.state));
                contract((role === "native" ? ["native-receipt", "none"] : ["filesystem-readback", "save-promise", "none"]).includes(r.basis));
                if (r.receipt !== null) { V.fields(r.receipt, ["operationId", "intentDigest", "revision", "headDigest"], ["operationId", "intentDigest", "revision", "headDigest"]); text(r.receipt.operationId); digest(r.receipt.intentDigest); V.revision(r.receipt.revision); digest(r.receipt.headDigest); }
                if (role === "native" && r.state === "confirmed") contract(r.basis === "native-receipt" && r.receipt !== null);
                if (role === "application" && r.state === "confirmed") contract(r.basis === "save-promise" || r.basis === "filesystem-readback" && r.receipt !== null);
            }
        }
    } catch (_) { contract(false); }
    return V.clone(input);
}
function classifyWorkflowOutcome(input) {
    const e = validate(input), rows = [...e.native, ...e.application];
    const nativeConfirmed = e.native.filter(r => r.state === "confirmed" && r.receipt && r.receipt.operationId === r.operationId && r.receipt.intentDigest === r.intentDigest).map(r => ({ authorityId: r.authorityId, operationId: r.operationId }));
    const out = (state, code, next) => freeze({ version: 1, executable: false, privacy: "local-private", id: e.id, state, code, next, nativeConfirmed, guarantee: "captured-observation-only" });
    if (e.protocol === "unsupported") return out("blocked", "WORKFLOW_VERSION_UNSUPPORTED", "review");
    if (e.authority !== "matched") return out("blocked", "AUTHORITY_UNPROVEN", "review");
    if (rows.some(r => r.state === "conflict" || r.receipt && (r.receipt.operationId !== r.operationId || r.receipt.intentDigest !== r.intentDigest))) return out("conflict", "STABLE_EVIDENCE_CONFLICT", "review");
    if (e.source === "changed") return out("conflict", "SOURCE_CHANGED", "review");
    if (e.kind === "inbox-task" && e.source === "target-deleted" && nativeConfirmed.length) return out("partial", "PUBLISHED_TARGET_DELETED_RETAIN_DRAFT", "review");
    if (e.recovery !== "intact") return out("blocked", "RECOVERY_EVIDENCE_UNAVAILABLE", "read-authority");
    if (e.originalIntent === "missing") return out("uncertain", "ORIGINAL_INTENT_UNAVAILABLE", "review");
    if (e.source === "terminal" && e.kind !== "oath-terminal") return out("conflict", "SESSION_TERMINAL", "review");
    if (rows.some(r => ["uncertain", "unavailable"].includes(r.state))) return out("uncertain", "PARTICIPANT_OUTCOME_UNCERTAIN", "read-authority");
    if (e.proof === "missing") return out("blocked", e.kind.startsWith("oath-") ? "ENROLLMENT_OR_FULFILLMENT_PROOF_UNPROVEN" : "DOMAIN_PROOF_UNAVAILABLE", "review");
    if (e.protocol === "proposed") return out("blocked", "DURABLE_CONTRACT_NOT_IMPLEMENTED", "review");
    if (rows.some(r => r.state === "confirmed" && r.basis === "save-promise")) return out(nativeConfirmed.length ? "partial" : "uncertain", "APPLICATION_ACK_NOT_SCOPE_PROOF", "read-authority");
    if (nativeConfirmed.length && !e.application.length) return out("partial", "APPLICATION_PARTICIPANT_UNPROVEN", "read-authority");
    if (e.kind === "inbox-task" && e.application.some(r => r.state === "confirmed") && !e.native.length) return out("partial", "NATIVE_PUBLICATION_UNPROVEN", "review");
    if (rows.length && rows.every(r => r.state === "confirmed")) return out("confirmed", "OBSERVED_SCOPES_CONFIRMED_NOT_DURABILITY", "none");
    if (rows.some(r => r.state === "confirmed")) return out("partial", "PARTICIPANTS_PARTIALLY_CONFIRMED", nativeConfirmed.length ? "retry-application-only" : "review");
    if (rows.some(r => r.state === "rejected")) return out("rejected", "ATTEMPT_REJECTED_PRIOR_OUTCOME_NOT_INFERRED", "review");
    if (e.preparation === "confirmed") return out("prepared", "PREPARATION_OBSERVED", "none");
    return out("uncertain", "PREPARATION_UNCONFIRMED", "read-authority");
}
module.exports = { classifyWorkflowOutcome, validate, freeze, same, contract };
