"use strict";
// Private fixed projection of an already validated authoritative generation.
const V = require("./value"), F = require("./completion-effects"), I = require("./history-import"), { check } = require("./errors");
const hash = I.hash, same = F.same;
function validateRequest(r) {
    V.jsonValue(r); V.fields(r, ["version", "authorityId", "owners", "selection"], ["version", "authorityId", "owners", "selection"]);
    check(r.version === 4 && r.selection === "history", "Private History version 4 required."); V.uuid(r.authorityId);
    check(Array.isArray(r.owners) && r.owners.length > 0 && new Set(r.owners.map(V.canonical)).size === r.owners.length, "Explicit unique History owners required.");
    r.owners.forEach(require("./domain").workspace); return V.clone(r);
}
function publication(state, e) {
    const r = state.receipts.find(r => r.operationId === e.operationId), c = r && JSON.parse(r.payload);
    check(r && r.result.change.eventIds.filter(id => id === e.id).length === 1 && r.partitionIds.includes(e.partitionId), "History creation receipt mismatch.");
    let origin;
    if (e.legacy?.format === "itacan-imported-history-ref") {
        check(c.type === "history.importBundle" && state.historyImport?.outcome?.eventIds.includes(e.id), "Unproven imported event."); origin = "represented-import";
    } else if (F.isAtomic(c.type)) { const effect = F.selectedEffect(state, r, e.id); check(effect, "History atomic effect missing."); origin = effect.origin; }
    else if (c.type === "history.record") {
        check(same(c.payload.record, e) && state.historyImport?.projection.publications.some(p => p.eventId === e.id && p.availability === "available"), "Historical append overlap is unproven."); origin = "historical-append";
    } else {
        check(e.legacy === null && ["task.create", "task.createMany", "task.complete", "step.add", "step.complete", "recurrence.complete"].includes(c.type), "Unsupported History origin.");
        check(F.creationKind(r, e), "History event/command target relationship is unproven.");
        const task = r.result.tasks.find(t => t.id === e.taskId), target = e.stepId === null ? task : task?.steps.find(s => s.id === e.stepId);
        check(task && target?.completed && target.completedAt === e.timestamp && task.partitionId === e.partitionId && same(task.owner, e.ownerAtEvent) && same(e.snapshot, { title: target.title, parentTitle: e.stepId === null ? null : task.title }), "History event/creation snapshot mismatch.");
        if (["task.complete", "step.complete", "recurrence.complete"].includes(c.type)) check(c.taskId === e.taskId && (c.type === "recurrence.complete" || c.payload.completed === true) && (c.type !== "step.complete" || c.payload.stepId === e.stepId), "History completion command mismatch.");
        origin = ["task.create", "task.createMany", "step.add"].includes(c.type) ? "initial-completion" : c.type === "recurrence.complete" ? "recurrence-completion" : "completion";
    }
    if (!e.counted && e.reopenedAt !== null && e.taskId !== null) check(state.receipts.some(later => {
        if (later.result.repositoryRevision <= r.result.repositoryRevision || !later.result.change.eventIds.includes(e.id)) return false;
        const cmd = JSON.parse(later.payload);
        if (F.isAtomic(cmd.type)) return F.validateReceipt(state, later).effects.some(x => x.eventId === e.id && x.transition === "reopen" && x.taskId === e.taskId && x.stepId === e.stepId);
        return cmd.taskId === e.taskId && cmd.type === (e.stepId === null ? "task.complete" : "step.complete") && cmd.payload.completed === false && (e.stepId === null || cmd.payload.stepId === e.stepId) && later.result.tasks.some(t => t.id === e.taskId && (e.stepId === null ? !t.completed : t.steps.some(s => s.id === e.stepId && !s.completed)));
    }), "History reopening receipt missing.");
    return { origin, receipt: { operationId: r.operationId, repositoryRevision: r.result.repositoryRevision, revisionId: r.result.revisionId, digest: hash(r), index: r.result.change.eventIds.indexOf(e.id) } };
}
function projectHistory(state, request, storage) {
    const selected = owner => request.owners.some(o => same(o, owner));
    const base = require("./snapshot-read").projectSnapshot(state, { version: 1, authorityId: request.authorityId, owners: request.owners, selection: "targets", targets: [] }, storage);
    check(base.partitions.length === request.owners.length, "History owner partition missing.");
    const events = state.history.filter(e => selected(state.partitions.find(p => p.id === e.partitionId).owner)).map(e => {
        const p = publication(state, e), task = state.tasks.find(t => t.id === e.taskId), imported = state.historyImport;
        const attribution = imported?.projection.publications.find(p => p.eventId === e.id)?.ownerSnapshot ?? (p.origin === "represented-import" ? imported.plan.ownerSnapshots.find(o => same(o.owner, e.ownerAtEvent)) : null) ?? null;
        const navigation = !task ? "unbound" : task.deletedAt !== null ? "deleted" : !same(task.owner, e.ownerAtEvent) || task.partitionId !== e.partitionId ? "owner-mismatch" : e.stepId !== null && !task.steps.some(s => s.id === e.stepId) ? "retired-step" : task.phase !== null || task.steps.some(s => s.parentStepId !== null) || require("./atomic-task").recurrenceGuard(state, task).kind !== "none" ? "unsupported" : "available";
        return { eventId: e.id, taskId: e.taskId, stepId: e.stepId, partitionId: e.partitionId, kind: e.kind, timestamp: e.timestamp, title: e.snapshot.title, parentTitle: e.snapshot.parentTitle,
            ownerAtEvent: V.clone(e.ownerAtEvent), attribution: attribution ? { label: attribution.label, status: attribution.status } : null, counted: e.counted, reopenedAt: e.reopenedAt, ...p,
            navigation: { state: navigation, taskId: e.taskId, stepId: e.stepId } };
    });
    let overlap = null;
    if (state.historyImport) {
        check(state.historyImport.outcome, "History import is not published.");
        const n = state.historyImport, bundle = I.bundleOf(state), capture = bundle.proposal.capture, suppressed = new Set(n.projection.suppressions.filter(s => events.some(e => e.eventId === s.eventId)).flatMap(s => n.plan.groups.find(g => g.key === s.groupKey).rowKeys));
        const counts = new Map();
        overlap = { captureDigest: capture.digest, rows: capture.history.map((row, ordinal) => { const digest = hash(row), occurrence = counts.get(digest) ?? 0; counts.set(digest, occurrence + 1); const key = require("../history/evidence").historyRowKey(capture, ordinal); const group = n.plan.groups.find(g => g.rowKeys.includes(key)); return { key, ordinal, digest, occurrence, suppressed: suppressed.has(key), eventId: group && events.some(e => e.eventId === group.eventId) ? group.eventId : null }; }), representedEventIds: events.filter(e => e.origin === "represented-import").map(e => e.eventId) };
    }
    return require("./snapshot-read").freeze({ ...base, version: 4, history: { version: 1, events, overlap } });
}
module.exports = { validateRequest, projectHistory };
