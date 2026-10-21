"use strict";
// All task data lives in Maps. The only source read is the existing plugin code,
// compiled without onload so its real history methods can be reused in isolation.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { HubTaskDataService } = require("../services/task-data");
const { HubTaskEditor } = require("../services/task-editor");
const { taskLineDetails } = require("../domain/tasks");
const { legacyTaskHandle, workspaceRef } = require("../services/task-service-legacy-values");
const { TaskService } = require("../services/task-service");
const { LegacyTaskAdapter } = require("../services/task-service-legacy");
const clone = value => JSON.parse(JSON.stringify(value));
const notices = [];
const originalLoad = Module._load;
const stub = { Plugin: class {}, Modal: class {}, Menu: class {}, FuzzySuggestModal: class {},
    TFile: class {}, TFolder: class {}, normalizePath: p => p, Notice: class { constructor(text) { notices.push(text); } } };
function installObsidianStub() {
    Module._load = function(name) { return name === "obsidian" ? stub : originalLoad.apply(this, arguments); };
}
function restoreObsidianStub() { Module._load = originalLoad; }
installObsidianStub();
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Wizard=ProjectWizardService;", filename);
const Plugin = compiled.exports;

class Emitter {
    constructor() { this.listeners = new Map(); }
    on(name, callback) { const ref = { name, callback }; this.listeners.set(ref, ref); return ref; }
    offref(ref) { this.listeners.delete(ref); }
    emit(name, ...args) { for (const ref of this.listeners.values()) if (ref.name === name) ref.callback(...args); }
}
const contexts = () => [
    { projectId: "private", name: "Private", root: "Projects/Private", path: "Projects/Private/Private.md", contextKind: "project", status: "active" },
    { projectId: "itacan", name: "Itacan", root: "Projects/Itacan", path: "Projects/Itacan/Itacan.md", contextKind: "project", status: "active", resourceFolderIds: ["mounted-folder"] },
    { projectId: "hub", name: "Obsidian Hub", root: "Projects/Obsidian Hub", path: "Projects/Obsidian Hub/Obsidian Hub.md", contextKind: "project", status: "active" },
    { projectId: "resource:study", resourceType: "study", name: "Knowledge", root: "Resources/Knowledge", path: "Resources/Knowledge/Knowledge.md", contextKind: "resource" }
];

