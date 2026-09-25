"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { emptyWorkspaceState, HubWorkspaceState } = require("../services/workspace-state");
const { HISTORY_LIMIT } = require("../domain/navigation-history");
const { fixture: oathFixture } = require("./oath.test");
const clone = value => JSON.parse(JSON.stringify(value));
const leaf = (id, file) => ({ id, type: "leaf", state: { type: "markdown", state: { file, mode: "source", scroll: 27 } } });
const layout = (context, paths, active = "n0") => ({ active, main: { type: "split", direction: "horizontal", children: [
    { type: "tabs", children: [leaf("hub", context.path)] },
    { type: "tabs", currentTab: 0, children: paths.map((p, i) => leaf(`n${i}`, p)) }
] } });
class TFile {
    constructor(p) { this.path = p; this.basename = path.posix.basename(p, ".md"); this.extension = "md"; }
}
const notices = [], original = Module._load;
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile, TFolder: class {},
    Notice: class { constructor(message) { notices.push(message); } }
} : original.apply(this, arguments); };
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Modes = HubWorkspaceModeService;", filename);
const { Modes } = compiled.exports;

function setup(saved = emptyWorkspaceState()) {
    const contexts = ["a", "b", "c"].map(id => ({ projectId: id, contextKind: "project", status: "active",
        name: id, path: `Projects/${id}/${id}.md`, root: `Projects/${id}`, resourceFolderIds: ["shared"] }));
    const resource = { projectId: "resource:study", resourceType: "study", contextKind: "resource", name: "Knowledge",
        root: "Resources/Knowledge", path: "Resources/Knowledge/Knowledge.md" };
    contexts.push(resource);
    const files = new Map();
    const add = p => { const file = new TFile(p); files.set(p, file); return file; };
    for (const context of contexts) {
        add(context.path); add(context.root + "/one.md"); add(context.root + "/two.md");
    }
    add("Resources/Knowledge/Shared/note.md"); add("Inbox/free.md");
    let stored = clone(saved), saves = 0;
    const plugin = { app: { vault: { getAbstractFileByPath: p => files.get(p) }, workspace: {},
        internalPlugins: { getEnabledPluginById: () => ({}) } },
        workspaceState: { load: () => clone(stored), save: state => { stored = clone(state); saves++; } },
        projectWizard: {
            getProjectById: id => contexts.find(c => c.contextKind === "project" && c.projectId === id),
            getProjectForPath: p => contexts.find(c => c.contextKind === "project" && String(p).startsWith(c.root + "/")),
            getProjectRecords: () => contexts.filter(c => c.contextKind === "project"),
            getResourceById: id => contexts.includes(resource) && [resource.projectId, resource.resourceType].includes(id) ? resource : null,
            getResourceForPath: p => contexts.includes(resource) && String(p).startsWith(resource.root + "/") ? resource : null,
            getResourceFolders: ids => ids.includes("shared") ? [{ path: "Resources/Knowledge/Shared" }] : []
        },
        ensureContextOpen: async context => {
            assert(context.contextKind === "resource" || context.status === "active", "History must not request activation");
            assert(plugin.oath?.canOpen(context, false) !== false, "History must not request prohibited navigation");
            return true;
        }
    };
    const opened = [];
    function wire(modes) {
        modes.enqueue = fn => fn();
        modes.dashboardRoot = source => source?.dataset ? source : null;
        modes.leafForSource = source => source;
        modes.leafPath = source => source?.path;
        modes.isProjectNoteMode = context => modes.mode?.project.projectId === context.projectId;
        modes.openProjectFull = async context => { opened.push({ context }); modes.rememberContext(context); return true; };
        modes.enterProjectNoteMode = async (context, file) => {
            opened.push({ context, file }); modes.rememberNote(context, file); return true;
        };
        modes.restoreNoteLayout = async (context, snapshot) => {
            opened.push({ context, layout: snapshot }); return true;
        };
        modes.scheduleReconcile = () => {};
        modes.enforceViewMode = async () => {};
        return modes;
    }
    plugin.transitions = { navigateToLastFile: async (_, fn) => fn() };
    const modes = wire(new Modes(plugin));
    return { plugin, contexts, files, add, modes, opened, resource, reload: () => wire(new Modes(plugin)),
        get saved() { return stored; }, get saves() { return saves; } };
}
const source = context => ({ dataset: { hubContextId: context.projectId } });

