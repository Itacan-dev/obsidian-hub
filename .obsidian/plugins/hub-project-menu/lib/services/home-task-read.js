"use strict";
const { sameWorkspace } = require("../domain/workspace");
const previousPresentations = new WeakMap();
const wrapperSignature = items => JSON.stringify(items);
function createHomeTaskRead({ plugin, component, changed = () => { }, nativeTasks, resolveNativeOwner }) {
    let closed = false, last = null;
    const alive = () => {
        if (closed)
            throw Error("Home task view is closed.");
    };
    if (!nativeTasks || typeof resolveNativeOwner !== "function")
        throw Error("Native Home owners are required.");
    let readState = "loading", accepted = [], reading = null, dirty = false, notification = null;
    const owners = nativeTasks.owners ?? [nativeTasks.owner];
    const notify = () => {
        dirty = true;
        if (closed || notification !== null)
            return;
        notification = setTimeout(() => {
            notification = null;
            if (!closed)
                changed();
        }, 0);
    };
    const makePanel = owner => {
        const entry = { owner, value: null, state: "loading", panel: null };
        entry.panel = nativeTasks.createPanelRead({ plugin, component, workspace: owner, changed: notify });
        return entry;
    };
    const panels = owners.map(makePanel);
    function syncOwners() { const current = nativeTasks.owners ?? [nativeTasks.owner]; for (const owner of current) if (!panels.some(p => sameWorkspace(p.owner, owner))) panels.push(makePanel(owner)); for (let i = panels.length - 1; i >= 0; i--) if (!current.some(owner => sameWorkspace(owner, panels[i].owner))) { panels[i].panel.close(); panels.splice(i, 1); } }
    const previous = previousPresentations.get(plugin);
    if (previous?.source === nativeTasks && previous.vault === plugin.app?.vault?.adapter?.getBasePath?.()) {
        for (const entry of panels) {
            const context = previous.contexts.find(context => sameWorkspace(context.owner, entry.owner));
            if (context)
                entry.value = { context, tasks: previous.items.filter(item => sameWorkspace(item.task.nativeReference?.owner, entry.owner)).map(item => ({ ...item.task, nativeReadOnly: true })) };
        }
    }
    const entryFor = task => {
        const entry = panels.find(p => sameWorkspace(p.owner, task.nativeReference?.owner));
        if (!entry)
            throw new Error("Native task owner unavailable.");
        return entry;
    };
    const ownerState = entry => nativeTasks.availabilityFor?.(entry.owner) ?? nativeTasks.availability?.() ?? "current";
    const requireNative = task => {
        alive();
        const entry = entryFor(task);
        const state = entry.panel.availability?.() ?? entry.state;
        if (ownerState(entry) !== "current" || state !== "current" || task.nativeReadOnly)
            throw new Error("This native task is unavailable.");
        return entry;
    };
    function rememberPresentation(items) {
        accepted = items;
        previousPresentations.set(plugin, { source: nativeTasks, vault: plugin.app?.vault?.adapter?.getBasePath?.(),
            contexts: panels.flatMap(p => p.value?.context ? [p.value.context] : []), items });
    }
    function compose() {
        let items = [];
        for (const entry of panels) {
            const value = entry.value;
            if (!value?.context)
                continue;
            const tasks = entry.state === "current" ? value.tasks : value.tasks.map(task => ({ ...task, nativeReadOnly: true }));
            try {
                items = nativeTasks.mergeHome(items, tasks, entry.owner, value.context, resolveNativeOwner);
            }
            catch (_) {
                entry.state = "unavailable";
            }
        }
        return items;
    }
    const status = () => {
        const states = panels.map(p => p.state);
        return states.every(s => s === "current") ? "current" : states.some(s => s === "loading") ? "loading" : "unavailable";
    };
    async function read() {
        if (closed)
            return null;
        dirty = false;
        syncOwners();
        await Promise.all(panels.map(async (entry) => {
            const state = ownerState(entry);
            if (state !== "current") {
                entry.state = state;
                return;
            }
            try {
                const result = entry.panel.observe ? await entry.panel.observe() : await entry.panel.read();
                if (closed)
                    return;
                if (!result) {
                    entry.state = "loading";
                    dirty = true;
                    return;
                }
                entry.state = result.availability ?? "current";
                if (result.context)
                    entry.value = result;
                // Real runtime snapshots refresh themselves through their one shared
                // coordinator. Compatibility ports without snapshots are demand-read.
            }
            catch (_) {
                entry.state = "unavailable";
            }
        }));
        if (closed)
            return null;
        const items = compose(), countComplete = panels.every(p => p.state === "current");
        readState = countComplete ? "current" : status();
        return { items, changed: wrapperSignature(items) !== last, availability: readState, countComplete,
            owners: panels.map(p => ({ owner: p.owner, availability: p.state })), diagnostics: [] };
    }
    component.register(() => { closed = true; clearTimeout(notification); panels.forEach(p => p.panel.close()); });
    return {
        close() {
            if (closed)
                return;
            closed = true;
            clearTimeout(notification);
            panels.forEach(p => p.panel.close());
        },
        actions: {
            mutate: request => requireNative(request).panel.actions.mutate(request),
            editTask: (task, saved) => requireNative(task).panel.actions.editTask(task, saved)
        },
        read() {
            if (closed)
                return Promise.resolve(null);
            if (reading)
                return reading;
            reading = read().finally(() => {
                reading = null;
                if (dirty && !closed)
                    notify();
            });
            return reading;
        },
        previousPresentation() {
            const previous = previousPresentations.get(plugin);
            if (!previous || previous.source !== nativeTasks || previous.vault !== plugin.app?.vault?.adapter?.getBasePath?.())
                return [];
            return previous.items.flatMap(item => {
                const ref = item.task.nativeReference, context = previous.contexts.find(c => sameWorkspace(c.owner, ref.owner)), owner = resolveNativeOwner(ref.owner);
                if (!context || !owner || owner.deleted || owner.root !== context.root || owner.path !== context.dashboard)
                    return [];
                return [{ ...item, owner, task: { ...item.task, steps: item.task.steps.map(s => ({ ...s })), nativeReadOnly: true } }];
            });
        },
        accept(items) {
            rememberPresentation(items);
            for (const entry of panels)
                if (entry.state === "current" && entry.value)
                    entry.panel.accept(entry.value.tasks);
            last = wrapperSignature(items);
        },
        reconcile(items, edit) {
            if (closed)
                return [];
            if (edit.backend !== "native")
                throw Error("Native edit result required.");
            {
                const entry = entryFor({ nativeReference: { owner: edit.owner } });
                const tasks = entry.panel.reconcile(entry.value?.tasks ?? [], edit);
                entry.state = entry.panel.availability?.() ?? edit.availability;
                if (edit.availability === "current")
                    entry.value = entry.panel.snapshot?.() ?? { ...edit, context: edit.context ?? entry.value?.context, tasks };
                const result = compose();
                rememberPresentation(result);
                last = wrapperSignature(result);
                readState = status();
                notify();
                return result;
            }
        },
        toggle: (task, completed) => requireNative(task).panel.toggle(task, completed),
        availability: () => closed ? "unavailable" : readState
    };
}
module.exports = { createHomeTaskRead };
