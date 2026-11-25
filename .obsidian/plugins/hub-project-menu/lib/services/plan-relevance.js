"use strict";

const { derivePlanRelevance, sameOrInside } = require("../domain/plan-relevance");
const { refOf } = require("../domain/global-plan");
const { createNativeTaskLocations } = require("./native-task-locations");

class PlanRelevance {
    constructor(plugin) {
        this.plugin = plugin;
        this.plan = plugin.globalPlan;
        this.locations = createNativeTaskLocations(plugin);
        this.snapshot = derivePlanRelevance(null, [], null);
        this.listeners = new Set();
        this.generation = 0;
        const invalidate = () => this.invalidate();
        this.plan.subscribe(plugin, invalidate);
        const stopOath = plugin.oath?.onChange(invalidate);
        const { vault, metadataCache } = plugin.app;
        for (const event of ["create", "rename", "delete"]) {
            if (vault.on) plugin.registerEvent(vault.on(event, invalidate));
        }
        if (metadataCache?.on) {
            const dashboards = new WeakSet(vault.getMarkdownFiles().filter(file => this.workspaceFile(file)));
            const resourcePaths = new Set(plugin.projectWizard.getResourceTypes().map(resource => resource.path));
            plugin.registerEvent(metadataCache.on("changed", file => {
                const wasDashboard = dashboards.has(file);
                const isDashboard = resourcePaths.has(file.path) || this.workspaceFile(file);
                if (isDashboard) dashboards.add(file);
                else if (wasDashboard) dashboards.delete(file);
                if (isDashboard || wasDashboard) invalidate();
            }));
        }
        plugin.register(() => {
            this.disposed = true;
            stopOath?.();
            this.listeners.clear();
        });
        invalidate();
    }

    workspaceFile(file) {
        const type = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.type;
        return type === "project" || type === "resource";
    }

    subscribe(component, callback) {
        this.listeners.add(callback);
        const stop = () => this.listeners.delete(callback);
        component?.register(stop);
        return stop;
    }

    publish(snapshot) {
        if (snapshot.signature === this.snapshot.signature) return;
        this.snapshot = snapshot;
        for (const callback of this.listeners) {
            try { callback(snapshot); }
            catch (error) { console.error("Updating Plan relevance", error); }
        }
    }

    invalidate() {
        this.generation++;
        const active = this.plan.active(), oath = this.plugin.oath;
        if ((active?.id ?? null) !== this.snapshot.planId) {
            this.publish(derivePlanRelevance(active, [], oath?.active ? oath.focus : null));
        }
        if (this.queued || this.disposed) return;
        this.queued = true;
        queueMicrotask(() => {
            this.queued = false;
            void this.refresh().catch(error => console.error("Resolving Plan relevance", error));
        });
    }

    async refresh() {
        if (this.disposed) return;
        const generation = this.generation;
        const active = this.plan.active(), oath = this.plugin.oath;
        const focus = oath?.active ? oath.focus : null;
        if (!active?.content.entries.length) {
            this.publish(derivePlanRelevance(active, [], focus));
            return;
        }
        const { vault } = this.plugin.app, wizard = this.plugin.projectWizard;
        const available = context => context && !context.deleted && vault.getAbstractFileByPath(context.path);
        const items = (await this.plan.references.resolve(active.content.entries)).filter(item => {
            if (item.entry.kind === "workspace" || item.entry.kind === "task") return available(item.context);
            return true;
        });
        if (this.disposed || generation !== this.generation) return;
        this.publish(derivePlanRelevance(active, items, focus, {
            fileOwner: path => {
                const owner = wizard.getContextForPath(path);
                return available(owner) ? refOf(owner) : null;
            },
            intendedProject: (ref, path) => {
                if (ref?.type !== "project") return null;
                const project = wizard.getProjectById(ref.id);
                if (!available(project)) return null;
                const attached = wizard.getResourceFolders(project.resourceFolderIds ?? []);
                return attached.some(folder => Array.isArray(vault.getAbstractFileByPath(folder.path)?.children) &&
                    sameOrInside(path, folder.path)) ? ref : null;
            },
            taskLocation: task => {
                try { return this.locations.resolve(task.nativeReference.owner, task.location); }
                catch { return null; }
            }
        }));
    }
}

module.exports = { PlanRelevance };