async function run() {
    {
        const f = setup(), [a, b, c] = f.contexts, m = f.modes;
        assert.equal(await m.openWorkspace(), false);
        assert.equal(notices.at(-1), "No recently opened workspaces.");
        m.rememberContext(a); m.rememberContext(b);
        assert.equal(m.lastWorkspace(), b);
        m.rememberContext(a);
        assert.deepEqual(m.state.workspaceHistory, ["a", "b"]);
        m.rememberContext(f.resource); m.rememberContext(c);
        const order = clone(m.state.workspaceHistory);
        for (const status of ["shelved", "future"]) {
            c.status = status;
            assert.equal(m.lastWorkspace(), f.resource);
            assert.deepEqual(m.state.workspaceHistory, order, "Temporary state filtering preserves recency");
            c.status = "active";
            assert.equal(m.lastWorkspace(), c);
        }
        c.status = "shelved";
        await m.openWorkspace(source(a));
        assert.equal(f.opened.at(-1).context, f.resource, "Workspace resolves its own MRU even from another dashboard");
        assert.deepEqual(m.state.workspaceHistory, [f.resource.projectId, "c", "a", "b"]);
        c.status = "active";
        m.rememberContext(c); f.files.delete(c.path);
        assert.equal(m.lastWorkspace(), f.resource);
        assert(!m.state.workspaceHistory.includes("c"));
        assert.deepEqual(f.reload().state.workspaceHistory, m.state.workspaceHistory);
        m.handleDelete(new TFile(f.resource.root));
        assert.deepEqual(m.state.workspaceHistory, ["a", "b"]);
    }
    {
        const f = setup(), [a, b, c] = f.contexts, m = f.modes;
        const a1 = f.files.get(a.root + "/one.md"), a2 = f.files.get(a.root + "/two.md"), b1 = f.files.get(b.root + "/one.md");
        m.rememberNote(a, a1); m.rememberNote(b, b1); m.rememberNote(a, a2); m.rememberNote(a, a1);
        assert.deepEqual(m.state.fileHistory.map(e => e.path), [a1.path, a2.path, b1.path]);
        m.rememberNote(b, b1);
        await m.openLastFile(source(a));
        assert.equal(f.opened.at(-1).file, a1);
        m.mode = { project: a };
        m.rememberNote(b, b1);
        await m.openLastFile(source(a));
        assert.equal(f.opened.at(-1).context, a, "Note-view retains the same contextual scope");
        m.mode = null;
        const before = f.opened.length;
        assert.equal(await m.openLastFile(source(c)), false);
        assert.equal(f.opened.length, before);
        assert.equal(notices.at(-1), "No recently opened files.");
        m.rememberNote(b, b1);
        const order = clone(m.state.fileHistory);
        for (const status of ["shelved", "future"]) {
            b.status = status;
            assert.equal(m.globalLastFile(), a1);
            assert.equal(m.lastNoteFile(b), null);
            assert.deepEqual(m.state.fileHistory, order);
            b.status = "active";
            assert.equal(m.globalLastFile(), b1);
        }
        f.files.delete(b1.path);
        await m.openLastFile();
        assert.equal(f.opened.at(-1).file, a1, "Deleted newest file falls through on the first click");
        assert(!m.state.fileHistory.some(e => e.path === b1.path));
        m.handleDelete(a1);
        assert.equal(m.globalLastFile(), a2);
        assert.deepEqual(f.reload().state.fileHistory, m.state.fileHistory);
        const shared = f.files.get("Resources/Knowledge/Shared/note.md");
        m.rememberNote(a, shared); m.rememberNote(b, shared); m.rememberNote(f.resource, shared);
        assert.equal(m.state.fileHistory.filter(e => e.path === shared.path).length, 3);
        for (const context of [a, b, f.resource]) {
            await m.openLastFile(source(context));
            assert.equal(f.opened.at(-1).context, context);
        }
        a.resourceFolderIds = [];
        assert.equal(m.lastNoteFile(a), a2, "Detached but existing Resource context is temporarily skipped");
        a.resourceFolderIds = ["shared"];
        assert.equal(m.lastNoteFile(a), shared);
        const old = shared.path, renamed = f.add("Resources/Knowledge/Shared/Renamed.md");
        f.files.delete(old); m.handleRename(renamed, old);
        assert.equal(m.state.fileHistory.filter(e => e.path === renamed.path).length, 3);
        assert(!m.state.fileHistory.some(e => e.path === old));
        m.handleDelete(renamed);
        assert(!m.state.fileHistory.some(e => e.path === renamed.path));
        await m.handleOpenedFile(f.files.get("Inbox/free.md"), {});
        assert.equal(m.lastNavigationInfo().file.path, "Inbox/free.md", "Unscoped vault notes keep their existing global behavior");
        m.rememberNote(b, b1);
        m.isMainLeaf = () => true;
        m.openInLeaf = async () => {};
        await m.openFile("Inbox/free.md", {});
        assert.equal(m.state.fileHistory[0].path, "Inbox/free.md", "Queued vault opens record MRU without a native file-open event");
    }
    {
        const f = setup(), [a, b] = f.contexts, m = f.modes;
        const a1 = f.files.get(a.root + "/one.md"), a2 = f.files.get(a.root + "/two.md");
        m.rememberNote(a, a2); m.rememberNote(a, a1);
        const savedLayout = layout(a, [a1.path, a2.path, b.root + "/one.md"], "n1");
        m.state.projects.a.layout = savedLayout;
        f.plugin.oath = { canOpen: ref => !String(ref?.path ?? ref).startsWith(b.root) };
        await m.openLastFile(source(a));
        const restored = f.opened.at(-1).layout;
        assert.equal(restored.active, "n0", "Restore the selected historical file, not a different saved active tab");
        assert.equal(restored.main.children[1].children.length, 2, "Blocked layout siblings cannot trigger an Oath notice");
        assert.equal(restored.main.children[1].children[0].state.state.scroll, 27);
        assert.equal(savedLayout.main.children[1].children.length, 3, "Oath filtering must not mutate the stored snapshot");
        assert.equal(savedLayout.active, "n1");
    }
    {
        const f = setup(), [a] = f.contexts;
        const saved = { version: 3, projects: { a: { hubPath: a.path, lastNotePath: a.root + "/two.md",
            layout: layout(a, [a.root + "/one.md", a.root + "/two.md"]) } },
            lastWorkspaceId: "a", lastFile: { contextKind: "project", contextId: "a", path: a.root + "/one.md" } };
        const migrated = setup(saved), m = migrated.modes;
        assert.deepEqual(m.state.workspaceHistory, ["a"]);
        assert.deepEqual(m.state.fileHistory.map(e => e.path), [a.root + "/one.md", a.root + "/two.md"]);
        assert.equal(m.lastNoteFile(migrated.contexts[0]).path, saved.lastFile.path);
        assert.deepEqual(migrated.reload().state, m.state, "Migration is idempotent");
        m.handleDelete(new TFile(a.root));
        assert.deepEqual(migrated.reload().state.fileHistory, [], "Legacy pointers cannot resurrect deleted history");
        assert.deepEqual(migrated.reload().state.workspaceHistory, []);
        const resourceLegacy = setup({ lastFile: { contextKind: "resource", contextId: "study", path: "Resources/Knowledge/one.md" }, projects: {} });
        assert.equal(resourceLegacy.modes.state.fileHistory[0].contextId, "resource:study");
        const empty = setup({ version: 4, workspaceHistory: [], fileHistory: [], ...saved });
        assert.deepEqual(empty.modes.state.fileHistory, [], "Existing empty arrays win over old single-value state");
    }
    {
        const f = setup(), [a, b] = f.contexts, m = f.modes;
        m.rememberNote(a, f.files.get(a.root + "/one.md"));
        m.rememberNote(b, f.files.get(b.root + "/one.md"));
        f.files.delete(a.path); f.contexts.splice(f.contexts.indexOf(a), 1);
        assert.equal(await m.openLastFile(source(a)), false, "A deleted current workspace cannot broaden the scope");
        assert(!m.state.fileHistory.some(entry => entry.contextId === "a"));
        b.status = "future";
        assert.equal(await m.openLastFile(), false);
        assert.equal(notices.at(-1), "No recently opened files.");
        assert.equal(await m.openWorkspace(), false);
        assert.equal(notices.at(-1), "No recently opened workspaces.");
        b.status = "active";
        m.state.fileHistory.unshift(null, {}, { contextId: 3, path: 7 }, { contextId: "b", path: "missing.md" });
        m.state.workspaceHistory.unshift(null, "deleted");
        assert.equal(m.globalLastFile().path, b.root + "/one.md");
        assert.deepEqual(m.state.workspaceHistory, ["b"]);
        assert.equal(m.state.fileHistory.length, 1);
    }
    {
        const f = setup(), [a] = f.contexts, m = f.modes;
        for (let i = 0; i < HISTORY_LIMIT + 20; i++) m.rememberNote(a, f.add(a.root + `/note-${i}.md`));
        assert.equal(m.state.fileHistory.length, HISTORY_LIMIT);
        for (let i = 0; i < HISTORY_LIMIT + 20; i++) m.navigationHistory.rememberWorkspace({ projectId: String(i) });
        assert.equal(m.state.workspaceHistory.length, HISTORY_LIMIT);
        assert.equal(m.state.workspaceHistory[0], String(HISTORY_LIMIT + 19));
        assert.equal(m.state.fileHistory[0].path, a.root + `/note-${HISTORY_LIMIT + 19}.md`);
    }
    // The real Oath service, including its live shared-Resource policy, remains
    // the authority. No replica of its access rules is used by this fixture.
    {
        const oath = oathFixture();
        try {
            const f = setup(), m = f.modes;
            f.contexts.splice(0, f.contexts.length, ...oath.contexts, ...oath.resources);
            const [a, b] = oath.contexts, resource = oath.resources[0];
            f.plugin.projectWizard.getResourceById = id => oath.resources.find(c => c.projectId === id || c.resourceType === id);
            f.plugin.projectWizard.getResourceForPath = p => oath.resources.find(c => String(p).startsWith(c.root + "/"));
            f.plugin.projectWizard.data = oath.plugin.projectWizard.data;
            oath.plugin.projectWizard = f.plugin.projectWizard;
            for (const p of oath.files.keys()) f.add(p);
            oath.plugin.app.vault.getAbstractFileByPath = p => f.files.get(p);
            for (const c of f.contexts) f.add(c.path);
            const a1 = f.add(a.root + "/one.md"), b1 = f.add(b.root + "/one.md"), r1 = f.add(resource.root + "/one.md");
            const shared = f.add("Resources/Knowledge/Shared/note.md");
            a.resourceFolderIds = ["shared"];
            m.rememberNote(resource, r1); m.rememberNote(a, a1); m.rememberNote(b, b1);
            f.plugin.oath = oath.service;
            await oath.service.take(oath.draft());
            const before = clone(m.state), count = oath.notices.length;
            assert.equal(m.lastWorkspace().projectId, a.projectId);
            assert.equal(m.globalLastFile(), a1);
            assert.deepEqual(m.state.workspaceHistory, before.workspaceHistory);
            assert.deepEqual(m.state.fileHistory, before.fileHistory);
            await m.openLastFile(source(a));
            assert.equal(f.opened.at(-1).file, a1);
            assert.equal(oath.notices.length, count);
            m.rememberNote(a, shared);
            assert.equal(m.lastNoteFile(a), shared, "Canonical Project Oath allows shared file in Project context");
            const history = clone(m.state.fileHistory);
            a.resourceFolderIds = [];
            assert.equal(m.lastNoteFile(a), a1);
            assert.deepEqual(m.state.fileHistory, history);
            a.resourceFolderIds = ["shared"];
            assert.equal(m.lastNoteFile(a), shared);
            assert.equal(await m.openFile(b1.path), false, "Direct prohibited navigation still uses the guard");
            assert.equal(oath.notices.at(-1), "Locked during this Oath");
            await oath.service.end(oath.service.current.id, "broken");
            assert.deepEqual(m.state.fileHistory, history);
            // A Resource Oath uses the very same resolver and histories.
            const ref = { type: "resource", id: resource.resourceType };
            const taskPath = resource.root + "/Tasks.md";
            oath.files.set(taskPath, "- [ ] Resource task\n"); f.add(taskPath);
            await oath.service.take(oath.draft({ workspace: ref, tasks: oath.service.workspaceTasks(ref) }));
            assert.equal(m.lastWorkspace(), resource);
            assert.equal(m.globalLastFile(), r1);
            assert.equal(m.lastNoteFile(a), null);
            assert.deepEqual(m.state.fileHistory, history);
        } finally { oath.destroy(); }
    }
    // Exercise the canonical vault data store boundary and reload, with a
    // localStorage implementation that fails if navigation tries to use it.
    {
        const f = setup(), [a] = f.contexts;
        global.localStorage = { getItem() { throw Error("Navigation must use data.json"); }, setItem() { throw Error("Navigation must use data.json"); } };
        let disk;
        f.plugin.projectWizard.data = { workspaceMode: emptyWorkspaceState() };
        f.plugin.dataStore = { async save(data) { disk = clone(data); } };
        f.plugin.workspaceState = new HubWorkspaceState(f.plugin);
        const m = new Modes(f.plugin);
        m.rememberNote(a, f.files.get(a.root + "/one.md"));
        await f.plugin.workspaceState.pending;
        f.plugin.projectWizard.data = clone(disk);
        const reload = new Modes(f.plugin);
        assert.deepEqual(reload.state.fileHistory, m.state.fileHistory);
        assert.deepEqual(reload.state.workspaceHistory, [a.projectId]);
        delete global.localStorage;
    }
    console.log("PASS: MRU ordering/bounds, context isolation, temporary filters, deletion/rename, migration/reload, Note layouts, canonical Project/shared-Resource/Resource Oath access and direct guards.");
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = original; });
