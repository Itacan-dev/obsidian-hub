"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), Module = require("node:module");
const file = path.resolve(__dirname, "../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-host.js");
const { authorizeNativeTaskRehearsal, createNativeTaskHost } = require(file);
async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-startup-test-"));
    for (const name of ["vault", "native"]) await fs.mkdir(path.join(root, name));
    const documentBefore = global.document; if (!global.document) global.document = new EventTarget();
    const stops = [], events = new Set(), calls = [];
    let project = { projectId: "synthetic", contextKind: "project", root: "Projects/Synthetic", path: "Projects/Synthetic/Dashboard.md", status: "active" };
    const original = name => (...args) => { calls.push([name, ...args]); return name; };
    const plugin = { app: { vault: { adapter: { getBasePath: () => path.join(root, "vault") }, getMarkdownFiles: () => [], on: (_event, callback) => { const ref = { callback }; events.add(ref); return ref; }, offref: ref => events.delete(ref) } },
        register: fn => stops.push(fn), projectWizard: { data: {}, completedTaskHistory: [], getProjectById: () => project, getProjectRecords: () => [project], getContextForPath: p => p?.startsWith(project.root + "/") ? project : null },
        taskEditor: Object.fromEntries(["file", "destination", "create", "save"].map(n => [n, original(n)])), taskData: { readPages: () => [{ file: { path: project.path } }, { file: { path: "Resources/Knowledge/Tasks.md" } }] },
        mutateTask: original("mutate"), performClearCompletedTasks: original("clear"), planning: { project: original("planning") }, inbox: { makeTask: original("inbox"), taskDestination: original("destination"), taskLocations: () => ["legacy"], required: () => ({ intent: { workspaceId: "synthetic" } }) },
        oath: { take: original("oath"), resolveWorkspace: ref => ref, workspaces: () => [project, { contextKind: "resource", projectId: "knowledge" }] } };
    const configuration = { version: 1, syntheticOnly: true, root, owner: { type: "project", id: project.projectId }, projectRoot: project.root, dashboard: project.path, partitionId: "private", rehearsalId: crypto.randomUUID(), creating: true,
        config: { version: 1, scope: "inactive-disposable", storageFormat: "private-v4", directory: path.join(root, "native"), authorityId: crypto.randomUUID(), applicationContextId: "test-context", registryId: "test-registry" } };
    let host; t.after(async () => { await host?.close(); assert.equal(events.size, 0); global.document = documentBefore; });
    return { root, plugin, configuration, calls, events, get host() { return host; }, async start() { await authorizeNativeTaskRehearsal(plugin, configuration); host = createNativeTaskHost(plugin); host.guardUnsupported(); await host.ready; return host; }, change(fn) { fn(project); events.forEach(e => e.callback()); } };
}
test("default host construction imports no native module, acquires no resources and mutates no service", () => {
    const old = Module._load, imports = []; Module._load = function (name) { imports.push(name); return old.apply(this, arguments); };
    const plugin = Object.freeze({}); try { assert.equal(createNativeTaskHost(plugin), null); assert.deepEqual(imports, []); } finally { Module._load = old; }
});
test("synthetic authorization rejects live/outside roots, overlapping storage and existing Markdown checkboxes", async t => {
    const f = await fixture(t);
    await assert.rejects(authorizeNativeTaskRehearsal(f.plugin, { ...f.configuration, root: path.dirname(process.cwd()) }));
    await assert.rejects(authorizeNativeTaskRehearsal(f.plugin, { ...f.configuration, config: { ...f.configuration.config, directory: path.join(f.root, "vault") } }));
    f.plugin.app.vault.getMarkdownFiles = () => [{ path: f.configuration.dashboard }]; f.plugin.app.vault.read = async () => "- [ ] Existing checkbox";
    await assert.rejects(authorizeNativeTaskRehearsal(f.plugin, f.configuration), /no Markdown tasks/);
    assert.deepEqual(await fs.readdir(f.configuration.config.directory), []);
});
test("selected-owner guards precede side effects; legacy Resource and Project paths retain their behavior", async t => {
    const f = await fixture(t), host = await f.start(); assert.equal(host.status().state, "ready");
    assert.throws(() => f.plugin.taskEditor.create(f.configuration.dashboard), /unavailable/);
    assert.throws(() => f.plugin.taskEditor.save({ file: { path: "Projects/Other/Tasks.md" } }, { location: f.configuration.dashboard }), /unavailable/);
    assert.throws(() => f.plugin.mutateTask({ path: f.configuration.dashboard }), /unavailable/);
    assert.throws(() => f.plugin.performClearCompletedTasks([{ nativeReference: { owner: f.configuration.owner } }]), /unavailable/);
    assert.throws(() => f.plugin.inbox.makeTask({}, "capture"), /unavailable/);
    assert.throws(() => f.plugin.inbox.taskDestination({ workspaceId: "synthetic" }), /unavailable/);
    assert.deepEqual(f.plugin.inbox.taskLocations("synthetic"), []); assert.deepEqual(f.plugin.inbox.taskLocations("other"), ["legacy"]);
    assert.throws(() => f.plugin.oath.take({ workspace: f.configuration.owner }), /unavailable/);
    assert.throws(() => f.plugin.planning.project("synthetic"), /unavailable/);
    assert.equal(f.calls.length, 0); assert.equal(f.plugin.oath.resolveWorkspace(f.configuration.owner), null);
    assert.equal(f.plugin.oath.workspaces("project").length, 1);
    assert.deepEqual(f.plugin.taskData.readPages().map(p => p.file.path), ["Resources/Knowledge/Tasks.md"]);
    assert.equal(f.plugin.taskEditor.create("Resources/Knowledge/Tasks.md"), "create"); assert.equal(f.plugin.mutateTask({ path: "Projects/Other/Tasks.md" }), "mutate");
});
test("live owner-context change rejects native reads and never releases selected owner to legacy", async t => {
    const f = await fixture(t), host = await f.start(); assert.equal((await host.runtime().list()).tasks.length, 0);
    f.change(p => p.root = "Projects/Renamed"); await assert.rejects(host.runtime().list()); await assert.rejects(host.completionFeed.read());
    assert.throws(() => f.plugin.taskEditor.create(f.configuration.dashboard)); assert.equal(f.calls.length, 0);
});
test("changing the application vault identity cannot retain accepted native context", async t => {
    const f = await fixture(t), host = await f.start(); assert.equal(host.status().state, "ready");
    f.plugin.app.vault.adapter.getBasePath = () => f.root;
    await assert.rejects(host.runtime().list()); await assert.rejects(host.completionFeed.read());
    assert.throws(() => f.plugin.mutateTask({ projectId: f.configuration.owner.id })); assert.equal(f.calls.length, 0);
});
test("duplicate Project identity is unavailable rather than selecting the first dashboard", async t => {
    const f = await fixture(t), host = await f.start(); assert.equal(host.status().state, "ready");
    const p = f.plugin.projectWizard.getProjectById(); f.plugin.projectWizard.getProjectRecords = () => [p, { ...p, root: "Projects/Copy", path: "Projects/Copy/Dashboard.md" }];
    await assert.rejects(host.runtime().list()); assert.throws(() => f.plugin.taskEditor.create(p.path));
});
test("failed open is unavailable, retains exclusive routing and does not poison later ordinary startup", async t => {
    const f = await fixture(t); f.configuration.creating = false; const host = await f.start(); assert.equal(host.status().state, "unavailable");
    const panel = host.nativeTasks.createPanelRead({ component: { register() {} } }); assert.equal((await panel.read()).availability, "unavailable");
    assert.throws(() => host.runtime()); assert.throws(() => panel.create()); await assert.rejects(host.completionFeed.read());
    assert.throws(() => f.plugin.mutateTask({ path: f.configuration.dashboard })); assert.equal(f.calls.length, 0);
    await host.close(); assert.equal(createNativeTaskHost({}), null);
});
test("duplicate ownership fails closed and clean close releases the existing lease", async t => {
    const f = await fixture(t), first = await f.start(); assert.equal(first.status().state, "ready");
    const other = await fixture(t); other.configuration.config = { ...f.configuration.config }; other.configuration.root = f.root; other.plugin.app.vault.adapter.getBasePath = () => path.join(f.root, "vault"); other.configuration.creating = false;
    const second = await other.start(); assert.equal(second.status().state, "unavailable");
    assert.equal((await first.runtime().list()).tasks.length, 0); await second.close(); await first.close();
    assert(!(await fs.readdir(f.configuration.config.directory)).includes("WRITER.lock"));
});
test("shutdown during initialization drains host construction and prevents late ready publication", async t => {
    const f = await fixture(t); await authorizeNativeTaskRehearsal(f.plugin, f.configuration); const host = createNativeTaskHost(f.plugin); const closing = host.close(); await closing;
    assert.equal(host.status().state, "closed"); assert.throws(() => host.runtime()); assert(!(await fs.readdir(f.configuration.config.directory)).includes("WRITER.lock"));
});

