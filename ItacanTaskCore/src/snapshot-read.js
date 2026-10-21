"use strict";
// Fixed, portable read projections. Never returns a logical generation or raw receipt.
const V = require("./value"), D = require("./domain");
const { check, fail } = require("./errors");
const { sha256 } = require("./source-content");
const same = (a, b) => V.canonical(a) === V.canonical(b);
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function validateRequest(r) {
    if (r?.version === 4) return require("./history-read").validateRequest(r);
    V.jsonValue(r);
    if (r.version === 3) {
        V.fields(r, ["version", "authorityId", "owners", "selection", "operationId", "commandDigest"]);
        V.uuid(r.authorityId); V.text(r.operationId);
        check(r.selection === "operation" && Array.isArray(r.owners) && r.owners.length === 1 && /^[a-f0-9]{64}$/.test(r.commandDigest), "One scoped operation required.");
        D.workspace(r.owners[0]); return V.clone(r);
    }
    V.fields(r, ["version", "authorityId", "owners", "selection", "targets", "includeArchived", "includeDeleted", "includeConsumerFacts", "cut"], ["version", "authorityId", "owners", "selection"]);
    if (![1, 2].includes(r.version) || r.version === 2 && r.selection !== "completions") fail("UNSUPPORTED_SCHEMA", "Unsupported snapshot contract.");
    V.uuid(r.authorityId); check(Array.isArray(r.owners) && r.owners.length > 0, "Explicit snapshot owners required.");
    r.owners.forEach(D.workspace); check(new Set(r.owners.map(V.canonical)).size === r.owners.length, "Duplicate snapshot owners.");
    check(["status", "tasks", "targets", "completions", "editor"].includes(r.selection), "Unsupported snapshot selection.");
    for (const k of ["includeArchived", "includeDeleted"]) if (r[k] !== undefined) check(typeof r[k] === "boolean", "Invalid lifecycle selection.");
    if (r.includeConsumerFacts !== undefined) check(r.selection === "tasks" && typeof r.includeConsumerFacts === "boolean", "Consumer facts require task selection.");
    if (["targets", "completions", "editor"].includes(r.selection)) {
        check(Array.isArray(r.targets), "Explicit targets required.");
        for (const t of r.targets) {
            V.fields(t, ["taskId", "owner", "partitionId", "stepId", "preparation"], ["taskId", "owner", "partitionId"]);
            V.uuid(t.taskId); D.workspace(t.owner); V.referenceId(t.partitionId); check(r.owners.some(o => same(o, t.owner)), "Target outside owner scope.");
            if (t.stepId !== undefined && t.stepId !== null) V.uuid(t.stepId);
            if (t.preparation !== undefined) { V.fields(t.preparation, ["repositoryRevision", "revisionId", "taskRevision"], ["repositoryRevision", "revisionId", "taskRevision"]); V.revision(t.preparation.repositoryRevision); V.uuid(t.preparation.revisionId); V.revision(t.preparation.taskRevision); }
        }
        if (r.selection === "editor") {
            check(r.version === 1 && r.owners.length === 1 && r.targets.length === 1, "One exact editor target required.");
            check(r.targets[0].stepId === undefined && r.targets[0].preparation === undefined && r.includeArchived === undefined && r.includeDeleted === undefined && r.cut === undefined, "Editor selection has fixed parent scope.");
        }
    } else check(r.targets === undefined, "Targets require target selection.");
    if (r.cut !== undefined && r.cut !== null) { V.fields(r.cut, ["authorityId", "repositoryRevision", "revisionId"], ["authorityId", "repositoryRevision", "revisionId"]); V.uuid(r.cut.authorityId); V.revision(r.cut.repositoryRevision); V.uuid(r.cut.revisionId); }
    return V.clone(r);
}
function taskView(t) {
    const keys = ["id", "revision", "partitionId", "owner", "location", "title", "description", "completed", "completedAt", "importance", "start", "due", "phase", "steps", "archivedAt", "deletedAt"];
    return { kind: "native-task-snapshot", ...Object.fromEntries(keys.map(k => [k, V.clone(t[k])])) };
}
function preparation(state, target) {
    const a = target.preparation;
    if (!a) return null;
    const anchor = state.receipts.find(r => r.result.repositoryRevision === a.repositoryRevision && r.result.revisionId === a.revisionId);
    if (!anchor) return null;
    const previous = state.receipts.filter(r => r.result.repositoryRevision <= a.repositoryRevision).sort((x, y) => y.result.repositoryRevision - x.result.repositoryRevision).flatMap(r => r.result.tasks).find(t => t.id === target.taskId);
    if (!previous || previous.revision !== a.taskRevision || previous.completed || previous.archivedAt !== null || previous.deletedAt !== null || previous.partitionId !== target.partitionId || !same(previous.owner, target.owner)) return null;
    return { repositoryRevision: a.repositoryRevision, revisionId: a.revisionId, taskRevision: previous.revision, open: true };
}
function completion(state, target, task, version) {
    const stepId = target.stepId ?? null, binding = state.bindings.find(b => b.taskId === target.taskId && b.stepId === stepId);
    const event = binding && state.history.find(h => h.id === binding.eventId);
    if (!binding || !event) return { binding: null, event: null, creation: null };
    const receipt = state.receipts.find(r => r.operationId === event.operationId), command = receipt ? JSON.parse(receipt.payload) : null;
    const atomic = require("./completion-effects").isAtomic(command?.type), effect = atomic && version === 2 ? require("./completion-effects").selectedEffect(state, receipt, event.id) : null;
    const origin = atomic ? effect?.origin === "genuine-parent-completion" ? "task-save-completion" : effect?.origin === "genuine-step-completion" ? "step-completion" : effect?.origin === "initial-parent-completion" ? "initial-completed-creation" : effect?.origin === "initial-step-completion" ? "initial-completed-step" : "unverifiable" : event.legacy?.format === "itacan-imported-history-ref" ? "historical-import" : command?.type === "history.record" ? "history-record" : event.legacy !== null ? "unverifiable" : event.taskId === null ? "historical-only" : command?.type === "recurrence.complete" ? "recurrence-completion" : command?.type === "task.complete" ? "task-completion" : event.kind === "step" ? "step-completion" : ["task.create", "task.createMany"].includes(command?.type) ? "initial-completed-creation" : "unverifiable";
    const e = { eventId: event.id, operationId: event.operationId, taskId: event.taskId, stepId: event.stepId, partitionId: event.partitionId, kind: event.kind, ownerAtEvent: V.clone(event.ownerAtEvent), timestamp: event.timestamp, counted: event.counted, reopenedAt: event.reopenedAt, origin };
    const created = receipt?.result.tasks.find(t => t.id === target.taskId), completed = stepId === null ? created : created?.steps.find(s => s.id === stepId);
    const current = stepId === null ? task : task.steps.find(s => s.id === stepId);
    const genuine = origin === "task-completion" || origin === "recurrence-completion";
    const matches = receipt && created && created.partitionId === task.partitionId && same(created.owner, task.owner) && completed?.completed && completed.completedAt === event.timestamp && event.taskId === task.id && event.stepId === stepId && event.kind === (stepId === null ? "task" : "step") && event.partitionId === task.partitionId && same(event.ownerAtEvent, task.owner) && event.counted && event.reopenedAt === null && current?.completed && current.completedAt === event.timestamp && receipt.result.change.eventIds.includes(event.id) && (!genuine || command.taskId === task.id && (command.type !== "task.complete" || command.payload.completed === true));
    const creation = matches && (!atomic || effect) ? { operationId: receipt.operationId, commandType: command.type, commandTaskId: command.taskId ?? null, requestedCompletion: command.type === "task.complete" ? command.payload.completed : origin === "task-save-completion" ? true : null, repositoryRevision: receipt.result.repositoryRevision, revisionId: receipt.result.revisionId, receiptDigest: sha256(V.canonical(receipt)), createdEventId: event.id, taskAfter: { id: created.id, owner: V.clone(created.owner), partitionId: created.partitionId, completed: created.completed, completedAt: created.completedAt }, ...(version === 2 ? { atomicEffect: effect } : {}) } : null;
    return { binding: V.clone(binding), event: e, creation };
}
function operationSnapshot(state, request, storage) {
    check(state.storeId === request.authorityId, "Operation authority mismatch.");
    const partitions = state.partitions.filter(p => same(p.owner, request.owners[0]));
    check(partitions.length === 1, "Operation owner unavailable.");
    const receipt = state.receipts.find(r => r.operationId === request.operationId);
    const fenced = !!storage.fenced;
    let operation = { state: "missing", code: "RECEIPT_UNAVAILABLE", operationId: request.operationId, receipt: null, taskIds: [], eventIds: [] };
    if (fenced) operation = { ...operation, state: "unavailable", code: "RECOVERY_FENCED" };
    else if (receipt) {
        const command = JSON.parse(receipt.payload), scopes = command.coordination?.evidence?.partitions;
        const scoped = Array.isArray(scopes) && scopes.length === 1 && scopes[0].id === partitions[0].id && same(scopes[0].owner, request.owners[0]);
        operation = !scoped || sha256(receipt.payload) !== request.commandDigest
            ? { ...operation, state: "conflict", code: "OPERATION_CONFLICT" }
            : { state: "committed", code: "RECEIPT_CONFIRMED", operationId: request.operationId,
                receipt: { operationId: receipt.operationId, repositoryRevision: receipt.result.repositoryRevision, revisionId: receipt.result.revisionId },
                taskIds: receipt.result.tasks.map(t => t.id), eventIds: V.clone(receipt.result.change.eventIds) };
    }
    return freeze({ version: 3, privacy: "local-private", authorityId: state.storeId,
        head: { authorityId: state.storeId, repositoryRevision: state.revision, revisionId: state.revisionId }, logicalSchemaVersion: state.schemaVersion,
        namespaces: { recurrence: state.recurrence?.version ?? null, historyImport: state.historyImport?.version ?? null }, storage: storage.info ?? null,
        partitions: partitions.map(p => ({ id: p.id, owner: V.clone(p.owner), revision: p.revision, head: p.head })),
        readiness: { state: fenced ? "recovering" : "ready", reason: fenced ? "RECOVERY_FENCED" : "VALIDATED_NATIVE_CAPTURE" },
        recovery: { state: fenced ? "fenced" : "intact", selectedScope: fenced ? "unproven" : "unaffected" },
        tasks: [], targets: [], completions: [], cutEvidence: null, operation });
}
function projectSnapshot(state, request, storage = {}) {
    if (request.version === 4) return require("./history-read").projectHistory(state, request, storage);
    if (request.version === 3) return operationSnapshot(state, request, storage);
    check(state.storeId === request.authorityId, "Snapshot authority mismatch.");
    const partitions = state.partitions.filter(p => request.selection === "status" || request.owners.some(o => same(o, p.owner)));
    const tasks = [], targets = [], completions = [];
    const selected = t => request.owners.some(o => same(o, t.owner));
    if (request.selection === "tasks") for (const t of state.tasks) if (selected(t) && (request.includeArchived || t.archivedAt === null) && (request.includeDeleted || t.deletedAt === null)) tasks.push({ ...taskView(t), ...(request.includeConsumerFacts ? { consumerFacts: { version: 1, recurrenceMember: require("./atomic-task").recurrenceGuard(state, t).kind !== "none" } } : {}) });
    if (["targets", "completions"].includes(request.selection)) request.targets.forEach((target, index) => {
        const task = state.tasks.find(t => t.id === target.taskId), reservation = state.historyImport?.plan.reservations.find(r => r.id === target.taskId && r.kind === "task");
        let disposition = !task ? reservation?.purpose === "quarantined-target" ? "quarantined" : reservation?.purpose === "eligible-target" && state.historyImport.outcome === null ? "pending-native-publication" : state.retiredStepIds.includes(target.taskId) ? "retired-step" : state.tasks.some(t => t.steps.some(s => s.id === target.taskId)) ? "kind-mismatch" : "missing" : !same(task.owner, target.owner) || task.partitionId !== target.partitionId ? "owner-mismatch" : task.deletedAt !== null ? "deleted" : "resolved";
        const visible = task && selected(task) && same(task.owner, target.owner) && task.partitionId === target.partitionId;
        if (disposition === "resolved" && target.stepId && !task.steps.some(s => s.id === target.stepId)) disposition = state.retiredStepIds.includes(target.stepId) ? "retired-step" : "missing-step";
        targets.push({ index, taskId: target.taskId, disposition, task: visible ? taskView(task) : null, preparation: preparation(state, target) });
        if (request.selection === "completions") completions.push({ index, ...(visible && disposition === "resolved" ? completion(state, target, task, request.version) : { binding: null, event: null, creation: null }) });
    });
    const cutReceipt = request.cut && request.cut.authorityId === state.storeId && state.receipts.find(r => r.result.repositoryRevision === request.cut.repositoryRevision && r.result.revisionId === request.cut.revisionId);
    const fenced = !!storage.fenced;
    return freeze({ version: request.version, privacy: "local-private", authorityId: state.storeId, head: { authorityId: state.storeId, repositoryRevision: state.revision, revisionId: state.revisionId }, logicalSchemaVersion: state.schemaVersion, namespaces: { recurrence: state.recurrence?.version ?? null, historyImport: state.historyImport?.version ?? null }, storage: storage.info ?? null, partitions: partitions.map(p => ({ id: p.id, owner: V.clone(p.owner), revision: p.revision, head: p.head })), readiness: { state: fenced ? "recovering" : "ready", reason: fenced ? "RECOVERY_FENCED" : "VALIDATED_NATIVE_CAPTURE" }, recovery: { state: fenced ? "fenced" : "intact", selectedScope: fenced ? "unproven" : "unaffected" }, tasks, targets, completions, ...(request.selection === "editor" ? { editor: require("./editor-read").projectEditor(state, request.targets[0], { fenced }) } : {}), cutEvidence: request.cut ? { cut: V.clone(request.cut), state: cutReceipt ? "verified-current-lineage" : "unproven", receiptOperationId: cutReceipt?.operationId ?? null } : null });
}
module.exports = { validateRequest, projectSnapshot, taskView, freeze };
