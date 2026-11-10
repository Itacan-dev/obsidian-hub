"use strict";
const assert = require("assert/strict");
const fs = require("fs/promises"), os = require("os"), path = require("path"), Module = require("module");
const { HubDataStore } = require("../services/data-store");
const { HubWorkspaceState, migrateWorkspaceState } = require("../services/workspace-state");
const { HubPresets } = require("../services/presets");
const clone = value => JSON.parse(JSON.stringify(value));
function storage(entries = {}) {
    const map = new Map(Object.entries(entries));
    return { getItem: key => map.get(key) ?? null, key: index => [...map.keys()][index],
        get length() { return map.size; }, setItem() { throw Error("Runtime must not write localStorage"); } };
}
const layout = { main: { type: "split", direction: "vertical", children: [
    { type: "tabs", children: [{ id: "hub", type: "leaf", state: { type: "markdown", state: { file: "Projects/Test/Test.md" } } }] },
    { type: "tabs", currentTab: 1, children: [
        { id: "note", type: "leaf", state: { type: "markdown", state: { file: "Projects/Test/A.md", mode: "source" } } },
        { id: "browser", type: "leaf", state: { type: "webviewer", state: { url: "https://example.org", title: "Example" } } }
    ] }
] }, active: "browser" };
const folders = { "Projects/Test/Folder": { currentPath: "Projects/Test/Folder/Sub", collapsed: true, manualHeight: 203 } };
const legacyPreset = { id: "legacy-id", name: "My preset", version: 1, layout, railState: "half",
    folderState: { folders, order: ["Folder"] }, customFutureField: { preserve: true } };
const legacyMode = { presets: [legacyPreset], lastFile: { path: "Projects/Test/A.md" }, lastWorkspaceId: "p",
    projects: { p: { layout } } };
const oldStorage = storage({ "obsidian-hub::workspace-mode::Test": JSON.stringify(legacyMode),
    "obsidian-hub::folder-ui::Test::p": JSON.stringify(folders) });

