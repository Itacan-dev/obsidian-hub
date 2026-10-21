"use strict";
const { HubTaskDataService } = require("../services/task-data");
const { HubTaskEditor } = require("../services/task-editor");
const { LegacyTaskAdapter } = require("../services/task-service-legacy");
const { TaskService } = require("../services/task-service");
const clone = value => JSON.parse(JSON.stringify(value));
class Emitter {
    constructor() { this.refs = new Set(); }
    on(name, fn) { const ref = { emitter: this, name, fn }; this.refs.add(ref); return ref; }
    offref(ref) { this.refs.delete(ref); }
    emit(name, ...args) { for (const ref of [...this.refs]) if (ref.name === name) ref.fn(...args); }
}
function createSearchFixture() {
    const projects = [
        ["app", "App", "active"], ["other", "Other", "shelved"], ["itacan", "Itacan", "active"], ["hub", "Obsidian Hub", "active"]
    ].map(([projectId, name, status]) => ({ projectId, name, status, contextKind: "project", root: `Projects/${name}`, path: `Projects/${name}/${name}.md`, resourceFolderIds: ["mounted"] }));
    const resources = [["study", "Knowledge"], ["literature", "Research"], ["references", "Explorations"], ["inspiration", "Inspiration"]]
        .map(([resourceType, name]) => ({ resourceType, projectId: `resource:${resourceType}`, name, contextKind: "resource", root: `Resources/${name}`, path: `Resources/${name}/${name}.md` }));
    const workspaces = [...projects, ...resources], files = new Map(), contents = new Map(), pages = new Map(), metadata = {};
    const cleanup = [], calls = [], diagnostics = [], frames = new Map(), vault = new Emitter(), metadataCache = new Emitter();
    const counts = { files: 0, notes: 0, sources: 0, indexes: 0, writes: 0 };
    const add = (path, content = "", aliases = []) => {
        const name = path.split("/").at(-1), extension = name.includes(".") ? name.split(".").at(-1).toLowerCase() : undefined;
        const file = { path, name, basename: name.replace(/\.[^.]+$/, ""), extension, stat: { mtime: 1 }, parent: { path: path.slice(0, path.lastIndexOf("/")) }, aliases };
        if (!extension) file.children = [];
        files.set(path, file); contents.set(path, content);
        if (extension === "md") pages.set(path, { file: { path, tasks: [], lists: [] } });
        return file;
    };
    function addTask(path, text, id = null, options = {}) {
        if (!files.has(path)) add(path, "# Synthetic\n");
        const before = contents.get(path), line = before.split("\n").length - 1;
        const parts = text.split("\n"), comment = id ? ` <!-- hub-task:${id} -->` : "";
        const task = { path, line, text: parts[0] + comment + (parts.length > 1 ? "\n" + parts.slice(1).join("\n") : ""),
            completed: !!options.completed, task: true, parent: null, children: [] };
        let block = `- [${task.completed ? "x" : " "}] ${parts[0]}${comment}\n` + parts.slice(1).map(value => `    ${value}\n`).join("");
        const descendants = [];
        for (const step of options.steps ?? []) {
            const child = { path, line: line + block.split("\n").length - 1, text: step.title + (step.id ? ` <!-- hub-task:${step.id} -->` : ""),
                completed: !!step.completed, task: true, parent: line, children: [] };
            task.children.push(child); descendants.push(child);
            block += `    - [${child.completed ? "x" : " "}] ${child.text}\n`;
        }
        contents.set(path, before + block);
        const page = pages.get(path); page.file.tasks.push(task, ...descendants); page.file.lists.push(task, ...descendants);
        if (id && options.metadata) metadata[id] = clone(options.metadata);
        return task;
    }
    Object.assign(vault, {
        getAllLoadedFiles: () => { counts.files++; return [...files.values()]; }, getMarkdownFiles: () => [...files.values()].filter(file => file.extension === "md"),
        getAbstractFileByPath: path => files.get(path),
        read: async file => { counts.sources++; if (!contents.has(file.path)) throw Error("Synthetic source unavailable"); return contents.get(file.path); },
        cachedRead: async file => { counts.notes++; return contents.get(file.path) ?? ""; },
        process: async () => { counts.writes++; throw Error("Search must not write"); }, create: async () => { counts.writes++; throw Error("Search must not create notes"); }
    });
    metadataCache.getFileCache = file => ({ frontmatter: { aliases: file.aliases } });
    const plugin = { app: { vault, metadataCache }, register: fn => cleanup.push(fn), registerEvent: ref => cleanup.push(() => ref.emitter.offref(ref)),
        projectWizard: { data: { taskMetadata: metadata }, getProjectRecords: () => projects, getResourceTypes: () => resources,
            getProjectById: id => projects.find(item => item.projectId === id), getResourceById: id => resources.find(item => item.resourceType === id),
            getContextForPath: path => workspaces.filter(item => path === item.root || path.startsWith(item.root + "/")).sort((a, b) => b.root.length - a.root.length)[0] ?? null },
        planning: { read: id => id === "app" ? { phases: [{ id: "phase", name: "Prototype", start: "2026-10-01", end: "2026-10-31" }], milestones: [{ id: "milestone", name: "Prototype demo", date: "2026-10-20" }] } : { phases: [], milestones: [] }, subscribe() {} },
        workspaceModes: { openProjectFull: async (...args) => { calls.push(["workspace", ...args]); return true; }, openProjectNote: async (...args) => { calls.push(["note", ...args]); return true; } },
        dataStore: { save: async () => { counts.writes++; throw Error("Search must not save metadata"); } }, enqueueTaskMutation: async () => { counts.writes++; throw Error("Search must not mutate tasks"); } };
    plugin.taskEditor = new HubTaskEditor(plugin);
    plugin.taskData = new HubTaskDataService(plugin.app, { metadata: id => plugin.taskEditor.metadata(id),
        request: callback => { const id = Symbol(); frames.set(id, callback); return id; }, cancel: id => frames.delete(id) });
    const dv = { index: { initialized: true }, pages: () => { counts.indexes++; return { array: () => [...pages.values()] }; } };
    plugin.taskService = new TaskService(new LegacyTaskAdapter({ plugin, dataview: dv }));
    for (const workspace of workspaces) {
        add(workspace.path); add(workspace.root + "/Meta"); add(workspace.root + "/Meta/ROADMAP.md", "Shared phrase in every workspace\n");
    }
    add("Projects/App/Meta/Plans.md", "A note about quantum field theory and roadmap details", ["Product direction"]);
    add("Projects/App/Meta/Paper.pdf"); add("Projects/App/System/Templates/secret.md", "Shared phrase");
    addTask("Projects/App/Meta/ROADMAP.md", "ROADMAP", "roadmap", { completed: true, metadata: { dueDate: "2026-10-18", dueTime: "00:00" } });
    addTask("Projects/App/Meta/Tasks.md", "Read experiment\ncontinuation zephyr evidence", "experiment", { metadata: { description: "description-only cobalt" }, steps: [{ title: "step-exclusive tungsten", id: "step" }] });
    contents.set("Projects/App/Meta/Tasks.md", contents.get("Projects/App/Meta/Tasks.md") + "\nSurrounding-only mercury\n");
    addTask("Projects/App/Meta/Tasks.md", "No identity plan");
    addTask("Projects/Other/Meta/ROADMAP.md", "Shelved project plan", "inactive");
    for (const resource of resources) addTask(resource.root + "/Meta/ROADMAP.md", resource.name + " plan", resource.resourceType + "-task");
    addTask("Resources/Knowledge/Mounted/Notes.md", "Mounted resource plan", "mounted-task");
    addTask("Projects/Itacan/Meta/ROADMAP.md", "Shared task plan", "itacan-task");
    addTask("Projects/Obsidian Hub/Meta/ROADMAP.md", "Shared task plan", "hub-task");
    return { plugin, dv, projects, resources, workspaces, files, contents, pages, counts, calls, diagnostics, vault, metadataCache, add, addTask,
        flush() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } },
        async close() { cleanup.reverse().forEach(fn => fn()); await plugin.taskService.close(); plugin.taskData.destroy(); },
        state() { return JSON.stringify({ contents: [...contents], metadata }); }
    };
}
function summarize(groups) {
    return groups.map(group => ({ kind: group.kind, items: group.items.map(result => ({
        title: result.title, path: result.path, context: result.context, score: result.score,
        owner: result.owner?.projectId, id: result.id ?? null, snippet: result.snippet ?? null,
        completed: result.kind === "tasks" ? !!result.task.completed : null,
        due: result.kind === "tasks" ? result.task.due?.date ?? result.task.dueDate ?? null : null,
        dueTime: result.kind === "tasks" ? result.task.due?.time ?? result.task.dueTime ?? null : null
    })) }));
}
const parityCases = [["roadmap", null], ["zephyr", "app"], ["plan", "app"], ["plan", "resource:study"],
    ["plan", "resource:literature"], ["plan", "resource:references"], ["plan", "resource:inspiration"],
    ["shelved", null], ["shared task", null], ["description-only", null], ["step-exclusive", "app"], ["surrounding-only", "app"],
    ["product direction", "app"], ["Prototype", "app"], ["Prototype", "resource:study"], ["App", null], ["Knowledge", null], ["App Meta roadmap", null]];
