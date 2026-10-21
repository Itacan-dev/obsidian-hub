"use strict";
const { normalizedTaskText } = require("../domain/tasks");
const { historyKind } = require("../domain/history");
const { validLocation, within } = require("../domain/task-views");
const { TaskServiceError, requireTaskValue, unsupported, legacyError } = require("./task-service-errors");
const { copy, validId, validPath, workspaceRef, sameWorkspace, validateWorkspace, validateHandle,
    normalizeLegacyTask, draftFromTask, legacyValues, stepIndex } = require("./task-service-legacy-values");
let adapterSequence = 0; // Ephemeral snapshot namespaces; never task identities.

class LegacyTaskAdapter {
    #plugin;
    #dv;
    #closed = false;
    #tokens = new Map();
    #sequence = 0;
    #namespace = ++adapterSequence;
    #closing = false;
    #listeners = new Set();
    #dispose = null;
    #pending = new Set();
    #onSubscriberError;
    constructor({ plugin, dataview, onSubscriberError = () => {} }) {
        requireTaskValue(plugin?.taskData && plugin?.taskEditor && plugin?.projectWizard && (dataview?.pages || typeof dataview === "function"),
            "Inject existing task data, editor, ownership and Dataview services.");
        this.#plugin = plugin;
        this.#dv = dataview;
        this.#onSubscriberError = onSubscriberError;
    }
    #open() { if (this.#closed) throw new TaskServiceError("CLOSED", "The legacy task adapter is closed."); }
    capabilities() {
        this.#open();
        return { backend: "legacy-markdown", guarantees: {
            durableRevisions: false, atomicTaskHistory: false, persistentIdempotency: false,
            nativeLocations: false, portableSharing: false, existingGitSharing: true,
            crossWorkspaceRelocation: false, creationRetry: "caller-supplied-legacy-id",
            completion: "editor-save", notifications: "invalidation"
        }, operations: {
            getTask: true, queryOwned: true, queryVisible: true, queryDisplay: true, queryStructured: true,
            resolveOathWork: true, resolveLegacyAction: true, resolveSavedTarget: true, readSteps: true, readEditable: true,
            releaseEditable: true, queryHistory: true, resolveReveal: true, createTask: true,
            saveEditable: true, setCompleted: true, addStep: true, editStep: true, deleteStep: true,
            setStepCompleted: true, deleteTask: true, reorderSteps: false, archiveTask: false,
            clearCompleted: false, changeAssociations: true
        }, restrictions: ["Existing hidden ID required for saves; reads never assign one.",
            "Step additions append at the parent task level; reparent/reorder are unsupported.",
            "Association changes support only an owning Project's existing Phase.",
            "Strict Home/Oath queryVisible policies remain unsupported; Home uses structured indexed reads.",
            "History persistence is unconfirmed even when an editor save succeeds."] };
    }
    readiness() {
        this.#open();
        const api = typeof this.#dv === "function" ? this.#dv() : this.#dv;
        const ready = !!api?.pages && api.index?.initialized !== false;
        return { backend: "legacy-markdown", state: ready ? "ready" : "not-ready",
            reason: ready ? "Legacy index ready." : "Legacy index not ready." };
    }
    #indexed(onTaskError = null, homeEvidence = null) {
        const api = typeof this.#dv === "function" ? this.#dv() : this.#dv;
        if (!api?.pages || api.index?.initialized === false) throw new TaskServiceError("INDEX_UNAVAILABLE", "The legacy task index is not ready.");
        return this.#plugin.taskData.readPages(api, undefined, onTaskError).flatMap(page => {
            if (homeEvidence) {
                let projectReference = null;
                try {
                    const reference = page.project;
                    // Match Home's existing .path ?? String(reference) rule,
                    // without exporting a Dataview page/link through the DTO.
                    if (reference) projectReference = String(reference.path ?? reference);
                } catch (error) { onTaskError?.(null, error); }
                for (const task of page.file.tasks) homeEvidence.set(task, projectReference);
            }
            return page.file.tasks;
        });
    }
    async queryDisplay() {
        this.#open();
        try {
            const { legacyDisplayQuery } = require("./task-service-legacy-display");
            const failures = [];
            const tasks = this.#indexed((_task, error, options) => { if (!options?.retained) failures.push(error); });
            const query = legacyDisplayQuery(tasks, { owner: path => this.#owner(path), file: path => this.#plugin.app.vault.getAbstractFileByPath(path) });
            for (const failure of failures) {
                const diagnostic = { code: "ROW_INDEX_FAILED", level: "row", rowIndex: query.rows.length, sourcePath: null,
                    message: failure?.message ?? "An indexed task could not be normalized." };
                query.rows.push({ state: "invalid", view: null, diagnostics: [diagnostic] }); query.diagnostics.push(diagnostic);
            }
            return query;
        } catch (error) { throw legacyError(error); }
    }
    async queryStructured(options = {}) {
        this.#open();
        const { legacyStructuredQuery } = require("./task-service-legacy-read");
        requireTaskValue(!options.validation || ["indexed", "source"].includes(options.validation), "Choose an explicit read validation policy.");
        requireTaskValue(!options.policy || ["workspace", "panel", "home", "oath-candidates"].includes(options.policy), "Unsupported structured visibility policy.");
        requireTaskValue(options.policy !== "home" || !options.workspace, "Home is a global read policy.");
        if (options.policy === "oath-candidates") {
            validateWorkspace(options.workspace);
            requireTaskValue(!options.validation || options.validation === "indexed", "Oath candidates use indexed evidence; enrollment validates sources.");
        }
        const failures = [];
        try {
            const homeEvidence = options.policy === "home" ? new Map() : null;
            const all = this.#indexed((_task, error, detail) => { if (!detail?.retained) failures.push(error); }, homeEvidence);
            if (options.policy === "oath-candidates") {
                if (failures.length) throw new TaskServiceError("INDEX_UNAVAILABLE", "The Oath candidate index is incomplete.");
                return require("./task-service-legacy-oath-candidates").legacyOathCandidates(this.#plugin, all, options.workspace);
            }
            let tasks = all;
            if (options.workspace) {
                validateWorkspace(options.workspace);
                const ref = options.workspace;
                const context = ref.type === "project" ? this.#plugin.projectWizard.getProjectById?.(ref.id) : this.#plugin.projectWizard.getResourceById?.(ref.id);
                if (!context || !sameWorkspace(workspaceRef(context), ref)) throw new TaskServiceError("REFERENCE_UNRESOLVED", "The requested workspace is unavailable.");
                const root = this.#plugin.taskData.currentPath(context.root);
                // Keep global duplicate accounting, even for excluded locations.
                tasks = all.filter(task => options.policy === "panel" ? within(task.path, root) : validLocation(task.path, { ...context, root }));
            }
            // The display projection's identity diagnostics must see global rows.
            const selected = new Set(tasks);
            const query = await legacyStructuredQuery(this.#plugin, all, { validation: options.validation, selected, preserveDisplay: ["panel", "home"].includes(options.policy) });
            if (homeEvidence) query.rows.forEach((row, index) => {
                row.home = { physicalOwner: row.view?.owner ?? row.display?.owner ?? null, projectReference: homeEvidence.get(all[index]) ?? null };
            });
            if (options.workspace) query.rows = query.rows.filter((_row, index) => selected.has(all[index]));
            for (const error of failures) {
                const diagnostic = { code: "ROW_INDEX_FAILED", level: "row", rowIndex: query.rows.length, sourcePath: null, message: error.message };
                query.rows.push({ state: "invalid", view: null, diagnostics: [diagnostic] }); query.diagnostics.push(diagnostic);
            }
            this.#open(); return query;
        } catch (error) { throw legacyError(error); }
    }
    async resolveOathWork(request) {
        this.#open();
        requireTaskValue(request && Object.prototype.hasOwnProperty.call(request, "workspace"), "Supply the committed workspace, or null for a legacy unavailable workspace.");
        if (request.workspace !== null) validateWorkspace(request.workspace);
        requireTaskValue(Array.isArray(request.references) && Array.isArray(request.awaitingIndex ?? []), "Supply committed parent references and enrollment evidence.");
        for (const ref of request.references) requireTaskValue(validId(ref?.id) && validPath(ref.path) && typeof ref.text === "string", "A committed reference requires its original ID, path and text.");
        for (const item of request.awaitingIndex ?? []) requireTaskValue(validId(item?.id) && validPath(item.path) && Number.isInteger(item.line) && item.line >= 0 && typeof item.text === "string", "Invalid enrollment evidence.");
        const input = { workspace: copy(request.workspace), references: request.references.map(({ id, path, text }) => ({ id, path, text })),
            awaitingIndex: (request.awaitingIndex ?? []).map(({ id, path, line, text, metadata }) => ({ id, path, line, text,
                ...(metadata ? { metadata: copy(metadata) } : {}) })) };
        try {
            const result = await require("./task-service-legacy-oath-committed").legacyOathCommitted(this.#plugin, this.#indexed(), input);
            this.#open(); return result;
        } catch (error) { throw legacyError(error); }
    }
    async resolveLegacyAction(handle) {
        try {
            const snapshot = await this.#resolve(handle);
            this.#open();
            return require("./task-service-legacy-read").legacyReadView(snapshot, this.#owner(snapshot.path));
        } catch (error) { throw legacyError(error); }
    }
    async resolveSavedTarget(target) {
        this.#open();
        try {
            const path = this.#plugin.taskData.currentPath(target.path);
            const matches = this.#indexed().filter(task => !task.identityConflict && (target.taskId ? task.hubTaskId === target.taskId :
                task.path === path && task.text === target.taskText && task.line === target.taskLine));
            if (matches.length !== 1) throw new TaskServiceError("REFERENCE_UNRESOLVED", "The saved task target is missing or ambiguous.");
            const { legacyTaskHandle } = require("./task-service-legacy-values");
            const view = await this.resolveLegacyAction(legacyTaskHandle(matches[0]));
            if ((target.stepId || target.stepText) && !view.legacy.steps.some(step =>
                (target.stepId ? step.hubTaskId === target.stepId : step.text === target.stepText) && !step.completed)) {
                throw new TaskServiceError("STALE_REFERENCE", "The saved Step is no longer available.");
            }
            return view;
        } catch (error) { throw legacyError(error); }
    }
    #owner(path) { return workspaceRef(this.#plugin.projectWizard.getContextForPath(path)); }
    async #resolve(handle) {
        this.#open();
        if (handle?.kind === "native") unsupported("getTask", "Native task handles are not resolved by the legacy backend.");
        validateHandle(handle);
        const all = this.#indexed(), id = handle.identity?.value;
        let task;
        if (id) {
            const occurrences = all.flatMap(parent => [parent, ...parent.steps]).filter(item => item.hubTaskId === id);
            if (occurrences.length > 1 || occurrences[0]?.identityConflict) {
                throw new TaskServiceError("AMBIGUOUS_REFERENCE", "This hidden task identity occurs more than once.");
            }
            const matches = all.filter(item => item.hubTaskId === id);
            if (!matches.length) {
                const path = this.#plugin.taskData.currentPath(handle.locator.path);
                const file = this.#plugin.app.vault.getAbstractFileByPath(path);
                throw new TaskServiceError(file ? "REFERENCE_UNRESOLVED" : "SOURCE_MISSING",
                    "The task identity is not available in the current legacy index. Refresh before retrying.");
            }
            task = { ...matches[0], text: handle.locator.expectedTitle };
        } else {
            const { path, line, expectedTitle } = handle.locator;
            if (!this.#plugin.app.vault.getAbstractFileByPath(path)) {
                throw new TaskServiceError("SOURCE_MISSING", "The legacy source note is no longer available.");
            }
            const matches = all.filter(item => item.path === path && normalizedTaskText(item.text) === expectedTitle);
            if (matches.length > 1) throw new TaskServiceError("AMBIGUOUS_REFERENCE", "An unassigned locator cannot distinguish identical task titles in this note.");
            task = matches.find(item => item.line === line && !item.hubTaskId);
            if (!task) throw new TaskServiceError("STALE_REFERENCE", "This temporary task locator moved or changed. Refresh the task list.");
        }
        const snapshot = await this.#plugin.taskEditor.read(task);
        if ((!id && (snapshot.line !== handle.locator.line || snapshot.hubTaskId)) ||
            normalizedTaskText(snapshot.text) !== handle.locator.expectedTitle || id && snapshot.hubTaskId !== id) {
            throw new TaskServiceError("STALE_REFERENCE", "This legacy task locator moved or changed.");
        }
        // Parent/Step IDs share one legacy namespace. Never expose metadata or
        // write through a copied Step identity, including copies in other notes.
        const ids = [snapshot.hubTaskId, ...snapshot.steps.map(step => step.hubTaskId)].filter(Boolean);
        if (new Set(ids).size !== ids.length || ids.some(value => all.flatMap(parent => [parent, ...parent.steps])
            .filter(item => item.hubTaskId === value).length > 1)) {
            throw new TaskServiceError("AMBIGUOUS_REFERENCE", "A task or Step has a copied hidden identity.");
        }
        return snapshot;
    }
    #dto(snapshot) {
        snapshot = { ...snapshot, path: snapshot.file?.path ?? snapshot.path };
        const timestamp = this.#plugin.projectWizard.getCompletedTaskTimestamp?.(
            snapshot.path, snapshot.line, snapshot.text, snapshot.hubTaskId) ?? null;
        return normalizeLegacyTask(snapshot, this.#owner(snapshot.path), timestamp);
    }
    async getTask(handle) {
        try { return this.#dto(await this.#resolve(handle)); }
        catch (error) { throw legacyError(error); }
    }
    async readSteps(handle) { return (await this.getTask(handle)).steps; }
    async queryOwned(owner) {
        this.#open(); validateWorkspace(owner);
        return this.#query(task => sameWorkspace(this.#owner(task.path), owner));
    }
    async queryVisible(workspace, options = {}) {
        this.#open(); validateWorkspace(workspace);
        const policy = options.policy ?? "panel";
        if (!["panel", "workspace"].includes(policy)) unsupported("queryVisible", `Legacy visibility policy '${policy}' is not integrated.`);
        // Resolve the actual workspace, never a caller's viewing root or mounts.
        const context = workspace.type === "project" ? this.#plugin.projectWizard.getProjectById?.(workspace.id) :
            this.#plugin.projectWizard.getResourceById?.(workspace.id);
        if (!context || !sameWorkspace(workspaceRef(context), workspace)) {
            throw new TaskServiceError("REFERENCE_UNRESOLVED", "The requested workspace is unavailable.");
        }
        const root = this.#plugin.taskData.currentPath(context.root);
        return this.#query(task => policy === "panel" ? within(task.path, root) : validLocation(task.path, { ...context, root }));
    }
    async #query(predicate) {
        const { legacyTaskHandle } = require("./task-service-legacy-values");
        try {
            // Preserve Dataview's current parent selection and order. Individual
            // source reads validate its references; one unresolved row is explicit.
            const result = [];
            for (const task of this.#indexed().filter(predicate)) result.push(await this.getTask(legacyTaskHandle(task)));
            return result;
        } catch (error) { throw legacyError(error); }
    }
    async readEditable(handle) {
        try {
            const snapshot = await this.#resolve(handle), task = this.#dto(snapshot);
            const token = { kind: "legacy-snapshot", value: `${this.#namespace}:${++this.#sequence}` };
            this.#tokens.set(token.value, { snapshot, handle: copy(task.handle) });
            return { token, task, draft: draftFromTask(task) };
        } catch (error) { throw legacyError(error); }
    }
    async releaseEditable(token) {
        this.#open(); this.#token(token); this.#tokens.delete(token.value);
    }
    #token(token) {
        const entry = token?.kind === "legacy-snapshot" && this.#tokens.get(token.value);
        if (!entry) throw new TaskServiceError("STALE_REFERENCE", "This editable snapshot has expired or belongs to another adapter.");
        return entry;
    }
    async resolveReveal(handle) {
        try {
            const snapshot = await this.#resolve(handle);
            return { kind: "legacy-source", path: snapshot.path, line: snapshot.line, existingId: snapshot.hubTaskId ?? null };
        } catch (error) { throw legacyError(error); }
    }
    async queryHistory(query = {}) {
        this.#open();
        requireTaskValue(!query.projection || query.projection === "recorded", "Unsupported History projection.");
        if (query.owner) validateWorkspace(query.owner);
        if (query.handle) {
            validateHandle(query.handle);
            if (!query.handle.identity) unsupported("queryHistory", "Historical facts cannot be safely matched to an unassigned source locator.");
        }
        const workspaceId = query.owner ? (query.owner.type === "resource" ? `resource:${query.owner.id}` : query.owner.id) : null;
        const records = this.#plugin.projectWizard.getCompletedTaskHistory?.(workspaceId);
        if (!records) unsupported("queryHistory", "Inject the existing completion history reader.");
        const id = query.handle?.identity.value;
        if (query.projection === "recorded") return require("./task-history-legacy-read").recordedHistoryQuery(records, id);
        return records.filter(record => !id || (record.kind === "step" ? record.parentTaskId : record.hubTaskId) === id)
            .map(record => ({ kind: record.kind === "step" ? "step" : "task", recordId: record.id ?? null,
                taskIdentity: (record.kind === "step" ? record.parentTaskId : record.hubTaskId) ?? null,
                stepIdentity: record.kind === "step" ? record.hubTaskId ?? null : null,
                title: record.text ?? "", parentTitle: record.parentText ?? null,
                timestamp: Number.isFinite(record.timestamp) ? record.timestamp : null,
                ownerAtEvent: workspaceRef({ ...record, contextKind: historyKind(record), resourceType: record.resourceType ?? record.projectId?.replace(/^resource:/, "") }),
                source: validPath(record.path) && Number.isInteger(record.line) ? { kind: "legacy-source", path: record.path, line: record.line } : null,
                consistency: "legacy-best-effort" }));
    }
    #write(work) {
        this.#open();
        if (this.#closing) throw new TaskServiceError("CLOSED", "The legacy task adapter is closing.");
        const actionTimestamp = Date.now();
        const pending = Promise.resolve().then(() => work(actionTimestamp)).catch(error => { throw legacyError(error, true); });
        this.#pending.add(pending);
        pending.then(() => this.#pending.delete(pending), () => this.#pending.delete(pending));
        return pending;
    }
    async createTask(request) {
        request = copy(request);
        return this.#write(async actionTimestamp => {
            validateWorkspace(request?.owner);
            requireTaskValue(request.destination?.kind === "legacy-source" && validPath(request.destination.path), "Choose an explicit existing legacy destination.");
            const path = request.destination.path;
            requireTaskValue(sameWorkspace(this.#owner(path), request.owner), "The destination must belong to the requested owner.");
            const values = legacyValues(request.draft, request.owner);
            if (values.completed && !values.completedAt) values.completedAt = actionTimestamp;
            requireTaskValue(request.draft.steps.every(step => !step.handle && typeof step.title === "string" && typeof step.completed === "boolean"), "New Steps cannot carry existing handles.");
            requireTaskValue(request.draft.steps.every(step => Object.keys(step).every(key => ["title", "completed", "completedAt"].includes(key)) &&
                (step.completedAt === undefined || Number.isSafeInteger(step.completedAt) && step.completedAt > 0)), "New Steps must use supported fields and an optional action timestamp.");
            if (request.retry) requireTaskValue(request.retry.kind === "legacy-create-id" && validId(request.retry.id), "Use the existing caller-owned legacy creation identity.");
            const file = await this.#plugin.taskEditor.create(path, values.text, { ...values,
                steps: request.draft.steps.map(step => ({ text: step.title, completed: step.completed,
                    ...(step.completedAt || step.completed ? { completedAt: step.completedAt ?? actionTimestamp } : {}) })),
                ...(request.retry ? { hubTaskId: request.retry.id } : {}) });
            // Legacy create returns a file, not a canonical task. Never identify
            // a new ID-less task by title or mistake a duplicate for this result.
            return { status: "legacy-applied", task: null, reveal: { kind: "legacy-source", path: file.path },
                existingId: request.retry?.id ?? null, refreshRequired: true, historyPersistence: "unconfirmed" };
        });
    }
    async #save(token, draft, deleting = false, actionTimestamp) {
        const { snapshot, handle } = this.#token(token);
        if (!snapshot.hubTaskId) unsupported("saveEditable", "Saving an unassigned legacy locator requires a reviewed mutation guard; no identity is allocated by this facade.");
        await this.#resolve(handle);
        const values = deleting ? { operation: "delete" } : legacyValues(draft, this.#owner(snapshot.file.path));
        if (!deleting) {
            if (values.completed && !snapshot.completed && !values.completedAt) values.completedAt = actionTimestamp;
            let previous = -1;
            values.steps = draft.steps.map(step => {
                requireTaskValue(typeof step.title === "string" && typeof step.completed === "boolean", "Supply a Step title and completion state.");
                requireTaskValue(Object.keys(step).every(key => ["handle", "title", "completed", "completedAt"].includes(key)), "Step ancestry and ordering cannot be edited through legacy drafts.");
                requireTaskValue(step.completedAt === undefined || Number.isSafeInteger(step.completedAt) && step.completedAt > 0, "Use an explicit Step completion timestamp.");
                if (!step.handle) return { text: step.title, completed: step.completed,
                    ...(step.completedAt || step.completed ? { completedAt: step.completedAt ?? actionTimestamp } : {}) };
                const index = stepIndex(snapshot, step.handle);
                if (index <= previous) unsupported("reorderSteps", "Legacy editor saves preserve source Step order.");
                previous = index;
                return { ...snapshot.steps[index], text: step.title, completed: step.completed,
                    ...(step.completedAt || step.completed && !snapshot.steps[index].completed ? { completedAt: step.completedAt ?? actionTimestamp } : {}) };
            });
            // The old editor deletes an entire nested block. Reject drafts that
            // retain a descendant while removing its ancestor.
            const retained = new Set(values.steps.filter(step => step.line != null).map(step => step.line));
            for (const step of snapshot.steps.filter(step => !retained.has(step.line))) {
                requireTaskValue(!snapshot.steps.some(child => child.line > step.line && child.line < step.end && retained.has(child.line)),
                    "Removing a Step also requires removing its descendant Steps.");
            }
            const firstNew = draft.steps.findIndex(step => !step.handle);
            if (firstNew >= 0 && draft.steps.slice(firstNew).some(step => step.handle)) unsupported("reorderSteps", "New legacy Steps append after existing Steps.");
        }
        const edit = await this.#plugin.taskEditor.save(snapshot, values);
        this.#tokens.delete(token.value);
        const after = edit.tasks[0];
        return { status: "legacy-applied", task: after ? this.#dto({ ...after, path: after.path ?? snapshot.file.path }) : null,
            reveal: after ? { kind: "legacy-source", path: after.path ?? snapshot.file.path, line: after.line } : null,
            refreshRequired: true, historyPersistence: "unconfirmed" };
    }
    saveEditable(token, draft) {
        draft = copy(draft);
        return this.#write(actionTimestamp => this.#save(token, draft, false, actionTimestamp));
    }
    #draft(token) { return draftFromTask(this.#dto(this.#token(token).snapshot)); }
    setCompleted(token, completed) {
        return this.#write(actionTimestamp => { requireTaskValue(typeof completed === "boolean", "Choose a completion state.");
            const draft = this.#draft(token); draft.completed = completed; return this.#save(token, draft, false, actionTimestamp); });
    }
    addStep(token, step) {
        return this.#write(actionTimestamp => { requireTaskValue(step && !step.handle && step.parent == null && step.order == null, "Legacy Step additions append at the task level.");
            requireTaskValue(Object.keys(step).every(key => ["title", "completed", "completedAt", "parent", "order"].includes(key)), "Use supported Step fields.");
            const draft = this.#draft(token); draft.steps.push({ title: step.title, completed: step.completed ?? false,
                ...(step.completedAt !== undefined ? { completedAt: step.completedAt } : {}) }); return this.#save(token, draft, false, actionTimestamp); });
    }
    editStep(token, handle, patch) {
        return this.#write(actionTimestamp => { requireTaskValue(patch && Object.keys(patch).every(key => key === "title"), "Step edits support title only; use explicit completion commands.");
            const draft = this.#draft(token), index = stepIndex(this.#token(token).snapshot, handle);
            Object.assign(draft.steps[index], patch); return this.#save(token, draft, false, actionTimestamp); });
    }
    setStepCompleted(token, handle, completed) {
        return this.#write(actionTimestamp => { requireTaskValue(typeof completed === "boolean", "Choose a Step completion state.");
            const draft = this.#draft(token), index = stepIndex(this.#token(token).snapshot, handle);
            draft.steps[index].completed = completed; return this.#save(token, draft, false, actionTimestamp); });
    }
    deleteStep(token, handle, options = {}) {
        return this.#write(actionTimestamp => { const entry = this.#token(token), index = stepIndex(entry.snapshot, handle);
            const step = entry.snapshot.steps[index];
            const descendants = entry.snapshot.steps.filter(child => child.line > step.line && child.line < step.end);
            requireTaskValue(!descendants.length || options.cascade === true, "Explicit cascade is required to delete nested Steps.");
            const removed = new Set([step, ...descendants]);
            const draft = this.#draft(token); draft.steps = draft.steps.filter((_, i) => !removed.has(entry.snapshot.steps[i]));
            return this.#save(token, draft, false, actionTimestamp); });
    }
    changeAssociations(token, associations) {
        return this.#write(actionTimestamp => { if (!associations || Object.keys(associations).some(key => key !== "phase")) unsupported("changeAssociations", "Only an existing owning-Project Phase can be changed in this phase.");
            requireTaskValue(Object.hasOwn(associations, "phase"), "Supply a Phase association or null.");
            const draft = this.#draft(token); draft.phase = copy(associations.phase); return this.#save(token, draft, false, actionTimestamp); });
    }
    deleteTask(token) { return this.#write(() => this.#save(token, null, true)); }
    reorderSteps() { this.#open(); unsupported("reorderSteps"); }
    archiveTask() { this.#open(); unsupported("archiveTask"); }
    clearCompleted() { this.#open(); unsupported("clearCompleted", "Bulk clear's archive/check removal workflow awaits Phase 2B-3 integration."); }
    subscribe(listener) {
        this.#open(); requireTaskValue(typeof listener === "function", "A task-change listener is required.");
        const subscription = { listener };
        this.#listeners.add(subscription);
        if (!this.#dispose) {
            try { this.#dispose = this.#plugin.taskData.subscribe({ register() {} }, () => {
                for (const subscriber of [...this.#listeners]) {
                    if (!this.#listeners.has(subscriber)) continue;
                    try {
                        Promise.resolve(subscriber.listener({ kind: "invalidation", backend: "legacy-markdown", reason: "legacy-refresh",
                            requiresRequery: true, durability: "unknown", taskHandles: null })).catch(error => this.#report(error));
                    } catch (error) { this.#report(error); }
                }
            }); } catch (error) { this.#listeners.delete(subscription); throw legacyError(error); }
        }
        return () => { this.#listeners.delete(subscription); if (!this.#listeners.size && this.#dispose) {
            this.#dispose(); this.#dispose = null;
        } };
    }
    #report(error) { try { this.#onSubscriberError(error); } catch (_) { /* Error reporters cannot break refreshes. */ } }
    async close() {
        if (this.#closed) return;
        this.#closing = true;
        // Finish already accepted work. Do not destroy the shared task-data
        // service, the editor, or watchers belonging to current UI consumers.
        await Promise.allSettled([...this.#pending]);
        this.#closed = true;
        this.#dispose?.(); this.#dispose = null;
        this.#listeners.clear(); this.#tokens.clear();
    }
}

module.exports = { LegacyTaskAdapter };
