"use strict";

class ProjectDeletionCancelled extends Error {
    constructor() { super("Project deletion cancelled."); this.name = "HubProjectDeletionCancelled"; }
}
const isProjectDeletionCancelled = error => error?.name === "HubProjectDeletionCancelled";

// Guard the common Obsidian trash entry point, including Hub menus, native
// menus and keyboard deletion. Ordinary notes/resources retain their behavior.
class ProjectDeletionGuard {
    constructor(app, confirm) {
        this.app = app;
        this.confirm = confirm;
        this.active = true;
        this.queue = Promise.resolve();
        this.originalTrash = app.fileManager.trashFile;
        const guard = this;
        this.wrapper = function(target, ...args) {
            if (!guard.active || !guard.projectsWithin(target).length) return guard.originalTrash.call(this, target, ...args);
            return guard.trash(target, { args, receiver: this });
        };
        app.fileManager.trashFile = this.wrapper;
    }

    projectsWithin(target) {
        const folder = Array.isArray(target?.children);
        return this.app.vault.getMarkdownFiles().filter(file =>
            (file === target || (folder && file.path.startsWith(target.path + "/"))) &&
            this.app.metadataCache.getFileCache(file)?.frontmatter?.type === "project"
        ).map(file => ({ file, path: file.path, name: file.basename }))
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    trash(target, { args = [], onApproved = null, receiver = this.app.fileManager, requiredProject = null } = {}) {
        const requestedPath = target.path;
        const projects = this.projectsWithin(target);
        const run = async () => {
            if (!this.active) throw new ProjectDeletionCancelled();
            if (requiredProject && !projects.some(project => project.file === requiredProject)) throw new ProjectDeletionCancelled();
            const unchanged = () => {
                if (!this.active || target.path !== requestedPath ||
                    this.app.vault.getAbstractFileByPath(requestedPath) !== target) return false;
                const current = this.projectsWithin(target);
                return current.length === projects.length && current.every((item, i) =>
                    item.file === projects[i].file && item.path === projects[i].path && item.name === projects[i].name);
            };
            for (const project of projects) {
                if (!unchanged() || !await this.confirm(project.name, requestedPath)) throw new ProjectDeletionCancelled();
            }
            if (!unchanged()) throw new ProjectDeletionCancelled();
            onApproved?.();
            return this.originalTrash.call(receiver, target, ...args);
        };
        const result = this.queue.then(run);
        this.queue = result.catch(() => {});
        return result;
    }

    destroy() {
        this.active = false;
        if (this.app.fileManager.trashFile === this.wrapper) this.app.fileManager.trashFile = this.originalTrash;
    }
}

module.exports = { ProjectDeletionGuard, isProjectDeletionCancelled };