function enrichSearchFixture(f) {
    Object.assign(f.plugin.projectWizard.data.taskMetadata.experiment, { necessity: "must", phaseId: "phase" });
    f.add("Projects/App/Prototype");
    f.addTask("Projects/App/Prototype/Prototype.md", "Prototype", "phase-task", { metadata: { necessity: "should", phaseId: "phase", dueDate: "2026-10-31" } });
    f.addTask("Projects/App/Meta/Copy.md", "Copied plan", "copied");
    f.addTask("Projects/Itacan/Meta/Copy.md", "Copied plan", "copied");
    f.addTask("Projects/App/Meta/Ambiguous.md", "Same locator"); f.addTask("Projects/App/Meta/Ambiguous.md", "Same locator");
    f.addTask("Projects/App/Meta/Deleted.md", "Deleted task", "deleted"); f.files.delete("Projects/App/Meta/Deleted.md");
    const old = "Projects/App/Meta/Tasks.md", next = "Projects/App/Meta/Moved Tasks.md", file = f.files.get(old), page = f.pages.get(old), text = f.contents.get(old);
    f.files.delete(old); f.pages.delete(old); f.contents.delete(old); file.path = next; file.name = "Moved Tasks.md"; file.basename = "Moved Tasks"; page.file.path = next;
    f.files.set(next, file); f.pages.set(next, page); f.contents.set(next, text);
    return f;
}
const extraParityCases = [["Prototype", "app"], ["Prototype", null], ["Copied plan", null], ["Same locator", "app"], ["Deleted task", null], ["zephyr", "app"], ["plan", "app"]];
module.exports = { createSearchFixture, summarize, parityCases, extraParityCases, enrichSearchFixture, clone };