function fixture(options = {}) {
    const files = new Map(), contents = new Map(), pages = new Map(), frames = new Map(), errors = [];
    const owners = contexts(), vault = new Emitter(), metadataCache = new Emitter();
    const state = { writes: 0, metadataSaves: 0, historySaves: 0, failWrite: false, failMetadata: false, failHistory: false, failRollback: false };
    const add = (path, text) => { const file = { path, extension: "md" }; files.set(path, file); contents.set(path, text); index(file); return file; };
    // Minimal synthetic Dataview index, using the existing task-line recognizer.
    function index(file) {
        const tasks = [], lists = [], stack = [];
        let fence = null;
        for (const [line, value] of contents.get(file.path).split(/\r?\n/).entries()) {
            if (/^\s*(`{3,}|~{3,})/.test(value)) { fence = fence ? null : true; continue; }
            if (fence) continue;
            const details = taskLineDetails(value);
            if (!details && !/^\s*[-*+]\s/.test(value)) continue;
            const indent = value.match(/^\s*/)[0].replace(/\t/g, "    ").length;
            while (stack.length && indent <= stack.at(-1).indent) stack.pop();
            const task = { path: file.path, line, parent: stack.at(-1)?.line ?? null,
                text: details?.text ?? value.trim().slice(2), task: !!details, children: [], completed: /^[xX]$/.test(details?.marker) };
            stack.at(-1)?.item.children.push(task);
            lists.push(task); if (details) tasks.push(task);
            stack.push({ line, indent, item: task });
        }
        pages.set(file.path, { file: { path: file.path, tasks, lists } });
    }
    Object.assign(vault, {
        getAbstractFileByPath: path => files.get(path), getMarkdownFiles: () => [...files.values()].filter(file => file.extension === "md"),
        getAllLoadedFiles: () => [...files.values()], read: async file => {
            if (!contents.has(file.path)) throw Error("Synthetic source missing"); return contents.get(file.path);
        }, create: async () => { throw Error("Tests never create folder task notes"); },
        process: async (file, transform) => {
            state.writes++;
            if (state.failWrite || state.failRollback && state.writes > 1) throw Error("Synthetic write failure");
            const text = transform(contents.get(file.path));
            contents.set(file.path, text); index(file);
            if (options.mirror) await options.mirror(file.path, text);
            metadataCache.emit("dataview:metadata-change", "update", file);
        }
    });
    const plugin = Object.assign(new Plugin(), { app: { vault, metadataCache, plugins: { plugins: {} } },
        markProjectChangedByPath() {}, notifyCompletedTasksChanged() {}, oath: { changed() {} } });
    const wizard = Object.assign(Object.create(Plugin.Wizard.prototype), {
        data: { taskMetadata: clone(options.metadata ?? {}), resourceFolders: { "mounted-folder": { path: "Resources/Knowledge/Mounted" } } },
        completedTaskHistory: [], completedTaskChecks: [],
        getContextForPath: path => owners.find(owner => path === owner.root || path.startsWith(owner.root + "/")) ?? null,
        getProjectById: id => owners.find(owner => owner.contextKind === "project" && owner.projectId === id) ?? null,
        getProjectRecords: () => owners.filter(owner => owner.contextKind === "project"),
        getResourceById: id => owners.find(owner => owner.resourceType === id) ?? null,
        store: { save: async () => { state.historySaves++; if (state.failHistory) throw Error("Synthetic history failure"); } }
    });
    plugin.projectWizard = wizard;
    plugin.dataStore = options.dataStore ?? { save: async () => { state.metadataSaves++; if (state.failMetadata) throw Error("Synthetic metadata failure"); } };
    plugin.planning = { phases: id => id === "private" || id === "itacan" || id === "hub" ? [{ id: "phase-1", name: "First" }] : [] };
    plugin.taskData = new HubTaskDataService(plugin.app, {
        request: callback => { const id = Symbol(); frames.set(id, callback); return id; }, cancel: id => frames.delete(id),
        metadata: id => wizard.data.taskMetadata[id]
    });
    plugin.taskEditor = new HubTaskEditor(plugin);
    const dv = { pages: () => ({ array: () => [...pages.values()] }) };
    const adapter = new LegacyTaskAdapter({ plugin, dataview: dv, onSubscriberError: error => errors.push(error) });
    const service = new TaskService(adapter);
    const handle = id => {
        const task = plugin.taskData.readPages(dv).flatMap(page => page.file.tasks).find(task => task.hubTaskId === id);
        if (!task) throw Error("Synthetic task not found: " + id); return legacyTaskHandle(task);
    };
    return { plugin, wizard, service, adapter, vault, metadataCache, files, contents, pages, frames, errors, state, owners, add, index, handle,
        flush() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
        move(file, destination) { const oldPath = file.path, text = contents.get(oldPath);
            files.delete(oldPath); contents.delete(oldPath); pages.delete(oldPath);
            file.path = destination; files.set(destination, file); contents.set(destination, text); index(file);
            vault.emit("rename", file, oldPath); metadataCache.emit("dataview:metadata-change", "rename", file, oldPath); },
        remove(file) { files.delete(file.path); contents.delete(file.path); vault.emit("delete", file); },
        snapshot() { return { contents: Object.fromEntries(contents), metadata: clone(wizard.data.taskMetadata),
            checks: clone(wizard.completedTaskChecks), history: clone(wizard.completedTaskHistory) }; },
        async close() { await service.close(); plugin.taskData.destroy(); }
    };
}

module.exports = { fixture, contexts, workspaceRef, clone, notices, restoreObsidianStub };
