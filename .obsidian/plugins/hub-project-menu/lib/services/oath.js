"use strict";
const { randomUUID } = require("crypto");
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
        this.strict.onHealth(health => { this.strictStatus = health; this.emit(); if (health.developmentRecoveryReleased) void this.refresh(); });
    }
    get bucket() { return this.plugin.projectWizard.data.oathsByDevice?.[this.deviceId] ?? { current: null, history: [] }; }
    get current() { return normalizeOath(this.bucket.current); }
    get fulfilled() { return this.current?.state === "fulfilled" || this.current?.fulfilledAt != null || fulfilmentTime(this.current,this.now())!=null ||
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
        return JSON.stringify([draft.mode, draft.start, draft.scheduledAt, draft.durationMs, draft.workspace, draft.planId, draft.planEntryIds,
            draft.tasks?.map(taskKey), draft.applications ?? null, draft.applicationCheckMode ?? "automatic", draft.manualApplicationReviewAcknowledged === true]);
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
    resolveWorkspace(ref, eligible = true) {
        if (!validWorkspace(ref)) return null;
        const wizard = this.plugin.projectWizard;
        const context = ref.type === "resource" ? wizard.getResourceById(ref.id) : wizard.getProjectById(ref.id);
        if (!sameWorkspace(ref, workspaceRef(context)) || !this.app.vault.getAbstractFileByPath(context.path)) return null;
        return eligible && ref.type === "project" && context.status !== "active" ? null : context;
    }
    get focus() {
        const oath=this.current;
        if(!oath)return null;
        const handoff=this.active?this.plugin.globalPlan?.focusHandoff?.(oath.id):null;
        return handoff?{...oath,planId:handoff.planId,...this.focusSelection(handoff.entries)}:oath;
    }
    get focusWorkspaces(){const focus=this.focus;return focus?.workspaces??(focus?.workspace?[focus.workspace]:[]);}
    get workspace(){return this.focusWorkspaces.map(ref=>this.resolveWorkspace(ref,false)).find(Boolean)??null;}
    commitmentDeadline(){
        const oath=this.current;
        if(!this.committed||this.fulfilled)return null;
        return (this.active?oath.startedAt:oath.scheduledAt)+oath.durationMs;
    }
    durationLimit(draft){
        const start=draft.start==="scheduled"?draft.scheduledAt:this.now();
        if(!Number.isFinite(start))return Infinity;
        const next=this.plugin.globalPlan?.nextScheduledTime?.()??Infinity;
        return Math.max(0,next-start);
    }
    async focusChanged(){
        this.work=(this.focus?.tasks??[]).map(ref=>({ref,task:this.work.find(item=>taskKey(item.ref)===taskKey(ref))?.task??null}));
        this.emit();
        void this.refresh();
        const context=this.plugin.workspaceModes?.currentContext?.();
        if(context&&!this.canOpen(context,false)){
            try{await this.enterWorkspace();}
            catch(error){this.error(error);}
        }
    }
    ownsTask(ref, task) { return sameWorkspace(ref, task.nativeReference?.owner); }
    activePlan() {
        const plan = this.plugin.globalPlan?.active();
        return plan?.content.entries.length && this.now() < Date.parse(plan.endsAt) ? plan : null;
    }
    selectedIds(draft,plan){
        const entries=plan.content.entries,ids=new Set(draft.planEntryIds??[]);
        const tasks=new Map(entries.filter(entry=>entry.kind==="task").map(entry=>[taskKey(entry.reference),entry.id]));
        for(const task of draft.tasks??[])ids.add(tasks.get(taskKey(task)));
        return ids;
    }
    focusSelection(entries, resolved=[]){
        const live=new Map(resolved.map(item=>[item.entry.id,item]));
        const scopes=new Map(),tasks=[],files=[];
        const add=ref=>{if(validWorkspace(ref))scopes.set(JSON.stringify([ref.type,ref.id]),{type:ref.type,id:ref.id});};
        const planItems=entries.map(entry=>{
            const item=live.get(entry.id),ref=entry.reference,label=item?.label??entry.lastKnownLabel??"Unavailable item";
            if(entry.kind==="task"){
                const owner=item?.task?.nativeReference?.owner??ref.ownerHint;
                add(owner);
                tasks.push({id:ref.taskId,authorityId:ref.authorityId,owner,text:label});
            }else if(entry.kind==="workspace")add(ref);
            else {
                add(entry.intendedContext??ref.sourceWorkspace);
                if(!entry.unavailableReason)files.push(ref.path);
            }
            return {id:entry.id,kind:entry.kind,label};
        });
        const workspaces=[...scopes.values()];
        return {workspaces,workspace:workspaces[0]??null,planItems,tasks,files};
    }
    async readPlanItems(plan){
        if(!plan)return [];
        const entries=plan.content.entries;
        if(this.plugin.globalPlan.references)return this.plugin.globalPlan.references.resolve(entries);
        return entries.map(entry=>({entry,label:entry.lastKnownLabel}));
    }
    planRequirement(draft) {
        const p = this.activePlan();
        if (!p || draft.planId !== p.id) return "An active Plan with at least one item is required to take an Oath.";
        if (draft.start === "scheduled" && draft.scheduledAt >= Date.parse(p.endsAt)) return "Schedule the Oath before the active Plan day ends.";
        const entries = new Set(p.content.entries.map(entry=>entry.id));
        if ([...this.selectedIds(draft,p)].some(id=>!entries.has(id))) return "Selected items changed in the active Plan. Review your selection.";
        return "";
    }
    setupRequirements(draft) {
        const planned = this.planRequirement(draft);
        return oathRequirements(draft, this.now()).map(field => {
            if (field.key === "Tasks" && planned) return { ...field, complete: false, error: planned };
            if(field.key==="Duration"&&field.complete&&draft.durationMs>this.durationLimit(draft))
                return {...field,complete:false,error:"The minimum Oath duration must end before or at the next scheduled Plan."};
            return field;
        });
    }
    validateDraft(draft) {
        validateOath(draft, this.now());
        const missing = this.setupRequirements(draft).find(field => !field.complete);
        if (missing) throw Error(missing.error);
    }
    projectWorkspaceForPath(path) {
        if (!this.active || typeof path !== "string") return null;
        const contains = root => path === root || path.startsWith(root + "/");
        return this.focusWorkspaces.filter(ref=>ref.type==="project").map(ref=>this.resolveWorkspace(ref,false)).find(project=>{
            if(!project)return false;
            const ids=project.resourceFolderIds??[];
            return contains(project.root)||(ids.length&&this.plugin.projectWizard.getResourceFolders(ids).some(folder=>contains(folder.path)));
        })??null;
    }
    canOpen(reference, notify = true) {
        if (!this.active || !reference) return true;
        const wizard = this.plugin.projectWizard;
        const path = typeof reference === "string" ? reference : reference.path;
        if(this.focus?.files?.includes(path))return true;
        if (this.projectWorkspaceForPath(path)) return true;
        const context = typeof reference === "object" && workspaceRef(reference) ? reference :
            wizard.getResourceById(path) || wizard.getResourceForPath(path) ||
            wizard.getProjectById(path) || wizard.getProjectForPath(path);
        if (!context || this.focusWorkspaces.some(ref=>sameWorkspace(ref,workspaceRef(context)))) return true;
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
        else if(this.focus?.files?.[0]){
            const file=this.app.vault.getAbstractFileByPath(this.focus.files[0]);
            if(file)await this.app.workspace?.getLeaf(false)?.openFile(file);
        }else await this.plugin.workspaceModes?.openHome();
    }
    hasFocusTarget(){return !!(this.workspace||this.focus?.files?.length||this.plugin.globalPlan?.focusHandoff?.(this.current?.id));}
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
                if (this.active && this.hasFocusTarget()) await this.enterWorkspace();
            } else if (this.active) {
                if (!this.hasFocusTarget()) await this.invalidateWorkspace();
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
        if (!this.committed || this.disposed || this.readClosed) return false;
        this.ensureCommittedRead();
        const focus = this.focus, revision = this.readRevision ?? 0, sequence = this.readSequence = (this.readSequence ?? 0) + 1;
        const commitment = JSON.stringify([focus.id, focus.planId, focus.tasks]);
        const scopes=new Map(focus.tasks.filter(ref=>validWorkspace(ref.owner)).map(ref=>[JSON.stringify(ref.owner),ref.owner]));
        const results=new Map(await Promise.all([...scopes].map(async ([key,owner])=>{
            if(!this.ready(owner))return [key,null];
            try{const runtime=this.plugin.nativeTaskHost.runtime(owner);return [key,{result:await runtime.list(),authority:runtime.info().authority.authorityId}];}
            catch{return [key,null];}
        })));
        const current = () => !this.disposed && !this.readClosed && this.committed && sequence === this.readSequence && revision === (this.readRevision ?? 0) &&
            commitment === JSON.stringify([this.focus.id, this.focus.planId, this.focus.tasks]);
        if (!current()) return false;
        const work=focus.tasks.map(ref=>{
            const found=results.get(JSON.stringify(ref.owner));
            return {ref,task:found?.authority===ref.authorityId?found.result.tasks.find(task=>task.id===ref.id&&this.ownsTask(ref.owner,task))??null:null};
        });
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
        if (this.isStrict && this.active && !this.hasFocusTarget()) await this.invalidateWorkspace();
        const starting = this.current.state === "scheduled" && this.now() >= this.current.scheduledAt;
        let changed = false;
        if (readTasks || starting) {
            try { changed = await this.resolveWork(); }
            catch (error) { console.error("Could not refresh Oath tasks", error); }
        }
        if (starting) await this.activate();
        const fulfilled = await this.markFulfilled();
        if (this.isStrict && this.active && this.now() - (this.current.lastObservedAt ?? this.current.startedAt) >= 30000)
            await this.persist({ ...this.current, lastObservedAt: this.now() });
        if (changed && !fulfilled) this.emit();
    }
    captureFulfilment() {
        if (!this.active || this.current.fulfilledAt != null) return;
        const at = fulfilmentTime(this.current, this.now());
        if (at != null && this.pendingFulfilment?.id !== this.current.id) this.pendingFulfilment = { id: this.current.id, at };
    }
    async markFulfilled() {
        this.captureFulfilment();
        if (!this.active || this.current.fulfilledAt != null || this.pendingFulfilment?.id !== this.current.id) return false;
        // Retain the latch if saving fails, even if a task is subsequently unchecked.
        await this.persist({ ...this.current, fulfilledAt: this.pendingFulfilment.at });
        this.plugin.reportEligibility?.observe(this.workspace, "oath-fulfilled");
        this.pendingFulfilment = null;
        if (this.isStrict) this.strict.fulfill?.(this.current.id);
        this.emit(); return true;
    }
    async activate() {
        if (!await this.checkStartWindow()) return false;
        if (this.isStrict) return this.activateStrict();
        if (!this.hasFocusTarget()) { await this.invalidateWorkspace(); return false; }
        const owned = await this.fullscreen.enter();
        if (!this.fullscreen.isFull() && !owned) throw Error("Enforced fullscreen is unavailable on this device.");
        try {
            if (!await this.checkStartWindow()) { await this.fullscreen.exit();return false; }
            if (!this.hasFocusTarget()) { await this.invalidateWorkspace(); return false; }
            await this.persist({ ...this.current, state: "active", startedAt: this.now(), fullscreenOwned: owned });
        } catch (error) { await this.fullscreen.exit(); throw error; }
        this.plugin.reportEligibility?.observe(this.workspace, "oath-started");
        await this.enterWorkspace();
        this.emit();
    }
    async checkStartWindow(){
        const oath=this.current,p=this.activePlan();
        if(!oath?.planId||p?.id===oath.planId&&oath.durationMs<=this.durationLimit({start:"now"}))return true;
        await this.persist(null);
        this.work=[];
        this.emit();
        this.notice("The Oath could not begin within its Plan's available time.");
        return false;
    }
    take(draft) {
        draft = JSON.parse(JSON.stringify(draft));
        return this.enqueue(async () => {
            if (this.committed) throw Error("There is already an active or scheduled Oath on this device.");
            this.validateDraft(draft);
            return this.plugin.globalPlan.withOathPlan(draft.planId, plan => this.commitPlanOath(draft, plan));
        });
    }
    async commitPlanOath(draft, plan) {
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
                throw Error(preflight.blockers.length ? "Resolve the possible non-permitted applications or confirm manual review, then retry." : preflight.warnings.join(" "));
            }
        }
        const resolved=await this.readPlanItems(plan);
        this.validateDraft(draft);
        const selected=this.selectedIds(draft,plan);
        const selection=this.focusSelection(plan.content.entries.filter(entry=>selected.has(entry.id)),resolved);
        const now = this.now();
        await this.persist({ id: randomUUID(), deviceId: this.deviceId, takenAt: now, createdAt: now,
            scheduledAt: draft.start === "scheduled" ? draft.scheduledAt : now, startedAt: null,
            durationMs: draft.durationMs, fulfilledAt: null, planId: plan.id,...selection,
            state: "scheduled", completedAt: null, fullscreenOwned: false,
            ...(policy.mode === "strict" ? { policy, strictSessionId: null } : {}) });
        this.strictReviews.clear();
        const tasks=new Map(resolved.filter(item=>item.task).map(item=>[taskKey(item.task),item.task]));
        this.work=selection.tasks.map(ref=>({ref,task:tasks.get(taskKey(ref))??null}));
        try {
            if (draft.start !== "scheduled") { await this.activate(); await this.markFulfilled(); }
        } catch (error) {
            // The commitment was already saved. Reconciliation retries a
            // failed state transition; do not invite taking a second Oath.
            this.error(error);
        }
        this.emit();
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
        await this.plugin.globalPlan?.ensureLifecycle?.().catch(error=>this.error(error));
        
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
        if (!this.hasFocusTarget()) { await this.invalidateWorkspace(); return false; }
        const oath = this.current;
        try {
            const prepared = await this.strict.prepare(oath);
            if (!prepared.ready) { this.strictStatus = { ...prepared.preflight, status: "waiting" }; this.emit(); return false; }
            if (this.disposed) { await this.strict.release(oath.id); return false; }
            if (!await this.checkStartWindow()) { await this.strict.release(oath.id);return false; }
            if (!this.hasFocusTarget()) { await this.strict.release(oath.id); await this.invalidateWorkspace(); return false; }
            await this.persist({ ...oath, state: "active", startedAt: this.now(), lastObservedAt: this.now(), strictSessionId: prepared.sessionId, fullscreenOwned: false });
            this.strict.commit(oath.id);
        } catch (error) {
            await this.strict.release(oath.id);
            this.strictStatus = { status: "waiting", warnings: [error.message] }; this.emit(); throw error;
        }
        this.plugin.reportEligibility?.observe(this.workspace, "oath-started");
        await this.enterWorkspace(); this.emit(); return true;
    }
    async recoverStrict() {
        const oath = this.current;
        if (this.strict.owns(oath.id, oath.strictSessionId)) { this.strictStatus = this.strict.health; if (oath.fulfilledAt != null) this.strict.fulfill?.(oath.id); return; }
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