test("first-start layout readiness keeps guards immediate and promotes existing consumers once", async t => {
    const f = await fixture(t), callbacks = [];
    f.plugin.app.workspace = { layoutReady: false, onLayoutReady: fn => callbacks.push(fn) };
    await authorizeNativeTaskRehearsal(f.plugin, f.configuration); const host = createNativeTaskHost(f.plugin);
    let panels = 0, history = 0;
    const panel = host.nativeTasks.createPanelRead({ plugin: f.plugin, component: { register() {} }, workspace: f.configuration.owner, changed: () => panels++ });
    const stop = host.completionFeed.subscribe(() => history++);
    assert.equal(host.status().state, "opening"); assert.throws(() => f.plugin.mutateTask({ path: f.configuration.dashboard }));
    assert.equal((await panel.read()).availability, "loading"); assert.deepEqual(await fs.readdir(f.configuration.config.directory), []);
    f.plugin.app.workspace.layoutReady = true; callbacks[0](); callbacks[0](); await host.ready;
    assert.equal(host.status().state, "ready"); assert.equal((await panel.read()).availability, "current"); assert(panels > 0 && history > 0);
    assert.equal((await fs.readdir(f.configuration.config.directory)).filter(n => n.startsWith("gen-")).length, 1);
    stop(); panel.close(); await host.close();
});

