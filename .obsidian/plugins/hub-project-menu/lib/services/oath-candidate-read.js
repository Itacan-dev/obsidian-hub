"use strict";
const { TaskReadSession } = require("./task-read-session");
const { legacyReadTask } = require("./task-service-legacy-bridge");
const { taskGroups } = require("../domain/task-planning");
const { taskKey, sameWorkspace } = require("../domain/oath-workspace");
const { oathRequirements, validateOath } = require("../domain/oath");
const { TaskServiceError } = require("./task-service-errors");
const consumers = new WeakMap();
const sameReference = (a, b) => !!a && !!b && taskKey(a) === taskKey(b) &&
    a.path === b.path && a.line === b.line && a.text === b.text && a.hubTaskId === b.hubTaskId;

function preserveCandidateInteraction(body, render) {
    const focused = body.ownerDocument.activeElement, row = body.contains(focused) ? focused.closest(".hub-oath-task-row") : null;
    const key = row?.oathCandidateKey, index = row ? [...row.querySelectorAll("button,input,[tabindex]")].indexOf(focused) : -1, scroll = body.scrollTop;
    render(); body.scrollTop = scroll;
    if (key && !focused.isConnected) {
        const next = [...body.querySelectorAll(".hub-oath-task-row")].find(item => item.oathCandidateKey === key);
        (index >= 0 ? next?.querySelectorAll("button,input,[tabindex]")[index] : next)?.focus({ preventScroll: true });
    }
}
function createOathCandidateRead(service, component) {
    const plugin = service.plugin, listeners = new Set();
    let closed = false, generation = 0, workspace = null, pending = null;
    let indexedTasks = [], preparedAt = null;
    const state = { status: "idle", tasks: [], diagnostics: [], error: null };
    const notify = () => { for (const callback of [...listeners]) callback(); };
    const session = new TaskReadSession(plugin.taskService, () => { if (workspace && !closed) void refresh(); });
    let active = consumers.get(plugin);
    if (!active) {
        consumers.set(plugin, active = new Set());
        plugin.register(() => { for (const close of [...active]) close(); active.clear(); consumers.delete(plugin); });
    }
    const signature = ref => { const context = service.resolveWorkspace(ref); return context ? JSON.stringify([context.path, context.root, context.status]) : null; };
    async function refresh() {
        if (closed || !workspace) return null;
        const ticket = ++generation, ref = { type: workspace.type, id: workspace.id }, context = signature(ref);
        state.status = "loading"; state.error = null; notify();
        const work = (async () => {
            try {
                if (!context) throw new TaskServiceError("REFERENCE_UNRESOLVED", "Choose an available Active Project or Resource.");
                const query = await session.read({ policy: "oath-candidates", workspace: ref, validation: "indexed" }, () => closed || generation !== ticket);
                if (!query || closed || generation !== ticket) return null;
                if (signature(ref) !== context) { session.invalidate(); return refresh(); }
                if (query.policy !== "oath-candidates" || !sameWorkspace(query.candidateWorkspace, ref)) throw new TaskServiceError("INDEX_UNAVAILABLE", "Oath candidates are unavailable.");
                indexedTasks = query.rows.filter(row => row.state === "indexed" && row.view?.capabilities.attemptReveal).map(row => legacyReadTask(row.view));
                preparedAt = service.now();
                const groups = taskGroups(indexedTasks, new Date(preparedAt));
                state.tasks = [...groups.active, ...groups.future]; state.diagnostics = query.diagnostics;
                if (query.complete === false) throw new TaskServiceError("INDEX_UNAVAILABLE", "The Oath candidate read is incomplete.");
                state.status = "ready"; state.error = null; notify(); return state.tasks;
            } catch (error) {
                if (closed || generation !== ticket) return null;
                state.status = "error"; state.error = error; notify(); return null;
            }
        })();
        pending = work; return work;
    }
    function close() { if (closed) return; closed = true; generation++; session.close(); state.status = "closed"; listeners.clear(); active.delete(close); }
    active.add(close); component.register(close);
    const available = (tasks, ref = workspace) => !closed && sameWorkspace(workspace, ref) &&
        service.ready() && !!service.resolveWorkspace(ref) && state.status !== "error" && state.status !== "idle" &&
        tasks.every(task => state.tasks.some(current => sameReference(task, current)));
    const requirements = draft => oathRequirements(draft, service.now()).map(field => {
        if (field.key === "Workspace" && field.complete && !service.resolveWorkspace(draft.workspace)) return { ...field, complete: false, error: "Choose an available Active Project or Resource." };
        if (field.key === "Tasks" && !service.ready()) return { ...field, complete: false, error: "Wait for the task index to finish loading." };
        if (field.key === "Tasks" && (state.status === "error" || closed)) return { ...field, complete: false, error: "Tasks could not be loaded. Try again." };
        if (field.key === "Tasks" && state.status === "loading" && !state.tasks.length) return { ...field, complete: false, error: "Wait for the task index to finish loading." };
        if (field.key === "Tasks" && field.complete && !available(draft.tasks, draft.workspace)) return { ...field, complete: false, error: "Selected tasks must be open tasks from this workspace. Update your selection." };
        return field;
    });
    return {
        state, requirements, available, close,
        tasks() {
            if (preparedAt !== null && preparedAt !== service.now()) {
                preparedAt = service.now(); const groups = taskGroups(indexedTasks, new Date(preparedAt));
                state.tasks = [...groups.active, ...groups.future];
            }
            return state.tasks;
        },
        onChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
        selectWorkspace(ref) {
            if (sameWorkspace(workspace, ref)) return pending;
            workspace = ref ? { type: ref.type, id: ref.id } : null; generation++; pending = null;
            session.invalidate();
            indexedTasks = []; preparedAt = null; state.tasks = []; state.status = "idle"; state.error = null;
            return workspace ? refresh() : Promise.resolve(null);
        },
        read() { return pending ?? refresh(); },
        retry() { session.invalidate(); return refresh(); },
        enrollmentDraft(draft) {
            validateOath(draft, service.now());
            const missing = requirements(draft).find(field => !field.complete);
            if (missing) throw Error(missing.error);
            // Explicit legacy enrollment evidence. No generic DTO/handle, editor
            // token, temporary selection key or read result is persisted.
            return { ...draft, workspace: { ...draft.workspace }, tasks: draft.tasks.map(task => ({
                path: task.path, line: task.line, text: task.text, hubTaskId: task.hubTaskId, completed: task.completed, identityConflict: false,
                steps: (task.steps ?? []).map(step => ({ path: step.path, line: step.line, text: step.text, hubTaskId: step.hubTaskId, completed: step.completed, parent: step.parent })),
                necessity: task.necessity, fromDate: task.fromDate, fromTime: task.fromTime, dueDate: task.dueDate, dueTime: task.dueTime,
                description: task.description, phaseId: task.phaseId
            })) };
        }
    };
}
module.exports = { createOathCandidateRead, preserveCandidateInteraction, sameReference };
