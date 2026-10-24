"use strict";
const { TaskReadSession } = require("./task-read-session");
const { legacyReadTask, legacyActionTask, legacyActionRequest, handleFor } = require("./task-service-legacy-bridge");
const { workspaceRef, sameWorkspace } = require("./task-service-legacy-values");
const { applyTaskEdit } = require("../domain/tasks");
const { taskMetadata } = require("../domain/task-planning");
const { TaskServiceError } = require("./task-service-errors");
const homes = new WeakMap();
// Presentation only: never a task read, mutation guard or complete-count authority.
const previousPresentations = new WeakMap();
const taskFacts = task => task.nativeReference ? [task.nativeReference, task.text, task.completed, task.nativeReadOnly, taskMetadata(task), task.steps] : [task.path, task.line, task.text, task.hubTaskId ?? null, !!task.completed, !!task.identityConflict,
    taskMetadata(task), task.homePhysicalOwner ?? null, task.homeProjectReference ?? null,
    (task.steps ?? []).map(step => [step.line, step.text, step.hubTaskId ?? null, !!step.completed, step.parent ?? null])];
const signature = tasks => JSON.stringify(tasks.map(taskFacts));
const clearSignature = tasks => JSON.stringify(tasks.map(task => [task.hubTaskId ?? null, task.text, !!task.completed, taskMetadata(task),
    (task.steps ?? []).map(step => [step.hubTaskId ?? null, step.text, !!step.completed])]));
const wrapperSignature = items => JSON.stringify(items.map(({ task, owner, phaseLabel }) => [taskFacts(task), owner.projectId, owner.resourceType,
    owner.name, owner.status, !!owner.deleted, owner.path, owner.root, phaseLabel ?? null]));
