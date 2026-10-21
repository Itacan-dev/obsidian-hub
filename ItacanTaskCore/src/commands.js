"use strict";
const { check, fail } = require("./errors");
const { clone, fields, text, uuid, timestamp, revision, canonical } = require("./value");
const { TASK_FIELDS, STEP_FIELDS, workspaceKey, validateTask, validateHistory, validateReferences } = require("./domain");

const CREATE_FIELDS = TASK_FIELDS.filter(key => !["revision", "partitionId"].includes(key));
const UPDATE_FIELDS = ["title", "importance", "start", "due", "description", "captureSource"];
const TYPES = ["task.create", "task.createMany", "task.update", "task.relocate", "task.complete", "task.archive", "task.delete", "step.add", "step.update", "step.reorder", "step.delete", "step.complete", "history.record", "task.editStructure", "task.save", "task.createRich"];

function validateCommand(command) {
    fields(command, ["operationId", "type", "taskId", "expectedRevision", "expectedRepositoryRevision", "payload", "context", "coordination"], ["operationId", "type", "payload"]);
    text(command.operationId, "operation ID");
    const recurrenceTypes = [...require("./recurrence").RECURRENCE_COMMANDS, ...require("./recurrence").RECURRENCE_GENERATION_COMMANDS.commands];
    if (typeof command.type === "string" && command.type.startsWith("recurrence.") && !recurrenceTypes.includes(command.type)) fail("UNSUPPORTED_OPERATION", "Unsupported recurrence operation.");
    const importCommand = require("./history-import").isImport(command.type);
    check(TYPES.includes(command.type) || recurrenceTypes.includes(command.type) || importCommand, "Unsupported command.");
    check(command.payload !== null && typeof command.payload === "object" && !Array.isArray(command.payload), "Command payload must be a record.");
    if (!["task.create", "task.createMany", "task.createRich", "history.record"].includes(command.type) && !importCommand) {
        uuid(command.taskId); revision(command.expectedRevision); check(command.expectedRevision >= 1, "Expected task revision is required.");
    } else check(command.taskId === undefined && command.expectedRevision === undefined, "Creation/history commands do not accept an existing task revision.");
    if (command.expectedRepositoryRevision !== undefined) revision(command.expectedRepositoryRevision);
    if (command.context !== undefined) {
        fields(command.context, ["workingContext", "oathId", "sessionId"]);
        if (command.context.workingContext != null) require("./domain").workspace(command.context.workingContext);
        for (const key of ["oathId", "sessionId"]) if (command.context[key] != null) text(command.context[key]);
    }
    if (command.coordination !== undefined) {
        fields(command.coordination, ["service", "id", "evidence"], ["service", "id"]); text(command.coordination.service); text(command.coordination.id);
    }
    canonical(command);
    if (command.type.startsWith("recurrence.")) require("./recurrence").validateRecurrenceCommand(command);
    if (importCommand) require("./history-import").validateCommand(command);
    if (require("./completion-effects").isAtomic(command.type)) require("./atomic-task").validateCommand(command);
}
function newTask(input, partitionId, now, nextId) {
    fields(input, CREATE_FIELDS, ["owner", "title"]);
    const id = input.id === undefined ? nextId() : input.id;
    const rawSteps = input.steps === undefined ? [] : input.steps;
    check(Array.isArray(rawSteps), "Steps must be an array.");
    const steps = rawSteps.map((step, index) => {
        fields(step, STEP_FIELDS.filter(key => key !== "taskId"));
        return { id: step.id === undefined ? nextId() : step.id, taskId: id, parentStepId: step.parentStepId ?? null, order: step.order === undefined ? index : step.order,
            title: step.title, completed: step.completed === undefined ? false : step.completed, completedAt: step.completedAt === undefined ? (step.completed ? now : null) : step.completedAt,
            createdAt: step.createdAt === undefined ? now : step.createdAt, modifiedAt: step.modifiedAt === undefined ? now : step.modifiedAt };
    });
    return { schemaVersion: input.schemaVersion === undefined ? 1 : input.schemaVersion, id, revision: 1, partitionId, owner: clone(input.owner), location: input.location ?? null,
        title: input.title, completed: input.completed === undefined ? false : input.completed, completedAt: input.completedAt === undefined ? (input.completed ? now : null) : input.completedAt,
        importance: input.importance ?? null, start: input.start ?? null, due: input.due ?? null, description: input.description === undefined ? "" : input.description, phase: input.phase ?? null,
        steps, createdAt: input.createdAt === undefined ? now : input.createdAt, modifiedAt: input.modifiedAt === undefined ? now : input.modifiedAt,
        archivedAt: input.archivedAt ?? null, deletedAt: input.deletedAt ?? null, migration: input.migration ?? null, captureSource: input.captureSource ?? null };
}