async function run() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "hub-workspace-state-"));
    const directory = path.join(root, ".obsidian/plugins/hub-project-menu");
    const file = path.join(directory, "data.json");
    await fs.mkdir(directory, { recursive: true });
    const original = Module._load;
    const notices = [];
    Module._load = function (name) { return name === "obsidian" ? {
        Notice: class { constructor(text) { notices.push(text); } }, Plugin: class {}, Modal: class {},
        FuzzySuggestModal: class {}, TFile: class {}, TFolder: class {}, normalizePath: value => value
    } : original.apply(this, arguments); };
    const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
    compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
    compiled._compile(await fs.readFile(filename, "utf8") + "\nmodule.exports.Modes = HubWorkspaceModeService; module.exports.Wizard = ProjectWizardService;", filename);
    async function boot(legacy = storage()) {
        const plugin = { app: { vault: { configDir: ".obsidian", getName: () => "Test", adapter: { getBasePath: () => root } } },
            manifest: { id: "hub-project-menu" },
            async loadData() { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch (e) { if (e.code === "ENOENT") return null; throw e; } },
            async saveData() { throw Error("Desktop writes must use existing atomic persistence"); } };
        plugin.dataStore = new HubDataStore(plugin);
        plugin.projectWizard = new compiled.exports.Wizard(plugin);
        await plugin.projectWizard.load();
        plugin.workspaceState = new HubWorkspaceState(plugin);
        await plugin.workspaceState.initialize(legacy);
        plugin.workspaceModes = new compiled.exports.Modes(plugin);
        return plugin;
    }
    const disk = async () => JSON.parse(await fs.readFile(file, "utf8"));
    try {
        let plugin = await boot();
        assert.deepEqual(plugin.workspaceModes.state.presets, []);
        assert.equal(plugin.workspaceModes.state.lastFile, null);
        assert.equal(plugin.workspaceModes.state.lastWorkspaceId, null);
        assert.deepEqual(plugin.workspaceState.folders("missing"), {});
        assert.deepEqual(plugin.projectWizard.activityLog, []);
        assert.deepEqual(plugin.projectWizard.getCompletedTaskHistory(), []);
        assert.deepEqual(plugin.projectWizard.workRatings, {});
        assert.deepEqual(plugin.projectWizard.projectWorkLogs, {});
        assert.deepEqual(plugin.projectWizard.resourceWorkLogs, {});
        const entries = new Map();
        Object.assign(plugin.app.vault, {
            getMarkdownFiles: () => [], getAbstractFileByPath: p => entries.get(p),
            async createFolder(p) { entries.set(p, { path: p, children: [] }); },
            async create(p, content) { entries.set(p, { path: p, content }); }
        });
        plugin.app.vault.adapter.exists = async p => entries.has(p);
        await plugin.projectWizard.ensureCategoryShortcuts();
        await plugin.projectWizard.ensureProjectIds();
        await plugin.projectWizard.ensureResources();
        assert.deepEqual(plugin.projectWizard.getProjectRecords(), []);
        assert.equal([...entries.keys()].filter(p => p.endsWith(".md")).length, 4,
            "Fresh vault creates only the four built-in Resource dashboards");

        plugin = await boot(oldStorage);
        assert.deepEqual(plugin.workspaceModes.state.presets, [legacyPreset]);
        assert.deepEqual(plugin.workspaceState.folders("p"), folders);
        assert.equal(plugin.workspaceModes.state.lastFile, null, "Existing vault state wins over old last-file state");
        assert.deepEqual(migrateWorkspaceState({}, oldStorage, "Test").workspaceMode.lastFile, legacyMode.lastFile);
        const initial = await disk();
        plugin = await boot(oldStorage);
        assert.deepEqual(await disk(), initial, "Unchanged migration does not rewrite data");
        assert.equal(plugin.workspaceModes.state.presets.length, 1);

        let modes = plugin.workspaceModes, presets = new HubPresets(modes);
        // Exercise the real snapshot with browser tabs, selected tab and pane placement.
        const context = { projectId: "p", path: "Projects/Test/Test.md", root: "Projects/Test" };
        modes.mode = { project: context, projectLeaf: {} };
        modes.noteRailState = "half";
        modes.noteRailWidth = 307;
        modes.state.noteRail = { state: "closed", width: 307 };
        modes.usableContentLeaves = () => [{}];
        modes.leafElement = () => null;
        modes.app.workspace = { getLayout: () => clone(layout) };
        modes.app.vault.getAbstractFileByPath = () => ({});
        modes.app.metadataCache = { getFileCache: () => ({ frontmatter: { folder_order: ["Folder"] } }) };
        global.localStorage = { getItem() { throw Error("No runtime local reads"); }, setItem() { throw Error("No runtime local writes"); } };
        const created = presets.create("New preset");
        await plugin.workspaceState.pending;
        assert.deepEqual((await disk()).workspaceMode.presets[1], created);
        plugin = await boot();
        presets = new HubPresets(plugin.workspaceModes);
        assert.deepEqual(presets.items[1], created, "Complete snapshot survives plugin reload on a clean device");
        assert.equal(created.railWidth, 307, "Preset stores custom open width");
        assert.equal(plugin.workspaceModes.noteRailState, "closed", "Closed state survives restart");
        assert.equal(plugin.workspaceModes.noteRailWidth, 307, "Restart retains remembered open width separately");
        presets.rename(created.id, "Renamed");
        await plugin.workspaceState.pending;
        assert.equal((await disk()).workspaceMode.presets[1].name, "Renamed");
        presets.snapshot = () => ({ layout: { ...layout, active: "note" }, railState: "closed", folderState: { folders, order: [] } });
        presets.update(created.id);
        await plugin.workspaceState.pending;
        assert.equal((await disk()).workspaceMode.presets[1].layout.active, "note");
        assert.equal((await disk()).workspaceMode.presets[1].railState, "closed");
        presets.delete(created.id);
        presets.delete(legacyPreset.id);
        await plugin.workspaceState.pending;
        assert.deepEqual((await disk()).workspaceMode.presets, []);
        plugin = await boot(oldStorage);
        assert.deepEqual(plugin.workspaceModes.state.presets, [], "Stale local data cannot resurrect deleted presets");
        const changedLegacy = clone(legacyMode);
        changedLegacy.presets[0].name = "Older laptop copy";
        changedLegacy.presets.push({ ...legacyPreset, id: "laptop-only", name: "Laptop preset" });
        const laptopStorage = storage({ "obsidian-hub::workspace-mode::Test": JSON.stringify(changedLegacy) });
        plugin = await boot(laptopStorage);
        assert.deepEqual(plugin.workspaceModes.state.presets.map(p => p.id), ["laptop-only"]);
        assert.equal(Object.keys((await disk()).workspaceMigration.sources).length, 2);
        assert.equal(oldStorage.getItem("obsidian-hub::workspace-mode::Test"), JSON.stringify(legacyMode));

        presets = new HubPresets(plugin.workspaceModes);
        presets.rename("laptop-only", "New vault name");
        await plugin.workspaceState.pending;
        plugin = await boot(laptopStorage);
        assert.equal(plugin.workspaceModes.state.presets[0].name, "New vault name");
        const before = await disk();
        await plugin.workspaceModes.saveState();
        assert.deepEqual(await disk(), before, "Identical workspace saves are skipped");
        await plugin.workspaceState.saveFolders("p", { panel: { collapsed: false } });
        plugin.projectWizard.data.activityLog = [{ type: "test" }];
        await plugin.dataStore.save(plugin.projectWizard.data);
        assert.deepEqual((await disk()).folderUi.p, { panel: { collapsed: false } });
        assert.equal((await disk()).workspaceMode.presets[0].name, "New vault name");

        plugin.workspaceModes.state.workspaceHistory = ["p", "resource:study"];
        plugin.workspaceModes.state.fileHistory = [
            { contextId: "p", path: "Projects/Test/A.md" },
            { contextId: "resource:study", path: "Resources/Knowledge/A.md" }
        ];
        await plugin.workspaceModes.saveState();
        const historyReload = await boot(oldStorage);
        assert.deepEqual(historyReload.workspaceModes.state.workspaceHistory, ["p", "resource:study"]);
        assert.deepEqual(historyReload.workspaceModes.state.fileHistory, plugin.workspaceModes.state.fileHistory,
            "Both MRU histories survive an actual data.json save and reload");
        assert.deepEqual((await disk()).workspaceMode.fileHistory, plugin.workspaceModes.state.fileHistory);

        // A OneDrive update during a live session must never be silently overwritten.
        const external = await disk(); external.workspaceMode.presets[0].name = "Other computer";
        await fs.writeFile(file, JSON.stringify(external));
        presets = new HubPresets(plugin.workspaceModes);
        presets.rename("laptop-only", "Unsaved local name");
        await assert.rejects(plugin.workspaceState.pending, { code: "HUB_STATE_CONFLICT" });
        assert.equal((await disk()).workspaceMode.presets[0].name, "Other computer");
        assert(notices.some(message => message.includes("not saved")));
        plugin = await boot(laptopStorage);
        assert.equal(plugin.workspaceModes.state.presets[0].name, "Other computer");

        const broken = storage({ "obsidian-hub::workspace-mode::Test": "{broken" });
        const safe = await disk();
        await assert.rejects(boot(broken), /malformed/);
        assert.deepEqual(await disk(), safe);
        assert.equal(broken.getItem("obsidian-hub::workspace-mode::Test"), "{broken");
        const failing = { app: plugin.app, projectWizard: { data: {} }, dataStore: { async save() { throw Error("disk full"); } } };
        await assert.rejects(new HubWorkspaceState(failing).initialize(oldStorage), /disk full/);
        assert.deepEqual(failing.projectWizard.data, {}, "Failed migration is not marked complete");
        console.log("Workspace persistence tests passed: fresh state, complete preset CRUD/reload, migration, cross-device deletions, unchanged writes, shared saves and external-write protection.");
    } finally {
        Module._load = original;
        delete global.localStorage;
        await fs.rm(root, { recursive: true, force: true });
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
