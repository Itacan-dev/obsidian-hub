"use strict";
const { randomUUID } = require("crypto");
const { taskGroups, readTaskSnapshot } = require("../domain/task-planning");
const { taskLineDetails, taskIdentity, applyTaskEdit, normalizedTaskText } = require("../domain/tasks");
const { isCommitted, validateOath, oathTime, normalizeOath, fulfilmentTime } = require("../domain/oath");

const { workspaceRef, validWorkspace, sameWorkspace, taskKey } = require("../domain/oath-workspace");

class HubOathService {
    constructor(plugin, fullscreen, options = {}) {
        this.plugin = plugin; this.app = plugin.app; this.fullscreen = fullscreen;
        this.deviceId = plugin.dataStore.deviceId; this.now = options.now ?? Date.now;
        this.listeners = new Set(); this.clockListeners = new Set();
        this.work = this.committed ? this.current.tasks.map(ref => ({ ref, task: null })) : [];
        this.awaitingIndex = new Map(); this.needsRead = true;
        this.queue = Promise.resolve(); this.disposed = false; this.refreshing = null;
        this.notice = options.notice ?? (text => new (require("obsidian").Notice)(text));
    }
    get bucket() { return this.plugin.projectWizard.data.oathsByDevice?.[this.deviceId] ?? { current: null, history: [] }; }
    get current() { return normalizeOath(this.bucket.current); }
    get fulfilled() { return this.current?.state === "fulfilled" || this.current?.fulfilledAt != null ||
        !!this.pendingFulfilment && this.pendingFulfilment.id === this.current?.id; }
    get committed() { return isCommitted(this.current); }
    get active() { return this.current?.state === "active"; }
    api() { return this.app.plugins.getPlugin?.("dataview")?.api ?? this.app.plugins.plugins?.dataview?.api; }
    ready() { const api = this.api(); return !!api && api.index?.initialized !== false; }
    tasks() { return this.ready() ? this.plugin.taskData.readPages(this.api()).flatMap(page => page.file.tasks) : []; }
    workspaces(type) {
        const wizard = this.plugin.projectWizard;
        return type === "resource" ? wizard.getResourceTypes() :
            wizard.getProjectRecords().filter(context => context.status === "active");
    }
    resolveWorkspace(ref, eligible = true) {
        if (!validWorkspace(ref)) return null;
        const wizard = this.plugin.projectWizard;
        const context = ref.type === "resource" ? wizard.getResourceById(ref.id) : wizard.getProjectById(ref.id);
        if (!sameWorkspace(ref, workspaceRef(context)) || !this.app.vault.getAbstractFileByPath(context.path)) return null;
        return eligible && ref.type === "project" && context.status !== "active" ? null : context;
    }
    get workspace() { return this.resolveWorkspace(this.current?.workspace, false); }
    ownsTask(ref, task) {
        const context = this.resolveWorkspace(ref, false);
        return !!context && (task.path === context.path || task.path?.startsWith(context.root + "/"));
    }
    workspaceTasks(ref) {
        const context = this.resolveWorkspace(ref);
        if (!this.ready() || !context) return [];
        const tasks = this.plugin.taskData.readPages(this.api(), context.root).flatMap(page => page.file.tasks);
        const groups = taskGroups(tasks.filter(task => !task.completed && !task.identityConflict &&
            (task.path === context.path || task.path?.startsWith(context.root + "/"))), new Date(this.now()));
        return [...groups.active, ...groups.future];
    }
    validateDraft(draft) {
        validateOath(draft, this.now());
        if (!this.resolveWorkspace(draft.workspace)) throw Error("Choose an available Active Project or Resource.");
        if (!this.ready()) throw Error("Wait for the task index to finish loading.");
        const available = new Set(this.workspaceTasks(draft.workspace).map(taskKey));
        if (draft.tasks.some(task => !available.has(taskKey(task)))) {
            throw Error("Selected tasks must be open tasks from this workspace. Update your selection.");
        }
    }
    projectWorkspaceForPath(path) {
        if (!this.active || this.current.workspace?.type !== "project" || typeof path !== "string") return null;
        const project = this.workspace;
        if (!project) return null;
        const contains = root => path === root || path.startsWith(root + "/");
        if (contains(project.root)) return project;
        // Resolve the live relationship by stable folder ID on every check.
        // Renames, new shares and detachments must not leave a cached allowance.
        const ids = project.resourceFolderIds ?? [];
        return ids.length && this.plugin.projectWizard.getResourceFolders(ids).some(folder => contains(folder.path))
            ? project : null;
    }
    canOpen(reference, notify = true) {
        if (!this.active || !reference) return true;
        const wizard = this.plugin.projectWizard;
        const path = typeof reference === "string" ? reference : reference.path;
        if (this.projectWorkspaceForPath(path)) return true;
        const context = typeof reference === "object" && workspaceRef(reference) ? reference :
            wizard.getResourceById(path) || wizard.getResourceForPath(path) ||
            wizard.getProjectById(path) || wizard.getProjectForPath(path);
        if (!context || sameWorkspace(this.current.workspace, workspaceRef(context))) return true;
        if (notify) this.notice("Locked during this Oath");
        return false;
    }
    async invalidateWorkspace() {
        await this.persist({ ...this.current, state: "invalid", fullscreenOwned: false,
            invalidReason: "workspace-unavailable" });
        await this.fullscreen.exit();
        this.work = []; this.awaitingIndex.clear(); this.emit();
        this.notice("This Oath's workspace is unavailable. Make a new Oath and select an Active Project or Resource.");
    }
    async enterWorkspace() {
        const context = this.workspace;
        if (context) await this.plugin.workspaceModes?.openProjectFull(context);
    }
    onChange(callback, clock = false) { const set = clock ? this.clockListeners : this.listeners; set.add(callback); return () => set.delete(callback); }
    notify(listeners) { for (const callback of listeners) { try { callback(); } catch (error) { console.error("Oath view update failed", error); } } }
    emit() { this.notify(this.listeners); this.tickDisplay(); }
    tickDisplay() { this.notify(this.clockListeners); }
    enqueue(work) { const result = this.queue.then(() => { if (!this.disposed) return work(); }); this.queue = result.catch(() => {}); return result; }
    async persist(current, history = this.bucket.history ?? []) {
        const data = this.plugin.projectWizard.data, previous = data.oathsByDevice;
        data.oathsByDevice = { ...previous, [this.deviceId]: { current, history } };
        try { await this.plugin.dataStore.save(data); }
        catch (error) { data.oathsByDevice = previous; throw error; }
    }
    async start() {
        if (this.disposed) return;
        this.fullscreen.restore(this.active && this.current?.fullscreenOwned);
        try {
            if (this.active) {
                if (!this.workspace) await this.invalidateWorkspace();
                else { await this.returnToFullscreen(); await this.enterWorkspace(); }
            }
            else if (this.committed && JSON.stringify(this.current) !== JSON.stringify(this.bucket.current)) await this.persist(this.current);
        } catch (error) { this.error(error); }
        this.plugin.taskData.subscribe(this.plugin, () => { void this.refresh(); });
        // Index events read work. The clock only checks timestamps, avoiding a
        // whole-vault task query and Markdown reads on every countdown tick.
        this.timer = setInterval(() => { this.tickDisplay(); void this.refresh(false); }, 1000);
        this.timer.unref?.();
        await this.refresh();
    }
    error(error) {
        console.error("Oath update failed", error);
        if (this.lastError !== error.message) { this.lastError = error.message; this.notice(`The Oath could not be updated: ${error.message}`); }
    }
    async resolveWork() {
        if (!this.committed || !this.ready()) return false;
        const tasks = this.tasks(), contents = new Map();
        const work = [];
        for (const ref of this.current.tasks) {
            const matches = tasks.filter(task => task.hubTaskId === ref.id);
            let task = matches.length === 1 && !matches[0].identityConflict ? matches[0] : null;
            if (task) this.awaitingIndex.delete(ref.id);
            // Bridge only our own freshly assigned IDs until Dataview imports
            // them. Other missing, nested or copied identities stay unavailable.
            const fresh = this.awaitingIndex.get(ref.id);
            if (!matches.length && fresh && tasks.some(item => !item.hubTaskId && item.path === fresh.path &&
                item.line === fresh.line && normalizedTaskText(item.text) === normalizedTaskText(fresh.text))) task = fresh;
            if (task) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(task.path);
                    if (!contents.has(task.path)) contents.set(task.path, await this.app.vault.read(file));
                    const content = contents.get(task.path), lines = content.split(/\r?\n/);
                    const line = lines.findIndex(value => taskIdentity(value) === ref.id && taskLineDetails(value));
                    if (line < 0) throw Error("Selected task unavailable");
                    const snapshot = readTaskSnapshot(content, { ...task, line, text: taskLineDetails(lines[line]).text, hubTaskId: ref.id });
                    task = { ...task, ...snapshot, ...this.plugin.taskEditor.metadata(ref.id) };
                } catch (_) { task = null; }
            }
            if (task && !this.ownsTask(this.current.workspace, task)) task = null;
            work.push({ ref, task });
        }
        const changed = JSON.stringify(work) !== JSON.stringify(this.work);
        this.work = work;
        return changed;
    }
    refresh(readTasks = true) {
        this.needsRead ||= readTasks;
        if (this.refreshing || this.disposed) return this.refreshing ?? Promise.resolve();
        this.refreshing = this.enqueue(async () => {
            do {
                const read = this.needsRead; this.needsRead = false;
                await this.reconcile(read);
            } while (this.needsRead && this.committed && !this.disposed);
        }).catch(error => { this.needsRead = true; this.error(error); }).finally(() => { this.refreshing = null; });
        return this.refreshing;
    }
    async reconcile(readTasks) {
        if (!this.committed || this.disposed) return;
        const starting = this.current.state === "scheduled" && this.now() >= this.current.scheduledAt;
        const changed = readTasks || starting ? await this.resolveWork() : false;
        if (starting) await this.activate();
        const fulfilled = await this.markFulfilled();
        if (changed && !fulfilled) this.emit();
    }
    captureFulfilment() {
        if (!this.active || this.current.fulfilledAt != null) return;
        const at = fulfilmentTime(this.current, this.work, this.now());
        if (at != null && this.pendingFulfilment?.id !== this.current.id) this.pendingFulfilment = { id: this.current.id, at };
    }
    async markFulfilled() {
        this.captureFulfilment();
        if (!this.active || this.current.fulfilledAt != null || this.pendingFulfilment?.id !== this.current.id) return false;
        // Retain the latch if saving fails, even if a task is subsequently unchecked.
        await this.persist({ ...this.current, fulfilledAt: this.pendingFulfilment.at });
        this.pendingFulfilment = null;
        this.emit(); return true;
    }
    async activate() {
        if (!this.resolveWorkspace(this.current?.workspace)) { await this.invalidateWorkspace(); return false; }
        const owned = await this.fullscreen.enter();
        if (!this.fullscreen.isFull() && !owned) throw Error("Enforced fullscreen is unavailable on this device.");
        try {
            if (!this.resolveWorkspace(this.current.workspace)) { await this.invalidateWorkspace(); return false; }
            await this.persist({ ...this.current, state: "active", startedAt: this.now(), fullscreenOwned: owned });
        } catch (error) { await this.fullscreen.exit(); throw error; }
        await this.enterWorkspace();
        this.emit();
    }
    take(draft) {
        return this.enqueue(async () => {
            if (this.committed) throw Error("There is already an active or scheduled Oath on this device.");
            this.validateDraft(draft);
            if (draft.tasks?.length && !this.ready()) throw Error("Wait for the task index to finish loading.");
            const selectedTasks = draft.tasks ?? [], indexed = selectedTasks.length ? this.tasks() : [];
            if (selectedTasks.some(task => task.hubTaskId && indexed.some(item => item.hubTaskId === task.hubTaskId && item.identityConflict))) {
                throw Error("A selected task has a copied ID. Resolve the copy before taking the Oath.");
            }
            // Assign IDs through the existing source mutation queue. ID comments
            // are inert if the final Oath state write fails; no task data moves.
            const refs = await this.plugin.enqueueTaskMutation(async () => {
                const selected = [], seen = new Set();
                for (const task of selectedTasks) {
                    if (task.identityConflict) throw Error("A selected task has a copied ID. Resolve the copy before taking the Oath.");
                    const file = this.plugin.taskEditor.file(task.path);
                    await this.app.vault.process(file, content => {
                        const snapshot = readTaskSnapshot(content, { ...task, path: file.path });
                        if (snapshot.completed || !this.ownsTask(draft.workspace, { path: file.path })) {
                            throw Error("A selected task is no longer available in this workspace.");
                        }
                        const id = snapshot.hubTaskId ?? randomUUID();
                        if (seen.has(id)) return content;
                        seen.add(id); selected.push({ id, path: file.path, text: snapshot.text });
                        if (snapshot.hubTaskId) return content;
                        const eol = content.includes("\r\n") ? "\r\n" : "\n", lines = content.split(/\r?\n/);
                        const native = lines[snapshot.line].match(/\s+\^[a-zA-Z0-9-]+\s*$/)?.[0] ?? "";
                        lines[snapshot.line] = (native ? lines[snapshot.line].slice(0, -native.length) : lines[snapshot.line]).trimEnd() + ` <!-- hub-task:${id} -->` + native;
                        return lines.join(eol);
                    });
                }
                return selected;
            });
            if (!this.resolveWorkspace(draft.workspace)) throw Error("The selected workspace is no longer available.");
            const now = this.now();
            await this.persist({ id: randomUUID(), deviceId: this.deviceId, takenAt: now, createdAt: now,
                scheduledAt: draft.start === "scheduled" ? draft.scheduledAt : now, startedAt: null,
                durationMs: draft.durationMs, fulfilledAt: null, workspace: workspaceRef(this.resolveWorkspace(draft.workspace)),
                tasks: refs, state: "scheduled", completedAt: null, fullscreenOwned: false });
            // The freshly marked lines may not be imported by Dataview yet.
            this.work = await this.readNewWork(refs, selectedTasks);
            this.awaitingIndex = new Map(this.work.filter(item => item.task).map(item => [item.ref.id, item.task]));
            try {
                if (draft.start !== "scheduled") { await this.activate(); await this.markFulfilled(); }
            } catch (error) {
                // The commitment was already saved. Reconciliation retries a
                // failed state transition; do not invite taking a second Oath.
                this.error(error);
            }
            this.emit();
        });
    }
    async readNewWork(refs, tasks) {
        return Promise.all(refs.map(async ref => {
            try {
                const file = this.plugin.taskEditor.file(ref.path), content = await this.app.vault.read(file);
                const lines = content.split(/\r?\n/), line = lines.findIndex(value => taskIdentity(value) === ref.id && taskLineDetails(value));
                const snapshot = readTaskSnapshot(content, { path: ref.path, line, text: ref.text, hubTaskId: ref.id });
                const original = tasks.find(task => task.path === ref.path && task.line === line) ?? {};
                return { ref, task: { ...original, ...snapshot, hubTaskId: ref.id, ...this.plugin.taskEditor.metadata(ref.id) } };
            } catch (_) { return { ref, task: null }; }
        }));
    }
    async #finish(state, completedAt = this.now()) {
        const record = { ...this.current, state, completedAt, fullscreenOwned: false };
        record.elapsedMs = oathTime(record, completedAt).elapsedMs;
        await this.persist(record, [...(this.bucket.history ?? []), record]);
        await this.fullscreen.exit();
        this.work = []; this.emit(); this.notice(state === "fulfilled" ? "Oath fulfilled." : "Oath broken.");
        this.awaitingIndex.clear();
    }
    // Every UI/native exit request goes here. Only an explicit destructive
    // confirmation may break an unfulfilled commitment. Recheck at click time.
    end(id, outcome) {
        return this.enqueue(async () => {
            if (this.current?.id !== id || !this.committed) return "inactive";
            if (this.current.state === "scheduled" && this.now() < this.current.scheduledAt) {
                if (outcome !== "cancel") return "scheduled";
                await this.persist(null); this.work = []; this.awaitingIndex.clear(); this.emit(); return "cancelled";
            }
            await this.reconcile(true);
            if (!this.committed) return "inactive";
            if (!this.fulfilled && outcome !== "broken") return "confirmation-required";
            await this.#finish(this.fulfilled ? "fulfilled" : "broken");
            return "ended";
        });
    }
    returnToFullscreen() {
        return this.enqueue(async () => {
            if (!this.active) return;
            const owned = await this.fullscreen.enter();
            if (!owned && !this.fullscreen.isFull()) throw Error("Enforced fullscreen is unavailable on this device.");
            await this.persist({ ...this.current, fullscreenOwned: owned });
        });
    }
    changed(edit) {
        if (!this.committed) return;
        this.work = this.work.map(item => item.task ? { ...item, task: applyTaskEdit([item.task], edit)[0] ?? null } : item);
        this.work = this.work.map(item => item.task && !this.ownsTask(this.current.workspace, item.task) ? { ...item, task: null } : item);
        this.captureFulfilment();
        this.emit(); void this.refresh();
    }
    destroy() { this.disposed = true; clearInterval(this.timer); this.listeners.clear(); this.clockListeners.clear(); this.fullscreen.destroy(); }
}
module.exports = { HubOathService };
