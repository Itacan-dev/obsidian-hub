"use strict";
const { legacyTaskHandle } = require("./task-service-legacy-values");
const { TaskServiceError } = require("./task-service-errors");
const { normalizedTaskText } = require("../domain/tasks");

function legacyReadTask(view) {
    if (view?.legacy?.kind !== "legacy-task-read" || view.handle?.kind !== "legacy") {
        throw new TaskServiceError("UNSUPPORTED", "No legacy task action is available for this record.");
    }
    return { ...view.legacy, steps: view.legacy.steps.map(step => ({ ...step })),
        necessity: view.importance, description: view.description, phaseId: view.phase?.phaseId ?? null,
        ...(view.captureSource ? { captureSource: { ...view.captureSource } } : {}),
        fromDate: view.start?.date ?? null, fromTime: view.start?.time ?? null,
        dueDate: view.due?.date ?? null, dueTime: view.due?.time ?? null,
        taskServiceHandle: view.handle, identityConflict: !view.capabilities.attemptReveal };
}
const handleFor = task => {
    const handle = task.taskServiceHandle;
    // A legacy writer's immediate reconciliation may replace identity/title or
    // line before Dataview imports. Use that actual returned reference.
    return handle?.kind === "legacy" && handle.locator.path === task.path && handle.locator.line === task.line &&
        handle.locator.expectedTitle === normalizedTaskText(task.text) && (handle.identity?.value ?? null) === (task.hubTaskId ?? null)
        ? handle : legacyTaskHandle(task);
};
async function legacyActionTask(service, task) {
    if (task.identityConflict) throw new TaskServiceError("AMBIGUOUS_REFERENCE", "This task's source is unavailable or ambiguous. Refresh the task list.");
    return legacyReadTask(await service.resolveLegacyAction(handleFor(task)));
}
async function legacyActionRequest(service, request) {
    const task = await legacyActionTask(service, request);
    const result = { ...request, ...task, completed: request.completed ?? task.completed };
    if (request.step) {
        const matches = task.steps.filter(step => request.step.hubTaskId ? step.hubTaskId === request.step.hubTaskId && normalizedTaskText(step.text) === normalizedTaskText(request.step.text) :
            step.line === request.step.line && step.text === request.step.text);
        if (matches.length !== 1) throw new TaskServiceError("STALE_REFERENCE", "The selected Step changed. Refresh the task list.");
        result.step = matches[0];
    }
    return result;
}
module.exports = { legacyReadTask, legacyActionTask, legacyActionRequest, handleFor };
