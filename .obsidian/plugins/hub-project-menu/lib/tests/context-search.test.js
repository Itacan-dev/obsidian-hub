"use strict";
const assert = require("assert");
const { ContextSearchService } = require("../services/context-search");
const { nameScore } = require("../domain/context-search");
class Emitter {
    constructor() { this.listeners = new Map(); }
    on(name, fn) { const ref = { emitter: this, name, fn }; if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(ref); return ref; }
    offref(ref) { this.listeners.get(ref.name)?.delete(ref); }
    emit(name, ...args) { for (const { fn } of this.listeners.get(name) ?? []) fn(...args); }
}
(async () => {
    const project = { root: "Projects/App", path: "Projects/App/App.md", projectId: "app", name: "App", contextKind: "project" };
    const other = { ...project, root: "Projects/Other", path: "Projects/Other/Other.md", projectId: "other", name: "Other" };
    const resources = ["Knowledge", "Research", "Explorations", "Inspiration"].map(name => ({ name, contextKind: "resource", root: `Resources/${name}`, path: `Resources/${name}/${name}.md`, projectId: `resource:${name}` }));
    const workspaces = [project, other, ...resources], files = new Map(), texts = new Map();
    function add(path, content, aliases) {
        const name = path.split("/").at(-1), extension = name.includes(".") ? name.split(".").at(-1) : undefined;
        const file = { path, name, basename: name.replace(/\.[^.]+$/, ""), extension, stat: { mtime: 1 }, parent: { path: path.slice(0, path.lastIndexOf("/")) }, aliases };
        if (!extension) file.children = [];
        files.set(path, file); if (content != null) texts.set(path, content); return file;
    }
    workspaces.forEach(w => { add(w.path, ""); add(w.root + "/Meta"); add(w.root + "/Meta/ROADMAP.md", "Shared phrase in every workspace"); });
    add(project.root + "/Meta/Plans.md", "A note about quantum field theory and roadmap details", ["Product direction"]);
    add(project.root + "/Meta/Paper.pdf", "");
    add(project.root + "/System/Templates/secret.md", "Shared phrase");
    const tasks = [{ text: "ROADMAP", path: project.root + "/Meta/ROADMAP.md", line: 4, hubTaskId: "t1", dueDate: "2026-10-01" },
        { text: "Linked plan", path: resources[0].root + "/Meta/ROADMAP.md", line: 5, hubTaskId: "t2", linkedProjectId: "app" },
        { text: "Unrelated plan", path: resources[1].root + "/Meta/ROADMAP.md", line: 6, hubTaskId: "t3" }];
    let scans = 0, reads = 0, taskReads = 0, invalidateTasks;
    const cleanup = [], calls = [], vault = new Emitter(), metadataCache = new Emitter();
    Object.assign(vault, { getAllLoadedFiles: () => { scans++; return [...files.values()]; }, getAbstractFileByPath: path => files.get(path),
        cachedRead: async file => { reads++; return texts.get(file.path) ?? ""; } });
    metadataCache.getFileCache = file => ({ frontmatter: { aliases: file.aliases } });
    const plugin = { app: { vault, metadataCache }, register: fn => cleanup.push(fn), registerEvent: ref => cleanup.push(() => ref.emitter.offref(ref)),
        projectWizard: { getProjectRecords: () => [project, other], getResourceTypes: () => resources },
        taskData: { readPages: () => { taskReads++; return [{ file: { tasks } }]; }, currentPath: path => path, subscribe: (_, fn) => { invalidateTasks = fn; } },
        workspaceModes: { openProjectFull: async (owner, source) => { calls.push(["workspace", owner, source]); return true; }, openProjectNote: async (...args) => { calls.push(["note", ...args]); return true; } } };
    const roadmap = { phases: [{id:"phase1",name:"Prototype",start:"2026-09-01",end:"2026-12-01"},{id:"phase2",name:"Prototype beta",start:"2026-11-01",end:"2027-01-01"}], milestones: [{id:"milestone1",name:"Prototype demo",date:"2026-10-02",achieved:false}] };
    plugin.planning = { read: id => id === "app" ? roadmap : {phases:[],milestones:[]}, subscribe() {} };
    const search = new ContextSearchService(plugin), flat = groups => groups.flatMap(group => group.items);
    const global = await search.search("roadmap", null, {});
    assert.deepEqual(global.map(g => g.kind), ["files", "tasks", "notes"]);
    assert.equal(global[0].items.length, 6); assert.equal(global[1].items[0].task, tasks[0], "Canonical task object retained");
    assert.equal(flat(await search.search("App", null, {})).find(r => r.kind === "projects").owner, project);
    assert.equal(flat(await search.search("Knowledge", null, {})).find(r => r.kind === "resources").owner, resources[0]);
    const planningResults = flat(await search.search("Prototype",project,{}));
    assert.equal(planningResults.filter(r=>r.kind==="phases").length,2);
    assert.equal(planningResults.filter(r=>r.kind==="milestones").length,1);
    assert.equal(flat(await search.search("Prototype",resources[0],{})).length,0,"Resources do not expose Project planning");
    assert.equal(flat(await search.search("Prototype",other,{})).length,0,"Planning search stays Project-scoped");
    const before = { scans, reads, taskReads };
    await search.search("shared phrase", null, {}); const cachedReads = reads;
    await search.search("field", project, {});
    assert.equal(scans, before.scans); assert.equal(taskReads, before.taskReads); assert.equal(reads, cachedReads, "Queries reuse note reads");
    assert.equal(flat(await search.search("product direction", project, {}))[0].title, "Plans", "Metadata aliases searchable");
    assert(nameScore("ROADMAP", "rdmp") != null); assert.equal(nameScore("anything", "zz"), null);
    for (const resource of resources) {
        const scoped = flat(await search.search("roadmap", resource, {}));
        assert(scoped.length); assert(scoped.every(r => r.path.startsWith(resource.root + "/")), "Resource scope is structural");
    }
    const scoped = flat(await search.search("plan", project, {}));
    assert(scoped.some(r => r.task === tasks[1]), "Project includes linked Resource task");
    assert(!scoped.some(r => r.task === tasks[2]), "Project excludes unrelated task");
    assert(!flat(await search.search("shared phrase", project, {})).some(r => !r.path.startsWith(project.root + "/") || r.path.includes("/System/")));
    const note = files.get(project.root + "/Meta/Plans.md"); texts.set(note.path, "brand new phrase"); note.stat.mtime++;
    vault.emit("modify", note); assert(flat(await search.search("brand new", project, {})).some(r => r.path === note.path), "Edited content indexed");
    tasks[0].text = "Changed task"; invalidateTasks(); assert(flat(await search.search("changed task", project, {})).some(r => r.task === tasks[0]));
    const old = note.path; files.delete(old); note.path = project.root + "/Meta/Renamed.md"; note.name = "Renamed.md"; note.basename = "Renamed"; files.set(note.path, note); texts.set(note.path, "renamed body");
    vault.emit("rename", note, old); assert(!flat(await search.search("Plans", project, {})).some(r => r.path === old));
    const source = { ownerDocument: {} };
    await search.open({ kind: "files", path: note.path, owner: project }, source);
    assert.deepEqual(calls.at(-1), ["note", note.path, "replace", source]);
    await search.open({ kind: "tasks", path: tasks[0].path, task: tasks[0], owner: project }, source);
    assert.equal(calls.at(-1)[1], tasks[0].path, "Task opens canonical source");
    let selected, selectedPlanning;
    const root = { isConnected: true, closest: () => null, ownerDocument: source.ownerDocument };
    search.registerWorkspace(plugin, root, project, path => { selected = path; }, (kind,id) => { selectedPlanning = [kind,id]; });
    await search.open(planningResults.find(r=>r.id==="phase2"),source);
    assert.deepEqual(selectedPlanning,["phases","phase2"],"Planning uses stable-object focus");
    await search.open(planningResults.find(r=>r.id==="milestone1"),source);
    assert.deepEqual(selectedPlanning,["milestones","milestone1"]);
    roadmap.milestones=[];
    await assert.rejects(search.open(planningResults.find(r=>r.id==="milestone1"),source),/no longer exists/);
    await search.open({ kind: "folders", path: project.root + "/Meta", owner: project }, source);
    assert.equal(selected, project.root + "/Meta");
    // A cold destination can register/commit after navigation completes.
    root.isConnected = false; selected = null;
    await search.open({ kind: "folders", path: project.root + "/Meta", owner: project }, source);
    assert.equal(selected, null);
    const coldRoot = { ...root, isConnected: true };
    search.registerWorkspace(plugin, coldRoot, project, path => { selected = path; });
    search.applyFolder(coldRoot);
    assert.equal(selected, project.root + "/Meta", "Cold frame commit consumes pending folder focus");
    plugin.workspaceModes.openProjectFull = async () => false; selected = null;
    assert.equal(await search.open({ kind: "folders", path: project.root + "/Meta", owner: project }, source), false);
    assert.equal(selected, null, "Denied navigation does not select a folder");
    files.delete(note.path); vault.emit("delete", note); assert(!flat(await search.search("Renamed", project, {})).some(r => r.path === note.path));
    cleanup.reverse().forEach(fn => fn());
    console.log("PASS: context search ranking, aliases, global/four Resource/Project scopes, linked canonical tasks, content caching/invalidation, rename/delete and navigation guards.");
})().catch(error => { console.error(error); process.exitCode = 1; });
