"use strict";
const { randomUUID } = require("crypto");
const { taskGroups } = require("../domain/task-planning");
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
        this.taskPanels = new Map(); this.needsRead = true;
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
    ready(ref = this.current?.workspace) {
        const host = this.plugin.nativeTaskHost;
        return !!host && (ref ? host.matches(ref) && (host.nativeTasks.availabilityFor?.(ref) ?? host.nativeTasks.availability()) === "current" : host.nativeTasks.availability() === "current");
    }
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
    ownsTask(ref, task) { return sameWorkspace(ref, task.nativeReference?.owner); }
    workspaceTasks(ref) {
        this.ensureCommittedRead();
        if (!this.resolveWorkspace(ref) || !this.ready(ref)) return [];
        const panel = this.taskPanels.get(JSON.stringify([ref.type,ref.id])), snapshot = panel?.snapshot();
        if (snapshot?.availability !== "current") return [];
        const groups = taskGroups(snapshot.tasks.filter(task => !task.completed && !task.nativeReadOnly), new Date(this.now()));
        return [...groups.active,...groups.future];
    }
    setupRequirements(draft) {
        const available = new Set(this.workspaceTasks(draft.workspace).map(taskKey));
        return oathRequirements(draft, this.now()).map(field => {
            if (field.key === "Workspace" && field.complete && !this.resolveWorkspace(draft.workspace))
                return { ...field, complete: false, error: "Choose an available Active Project or Resource." };
            if (field.key === "Tasks" && !this.ready(draft.workspace)) return { ...field, complete: false, error: "Wait for native tasks to finish loading." };
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
        this.work = []; this.emit();
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
        if (this.disposed || this.timer) return;
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
        this.ensureCommittedRead();
        // Native subscriptions refresh accepted work; the clock checks time only.
        this.timer = setInterval(() => { this.tickDisplay(); void this.refresh(false); }, 1000);
        this.timer.unref?.();
        await this.refresh();
    }
    error(error) {
        console.error("Oath update failed", error);
        if (this.lastError !== error.message) { this.lastError = error.message; this.notice(`The Oath could not be updated: ${error.message}`); }
    }
    ensureCommittedRead() {
        if (this.readClosed || this.disposed) return;
        const host = this.plugin.nativeTaskHost;
        if (!host) return;
        const stops = this.committedReadStops ??= [];
        for (const owner of host.nativeTasks.owners ?? [host.nativeTasks.owner]) {
            if (this.taskPanels.has(JSON.stringify([owner.type, owner.id]))) continue;
            const component = { register: stop => stops.push(stop) };
            const panel = host.nativeTasks.createPanelRead({ plugin:this.plugin,component,workspace:owner,changed:()=>{ if (!this.disposed) { this.emit(); if (this.committed) void this.refresh(); } } });
            this.taskPanels.set(JSON.stringify([owner.type,owner.id]),panel);
        }
        this.committedReadStop = () => { stops.splice(0).forEach(stop=>stop());this.taskPanels.clear(); };
        if (!this.committedReadRegistered) { this.committedReadRegistered = true; this.plugin.register(() => this.closeCommittedRead()); }
    }
    closeCommittedRead() {
        this.readClosed = true;
        this.readSequence = (this.readSequence ?? 0) + 1;
        this.committedReadStop?.(); this.committedReadStop = null;
    }
    async resolveWork() {
        if (!this.committed || !this.ready() || this.disposed || this.readClosed) return false;
        this.ensureCommittedRead();
        const oath = this.current, revision = this.readRevision ?? 0, sequence = this.readSequence = (this.readSequence ?? 0) + 1;
        const scope = () => { const context = this.resolveWorkspace(oath.workspace, false); return JSON.stringify(context ? [context.path, context.root] : null); };
        const signature = scope(), commitment = JSON.stringify([oath.id, oath.workspace, oath.tasks]);
        const current = () => !this.disposed && !this.readClosed && this.committed && sequence === this.readSequence && revision === (this.readRevision ?? 0) &&
            commitment === JSON.stringify([this.current.id, this.current.workspace, this.current.tasks]);
        const runtime = this.plugin.nativeTaskHost.runtime(oath.workspace), result = await runtime.list();
        if (!current()) return false;
        if (scope() !== signature) { this.needsRead = true; return false; }
        const work = oath.tasks.map(ref => ({ ref, task: ref.authorityId === runtime.info().authority.authorityId ? result.tasks.find(task=>task.id===ref.id && this.ownsTask(oath.workspace,task)) ?? null : null }));
        this.readDiagnostics = [];
        const changed = JSON.stringify(work) !== JSON.stringify(this.work);
        this.work = work;
        return changed;
    }
    refresh(readTasks = true) {
        if (readTasks) this.readRevision = (this.readRevision ?? 0) + 1;
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
            if (!this.ready(draft.workspace)) throw Error("Wait for native tasks to finish loading.");
            const runtime = this.plugin.nativeTaskHost.runtime(draft.workspace), snapshot = await runtime.list(), seen = new Set();
            const refs = (draft.tasks ?? []).map(selected => {
                const ref = selected.nativeReference, task = snapshot.tasks.find(task=>task.id===ref?.taskId);
                if (!task || task.completed || task.nativeReadOnly || !this.ownsTask(draft.workspace,task) || task.nativeReference.authorityId!==ref.authorityId || task.nativeReference.taskRevision!==ref.taskRevision) throw Error("A selected native task changed. Refresh the Oath selection.");
                if (seen.has(task.id)) throw Error("Select each task once.");seen.add(task.id);
                return { id:task.id,authorityId:ref.authorityId,owner:{...ref.owner},text:task.text };
            });
            if (!this.resolveWorkspace(draft.workspace)) throw Error("The selected workspace is no longer available.");
            const now = this.now();
            await this.persist({ id: randomUUID(), deviceId: this.deviceId, takenAt: now, createdAt: now,
                scheduledAt: draft.start === "scheduled" ? draft.scheduledAt : now, startedAt: null,
                durationMs: draft.durationMs, fulfilledAt: null, workspace: workspaceRef(this.resolveWorkspace(draft.workspace)),
                tasks: refs, state: "scheduled", completedAt: null, fullscreenOwned: false,
                ...(policy.mode === "strict" ? { policy, strictSessionId: null } : {}) });
            this.strictReviews.clear();
            this.work = refs.map(ref=>({ref,task:snapshot.tasks.find(task=>task.id===ref.id)}));
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
        
    }
    // Every UI/native exit request goes here. Only an explicit destructive
    // confirmation may break an unfulfilled commitment. Recheck at click time.
    end(id, outcome) {
        return this.enqueue(async () => {
            if (this.current?.id !== id || !this.committed) return "inactive";
            if (this.current.state === "scheduled" && (this.isStrict || this.now() < this.current.scheduledAt)) {
                if (outcome !== "cancel") return "scheduled";
                await this.persist(null); this.work = []; this.emit(); return "cancelled";
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
    changed() { if (this.committed) void this.refresh(); }
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
        this.work = []; this.emit();
    }
    destroy() { this.disposed = true; this.closeCommittedRead(); clearInterval(this.timer); this.listeners.clear(); this.clockListeners.clear(); this.strict.detach(); this.fullscreen.destroy(); }
}
module.exports = { HubOathService };
