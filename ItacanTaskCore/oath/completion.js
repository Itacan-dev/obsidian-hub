"use strict";
const { resolveCommitmentTarget } = require("./resolution");
const { same } = require("./evidence");
function assessCompletionEligibility(target, evidence) {
    const r = resolveCommitmentTarget(target, evidence);
    const result = (state, reason, event = null, receipt = null) => ({ version: 1, state, reason, displayCompleted: r.task?.completed ?? null, eventId: event?.id ?? null, operationId: receipt?.operationId ?? null, repositoryRevision: receipt?.result.repositoryRevision ?? null });
    if (!["resolved-native", "resolved-legacy", "awaiting-index"].includes(r.state)) return result("unknown", r.reason);
    if (target.authority.kind === "legacy-markdown") return result("unsupported", "LEGACY_CURRENT_STATE_POLICY_UNCHANGED");
    if (!r.task.completed) return result("ineligible", "TARGET_OPEN");
    const s = evidence.native.state;
    const binding = s.bindings.find(b => b.taskId === r.task.id && b.stepId === null);
    const event = s.history.find(e => e.id === binding?.eventId);
    if (!event || event.legacy !== null) return result("ineligible", "HISTORICAL_IMPORT_NOT_FRESH_WORK");
    const receipt = s.receipts.find(x => x.operationId === event.operationId);
    const command = receipt && JSON.parse(receipt.payload);
    if (!receipt || !["task.complete", "recurrence.complete"].includes(command.type) || command.type === "task.complete" && command.payload.completed !== true || command.taskId !== r.task.id) return result("ineligible", "NOT_A_GENUINE_PARENT_COMPLETION");
    if (receipt.result.repositoryRevision <= target.authority.enrollment.repositoryRevision) return result("ineligible", "COMPLETION_NOT_AFTER_ENROLLMENT");
    const created = receipt.result.tasks.find(t => t.id === r.task.id);
    if (!event.counted || event.reopenedAt !== null || event.taskId !== r.task.id || event.stepId !== null || event.kind !== "task" || !same(event.ownerAtEvent, target.owner) || !created?.completed || created.completedAt !== event.timestamp || !receipt.result.change.eventIds.includes(event.id)) return result("unknown", "COMPLETION_RECEIPT_MISMATCH");
    return result("eligible", "GENUINE_POST_ENROLLMENT_COMPLETION", event, receipt);
}
module.exports = { assessCompletionEligibility };
