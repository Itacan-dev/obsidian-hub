"use strict";
const { randomUUID } = require("crypto");
const { planningState, phaseValues, milestoneValues } = require("../domain/project-planning");
class ProjectPlanningService {
    constructor(plugin) { this.plugin = plugin; this.listeners = new Set(); this.queue = Promise.resolve(); plugin.register?.(() => this.listeners.clear()); }
    project(id) {
        const project = this.plugin.projectWizard.getProjectById(id);
        if (!project || project.contextKind === "resource")
            throw Error("This Project is no longer available.");
        return project;
    }
    read(id) { return planningState(this.plugin.projectWizard.data.projectPlanning?.[id]); }
    phases(id) { return this.read(id).phases; }
    phaseFor(task) {
        if (!task.phaseId)
            return null;
        const owner = task.nativeReference?.owner;
        return owner?.type === "project" ? this.phases(owner.id).find(phase => phase.id === task.phaseId) : null;
    }
    async tasks(_dv, id) { return (await this.taskCandidates(id)).tasks; }
    async taskCandidates(id) { this.project(id); return this.plugin.nativeTaskHost.runtime({ type: "project", id }).list(); }
    subscribe(component, callback) { this.listeners.add(callback); component.register(() => this.listeners.delete(callback)); }
    changed(id) {
        for (const listener of this.listeners)
            listener(id);
    }
    transaction(id, revision, update) {
        const work = this.queue.then(async () => {
            this.project(id);
            const data = this.plugin.projectWizard.data, state = this.read(id);
            if (revision != null && revision !== state.revision)
                throw Error("This Roadmap changed. Reopen it.");
            const previous = data.projectPlanning, result = await update(state);
            state.revision++;
            data.projectPlanning = { ...data.projectPlanning, [id]: state };
            try {
                await this.plugin.dataStore.save(data);
            }
            catch (e) {
                data.projectPlanning = previous;
                throw e;
            }
            await this.plugin.nativeTaskHost.refreshInventory();
            this.changed(id);
            return result;
        });
        this.queue = work.catch(() => { });
        return work;
    }
    async link(task, phaseId, projectId) {
        if (task.nativeReference?.owner.type !== "project" || task.nativeReference.owner.id !== projectId)
            throw Error("Choose a native task inside this Project.");
        const runtime = this.plugin.nativeTaskHost.runtime({ type: "project", id: projectId }), current = (await runtime.list()).tasks.find(t => t.id === task.id);
        if (current && (current.phaseId ?? null) === (phaseId ?? null))
            return;
        if (!current || (current.phaseId ?? null) !== (task.phaseId ?? null))
            throw Error("Task Phase changed. Reopen the Phase.");
        if ((current.phaseId ?? null) === (phaseId ?? null))
            return;
        const service = runtime.formService(this.plugin.app), snapshot = await service.read(current), result = await service.save(snapshot, { ...snapshot, phaseId });
        if (!["committed", "replayed"].includes(result.outcome.status))
            throw Error("Review the original native Phase assignment outcome before retrying.");
    }
    savePhase(id, value, assignments = [], revision) {
        const values = phaseValues(value);
        return this.transaction(id, revision, async (state) => {
            const existing = value.id && state.phases.find(phase => phase.id === value.id);
            if (value.id && !existing)
                throw Error("This phase no longer exists.");
            const phase = { id: existing?.id ?? randomUUID(), ...values, order: existing?.order ?? Math.max(-1, ...state.phases.map(item => item.order ?? -1)) + 1 };
            if (existing)
                state.phases[state.phases.indexOf(existing)] = phase;
            else
                state.phases.push(phase);
            return phase;
        }).then(async (phase) => {
            for (const { task, included } of assignments)
                await this.link(task, included ? phase.id : null, id);
            return phase;
        });
    }
    saveMilestone(id, value, revision) {
        const values = milestoneValues(value);
        return this.transaction(id, revision, state => {
            const existing = value.id && state.milestones.find(item => item.id === value.id);
            if (value.id && !existing)
                throw Error("This milestone no longer exists.");
            const milestone = { id: existing?.id ?? randomUUID(), ...values };
            if (existing)
                state.milestones[state.milestones.indexOf(existing)] = milestone;
            else
                state.milestones.push(milestone);
            return milestone;
        });
    }
    async remove(id, kind, objectId, revision) {
        if (kind === "phases") {
            const state = this.read(id);
            if (revision != null && state.revision !== revision)
                throw Error("This Roadmap changed. Reopen it.");
            for (const task of (await this.taskCandidates(id)).tasks.filter(t => t.phaseId === objectId))
                await this.link(task, null, id);
        }
        return this.transaction(id, revision, state => {
            if (!["phases", "milestones"].includes(kind))
                throw Error("Unknown planning object.");
            state[kind] = state[kind].filter(item => item.id !== objectId);
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
