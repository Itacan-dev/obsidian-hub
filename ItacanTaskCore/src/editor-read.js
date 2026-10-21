"use strict";
// Private fixed projection of already validated state. No store, identities or writes.
const V = require("./value"), C = require("./source-content"), F = require("./completion-effects");
function projectEditor(state, target, { fenced = false } = {}) {
    const unavailable = code => ({ version: 1, state: "unavailable", code, taskId: target.taskId });
    if (fenced) return unavailable("RECOVERY_FENCED");
    const task = state.tasks.find(t => t.id === target.taskId);
    if (!task) {
        const reservation = state.historyImport?.plan.reservations.find(r => r.id === target.taskId);
        return unavailable(reservation?.purpose === "quarantined-target" ? "TARGET_QUARANTINED" : reservation?.purpose === "eligible-target" ? "PUBLICATION_PENDING" : state.retiredStepIds.includes(target.taskId) ? "STEP_RETIRED" : state.tasks.some(t => t.steps.some(s => s.id === target.taskId)) ? "TARGET_KIND_MISMATCH" : "TASK_MISSING");
    }
    if (task.partitionId !== target.partitionId || V.canonical(task.owner) !== V.canonical(target.owner)) return unavailable("OWNER_MISMATCH");
    if (task.deletedAt !== null) return unavailable("TASK_DELETED");
    const partition = state.partitions.find(p => p.id === task.partitionId), current = C.contentOf(task)?.revisions.at(-1).current;
    const steps = F.ordered(task.steps);
    return {
        version: 1, state: "available", taskId: task.id, taskRevision: task.revision,
        owner: V.clone(task.owner), partitionId: task.partitionId, expectedPartitionRevision: partition.revision,
        lifecycle: { archivedAt: task.archivedAt, deletedAt: task.deletedAt },
        currentCompletion: [null, ...steps.map(s => s.id)].map(stepId => { const t = stepId === null ? task : steps.find(s => s.id === stepId); return { stepId, completed: t.completed, completedAt: t.completedAt }; }),
        guards: { expectedContentRevision: F.contentRevision(task), expectedTreeDigest: F.hash(task.steps), expectedBindings: F.bindingsFor(state, task), recurrence: require("./atomic-task").recurrenceGuard(state, task) },
        draft: { version: 1, metadata: Object.fromEntries(["title", "description", "importance", "start", "due", "location", "phase"].map(k => [k, V.clone(task[k])])),
            continuation: current?.continuation ?? "", steps: steps.map(s => ({ state: "existing", id: s.id, parentStepId: s.parentStepId, order: s.order, title: s.title, body: current?.stepBodies.find(b => b.id === s.id)?.body ?? "", completion: { kind: "keep" } })),
            deletions: [], parentCompletion: { kind: "keep" } }
    };
}
module.exports = { projectEditor };
