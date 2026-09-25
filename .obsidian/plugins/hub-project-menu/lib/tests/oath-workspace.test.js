"use strict";
const assert = require("node:assert/strict");
const { fixture } = require("./oath.test");
const { workspaceRef } = require("../domain/oath-workspace");
const { OathNavigationGuard } = require("../services/oath-navigation");
const { taskGroups } = require("../domain/task-planning");

async function run() {
    const f = fixture(), service = f.service, a = f.contexts[0], b = f.contexts[1];
    f.files.set("Projects/B/Tasks.md", "- [ ] Other task\n");
    f.files.set("Resources/Research/Tasks.md", "- [ ] Resource task\n");
    f.files.set("Projects/A/Tasks.md", f.files.get("Projects/A/Tasks.md") + "- [x] Completed\n- [ ] Third\n- [ ] Fourth\n");
    assert.equal(service.workspaces("resource").length, 4);
    b.status = "future"; assert.deepEqual(service.workspaces("project").map(p => p.projectId), ["a"]);
    b.status = "shelved"; assert.deepEqual(service.workspaces("project").map(p => p.projectId), ["a"]); b.status = "active";
    const tasks = service.workspaceTasks(workspaceRef(a));
    const groups = taskGroups(f.readTasks().filter(task => task.path.startsWith(a.root + "/")), new Date(1_000_000));
    assert.deepEqual(tasks.map(t => t.text), [...groups.active, ...groups.future].map(t => t.text));
    assert.equal(tasks.length, 4);
    assert.equal(service.workspaceTasks({ type: "resource", id: "literature" }).length, 1);
    await assert.rejects(service.take(f.draft({ workspace: null })), /Select a Project or Resource/);
    await assert.rejects(service.take(f.draft({ tasks: [f.readTasks().find(t => t.text === "Other task")] })), /from this workspace/);
    const scheduledAt = 1_100_000;
    await service.take(f.draft({ start: "scheduled", scheduledAt }));
    assert.deepEqual(service.current.workspace, { type: "project", id: "a", name: "A" });
    assert(service.canOpen(b)); assert(!service.active);
    const saved = structuredClone(f.saved);
    f.destroy();
    const restored = fixture(saved);
    assert.deepEqual(restored.service.current.workspace, saved.oathsByDevice["this-device"].current.workspace);
    restored.contexts[0].name = "Renamed project";
    // Stable ID resolves a rename rather than matching the historical display name.
    assert.equal(restored.service.workspace.name, "Renamed project");
    restored.advance(100000); await restored.service.refresh();
    assert(restored.service.active); assert(!restored.service.canOpen(restored.contexts[1]));
    restored.advance(50 * 60000); await restored.service.refresh(false);
    assert(restored.service.fulfilled && restored.service.active);
    assert(!restored.service.canOpen(restored.resources[0]));
    await restored.service.end(restored.service.current.id);
    assert(restored.service.canOpen(restored.contexts[1]));
    assert.deepEqual(restored.service.bucket.history[0].workspace, service.current.workspace);
    restored.destroy();
    for (const invalid of ["deleted", "future", "shelved", "wrong-id"]) {
        const x = fixture();
        await x.service.take(x.draft({ start: "scheduled", scheduledAt }));
        if (invalid === "deleted") x.files.delete(x.contexts[0].path);
        else if (invalid === "wrong-id") x.contexts[0].projectId = "replacement";
        else x.contexts[0].status = invalid;
        x.advance(100000); await x.service.refresh();
        assert.equal(x.service.current.state, "invalid", invalid);
        assert(!x.service.committed && !x.full.full); assert.equal(x.full.entries, 0);
        assert(x.notices.some(text => text.includes("select an Active Project or Resource")));
        assert.equal(x.service.current.workspace.id, "a");
        x.destroy();
    }
    const legacy = fixture({ oathsByDevice: { "this-device": { current: { id: "old", state: "scheduled", scheduledAt: 0, tasks: [], durationMs: 60000 }, history: [] } } });
    await legacy.service.refresh(); assert.equal(legacy.service.current.state, "invalid"); legacy.destroy();

    // Exercise native boundaries as well as the centralized live policy.
    const n = fixture(), opened = [], nativeCalls = [];
    n.plugin.oath = n.service;
    class Leaf {
        constructor(path) { this.path = path; }
        getViewState() { return { type: "markdown", state: { file: this.path } }; }
        async openFile(file) { opened.push(file.path); this.path = file.path; }
        async setViewState(view) { opened.push(view.state.file); this.path = view.state.file; }
    }
    const layout = paths => ({ main: { type: "split", children: paths.map(file =>
        ({ type: "leaf", state: { type: "markdown", state: { file } } })) } });
    const app = n.plugin.app;
    app.metadataCache = { getFirstLinkpathDest: path => ({ path }) };
    app.workspace = {
        async changeLayout(value) { nativeCalls.push("layout"); },
        setActiveLeaf(leaf) { nativeCalls.push("active"); },
        async openLinkText(link) { nativeCalls.push(link); }
    };
    const Module = require("module"), fs = require("fs"), path = require("path");
    const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
    compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
    class TFile { constructor(path) { this.path = path; this.extension = "md"; } }
    const originalLoad = Module._load;
    Module._load = function(name) { return name === "obsidian" ? {
        Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile, TFolder: class {},
        Notice: class { constructor(text) { n.notices.push(text); } }
    } : originalLoad.apply(this, arguments); };
    compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Modes = HubWorkspaceModeService;", filename);
    // Resolve the current view through canonical helpers, with saved history deliberately set elsewhere.
    const { Modes: ContextModes } = compiled.exports, current = Object.create(ContextModes.prototype);
    const doc = {}, popup = {}, activeProject = n.contexts[0], currentResource = n.resources[1];
    Object.assign(current, { plugin: n.plugin, app, mode: null,
        state: { lastProjectId: "b", lastWorkspaceId: "b", lastFile: { path: n.contexts[1].path } },
        isMainLeaf: leaf => !!leaf?.main, leafPath: leaf => leaf?.path,
        leafDocument: leaf => leaf?.ownerDocument, leafForSource: leaf => leaf,
        dashboardRoot: leaf => leaf?.contextId ? { dataset: { hubContextId: leaf.contextId } } : null });
    n.plugin.projectWizard.getResourceFolders = () => [];
    const leafAt = (path, extra = {}) => ({ path, main: true, ownerDocument: doc, ...extra });
    for (const [path, expected] of [["Home.md", null], [activeProject.path, activeProject],
        [activeProject.root + "/Tasks.md", activeProject], [currentResource.path, currentResource],
        [currentResource.root + "/Tasks.md", currentResource], ["Unrelated.md", null]]) {
        app.workspace.activeLeaf = leafAt(path);
        assert.equal(current.currentContext(), expected, "Current context for " + path);
    }
    app.workspace.activeLeaf = leafAt(null, { contextId: activeProject.projectId });
    assert.equal(current.currentContext(), activeProject, "Dashboard stable ID");
    current.mode = { project: activeProject, projectLeaf: leafAt(activeProject.path), ownerDocument: doc };
    app.workspace.activeLeaf = leafAt(null);
    assert.equal(current.currentContext(), activeProject, "Browser within visible note-mode workspace");
    for (const leaf of [leafAt("Home.md"), leafAt("Unrelated.md"), leafAt(null, { ownerDocument: popup }),
        leafAt(activeProject.path, { main: false }), null]) {
        app.workspace.activeLeaf = leaf;
        assert.equal(current.currentContext(), null, "No fallback to stale mode or history");
    }
    current.mode.projectLeaf.main = false; app.workspace.activeLeaf = leafAt(null);
    assert.equal(current.currentContext(), null, "Detached workspace cannot supply context");
    current.mode = null; app.workspace.activeLeaf = null;
    const { Modes } = compiled.exports, m = Object.create(Modes.prototype);
    m.plugin = n.plugin; m.app = app; m.state = { version: 4, workspaceHistory: ["b", "a"], fileHistory: [],
        projects: {}, lastProjectId: "b", lastResourceId: "study", lastWorkspaceId: "b" };
    m.mode = null; m.enqueue = action => action(); m.navigateFrom = (source, open) => open();
    m.leafForSource = () => null; m.dashboardRoot = () => null; m.leafDocument = () => null;
    m.contextFromSource = () => null; m.leafPath = () => null;
    let stateSaves = 0;
    n.plugin.workspaceState = { save: () => stateSaves++ };
    n.plugin.ensureContextOpen = compiled.exports.prototype.ensureContextOpen.bind(n.plugin);
    const routed = [];
    m.applyProjectFull = async context => { routed.push(context.projectId); return true; };
    m.applyProjectNoteMode = async context => { routed.push(context.projectId); return true; };
    const originalFile = app.vault.getAbstractFileByPath;
    app.vault.getAbstractFileByPath = path => originalFile(path) ? new TFile(path) : null;
    const before = Leaf.prototype.openFile, guard = new OathNavigationGuard(n.plugin, Leaf);
    await n.service.take(n.draft());
    assert.equal(await m.openWorkspace(), true);
    assert.deepEqual(routed, ["a"], "Workspace skips a newer blocked entry using the existing Oath predicate");
    assert.equal(await m.openProjectFull(n.contexts[1]), false);
    assert.equal(await m.openProjectFull(n.resources[0]), false);
    assert.equal(await m.openProjectNote(n.contexts[1].path), false);
    assert.equal(await m.openFile(n.resources[0].path), false);
    assert.equal(await m.openLastProject(), false);
    assert.equal(await m.openLastResource(), false);
    assert.equal(await m.openLastFile(), false);
    m.rememberContext(n.contexts[1]); m.rememberBrowserLayout(n.resources[0]);
    m.rememberNote(n.contexts[1], new TFile(n.contexts[1].root + "/Note.md"));
    assert.equal(stateSaves, 0, "Blocked contexts do not alter saved navigation state");
    const { HubPresets } = require("../services/presets");
    m.canRestoreLayoutView = () => true;
    m.state.presets = [{ id: "other", name: "Other workspace", contextId: "b", hubPath: n.contexts[1].path,
        layout: layout([n.contexts[1].path]) }];
    const presets = new HubPresets(m);
    assert.equal(await presets.open("other"), false);
    assert.deepEqual(routed, ["a"], "All indirect routes are blocked before presentation");

    const own = n.contexts[0].path, other = n.contexts[1].path, resource = n.resources[0].path, leaf = new Leaf(own);
    for (const path of [other, resource, "Projects/B/Tasks.md"]) {
        const count = opened.length;
        await leaf.openFile({ path }); await leaf.setViewState({ type: "markdown", state: { file: path } });
        await app.workspace.openLinkText(path, own);
        app.workspace.setActiveLeaf(new Leaf(path));
        await app.workspace.changeLayout(layout([own, path]));
        assert.equal(opened.length, count); assert.equal(nativeCalls.length, 0);
    }
    await leaf.openFile({ path: own }); await leaf.openFile({ path: "Home.md" });
    assert.equal(opened.length, 2);
    assert.equal(n.notices.filter(text => text === "No recently opened files.").length, 1);
    assert(n.notices.every(text => ["Locked during this Oath", "No recently opened files."].includes(text)));
    n.advance(50 * 60000); await n.service.refresh(false);
    await leaf.openFile({ path: other }); assert.equal(opened.length, 2, "Fulfillment retains the lock");
    await n.service.end(n.service.current.id);
    await leaf.openFile({ path: other }); assert.equal(opened.length, 3, "Exit releases immediately");
    guard.destroy(); assert.equal(Leaf.prototype.openFile, before); Module._load = originalLoad; n.destroy();

    // Resource Oaths use the fixed Resource ID and exclude every Project.
    const r = fixture();
    r.files.set("Resources/Research/Tasks.md", "- [ ] Read source\n");
    const ref = { type: "resource", id: "literature" };
    await r.service.take(r.draft({ workspace: ref, tasks: r.service.workspaceTasks(ref) }));
    assert.equal(r.service.current.workspace.id, "literature");
    assert(r.service.canOpen(r.resources[1])); assert(!r.service.canOpen(r.resources[0])); assert(!r.service.canOpen(r.contexts[0]));
    await r.service.end(r.service.current.id, "broken"); assert(r.service.canOpen(r.contexts[0])); r.destroy();
    console.log("PASS: scoped task order, stable identity, reload, invalid schedules, resources, continued lock, history, native navigation and cleanup.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