test("readiness arriving during callback registration is not lost", async t => {
    const f = await fixture(t); f.plugin.app.workspace = { layoutReady: false, onLayoutReady(fn) { this.layoutReady = true; fn(); fn(); } };
    const host = await f.start(); assert.equal(host.status().state, "ready"); await host.close();
});

test("a synchronous subscription refresh cannot reenter lazy panel construction", async t => {
    const f = await fixture(t), host = await f.start(); let changes = 0, nested;
    const panel = host.nativeTasks.createPanelRead({ plugin: f.plugin, component: { register() {} }, workspace: f.configuration.owner,
        changed() { changes++; if (changes === 1) nested = panel.read(); } });
    assert.equal((await panel.read()).availability, "current"); await nested; assert.equal(changes, 1); panel.close(); await host.close();
});

test("unload cancels pending layout initialization without acquiring a writer", async t => {
    const f = await fixture(t); let layout;
    f.plugin.app.workspace = { layoutReady: false, onLayoutReady: fn => { layout = fn; } };
    await authorizeNativeTaskRehearsal(f.plugin, f.configuration); const host = createNativeTaskHost(f.plugin);
    await host.close(); layout(); assert.equal(host.status().state, "closed"); assert.deepEqual(await fs.readdir(f.configuration.config.directory), []);
});

test("metadata event readiness rechecks after registration and removes its subscriptions", async t => {
    const f = await fixture(t), file = { path: f.configuration.dashboard }, listeners = new Map(); let indexed = false;
    f.plugin.app.workspace = { layoutReady: true, onLayoutReady() { throw Error("already ready"); } };
    f.plugin.app.vault.getAbstractFileByPath = () => file;
    f.plugin.app.metadataCache = { getFileCache: () => indexed ? {} : null, on(name, fn) { listeners.set(name, fn); if (name === "resolved") { indexed = true; fn(); } return name; }, offref: ref => listeners.delete(ref) };
    const host = await f.start(); assert.equal(host.status().state, "ready"); assert.equal(listeners.size, 0); await host.close();
});

test("unload cancels pending metadata readiness and ignores later events", async t => {
    const f = await fixture(t), listeners = new Map(), file = { path: f.configuration.dashboard };
    f.plugin.app.vault.getAbstractFileByPath = () => file;
    f.plugin.app.metadataCache = { getFileCache: () => null, on(name, fn) { listeners.set(name, fn); return name; }, offref: ref => listeners.delete(ref) };
    await authorizeNativeTaskRehearsal(f.plugin, f.configuration); const host = createNativeTaskHost(f.plugin); await Promise.resolve();
    assert.equal(listeners.size, 2); await host.close(); assert.equal(listeners.size, 0); assert.deepEqual(await fs.readdir(f.configuration.config.directory), []);
});

test("genuine owner failure after readiness stays unavailable with no legacy fallback", async t => {
    const f = await fixture(t); let layout;
    f.plugin.app.workspace = { layoutReady: false, onLayoutReady: fn => { layout = fn; } };
    await authorizeNativeTaskRehearsal(f.plugin, f.configuration); const host = createNativeTaskHost(f.plugin);
    f.change(p => p.status = "archived"); f.plugin.app.workspace.layoutReady = true; layout(); await host.ready;
    assert.equal(host.status().state, "unavailable"); assert.throws(() => f.plugin.mutateTask({ path: f.configuration.dashboard })); await host.close();
});

