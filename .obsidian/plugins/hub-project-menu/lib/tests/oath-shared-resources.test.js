"use strict";
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), Module = require("module");
const { fixture } = require("./oath.test");
const { OathNavigationGuard } = require("../services/oath-navigation");
const { HubPresets } = require("../services/presets");
const { HubTaskEditor } = require("../services/task-editor");

class Element {
    constructor(tag = "div", options = {}) { this.tag = tag; this.text = options.text ?? ""; this.children = []; this.events = {}; }
    createEl(tag, options) { const child = new Element(tag, options); this.children.push(child); return child; }
    createDiv(options) { return this.createEl("div", options); }
    createSpan(options) { return this.createEl("span", options); }
    addClass() {}
    empty() { this.children = []; }
    addEventListener(event, action) { this.events[event] = action; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(""); }
    all(tag) { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.all(tag)]); }
}
let currentModal, currentMenu;
class Modal {
    constructor(app) { this.app = app; this.contentEl = new Element(); }
    open() { currentModal = this; this.onOpen(); }
    close() { this.onClose(); currentModal = null; }
}
class Menu {
    constructor() { this.items = []; }
    addItem(build) {
        const item = { setTitle(value) { this.title = value; return this; }, setIcon() { return this; },
            setWarning() { return this; }, onClick(action) { this.action = action; return this; } };
        build(item); this.items.push(item);
    }
    addSeparator() {}
    showAtMouseEvent() { currentMenu = this; }
}
class TFile {
    constructor(filePath) { this.path = filePath; this.extension = "md"; this.basename = path.posix.basename(filePath, ".md"); this.parent = { path: path.posix.dirname(filePath) }; }
}
class TFolder { constructor(folderPath) { this.path = folderPath; this.name = path.posix.basename(folderPath); } }
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const originalLoad = Module._load;
Module._load = function(name) {
    // This fixture tests navigation and canonical resource writes, not title DOM.
    // Real title rendering is covered by the browser fixtures.
    if (name.endsWith("/ui/window-title")) return {
        createWindowTitle: (parent, text) => parent.createEl("h2", { text }), setWindowUndertext() {}, layoutModal() {}
    };
    return name === "obsidian" ? { Plugin: class {}, Modal, Menu, FuzzySuggestModal: class {}, TFile, TFolder, Notice: class {} } : originalLoad.apply(this, arguments);
};
compiled._compile(fs.readFileSync(filename, "utf8") +
    "\nmodule.exports.Modes = HubWorkspaceModeService; module.exports.Wizard = ProjectWizardService;", filename);