function displayOnly(view) {
    return { path: view.source?.path, text: view.compatibility.displayText, completed: view.completed, identityConflict: true,
        ...taskMetadata({ necessity: view.importance, description: view.description, phaseId: view.phase?.phaseId,
            fromDate: view.start?.date, fromTime: view.start?.time, dueDate: view.due?.date, dueTime: view.due?.time }),
        steps: view.steps.map(step => ({ text: step.title, completed: step.completed })) };
}
function createHomeTaskRead({ plugin, component, changed, resolveOwner, editTask, nativeTasks, resolveNativeOwner }) {
    let closed = false, generation = 0, indexedQuery = null, indexedTasks = [], last = null;
    const pending = new Map();
    const session = new TaskReadSession(plugin.taskService, () => { generation++; changed(); });
    let consumers = homes.get(plugin);
    if (!consumers) {
        homes.set(plugin, consumers = new Set());
        plugin.register(() => { for (const close of [...consumers]) close(); consumers.clear(); homes.delete(plugin); previousPresentations.delete(plugin); });
    }
    const alive = () => { if (closed) throw new TaskServiceError("CLOSED", "This Home task view has closed."); };
    const checkOwner = (task, fresh) => {
        const before = Object.hasOwn(task, "homePhysicalOwner") ? task.homePhysicalOwner : workspaceRef(plugin.projectWizard.getContextForPath(task.path));
        const after = workspaceRef(plugin.projectWizard.getContextForPath(fresh.path));
        if (!(before === null && after === null) && !sameWorkspace(before, after)) {
            throw new TaskServiceError("STALE_REFERENCE", "This task moved to another workspace. Refresh Home Tasks.");
        }
    };
    const resolve = async task => { const fresh = await legacyActionTask(plugin.taskService, task); checkOwner(task, fresh); return fresh; };
    const current = async task => { alive(); const fresh = await resolve(task); alive(); return fresh; };
    const wrap = tasks => tasks.flatMap(task => { const owner = resolveOwner(task);
        return owner ? [{ task, owner, phaseLabel: plugin.planning?.phaseFor?.(task)?.name ?? null }] : []; });
    const remember = (items, paths, cleared = true) => {
        if (closed) return;
        generation++; session.invalidate();
        for (const path of new Set(paths.filter(Boolean))) {
            const file = plugin.app.vault.getAbstractFileByPath(path);
            pending.set(path, { tasks: items.filter(item => item.task.path === path).map(item => item.task), cleared, generation: session.generation, query: null,
                source: file ? Promise.resolve().then(() => plugin.app.vault.read(file)).catch(() => null) : Promise.resolve(null) });
        }
        last = wrapperSignature(items);
    };
    const close = () => { if (closed) return; closed = true; generation++; session.close(); pending.clear(); indexedTasks = []; indexedQuery = null; consumers.delete(close); };
    consumers.add(close); component.register(close);
    const legacy = {
        close, remember,
        actions: {
            // Existing inline UI may commit its accepted draft during cleanup.
            // Closing a read subscription must not cancel that legacy write.
            mutate: async request => { const fresh = await legacyActionRequest(plugin.taskService, request); checkOwner(request, fresh);
                return plugin.mutateTask({ ...fresh, text: request.text }); },
            editTask: async (task, saved) => {
                try { const fresh = await current(task); editTask({ ...fresh, text: task.text }, saved); }
                catch (error) { if (!closed) { console.error("Home task action unavailable", error); new (require("obsidian").Notice)(error.message); } }
            }
        },
        async read() {
            const ticket = ++generation;
            const result = await session.read({ policy: "home", validation: "indexed" }, () => closed || ticket !== generation);
            if (!result || closed || ticket !== generation) return null;
            if (indexedQuery !== result) {
                indexedQuery = result;
                indexedTasks = result.rows.flatMap(row => {
                    const task = row.view?.legacy ? legacyReadTask(row.view) : row.display ? displayOnly(row.display) : null;
                    return task ? [{ ...task, homePhysicalOwner: row.home?.physicalOwner ?? null, homeProjectReference: row.home?.projectReference ?? null }] : [];
                });
            }
            let tasks = indexedTasks;
            for (const [path, record] of pending) {
                const file = plugin.app.vault.getAbstractFileByPath(path);
                if (!file) { pending.delete(path); continue; }
                // The old clear event supplies deleted parent lines, not full
                // block lengths. Once the remaining task/Step content matches,
                // trust canonical imported locators instead of retaining old
                // line offsets for a removed continuation or nested Step block.
                const acknowledged = record.cleared ? clearSignature : signature;
                if (acknowledged(tasks.filter(task => task.path === path)) === acknowledged(record.tasks)) { pending.delete(path); continue; }
                if (session.generation > record.generation && record.query !== result) {
                    const before = await record.source, source = await plugin.app.vault.read(file);
                    if (closed || ticket !== generation) return null;
                    record.query = result;
                    if (before !== null && source !== before) { pending.delete(path); continue; }
                }
                const first = tasks.findIndex(task => task.path === path);
                tasks = tasks.filter(task => task.path !== path);
                tasks.splice(first < 0 ? tasks.length : first, 0, ...record.tasks);
            }
            const items = wrap(tasks);
            return { items, changed: wrapperSignature(items) !== last, diagnostics: result.diagnostics };
        },
        accept(items) { last = wrapperSignature(items); },
        reconcile(items, edit) {
            const before = items.find(item => item.task.path === edit.path)?.task;
            const updated = applyTaskEdit(items, edit, task => plugin.taskData.currentPath(task.path)).map(({ task }) => ({ ...task,
                homePhysicalOwner: workspaceRef(plugin.projectWizard.getContextForPath(task.path)),
                homeProjectReference: task.homeProjectReference ?? before?.homeProjectReference ?? null }));
            const result = wrap(updated); remember(result, [edit.path, edit.movedTo?.path], false); return result;
        },
        async toggle(task, completed) { alive(); const fresh = await resolve(task);
            return plugin.toggleTask(fresh.path, fresh.line, task.text, completed, fresh.hubTaskId); },
        async clear(requests, confirmMany) {
            alive(); const fresh = [];
            for (const request of requests) fresh.push({ ...request, ...await resolve(request), text: request.text });
            return plugin.clearCompletedTasks(fresh, confirmMany);
        },
        async reveal(task) {
            alive(); if (task.identityConflict) throw new TaskServiceError("AMBIGUOUS_REFERENCE", "This task's source is unavailable or ambiguous.");
            const target = await plugin.taskService.resolveReveal(handleFor(task)); alive();
            if (target.kind !== "legacy-source") throw new TaskServiceError("UNSUPPORTED", "This task has no legacy source note.");
            checkOwner(task, target); return target;
        }
    };
    if (!nativeTasks?.consumerUiV1) return legacy;
    if (typeof resolveNativeOwner !== "function") throw new TaskServiceError("UNAVAILABLE", "Native Home owner resolver required.");
    let nativeGeneration = 0, available = false, readState = "loading", accepted = [], nativeRows = [], nativeContext = null, composing = 0;
    const owners = nativeTasks.owners ?? [nativeTasks.owner];
    const panels = owners.map(owner => ({ owner, panel: nativeTasks.createPanelRead({ plugin, component, workspace: owner,
        changed() { nativeGeneration++; available = false; readState = "loading"; if (!closed && !composing) changed(); } }) }));
    const panelFor = task => { const entry = panels.find(p => sameWorkspace(p.owner, task.nativeReference?.owner)); if (!entry) throw new TaskServiceError("UNAVAILABLE", "Native task owner unavailable."); return entry.panel; };
    const native = {
        close: () => panels.forEach(p => p.panel.close()),
        async read() { const all = await Promise.all(panels.map(p => p.panel.read())); if (all.some(r => !r)) return null;
            return { availability: all.every(r => r.availability === "current") ? "current" : "unavailable", tasks: all.flatMap(r => r.tasks), context: all.map(r => r.context) }; },
        accept: tasks => panels.forEach(p => p.panel.accept(tasks.filter(t => sameWorkspace(t.nativeReference?.owner, p.owner)))),
        reconcile: (tasks, edit) => { const entry = panels.find(p => sameWorkspace(p.owner, edit.owner)); if (!entry) throw new TaskServiceError("UNAVAILABLE", "Native edit owner unavailable.");
            const updated = entry.panel.reconcile(tasks.filter(t => sameWorkspace(t.nativeReference?.owner, edit.owner)), edit); return [...tasks.filter(t => !sameWorkspace(t.nativeReference?.owner, edit.owner)), ...updated]; },
        actions: { mutate: task => panelFor(task).actions.mutate(task), editTask: (task, saved) => panelFor(task).actions.editTask(task, saved) },
        toggle: (task, completed) => panelFor(task).toggle(task, completed)
    };
    const isNative = task => !!task.nativeReference;
    const requireNative = task => {
        alive(); if (!available || task.nativeReadOnly) throw new TaskServiceError("UNAVAILABLE", "This native task is unavailable.");
        return task;
    };
    const merge = items => owners.reduce((rows, owner, i) => nativeTasks.mergeHome(rows, nativeRows.filter(t => sameWorkspace(t.nativeReference?.owner, owner)), owner, nativeContext[i], resolveNativeOwner), items);
    const unavailable = (state = "unavailable") => { readState = state; return ({ items: accepted.map(item => isNative(item.task) ? { ...item, task: { ...item.task, nativeReadOnly: true } } : item),
        changed: true, availability: state, countComplete: false, diagnostics: [{ code: state === "loading" ? "NATIVE_HOME_INITIALIZING" : "NATIVE_HOME_UNAVAILABLE" }] }); };
    return {
        ...legacy,
        close() { native.close(); legacy.close(); available = false; },
        actions: {
            mutate: request => isNative(request) ? native.actions.mutate(requireNative(request)) : legacy.actions.mutate(request),
            editTask: (task, saved) => isNative(task) ? native.actions.editTask(requireNative(task), saved) : legacy.actions.editTask(task, saved)
        },
        async read() {
            const state = nativeTasks.availability?.();
            if (state && state !== "current") { available = false; return unavailable(state); }
            composing++;
            try { for (let attempt = 0; attempt < 3; attempt++) {
                const ng = nativeGeneration, lg = session.generation;
                const l = await legacy.read(); if (!l || closed) return null;
                const ticket = generation, n = await native.read();
                if (closed || generation !== ticket) return null;
                if (!n) continue;
                if (n.availability !== "current") { available = false; return unavailable(); }
                if (ng !== nativeGeneration || lg !== session.generation) continue;
                try {
                    nativeRows = n.tasks; nativeContext = n.context;
                    const items = merge(l.items);
                    available = true; readState = "current";
                    return { items, changed: wrapperSignature(items) !== last, availability: "current", countComplete: true, diagnostics: l.diagnostics };
                } catch (_) { available = false; return unavailable(); }
            }
            available = false; return unavailable();
            } catch (_) { available = false; return unavailable(); }
            finally { composing--; }
        },
        previousPresentation() {
            const previous = previousPresentations.get(plugin);
            if (!previous || previous.source !== nativeTasks || previous.vault !== plugin.app?.vault?.adapter?.getBasePath?.()) return [];
            return previous.items.flatMap(item => {
                const ref = item.task.nativeReference, context = previous.contexts.find(c => sameWorkspace(c.owner, ref.owner)), owner = resolveNativeOwner(ref.owner);
                if (!context || !owner || owner.deleted || owner.root !== context.root || owner.path !== context.dashboard) return [];
                return [{ ...item, owner, task: { ...item.task, steps: item.task.steps.map(s => ({ ...s })), nativeReadOnly: true } }];
            });
        },
        accept(items) {
            if (available) {
                accepted = items; native.accept(nativeRows);
                previousPresentations.set(plugin, { source: nativeTasks, vault: plugin.app?.vault?.adapter?.getBasePath?.(),
                    contexts: nativeContext, items: items.filter(item => isNative(item.task)) });
            }
            legacy.accept(items);
        },
        reconcile(items, edit) {
            if (closed) return [];
            if (edit.backend === "native") {
                nativeRows = native.reconcile(nativeRows, edit); available = edit.availability === "current";
                // Current presentation is accepted only by a new bracketed read.
                if (!available) return unavailable().items;
                return nativeContext ? merge(items) : items;
            }
            const result = legacy.reconcile(items.filter(item => !isNative(item.task)), edit);
            return nativeContext ? merge(result) : result;
        },
        toggle: (task, completed) => isNative(task) ? native.toggle(requireNative(task), completed) : legacy.toggle(task, completed),
        async clear(requests, confirmMany) {
            if (requests.some(isNative)) throw new TaskServiceError("UNSUPPORTED", "Native clear-completed is unavailable.");
            return legacy.clear(requests, confirmMany);
        },
        async reveal(task) {
            if (isNative(task)) throw new TaskServiceError("UNSUPPORTED", "Native source navigation is unavailable.");
            return legacy.reveal(task);
        },
        availability: () => { if (closed) return "unavailable"; const state = nativeTasks.availability?.(); return state && state !== "current" ? state : available ? "current" : readState; }
    };
}
module.exports = { createHomeTaskRead };
