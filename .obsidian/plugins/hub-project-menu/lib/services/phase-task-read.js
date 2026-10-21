"use strict";
const { TaskReadSession } = require("./task-read-session");
const { legacyActionTask } = require("./task-service-legacy-bridge");
const { normalizedTaskText } = require("../domain/tasks");
const { validLocation } = require("../domain/task-views");
const taskKey = task => task.hubTaskId ?? task.path + ":" + task.line;
const hosts = new WeakMap();
function track(plugin, close) {
    let sessions = hosts.get(plugin);
    if (!sessions) { hosts.set(plugin, sessions = new Set()); plugin.register?.(() => { for (const end of [...sessions]) end(); hosts.delete(plugin); }); }
    sessions.add(close); return () => sessions.delete(close);
}
class PhaseTaskRead {
    constructor(service, projectId, phaseId, changed = () => {}) {
        this.service = service; this.projectId = projectId; this.phaseId = phaseId; this.changed = changed;
        this.baseline = new Map(); this.selected = new Map(); this.additions = new Map(); this.removals = new Map(); this.available = new Map();
        this.candidates = []; this.order = new Map(); this.loaded = false; this.closed = false; this.saving = false; this.generation = 0;
        // Canonical effective metadata retains assignment identity even when the
        // very first index query omits a source or suppresses a copied ID.
        // No owner/path/title is inferred for an unavailable assignment.
        if (phaseId) for (const [id, metadata] of Object.entries(service.plugin.projectWizard.data.taskMetadata ?? {})) if (metadata?.phaseId === phaseId) {
            const entry = { id, ref: null, text: "Assigned task unavailable", path: null, phaseId };
            this.baseline.set(id, entry); this.selected.set(id, entry);
        }
        this.reader = new TaskReadSession(service.plugin.taskService, () => { this.generation++; if (!this.closed && !this.saving) changed(); });
        this.untrack = track(service.plugin, () => { this.close(); this.onPluginClose?.(); });
    }
    async refresh() {
        const generation = ++this.generation;
        const query = await this.service.taskCandidates(this.projectId, this.reader, () => this.closed || this.saving || generation !== this.generation);
        if (!query || this.closed || this.saving || generation !== this.generation) return null;
        const indexedIds = new Set(query.tasks.map(task => task.hubTaskId).filter(Boolean));
        const unknown = this.loaded ? [] : [...this.baseline.values()].filter(entry => !entry.ref && !indexedIds.has(entry.id));
        if (unknown.length) {
            // Legacy Phase IDs are Project-qualified. An index-only, cached
            // scope check distinguishes an absent source from a known task in
            // another Project/Resource or an excluded location. Missing rows
            // stay unresolved; no owner is inferred from metadata alone.
            const all = await this.reader.read({ validation: "indexed" }, () => this.closed || this.saving || generation !== this.generation);
            if (!all || this.closed || this.saving || generation !== this.generation) return null;
            const project = this.service.project(this.projectId), root = this.service.plugin.taskData.currentPath(project.root);
            const owners = new Map(), stepIds = new Set();
            for (const row of all.rows) if (row.view) {
                const view = row.view, id = view.legacy?.hubTaskId;
                if (id) { if (!owners.has(id)) owners.set(id, []); owners.get(id).push(view); }
                for (const step of view.steps ?? []) if (step.handle.kind === "legacy-step" && step.handle.identity) stepIds.add(step.handle.identity);
            }
            for (const entry of unknown) {
                const matches = owners.get(entry.id) ?? [];
                if (matches.length ? matches.every(view => view.owner?.type !== "project" || view.owner.id !== this.projectId || !validLocation(view.source?.path ?? "", { ...project, root })) : stepIds.has(entry.id)) {
                    this.baseline.delete(entry.id); this.selected.delete(entry.id); this.removals.delete(entry.id);
                }
            }
        }
        this.beforePublish?.();
        this.candidates = query.tasks; this.available = new Map();
        for (const task of query.tasks) {
            const id = taskKey(task);
            if (!this.order.has(id)) this.order.set(id, this.order.size);
            if (this.available.has(id)) { this.available.set(id, null); continue; }
            this.available.set(id, task.identityConflict ? null : task);
            if (this.phaseId && task.phaseId === this.phaseId && !this.baseline.has(id) && !this.loaded) {
                const entry = { id, ref: null, text: task.text, path: task.path, phaseId: task.phaseId };
                this.baseline.set(id, entry); this.selected.set(id, entry);
            }
        }
        for (const [id, entry] of this.baseline) {
            const task = this.available.get(id);
            if (!entry.ref && task && task.phaseId === entry.phaseId) { entry.ref = task; entry.text = task.text; entry.path = task.path; }
        }
        for (const entry of [...this.baseline.values(), ...this.additions.values()]) {
            const task = this.available.get(entry.id);
            if (entry.ref && task && normalizedTaskText(task.text) === normalizedTaskText(entry.ref.text) && (task.phaseId ?? null) === (entry.ref.phaseId ?? null)) {
                entry.text = task.text; entry.path = task.path;
            }
        }
        if (!this.loaded) {
            const ordered = new Map();
            for (const task of query.tasks) { const id = taskKey(task); if (this.selected.has(id)) ordered.set(id, this.selected.get(id)); }
            for (const [id, entry] of this.selected) if (!ordered.has(id)) ordered.set(id, entry);
            this.selected = ordered;
        }
        this.loaded = true; this.diagnostics = query.diagnostics; return query;
    }
    usable(entry) {
        const task = this.available.get(entry.id);
        return !!entry.ref && !!task && normalizedTaskText(task.text) === normalizedTaskText(entry.ref.text) &&
            (task.phaseId ?? null) === (entry.ref.phaseId ?? null);
    }
    pickerItems() { return this.candidates.filter(task => !task.identityConflict && this.available.get(taskKey(task)) === task && !this.selected.has(taskKey(task))); }
    add(task) {
        if (this.closed || this.saving) return false;
        const id = taskKey(task), current = this.available.get(id);
        if (!current || current.identityConflict || normalizedTaskText(current.text) !== normalizedTaskText(task.text) || (current.phaseId ?? null) !== (task.phaseId ?? null)) return false;
        const entry = this.baseline.get(id) ?? { id, ref: task, text: task.text, path: task.path, phaseId: task.phaseId };
        this.selected.set(id, entry); this.removals.delete(id);
        if (!this.baseline.has(id)) this.additions.set(id, entry);
        return true;
    }
    remove(id) {
        if (this.closed || this.saving) return;
        const entry = this.selected.get(id); this.selected.delete(id); this.additions.delete(id);
        if (this.baseline.has(id)) this.removals.set(id, entry);
    }
    freeze() { this.saving = true; this.generation++; }
    resume() { this.saving = false; this.reader.invalidate(); }
    async assignments() {
        const result = [];
        // Only explicit user deltas are submitted. A missing candidate never
        // becomes included:false. Validate every delta before any writer runs.
        const changes = [...this.removals.values()].map(entry => ({ entry, included: false }))
            .concat([...this.additions.values()].map(entry => ({ entry, included: true })))
            .sort((a, b) => (this.order.get(a.entry.id) ?? Infinity) - (this.order.get(b.entry.id) ?? Infinity));
        for (const { entry, included } of changes) {
            if (!entry?.ref) throw Error("An assigned task is unavailable. Your draft has been kept; refresh its source before saving this change.");
            const fresh = await legacyActionTask(this.service.plugin.taskService, entry.ref);
            const owner = this.service.plugin.projectWizard.getContextForPath(fresh.path);
            if (owner?.contextKind === "resource" || owner?.projectId !== this.projectId) throw Error("Choose a task inside this Project.");
            if ((fresh.phaseId ?? null) !== (entry.ref.phaseId ?? null)) throw Error("This task's phase changed. Reopen the phase before saving.");
            result.push({ task: { ...fresh, phaseId: entry.ref.phaseId }, included });
        }
        if (this.closed) throw Error("The Phase editor has closed.");
        return result;
    }
    close() { if (this.closed) return; this.closed = true; this.generation++; this.reader.close(); this.untrack?.(); }
}
module.exports = { PhaseTaskRead, taskKey };
