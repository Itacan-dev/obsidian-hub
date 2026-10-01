"use strict";
const { taskDisplayText, taskIdentity } = require("../domain/tasks");
const { taskMetadata } = require("../domain/task-planning");

const within = (path, root) => path === root || path.startsWith(`${root}/`);
const markdown = file => file?.extension?.toLowerCase() === "md";

// Dataview updates page.file.path on rename, but list-item links (and thus
// task.path) can retain the old path until the next content import. The page
// is authoritative. Never mutate objects owned by Dataview's index.
function tasksForPage(page) {
    const path = page.file.path;
    const copies = new Map();
    const relocate = task => {
        if (copies.has(task)) return copies.get(task);
        const copy = { ...task, path };
        copies.set(task, copy);
        for (const key of ["link", "section", "header"]) {
            if (task[key]?.withPath) copy[key] = task[key].withPath(path);
        }
        for (const key of ["children", "subtasks"]) {
            if (task[key]) copy[key] = Array.from(task[key], relocate);
        }
        return copy;
    };
    const tasks = Array.from(page.file.tasks ?? [], relocate);
    const byLine = new Map(Array.from(page.file.lists ?? tasks, item => [item.line, item]));
    const taskLines = new Set(tasks.map(task => task.line));
    const hasTaskParent = task => {
        let parent = task.parent;
        const seen = new Set();
        while (parent != null && !seen.has(parent)) {
            if (taskLines.has(parent)) return true;
            seen.add(parent);
            parent = byLine.get(parent)?.parent;
        }
        return false;
    };
    // Children can include ordinary list items between a parent and a Step.
    const descendants = task => Array.from(task.children ?? task.subtasks ?? []).flatMap(child =>
        [...(child.task === false ? [] : [child]), ...descendants(child)]);
    const childLines = new Set(tasks.flatMap(task => descendants(task).map(child => child.line)));
    return tasks.filter(task => !hasTaskParent(task) && !childLines.has(task.line)).map(task => ({
        ...task, text: taskDisplayText(task.text), hubTaskId: taskIdentity(task.text),
        steps: descendants(task).map(step => ({ ...step, text: taskDisplayText(step.text), hubTaskId: taskIdentity(step.text) }))
    }));
}

class HubTaskDataService {
    constructor(app, scheduler = {}) {
        this.app = app;
        this.requestFrame = scheduler.request ?? (callback => requestAnimationFrame(callback));
        this.cancelFrame = scheduler.cancel ?? (id => cancelAnimationFrame(id));
        this.subscribers = new Set();
        this.events = [];
        this.renamed = new Map();
        this.paths = new Set();
        this.frame = null;
        this.all = false;
        this.metadata = scheduler.metadata ?? (() => ({}));
    }

    currentPath(path) {
        // Retain the actual vault object, so chained folder renames also work.
        if (this.app.vault.getAbstractFileByPath(path)) return path;
        const file = this.renamed.get(path);
        // Keep the last location even after deletion: a view following a
        // renamed context must still receive that context's delete event.
        return file?.path ?? path;
    }

    readPages(dv, root) {
        const folder = root == null ? null : this.currentPath(root);
        // Count identities across the vault, even in a scoped Workspace. A
        // pasted copy must never silently share another task's metadata.
        const pages = dv.pages("").array().filter(page => markdown(this.app.vault.getAbstractFileByPath(page.file.path)))
            .map(page => ({ ...page, file: { ...page.file, tasks: tasksForPage(page) } }));
        const counts = new Map();
        for (const page of pages) for (const parent of page.file.tasks) {
            for (const task of [parent, ...parent.steps]) {
                if (task.hubTaskId) counts.set(task.hubTaskId, (counts.get(task.hubTaskId) ?? 0) + 1);
            }
        }
        return pages.filter(page => {
            const path = page.file.path;
            return markdown(this.app.vault.getAbstractFileByPath(path)) &&
                (folder == null || within(path, folder));
        }).map(page => ({
            ...page,
            file: { ...page.file, tasks: page.file.tasks.map(task => {
                const identityConflict = !!task.hubTaskId && counts.get(task.hubTaskId) > 1;
                return { ...task, ...taskMetadata(identityConflict ? {} : this.metadata(task.hubTaskId)), identityConflict };
            }) }
        }));
    }