async function run() {
    const f = fixture(), { app } = f.plugin, plugin = f.plugin;
    const frontmatter = new Map(f.contexts.map(context => [context.path, {
        type: "project", projectId: context.projectId, status: "active", resource_folders: context.projectId === "a" ? ["r1"] : ["r3"]
    }]));
    const records = {
        r1: { id: "r1", resourceType: "literature", name: "R1", path: "Resources/Research/Mathematics/R1" },
        r2: { id: "r2", resourceType: "study", name: "R2", path: "Resources/Knowledge/R2" },
        r3: { id: "r3", resourceType: "literature", name: "R3", path: "Resources/Research/R3" }
    };
    const folders = new Map(Object.values(records).map(folder => [folder.path, new TFolder(folder.path)]));
    const r1 = records.r1.path, r2 = records.r2.path, r3 = records.r3.path;
    const own = "Projects/A/Tasks.md", shared = r1 + "/Assignments/Notes.md", unshared = r2 + "/Nested/Notes.md";
    for (const p of [shared, unshared, r3 + "/Notes.md", r1 + "-unshared/Notes.md", "Projects/B/Tasks.md"]) f.files.set(p, "# Canonical note\n");
    app.vault.getAbstractFileByPath = p => folders.get(p) ?? (f.files.has(p) ? new TFile(p) : null);
    app.vault.getMarkdownFiles = () => [...f.files.keys()].map(p => new TFile(p));
    app.metadataCache = { getFileCache: file => ({ frontmatter: frontmatter.get(file.path) ?? {} }), getFirstLinkpathDest: p => app.vault.getAbstractFileByPath(p) };
    app.fileManager = { processFrontMatter: async (file, update) => update(frontmatter.get(file.path)) };
    const wizard = Object.create(compiled.exports.Wizard.prototype);
    Object.assign(wizard, { app, data: plugin.projectWizard.data, resourceFolders: records, store: plugin.dataStore });
    wizard.syncResourceFolders = async () => wizard.getResourceFolders();
    plugin.projectWizard = wizard; plugin.oath = f.service;
    plugin.taskData.currentPath = path => path;
    plugin.markProjectChangedByPath = () => {};
    plugin.notifyProjectFilesChanged = () => {};
    plugin.ensureContextOpen = compiled.exports.prototype.ensureContextOpen.bind(plugin);
    const native = [];
    class Leaf {
        getViewState() { return { type: "markdown", state: { file: this.path } }; }
        async openFile(file) { this.path = file.path; native.push(["file", file.path]); }
        async setViewState(view) { this.path = view.state.file; native.push(["view", this.path]); }
    }
    app.workspace = {
        async openLinkText(p) { native.push(["link", p]); },
        setActiveLeaf(leaf) { native.push(["active", leaf.path]); },
        async changeLayout(layout) { native.push(["layout", layout]); }
    };
    const guard = plugin.oathNavigation = new OathNavigationGuard(plugin, Leaf);
    const layout = paths => ({ main: { type: "split", children: paths.map((file, i) => ({
        type: "leaf", id: String(i), state: { type: "markdown", state: { file } }
    })) } });
    const routes = async (p, allowed) => {
        const count = native.length, leaf = new Leaf(); leaf.path = p;
        await leaf.openFile(new TFile(p));
        await leaf.setViewState({ type: "markdown", state: { file: p } });
        await app.workspace.openLinkText(p, own);
        app.workspace.setActiveLeaf(leaf);
        await app.workspace.changeLayout(layout([f.contexts[0].path, p]));
        assert.equal(native.length - count, allowed ? 5 : 0, "All native routes for " + p);
    };
    try {
        await f.service.take(f.draft());
        const oathId = f.service.current.id;
        for (const p of [own, r1, shared]) assert(f.service.canOpen(p, false), p);
        assert(f.service.canOpen(new TFile(shared), false), "Canonical file objects use the same policy");
        for (const p of [f.contexts[1].path, f.resources[1].path, f.resources[1].root,
            r2, unshared, r3 + "/Notes.md", r1 + "-unshared/Notes.md", "Resources/Research/Mathematics"]) {
            assert.equal(f.service.canOpen(p, false), false, "Unshared workspace, ancestor or sibling: " + p);
        }
        for (const p of [own, shared]) await routes(p, true);
        for (const p of [unshared, r3 + "/Notes.md", "Projects/B/Tasks.md", f.resources[1].path]) await routes(p, false);

        // Edit and create in the canonical Resource note; no copy or readonly layer is involved.
        await app.vault.process(new TFile(shared), text => text + "Edited through Project A\n");
        await new HubTaskEditor(plugin).create(shared, "New shared task");
        assert(f.files.get(shared).includes("Edited through Project A\n"));
        assert(f.files.get(shared).includes("- [ ] New shared task"));
        assert(![...f.files].some(([p, text]) => p.startsWith("Projects/A/") && text.includes("New shared task")));
        assert(f.service.workspaceTasks(f.service.current.workspace).every(task => task.path.startsWith("Projects/A/")), "Oath task selection unchanged");

        // Exercise real workspace routing, including native/Last File paths with Resource ownership.
        const modes = Object.create(compiled.exports.Modes.prototype), opened = [];
        Object.assign(modes, { plugin, app, state: { projects: {}, presets: [] }, mode: null,
            enqueue: action => action(), navigateFrom: (source, action) => action(), leafForSource: () => null,
            dashboardRoot: () => null, leafDocument: () => null, contextFromSource: () => null,
            isProjectNoteMode: () => true, restoreNoteLayout: async () => false, restorableNoteLayout: () => null,
            applyProjectNoteMode: async (context, file) => { opened.push([context.projectId, file.path]); return true; },
            canRestoreLayoutView: () => true, leafElement: () => null });
        const selected = wizard.getProjectById("a"), resource = wizard.getResourceForPath(shared);
        assert.equal(modes.contextForFile(shared).projectId, "a");
        app.workspace.activeLeaf = { path: shared };
        modes.isMainLeaf = leaf => !!leaf;
        modes.leafPath = leaf => leaf?.path;
        assert.equal(modes.currentContext().projectId, "a", "Shared note belongs to bound Project context");

        for (const action of [() => modes.openFile(shared), () => modes.openProjectNote(shared),
            () => modes.enterProjectNoteMode(resource, new TFile(shared))]) {
            assert.equal(await action(), true);
            assert.deepEqual(opened.at(-1), ["a", shared], "Shared note retains bound Project context");
        }
        plugin.workspaceState = { save: async () => {} };
        modes.rememberNote(selected, new TFile(shared));
        assert.equal(await modes.openLastFile(), true);
        assert.deepEqual(opened.at(-1), ["a", shared], "Last File uses Project environment despite physical Resource owner");
        modes.state.fileHistory = [{ contextId: "a", path: unshared }];
        assert.equal(await modes.openLastFile(), false);
        assert.equal(await modes.openFile(unshared), false);
        assert.equal(await modes.openProjectNote(unshared), false);

        // Presets cannot reintroduce a revoked or unshared note.
        plugin.workspaceState = { saveFolders: async () => {} };
        modes.applyNoteLayout = async (context, value) => { await app.workspace.changeLayout(value); return true; };
        modes.state.presets = [["shared", shared], ["unshared", unshared]].map(([id, p]) => ({
            id, name: id, contextId: "a", hubPath: selected.path, layout: layout([selected.path, p])
        }));
        const presets = new HubPresets(modes);
        assert.equal(await presets.open("shared"), true);
        assert.equal(await presets.open("unshared"), false);

        // Invoke the existing Project menu and actual sharing picker while locked.
        compiled.exports.prototype.showProjectMenu.call(plugin, {}, new TFile(selected.path), "active", null, null);
        const beforePicker = native.length;
        await currentMenu.items.find(item => item.title === "Resource folders").action();
        assert(currentModal && currentModal.folders.some(folder => folder.id === "r2"), "Unshared folders can be selected for sharing");
        assert.equal(native.length, beforePicker, "Sharing picker does not navigate Resource content");
        await routes(unshared, false);
        const r2Row = currentModal.contentEl.all("label").find(row => row.textContent.startsWith("R2"));
        const check = r2Row.all("input")[0]; check.checked = true; check.events.change();
        await currentModal.contentEl.all("button").find(button => button.textContent === "Save changes").events.click();
        assert.equal(currentModal, null);
        assert.deepEqual(wizard.getProjectById("a").resourceFolderIds, ["r1", "r2"]);
        assert.equal(f.service.current.id, oathId, "Sharing does not restart Oath");
        assert(f.service.canOpen(r2, false));
        await routes(unshared, true);
        assert.equal(await presets.open("unshared"), true, "Existing preset immediately reads the new relationship");
        assert.equal(await modes.openFile(unshared), true);
        assert.deepEqual(opened.at(-1), ["a", unshared]);
        await routes(r3 + "/Notes.md", false);
        await routes("Projects/B/Tasks.md", false);
        assert.equal(f.service.canOpen(resource, false), false, "Sharing does not unlock Resource workspace");

        // Existing detach semantics revoke future opens, even from saved layouts/history.
        await wizard.setProjectResourceFolders(new TFile(selected.path), ["r1"]);
        await routes(unshared, false);
        assert.equal(await presets.open("unshared"), false);
        // Renames use stable relationships and the canonical folder registry.
        const renamed = "Resources/Research/Mathematics/Renamed";
        folders.delete(r1); folders.set(renamed, new TFolder(renamed));
        f.files.set(renamed + "/Assignments/Notes.md", f.files.get(shared)); f.files.delete(shared);
        await wizard.handleResourceFolderRename(new TFolder(renamed), r1);
        assert.equal(wizard.getProjectById("a").resourceFolderIds[0], "r1");
        assert(f.service.canOpen(renamed + "/Assignments/Notes.md", false));
        assert.equal(f.service.canOpen(shared, false), false, "Old path is no longer shared");
        folders.delete(renamed);
        assert.equal(f.service.canOpen(renamed + "/Assignments/Notes.md", false), false, "Deleted shared folder grants no access");

        await f.service.end(oathId, "broken");
        await routes(unshared, true); await routes("Projects/B/Tasks.md", true);
        assert.equal(await modes.openFile(unshared), true);
        assert.deepEqual(opened.at(-1), ["resource:study", unshared], "Outside Oath, normal Resource routing remains unchanged");
        // A Resource Oath still allows only its Resource, regardless of Project shares.
        f.files.set("Resources/Research/Tasks.md", "- [ ] Resource work\n");
        const ref = { type: "resource", id: "literature" };
        await f.service.take(f.draft({ workspace: ref, tasks: f.service.workspaceTasks(ref) }));
        assert.equal(f.service.projectWorkspaceForPath(own), null);
        assert(f.service.canOpen(r3 + "/Notes.md", false));
        assert.equal(f.service.canOpen(unshared, false), false);
        assert.equal(f.service.canOpen(own, false), false);
        assert.equal(await modes.openFile(own), false);
        console.log("PASS: live shared folder IDs/subtrees, canonical edits/creation, real sharing picker, immediate attach/detach/rename, Project routing, native/history/Last File/preset enforcement, Resource Oaths and normal navigation.");
    } finally { guard.destroy(); f.destroy(); Module._load = originalLoad; }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
