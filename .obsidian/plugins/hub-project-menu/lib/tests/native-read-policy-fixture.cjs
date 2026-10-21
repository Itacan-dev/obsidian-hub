"use strict";
// Isolated interpretation probes. These do NOT connect any production consumer to native tasks.
const { taskGroups, taskIsFuture } = require("../domain/task-planning");
const { upcomingBucket, upcomingGroups } = require("../domain/task-views");
const { nameScore } = require("../domain/context-search");
const { oathProgress } = require("../domain/oath");
const { statisticsRange, RANGES } = require("../domain/statistics");
const { sameOwner } = require("./native-read-fixture.cjs");
function dateEvidence(task) {
    if (task.kind !== "native-task-read") throw Error("Native task projection required.");
    return { id: task.id, text: task.title, completed: task.completed, necessity: task.importance,
        fromDate: task.start?.date ?? null, fromTime: task.start?.time ?? null,
        dueDate: task.due?.date ?? null, dueTime: task.due?.time ?? null, steps: task.steps };
}
const groups = (tasks, now) => taskGroups(tasks.map(dateEvidence), new Date(now));
function searchEvidence(task, query) {
    return { id: task.id, title: task.title, description: task.description, owner: task.owner,
        completed: task.completed, steps: task.steps, titleScore: nameScore(task.title, query),
        parity: "unsupported", gaps: ["indexed continuations", "full Markdown block search", "complete ranking", "source reveal"] };
}
function briefEvidence(tasks, contexts, now) {
    const selected = tasks.filter(task => !task.completed && task.deletedAt === null && !taskIsFuture(dateEvidence(task), new Date(now)) &&
        contexts.some(context => context.available && sameOwner(task.owner, context.owner) &&
            (context.owner.type === "resource" || context.status === "active")));
    return { targets: selected.map(task => ({ kind: "native", id: task.id })), groups: groups(selected, now),
        legacySourceAction: "unsupported", savedNativeTargetRouting: "representable; not connected" };
}
function scheduleEvidence(tasks, owner, now, locationFilter = null) {
    if (owner.type !== "project") return { status: "unsupported", reason: "Production Schedule is Project-only." };
    if (locationFilter) return { status: "unsupported", reason: "Native location ancestry/eligibility registry is not implemented." };
    const selected = tasks.filter(task => sameOwner(task.owner, owner) && task.deletedAt === null);
    return { status: "partial", groups: upcomingGroups(selected.map(dateEvidence), new Date(now)), bucket: task => upcomingBucket(dateEvidence(task), new Date(now)),
        gaps: ["source-path eligibility", "location registry", "production routing"] };
}
function panelEvidence(tasks, owner, now) {
    const selected = tasks.filter(task => sameOwner(task.owner, owner) && task.deletedAt === null);
    return { groups: groups(selected, now), tasks: selected, locationEligibility: "unresolved", productionRouting: "unsupported" };
}
function phaseEvidence(tasks, owner, selectedIds, phase) {
    return selectedIds.map(id => {
        const task = tasks.find(task => task.id === id);
        const step = tasks.some(task => task.steps.some(step => step.id === id));
        return { id, state: step ? "not-parent" : !task ? "missing" : task.deletedAt !== null ? "deleted" :
            !sameOwner(task.owner, owner) || owner.type !== "project" || phase.projectId !== owner.id ? "owner-mismatch" :
            task.phase?.phaseId === phase.phaseId ? "assigned" : "candidate" };
    });
}
function homeEvidence(task, contexts, workingContext = null) {
    const context = contexts.find(context => sameOwner(context.owner, task.owner));
    return { primaryOwner: task.owner, workingContext, resourceFirst: task.owner.type === "resource",
        eligibleCohort: !!context?.available && (task.owner.type === "resource" || context.status === "active"),
        presentation: task.presentation, legacyPageProjectReference: "unavailable; no fabricated evidence",
        compatibility: "partial; native presentation policy is not connected" };
}
function committedEvidence(result) {
    if (result.operation !== "committed" || result.status !== "ok") throw Error("Resolved committed result required.");
    // Deleted/unresolved rows do not become completed work just because a retained tombstone was completed.
    const work = result.rows.map(row => ({ task: row.state === "resolved" ? row.task : null }));
    return { work, progress: oathProgress(work), fulfillmentWriter: "unsupported; unchanged" };
}
function rangeEvidence(now, earliest) { return RANGES.map(([key]) => statisticsRange(key, now, earliest)); }
module.exports = { dateEvidence, groups, searchEvidence, briefEvidence, scheduleEvidence, panelEvidence, phaseEvidence, homeEvidence, committedEvidence, rangeEvidence };

