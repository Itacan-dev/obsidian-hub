"use strict";
const taskKey = task => task.id;
class PhaseTaskRead {
    constructor(service, projectId, phaseId, changed = () => { }) {
        Object.assign(this, { service, projectId, phaseId, changed });
        this.baseline = new Map();
        this.selected = new Map();
        this.available = new Map();
        this.candidates = [];
        this.closed = false;
        this.saving = false;
        this.loaded = false;
        this.generation = 0;
        this.stops = [];
        this.panel = service.plugin.nativeTaskHost.nativeTasks.createPanelRead({ plugin: service.plugin, component: { register: stop => this.stops.push(stop) }, workspace: { type: "project", id: projectId }, changed: () => {
                if (!this.closed && !this.saving)
                    changed();
            } });
        service.plugin.register(() => this.close());
    }
    async refresh() {
        const generation = ++this.generation, q = await this.panel.read();
        if (this.closed || this.saving || generation !== this.generation)
            return null;
        if (q?.availability !== "current")
            throw Error("Native Phase tasks unavailable.");
        this.beforePublish?.();
        this.candidates = q.tasks;
        this.available = new Map(q.tasks.map(t => [t.id, t]));
        if (!this.loaded)
            for (const task of q.tasks)
                if (task.phaseId === this.phaseId && this.phaseId) {
                    const entry = { id: task.id, ref: task, text: task.text, phaseId: task.phaseId };
                    this.baseline.set(task.id, entry);
                    this.selected.set(task.id, entry);
                }
        this.loaded = true;
        this.diagnostics = q.diagnostics;
        return q;
    }
    usable(entry) { const task = this.available.get(entry.id); return !!task && !task.nativeReadOnly && task.nativeReference.taskRevision === entry.ref.nativeReference.taskRevision; }
    pickerItems() { return this.candidates.filter(t => !t.nativeReadOnly && !this.selected.has(t.id)); }
    add(task) {
        if (this.closed || this.saving || !this.available.has(task.id))
            return false;
        this.selected.set(task.id, { id: task.id, ref: task, text: task.text, phaseId: task.phaseId });
        return true;
    }
    remove(id) {
        if (!this.closed && !this.saving)
            this.selected.delete(id);
    }
    freeze() { this.saving = true; this.generation++; }
    resume() { this.saving = false; }
    async assignments() {
        if (this.closed)
            throw Error("Phase editor closed.");
        return [...new Set([...this.baseline.keys(), ...this.selected.keys()])].filter(id => this.baseline.has(id) !== this.selected.has(id)).map(id => ({ task: (this.selected.get(id) ?? this.baseline.get(id)).ref, included: this.selected.has(id) }));
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        this.generation++;
        this.panel.close();
        this.stops.splice(0).forEach(stop => stop());
        this.onPluginClose?.();
    }
}
module.exports = { PhaseTaskRead, taskKey };
