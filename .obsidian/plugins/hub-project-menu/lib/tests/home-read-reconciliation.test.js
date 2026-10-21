"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { createHomeFixture, homeOwnerResolver } = require("./home-read-fixture.cjs");
const { createHomeTaskRead } = require("../services/home-task-read");
function connect(f, changed = () => {}) { const callbacks = []; const reader = createHomeTaskRead({ plugin: f.plugin,
    component: { register: fn => callbacks.push(fn) }, resolveOwner: homeOwnerResolver(f), changed, editTask() {} });
    return { reader, close: () => callbacks.forEach(fn => fn()) }; }
function edit(task, values) { return { path: task.path, line: task.line, requestLine: task.line, oldText: task.text,
    hubTaskId: task.hubTaskId, tasks: [{ ...task, text: task.text.split("\n")[0], ...values }], lineDelta: 0 }; }
for (const kind of ["complete", "step", "inline"]) test("Home immediate " + kind + " survives old query and delayed import, then retires on acknowledgment", async t => {
    const f = createHomeFixture(); t.after(() => f.close()); const actual = f.plugin.taskService;
    let release, hold = false;
    f.plugin.taskService = { subscribe: actual.subscribe.bind(actual), close: actual.close.bind(actual), queryStructured: async options => {
        const result = await actual.queryStructured(options); if (hold) await new Promise(resolve => { release = resolve; }); return result;
    } };
    const c = connect(f); t.after(c.close); const a = await c.reader.read(); c.reader.accept(a.items);
    const task = a.items.find(item => item.task.hubTaskId === "assignment").task;
    f.plugin.taskData.invalidateAll(); f.flush(); hold = true; const stale = c.reader.read(); while (!release) await Promise.resolve();
    const values = kind === "complete" ? { completed: true } : kind === "step" ? { steps: task.steps.map(step => ({ ...step, completed: true })) } : { text: "Edited title" };
    const result = c.reader.reconcile(a.items, edit(task, values)); release(); assert.equal(await stale, null); hold = false;
    const b = await c.reader.read(), immediate = b.items.find(item => item.task.hubTaskId === "assignment").task;
    assert.equal(b.changed, false); assert.equal(immediate.completed, kind === "complete");
    if (kind === "step") assert(immediate.steps.every(step => step.completed));
    if (kind === "inline") assert.equal(immediate.text, values.text + "\ncontinuation evidence");
    const indexed = f.pages.get(task.path).file.tasks[0];
    if (kind === "complete") indexed.completed = true;
    if (kind === "step") indexed.children.forEach(step => { step.completed = true; });
    if (kind === "inline") indexed.text = "Edited title <!-- hub-task:assignment -->\ncontinuation evidence";
    f.plugin.taskData.invalidateAll(); f.flush(); await c.reader.read();
    if (kind === "complete") indexed.completed = false;
    if (kind === "step") indexed.children[0].completed = false;
    if (kind === "inline") indexed.text = "External title <!-- hub-task:assignment -->";
    f.plugin.taskData.invalidateAll(); f.flush(); const external = (await c.reader.read()).items.find(item => item.task.hubTaskId === "assignment").task;
    if (kind === "complete") assert.equal(external.completed, false);
    if (kind === "step") assert.equal(external.steps[0].completed, false);
    if (kind === "inline") assert.equal(external.text, "External title");
    assert(result.length); assert.equal(f.counts.writes, 0);
});
test("external source removal supersedes the temporary local overlay before acknowledgment", async t => {
    const f = createHomeFixture(), c = connect(f); t.after(async () => { c.close(); await f.close(); });
    const a = await c.reader.read(), task = a.items[0].task;
    f.contents.set(task.path, "- [x] Saved\n"); c.reader.reconcile(a.items, edit(task, { completed: true }));
    await Promise.resolve(); await Promise.resolve(); f.contents.set(task.path, "# Removed externally\n"); f.pages.get(task.path).file.tasks = [];
    f.plugin.taskData.invalidateAll(); f.flush(); assert(!(await c.reader.read()).items.some(item => item.task.path === task.path));
});
test("source deletion and cross-root moves cannot resurrect pending Home rows", async t => {
    const f = createHomeFixture(), c = connect(f); t.after(async () => { c.close(); await f.close(); });
    const a = await c.reader.read(), task = a.items[0].task; c.reader.reconcile(a.items, edit(task, { completed: true }));
    f.files.delete(task.path); f.plugin.taskData.invalidateAll(); f.flush(); assert(!(await c.reader.read()).items.some(item => item.task.path === task.path));
});
test("clear overlay cannot resurrect a completed row while canonical import lags", async t => {
    const f = createHomeFixture(), c = connect(f); t.after(async () => { c.close(); await f.close(); });
    const a = await c.reader.read(), task = a.items.find(item => item.task.hubTaskId === "completed").task;
    const remaining = a.items.filter(item => item.task !== task); c.reader.remember(remaining, [task.path]);
    assert(!(await c.reader.read()).items.some(item => item.task.hubTaskId === "completed"));
    f.pages.get(task.path).file.tasks = []; f.plugin.taskData.invalidateAll(); f.flush(); await c.reader.read();
    f.addTask(task.path, "External replacement", "replacement"); f.plugin.taskData.invalidateAll(); f.flush();
    assert((await c.reader.read()).items.some(item => item.task.hubTaskId === "replacement"));
});
test("plugin unload closes multiple Home windows with one cleanup registration and leaves shared service alive", async t => {
    const f = createHomeFixture(); t.after(() => f.close()); const registrations = []; f.plugin.register = fn => registrations.push(fn);
    for (let index = 0; index < 20; index++) { const c = connect(f); await c.reader.read(); c.close(); }
    const a = connect(f), b = connect(f); await Promise.all([a.reader.read(), b.reader.read()]);
    assert.equal(registrations.length, 1); assert.equal(f.plugin.taskData.subscribers.size, 1);
    registrations[0](); assert.equal(await a.reader.read(), null); assert.equal(await b.reader.read(), null);
    assert.equal(f.plugin.taskData.subscribers.size, 0); assert((await f.plugin.taskService.queryStructured()).rows.length);
});
test("clear import retires old line offsets for surviving nested Steps and continuation blocks", async t => {
    const f = createHomeFixture(), c = connect(f); t.after(async () => { c.close(); await f.close(); });
    const a = await c.reader.read(), task = a.items.find(item => item.task.hubTaskId === "assignment").task;
    const wrongOffset = a.items.map(item => item.task === task ? { ...item, task: { ...task, line: task.line + 3, steps: task.steps.map(step => ({ ...step, line: step.line + 3 })) } } : item);
    c.reader.remember(wrongOffset, [task.path]); const b = await c.reader.read();
    assert.equal(b.items.find(item => item.task.hubTaskId === "assignment").task.line, task.line);
    f.pages.get(task.path).file.tasks[0].completed = true; f.plugin.taskData.invalidateAll(); f.flush();
    assert((await c.reader.read()).items.find(item => item.task.hubTaskId === "assignment").task.completed);
});
test("Phase label changes invalidate the rendered signature without source reads", async t => {
    const f = createHomeFixture(), c = connect(f); t.after(async () => { c.close(); await f.close(); });
    f.plugin.planning.phaseFor = task => task.phaseId === "phase" ? { name: "First" } : null;
    const a = await c.reader.read(); c.reader.accept(a.items);
    f.plugin.planning.phaseFor = task => task.phaseId === "phase" ? { name: "Renamed" } : null;
    const b = await c.reader.read(); assert(b.changed); assert(b.items.some(item => item.phaseLabel === "Renamed")); assert.equal(f.counts.sources, 0);
});
