"use strict";
const { normalizedTaskText } = require("../domain/tasks");
const { taskMetadata } = require("../domain/task-planning");
const { requireTaskValue, TaskServiceError } = require("./task-service-errors");

function copy(value, ancestors = new Set()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") { requireTaskValue(Number.isFinite(value), "Task values must contain finite numbers."); return value; }
    requireTaskValue(value && typeof value === "object" && !ancestors.has(value) && ancestors.size < 64 &&
        (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
        "Task values must be portable JSON objects without cycles.");
    ancestors.add(value);
    const result = Array.isArray(value) ? [] : {};
    if (Array.isArray(value)) requireTaskValue(Object.keys(value).length === value.length &&
        Object.keys(value).every((key, index) => key === String(index)), "Task arrays must be dense and undecorated.");
    for (const key of Reflect.ownKeys(value)) {
        if (Array.isArray(value) && key === "length") continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        requireTaskValue(typeof key === "string" && descriptor.enumerable && Object.hasOwn(descriptor, "value") &&
            !["__proto__", "constructor", "prototype"].includes(key), "Task values must have ordinary JSON fields.");
        result[key] = copy(descriptor.value, ancestors);
    }
    ancestors.delete(value);
    return result;
}
const validId = value => typeof value === "string" && /^[a-zA-Z0-9-]+$/.test(value);
const validPath = path => typeof path === "string" && path.length > 0 &&
    !/^(?:[a-z]+:|[\\/])/i.test(path) && !path.includes("\\") &&
    !path.split("/").some(part => !part || part === "." || part === "..");

function workspaceRef(context) {
    if (!context) return null;
    const type = context.contextKind === "resource" ? "resource" : "project";
    const id = type === "resource" ? context.resourceType ?? context.id ?? context.projectId?.replace(/^resource:/, "") : context.projectId;
    return typeof id === "string" && id.length ? { type, id } : null;
}
const sameWorkspace = (a, b) => !!a && !!b && a.type === b.type && a.id === b.id;
function validateWorkspace(ref) {
    requireTaskValue(ref && ["project", "resource"].includes(ref.type) && typeof ref.id === "string" && !!ref.id, "Choose a workspace identity.");
}

function legacyTaskHandle(task) {
    requireTaskValue(task && validPath(task.path) && /\.md$/i.test(task.path) && Number.isInteger(task.line) && task.line >= 0 &&
        typeof task.text === "string", "A legacy source note, line and expected title are required.");
    const id = task.hubTaskId ?? null;
    requireTaskValue(id === null || validId(id), "Invalid existing legacy task identity.");
    return { kind: "legacy", identity: id === null ? null : { kind: "hidden-id", value: id },
        locator: { path: task.path, line: task.line, expectedTitle: normalizedTaskText(task.text) } };
}
function validateHandle(handle) {
    requireTaskValue(handle?.kind === "legacy", "This adapter requires a legacy task handle.");
    requireTaskValue(handle.identity === null || handle.identity?.kind === "hidden-id" && validId(handle.identity.value), "Invalid legacy identity.");
    const locator = handle.locator;
    requireTaskValue(locator && validPath(locator.path) && /\.md$/i.test(locator.path) && Number.isInteger(locator.line) && locator.line >= 0 &&
        typeof locator.expectedTitle === "string", "Invalid legacy source locator.");
    return handle;
}

function normalizeLegacyTask(snapshot, owner, timestamp = null) {
    const handle = legacyTaskHandle(snapshot), metadata = taskMetadata(snapshot);
    const handles = snapshot.steps.map((step, ordinal) => ({ kind: "legacy-step", taskIdentity: snapshot.hubTaskId ?? null, identity: step.hubTaskId ?? null, ordinal }));
    // Use the existing parser's block ranges, including Steps separated by prose
    // list items. No Markdown parsing or native location registry lives here.
    const stack = [], orders = new Map();
    const steps = snapshot.steps.map((step, index) => {
        while (stack.length && step.line >= stack.at(-1).end) stack.pop();
        const parent = stack.at(-1)?.index ?? null;
        const order = orders.get(parent) ?? 0; orders.set(parent, order + 1);
        const result = { handle: handles[index], title: step.text, completed: !!step.completed,
            parent: parent === null ? null : handles[parent], order };
        stack.push({ index, end: step.end });
        return result;
    });
    return { handle, existingId: snapshot.hubTaskId ?? null, title: snapshot.text, completed: !!snapshot.completed, steps,
        importance: metadata.necessity, start: metadata.fromDate ? { date: metadata.fromDate, time: metadata.fromTime ?? null } : null,
        due: metadata.dueDate ? { date: metadata.dueDate, time: metadata.dueTime ?? null } : null,
        description: metadata.description ?? "", phase: metadata.phaseId && owner?.type === "project" ? { projectId: owner.id, phaseId: metadata.phaseId } : null,
        owner, source: { kind: "legacy", locator: copy(handle.locator) }, location: null,
        captureSource: metadata.captureSource ?? null,
        progress: { completedSteps: steps.filter(step => step.completed).length, totalSteps: steps.length,
            completedAt: Number.isFinite(timestamp) ? timestamp : null, consistency: "legacy-best-effort" },
        revision: null, editSafety: { kind: "legacy-source-block", persistentIdentity: !!snapshot.hubTaskId,
            saveSupported: !!snapshot.hubTaskId, durableRevision: false } };
}

function draftFromTask(task) {
    return copy({ title: task.title, completed: task.completed, importance: task.importance, start: task.start, due: task.due,
        description: task.description, phase: task.phase, captureSource: task.captureSource,
        steps: task.steps.map(step => ({ handle: step.handle, title: step.title, completed: step.completed })) });
}

function legacyValues(draft, owner) {
    requireTaskValue(draft && typeof draft.title === "string" && typeof draft.completed === "boolean" &&
        (draft.importance === null || ["must", "should"].includes(draft.importance)) && typeof draft.description === "string" &&
        Array.isArray(draft.steps), "Supply a complete editable draft.");
    requireTaskValue(Object.keys(draft).every(key => ["title", "completed", "importance", "start", "due", "description", "phase", "steps", "captureSource", "completedAt"].includes(key)),
        "Editable drafts contain task fields only; use explicit association operations.");
    for (const endpoint of [draft.start, draft.due]) {
        requireTaskValue(endpoint === null || endpoint && typeof endpoint.date === "string" && !!endpoint.date &&
            (endpoint.time === null || typeof endpoint.time === "string" && !!endpoint.time), "Use a local date and optional local time.");
    }
    requireTaskValue(draft.phase === null || owner?.type === "project" && draft.phase?.projectId === owner.id &&
        typeof draft.phase.phaseId === "string" && !!draft.phase.phaseId, "Choose a phase in the task's owning Project.");
    requireTaskValue(draft.completedAt === undefined || Number.isSafeInteger(draft.completedAt) && draft.completedAt > 0, "Use an explicit completion action timestamp.");
    return { text: draft.title, completed: draft.completed, necessity: draft.importance, description: draft.description,
        fromDate: draft.start?.date ?? null, fromTime: draft.start?.time ?? null,
        dueDate: draft.due?.date ?? null, dueTime: draft.due?.time ?? null,
        phaseId: draft.phase?.phaseId ?? null, captureSource: draft.captureSource ?? null,
        ...(draft.completedAt ? { completedAt: draft.completedAt } : {}) };
}

function stepIndex(snapshot, handle) {
    requireTaskValue(handle?.kind === "legacy-step" && Number.isInteger(handle.ordinal) && handle.ordinal >= 0 &&
        (handle.identity === null || validId(handle.identity)), "Choose a Step from this editable snapshot.");
    const step = snapshot.steps[handle.ordinal];
    if (!step || (step.hubTaskId ?? null) !== handle.identity || handle.taskIdentity !== (snapshot.hubTaskId ?? null)) {
        throw new TaskServiceError("STALE_REFERENCE", "This Step does not belong to this editable snapshot.");
    }
    return handle.ordinal;
}

module.exports = { copy, validId, validPath, workspaceRef, sameWorkspace, validateWorkspace,
    legacyTaskHandle, validateHandle, normalizeLegacyTask, draftFromTask, legacyValues, stepIndex };