async function applyCommand(state, command, context) {
    const { now, nextId, resolvers, fault, externalReservations, recoveryReservedIds = [] } = context;
    if (require("./completion-effects").isAtomic(command.type)) return require("./atomic-task").applyAtomic(state, command, context);
    if (require("./history-import").isImport(command.type)) return require("./history-import").applyImport(state, command, context);
    if (command.type.startsWith("recurrence.")) return require("./recurrence").applyRecurrence(state, command, { now, nextId, resolvers, fault, externalReservations });
    const partitions = new Map(state.partitions.map(p => [workspaceKey(p.owner), p]));
    const taskMap = new Map(state.tasks.map(task => [task.id, task]));
    const identities = state.schemaVersion >= 2 ? require("./recurrence").nativeReservedIds(state) : new Set([...state.tasks.flatMap(task => [task.id, ...task.steps.map(step => step.id)]), ...state.retiredStepIds]);
    for (const id of recoveryReservedIds) identities.add(id);
    const touched = new Set(), partitionIds = new Set(), eventIds = [];
    const partitionFor = owner => {
        const partition = partitions.get(workspaceKey(owner)); check(!!partition, "Workspace has no registered partition."); return partition;
    };
    const reserve = id => { uuid(id); if (identities.has(id)) fail("IDENTITY_CONFLICT", "Task/Step identity is already reserved.", { id }); identities.add(id); };
    const mark = task => { touched.add(task.id); partitionIds.add(task.partitionId); };
    const { addEvent, transition } = require("./completion-transition").completionTransition(state, command, { now, nextId, reserve, eventIds });
    const create = async input => {
        fields(input, CREATE_FIELDS, ["owner", "title"]);
        const task = newTask(input, partitionFor(input.owner).id, now, nextId);
        reserve(task.id); for (const step of task.steps) reserve(step.id);
        validateTask(task); await validateReferences(task, resolvers);
        // Logical deletion is a command, never an initial creation shortcut.
        check(task.archivedAt === null && task.deletedAt === null, "New tasks cannot start archived or deleted.");
        state.tasks.push(task); taskMap.set(task.id, task); mark(task);
        if (task.completed) addEvent(task);
        for (const step of task.steps) if (step.completed) addEvent(task, step);
    };
    const payload = command.payload;
    if (command.type === "task.create") { fields(payload, ["task"], ["task"]); await create(payload.task); }
    else if (command.type === "task.createMany") {
        fields(payload, ["tasks"], ["tasks"]); check(Array.isArray(payload.tasks) && payload.tasks.length > 0, "Nonempty task batch required.");
        for (const input of payload.tasks) await create(input);
    } else if (command.type === "history.record") {
        fields(payload, ["record"], ["record"]); validateHistory(payload.record);
        check(payload.record.legacy?.format !== "itacan-imported-history-ref", "Imported provenance is reserved for prepared publication.");
        check(payload.record.taskId === null && payload.record.stepId === null && payload.record.legacy !== null, "Only explicit historical-only evidence can be appended directly.");
        check(payload.record.operationId === command.operationId && state.partitions.some(p => p.id === payload.record.partitionId), "Historical receipt or partition mismatch.");
        check(!state.history.some(record => record.id === payload.record.id), "Historical ID already exists.");
        if (state.schemaVersion >= 2) reserve(payload.record.id);
        state.history.push(clone(payload.record)); partitionIds.add(payload.record.partitionId); eventIds.push(payload.record.id);
    } else {
        const task = taskMap.get(command.taskId);
        if (!task) fail("NOT_FOUND", "Task does not exist.", { taskId: command.taskId });
        if (task.revision !== command.expectedRevision) fail("REVISION_CONFLICT", "Task changed since it was read.", { expected: command.expectedRevision, actual: task.revision });
        if (task.deletedAt !== null) fail("TASK_DELETED", "Task is logically deleted.");
        if (state.recurrence?.memberships.some(o => o.taskId === task.id) && (command.type === "task.delete" || command.type === "task.relocate" && canonical(payload.owner) !== canonical(task.owner))) fail("UNSUPPORTED_OPERATION", "Recurring-occurrence deletion/owner transfer is deferred; no partial lifecycle transition.");
        const previous = canonical(task), previousTask = clone(task), previousPartition = task.partitionId;
        let contentIntent;
        if (command.type === "task.update") {
            fields(payload, ["patch"], ["patch"]); fields(payload.patch, UPDATE_FIELDS); Object.assign(task, clone(payload.patch));
        } else if (command.type === "task.relocate") {
            fields(payload, ["owner", "location", "phase"], ["owner", "location", "phase"]);
            task.owner = clone(payload.owner); task.location = clone(payload.location); task.phase = clone(payload.phase); task.partitionId = partitionFor(task.owner).id;
        } else if (command.type === "task.complete") {
            if (payload.completed === true && require("./recurrence-generation").preparedMember(state, task.id)) fail("RECURRENCE_COMMAND_REQUIRED", "Prepared occurrences require recurrence.complete.");
            fields(payload, ["completed", "completedAt"], ["completed"]); transition(task, null, payload.completed, payload.completedAt);
        } else if (command.type === "task.archive") {
            fields(payload, ["archived"], ["archived"]); check(typeof payload.archived === "boolean", "Archived must be boolean.");
            if (payload.archived && task.archivedAt === null) task.archivedAt = now;
            if (!payload.archived) task.archivedAt = null;
        } else if (command.type === "task.delete") {
            fields(payload, []); task.deletedAt = now; state.bindings = state.bindings.filter(b => b.taskId !== task.id);
        } else if (command.type === "task.editStructure") {
            const edited = await require("./structural-edit").applyStructuralEdit({ task, payload, now, reserve, fault });
            contentIntent = edited.current;
            state.retiredStepIds.push(...edited.removed);
            state.bindings = state.bindings.filter(binding => binding.taskId !== task.id || !edited.removed.has(binding.stepId));
        } else if (command.type === "step.add") {
            fields(payload, ["step"], ["step"]); fields(payload.step, ["id", "parentStepId", "order", "title", "completed", "completedAt", "createdAt", "modifiedAt"], ["order", "title"]);
            const s = payload.step, step = { id: s.id === undefined ? nextId() : s.id, taskId: task.id, parentStepId: s.parentStepId ?? null, order: s.order, title: s.title,
                completed: s.completed === undefined ? false : s.completed, completedAt: s.completedAt === undefined ? (s.completed ? now : null) : s.completedAt,
                createdAt: s.createdAt === undefined ? now : s.createdAt, modifiedAt: s.modifiedAt === undefined ? now : s.modifiedAt };
            reserve(step.id); task.steps.push(step); if (step.completed) addEvent(task, step);
        } else if (command.type === "step.reorder") {
            fields(payload, ["parentStepId", "stepIds"], ["parentStepId", "stepIds"]);
            check(payload.parentStepId === null || task.steps.some(s => s.id === payload.parentStepId), "Invalid parent Step.");
            const siblings = task.steps.filter(s => s.parentStepId === payload.parentStepId);
            check(Array.isArray(payload.stepIds) && payload.stepIds.length === siblings.length && new Set(payload.stepIds).size === siblings.length && siblings.every(s => payload.stepIds.includes(s.id)), "Reorder must contain exactly the current siblings.");
            const byId = new Map(siblings.map(s => [s.id, s])); payload.stepIds.forEach((id, order) => {
                const step = byId.get(id); if (step.order !== order) { step.order = order; step.modifiedAt = now; }
            });
        } else {
            fields(payload, command.type === "step.update" ? ["stepId", "patch"] : command.type === "step.delete" ? ["stepId", "cascade"] : ["stepId", "completed", "completedAt"], ["stepId"]);
            const step = task.steps.find(s => s.id === payload.stepId); if (!step) fail("NOT_FOUND", "Step does not exist.");
            const stepBefore = canonical(step);
            if (command.type === "step.update") {
                fields(payload.patch, ["title", "parentStepId", "order"]); Object.assign(step, clone(payload.patch));
            } else if (command.type === "step.complete") transition(task, step, payload.completed, payload.completedAt);
            else {
                check(payload.cascade === undefined || typeof payload.cascade === "boolean", "Invalid cascade flag.");
                const removed = new Set([step.id]); let grew = true;
                while (grew) { grew = false; for (const s of task.steps) if (removed.has(s.parentStepId) && !removed.has(s.id)) { removed.add(s.id); grew = true; } }
                check(removed.size === 1 || payload.cascade === true, "Deleting a parent Step requires explicit cascade.");
                task.steps = task.steps.filter(s => !removed.has(s.id)); state.retiredStepIds.push(...removed);
                state.bindings = state.bindings.filter(b => b.taskId !== task.id || !removed.has(b.stepId));
            }
            if (task.steps.includes(step) && canonical(step) !== stepBefore) step.modifiedAt = now;
        }
        if (contentIntent || canonical(task) !== previous) {
            task.revision++; task.modifiedAt = now;
            require("./source-content").finishContentRevision(task, previousTask, command.operationId, contentIntent);
            mark(task);
        }
        validateTask(task); await validateReferences(task, resolvers);
        partitionIds.add(previousPartition); partitionIds.add(task.partitionId);
    }
    return { taskIds: [...touched].sort(), partitionIds: [...partitionIds].sort(), eventIds };
}
module.exports = { validateCommand, applyCommand, newTask };
