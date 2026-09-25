"use strict";
const assert = require("assert"), Module = require("module"), fs = require("fs"), path = require("path");
const { HubPresets } = require("../services/presets");
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
class TFile { constructor(path) { this.path = path; } }
const notices = [], original = Module._load;
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile, TFolder: class {},
    Notice: class { constructor(message) { notices.push(message); } }
} : original.apply(this, arguments); };
compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Modes = HubWorkspaceModeService;", filename);
const storage = new Map(); global.localStorage = { getItem: key => storage.get(key), setItem: (key,value) => storage.set(key,value) };
const leaf = (id, file) => ({ id, type: "leaf", state: { type: "markdown", state: { file, mode: "source" } } });
async function test() {
 {
    let persisted, saves = 0;
    const m = { state: { presets: ["a", "b", "c", "d"].map(id => ({ id, name: id, layout: { main: { id } } })) },
        saveState() { persisted = JSON.stringify(this.state); saves++; } };
    const presets = new HubPresets(m), originals = [...presets.items];
    presets.reorder(["d", "a", "b", "c"]);
    assert.deepEqual(presets.items.map(item => item.id), ["d", "a", "b", "c"]);
    assert.strictEqual(presets.items[0], originals[3], "Reorder retains the original preset contents");
    const restored = new HubPresets({ ...m, state: JSON.parse(persisted) });
    assert.deepEqual(restored.items.map(item => item.id), ["d", "a", "b", "c"], "Order survives reload");
    presets.reorder(["a", "b", "c", "d"]);
    presets.reorder(["a", "b", "c", "d"]);
    assert.equal(saves, 2, "No write for unchanged order");
    for (const invalid of [["a"], ["a", "b", "c", "c"], ["a", "b", "c", "missing"]]) {
        assert.throws(() => presets.reorder(invalid), /list changed/);
    }
    presets.reorder(["c", "a", "d", "b"]); presets.rename("d", "Renamed"); presets.delete("a");
    assert.deepEqual(presets.items.map(item => item.id), ["c", "d", "b"]);
    assert.equal(presets.items[1].name, "Renamed", "Management uses identity after reordering");
    m.destroyed = true; assert.throws(() => presets.reorder(["b", "c", "d"]), /unloaded/);
 }
 const { prepareNoteLayout } = require("../domain/navigation");
 const nativePrepared = { main: { type: "split", children: [
    { type: "leaf", id: "hub", state: { type: "hub-prepared-note-rail",
        state: { file: "Hub.md", hubPreparedRail: "transient" } } },
    leaf("note", "Note.md")
 ] }, active: "note" };
 const canonical = prepareNoteLayout(nativePrepared, "Hub.md", () => true);
 assert.equal(canonical.main.children[0].state.type, "markdown");
 assert.equal(canonical.main.children[0].state.state.mode, "preview");
 assert(!("hubPreparedRail" in canonical.main.children[0].state.state));
 assert.equal(nativePrepared.main.children[0].state.type, "hub-prepared-note-rail");
 for (const kind of ["project", "resource"]) {
    const context = { projectId: kind === "project" ? "p" : "resource:study", path: `${kind}/Hub.md`, root: kind, contextKind: kind, status: "active", resourceType: kind === "resource" ? "study" : undefined };
    const files = new Map([context.path, `${kind}/A.md`, `${kind}/B.md`].map(path => [path,new TFile(path)]));
    files.set(`${kind}/Folder`, {}); files.set(`${kind}/Folder/Sub`, {});
    const layout = { main: { id: "root", type: "split", direction: "vertical", children: [
        { id: "rail", type: "tabs", children: [leaf("hub",context.path)] },
        { id: "notes", type: "split", direction: "horizontal", children: [
            { id: "one", type: "tabs", currentTab: 1, children: [leaf("a",`${kind}/A.md`),leaf("b",`${kind}/B.md`)] },
            { id: "two", type: "tabs", children: [leaf("copy",`${kind}/A.md`)] }
        ] }
    ] }, active: "b", left: { sidebar: "must not be saved" } };
    const folders = { [`${kind}/Folder`]: { currentPath: `${kind}/Folder/Sub`, search: "task", sortKey: "name", sortDirection: "asc", collapsed: true, manualHeight: 203 } };
    const root = { getClientRects: () => [1], dataset: { hubContextId: context.projectId },
        hubCaptureFolders: () => ({ folders, order: ["Folder"] }), hubRestoreFolders(value) { this.restored = value; } };
    let persisted, liveLayout = layout, changes = 0, fm = { folder_order: ["Folder"] }, present = 0;
    const m = Object.create(compiled.exports.Modes.prototype);
    Object.assign(m, { state: { projects: {} }, mode: { project: context, projectLeaf: {} }, noteRailState: "half",
        app: { vault: { getName: () => "Test", getAbstractFileByPath: p => files.get(p) },
            internalPlugins: { getEnabledPluginById: () => ({}) },
            workspace: { getLayout: () => liveLayout, changeLayout: async value => { changes++; liveLayout = value; } },
            metadataCache: { getFileCache: () => ({ frontmatter: fm }) },
            fileManager: { processFrontMatter: async (file, change) => change(fm) } },
        plugin: { workspaceState: { folders: () => ({}), saveFolders: async () => {} }, ensureContextOpen: async () => true,
            preparedNoteRails: { prepare: async (context, snapshot) => ({ snapshot, dispose() {} }) } },
        usableContentLeaves: () => [{ id: "b" }], leafElement: () => ({ querySelectorAll: () => [root] }),
        saveState() { persisted = JSON.stringify(this.state); }, contextFor: id => id === context.projectId ? context : null,
        enqueue: async fn => fn(), navigateFrom: async (source, fn) => fn(), leafForSource: () => ({}),
        dashboardRoot: () => root, presentWorkspace: async (source,c,note,fn) => { present++; assert(note); return fn(); },
        beginLayoutMutation() {}, clearModeClasses() {}, findLeafByPath: () => ({}), leafDocument: () => ({}),
        activeMainLeaf: () => null,
        // DOM adoption is exercised separately in note-restore-first-frame.html.
        prepareRestoredNoteMode() { return { adopt() {}, cancel() {} }; },
        pickContentLeaf: () => ({ id: "b" }), leafPath: () => `${kind}/B.md`,
        rememberNote() {}, rememberContext() {}, applyModeClasses() {}, collapseNativeSidebars() {}
    });
    const presets = m.plugin.presets = new HubPresets(m);
    const first = presets.create(""), second = presets.create(" ");
    assert.equal(first.name,"Preset 1"); assert.equal(second.name,"Preset 2");
    assert(!first.layout.left); assert.equal(first.layout.main.children[1].children[0].currentTab,1);
    folders[`${kind}/Folder`].search = "changed";
    assert.equal(first.folderState.folders[`${kind}/Folder`].search,"task","Snapshot is detached from live folder state");
    presets.rename(first.id,"Focused"); assert.equal(presets.items[0].name,"Focused");
    m.state = JSON.parse(persisted); assert.equal(new HubPresets(m).items.length,2,"Restart uses existing persistent workspace store");
    m.mode = null; assert(!presets.canSave); assert.throws(() => presets.update(first.id),/note-mode/);
    assert(await presets.open(first.id,{})); assert.equal(changes,1); assert.equal(present,1);
    assert.equal(root.restored.folders[`${kind}/Folder`].search,"task"); assert.equal(m.noteRailState,"half");
    assert.equal(presets.pending,null); assert.deepEqual(liveLayout.main,first.layout.main);
    const web = (id,url) => ({id,type:"leaf",state:{type:"webviewer",state:{url,title:id,navigate:true}}});
    for (const entries of [[web("web1","https://example.org/one")],
        [leaf("a",kind+"/A.md"),web("web1","https://example.org/one"),leaf("b",kind+"/B.md"),web("web2","https://example.org/two")]]) {
        liveLayout={main:{type:"split",children:[{type:"tabs",children:[leaf("hub",context.path)]},
            {type:"tabs",currentTab:entries.length-1,children:entries}]},active:entries.at(-1).id};
        const browserPreset=presets.create("Browser");
        presets.update(browserPreset.id);
        const savedBrowser=presets.items.find(x=>x.id===browserPreset.id);
        assert(await presets.open(browserPreset.id,{}));
        assert.deepEqual(liveLayout.main,savedBrowser.layout.main);
        assert.equal(liveLayout.active,entries.at(-1).id);
        assert.deepEqual(liveLayout.main.children[1].children.map(x=>x.id),entries.map(x=>x.id));
        presets.delete(browserPreset.id);
    }
    await presets.open(first.id,{});
    const browserLayout={main:{type:"split",children:[
        {type:"tabs",children:[leaf("hub",context.path)]},
        {type:"tabs",currentTab:0,children:[web("web1","https://example.org/last")]}
    ]},active:"web1"};
    const lastFileMode=Object.create(m);
    Object.assign(lastFileMode,{
        state:{projects:{[context.projectId]:{layout:browserLayout}}},
        history:null, mode:null, contextFromSource:()=>null,lastContext:()=>context,
        globalLastFile:()=>null,lastNoteFile:()=>null,isShelvedLastFile:()=>false,
        rememberContext:()=>{}, contextFor:ref=>(ref===context.projectId||ref?.projectId===context.projectId||ref===context.path)?context:null,
        dashboardRoot:()=>null,isProjectNoteMode(){return !!this.mode},
        usableContentLeaves:()=>[{id:"web1"}],pickContentLeaf(){return this.lastActiveNoteLeaf},
        leafPath:()=>null
    });
    lastFileMode.rememberBrowserLayout(context);
    assert(lastFileMode.hasLastFile(),"Browser-only Last File remains enabled");
    assert(await lastFileMode.openLastFile(null),"Actual Last File route restores browser-only layout");
    assert.equal(liveLayout.active,"web1");
    assert.equal(liveLayout.main.children[1].children[0].state.type,"webviewer");
    assert.equal(lastFileMode.lastActiveNoteLeaf.id,"web1","Browser active leaf retained");
    assert(!lastFileMode.state.lastFile.path,"Browser association never pretends URL is a file");
    lastFileMode.app={...m.app,internalPlugins:{getEnabledPluginById:()=>null}};
    assert(!lastFileMode.hasLastFile(),"Unavailable browser-only layout cannot break navigation");
    assert.deepEqual(lastFileMode.state.projects[context.projectId].layout,browserLayout,"Unavailable layout is retained for later restoration");
    await presets.open(first.id,{});
    m.noteRailState = "closed"; presets.update(first.id); assert.equal(presets.items[0].railState,"closed");
    assert.equal(presets.items[0].name,"Focused","Update preserves preset identity/name");
    presets.rewritePaths(p => typeof p === "string" ? p.replace(`${kind}/Folder`,`${kind}/Renamed`).replace(`${kind}/A.md`,`${kind}/Moved.md`) : p);
    files.set(`${kind}/Moved.md`,new TFile(`${kind}/Moved.md`)); files.delete(`${kind}/A.md`);
    files.set(`${kind}/Renamed`,{}); files.delete(`${kind}/Folder`); files.delete(`${kind}/Folder/Sub`);
    files.delete(`${kind}/B.md`);
    assert(await presets.open(first.id,{}));
    assert(notices.at(-1).includes("unavailable"));
    assert.equal(root.restored.folders[`${kind}/Renamed`].currentPath,`${kind}/Renamed`,"Missing subfolder falls back to panel root");
    assert.equal(liveLayout.main.children[1].children[0].children[0].state.state.file,`${kind}/Moved.md`);
    const before = changes;
    files.delete(`${kind}/Moved.md`); assert.equal(await presets.open(first.id,{}),false); assert.equal(changes,before,"All missing does not change live layout");
    files.delete(context.path); assert.equal(await presets.open(first.id,{}),false); assert.equal(changes,before);
    presets.delete(second.id); assert.equal(presets.items.length,1);
    m.destroyed = true; assert.throws(() => presets.delete(first.id),/unloaded/);
 }
 for(const view of ["Home","Project"]) {
    const source = fs.readFileSync(path.resolve(__dirname,`../../../../../System/Dashboards/${view}/view.js`),"utf8");
    assert(source.includes("presetsButton(nav, dv.component)"));
    assert(!source.includes('"Refresh Obsidian"'));
 }
 console.log("Preset tests passed: actual native layout restoration, Project/Resource snapshots, folder state, discrete rail state, naming/rename/update/delete, restart persistence, moved and missing files, source isolation, shared transitions and unload safety.");
}
test().catch(error => { console.error(error); process.exitCode=1; }).finally(() => { Module._load=original; });
