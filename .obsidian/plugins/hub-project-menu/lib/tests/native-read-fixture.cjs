"use strict";
// Test-only deterministic memory snapshots. No repository, filesystem, platform or startup imports.
const { validateTask, validateHistory } = require("../../../../../ItacanTaskCore/src/domain");
const { TaskService, TASK_SERVICE_OPERATIONS } = require("../services/task-service");
const { TaskServiceError } = require("../services/task-service-errors");
const { READ_FEATURES, READ_OPERATIONS } = require("../services/task-read-contract");
const clone = value => JSON.parse(JSON.stringify(value));
const id = n => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const sameOwner = (a, b) => a?.type === b?.type && a?.id === b?.id;
const owners = {
    private: { type: "project", id: "private" }, itacan: { type: "project", id: "itacan" }, hub: { type: "project", id: "hub" },
    shelved: { type: "project", id: "shelved" },
    knowledge: { type: "resource", id: "study" }, research: { type: "resource", id: "literature" },
    explorations: { type: "resource", id: "references" }, inspiration: { type: "resource", id: "inspiration" }
};
const clock = Date.parse("2026-10-17T10:00:00+02:00");
function nativeTask(n, owner, patch = {}) {
    return { schemaVersion: 1, id: id(n), revision: 1, partitionId: owner.type + "-" + owner.id,
        owner: clone(owner), location: null, title: "Task " + n, description: "", completed: false, completedAt: null,
        importance: null, start: null, due: null, phase: null, steps: [], createdAt: null, modifiedAt: null,
        archivedAt: null, deletedAt: null, migration: null, captureSource: null, ...patch };
}
function dataset() {
    const steps = [
        { id: id(101), taskId: id(1), parentStepId: null, order: 0, title: "Direct", completed: false, completedAt: null, createdAt: null, modifiedAt: null },
        { id: id(102), taskId: id(1), parentStepId: id(101), order: 0, title: "Nested", completed: true, completedAt: null, createdAt: null, modifiedAt: null },
        { id: id(103), taskId: id(1), parentStepId: null, order: 1, title: "Sibling", completed: false, completedAt: null, createdAt: null, modifiedAt: null }
    ];
    const tasks = [
        nativeTask(1, owners.private, { title: "Same title", steps, description: "Explicit description", importance: "must", due: { date: "2026-10-17", time: "00:00" } }),
        nativeTask(2, owners.private, { title: "Same title", start: { date: "2026-11-01", time: null }, importance: "should" }),
        nativeTask(3, owners.private, { completed: true, completedAt: clock - 5000 }),
        nativeTask(4, owners.itacan, { location: { type: "folder", id: "folder-itacan" }, phase: { projectId: "itacan", phaseId: "phase-itacan" }, due: { date: "2026-10-18", time: null } }),
        nativeTask(5, owners.hub, { location: { type: "note", id: "note-hub" } }),
        nativeTask(6, owners.knowledge), nativeTask(7, owners.research), nativeTask(8, owners.explorations), nativeTask(9, owners.inspiration),
        nativeTask(10, owners.private, { deletedAt: clock - 1000, completed: true, completedAt: null }),
        nativeTask(11, owners.private, { location: { type: "folder", id: "missing-folder" } }),
        nativeTask(12, owners.shelved),
        nativeTask(13, owners.private, { archivedAt: clock - 1000 }),
        nativeTask(14, owners.private, { completed: true, completedAt: null })
    ];
    const event = (n, patch = {}) => ({
        id: id(n), operationId: "fixture-event-" + n, partitionId: "project-itacan", kind: "task",
        taskId: id(3), stepId: null, timestamp: clock - 5000, recordedAt: clock - 4000,
        ownerAtEvent: clone(owners.itacan), workingContext: clone(owners.private), oathId: null, sessionId: null,
        snapshot: { title: "Original recorded title", parentTitle: null }, counted: true, reopenedAt: null, legacy: null, ...patch
    });
    const history = [
        event(201, { counted: false, reopenedAt: clock - 6000, timestamp: clock - 7000 }),
        event(202),
        event(203, { kind: "step", taskId: id(1), stepId: id(102), snapshot: { title: "Recorded nested", parentTitle: "Recorded parent" } }),
        event(204, { taskId: id(10), timestamp: null, ownerAtEvent: owners.research, partitionId: "resource-literature" }),
        event(205, { taskId: null, ownerAtEvent: null, partitionId: "project-private", legacy: { source: "explicit historical-only fixture" }, timestamp: null })
    ];
    tasks.forEach(validateTask); history.forEach(validateHistory);
    return { tasks, history, workspaces: Object.values(owners).map(owner => ({ owner, status: owner.id === "shelved" ? "shelved" : "active", available: true })),
        locations: [
            { type: "folder", id: "folder-itacan", owner: owners.itacan },
            { type: "note", id: "note-hub", owner: owners.hub }
        ], provenance: [] };
}
function taskView(record) {
    validateTask(record);
    return clone({ kind: "native-task-read", handle: { kind: "native", id: record.id }, id: record.id, revision: record.revision,
        owner: record.owner, location: record.location, title: record.title, description: record.description,
        completed: record.completed, completedAt: record.completedAt, importance: record.importance, start: record.start, due: record.due,
        phase: record.phase, archivedAt: record.archivedAt, deletedAt: record.deletedAt,
        presentation: { state: "unresolved", reason: "Native record has no legacy page Project presentation evidence." },
        steps: record.steps.map(step => ({ kind: "native-step-read", id: step.id, taskId: step.taskId,
            parentStepId: step.parentStepId, order: step.order, title: step.title, completed: step.completed, completedAt: step.completedAt })) });
}
function eventView(record) {
    validateHistory(record);
    return clone({ kind: "native-history-event", eventId: record.id, targetKind: record.kind, taskId: record.taskId,
        stepId: record.stepId, operationId: record.operationId, partitionId: record.partitionId, timestamp: record.timestamp,
        recordedAt: record.recordedAt, ownerAtEvent: record.ownerAtEvent, workingContext: record.workingContext,
        snapshot: record.snapshot, counted: record.counted, reopenedAt: record.reopenedAt,
        relationship: record.taskId === null ? "historical-only" : "native-target", legacy: record.legacy });
}
function validateSnapshot(data) {
    const partitions = new Map(data.workspaces.map(context => [context.owner.type + "-" + context.owner.id, context.owner]));
    const ids = new Set(), events = new Set();
    for (const task of data.tasks) {
        validateTask(task);
        if (!sameOwner(partitions.get(task.partitionId), task.owner)) throw Error("Fixture task owner/partition mismatch.");
        for (const item of [task, ...task.steps]) {
            if (ids.has(item.id)) throw Error("Fixture global task/Step identity conflict.");
            ids.add(item.id);
        }
    }
    for (const event of data.history) {
        validateHistory(event);
        if (!partitions.has(event.partitionId) || event.ownerAtEvent && !sameOwner(partitions.get(event.partitionId), event.ownerAtEvent))
            throw Error("Fixture historical owner/partition mismatch.");
        if (events.has(event.id)) throw Error("Fixture historical event identity conflict.");
        events.add(event.id);
    }
    // No bindings/receipts/repository are constructed. Current-binding import remains explicitly unsupported.
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
class SyntheticNativeAdapter {
    #data; #listeners = new Set(); #closed = false; #state; #unsupported; #features; #gate = null; #error = null;
    counts = { reads: 0, notifications: 0 };
    constructor({ data = dataset(), state = "ready", unsupportedOperations = [], unsupportedFeatures = [] } = {}) {
        this.#data = clone(data); this.#state = state; this.#unsupported = new Set(unsupportedOperations); this.#features = new Set(unsupportedFeatures);
        validateSnapshot(this.#data);
    }
    #open() { if (this.#closed) throw new TaskServiceError("CLOSED", "Synthetic adapter is closed."); }
    capabilities() {
        this.#open();
        return { backend: "native", guarantees: { durableRevisions: false, atomicTaskHistory: false, persistentIdempotency: false,
            nativeLocations: false, portableSharing: false, existingGitSharing: false, crossWorkspaceRelocation: false,
            creationRetry: "unsupported", completion: "unsupported", notifications: "invalidation" },
            operations: Object.fromEntries(TASK_SERVICE_OPERATIONS.map(name => [name, false])),
            restrictions: ["Test-only memory read protocol; no production routing, writes, persistence or migration guarantees."] };
    }
    readiness() {
        this.#open();
        const features = Object.fromEntries(READ_FEATURES.map(key => [key, { state: "unsupported", reason: "Not implemented by this memory read fixture." }]));
        for (const key of ["hierarchy", "physical-owner", "recorded-attribution", "navigation", "completion", "lifecycle", "stable-id",
            "oath-candidates", "oath-committed", "history", "invalidation", "source-independent"]) features[key] = { state: "supported" };
        features.presentation = { state: "conditional", reason: "Explicit native Home presentation policy is unresolved." };
        features["history-counting"] = { state: "conditional", reason: "Native counted flag is readable; imported bindings/legacy Statistics parity are unsupported." };
        for (const key of this.#features) features[key] = { state: "unsupported", reason: "Explicitly absent in this partial adapter." };
        const operationFeature = { candidates: "oath-candidates", committed: "oath-committed", history: "history", navigation: "navigation" };
        for (const operation of this.#unsupported) if (operationFeature[operation])
            features[operationFeature[operation]] = { state: "unsupported", reason: "Corresponding read operation is absent." };
        const dependencies = { structured: ["hierarchy", "physical-owner", "completion"], candidates: ["oath-candidates"],
            committed: ["oath-committed"], history: ["history"], navigation: ["navigation"], target: ["stable-id"] };
        const operations = Object.fromEntries(READ_OPERATIONS.map(op => [op,
            this.#unsupported.has(op) || dependencies[op].some(key => features[key].state === "unsupported") ?
                { state: "unsupported", reason: "This read operation is explicitly absent." } : { state: "supported" }]));
        return { backend: "native", state: this.#state, reason: this.#state === "ready" ? "Synthetic memory snapshot ready; no Dataview required." : "Synthetic backend " + this.#state + ".",
            capabilities: { backend: "native", operations, features } };
    }
    subscribe() { throw new TaskServiceError("UNSUPPORTED", "Use the explicit ephemeral read invalidation channel."); }
    subscribeReads(listener) { this.#open(); this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
    get listenerCount() { return this.#listeners.size; }
    notificationErrors = [];
    invalidate() { this.#open(); for (const listener of [...this.#listeners]) { this.counts.notifications++;
        try { listener({ backend: "native", kind: "snapshot-invalidated", durability: "ephemeral" }); }
        catch (error) { this.notificationErrors.push(error.message); } } }
    setState(state) { this.#open(); this.#state = state; this.invalidate(); }
    failNext(error = new TaskServiceError("READ_FAILED", "Controlled fixture failure.")) { this.#error = error; }
    deferNext() { const entered = deferred(), released = deferred(); this.#gate = { entered, released }; return { entered: entered.promise, release: released.resolve }; }
    replaceRecord(record) { this.#open(); validateTask(record); const index = this.#data.tasks.findIndex(task => task.id === record.id);
        if (index < 0 || record.revision !== this.#data.tasks[index].revision + 1) throw Error("Fixture replacement requires next revision.");
        const candidate = { ...this.#data, tasks: this.#data.tasks.map((task, position) => position === index ? clone(record) : task) };
        validateSnapshot(candidate); this.#data = candidate; this.invalidate(); }
    snapshot() { return clone(this.#data); }
    async read(request) {
        this.#open(); this.counts.reads++;
        if (this.#error) { const error = this.#error; this.#error = null; throw error; }
        const ready = this.readiness();
        if (ready.capabilities.operations[request.operation]?.state !== "supported") return this.#failure(request, "unsupported", "CAPABILITY_UNSUPPORTED");
        if (ready.state !== "ready") return this.#failure(request, "unavailable", "BACKEND_" + ready.state.toUpperCase());
        const result = this.#read(request), gate = this.#gate; this.#gate = null;
        if (gate) { gate.entered.resolve(); await gate.released.promise; }
        this.#open(); return clone(result);
    }
    #failure(request, status, code) { return { backend: "native", operation: request.operation, status, code, reason: "Explicit synthetic read limitation." }; }
    #read(request) {
        const base = { backend: "native", operation: request.operation, status: "ok" };
        const find = handle => {
            if (handle?.kind !== "native" || typeof handle.id !== "string") throw new TaskServiceError("VALIDATION", "Native handle required; no alias conversion.");
            return this.#data.tasks.find(task => task.id === handle.id);
        };
        if (request.operation === "structured") return { ...base, consistency: "native-records", rows: this.#data.tasks
            .filter(task => (!request.owner || sameOwner(task.owner, request.owner)) && (request.includeDeleted || task.deletedAt === null) &&
                (request.includeArchived || task.archivedAt === null)).map(taskView) };
        if (request.operation === "candidates") {
            const workspace = this.#data.workspaces.find(context => sameOwner(context.owner, request.workspace));
            if (!workspace?.available || workspace.owner.type === "project" && workspace.status !== "active") return this.#failure(request, "unavailable", "WORKSPACE_UNAVAILABLE");
            return { ...base, workspace: request.workspace, rows: this.#data.tasks.filter(task => sameOwner(task.owner, request.workspace) &&
                !task.completed && task.deletedAt === null && task.archivedAt === null).map(taskView) };
        }
        if (request.operation === "committed") return { ...base, workspace: request.workspace, rows: request.references.map(reference => {
            if (reference.kind === "legacy-id") return { reference, state: "unsupported-alias", task: null };
            const task = find(reference);
            if (!task) return { reference, state: "missing", task: null };
            if (!sameOwner(task.owner, request.workspace)) return { reference, state: "owner-mismatch", task: null };
            return { reference, state: task.deletedAt === null ? "resolved" : "deleted", task: taskView(task) };
        }) };
        if (request.operation === "history") {
            if (!["retained", "counted"].includes(request.selection)) return this.#failure(request, "unsupported", "HISTORY_LINEAGE_UNSUPPORTED");
            return { ...base, selection: request.selection, counting: "native-counted-flag; not legacy Statistics parity",
                rows: this.#data.history.filter(event => request.selection === "retained" || event.counted).map(eventView) };
        }
        if (request.operation === "target") {
            const task = find(request.handle), step = task?.steps.find(item => item.id === request.stepId);
            return { ...base, state: !task ? "missing" : task.deletedAt !== null ? "deleted" : request.stepId && !step ? "missing-step" : "resolved",
                task: task ? taskView(task) : null, step: step ? taskView(task).steps.find(item => item.id === step.id) : null };
        }
        if (request.operation === "navigation") {
            const task = find(request.handle);
            if (!task || task.deletedAt !== null) return { ...base, state: task ? "deleted-task" : "none", target: null };
            if (request.mode === "task") return { ...base, state: "available", target: { kind: "native-task", id: task.id } };
            if (request.mode === "provenance") {
                const evidence = this.#data.provenance.find(item => item.taskId === task.id);
                return { ...base, state: evidence ? "available" : "none", target: evidence ? { kind: "historical-provenance", source: clone(evidence.source) } : null };
            }
            if (request.mode !== "location") throw new TaskServiceError("VALIDATION", "Unknown navigation mode.");
            const location = task.location && this.#data.locations.find(item => item.id === task.location.id && item.type === task.location.type && sameOwner(item.owner, task.owner));
            return { ...base, state: !task.location ? "none" : location ? "available" : "missing-location",
                target: location ? { kind: "native-location", owner: task.owner, location: task.location } : null };
        }
        throw new TaskServiceError("VALIDATION", "Unknown native read operation.");
    }
    async close() { this.#closed = true; this.#listeners.clear(); }
}
function fixture(options) { const adapter = new SyntheticNativeAdapter(options), service = new TaskService(adapter); return { adapter, service }; }
function sessionPort(service) {
    return { subscribe: listener => service.subscribeReads(listener),
        queryStructured: async options => { const result = await service.read({ backend: "native", operation: "structured", ...options });
            if (result.status !== "ok") throw new TaskServiceError(result.code, result.reason);
            return result; } };
}
module.exports = { fixture, SyntheticNativeAdapter, dataset, taskView, eventView, nativeTask, owners, id, clone, clock, sameOwner, sessionPort };

