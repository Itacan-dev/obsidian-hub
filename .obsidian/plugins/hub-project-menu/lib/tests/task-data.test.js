"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { HubTaskDataService } = require("../services/task-data");

class Events {
    constructor() { this.listeners = new Set(); }
    on(name, callback) { const ref = { name, callback }; this.listeners.add(ref); return ref; }
    offref(ref) { this.listeners.delete(ref); }
    emit(name, ...args) { for (const ref of [...this.listeners]) if (ref.name === name) ref.callback(...args); }
}
class Component {
    constructor() { this.cleanups = []; }
    register(fn) { this.cleanups.push(fn); }
    unload() { this.cleanups.splice(0).forEach(fn => fn()); }
}
class Link {
    constructor(path) { this.path = path; }
    withPath(path) { return new Link(path); }
}
const vault = new Events(), metadataCache = new Events();
const files = new Map(), pages = new Map(), frames = new Map();
let sequence = 0;
vault.getAbstractFileByPath = path => files.get(path);
const service = new HubTaskDataService({ vault, metadataCache }, {
    request: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancel: id => frames.delete(id)
});
const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
const folder = path => { const file = { path, children: [] }; files.set(path, file); return file; };
function create(path, texts = ["Top", "Middle", "Bottom"]) {
    const file = { path, extension: "md" }; files.set(path, file);
    const page = { file: { path, name: path.split("/").pop().slice(0, -3), tasks: texts.map((text, line) => ({
        path, text, line, completed: false, link: new Link(path), children: [], subtasks: []
    })) } };
    return { file, page };
}
function index(item) {
    pages.set(item.file.path, item.page);
    metadataCache.emit("dataview:metadata-change", "update", item.file);
}
function rename(file, newPath) {
    const oldPath = file.path;
    files.delete(oldPath); file.path = newPath; files.set(newPath, file);
    vault.emit("rename", file, oldPath);
    if (file.extension === "md") {
        const page = pages.get(oldPath);
        if (page) {
            pages.delete(oldPath); page.file.path = newPath; pages.set(newPath, page);
            // Installed Dataview changes the page path, not task/link paths.
            metadataCache.emit("dataview:metadata-change", "rename", file, oldPath);
        }
    }
}
function renameFolder(file, newPath) {
    const oldPath = file.path;
    const children = [...files.values()].filter(child => child.path.startsWith(oldPath + "/"));
    rename(file, newPath);
    children.forEach(child => rename(child, newPath + child.path.slice(oldPath.length)));
}
const dv = { pages(query) {
    const root = query ? JSON.parse(query) : "";
    return { array: () => [...pages.values()].filter(page => !root || page.file.path.startsWith(root + "/")) };
} };

const aRoot = folder("Projects/A"), bRoot = folder("Projects/B");
const rRoot = folder("Resources/Knowledge"), taskFolder = folder("Projects/A/Tasks");
const note = create("Projects/A/Tasks/Notes.md"); index(note);
const projectB = create("Projects/B/Notes.md"); index(projectB);
const resource = create("Resources/Knowledge/Notes.md"); index(resource);
const components = Array.from({ length: 6 }, () => new Component());
const refreshes = [0, 0, 0, 0, 0, 0];
const roots = [null, "Projects/A", "Projects/A", "Resources/Knowledge", "Resources/Knowledge", "Projects/B"];
components.forEach((component, i) => service.subscribe(component, () => refreshes[i]++, () => roots[i] && [roots[i]]));
assert.equal(vault.listeners.size, 3, "One vault subscription set across all views");
assert.equal(metadataCache.listeners.size, 2, "One Dataview subscription set across all views");

renameFolder(taskFolder, "Projects/A/Renamed");
assert.equal(frames.size, 1, "Folder/descendant/index rename events coalesce into one frame");
flush();
assert.deepEqual(refreshes, [1, 1, 1, 0, 0, 0], "Only Home and owning Project views invalidated");
let tasks = service.readPages(dv, "Projects/A")[0].file.tasks;
assert.equal(tasks.length, 3);
for (const task of tasks) {
    assert.equal(task.path, "Projects/A/Renamed/Notes.md");
    assert.equal(task.link.path, task.path);
}
assert.equal(note.page.file.tasks[0].path, "Projects/A/Tasks/Notes.md", "Do not mutate Dataview");

// Exercise the actual Home ownership loader and shared Project/Resource loader.
const dashboardRoot = path.resolve(__dirname, "../../../../../System/Dashboards");
const home = fs.readFileSync(path.join(dashboardRoot, "Home/view.js"), "utf8");
const project = fs.readFileSync(path.join(dashboardRoot, "Project/view.js"), "utf8");
const homeOwners = home.slice(home.indexOf("function projectFromReference("), home.indexOf("function isActiveProject("));
const homeLoader = home.slice(home.indexOf("function loadTaskData()"), home.indexOf("function loadSecondaryData()"));
const projects = [aRoot, bRoot].map((file, i) => ({
    path: file.path + "/Hub.md", sourcePath: file.path + "/Hub.md", root: file.path,
    sourceRoot: file.path, name: i ? "B" : "A", status: "active", projectId: String(i)
}));
const resourceTypes = [{ path: rRoot.path + "/Hub.md", root: rRoot.path, id: "study", label: "Knowledge" }];
const window = { hubTaskData: service };
const homeTasks = new Function("window", "dv", "projects", "resourceTypes", `
    let projectTasks, resourceTasks;
    ${homeOwners}\n${homeLoader}
    return () => { loadTaskData(); return { projectTasks, resourceTasks }; };
`)(window, dv, projects, resourceTypes);
const projectLoader = project.slice(project.indexOf("function readProjectTasks()"), project.indexOf("function renderTaskRows()"));
const contextTasks = root => new Function("window", "dv", "projectRoot", `${projectLoader}; return readProjectTasks();`)(window, dv, root);

