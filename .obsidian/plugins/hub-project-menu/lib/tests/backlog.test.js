"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const { prepareNoteLayout, rewriteLayoutPaths, RESOURCE_TYPES, validateFocusItems,
    normalizeImagePlacement } = require("..");

const leaf = (id, file) => ({ id, type: "leaf", state: { type: "markdown", state: { file, mode: "preview" } } });
const nativeLayout = { active: "two", main: { id: "main", type: "split", direction: "vertical", children: [
    { id: "rail", type: "tabs", children: [leaf("hub", "Projects/A/A.md")] },
    { id: "notes", type: "split", direction: "horizontal", children: [
        { id: "first", type: "tabs", currentTab: 1, children: [leaf("one", "Projects/A/one.md"), leaf("gone", "deleted.md")] },
        { id: "second", type: "tabs", children: [leaf("two", "Resources/Knowledge/Math/two.md")] }
    ] }
] } };
const restored = prepareNoteLayout(nativeLayout, "Projects/A/A.md", p => p !== "deleted.md");
assert.equal(restored.main.children[1].direction, "horizontal");
assert.equal(restored.main.children[1].children[0].currentTab, 0);
assert.equal(restored.main.children[1].children[0].children[0].state.state.mode, "source");
assert.equal(restored.main.children[0].children[0].state.state.mode, "preview");
assert.equal(restored.active, "two");
assert.equal(nativeLayout.main.children[1].children[0].children.length, 2, "Do not mutate stored snapshots");
assert.equal(prepareNoteLayout(nativeLayout, "Projects/A/A.md", p => p === "Projects/A/A.md"), null);
const tabs = { main: { type: "tabs", currentTab: 2, children: [leaf("hub", "Projects/A/A.md"), leaf("gone", "deleted.md"), leaf("one", "Projects/A/one.md"), leaf("two", "Projects/A/two.md")] } };
assert.equal(prepareNoteLayout(tabs, "Projects/A/A.md", p => p !== "deleted.md").main.currentTab, 1,
    "Pruning an earlier tab must preserve the selected surviving tab");
assert.equal(rewriteLayoutPaths(nativeLayout, p => p.replace("Projects/A/", "Projects/Renamed/"))
    .main.children[0].children[0].state.state.file, "Projects/Renamed/A.md");
assert.deepEqual(RESOURCE_TYPES.map(r => r.label), ["Knowledge", "Research", "Explorations", "Inspiration"]);
assert.equal(RESOURCE_TYPES[1].id, "literature", "Research retains existing reports, ordering and placement IDs");
assert.equal(RESOURCE_TYPES[1].hubPath, "Resources/Research/Research.md");
assert(RESOURCE_TYPES[1].legacyRoots.some(r => r.root === "Resources/Literature" && r.hubName === "Literature.md"));
assert.equal(RESOURCE_TYPES[2].id, "references", "Preserve existing context/folder IDs");
assert.equal(validateFocusItems([{ projectId: "resource:study", projectName: "Knowledge", text: "Study topology" }])[0].projectId, "resource:study");
assert.deepEqual(normalizeImagePlacement({ x: -20, y: 200, zoom: 99 }), { x: 0, y: 100, zoom: 3 });

class TFile { constructor(path) { this.path = path; this.extension = path.split('.').pop(); this.basename = path.split('/').pop().replace(/\.md$/, ''); } }
class TFolder {}
class Base {}
const storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
global.window = { setTimeout, clearTimeout };
global.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
const notices = [];
const originalLoad = Module._load;
Module._load = function(request) {
    if (request === "obsidian") return { Plugin: Base, Menu: Base, Modal: Base, FuzzySuggestModal: Base,
        Notice: class { constructor(text) { notices.push(text); } }, TFile, TFolder, normalizePath: p => p, setIcon() {} };
    return originalLoad.apply(this, arguments);
};
const filename = path.resolve(__dirname, "../../plugin.js");
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.testing = { HubWorkspaceModeService, ProjectWizardService, ConfirmModal, ProjectAdvancementModal };", filename);
Module._load = originalLoad;
const HubPlugin = compiled.exports;
const { HubWorkspaceModeService, ProjectWizardService, ConfirmModal, ProjectAdvancementModal } = HubPlugin.testing;
const homeSource = fs.readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Home/view.js"), "utf8");
const summarySource = homeSource.slice(homeSource.indexOf("function formatHomeContextSummary("), homeSource.indexOf("const dateBox ="));
const formatSummary = new Function(summarySource + "; return formatHomeContextSummary;")();
for (const tasks of [0, 1, 3]) for (const events of [0, 1, 4]) {
    const result = formatSummary(tasks, events);
    assert.doesNotMatch(result, /today/i);
    assert.ok(result.includes(tasks ? `${tasks} task${tasks === 1 ? "" : "s"} to do` : "Your task list is empty"));
    assert.equal(result.includes("calendar event"), events > 0);
    if (events) assert.ok(result.includes(`${events} calendar event${events === 1 ? "" : "s"} coming up.`));
}