    readWorkspace(dv, workspace, resources = []) {
        const { validLocation } = require("../domain/task-views");
        const root = this.currentPath(workspace.root);
        return this.readPages(dv).flatMap(page => page.file.tasks).filter(task =>
            validLocation(task.path, { ...workspace, root }) ||
            (workspace.contextKind !== "resource" && task.linkedProjectId === workspace.projectId &&
                resources.some(resource => validLocation(task.path, resource))));
    }

    subscribe(component, refresh, roots = () => null) {
        const subscription = { refresh, roots };
        this.subscribers.add(subscription);
        if (this.subscribers.size === 1) this.listen();
        const dispose = () => {
            this.subscribers.delete(subscription);
            if (!this.subscribers.size) this.stop();
        };
        component.register(dispose);
        return dispose;
    }

    listen() {
        const { vault, metadataCache } = this.app;
        const on = (emitter, event, callback) => {
            this.events.push([emitter, emitter.on(event, callback)]);
        };
        const structural = (file, oldPath) => {
            if (!file || (!Array.isArray(file.children) && !markdown(file) && !/\.md$/i.test(oldPath ?? ""))) return;
            if (oldPath) this.renamed.set(oldPath, file);
            this.invalidate(file.path, oldPath);
        };
        on(vault, "rename", structural);
        on(vault, "delete", file => structural(file));
        on(vault, "create", file => {
            if (Array.isArray(file.children)) structural(file);
        });
        // File creation/modification must wait for Dataview's completed import,
        // not vault.modify or metadataCache.changed (both precede that import).
        on(metadataCache, "dataview:metadata-change", (_type, file, oldPath) => {
            if (markdown(file) || /\.md$/i.test(oldPath ?? "")) {
                this.invalidate(file.path, oldPath);
            }
        });
        on(metadataCache, "dataview:index-ready", () => {
            this.all = true;
            this.invalidate();
        });
        // Reclassify future/overdue tasks across local midnight and after wake.
        let day = new Date().toDateString();
        this.dayTimer = setInterval(() => {
            const next = new Date().toDateString();
            if (day !== next) { day = next; this.all = true; this.invalidate(); }
        }, 30000);
        this.dayTimer.unref?.();
    }

    invalidateAll() { this.all = true; this.invalidate(); }
    invalidate(...paths) {
        for (const path of paths) if (path) this.paths.add(path);
        if (this.frame != null) return;
        // Coalesce a folder rename and its descendant/index events for the next
        // paint. This is batching, not an assumed indexing/settling timeout.
        this.frame = this.requestFrame(() => {
            this.frame = null;
            const changed = [...this.paths];
            const all = this.all;
            this.paths.clear();
            this.all = false;
            for (const subscription of this.subscribers) {
                const roots = subscription.roots();
                if (!all && roots && !roots.some(root => changed.some(path =>
                    within(path, root) || within(root, path) ||
                    within(path, this.currentPath(root)) || within(this.currentPath(root), path)
                ))) continue;
                try {
                    subscription.refresh();
                } catch (error) {
                    console.error("Hub task refresh failed", error);
                }
            }
        });
    }

    stop() {
        clearInterval(this.dayTimer);
        for (const [emitter, ref] of this.events) emitter.offref(ref);
        this.events = [];
        if (this.frame != null) this.cancelFrame(this.frame);
        this.frame = null;
        this.paths.clear();
        this.renamed.clear();
        this.all = false;
    }

    destroy() {
        this.subscribers.clear();
        this.stop();
    }
}

module.exports = { HubTaskDataService, tasksForPage };
