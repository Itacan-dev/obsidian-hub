"use strict";
const { taskWorkspaces } = require("./task-locations");
const { normalize, nameScore, ownerOf, inScope, contextLabel, groupResults } = require("../domain/context-search");

class ContextSearchService {
    constructor(plugin) {
        this.plugin = plugin;
        this.files = null;
        this.tasks = null;
        this.notes = new Map();
        this.listeners = new Set();
        this.registrations = new Set();
        this.pendingFolder = null;
        this.disposed = false;
        const invalidate = () => {
            this.files = null; this.tasks = null;
            for (const listener of this.listeners) listener();
        };
        for (const event of ["create", "delete", "rename", "modify"]) {
            plugin.registerEvent(plugin.app.vault.on(event, (file, oldPath) => {
                for (const path of this.notes.keys()) if (path === file.path || path === oldPath ||
                    path.startsWith(file.path + "/") || oldPath && path.startsWith(oldPath + "/")) this.notes.delete(path);
                invalidate();
            }));
        }
        plugin.registerEvent(plugin.app.metadataCache.on("changed", invalidate));
        plugin.taskData.subscribe(plugin, () => { this.tasks = null; for (const listener of this.listeners) listener(); });
        plugin.planning?.subscribe(plugin, () => { for (const listener of this.listeners) listener(); });
        plugin.register(() => { this.disposed = true; this.notes.clear(); this.listeners.clear(); this.registrations.clear(); });
    }
    subscribe(component, listener) { this.listeners.add(listener); component.register(() => this.listeners.delete(listener)); }
    snapshot(dv) {
        if (!this.files) {
            this.workspaces = taskWorkspaces(this.plugin);
            const dashboards = new Set(this.workspaces.map(workspace => workspace.path));
            this.files = this.plugin.app.vault.getAllLoadedFiles().flatMap(file => {
                const owner = ownerOf(file.path, this.workspaces);
                if (!owner || file.path === owner.root || dashboards.has(file.path)) return [];
                const folder = Array.isArray(file.children);
                const aliases = !folder && this.plugin.app.metadataCache.getFileCache?.(file)?.frontmatter?.aliases;
                return [{ kind: folder ? "folders" : "files", path: file.path, file, owner,
                    title: folder ? file.name : file.extension?.toLowerCase() === "md" ? file.basename : file.name,
                    aliases: Array.isArray(aliases) ? aliases : typeof aliases === "string" ? [aliases] : [],
                    context: contextLabel(file.parent?.path ?? file.path.slice(0, file.path.lastIndexOf("/")), owner) }];
            });
        }
        if (!this.tasks) this.tasks = this.plugin.taskData.readPages(dv).flatMap(page => page.file.tasks).flatMap(task => {
            const owner = ownerOf(task.path, this.workspaces);
            return owner ? [{ kind: "tasks", title: task.text, path: task.path, task, owner, context: contextLabel(task.path, owner) }] : [];
        });
        return { workspaces: this.workspaces, files: this.files, tasks: this.tasks };
    }
    async note(file) {
        const key = file.path, stamp = file.stat?.mtime;
        const cached = this.notes.get(key);
        if (cached && cached.stamp === stamp) return cached.promise;
        const promise = this.plugin.app.vault.cachedRead(file).then(text => {
            // Index readable note text, excluding frontmatter/internal task markers.
            const plain = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
            return { plain, normalized: normalize(plain) };
        }).catch(() => { if (this.notes.get(key)?.promise === promise) this.notes.delete(key); return null; });
        this.notes.set(key, { stamp, promise });
        return promise;
    }
    async search(query, scope, dv, { onNames = () => {}, cancelled = () => false } = {}) {
        const term = normalize(query).trim();
        if (!term) return [];
        const snapshot = this.snapshot(dv), { workspaces } = snapshot;
        // Follow renamed workspace roots via the existing canonical context IDs.
        scope = scope ? workspaces.find(item => item.projectId === scope.projectId) ?? scope : null;
        const files = snapshot.files.filter(entry => inScope(entry, scope, workspaces));
        const candidates = [...files, ...snapshot.tasks.filter(entry => inScope(entry, scope, workspaces))];
        if (!scope) candidates.push(...workspaces.map(owner => ({ kind: owner.contextKind === "resource" ? "resources" : "projects",
            title: owner.name ?? owner.label, path: owner.path, owner, context: owner.root })));
        if (scope?.contextKind === "project" && this.plugin.planning) {
            const planning = this.plugin.planning.read(scope.projectId);
            for (const kind of ["phases", "milestones"]) candidates.push(...planning[kind].map(item => ({
                kind, id: item.id, title: item.name, path: scope.path, owner: scope,
                context: kind === "phases" ? item.start + " \u2013 " + item.end : item.date + (item.achieved ? " \u00b7 Achieved" : "")
            })));
        }
        const results = [], namedPaths = new Set();
        for (const entry of candidates) {
            const scores = [entry.title, ...(entry.aliases ?? [])].map(value => nameScore(value, term)).filter(value => value != null);
            // A path qualifier can disambiguate identically named notes/folders.
            const contextual = term.includes(" ") ? nameScore(entry.context + " " + entry.title, term) : null;
            if (contextual != null) scores.push(6 + contextual / 10);
            if (!scores.length) continue;
            results.push({ ...entry, score: Math.min(...scores) + (entry.kind === "tasks" ? 10 : 0) });
            if (entry.kind === "files") namedPaths.add(entry.path);
        }
        onNames(groupResults([...results]));
        const notes = files.filter(entry => entry.file.extension?.toLowerCase() === "md" && !namedPaths.has(entry.path));
        let cursor = 0;
        // Bounded concurrent cached reads, cancelled between files when typing/navigation changes.
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (cursor < notes.length && !cancelled() && !this.disposed) {
                const entry = notes[cursor++], text = await this.note(entry.file);
                if (!text) continue;
                const words = term.split(/\s+/);
                if (!words.every(word => text.normalized.includes(word))) continue;
                const position = text.normalized.indexOf(words[0]);
                const start = Math.max(0, position - 35);
                const snippet = (start ? "…" : "") + text.plain.slice(start, start + 160) + (start + 160 < text.plain.length ? "…" : "");
                results.push({ ...entry, kind: "notes", snippet, score: 20 });
            }
        }));
        return groupResults(results);
    }
    registerWorkspace(component, root, workspace, selectFolder, selectPlanning) {
        const registration = { root, workspace, selectFolder, selectPlanning };
        this.registrations.add(registration);
        component.register(() => this.registrations.delete(registration));
    }
    applyFolder(root) {
        const request = this.pendingFolder;
        if (!request?.ready) return;
        const registration = [...this.registrations].find(item => item.root === root && root.isConnected &&
            !root.closest(".hub-project-rail") && item.workspace.projectId === request.workspace.projectId);
        if (registration && (!request.document || root.ownerDocument === request.document)) {
            if (request.kind) registration.selectPlanning?.(request.kind, request.id);
            else registration.selectFolder(request.path);
            this.pendingFolder = null;
        }
    }
    async open(result, source) {
        const modes = this.plugin.workspaceModes;
        const path = this.plugin.taskData.currentPath(result.path);
        if (!this.plugin.app.vault.getAbstractFileByPath(path)) throw Error("This item no longer exists.");
        if (["projects", "resources"].includes(result.kind)) return modes.openProjectFull(result.owner, source);
        const planning = ["phases", "milestones"].includes(result.kind);
        if (planning && !this.plugin.planning.read(result.owner.projectId)[result.kind].some(item => item.id === result.id)) throw Error("This planning item no longer exists.");
        if (!planning && result.kind !== "folders") return modes.openProjectNote(path, "replace", source);
        const request = this.pendingFolder = { path, kind: planning ? result.kind : null, id: result.id, workspace: result.owner, document: source?.ownerDocument, ready: false };
        try {
            const opened = await modes.openProjectFull(result.owner, source);
            if (opened === false) { if (this.pendingFolder === request) this.pendingFolder = null; return false; }
            request.ready = true;
            const targetRoot = modes.dashboardRoot?.(modes.activeMainLeaf?.());
            if (targetRoot) this.applyFolder(targetRoot);
            if (this.pendingFolder === request) for (const { root } of this.registrations) this.applyFolder(root);
            return true;
        } catch (error) { if (this.pendingFolder === request) this.pendingFolder = null; throw error; }
    }
}
module.exports = { ContextSearchService };