async function run() {
    const project = { projectId: "a", name: "A", path: "Projects/A/A.md", root: "Projects/A", contextKind: "project", status: "active", resourceFolderIds: ["math"] };
    const resource = { projectId: "resource:study", resourceType: "study", name: "Knowledge", path: "Resources/Knowledge/Knowledge.md", root: "Resources/Knowledge", contextKind: "resource" };
    const files = new Map([project.path, resource.path, "Projects/A/one.md", "Resources/Knowledge/Math/two.md", "Inbox/free.md"].map(p => [p, new TFile(p)]));
    const plugin = { app: { vault: { getName: () => "test", getAbstractFileByPath: p => files.get(p) } },
        ensureContextOpen: async () => true,
        projectWizard: {
            getProjectById: id => id === "a" ? project : null,
            getProjectForPath: p => String(p).startsWith(project.root + "/") ? project : null,
            getProjectRecords: () => [project],
            getResourceById: id => ["study", "resource:study"].includes(id) ? resource : null,
            getResourceForPath: p => String(p).startsWith(resource.root + "/") ? resource : null,
            getResourceFolders: ids => ids.includes("math") ? [{ path: "Resources/Knowledge/Math" }] : []
        }
    };
    let persisted;
    plugin.workspaceState = { load: () => persisted ? JSON.parse(persisted) : null,
        save: state => { persisted = JSON.stringify(state); } };
    const navigation = new HubWorkspaceModeService(plugin);
    navigation.presentWorkspace = async (_, context, note, apply) => apply();
    plugin.preparedNoteRails = { prepare: async (context, snapshot) => ({ snapshot, dispose() {} }) };
    navigation.prepareRestoredNoteMode = () => ({ adopt() {}, cancel() {} });
    navigation.activeMainLeaf = () => null;
    navigation.dashboardRoot = source => source?.dataset ? source : null;
    navigation.leafForSource = source => source;
    navigation.leafPath = source => source?.path;
    const projectSource = { dataset: { hubContextId: "a" } };
    const resourceSource = { dataset: { hubContextId: "resource:study" } };
    const homeSource = { dataset: {} };
    assert.equal(navigation.contextForFile("Resources/Knowledge/Math/two.md", projectSource), project);
    navigation.rememberNote(project, files.get("Projects/A/one.md"));
    navigation.rememberNote(resource, files.get("Resources/Knowledge/Math/two.md"));
    assert.equal(navigation.lastNavigationInfo(projectSource).file.path, "Projects/A/one.md");
    assert.equal(navigation.lastNavigationInfo(homeSource).file.path, "Resources/Knowledge/Math/two.md");
    assert.equal(navigation.lastWorkspace(), resource);
    navigation.rememberProject(project);
    assert.equal(navigation.lastWorkspace(), project, "Opening a full Project updates Workspace without opening a note");
    assert.equal(navigation.globalLastFile().path, "Resources/Knowledge/Math/two.md", "Workspace memory does not change Last File");
    navigation.rememberResource(resource);
    assert.equal(new HubWorkspaceModeService(plugin).lastWorkspace().projectId, resource.projectId,
        "Cross-kind Workspace recency survives reload");
    const originalFull = navigation.openProjectFull;
    let destination;
    navigation.openProjectFull = async context => { destination = context; };
    await navigation.openWorkspace(homeSource);
    assert.equal(destination, resource, "Home Workspace opens the most recently opened kind");
    await navigation.openWorkspace(projectSource);
    assert.equal(destination, resource, "Workspace resolves its independent MRU from a Project too");
    await navigation.openWorkspace(resourceSource);
    assert.equal(destination, resource, "Workspace inside a Resource returns to that Resource");
    navigation.openProjectFull = originalFull;
    const buttons = ["home", "workspace", "last-file"].map(role => ({
        dataset: { hubNav: role }, classList: { toggle(_, value) { this.selected = value; } },
        setAttribute() {}, removeAttribute() {}
    }));
    for (const note of [false, true]) {
        navigation.syncProjectNavigation({ querySelectorAll: () => [{ querySelectorAll: () => buttons,
            closest: () => note ? {} : null }] }, note);
        assert.deepEqual(buttons.map(b => b.classList.selected), [false, !note, note],
            "Only Last File is selected in note-mode; only Workspace in full view");
    }
    navigation.rememberNote(project, files.get("Resources/Knowledge/Math/two.md"));
    assert.equal(navigation.lastNoteFile(project).path, "Resources/Knowledge/Math/two.md");
    navigation.navigationHistory.rememberFile(null, files.get("Inbox/free.md"));
    assert.equal(navigation.lastNavigationInfo(homeSource).file.path, "Inbox/free.md");
    assert.equal(navigation.lastNavigationInfo(resourceSource).file.path, "Resources/Knowledge/Math/two.md");
    navigation.rememberNote(project, files.get("Projects/A/one.md"));
    project.status = "shelved";
    assert.equal(navigation.globalLastFile().path, "Inbox/free.md", "Shelved Last File falls through to the next eligible entry");
    assert.equal(navigation.hasLastFile(homeSource), true);
    assert.equal(navigation.hasLastFile(projectSource), false);
    assert.equal(navigation.lastNavigationInfo(homeSource).file.path, "Inbox/free.md");
    assert.equal(navigation.lastNoteFile(project), null);
    assert.equal(navigation.hasLastFile(resourceSource), true, "Resource Last File remains independent");
    const ensureContextOpen = plugin.ensureContextOpen;
    plugin.ensureContextOpen = async () => { throw Error("Last File must not request shelved activation"); };
    navigation.enqueue = fn => fn();
    assert.equal(await navigation.openLastFile(projectSource), false);
    assert.equal(notices.at(-1), "No recently opened files.");
    plugin.ensureContextOpen = ensureContextOpen;
    project.status = "active";
    assert.equal(navigation.globalLastFile().path, "Projects/A/one.md", "Ignoring shelved state is reversible when reactivated");
    assert.equal(await navigation.desiredMode(files.get("Projects/A/one.md")), "source");
    assert.equal(await navigation.desiredMode(files.get(project.path)), "preview");
    navigation.state.projects.a.layout = nativeLayout;
    navigation.state.projects.a.lastNotePath = "deleted.md";
    files.delete("Projects/A/one.md");
    assert.equal(navigation.lastNoteFile(project).path, "Resources/Knowledge/Math/two.md",
        "A deleted last file falls back to surviving contextual history");
    files.set("Projects/A/one.md", new TFile("Projects/A/one.md"));

    const restoredLeaves = ["Projects/A/one.md", "Resources/Knowledge/Math/two.md"].map((path, index) => ({ id: index ? "two" : "one", path }));
    let appliedLayout;
    plugin.app.workspace = { getLayout: () => ({ left: { id: "unchanged-sidebar" } }), changeLayout: async layout => { appliedLayout = layout; } };
    navigation.captureNoteLayout = () => {};
    navigation.beginLayoutMutation = () => {};
    navigation.clearModeClasses = navigation.applyModeClasses = navigation.collapseNativeSidebars = () => {};
    navigation.findLeafByPath = () => ({ id: "hub", path: project.path });
    navigation.leafDocument = () => "document";
    navigation.usableContentLeaves = () => restoredLeaves;
    navigation.leafElement = () => ({ isConnected: true });
    restoredLeaves.forEach(leaf => leaf.getViewState = () => ({ type: "markdown" }));
    assert.equal(await navigation.restoreNoteLayout(project), true);
    assert.equal(navigation.lastActiveNoteLeaf.id, "two", "Restore the active pane rather than the first pane");
    assert.equal(navigation.state.projects.a.lastNotePath, "Resources/Knowledge/Math/two.md");
    assert.equal(appliedLayout.left.id, "unchanged-sidebar");
    navigation.mode = null;

    navigation.enqueue = fn => fn();
    navigation.isProjectNoteMode = () => false;
    let restoredCount = 0, opened;
    navigation.restoreNoteLayout = async () => { restoredCount++; return true; };
    navigation.enterProjectNoteMode = async (context, file, options) => { opened = { context, file, options }; return true; };
    navigation.state.projects.a.layout = nativeLayout;
    await navigation.openProjectNote("Projects/A/one.md", "replace", projectSource);
    assert.equal(navigation.state.projects.a.layout, undefined, "Normal full-page opening discards old split memory");
    assert.equal(restoredCount, 0);
    await navigation.openProjectNote("Projects/A/one.md", "split", projectSource);
    assert.equal(restoredCount, 1);
    assert.equal(opened.options.placement, "split");
    await navigation.openProjectNote("Resources/Knowledge/Math/two.md", "replace", projectSource);
    assert.equal(opened.context, project);

    let transitions = 0;
    plugin.transitions = { navigate: async (_, fn) => { transitions++; return fn(); },
        navigateToLastFile: async (_, fn) => { transitions++; return fn(); } };
    navigation.restoreNoteLayout = async () => false;
    navigation.rememberNote(resource, files.get("Resources/Knowledge/Math/two.md"));
    await navigation.openLastFile(homeSource);
    assert.equal(opened.context, resource, "Global Last File keeps its owning Resource");
    await navigation.openLastFile(projectSource);
    assert.equal(opened.context, project, "Contextual Last File keeps the Project, including shared Resource notes");
    await navigation.openProjectNote("Projects/A/one.md", "replace", projectSource);
    assert.equal(transitions, 3, "Last File and file-browser navigation each use one transition");
    delete plugin.transitions;

    const host = new HubPlugin();
    host.app = plugin.app;
    let statusCalls = 0;
    host.setStatus = async (file, status) => { statusCalls++; assert.equal(status, "active"); return true; };
    assert.equal(await host.ensureContextOpen({ ...project, status: "future" }), false);
    assert.equal(statusCalls, 0);
    ConfirmModal.prototype.waitForConfirmation = async () => false;
    assert.equal(await host.ensureContextOpen({ ...project, status: "shelved" }), false);
    ConfirmModal.prototype.waitForConfirmation = async () => true;
    const shelved = { ...project, status: "shelved" };
    assert.equal(await host.ensureContextOpen(shelved), true);
    assert.equal(shelved.status, "active");
    assert.equal(statusCalls, 1);
    assert.equal(await host.ensureContextOpen(resource), true);
    assert.deepEqual(ProjectWizardService.prototype.getFocusContexts.call({
        getProjectRecords: () => [project, { ...project, projectId: "inactive", status: "future" }],
        getResourceTypes: () => [resource]
    }).map(context => context.projectId), ["a", "resource:study"]);

    const historyHost = { completedTaskHistory: ["a", "future", "deleted", "resource:study"].map(projectId => ({projectId})), getProjectRecords: () => [project, { projectId:"future", status:"future" }] };
    assert.deepEqual(ProjectWizardService.prototype.getCompletedTaskHistory.call(historyHost).map(t => t.projectId), ["a", "future", "deleted", "resource:study"], "Stored history survives later workspace deletion or status changes");
    const rating = { summaryInputs: new Map([["a", { value: "Old summary" }]]), currentSummaries:{a:"Old summary"}, selectedScores:new Map(), updateSaveButton(){} };
    ProjectAdvancementModal.prototype.selectScore.call(rating, { querySelectorAll: () => [] }, "a", 0);
    assert.equal(rating.summaryInputs.get("a").value, "");
    assert.equal(rating.currentSummaries.a, "");
    console.log("Hub backlog checks passed: native layout data, contextual navigation, opening policy, Resource identities/Focus, image limits, active task history and score-zero clearing.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
