"use strict";
const { check, fail } = require("./errors");
const { fields, text, referenceId, uuid, timestamp, revision, jsonValue, canonical, clone } = require("./value");
const SCHEMA_VERSION = 1;
const TASK_FIELDS = ["schemaVersion", "id", "revision", "partitionId", "owner", "location", "title", "completed", "completedAt", "importance", "start", "due", "description", "phase", "steps", "createdAt", "modifiedAt", "archivedAt", "deletedAt", "migration", "captureSource"];
const STEP_FIELDS = ["id", "taskId", "parentStepId", "order", "title", "completed", "completedAt", "createdAt", "modifiedAt"];
const HISTORY_FIELDS = ["id", "operationId", "partitionId", "kind", "taskId", "stepId", "timestamp", "recordedAt", "ownerAtEvent", "workingContext", "oathId", "sessionId", "snapshot", "counted", "reopenedAt", "legacy"];
const workspaceKey = ref => canonical(ref);
const sameOwner = (a, b) => a?.type === b?.type && a?.id === b?.id;

function workspace(ref) {
    fields(ref, ["type", "id"], ["type", "id"]);
    check(["project", "resource"].includes(ref.type), "Invalid workspace type."); referenceId(ref.id);
}
function location(ref) {
    if (ref === null) return;
    fields(ref, ["type", "id"], ["type", "id"]);
    check(["folder", "note"].includes(ref.type), "Invalid location type."); referenceId(ref.id);
}
function dateEndpoint(value) {
    if (value === null) return;
    fields(value, ["date", "time"], ["date", "time"]);
    const m = typeof value.date === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);
    check(!!m, "Invalid local calendar date.");
    const y = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    check(y >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1], "Invalid local calendar date.");
    check(value.time === null || typeof value.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time), "Invalid local time.");
}
function contentTitle(value) { check(typeof value === "string" && !!value.trim() && !/[\r\n]/.test(value), "A nonempty single-line title is required."); }
function phase(value, owner) {
    if (value === null) return;
    fields(value, ["projectId", "phaseId"], ["projectId", "phaseId"]); referenceId(value.projectId); referenceId(value.phaseId);
    check(owner.type === "project" && owner.id === value.projectId, "Phase must belong to the owning Project.");
}
function validateSteps(steps, taskId) {
    check(Array.isArray(steps), "Steps must be an array.");
    const byId = new Map(), orders = new Set();
    for (const step of steps) {
        fields(step, STEP_FIELDS, STEP_FIELDS); uuid(step.id); uuid(step.taskId);
        check(step.taskId === taskId, "Step belongs to a different task.");
        check(!byId.has(step.id), "Duplicate Step ID."); byId.set(step.id, step);
        check(step.parentStepId === null || typeof step.parentStepId === "string", "Invalid Step parent.");
        if (step.parentStepId !== null) uuid(step.parentStepId);
        check(Number.isSafeInteger(step.order) && step.order >= 0, "Invalid Step ordering.");
        const orderKey = `${step.parentStepId}:${step.order}`;
        check(!orders.has(orderKey), "Duplicate sibling ordering."); orders.add(orderKey);
        contentTitle(step.title); check(typeof step.completed === "boolean", "Invalid Step completion.");
        for (const key of ["completedAt", "createdAt", "modifiedAt"]) timestamp(step[key]);
        check(step.completed || step.completedAt === null, "An open Step cannot have a completion time.");
    }
    const done = new Set();
    for (const step of steps) {
        let current = step; const visiting = new Set();
        while (current && !done.has(current.id)) {
            check(!visiting.has(current.id), "Cyclic Step ancestry."); visiting.add(current.id);
            if (current.parentStepId === null) break;
            check(byId.has(current.parentStepId), "Missing Step parent."); current = byId.get(current.parentStepId);
        }
        for (const id of visiting) done.add(id);
    }
}
function validateTask(task) {
    fields(task, TASK_FIELDS, TASK_FIELDS);
    if (task.schemaVersion !== SCHEMA_VERSION) fail("UNSUPPORTED_SCHEMA", "Unsupported task schema.");
    uuid(task.id); revision(task.revision); check(task.revision >= 1, "Task revision starts at one."); text(task.partitionId);
    workspace(task.owner); location(task.location); contentTitle(task.title);
    check(typeof task.completed === "boolean", "Invalid task completion.");
    for (const key of ["completedAt", "createdAt", "modifiedAt", "archivedAt", "deletedAt"]) timestamp(task[key]);
    check(task.completed || task.completedAt === null, "An open task cannot have a completion time.");
    check([null, "should", "must"].includes(task.importance), "Invalid importance.");
    dateEndpoint(task.start); dateEndpoint(task.due);
    if (task.start && task.due) check(task.start.date < task.due.date || task.start.date === task.due.date &&
        (task.start.time ?? "00:00") <= (task.due.time ?? "23:59"), "Due must be on or after Start.");
    check(typeof task.description === "string", "Invalid description."); phase(task.phase, task.owner); validateSteps(task.steps, task.id);
    if (task.migration !== null) { fields(task.migration, ["source", "sourceId", "importedAt", "evidence"], ["source", "sourceId", "importedAt", "evidence"]); text(task.migration.source); text(task.migration.sourceId); timestamp(task.migration.importedAt); jsonValue(task.migration.evidence); }
    require("./source-content").validatePrivateContent(task);
    if (task.captureSource !== null) {
        fields(task.captureSource, ["origin", "workspaceId", "workspaceName", "path", "title", "url"]);
        check(Object.values(task.captureSource).every(value => typeof value === "string"), "Invalid capture provenance.");
    }
}
function validatePartition(partition) {
    fields(partition, ["id", "kind", "owner", "revision", "head", "parentHead"], ["id", "kind", "owner", "revision", "head", "parentHead"]);
    referenceId(partition.id); workspace(partition.owner); revision(partition.revision);
    check(["private-project", "git-project", "resource"].includes(partition.kind), "Invalid partition kind.");
    check((partition.kind === "resource") === (partition.owner.type === "resource"), "Partition/owner classification conflict.");
    for (const key of ["head", "parentHead"]) if (partition[key] !== null) uuid(partition[key]);
    check((partition.revision === 0) === (partition.head === null), "Partition revision/head mismatch.");
    check(partition.revision > 1 || partition.parentHead === null, "Invalid initial partition ancestry.");
    check(partition.revision <= 1 || partition.parentHead !== null, "Missing partition ancestry.");
    check(partition.head === null || partition.head !== partition.parentHead, "Partition cannot parent itself.");
}
function validateHistory(record) {
    fields(record, HISTORY_FIELDS, HISTORY_FIELDS); uuid(record.id); text(record.operationId); text(record.partitionId);
    check(["task", "step"].includes(record.kind), "Invalid history kind.");
    if (record.taskId !== null) uuid(record.taskId);
    if (record.stepId !== null) uuid(record.stepId);
    check(record.kind === "step" || record.stepId === null, "Task history cannot reference a Step.");
    check(record.stepId === null || record.taskId !== null, "Step history needs a parent task ID.");
    timestamp(record.timestamp); timestamp(record.recordedAt); timestamp(record.reopenedAt);
    if (record.ownerAtEvent !== null) workspace(record.ownerAtEvent);
    if (record.workingContext !== null) workspace(record.workingContext);
    for (const key of ["oathId", "sessionId"]) if (record[key] !== null) text(record[key]);
    fields(record.snapshot, ["title", "parentTitle"], ["title", "parentTitle"]); contentTitle(record.snapshot.title);
    check(record.snapshot.parentTitle === null || typeof record.snapshot.parentTitle === "string", "Invalid parent title snapshot.");
    check(typeof record.counted === "boolean", "Invalid completion counting state.");
    check(record.reopenedAt === null || !record.counted, "Reopened evidence cannot remain counted."); jsonValue(record.legacy);
}
function validateState(state) {
    if (![1, 2, 3, 4].includes(state.schemaVersion)) fail("UNSUPPORTED_SCHEMA", "Unsupported repository schema.");
    if (state.schemaVersion >= 2 && state.schemaVersion <= 3 && state.recurrence?.version !== state.schemaVersion - 1 || state.schemaVersion === 1 && Object.hasOwn(state, "recurrence") || state.schemaVersion === 4 && Object.hasOwn(state, "recurrence") && ![1, 2].includes(state.recurrence?.version)) fail("UNSUPPORTED_SCHEMA", "Unsupported recurrence namespace; refusing downgrade.");
    if (state.schemaVersion === 4 && (!state.historyImport || state.historyImport.version !== 1 || state.historyImport.format !== "itacan-private-history-import" || canonical(state.historyImport.requiredCapabilities ?? null) !== canonical(["private-history-import-v1"]))) fail("UNSUPPORTED_SCHEMA", "Missing/unsupported private import capability.");
    const stateFields = ["schemaVersion", "storeId", "revision", "revisionId", "parentRevisionId", "partitions", "tasks", "history", "bindings", "receipts", "retiredStepIds", ...(Object.hasOwn(state, "recurrence") ? ["recurrence"] : []), ...(state.schemaVersion === 4 ? ["historyImport"] : [])];
    fields(state, stateFields, stateFields);
    uuid(state.storeId); revision(state.revision); uuid(state.revisionId);
    if (state.parentRevisionId !== null) uuid(state.parentRevisionId);
    check((state.revision === 0) === (state.parentRevisionId === null), "Repository ancestry mismatch.");
    check(state.revisionId !== state.parentRevisionId, "Repository cannot parent itself.");
    for (const key of ["partitions", "tasks", "history", "bindings", "receipts", "retiredStepIds"]) check(Array.isArray(state[key]), `Invalid ${key} collection.`);
    const partitions = new Map(), owners = new Set(), identities = new Set(), taskMap = new Map();
    for (const p of state.partitions) {
        validatePartition(p); check(!partitions.has(p.id) && !owners.has(workspaceKey(p.owner)), "Duplicate partition or workspace.");
        partitions.set(p.id, p); owners.add(workspaceKey(p.owner));
    }
    const reserve = id => { check(!identities.has(id), "Duplicate task/Step identity."); identities.add(id); };
    for (const task of state.tasks) {
        validateTask(task); reserve(task.id); taskMap.set(task.id, task);
        check(sameOwner(partitions.get(task.partitionId)?.owner, task.owner), "Task is in the wrong partition.");
        for (const step of task.steps) reserve(step.id);
    }
    for (const id of state.retiredStepIds) { uuid(id); reserve(id); }
    const history = new Map();
    for (const record of state.history) {
        validateHistory(record); check(!history.has(record.id), "Duplicate history ID."); history.set(record.id, record);
        check(partitions.has(record.partitionId), "Unknown history partition.");
        check(record.ownerAtEvent === null || sameOwner(partitions.get(record.partitionId).owner, record.ownerAtEvent), "History owner/partition mismatch.");
    }
    const bound = new Set(), boundEvents = new Set();
    for (const binding of state.bindings) {
        fields(binding, ["taskId", "stepId", "eventId"], ["taskId", "stepId", "eventId"]); uuid(binding.taskId); uuid(binding.eventId);
        if (binding.stepId !== null) uuid(binding.stepId);
        const targetId = binding.stepId ?? binding.taskId, task = taskMap.get(binding.taskId), event = history.get(binding.eventId);
        const target = binding.stepId === null ? task : task?.steps.find(step => step.id === binding.stepId);
        check(!!target?.completed && task.deletedAt === null, "Binding has no live completed target.");
        check(event?.counted && event.taskId === binding.taskId && event.stepId === binding.stepId && event.kind === (binding.stepId === null ? "task" : "step") && event.timestamp === target.completedAt, "Invalid completion binding.");
        check(!bound.has(targetId) && !boundEvents.has(binding.eventId), "Duplicate completion binding."); bound.add(targetId); boundEvents.add(binding.eventId);
    }
    for (const task of state.tasks) if (task.deletedAt === null) for (const target of [task, ...task.steps]) {
        check(!target.completed || bound.has(target.id), "Completed live target is missing its binding.");
    }
    const operations = new Set(), receiptRevisions = new Set();
    for (const receipt of state.receipts) {
        fields(receipt, ["operationId", "payload", "result", "partitionIds", "coordination"], ["operationId", "payload", "result", "partitionIds", "coordination"]);
        text(receipt.operationId); check(!operations.has(receipt.operationId), "Duplicate operation receipt."); operations.add(receipt.operationId);
        check(typeof receipt.payload === "string", "Invalid receipt payload.");
        let command; try { command = JSON.parse(receipt.payload); } catch (_) { fail("VALIDATION", "Invalid receipt JSON."); }
        check(canonical(command) === receipt.payload && command.operationId === receipt.operationId, "Receipt identity/payload mismatch.");
        check(Array.isArray(receipt.partitionIds) && new Set(receipt.partitionIds).size === receipt.partitionIds.length && receipt.partitionIds.every(id => partitions.has(id)), "Invalid receipt partitions.");
        const result = receipt.result;
        fields(result, ["operationId", "repositoryRevision", "revisionId", "taskId", "taskRevision", "task", "tasks", "change", "replayed", "recurrence", "historyImport", "atomicTask"], ["operationId", "repositoryRevision", "revisionId", "taskId", "taskRevision", "task", "tasks", "change", "replayed"]);
        check(require("./completion-effects").isAtomic(command.type) === Object.hasOwn(result, "atomicTask"), "Atomic task receipt discriminator mismatch.");
        check(require("./history-import").isImport(command.type) === Object.hasOwn(result, "historyImport") && (!result.historyImport || state.schemaVersion === 4), "Import receipt discriminator/barrier mismatch.");
        check(command.type.startsWith("recurrence.") === Object.hasOwn(result, "recurrence"), "Recurrence receipt discriminator mismatch.");
        check(!command.type.startsWith("recurrence.") || state.schemaVersion >= 2, "Recurrence receipts cannot be downcast into schema 1.");
        check(result.operationId === receipt.operationId && Number.isSafeInteger(result.repositoryRevision) && result.repositoryRevision >= 1 && result.repositoryRevision <= state.revision, "Invalid receipt result.");
        uuid(result.revisionId); check(!receiptRevisions.has(result.repositoryRevision), "Duplicate receipt revision."); receiptRevisions.add(result.repositoryRevision);
        check(result.replayed === false && Array.isArray(result.tasks), "Invalid stored acknowledgment.");
        result.tasks.forEach(validateTask);
        if (result.task !== null) { validateTask(result.task); check(result.taskId === result.task.id && result.taskRevision === result.task.revision, "Receipt task snapshot mismatch."); }
        else check(result.taskId === null && result.taskRevision === null, "Receipt has no task snapshot.");
        fields(result.change, ["type", "operationId", "repositoryRevision", "taskIds", "eventIds", "partitions"], ["type", "operationId", "repositoryRevision", "taskIds", "eventIds", "partitions"]);
        check(result.change.type === command.type && result.change.operationId === receipt.operationId && result.change.repositoryRevision === result.repositoryRevision, "Receipt change mismatch.");
        check(Array.isArray(result.change.taskIds) && canonical([...result.change.taskIds].sort()) === canonical(result.tasks.map(task => task.id).sort()), "Receipt affected-task mismatch.");
        check(Array.isArray(result.change.eventIds) && Array.isArray(result.change.partitions), "Invalid receipt change collections.");
        result.change.eventIds.forEach(uuid); result.change.partitions.forEach(validatePartition);
        check(canonical(result.change.partitions.map(p => p.id).sort()) === canonical([...receipt.partitionIds].sort()), "Receipt partition change mismatch.");
        check(canonical(receipt.coordination) === canonical(command.coordination ?? null), "Receipt coordination mismatch.");
        jsonValue(result); jsonValue(receipt.coordination);
    }
    check(receiptRevisions.size === state.revision, "Repository revisions are missing their durable receipts.");
    require("./source-content").validateContentContinuity(state);
    require("./completion-effects").validateState(state);
    if (state.recurrence) require("./recurrence").validateNamespace(state);
    if (state.schemaVersion === 4) require("./history-import").validateNamespace(state);
    require("./history-import").rejectUnplannedReferences(state);
    jsonValue(state);
}
async function validateReferences(task, resolvers = {}) {
    if (task.location !== null) {
        if (!resolvers.location) fail("REFERENCE_UNRESOLVED", "A location resolver is required for a non-root location.");
        const resolved = await resolvers.location(clone(task.location));
        check(resolved?.id === task.location.id && resolved?.type === task.location.type && sameOwner(resolved.owner, task.owner), "Location is missing or belongs to another workspace.");
    }
    if (task.phase !== null) {
        if (!resolvers.phase) fail("REFERENCE_UNRESOLVED", "A Phase resolver is required for a Phase assignment.");
        const resolved = await resolvers.phase(clone(task.phase));
        check(resolved?.projectId === task.phase.projectId && resolved?.phaseId === task.phase.phaseId, "Phase is missing or invalid.");
    }
}
module.exports = { SCHEMA_VERSION, TASK_FIELDS, STEP_FIELDS, HISTORY_FIELDS, workspace, location, phase, workspaceKey, sameOwner, dateEndpoint, validateSteps, validateTask, validatePartition, validateHistory, validateState, validateReferences };
