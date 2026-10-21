"use strict";
const { randomUUID } = require("crypto");
const { planningState, phaseValues, milestoneValues } = require("../domain/project-planning");
const { withIdentity, readTaskSnapshot } = require("../domain/task-planning");

class ProjectPlanningService {
    constructor(plugin) { this.plugin = plugin; this.listeners = new Set(); plugin.register?.(() => this.listeners.clear()); }
    project(id) {
        const project = this.plugin.projectWizard.getProjectById(id);
        if (!project || project.contextKind === "resource") throw Error("This Project is no longer available.");
        return project;
    }
    read(id) { return planningState(this.plugin.projectWizard.data.projectPlanning?.[id]); }
    phases(id) { return this.read(id).phases; }
    phaseFor(task) {
        if (!task.phaseId) return null;
        const owner = this.plugin.projectWizard.getContextForPath(this.plugin.taskData.currentPath(task.path));
        return owner?.contextKind !== "resource" && owner?.projectId ? this.phases(owner.projectId).find(phase => phase.id === task.phaseId) : null;
    }
    async tasks(_dv, id) {
        return (await this.taskCandidates(id)).tasks;
    }
    async taskCandidates(id, reader = null, cancelled = () => false) {
        this.project(id);
        const options = { workspace: { type: "project", id }, policy: "workspace", validation: "indexed" };
        const query = reader ? await reader.read(options, cancelled) : await this.plugin.taskService.queryStructured(options);
        if (!query || cancelled()) return null;
        this.project(id);
        const { legacyReadTask } = require("./task-service-legacy-bridge");
        const tasks = query.rows.filter(row => row.view?.legacy && row.view.owner?.type === "project" && row.view.owner.id === id).map(row => {
            const task = legacyReadTask(row.view);
            if (!row.view.phase) delete task.phaseId;
            return task;
        });
        return { tasks, diagnostics: query.diagnostics };
    }
    subscribe(component, callback) { this.listeners.add(callback); component.register(() => this.listeners.delete(callback)); }
    changed(id) { this.plugin.taskData.invalidateAll(); for (const listener of this.listeners) listener(id); }
    transaction(id, revision, update) {
        return this.plugin.enqueueTaskMutation(async () => {
            this.project(id);
            const data = this.plugin.projectWizard.data, state = this.read(id);
            if (revision != null && revision !== state.revision) throw Error("This Roadmap changed in another editor. Reopen it before saving.");
            const previous = { planning: data.projectPlanning, metadata: data.taskMetadata }, writes = [];
            const metadata = { ...data.taskMetadata };
            let result;
            try {
                result = await update(state, metadata, writes);
                state.revision++;
                data.projectPlanning = { ...data.projectPlanning, [id]: state };
                data.taskMetadata = metadata;
                await this.plugin.dataStore.save(data);
            } catch (error) {
                data.projectPlanning = previous.planning; data.taskMetadata = previous.metadata;
                await this.plugin.taskEditor.rollback(writes);
                throw error;
            }
            this.changed(id);
            return result;
        });
    }
    async link(task, phaseId, projectId, metadata, writes) {
        if (task.identityConflict) throw Error("Resolve this task's copied identity before assigning a phase.");
        const snapshot = await this.plugin.taskEditor.read(task);
        const owner = this.plugin.projectWizard.getContextForPath(snapshot.file.path);
        if (owner?.contextKind === "resource" || owner?.projectId !== projectId) throw Error("Choose a task inside this Project.");
        if ((snapshot.phaseId ?? null) !== (task.phaseId ?? null)) throw Error("This task's phase changed. Reopen the phase before saving.");
        if ((snapshot.phaseId ?? null) === (phaseId ?? null)) return;
        const id = snapshot.hubTaskId ?? randomUUID();
        const next = { ...this.plugin.taskEditor.metadata(snapshot.hubTaskId) };
        if (phaseId) next.phaseId = phaseId; else delete next.phaseId;
        if (!snapshot.hubTaskId) {
            // Attribute the identity-only Markdown write to the task system, never file activity.
            await this.plugin.taskEditor.write(snapshot.file, content => {
                const current = readTaskSnapshot(content, snapshot);
                if (current.block !== snapshot.block) throw Error("This task changed. Reopen the phase before saving.");
                const eol = content.includes("\r\n") ? "\r\n" : "\n", lines = content.split(/\r?\n/);
                lines[current.line] = withIdentity(lines[current.line], id);
                return lines.join(eol);
            }, writes);
        }
        metadata[id] = next;
    }
    savePhase(id, value, assignments = [], revision) {
        const values = phaseValues(value);
        return this.transaction(id, revision, async (state, metadata, writes) => {
            const existing = value.id && state.phases.find(phase => phase.id === value.id);
            if (value.id && !existing) throw Error("This phase no longer exists.");
            const phase = { id: existing?.id ?? randomUUID(), ...values, order: existing?.order ?? Math.max(-1, ...state.phases.map(item => item.order ?? -1)) + 1 };
            if (existing) state.phases[state.phases.indexOf(existing)] = phase; else state.phases.push(phase);
            for (const { task, included } of assignments) await this.link(task, included ? phase.id : null, id, metadata, writes);
            return phase;
        });
    }
    saveMilestone(id, value, revision) {
        const values = milestoneValues(value);
        return this.transaction(id, revision, state => {
            const existing = value.id && state.milestones.find(item => item.id === value.id);
            if (value.id && !existing) throw Error("This milestone no longer exists.");
            const milestone = { id: existing?.id ?? randomUUID(), ...values };
            if (existing) state.milestones[state.milestones.indexOf(existing)] = milestone; else state.milestones.push(milestone);
            return milestone;
        });
    }
    remove(id, kind, objectId, revision) {
        return this.transaction(id, revision, (state, metadata) => {
            if (!["phases", "milestones"].includes(kind)) throw Error("Unknown planning object.");
            state[kind] = state[kind].filter(item => item.id !== objectId);
            if (kind === "phases") for (const [taskId, value] of Object.entries(metadata)) {
                if (value.phaseId === objectId) { metadata[taskId] = { ...value }; delete metadata[taskId].phaseId; }
            }
        });
    }
    reorder(id, phaseIds, revision) {
        return this.transaction(id, revision, state => {
            if (!Array.isArray(phaseIds) || phaseIds.length !== state.phases.length ||
                new Set(phaseIds).size !== phaseIds.length || state.phases.some(phase => !phaseIds.includes(phase.id))) {
                throw Error("This Roadmap's phase list changed. Reopen it before reordering.");
            }
            const byId = new Map(state.phases.map(phase => [phase.id, phase]));
            state.phases = phaseIds.map((id, order) => ({ ...byId.get(id), order }));
        });
    }
}
module.exports = { ProjectPlanningService };
