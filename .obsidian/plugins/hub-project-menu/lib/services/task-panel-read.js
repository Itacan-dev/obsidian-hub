"use strict";
const { TaskReadSession } = require("./task-read-session");
const { legacyReadTask, legacyActionTask, legacyActionRequest, handleFor } = require("./task-service-legacy-bridge");
const { applyTaskEdit } = require("../domain/tasks");
const { taskMetadata } = require("../domain/task-planning");
const { TaskServiceError } = require("./task-service-errors");
const { workspaceRef, sameWorkspace } = require("./task-service-legacy-values");
const pluginPanels = new WeakMap();
function trackPanel(plugin, close) {
    let panels = pluginPanels.get(plugin);
    if (!panels) {
        pluginPanels.set(plugin, panels = new Set());
        plugin.register(() => { for (const dispose of [...panels]) dispose(); panels.clear(); pluginPanels.delete(plugin); });
    }
    panels.add(close);
    return () => panels.delete(close);
}

// Only presentation evidence participates in equality. Handles and diagnostics
// remain on the returned rows; no editor/file/index objects enter this cache.
function panelTaskFacts(task) {
    return [task.path, task.line, task.text, task.hubTaskId ?? null, !!task.completed, !!task.identityConflict, taskMetadata(task), task.taskPanelPhaseLabel ?? null,
        (task.steps ?? []).map(step => [step.path ?? task.path, step.line, step.text, step.hubTaskId ?? null, !!step.completed, step.parent ?? null])];
}
const signature = tasks => JSON.stringify(tasks.map(panelTaskFacts));
function displayTask(view) {
    // An invalid locator can still carry trustworthy display evidence. Keep it
    // explicitly unavailable, with no invented source line or action handle.
    return { path: view.source?.path, text: view.compatibility.displayText, completed: view.completed, identityConflict: true,
        necessity: view.importance, description: view.description, phaseId: view.phase?.phaseId ?? null,
        fromDate: view.start?.date ?? null, fromTime: view.start?.time ?? null, dueDate: view.due?.date ?? null, dueTime: view.due?.time ?? null,
        steps: view.steps.map(step => ({ text: step.title, completed: step.completed })) };
}

