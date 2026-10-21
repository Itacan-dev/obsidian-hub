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
