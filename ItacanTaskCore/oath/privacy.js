"use strict";
const V = require("../src/value"), D = require("../src/domain"), E = require("./evidence");
// Classification only. This neither serializes nor bypasses repository export guards.
const PRIVATE_CLASSES = Object.freeze(["oath-session", "oath-outcome", "focus", "strict-device", "source-envelope", "source-path", "alias-ledger", "identity-plan", "quarantine", "receipt", "raw-history", "recovery", "resource-content", "private-current-content"]);
function classifyTaskSharing(task, ownerEvidence) {
    D.validateTask(task); E.registryValue(ownerEvidence);
    const r = ownerEvidence.find(r => E.same(r.owner, task.owner));
    const result = (state, reason) => ({ version: 1, state, reason, privacy: "local-private", packet: null });
    if (!r || r.partitionId !== task.partitionId || !r.available) return result("blocked", "OWNER_EVIDENCE_UNAVAILABLE");
    if (task.owner.type === "resource") return result("private", "RESOURCE_PHYSICAL_OWNER");
    if (!r.shared || r.shareApproval === null) return result("private", "PROJECT_NOT_APPROVED_FOR_SHARING");
    if (require("../src/history-import").importedTask(task)) return result("blocked", "IMPORT_DEPENDENT_TRANSPORT_REQUIRES_N4");
    return result("canonical-fields-only", "CLASSIFICATION_IS_NOT_EXPORT_AUTHORIZATION");
}
module.exports = { PRIVATE_CLASSES, classifyTaskSharing };