function createTaskPanelRead({ plugin, component, workspace, changed, editTask, nativeTasks }) {
    if (nativeTasks && workspace.type === "project" && sameWorkspace(workspace, nativeTasks.owner)) {
        return nativeTasks.createPanelRead({ plugin, component, workspace, changed });
    }
    let closed = false, generation = 0, last = null, indexedQuery = null, indexedTasks = [], indexedSignature = null;
    const pending = new Map();
    const session = new TaskReadSession(plugin.taskService, () => { generation++; changed(); });
    const withinWorkspace = task => {
        const owner = workspace.type === "project" ? plugin.projectWizard.getProjectById(workspace.id) : plugin.projectWizard.getResourceById(workspace.id);
        const root = owner && plugin.taskData.currentPath(owner.root);
        return !!root && (task.path === root || task.path?.startsWith(root + "/"));
    };
    const alive = () => { if (closed) throw new TaskServiceError("CLOSED", "This task panel has closed."); };
    const checkOwner = (task, fresh) => {
        const before = task.taskPanelOwner ?? workspaceRef(plugin.projectWizard.getContextForPath(task.path));
        const after = workspaceRef(plugin.projectWizard.getContextForPath(fresh.path));
        if (before && !sameWorkspace(before, after)) throw new TaskServiceError("STALE_REFERENCE", "This task moved to another workspace. Refresh the task list.");
    };
    const resolveTask = async task => { const fresh = await legacyActionTask(plugin.taskService, task); checkOwner(task, fresh); return fresh; };
    const current = async task => { alive(); const fresh = await resolveTask(task); alive(); return fresh; };
    const actions = {
        mutate: async request => {
            // The existing inline UI commits its draft during component
            // cleanup. Closing this read session must not cancel that accepted
            // legacy write. Facade/plugin shutdown still rejects new preflight.
            const fresh = await legacyActionRequest(plugin.taskService, request);
            checkOwner(request, fresh);
            // The old inline writer validates every indexed continuation line.
            // Keep that display evidence after validating the parent identity.
            return plugin.mutateTask({ ...fresh, text: request.text });
        },
        editTask: async (task, saved) => {
            try { const fresh = await current(task); editTask({ ...fresh, text: task.text }, saved); }
            catch (error) { if (!closed) { console.error("Task panel action unavailable", error); new (require("obsidian").Notice)(error.message); } }
        }
    };
    const close = () => { if (closed) return; closed = true; generation++; pending.clear(); indexedQuery = null; indexedTasks = []; session.close(); untrack(); };
    const untrack = trackPanel(plugin, close);
    component.register(close);
    return {
        actions, close,
        async read() {
            const ticket = ++generation;
            const result = await session.read({ workspace, policy: "panel", validation: "indexed" }, () => closed || ticket !== generation);
            if (!result || closed || ticket !== generation) return null;
            if (result !== indexedQuery) {
                indexedQuery = result;
                indexedTasks = result.rows.flatMap(row => row.view?.legacy ? [{ ...legacyReadTask(row.view), taskPanelOwner: row.view.owner }] : row.display ? [displayTask(row.display)] : [])
                    .map(task => ({ ...task, taskPanelPhaseLabel: plugin.planning?.phaseFor?.(task)?.name ?? null }));
                indexedSignature = signature(indexedTasks);
            }
            let tasks = indexedTasks;
            // A completed import may still lag a local write. Retain only that
            // note's immediate writer result until the index acknowledges it.
            // Rename/delete cannot resurrect a retained source.
            for (const [path, record] of pending) {
                if (!plugin.app.vault.getAbstractFileByPath(path)) { pending.delete(path); continue; }
                const expected = record.tasks;
                const indexed = tasks.filter(task => task.path === path);
                if (signature(indexed) === signature(expected)) { pending.delete(path); continue; }
                // If a later import disagrees with both the immediate result
                // and its source evidence, an external edit superseded it.
                // This checks one affected note, only after a local mutation;
                // ordinary enumeration never reads Markdown sources.
                if (session.generation > record.generation && record.query !== result) {
                    const before = await record.source, source = await plugin.app.vault.read(plugin.app.vault.getAbstractFileByPath(path));
                    if (closed || ticket !== generation) return null;
                    record.query = result;
                    if (before !== null && source !== before) { pending.delete(path); continue; }
                }
                const first = tasks.findIndex(task => task.path === path);
                tasks = tasks.filter(task => task.path !== path);
                tasks.splice(first < 0 ? tasks.length : first, 0, ...expected);
            }
            const didChange = (tasks === indexedTasks ? indexedSignature : signature(tasks)) !== last;
            return { tasks, changed: didChange, diagnostics: result.diagnostics };
        },
        accept(tasks) { last = signature(tasks); },
        reconcile(items, edit) {
            if (closed) return applyTaskEdit(items, edit);
            generation++; session.invalidate();
            const tasks = applyTaskEdit(items, edit).filter(withinWorkspace);
            for (const path of [edit.path, edit.movedTo?.path].filter(Boolean)) {
                if (withinWorkspace({ path })) {
                    const file = plugin.app.vault.getAbstractFileByPath(path);
                    pending.set(path, { tasks: tasks.filter(task => task.path === path), generation: session.generation, query: null,
                        source: file ? Promise.resolve().then(() => plugin.app.vault.read(file)).catch(() => null) : Promise.resolve(null) });
                }
            }
            last = signature(tasks); return tasks;
        },
        async toggle(task, completed) {
            alive(); const fresh = await resolveTask(task);
            return plugin.toggleTask(fresh.path, fresh.line, task.text, completed, fresh.hubTaskId);
        },
        async clear(requests, confirmMany) {
            alive();
            // Validate the entire batch before invoking the unchanged writer.
            const fresh = [];
            for (const request of requests) fresh.push({ ...request, ...await resolveTask(request), text: request.text });
            return plugin.clearCompletedTasks(fresh, confirmMany);
        },
        async reveal(task) {
            alive(); if (task.identityConflict) throw new TaskServiceError("AMBIGUOUS_REFERENCE", "This task's source is unavailable or ambiguous.");
            const target = await plugin.taskService.resolveReveal(handleFor(task)); alive();
            if (target.kind !== "legacy-source") throw new TaskServiceError("UNSUPPORTED", "This task has no legacy source note.");
            checkOwner(task, target);
            return target;
        }
    };
}
module.exports = { createTaskPanelRead, panelTaskFacts };
