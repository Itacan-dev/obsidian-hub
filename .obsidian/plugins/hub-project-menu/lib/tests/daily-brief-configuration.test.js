"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), Module = require("module");
const originalLoad = Module._load, originalNow = Date.now, previousDocument = global.document;
class TFile { constructor(path) { this.path = path; this.extension = "md"; } }
class Base {}
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: Base, Modal: Base, Component: Base, Notice: Base, FuzzySuggestModal: Base, TFile, TFolder: Base
} : originalLoad.apply(this, arguments); };
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Modes = HubWorkspaceModeService; module.exports.Wizard = ProjectWizardService;", filename);
const Plugin = compiled.exports, { DailyBriefService } = require("../services/daily-brief"), { HubPresets } = require("../services/presets");
const { readTaskSnapshot } = require("../domain/task-planning");
const copy = value => JSON.parse(JSON.stringify(value));
const at = (day, hour) => new Date(2026, 8, day, hour).getTime();
const leaf = (id, file) => ({ id, type: "leaf", state: { type: "markdown", state: { file, mode: "source" } } });
const leaves = node => node.type === "leaf" ? [node] : (node.children ?? []).flatMap(leaves);

async function run() {
    let now = at(25, 10), edited = 0, stored, changedLayout, activeFile, currentContent;
    Date.now = () => now; global.document = { querySelector: () => null };
    const project = { projectId: "p", contextKind: "project", status: "active", name: "Complex Analysis", root: "P", path: "P/Home.md" };
    const files = new Map([project.path, "P/Assignment.md", "P/Notes.md", "P/Supporting.md", "P/Tasks.md"].map(p => [p, new TFile(p)]));
    const content = new Map([["P/Tasks.md", "- [ ] Assignment 5 <!-- hub-task:parent -->\n    - [ ] 1a <!-- hub-task:s1 -->\n    - [ ] 2b <!-- hub-task:s2 -->\n- [ ] Review\n"]]);
    const layout = { active: "assignment", main: { id: "main", type: "split", direction: "horizontal", children: [
        { id: "rail", type: "tabs", children: [leaf("hub", project.path)] },
        { id: "work", type: "tabs", currentTab: 0, children: [leaf("assignment", "P/Assignment.md"), leaf("notes", "P/Notes.md"),
            { id: "atlas", type: "leaf", state: { type: "webviewer", state: { url: "https://example.org/reference", title: "Atlas" } } }] },
        { id: "support", type: "tabs", children: [leaf("supporting", "P/Supporting.md")] }
    ] } };
    let liveLayout = copy(layout), browserEnabled = true, denyOath = false;
    const plugin = new Plugin(), wizard = plugin.projectWizard = Object.create(Plugin.Wizard.prototype);
    Object.assign(wizard, { data: {}, completedTaskHistory: [], completedTaskChecks: [], activityLog: [],
        getProjectById: id => id === "p" ? project : null, getResourceById: () => null,
        getProjectRecords: () => [project], getResourceTypes: () => [], getProgressReports: () => [],
        getContextForPath: p => p?.startsWith("P/") ? project : null });
    plugin.dataStore = wizard.store = { save: async data => { stored = copy(data); } };
    plugin.app = { vault: { getAbstractFileByPath: p => files.get(p), read: async file => content.get(file.path) ?? "",
        process: async (file, update) => {
            currentContent = update(content.get(file.path) ?? ""); content.set(file.path, currentContent);
            // Native notifications can happen during the write and again after it.
            plugin.recordEditorActivity(file, { getValue: () => currentContent });
        } }, plugins: { plugins: {} }, metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
        fileManager: { processFrontMatter: async () => {} }, internalPlugins: { getEnabledPluginById: () => browserEnabled ? {} : null },
        workspace: { getLayout: () => liveLayout, getActiveFile: () => activeFile,
            changeLayout: async snapshot => { changedLayout = copy(snapshot); liveLayout = copy(snapshot); } } };
    plugin.workspaceState = { folders: () => ({}), saveFolders: async () => {}, save: state => { wizard.data.workspaceMode = copy(state); } };
    plugin.markProjectChangedByPath = () => {}; plugin.notifyCompletedTasksChanged = () => {};
    plugin.scheduleEditedActivity = () => edited++;
    plugin.ensureContextOpen = async context => { assert.equal(context.status, "active"); return !denyOath; };
    plugin.preparedNoteRails = { prepare: async (_, snapshot) => ({ snapshot, dispose() {} }) };
    plugin.oath = { active: false, ready: () => true, api: () => ({}), canOpen: () => !denyOath, changed() {} };
    const modes = plugin.workspaceModes = Object.create(Plugin.Modes.prototype);
    Object.assign(modes, { plugin, app: plugin.app, state: { version: 4, projects: {}, workspaceHistory: [], fileHistory: [] },
        mode: { project, projectLeaf: {} }, noteRailState: "half", contextFor: ref => ref === "p" || ref?.startsWith?.("P/") ? project : null,
        usableContentLeaves: () => leaves(liveLayout.main).filter(x => x.id !== "hub").map(x => ({ ...x, getViewState: () => x.state })),
        leafElement: () => ({ querySelectorAll: () => [] }), leafDocument: () => ({}), dashboardRoot: () => null,
        enqueue: fn => fn(), navigateFrom: (_, fn) => fn(), leafForSource: () => null,
        presentWorkspace: async (_, context, note, fn) => { assert.equal(context, project); assert(note); return fn(); },
        beginLayoutMutation() {}, clearModeClasses() {}, prepareRestoredNoteMode: () => ({ adopt() {}, cancel() {} }),
        findLeafByPath: () => ({}), activeMainLeaf: () => null, applyModeClasses() {}, collapseNativeSidebars() {},
        pickContentLeaf() { return this.lastActiveNoteLeaf; }, leafPath: x => x?.state?.state?.file,
        rememberNote() {}, rememberBrowserLayout() {} });
    plugin.presets = new HubPresets(modes);
    plugin.taskData = { currentPath: p => p, readPages: () => [{ file: { tasks: [readTaskSnapshot(content.get("P/Tasks.md"),
        { path: "P/Tasks.md", line: 0, text: "Assignment 5", hubTaskId: "parent" })] } }] };
    plugin.taskEditor = { metadata: () => ({}) };
    modes.captureNoteLayout(true);
    const worked = copy(modes.state.projects.p.configurations);
    assert.equal(worked[0].layout.active, "assignment");
    now = at(25, 11); modes.captureNoteLayout(true);
    assert.deepEqual(modes.state.projects.p.configurations, worked, "Unchanged configuration is not written on every editor keystroke");
    now = at(26, 7); modes.captureNoteLayout();
    assert.deepEqual(modes.state.projects.p.configurations, worked, "Passive layout refresh cannot advance the work day");
    modes.mode = null; now = at(25, 17);
    await plugin.mutateTask({ path: "P/Tasks.md", line: 0, text: "Assignment 5", hubTaskId: "parent", operation: "step",
        step: { line: 1, text: "1a", hubTaskId: "s1" }, stepCompleted: true });
    await plugin.toggleTask("P/Tasks.md", 3, "Review", true);
    plugin.recordEditorActivity(files.get("P/Tasks.md"), { getValue: () => currentContent });
    assert.equal(edited, 0, "Synchronous and delayed task persistence is not generic editor work");
    assert.deepEqual(modes.state.projects.p.configurations, worked, "Checking parent and Step from Home preserves real work configuration");
    assert.deepEqual(wizard.completedTaskHistory.map(x => x.kind ?? "task").sort(), ["step", "task"]);
    now = at(26, 9);
    const brief = new DailyBriefService(plugin, { now: () => new Date(now) }); brief.started = true;
    const morning = await brief.load();
    assert.equal(morning.context.workspaces[0].taskProgress.length, 2);
    assert.equal(morning.context.workspaces[0].lastRelevantFile.path, "P/Assignment.md");
    assert.equal(morning.recommendation.target.kind, "configuration");
    assert.equal(morning.recommendation.target.configuration.railState, "half");
    const snapshot = copy(wizard.data.dailyBriefSnapshot);
    // Later real work updates Last File state, never this day's already-resolved brief.
    modes.mode = { project, projectLeaf: {} }; activeFile = files.get("P/Assignment.md");
    liveLayout.active = "notes"; liveLayout.main.children[1].currentTab = 1;
    plugin.recordEditorActivity(activeFile, { getValue: () => "Real mathematical work" });
    assert.equal(edited, 1); assert.equal(modes.state.projects.p.configurations[0].layout.active, "notes");
    assert.equal(modes.state.projects.p.configurations.length, 2);
    assert.deepEqual(brief.context().workspaces[0].workingConfiguration, worked[0], "Even late-first generation selects the pre-day configuration");
    assert.deepEqual(await brief.load(), morning);
    wizard.data = copy(stored); wizard.data.dailyBriefSnapshot = copy(snapshot);
    const restarted = new DailyBriefService(plugin, { now: () => new Date(now) }); restarted.started = true;
    assert.deepEqual(await restarted.load(), morning, "Historical layout survives a service restart");
    modes.mode = null;
    await brief.navigate(morning.recommendation.target);
    assert.equal(changedLayout.active, "assignment"); assert.equal(leaves(changedLayout.main).length, 5);
    files.delete("P/Notes.md"); files.delete("P/Supporting.md");
    await brief.navigate(morning.recommendation.target);
    assert.deepEqual(leaves(changedLayout.main).map(x => x.id), ["hub", "assignment", "atlas"]);
    assert.equal(changedLayout.main.children.length, 2, "Empty pane is pruned by shared native layout preparation");
    const moved = files.get("P/Assignment.md"); files.delete(moved.path); moved.path = "P/Moved.md"; files.set(moved.path, moved);
    wizard.activityLog.push({ action: "renamed", oldPath: "P/Assignment.md", path: moved.path, timestamp: now });
    await brief.navigate(morning.recommendation.target);
    assert.equal(leaves(changedLayout.main).find(x => x.id === "assignment").state.state.file, moved.path);
    files.delete(moved.path); await brief.navigate(morning.recommendation.target);
    assert.equal(changedLayout.active, "atlas", "Deleted active file selects surviving Atlas tab");
    assert.deepEqual(leaves(changedLayout.main).map(x => x.id), ["hub", "atlas"]);
    let full = 0, home = 0;
    modes.openProjectFull = async () => { full++; return true; }; modes.openHome = async () => { home++; return true; };
    browserEnabled = false; await brief.navigate(morning.recommendation.target); assert.equal(full, 1);
    project.status = "shelved"; await brief.navigate(morning.recommendation.target); assert.equal(home, 1); assert.equal(project.status, "shelved");
    project.status = "active"; denyOath = true; plugin.oath.active = true; await brief.navigate(morning.recommendation.target); assert.equal(full, 1);
    assert.deepEqual(wizard.data.dailyBriefSnapshot, snapshot, "Restoration never rewrites the anchored historical configuration");
    brief.destroy(); restarted.destroy();
    console.log("PASS: real task/Step writes vs editor work, pre-day configuration anchoring/restart, native Preset restoration, multiple files, Atlas, active selection, deleted panes, rename resolution, Full-view fallback, Shelved and Oath guards.");
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
    Module._load = originalLoad; Date.now = originalNow; global.document = previousDocument;
});
