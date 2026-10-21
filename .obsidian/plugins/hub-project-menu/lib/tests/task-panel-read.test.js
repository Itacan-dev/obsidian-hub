"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createPanelFixture, panelFacts } = require("./task-panel-fixture.cjs");
const { legacyReadTask } = require("../services/task-service-legacy-bridge");
const { createTaskPanelRead } = require("../services/task-panel-read");
const baseline = require("./task-panel-baseline.json");
const workspaceRef = owner => ({ type: owner.contextKind === "resource" ? "resource" : "project", id: owner.resourceType ?? owner.projectId });
function panel(f, owner = f.projects[0], service = f.plugin.taskService) {
    const cleanups = [], component = { register: fn => cleanups.push(fn) };
    const original = f.plugin.taskService; f.plugin.taskService = service;
    const reader = createTaskPanelRead({ plugin: f.plugin, component, workspace: workspaceRef(owner), changed() {}, editTask() {} });
    f.plugin.taskService = original;
    return { reader, close: () => cleanups.reverse().forEach(fn => fn()) };
}
for (const record of baseline) test("panel recursive original data/group/order parity: " + record.owner, async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const before = f.state(), owner = f.workspaces.find(item => item.projectId === record.owner);
    const query = await f.plugin.taskService.queryStructured({ workspace: workspaceRef(owner), policy: "panel" });
    assert.deepEqual(panelFacts(query.rows.filter(row => row.view).map(row => legacyReadTask(row.view)), f.now()), record.facts);
    assert.equal(f.state(), before); assert.equal(f.counts.sources, 0); assert.equal(f.counts.writes, 0); assert.equal(f.counts.indexes, 1);
    assert(query.rows.every(row => row.view.owner.id === workspaceRef(owner).id));
});
test("panel includes physical System/Templates/hidden paths while Schedule and mounted Resource ownership remain unchanged", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const service = f.plugin.taskService, workspace = { type: "project", id: "app" };
    const panel = await service.queryStructured({ workspace, policy: "panel" }), schedule = await service.queryStructured({ workspace, policy: "workspace" });
    for (const name of ["System", "Templates", ".hidden"]) {
        assert(panel.rows.some(row => row.view.source.path.includes("/" + name + "/")));
        assert(!schedule.rows.some(row => row.view.source.path.includes("/" + name + "/")));
    }
    assert(!panel.rows.some(row => row.view.title === "Mounted resource"));
    await assert.rejects(service.queryStructured({ policy: "mounted" }), { code: "VALIDATION" });
});
test("copied IDs, copied Steps, same-title locators and metadata failures retain rows but cannot become actionable", async t => {
    const f = createPanelFixture(); t.after(() => f.close());
    f.addTask("Projects/App/Copy.md", "Copy", "rich");
    f.addTask("Projects/App/StepCopy.md", "Step copy", "step-copy", { steps: [{ title: "Copied Step", id: "parent" }] });
    f.addTask("Projects/App/NoId.md", "Same"); f.addTask("Projects/App/NoId.md", "Same");
    const original = f.plugin.taskData.metadata;
    f.plugin.taskData.metadata = id => { if (id === "timed") throw Error("Metadata offline"); return original(id); };
    const q = await f.plugin.taskService.queryStructured({ workspace: { type: "project", id: "app" }, policy: "panel" });
    assert(q.rows.filter(row => row.state === "ambiguous").length >= 4);
    for (const row of q.rows.filter(row => ["ambiguous", "unresolved"].includes(row.state))) {
        assert(row.view); assert.equal(row.view.capabilities.attemptReveal, false);
    }
    assert(q.rows.some(row => row.view?.title === "Overdue" && row.state === "indexed")); assert.equal(f.counts.writes, 0);
});
test("panel query recovers after unavailable index and isolates malformed tasks", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const p = panel(f); t.after(p.close);
    const first = await p.reader.read(); p.reader.accept(first.tasks); f.dv.index.initialized = false;
    f.plugin.taskData.invalidateAll(); f.flush(); await assert.rejects(p.reader.read(), { code: "INDEX_UNAVAILABLE" });
    f.dv.index.initialized = true; f.pages.values().next().value.file.tasks.push(null, { text: 13 });
    f.plugin.taskData.invalidateAll(); f.flush(); const next = await p.reader.read();
    assert.equal(next.tasks.length, first.tasks.length); assert(next.diagnostics.length >= 2);
});
test("invalid parent or Step locators retain trustworthy display without manufacturing actionable references", async t => {
    const f = createPanelFixture(); t.after(() => f.close());
    const invalid = f.addTask("Projects/App/Invalid.md", "Readable invalid parent", "invalid-parent"); invalid.line = undefined;
    const child = f.addTask("Projects/App/BadStep.md", "Readable parent", "bad-step-parent", { steps: [{ title: "Readable Step", id: "bad-step" }] });
    child.children[0].line = undefined;
    const p = panel(f); t.after(p.close); const result = await p.reader.read();
    const task = result.tasks.find(task => task.text === "Readable invalid parent"), parent = result.tasks.find(task => task.text === "Readable parent");
    assert(task && parent); assert.equal(task.line, undefined); assert(task.identityConflict && parent.identityConflict);
    assert.equal(parent.steps[0].text, "Readable Step");
    await assert.rejects(p.reader.toggle(task, true), { code: "AMBIGUOUS_REFERENCE" });
    assert.equal(f.counts.writes, 0);
});
test("panel generations cancel old reads after local reconciliation and retain the immediate state until import", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const actual = f.plugin.taskService;
    let release, hold = false;
    const service = { subscribe: actual.subscribe.bind(actual), queryStructured: async options => {
        const result = await actual.queryStructured(options); if (hold) await new Promise(resolve => { release = resolve; }); return result;
    } };
    const p = panel(f, f.projects[0], service); t.after(p.close);
    const first = await p.reader.read(); p.reader.accept(first.tasks); const task = first.tasks[0];
    f.plugin.taskData.invalidateAll(); f.flush(); hold = true; const stale = p.reader.read();
    while (!release) await Promise.resolve();
    const edit = { path: task.path, line: task.line, requestLine: task.line, oldText: task.text, hubTaskId: task.hubTaskId,
        tasks: [{ ...task, completed: true, status: "x" }], lineDelta: 0 };
    const immediate = p.reader.reconcile(first.tasks, edit); release(); assert.equal(await stale, null); hold = false;
    const lagged = await p.reader.read(); assert(lagged.tasks[0].completed); assert.equal(lagged.changed, false);
    f.pages.get(task.path).file.tasks[0].completed = true; f.plugin.taskData.invalidateAll(); f.flush();
    assert((await p.reader.read()).tasks[0].completed);
    f.pages.get(task.path).file.tasks[0].completed = false; f.plugin.taskData.invalidateAll(); f.flush();
    assert.equal((await p.reader.read()).tasks[0].completed, false, "A later imported external edit wins after acknowledgment");
    assert(immediate[0].completed); assert.equal(f.counts.writes, 0);
});
test("out-of-order Project/Resource loads, disposal and repeated sessions share one backend watcher", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const actual = f.plugin.taskService;
    let release; const service = { subscribe: actual.subscribe.bind(actual), queryStructured: async options => {
        const result = await actual.queryStructured(options); if (options.workspace.type === "project") await new Promise(resolve => { release = resolve; }); return result;
    } };
    const a = panel(f, f.projects[0], service), pending = a.reader.read(); while (!release) await Promise.resolve();
    a.close(); const resource = panel(f, f.resources[0], service); const result = await resource.reader.read();
    assert(result.tasks.every(task => task.path.startsWith("Resources/Knowledge/"))); release(); assert.equal(await pending, null);
    assert.equal(f.plugin.taskData.subscribers.size, 1); resource.close();
    for (let i = 0; i < 20; i++) { const x = panel(f); await x.reader.read(); x.close(); }
    assert.equal(f.plugin.taskData.subscribers.size, 0);
});
test("pending note reconciliation cannot resurrect a renamed or deleted source", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const p = panel(f); t.after(p.close);
    const first = await p.reader.read(), task = first.tasks[0]; p.reader.reconcile(first.tasks, {
        path: task.path, line: task.line, requestLine: task.line, oldText: task.text, tasks: [{ ...task, completed: true }], lineDelta: 0 });
    f.files.delete(task.path); f.plugin.taskData.invalidateAll(); f.flush();
    assert(!(await p.reader.read()).tasks.some(item => item.path === task.path));
});
test("legacy editor reconciliation cannot retain tasks moved outside the physical workspace", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const p = panel(f); t.after(p.close);
    const first = await p.reader.read(), task = first.tasks[0], path = "Resources/Knowledge/Moved.md";
    const next = p.reader.reconcile(first.tasks, { path: task.path, line: task.line, requestLine: task.line, oldText: task.text,
        movedTo: { path, line: 0 }, tasks: [{ ...task, path, line: 0 }], lineDelta: 0 });
    assert(!next.some(item => item.path === path)); assert(!(await p.reader.read()).tasks.some(item => item.path === path));
});
test("an imported external removal before local acknowledgment supersedes retained note evidence", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const p = panel(f); t.after(p.close);
    const first = await p.reader.read(), task = first.tasks[0];
    f.contents.set(task.path, f.contents.get(task.path).replace("[ ]", "[x]"));
    p.reader.reconcile(first.tasks, { path: task.path, line: task.line, requestLine: task.line, oldText: task.text,
        tasks: [{ ...task, completed: true }], lineDelta: 0 });
    await Promise.resolve(); await Promise.resolve();
    f.contents.set(task.path, "# Removed externally\n"); f.pages.get(task.path).file.tasks = [];
    f.plugin.taskData.invalidateAll(); f.flush();
    assert(!(await p.reader.read()).tasks.some(item => item.path === task.path));
});
test("panel integration has no independent raw enumeration, native import or duplicate host", () => {
    const root = path.resolve(__dirname, "../../../../.."), text = fs.readFileSync(path.join(root, "System/Dashboards/Project/view.js"), "utf8");
    const section = text.slice(text.indexOf("// ---------- CURRENT TASKS ----------"), text.indexOf("// ---------- PROGRESS ----------"));
    assert(!section.includes("readPages(") && !section.includes(".pages(") && !section.includes(".subscribe("));
    assert(section.includes("taskPanelRead.reconcile") && section.includes(".defer("));
    const plugin = fs.readFileSync(path.join(__dirname, "../../plugin.js"), "utf8");
    assert.equal((plugin.match(/createLegacyTaskService\(this\)/g) ?? []).length, 1);
});
test("multiple windows and retired panels use one plugin cleanup registration; unload closes active sessions", async t => {
    const f = createPanelFixture(); t.after(() => f.close());
    const original = f.plugin.register, registrations = [];
    f.plugin.register = close => { registrations.push(close); original(close); };
    for (let index = 0; index < 20; index++) { const view = panel(f); await view.reader.read(); view.close(); }
    const a = panel(f), resource = panel(f, f.resources[0]); await Promise.all([a.reader.read(), resource.reader.read()]);
    assert.equal(registrations.length, 1); assert.equal(f.plugin.taskData.subscribers.size, 1);
    registrations[0](); assert.equal(f.plugin.taskData.subscribers.size, 0);
    assert.equal(await a.reader.read(), null); assert.equal(await resource.reader.read(), null);
});
test("a Phase rename refreshes card labels even when indexed task fields are unchanged", async t => {
    const f = createPanelFixture(); t.after(() => f.close()); const p = panel(f); t.after(p.close);
    const first = await p.reader.read(); p.reader.accept(first.tasks);
    f.plugin.planning.phaseFor = task => task.phaseId === "phase" ? { name: "Renamed Phase" } : null;
    f.plugin.taskData.invalidateAll(); f.flush(); const next = await p.reader.read();
    assert.equal(next.changed, true); assert(next.tasks.some(task => task.taskPanelPhaseLabel === "Renamed Phase"));
});