renameFolder(taskFolder, "Resources/Knowledge/Moved"); flush();
assert.deepEqual(refreshes, [2, 2, 2, 1, 1, 0], "Both previous and new contexts invalidated for a move");
let loaded = homeTasks();
assert.equal(loaded.projectTasks.length, 3, "Moved tasks removed from previous project on Home");
assert.equal(loaded.resourceTasks.length, 6, "Moved tasks belong to Resource on Home");
assert.equal(contextTasks("Projects/A").length, 0);
assert.equal(contextTasks("Resources/Knowledge").length, 6);
assert.ok(loaded.resourceTasks.every(item => item.task.path.startsWith(item.owner.root + "/")));

// Created/edited content becomes authoritative only when the index is ready.
const added = create("Projects/A/New.md", ["Added"]);
vault.emit("create", added.file); flush();
assert.equal(contextTasks("Projects/A").length, 0);
index(added); flush();
assert.equal(contextTasks("Projects/A").length, 1);
const beforeModify = [...refreshes];
vault.emit("modify", added.file); metadataCache.emit("changed", added.file); flush();
assert.deepEqual(refreshes, beforeModify, "Do not refresh against the old index after a raw modify");
added.page.file.tasks[0].completed = true;
added.page.file.tasks[0].text = "Edited";
index(added); flush();
assert.equal(contextTasks("Projects/A")[0].completed, true);
assert.equal(homeTasks().projectTasks.find(item => item.task.path === added.file.path).task.text, "Edited");

rename(added.file, "Projects/A/Renamed.md"); flush();
assert.equal(contextTasks("Projects/A")[0].path, "Projects/A/Renamed.md");
renameFolder(aRoot, "Projects/Renamed A"); flush();
assert.equal(service.currentPath("Projects/A"), "Projects/Renamed A");
assert.equal(contextTasks("Projects/A")[0].path, "Projects/Renamed A/Renamed.md", "Existing context follows its root rename");
assert.equal(homeTasks().projectTasks.find(item => item.owner.projectId === "0").owner.root, aRoot.path);
renameFolder(aRoot, "Projects/Renamed Again"); flush();
assert.equal(contextTasks("Projects/A")[0].path, "Projects/Renamed Again/Renamed.md", "Chained renames");

// Delete filters stale indexed records immediately; later index events are safe.
files.delete(added.file.path); vault.emit("delete", added.file); flush();
assert.equal(contextTasks("Projects/A").length, 0);
assert.equal(homeTasks().projectTasks.length, 3);
pages.delete(added.file.path); metadataCache.emit("dataview:metadata-change", "delete", added.file); flush();
renameFolder(rRoot, "Resources/Renamed Knowledge"); flush();
assert.equal(contextTasks("Resources/Knowledge").length, 6);
const beforeRootDelete = [...refreshes];
for (const file of [...files.values()].filter(file => file.path.startsWith(rRoot.path + "/"))) {
    files.delete(file.path); vault.emit("delete", file);
}
files.delete(rRoot.path); vault.emit("delete", rRoot); flush();
assert.equal(refreshes[3], beforeRootDelete[3] + 1, "Renamed context still receives its root deletion");
assert.equal(homeTasks().resourceTasks.length, 0, "Folder deletion removes all contained tasks");
assert.equal(contextTasks("Resources/Knowledge").length, 0);

const beforeReady = [...refreshes]; metadataCache.emit("dataview:index-ready"); flush();
assert.deepEqual(refreshes, beforeReady.map(n => n + 1), "Late initial index refreshes all mounted task views");
const beforeUnrelated = [...refreshes]; vault.emit("modify", { path: "Images/Test.png", extension: "png" }); flush();
assert.deepEqual(refreshes, beforeUnrelated);

components[1].unload();
const count = refreshes[1]; metadataCache.emit("dataview:index-ready"); flush();
assert.equal(refreshes[1], count, "Destroyed view never refreshes");
metadataCache.emit("dataview:index-ready");
components.forEach(component => component.unload());
assert.equal(frames.size, 0, "Last subscriber cancels queued work");
assert.equal(vault.listeners.size + metadataCache.listeners.size, 0, "Last subscriber unregisters every listener");
service.subscribe(new Component(), () => {}, () => null);
metadataCache.emit("dataview:index-ready"); service.destroy();
assert.equal(frames.size + vault.listeners.size + metadataCache.listeners.size, 0, "Plugin unload also cleans everything");

const notification = home.slice(home.indexOf("window.hubTaskData?.subscribe"), home.indexOf("setTimeout(", home.indexOf("window.hubTaskData?.subscribe")));
assert.ok(notification.includes("renderTaskContext()") && !notification.includes("renderActiveContext()"), "Home events update only tasks/summary, not progress or cards");
assert.ok(!project.slice(project.indexOf('"hub-project-files-changed"'), project.indexOf("// ---------- CURRENT TASKS")).includes("renderCurrentTasks()"), "No competing raw-event task refresh");
console.log("Task-data tests passed: Home/Project/Resource loaders, note/full subscriptions, folder and file moves/renames, ownership, stale task links, indexed create/modify, deletion, coalescing and disposal.");
