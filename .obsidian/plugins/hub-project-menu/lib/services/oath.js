"use strict";
const { randomUUID } = require("crypto");
const { taskGroups, readTaskSnapshot } = require("../domain/task-planning");
const { taskLineDetails, taskIdentity, applyTaskEdit, normalizedTaskText } = require("../domain/tasks");
const { isCommitted, validateOath, oathRequirements, oathTime, normalizeOath, fulfilmentTime } = require("../domain/oath");

const { workspaceRef, validWorkspace, sameWorkspace, taskKey } = require("../domain/oath-workspace");
const { StrictOathCoordinator } = require("./oath-strict");
const { applications, strictPolicy, STRICT_TERMS } = require("../domain/oath-strict");

class HubOathService {
    constructor(plugin, fullscreen, options = {}) {
        this.plugin = plugin; this.app = plugin.app; this.fullscreen = fullscreen;
        this.deviceId = plugin.dataStore.deviceId; this.now = options.now ?? Date.now;
        this.listeners = new Set(); this.clockListeners = new Set();
        this.work = this.committed ? this.current.tasks.map(ref => ({ ref, task: null })) : [];
        this.awaitingIndex = new Map(); this.needsRead = true;
        this.queue = Promise.resolve(); this.disposed = false; this.refreshing = null;
        this.notice = options.notice ?? (text => new (require("obsidian").Notice)(text));
        // Product opt-in is device-local and off until explicitly saved.
        this.strict = options.strict ?? new StrictOathCoordinator();
        if (typeof this.bucket.strictEnabled === "boolean") this.strict.configureEnabled(this.bucket.strictEnabled || this.isStrict && this.committed);
        this.strictReviews = new Map(); this.strictStatus = this.strict.health ?? { status: "idle", warnings: [] };
        this.strict.onHealth(health => { this.strictStatus = health; this.emit(); });
    }
    get bucket() { return this.plugin.projectWizard.data.oathsByDevice?.[this.deviceId] ?? { current: null, history: [] }; }
    get current() { return normalizeOath(this.bucket.current); }
    get fulfilled() { return this.current?.state === "fulfilled" || this.current?.fulfilledAt != null ||
        !!this.pendingFulfilment && this.pendingFulfilment.id === this.current?.id; }
    get committed() { return isCommitted(this.current); }
    get active() { return this.current?.state === "active"; }
    get isStrict() { return this.current?.policy?.mode === "strict"; }
    get strictEnabled() { return this.bucket.strictEnabled ?? this.strict.enabled; }
    get strictSupported() { return !!this.strict.host && this.strict.host.available !== false && !!this.strict.observer; }
    setStrictEnabled(value) {
        return this.enqueue(async () => {
            if (value && !this.strictSupported) throw Error("Strict Oath requires the Windows desktop host.");
            await this.persist(this.current, this.bucket.history ?? [], { strictEnabled: !!value });
            // Disabling future setup never releases an existing commitment.
            this.strict.configureEnabled(!!value || this.isStrict && this.committed); this.emit();
        });
    }
    pickStrictApplication() { return this.strict.host?.pickApplication?.() ?? Promise.resolve(null); }
    async launchStrictApplication(executable, url = null) {
        if (!this.active || !this.isStrict) throw Error("No active Strict Oath.");
        return this.strict.launch(executable, url);
    }
    get strictApplications() { return [...(this.bucket.strictApplications ?? [])]; }
    setStrictApplications(values) {
        return this.enqueue(async () => {
            const verified = await this.strict.verifyApplications(applications(values));
            await this.persist(this.current, this.bucket.history ?? [], { strictApplications: verified }); this.emit();
            return verified;
        });
    }
    strictSignature(draft) {
        return JSON.stringify([draft.mode, draft.start, draft.scheduledAt, draft.durationMs, draft.workspace,
            draft.tasks?.map(taskKey), draft.applications ?? null]);
    }
    async reviewStrict(draft) {
        this.validateDraft(draft);
        if (draft.mode !== "strict" || !this.strictEnabled || !this.strict.enabled) throw Error("Strict Oath is disabled. Enable it in Settings → The Oath first.");
        const signature = this.strictSignature(draft);
        const policy = strictPolicy(draft, this.strictApplications);
        policy.applications = await this.strict.verifyApplications(policy.applications);
        const nonce = randomUUID(), preflight = await this.strict.preflight(policy);
        if (signature !== this.strictSignature(draft)) throw Error("Your Oath changed while checking applications. Review it again.");
        this.strictReviews.clear(); // one review per setup, never an unbounded registry
        this.strictReviews.set(nonce, { signature, policy, expires: this.now() + 15 * 60000 });
        return { confirmation: { nonce, version: policy.confirmationVersion }, policy: JSON.parse(JSON.stringify(policy)), preflight, terms: STRICT_TERMS };
    }
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
    setupRequirements(draft) {
        const available = new Set(this.workspaceTasks(draft.workspace).map(taskKey));
        return oathRequirements(draft, this.now()).map(field => {
            if (field.key === "Workspace" && field.complete && !this.resolveWorkspace(draft.workspace))
                return { ...field, complete: false, error: "Choose an available Active Project or Resource." };
            if (field.key === "Tasks" && !this.ready()) return { ...field, complete: false, error: "Wait for the task index to finish loading." };
            if (field.key === "Tasks" && field.complete && draft.tasks.some(task => !available.has(taskKey(task))))
                return { ...field, complete: false, error: "Selected tasks must be open tasks from this workspace. Update your selection." };
            return field;
        });
    }
    validateDraft(draft) {
        validateOath(draft, this.now());
        const missing = this.setupRequirements(draft).find(field => !field.complete);
        if (missing) throw Error(missing.error);
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
        if (this.isStrict) {
            this.strictStatus = { status: this.active ? "degraded" : "waiting", warnings: ["The selected workspace is unavailable. An active Strict Oath can still fulfill by time."] };
            this.emit(); return;
        }
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
    async persist(current, history = this.bucket.history ?? [], extra = {}) {
        const data = this.plugin.projectWizard.data, previous = data.oathsByDevice;
        data.oathsByDevice = { ...previous, [this.deviceId]: { ...this.bucket, ...extra, current, history } };
        try { await this.plugin.dataStore.save(data); }
        catch (error) { data.oathsByDevice = previous; throw error; }
    }
    async start() {
        if (this.disposed) return;
        this.fullscreen.restore(!this.isStrict && this.active && this.current?.fullscreenOwned);
        try {
            if (this.active && this.isStrict) {
                await this.recoverStrict();
                if (this.active && this.workspace) await this.enterWorkspace();
            } else if (this.active) {
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
        if (this.isStrict && this.active && !this.strict.owns(this.current.id, this.current.strictSessionId)) {
            await this.recoverStrict(); return;
        }
        if (this.isStrict && this.active && !this.workspace) await this.invalidateWorkspace();
        const starting = this.current.state === "scheduled" && this.now() >= this.current.scheduledAt;
        const changed = readTasks || starting ? await this.resolveWork() : false;
        if (starting) await this.activate();
        const fulfilled = await this.markFulfilled();
        if (this.isStrict && this.active && this.now() - (this.current.lastObservedAt ?? this.current.startedAt) >= 30000)
            await this.persist({ ...this.current, lastObservedAt: this.now() });
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
        if (this.isStrict) return this.activateStrict();
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
        if (draft.mode === "strict") draft = { ...draft, workspace: { ...draft.workspace },
            tasks: draft.tasks?.map(task => ({ ...task })), applications: draft.applications?.slice(), strictConfirmation: { ...draft.strictConfirmation } };
        return this.enqueue(async () => {
            if (this.committed) throw Error("There is already an active or scheduled Oath on this device.");
            this.validateDraft(draft);
            let policy = strictPolicy(draft, this.strictApplications);
            if (policy.mode === "strict") {
                const review = this.strictReviews.get(draft.strictConfirmation?.nonce);
                if (!this.strictEnabled || !this.strict.enabled || !review || review.expires < this.now() || review.signature !== this.strictSignature(draft) || draft.strictConfirmation.version !== review.policy.confirmationVersion)
                    throw Error("Review and confirm the Strict Oath restrictions before taking it.");
                policy = JSON.parse(JSON.stringify(review.policy));
                const preflight = await this.strict.preflight(policy);
                if (draft.start !== "scheduled" && !preflight.ready) {
                    this.strictStatus = { ...preflight, status: "waiting" }; this.emit();
                    throw Error(preflight.blockers.length ? "Close the detected unpermitted applications and retry." : preflight.warnings.join(" "));
                }
            }
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
                tasks: refs, state: "scheduled", completedAt: null, fullscreenOwned: false,
                ...(policy.mode === "strict" ? { policy, strictSessionId: null } : {}) });
            this.strictReviews.clear();
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
        if (record.policy?.mode === "strict") {
            await this.strict.release(record.id);
            this.strict.configureEnabled(this.strictEnabled);
        }
        else await this.fullscreen.exit();
        this.work = []; this.emit(); this.notice(state === "fulfilled" ? "Oath fulfilled." : "Oath broken.");
        this.awaitingIndex.clear();
    }
    // Every UI/native exit request goes here. Only an explicit destructive
    // confirmation may break an unfulfilled commitment. Recheck at click time.
    end(id, outcome) {
        return this.enqueue(async () => {
            if (this.current?.id !== id || !this.committed) return "inactive";
            if (this.current.state === "scheduled" && (this.isStrict || this.now() < this.current.scheduledAt)) {
                if (outcome !== "cancel") return "scheduled";
                await this.persist(null); this.work = []; this.awaitingIndex.clear(); this.emit(); return "cancelled";
            }
            await this.reconcile(true);
            if (!this.committed) return "inactive";
            if (this.isStrict && !this.fulfilled) return "strict-unfulfilled";
            if (!this.fulfilled && outcome !== "broken") return "confirmation-required";
            await this.#finish(this.fulfilled ? "fulfilled" : "broken");
            return "ended";
        });
    }
    returnToFullscreen() {
        return this.enqueue(async () => {
            if (!this.active) return;
            if (this.isStrict) { if (!this.strict.owns(this.current.id, this.current.strictSessionId)) await this.recoverStrict(); return; }
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
    async activateStrict() {
        if (this.now() < (this.nextStrictAttempt ?? 0)) return false;
        this.nextStrictAttempt = this.now() + 5000;
        if (!this.resolveWorkspace(this.current?.workspace)) { await this.invalidateWorkspace(); return false; }
        const oath = this.current;
        try {
            const prepared = await this.strict.prepare(oath);
            if (!prepared.ready) { this.strictStatus = { ...prepared.preflight, status: "waiting" }; this.emit(); return false; }
            if (this.disposed) { await this.strict.release(oath.id); return false; }
            if (!this.resolveWorkspace(oath.workspace)) { await this.strict.release(oath.id); await this.invalidateWorkspace(); return false; }
            await this.persist({ ...oath, state: "active", startedAt: this.now(), lastObservedAt: this.now(), strictSessionId: prepared.sessionId, fullscreenOwned: false });
            this.strict.commit(oath.id);
        } catch (error) {
            await this.strict.release(oath.id);
            this.strictStatus = { status: "waiting", warnings: [error.message] }; this.emit(); throw error;
        }
        await this.enterWorkspace(); this.emit(); return true;
    }
    async recoverStrict() {
        const oath = this.current;
        if (this.strict.owns(oath.id, oath.strictSessionId)) { this.strictStatus = this.strict.health; return; }
        // Detect process interruption; never re-enter lockdown on startup.
        const record = { ...oath, state: "interrupted", completedAt: oath.lastObservedAt ?? oath.startedAt ?? this.now(), interruptionDetectedAt: this.now(), interruptionTimeUnknown: true,
            interruptionReason: "strict-host-session-unavailable", fullscreenOwned: false };
        record.elapsedMs = oathTime(record, record.completedAt).elapsedMs;
        await this.persist(record, [...(this.bucket.history ?? []), record]);
        this.work = []; this.awaitingIndex.clear(); this.emit();
    }
    destroy() { this.disposed = true; clearInterval(this.timer); this.listeners.clear(); this.clockListeners.clear(); this.strict.detach(); this.fullscreen.destroy(); }
}
module.exports = { HubOathService };
