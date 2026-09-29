"use strict";

const { normalizedTaskText } = require("./tasks");

// Both kinds share the existing history and active-check collections. History
// contains immutable display snapshots; checks only connect them to live source.
function taskProgressMutation(previousChecks, previousHistory, edit, context, timestamp, createId) {
    if (edit.movedTo) {
        // Move live bindings, never historical display snapshots or timestamps.
        const moving = previousChecks.filter(check => check.path === edit.path && check.line >= edit.line && check.line < edit.line + edit.removedLines);
        const rest = taskProgressMutation(previousChecks.filter(check => !moving.includes(check)), previousHistory,
            { ...edit, movedTo: null, operation: "delete", tasks: [], progressTransitions: [] }, context, timestamp, createId);
        const saved = edit.tasks[0];
        for (const check of moving) {
            const after = check.kind === "step" ? saved.steps.find(step => check.hubTaskId ? step.hubTaskId === check.hubTaskId : step.line - saved.line === check.line - edit.line) : saved;
            if (after) rest.checks.push({ ...check, path: saved.path, line: after.line, text: after.text,
                hubTaskId: after.hubTaskId ?? check.hubTaskId, ...(check.kind === "step" ? { parentTaskId: saved.hubTaskId } : {}) });
        }
        return taskProgressMutation(rest.checks, rest.history, { ...edit, movedTo: null, path: saved.path, line: saved.line,
            operation: "step", lineDelta: 0, removedLines: 0 }, context, timestamp, createId);
    }
    const parentId = edit.tasks[0]?.hubTaskId ?? edit.hubTaskId;
    let checks = previousChecks.map(check => {
        if (check.kind === "step" && parentId && check.parentTaskId === parentId) return { ...check, path: edit.path };
        // A parent may first receive an ID when one of its Steps is checked.
        if (edit.operation === "step" && check.kind !== "step" && parentId && check.path === edit.path &&
            check.line === edit.line && normalizedTaskText(check.text) === normalizedTaskText(edit.oldText)) {
            return { ...check, hubTaskId: parentId };
        }
        return check;
    }), history = previousHistory;
    const kindOf = item => item.kind === "step" ? "step" : "task";
    const find = (kind, id, line, text) => {
        const matches = checks.filter(check => kindOf(check) === kind && (id && check.hubTaskId
            ? check.hubTaskId === id
            : check.path === edit.path && normalizedTaskText(check.text) === normalizedTaskText(text)));
        return matches.find(check => check.path === edit.path && check.line === line) ?? (matches.length === 1 ? matches[0] : null);
    };
    const transition = event => {
        const target = find(event.kind, event.hubTaskId, event.lookupLine ?? event.line, event.oldText ?? event.text);
        if (target) {
            checks = checks.filter(check => check !== target);
            if (target.historyId) history = history.filter(record => record.id !== target.historyId);
        }
        if (!event.completed || !context) return;
        const id = createId(), at = event.timestamp ?? timestamp;
        const identity = { kind: event.kind, hubTaskId: event.hubTaskId ?? null,
            ...(event.kind === "step" ? { parentTaskId: event.parentTaskId, parentText: event.parentText } : {}) };
        history = [{ ...identity, id, timestamp: at, text: event.text, path: edit.path, line: event.line,
            projectId: context.projectId ?? `resource:${context.resourceType ?? context.id}`,
            projectName: context.name ?? context.label, projectStatus: context.status ?? null,
            projectPath: context.path, projectRoot: context.root,
            contextKind: context.contextKind ?? "project", resourceType: context.resourceType ?? null }, ...history];
        checks.unshift({ ...identity, path: edit.path, line: event.line, text: event.text,
            timestamp: at, historyId: id });
    };

    let taskTransition = null;
    if (edit.operation !== "step") {
        const target = find("task", edit.hubTaskId, edit.line, edit.oldText);
        const saved = edit.tasks.find(task => task.completed);
        if (!edit.operation && edit.wasCompleted !== edit.completed) {
            taskTransition = { kind: "task", hubTaskId: saved?.hubTaskId ?? edit.hubTaskId,
                line: saved?.line ?? edit.line, lookupLine: edit.line,
                oldText: edit.oldText, text: saved?.text ?? edit.oldText, completed: edit.completed };
        } else if (target && edit.operation !== "add") {
            // Editing or deleting is housekeeping: only update/detach the binding.
            checks = checks.filter(check => check !== target);
            if (saved) checks.unshift({ ...target, path: edit.path, line: saved.line,
                text: saved.text, hubTaskId: saved.hubTaskId ?? target.hubTaskId });
        }
        checks = checks.flatMap(check => {
            if (check.path !== edit.path) return [check];
            if (edit.operation === "add") return [{ ...check,
                line: check.line >= edit.insertionLine ? check.line + edit.lineDelta : check.line }];
            if (kindOf(check) === "step" && edit.operation === "delete" && edit.hubTaskId && check.parentTaskId === edit.hubTaskId) return [];
            if (kindOf(check) === "step" && edit.removedLines && check.line > edit.line && check.line < edit.line + edit.removedLines) {
                const step = edit.tasks[0]?.steps?.find(step => step.hubTaskId === check.hubTaskId);
                return step ? [{ ...check, line: step.line, text: step.text }] : [];
            }
            return [{ ...check, line: check.line > edit.line ? check.line + edit.lineDelta : check.line }];
        });
    }
    if (taskTransition) transition(taskTransition);
    for (const event of edit.progressTransitions ?? []) transition(event);
    return { checks, history, changed: history !== previousHistory };
}

module.exports = { taskProgressMutation };
