"use strict";
const { taskWorkspaces } = require("./task-locations");
const { normalize, nameScore, ownerOf, inScope, contextLabel, groupResults } = require("../domain/context-search");
const { workspaceRef, sameWorkspace } = require("../domain/workspace");
function taskSearchMessage(error, reveal = false) {
    if (error?.code === "INDEX_UNAVAILABLE")
        return "Task search is not ready yet.";
    if (!reveal)
        return "Task search is temporarily unavailable.";
    if (error?.code === "SOURCE_MISSING")
        return "This task's note is no longer available.";
    if (error?.code === "AMBIGUOUS_REFERENCE")
        return "This task has an ambiguous source. Refresh Search before opening it.";
    if (["STALE_REFERENCE", "REFERENCE_UNRESOLVED"].includes(error?.code))
        return "This task changed. Refresh Search and try again.";
    return "This task cannot be opened right now. Refresh Search and try again.";
}
class ContextSearchService {
    constructor(plugin, { onTaskDiagnostics = diagnostics => console.warn("Task Search diagnostics", diagnostics) } = {}) {
        this.plugin = plugin;
        this.onTaskDiagnostics = onTaskDiagnostics;
        this.taskGeneration = 0;
        this.files = null;
        this.tasks = null;
        this.notes = new Map();
        this.listeners = new Set();
        this.registrations = new Set();
        this.pendingFolder = null;
        this.disposed = false;
        const notify = () => {
            for (const listener of this.listeners) {
                try {
                    Promise.resolve(listener()).catch(() => { });
                }
                catch (_) { /* Views cannot break cache invalidation. */ }
            }
        };
        const invalidateTasks = () => { this.tasks = null; this.taskGeneration++; notify(); };
        const invalidate = () => {
            this.files = null;
            invalidateTasks();
        };
        for (const event of ["create", "delete", "rename", "modify"]) {
            plugin.registerEvent(plugin.app.vault.on(event, (file, oldPath) => {
                for (const path of this.notes.keys())
                    if (path === file.path || path === oldPath ||
                        path.startsWith(file.path + "/") || oldPath && path.startsWith(oldPath + "/"))
                        this.notes.delete(path);
                invalidate();
            }));
        }
        plugin.registerEvent(plugin.app.metadataCache.on("changed", invalidate));
        this.panels = [];
        this.syncTaskPanels = () => { const current = plugin.nativeTaskHost.nativeTasks.owners; this.panels = this.panels.filter(p => { if (current.some(owner => sameWorkspace(p.owner, owner))) return true; p.panel.close(); return false; }); for (const owner of current) if (!this.panels.some(p => sameWorkspace(p.owner, owner))) this.panels.push({ owner, panel: plugin.nativeTaskHost.nativeTasks.createPanelRead({ plugin, component: plugin, workspace: owner, changed: invalidateTasks }) }); };
        this.syncTaskPanels();
        plugin.planning?.subscribe(plugin, notify);
        plugin.register(() => {
            this.disposed = true;
            this.taskGeneration++;
            this.tasks = null;
            this.files = null;
            this.notes.clear();
            this.listeners.clear();
            this.registrations.clear();
            this.pendingFolder = null;
        });
    }
    subscribe(component, listener) { this.listeners.add(listener); component.register(() => this.listeners.delete(listener)); }
    fileSnapshot() {
        if (!this.files) {
            this.workspaces = taskWorkspaces(this.plugin);
            const dashboards = new Set(this.workspaces.map(workspace => workspace.path));
            this.files = this.plugin.app.vault.getAllLoadedFiles().flatMap(file => {
                const owner = ownerOf(file.path, this.workspaces);
                if (!owner || file.path === owner.root || dashboards.has(file.path))
                    return [];
                const folder = Array.isArray(file.children);
                const aliases = !folder && this.plugin.app.metadataCache.getFileCache?.(file)?.frontmatter?.aliases;
                return [{ kind: folder ? "folders" : "files", path: file.path, file, owner,
                        title: folder ? file.name : file.extension?.toLowerCase() === "md" ? file.basename : file.name,
                        aliases: Array.isArray(aliases) ? aliases : typeof aliases === "string" ? [aliases] : [],
                        context: contextLabel(file.parent?.path ?? file.path.slice(0, file.path.lastIndexOf("/")), owner) }];
            });
        }
        return { workspaces: this.workspaces, files: this.files };
    }
    report(diagnostics) {
        if (!diagnostics.length || this.disposed)
            return;
        try {
            Promise.resolve(this.onTaskDiagnostics(diagnostics)).catch(() => { });
        }
        catch (_) { /* Diagnostics are not task state. */ }
    }
    async taskSnapshot(cancelled) {
        this.syncTaskPanels();
        while (!cancelled() && !this.disposed) {
            const generation = this.taskGeneration;
            let cached = this.tasks;
            if (!cached) {
                cached = { generation };
                cached.promise = Promise.all(this.panels.map(async ({ owner, panel }) => {
                    const result = await panel.read();
                    if (result?.availability !== "current")
                        throw Error("Native Search authority unavailable.");
                    return { owner, tasks: result.tasks };
                })).then(owners => ({ owners, diagnostics: [] })).then(query => {
                    if (!this.disposed && generation === this.taskGeneration)
                        this.report(query.diagnostics);
                    return { query, taskError: null };
                }, error => {
                    if (this.tasks === cached)
                        this.tasks = null; // A later request may retry a transient failure.
                    if (!this.disposed && generation === this.taskGeneration)
                        this.report([{ level: "query", rowIndex: null,
                                code: error.code ?? "READ_FAILED", sourcePath: null, message: error.message ?? "Task query failed." }]);
                    return { query: null, taskError: error };
                });
                this.tasks = cached;
            }
            const result = await cached.promise;
            if (cancelled() || this.disposed)
                return null;
            if (generation !== this.taskGeneration)
                continue;
            return result;
        }
        return null;
    }
    async snapshot(_dv, { cancelled = () => false } = {}) {
        const taskSnapshot = await this.taskSnapshot(cancelled);
        if (!taskSnapshot || cancelled() || this.disposed)
            return null;
        const { files, workspaces } = this.fileSnapshot();
        if (taskSnapshot.entries?.files === files)
            return { workspaces, files,
                tasks: taskSnapshot.entries.tasks, taskError: taskSnapshot.taskError };
        const tasks = [];
        for (const group of taskSnapshot.query?.owners ?? []) {
            const owner = workspaces.find(w => sameWorkspace(workspaceRef(w), group.owner));
            if (!owner)
                continue;
            for (const task of group.tasks)
                tasks.push({ kind: "tasks", title: task.text, searchText: task.text, path: owner.path, task, owner, context: owner.name ?? owner.label, key: JSON.stringify([task.nativeReference.authorityId, task.id]) });
        }
        taskSnapshot.entries = { files, tasks };
        return { workspaces, files, tasks, taskError: taskSnapshot.taskError };
    }
    async note(file) {
        const key = file.path, stamp = file.stat?.mtime;
        const cached = this.notes.get(key);
        if (cached && cached.stamp === stamp)
            return cached.promise;
        const promise = this.plugin.app.vault.cachedRead(file).then(text => {
            // Index readable note text, excluding frontmatter/internal task markers.
            const plain = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
            return { plain, normalized: normalize(plain) };
        }).catch(() => {
            if (this.notes.get(key)?.promise === promise)
                this.notes.delete(key);
            return null;
        });
        this.notes.set(key, { stamp, promise });
        return promise;
    }
    async search(query, scope, dv, { onNames = () => { }, cancelled = () => false, onTaskStatus = () => { } } = {}) {
        const requestedScope = scope?.projectId ?? null;
        let snapshotGeneration = null;
        const obsolete = () => cancelled() || this.disposed || (scope?.projectId ?? null) !== requestedScope ||
            snapshotGeneration !== null && snapshotGeneration !== this.taskGeneration;
        const term = normalize(query).trim();
        if (!term || obsolete())
            return [];
        const snapshot = await this.snapshot(dv, { cancelled: obsolete });
        if (!snapshot || obsolete())
            return [];
        snapshotGeneration = this.taskGeneration;
        onTaskStatus(snapshot.taskError ? taskSearchMessage(snapshot.taskError) : "");
        const { workspaces } = snapshot;
        // Follow renamed workspace roots via the existing canonical context IDs.
        scope = scope ? workspaces.find(item => item.projectId === scope.projectId) ?? scope : null;
        const files = snapshot.files.filter(entry => inScope(entry, scope, workspaces));
        const candidates = [...files, ...snapshot.tasks.filter(entry => inScope(entry, scope, workspaces))];
        if (!scope)
            candidates.push(...workspaces.map(owner => ({ kind: owner.contextKind === "resource" ? "resources" : "projects",
                title: owner.name ?? owner.label, path: owner.path, owner, context: owner.root })));
        if (scope?.contextKind === "project" && this.plugin.planning) {
            const planning = this.plugin.planning.read(scope.projectId);
            for (const kind of ["phases", "milestones"])
                candidates.push(...planning[kind].map(item => ({
                    kind, id: item.id, title: item.name, path: scope.path, owner: scope,
                    context: kind === "phases" ? item.start + " \u2013 " + item.end : item.date + (item.achieved ? " \u00b7 Achieved" : "")
                })));
        }
        const results = [], namedPaths = new Set();
        for (const entry of candidates) {
            const scores = [entry.searchText ?? entry.title, ...(entry.aliases ?? [])].map(value => nameScore(value, term)).filter(value => value != null);
            // A path qualifier can disambiguate identically named notes/folders.
            const contextual = term.includes(" ") ? nameScore(entry.context + " " + (entry.searchText ?? entry.title), term) : null;
            if (contextual != null)
                scores.push(6 + contextual / 10);
            if (!scores.length)
                continue;
            results.push({ ...entry, score: Math.min(...scores) + (entry.kind === "tasks" ? 10 : 0) });
            if (entry.kind === "files")
                namedPaths.add(entry.path);
        }
        if (obsolete())
            return [];
        onNames(groupResults([...results]));
        const notes = files.filter(entry => entry.file.extension?.toLowerCase() === "md" && !namedPaths.has(entry.path));
        let cursor = 0;
        // Bounded concurrent cached reads, cancelled between files when typing/navigation changes.
        await Promise.all(Array.from({ length: 4 }, async () => {
            while (cursor < notes.length && !obsolete()) {
                const entry = notes[cursor++], text = await this.note(entry.file);
                if (!text || obsolete())
                    continue;
                const words = term.split(/\s+/);
                if (!words.every(word => text.normalized.includes(word)))
                    continue;
                const position = text.normalized.indexOf(words[0]);
                const start = Math.max(0, position - 35);
                const snippet = (start ? "…" : "") + text.plain.slice(start, start + 160) + (start + 160 < text.plain.length ? "…" : "");
                results.push({ ...entry, kind: "notes", snippet, score: 20 });
            }
        }));
        return obsolete() ? [] : groupResults(results);
    }
    registerWorkspace(component, root, workspace, selectFolder, selectPlanning) {
        const registration = { root, workspace, selectFolder, selectPlanning };
        this.registrations.add(registration);
        component.register(() => this.registrations.delete(registration));
    }
    applyFolder(root) {
        const request = this.pendingFolder;
        if (!request?.ready)
            return;
        const registration = [...this.registrations].find(item => item.root === root && root.isConnected &&
            !root.closest(".hub-project-rail") && item.workspace.projectId === request.workspace.projectId);
        if (registration && (!request.document || root.ownerDocument === request.document)) {
            if (request.kind)
                registration.selectPlanning?.(request.kind, request.id);
            else
                registration.selectFolder(request.path);
            this.pendingFolder = null;
        }
    }
    async open(result, source, { cancelled = () => false } = {}) {
        if (result.kind === "tasks") {
            try {
                if (this.disposed || cancelled())
                    return false;
                const runtime = this.plugin.nativeTaskHost.runtime(result.task.nativeReference.owner), task = (await runtime.list()).tasks.find(t => t.id === result.task.id);
                if (!task || task.nativeReadOnly)
                    throw Error("This native task is unavailable.");
                const modal = require("../ui/task-editor").openTaskEditor(require("./native-task-locations").locationService(runtime.formService(this.plugin.app), this.plugin, result.task.nativeReference.owner), task);
                await modal.ready;
                return !!modal.modalEl.isConnected;
            }
            catch (error) {
                this.report([{ level: "row", rowIndex: null, code: error.code ?? "REVEAL_FAILED", sourcePath: null, message: error.message ?? "Task reveal failed." }]);
                throw Error(taskSearchMessage(error, true), { cause: error });
            }
        }
        const modes = this.plugin.workspaceModes;
        const path = result.path;
        if (!this.plugin.app.vault.getAbstractFileByPath(path))
            throw Error("This item no longer exists.");
        if (["projects", "resources"].includes(result.kind))
            return modes.openProjectFull(result.owner, source);
        const planning = ["phases", "milestones"].includes(result.kind);
        if (planning && !this.plugin.planning.read(result.owner.projectId)[result.kind].some(item => item.id === result.id))
            throw Error("This planning item no longer exists.");
        if (!planning && result.kind !== "folders")
            return modes.openProjectNote(path, "replace", source);
        const request = this.pendingFolder = { path, kind: planning ? result.kind : null, id: result.id, workspace: result.owner, document: source?.ownerDocument, ready: false };
        try {
            const opened = await modes.openProjectFull(result.owner, source);
            if (opened === false) {
                if (this.pendingFolder === request)
                    this.pendingFolder = null;
                return false;
            }
            request.ready = true;
            const targetRoot = modes.dashboardRoot?.(modes.activeMainLeaf?.());
            if (targetRoot)
                this.applyFolder(targetRoot);
            if (this.pendingFolder === request)
                for (const { root } of this.registrations)
                    this.applyFolder(root);
            return true;
        }
        catch (error) {
            if (this.pendingFolder === request)
                this.pendingFolder = null;
            throw error;
        }
    }
}
module.exports = { ContextSearchService, taskSearchMessage };