test("Obsidian quit Tasks drains once across repeated requests and releases its lock", async t => {
    const f = await fixture(t), listeners = new Map(), promises = [];
    f.plugin.app.workspace = { layoutReady: true, onLayoutReady() {}, on(name, fn) { listeners.set(name, fn); return name; }, offref: ref => listeners.delete(ref) };
    const host = await f.start(); assert((await fs.readdir(f.configuration.config.directory)).includes("WRITER.lock"));
    const quit = listeners.get("quit"), tasks = { add(fn) { promises.push(fn()); } };
    quit(tasks); quit(tasks); assert.throws(() => host.runtime()); await Promise.all(promises);
    assert.equal(host.status().state, "closed"); assert.equal(listeners.size, 0); assert(!(await fs.readdir(f.configuration.config.directory)).includes("WRITER.lock")); await host.close();
});

test("quit during pending initialization cancels admission and drains without a lease", async t => {
    const f = await fixture(t), listeners = new Map(), promises = []; let layout;
    f.plugin.app.workspace = { layoutReady: false, onLayoutReady: fn => { layout = fn; }, on(name, fn) { listeners.set(name, fn); return name; }, offref: ref => listeners.delete(ref) };
    await authorizeNativeTaskRehearsal(f.plugin, f.configuration); const host = createNativeTaskHost(f.plugin);
    listeners.get("quit")({ add(fn) { promises.push(fn()); } }); await Promise.all(promises); layout();
    assert.equal(host.status().state, "closed"); assert.equal(listeners.size, 0); assert.deepEqual(await fs.readdir(f.configuration.config.directory), []);
});

test("quit Tasks waits for an accepted published write before releasing the lease", { timeout: 10000 }, async t => {
    const f = await fixture(t), listeners = new Map(), promises = []; let release, reached, armed = false;
    const held = new Promise(resolve => { release = resolve; }), published = new Promise(resolve => { reached = resolve; });
    f.plugin.app.workspace = { layoutReady: true, onLayoutReady() {}, on(name, fn) { listeners.set(name, fn); return name; }, offref: ref => listeners.delete(ref) };
    const load = Module._load;
    Module._load = function (name) {
        const actual = load.apply(this, arguments);
        if (!name.endsWith("ItacanTaskCore/integration/project-runtime")) return actual;
        return { ...actual, openProjectRuntime: (config, options) => actual.openProjectRuntime(config, { ...options, repositoryOptions: { fault: async stage => {
            if (armed && stage === "beforeAcknowledgement") { reached(); await held; }
        } } }) };
    };
    let host;
    try { host = await f.start(); } finally { Module._load = load; }
    try {
        const runtime = host.runtime(), form = runtime.formService({}), values = { text: "Accepted before quit", completed: false, steps: [] };
        armed = true; const operation = form.create(form.formContext().destination, values.text, values); await published;
        listeners.get("quit")({ add(fn) { promises.push(fn()); } }); let drained = false; Promise.all(promises).then(() => { drained = true; });
        await Promise.resolve(); assert(!drained); assert((await fs.readdir(f.configuration.config.directory)).includes("WRITER.lock"));
        release(); const outcome = await operation; await Promise.all(promises);
        assert.equal(outcome.outcome.status, "committed"); assert.equal(host.status().state, "closed"); assert(!(await fs.readdir(f.configuration.config.directory)).includes("WRITER.lock"));
        const repo = await require("../../src/json-repository").openJsonRepository({ directory: f.configuration.config.directory, storageFormat: "private-v4", expectedAuthorityId: f.configuration.config.authorityId });
        try { const snapshot = await repo.readSnapshot({ version: 1, authorityId: f.configuration.config.authorityId, owners: [f.configuration.owner], selection: "tasks" }); assert.equal(snapshot.tasks.length, 1); assert.equal(snapshot.tasks[0].title, values.text); } finally { await repo.close(); }
    } finally { release(); await host.close(); }
});

test("native Legacy-read exclusion resolves each physical owner once instead of once per page", async t => {
    const f = await fixture(t); let contextReads = 0, projectReads = 0;
    const context = f.plugin.projectWizard.getContextForPath, project = f.plugin.projectWizard.getProjectById;
    f.plugin.projectWizard.getContextForPath = (...a) => { contextReads++; return context(...a); };
    f.plugin.projectWizard.getProjectById = (...a) => { projectReads++; return project(...a); };
    const pages = Array.from({length: 2000}, (_, i) => ({file:{path:i % 2 ? "Resources/Knowledge/"+i+".md" : "Projects/Synthetic/"+i+".md"}}));
    f.plugin.taskData.readPages = () => pages; const h = await f.start(); contextReads = projectReads = 0;
    const kept = f.plugin.taskData.readPages(); assert.equal(kept.length,1000); assert.equal(contextReads,0); assert.equal(projectReads,1);
    assert.equal(h.status().state,"ready"); f.change(p => p.root = "Projects/Moved"); contextReads = projectReads = 0;
    f.plugin.taskData.readPages(); assert.equal(contextReads,0); assert.equal(projectReads,1);
});
