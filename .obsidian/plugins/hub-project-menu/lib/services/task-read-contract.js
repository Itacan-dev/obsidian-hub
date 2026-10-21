"use strict";
// Opt-in contract dispatch only. No storage, discovery, native adapter or UI.
const { TaskServiceError, requireTaskValue } = require("./task-service-errors");
const { copy } = require("./task-service-legacy-values");
const READ_OPERATIONS = Object.freeze(["structured", "candidates", "committed", "history", "navigation", "target"]);
const READ_FEATURES = Object.freeze(["hierarchy", "physical-owner", "presentation", "recorded-attribution", "navigation",
    "completion", "lifecycle", "stable-id", "oath-candidates", "oath-committed", "history", "history-counting", "invalidation",
    "source-independent", "legacy-source", "legacy-actions", "imported-lineage", "recurrence", "mutation"]);
const METHODS = { structured: "queryStructured", candidates: "queryStructured", committed: "resolveOathWork",
    history: "queryHistory", navigation: "resolveReveal", target: "resolveSavedTarget" };
const unsupported = reason => ({ state: "unsupported", reason });
function backendOf(adapter) {
    const backend = adapter.capabilities().backend;
    requireTaskValue(["legacy-markdown", "native"].includes(backend), "Unknown task read backend.");
    return backend;
}
function legacyCapabilities(adapter) {
    const old = adapter.capabilities();
    const operations = Object.fromEntries(READ_OPERATIONS.map(op => [op,
        old.operations[METHODS[op]] && typeof adapter[METHODS[op]] === "function" ? { state: "supported" } : unsupported("Legacy operation is not implemented.")]));
    const features = Object.fromEntries(READ_FEATURES.map(key => [key, unsupported("Not guaranteed by the legacy read backend.")]));
    for (const key of ["hierarchy", "physical-owner", "recorded-attribution", "completion", "invalidation", "legacy-source", "legacy-actions"])
        features[key] = { state: "conditional", reason: "Requires the corresponding legacy operation and its existing per-row source/identity policy." };
    features.presentation = { state: "conditional", reason: "Home resolves detached page evidence using its current registry." };
    features["oath-candidates"] = operations.candidates;
    features["oath-committed"] = operations.committed;
    features.history = operations.history;
    features.navigation = operations.navigation;
    features["history-counting"] = { state: "conditional", reason: "Recorded legacy evidence; existing Statistics mapping is required." };
    features.mutation = unsupported("The N0 read protocol never authorizes mutation; existing legacy writers are separate.");
    return { backend: "legacy-markdown", operations, features };
}
function checkCapabilities(caps, backend, adapter) {
    requireTaskValue(caps?.backend === backend, "Read capabilities have the wrong backend.");
    for (const [keys, map] of [[READ_OPERATIONS, caps.operations], [READ_FEATURES, caps.features]]) {
        requireTaskValue(map && typeof map === "object", "Missing read capability map.");
        for (const key of keys) requireTaskValue(["supported", "conditional", "unsupported"].includes(map[key]?.state) &&
            (map[key].state === "supported" || typeof map[key].reason === "string" && !!map[key].reason), "Invalid read capability: " + key);
    }
    if (backend === "native" && typeof adapter.read !== "function")
        requireTaskValue(READ_OPERATIONS.every(key => caps.operations[key].state === "unsupported"), "Native read support requires an implemented read port.");
    if (backend === "native" && caps.features.invalidation.state === "supported")
        requireTaskValue(typeof adapter.subscribeReads === "function", "Native invalidation support requires an implemented read subscription.");
    return caps;
}
async function taskReadiness(adapter, required = []) {
    const backend = backendOf(adapter);
    requireTaskValue(Array.isArray(required) && required.every(key => READ_FEATURES.includes(key)), "Unknown required read capability.");
    const snapshot = typeof adapter.readiness === "function" ? await adapter.readiness() :
        { backend, state: "unsupported", reason: "This adapter has no explicit readiness observation." };
    requireTaskValue(snapshot?.backend === backend && ["ready", "not-ready", "unavailable", "recovering", "unsupported"].includes(snapshot.state) &&
        typeof snapshot.reason === "string" && !!snapshot.reason, "Invalid backend readiness.");
    const fallback = backend === "legacy-markdown" ? legacyCapabilities(adapter) : {
        backend, operations: Object.fromEntries(READ_OPERATIONS.map(op => [op, unsupported("No native read contract declared.")])),
        features: Object.fromEntries(READ_FEATURES.map(key => [key, unsupported("No native read contract declared.")]))
    };
    const capabilities = checkCapabilities(snapshot.capabilities ?? fallback, backend, adapter);
    return copy({ backend, state: snapshot.state, reason: snapshot.reason, capabilities,
        missing: required.filter(key => capabilities.features[key].state !== "supported") });
}
const failure = (backend, operation, status, code, reason) => ({ backend, operation, status, code, reason });
function freeze(value) {
    if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
}
function subscribeTaskReads(adapter, listener) {
    requireTaskValue(typeof listener === "function", "A read invalidation listener is required.");
    const backend = backendOf(adapter);
    if (backend === "legacy-markdown") return adapter.subscribe(() => listener({ backend, kind: "invalidation", durability: "unknown" }));
    if (typeof adapter.subscribeReads !== "function") throw new TaskServiceError("UNSUPPORTED", "No native read invalidation port.");
    return adapter.subscribeReads(change => {
        requireTaskValue(change?.backend === "native" && change.kind === "snapshot-invalidated" && change.durability === "ephemeral", "Unknown native read invalidation.");
        listener(copy(change));
    });
}
function checkNativeResult(result) {
    const task = value => {
        requireTaskValue(value?.kind === "native-task-read" && value.handle?.kind === "native" && value.handle.id === value.id &&
            typeof value.id === "string" && Number.isInteger(value.revision) && value.revision > 0 &&
            ["project", "resource"].includes(value.owner?.type) && typeof value.owner.id === "string" &&
            Array.isArray(value.steps), "Invalid native task read variant.");
        requireTaskValue(!["path", "line", "hubTaskId", "legacy", "source", "file", "block"].some(key => Object.hasOwn(value, key)),
            "Native task reads cannot fabricate legacy source evidence.");
        for (const step of value.steps) requireTaskValue(step.kind === "native-step-read" && step.taskId === value.id &&
            !["path", "line", "hubTaskId", "file"].some(key => Object.hasOwn(step, key)), "Invalid native Step read variant.");
    };
    if (["structured", "candidates"].includes(result.operation)) { requireTaskValue(Array.isArray(result.rows), "Native rows required."); result.rows.forEach(task); }
    else if (result.operation === "committed") {
        requireTaskValue(Array.isArray(result.rows), "Committed rows required.");
        for (const row of result.rows) {
            requireTaskValue(["resolved", "missing", "deleted", "owner-mismatch", "unsupported-alias"].includes(row.state) &&
                ["native", "legacy-id"].includes(row.reference?.kind), "Unknown committed result variant.");
            if (row.task) task(row.task);
        }
    } else if (result.operation === "history") {
        requireTaskValue(["retained", "counted"].includes(result.selection) && Array.isArray(result.rows), "Unknown history selection.");
        for (const event of result.rows) requireTaskValue(event.kind === "native-history-event" && typeof event.eventId === "string" &&
            ["task", "step"].includes(event.targetKind) && typeof event.counted === "boolean", "Unknown native History variant.");
    } else if (result.operation === "navigation") {
        requireTaskValue(["available", "none", "missing-location", "deleted-task"].includes(result.state) &&
            (result.target === null || ["native-task", "native-location", "historical-provenance"].includes(result.target?.kind)), "Unknown native navigation variant.");
        requireTaskValue((result.state === "available") === (result.target !== null), "Navigation availability must match its target.");
        const target = result.target;
        if (target?.kind === "native-task") requireTaskValue(typeof target.id === "string" && !!target.id &&
            !["path", "line", "file", "source"].some(key => Object.hasOwn(target, key)), "A native task target is an ID, not a source.");
        if (target?.kind === "native-location") requireTaskValue(["folder", "note"].includes(target.location?.type) &&
            typeof target.location.id === "string" && !!target.location.id && ["project", "resource"].includes(target.owner?.type) &&
            !["path", "line", "file", "source"].some(key => Object.hasOwn(target, key)), "Native context is not Markdown source evidence.");
        if (target?.kind === "historical-provenance") requireTaskValue(target.source?.kind === "recorded-legacy-note" &&
            typeof target.source.path === "string" && !!target.source.path, "Historical provenance must be explicit recorded evidence.");
    } else if (result.operation === "target") {
        requireTaskValue(["resolved", "missing", "deleted", "missing-step"].includes(result.state), "Unknown native target variant.");
        if (result.task) task(result.task);
    }
}
async function readTaskContract(adapter, input) {
    const backend = backendOf(adapter), request = copy(input);
    requireTaskValue(request && ["legacy-markdown", "native"].includes(request.backend) && READ_OPERATIONS.includes(request.operation), "Unknown task read request.");
    const operation = request.operation;
    if (request.backend !== backend) return failure(backend, operation, "unsupported", "BACKEND_MISMATCH", "This facade has one explicitly selected backend.");
    const ready = await taskReadiness(adapter);
    if (ready.capabilities.operations[operation].state === "unsupported")
        return failure(backend, operation, "unsupported", "CAPABILITY_UNSUPPORTED", ready.capabilities.operations[operation].reason);
    if (ready.state !== "ready")
        return failure(backend, operation, ready.state === "unsupported" ? "unsupported" : "unavailable", "BACKEND_" + ready.state.toUpperCase(), ready.reason);
    if (backend === "native") {
        const result = await adapter.read(request);
        requireTaskValue(result?.backend === backend && result.operation === operation && ["ok", "unsupported", "unavailable"].includes(result.status),
            "Native read returned an unknown or mismatched result.");
        if (result.status !== "ok") requireTaskValue(typeof result.code === "string" && typeof result.reason === "string" && !!result.reason, "Invalid native read failure.");
        if (result.status === "ok") checkNativeResult(result);
        return freeze(copy(result)); // Immutable native cache values; no legacy result changes.
    }
    const method = METHODS[operation];
    const args = operation === "structured" ? [request.options] : operation === "candidates" ?
        [{ policy: "oath-candidates", workspace: request.workspace, validation: "indexed" }] :
        operation === "committed" ? [request.request] : operation === "history" ? [{ ...request.query, projection: "recorded" }] :
        operation === "navigation" ? [request.handle] : [request.target];
    try { return { backend, operation, status: "ok", data: copy(await adapter[method](...args)) }; }
    catch (error) {
        if (error instanceof TaskServiceError && error.code === "UNSUPPORTED") return failure(backend, operation, "unsupported", error.code, error.message);
        throw error; // Preserve real legacy validation/source failures and their typed diagnostics.
    }
}
module.exports = { READ_OPERATIONS, READ_FEATURES, taskReadiness, readTaskContract, subscribeTaskReads };

