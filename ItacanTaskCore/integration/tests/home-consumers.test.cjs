"use strict";
const test = require("node:test"), S = require("./home-schedule-support.cjs"), { assert } = S;
const C = require("../home-schedule");
test("actual mixed Home feed excludes only the native physical owner, preserves order and all Resource mounts", async t => {
    const f = await S.consumerFixture(t); await f.create({ text: "Native Home" }); const r = await f.read();
    assert.equal(r.availability, "current"); assert.equal(r.countComplete, true); assert.equal(r.items.filter(i => i.task.nativeReference).length, 1);
    assert(!r.items.some(i => i.task.hubTaskId === "excluded")); assert(r.items.some(i => i.task.hubTaskId === "mounted"));
    assert(r.items.some(i => i.task.hubTaskId === "resource-first")); assert(r.items.some(i => i.task.hubTaskId === "attributed"));
    const native = r.items.find(i => i.task.nativeReference); assert.equal(native.owner, f.project); assert(!Object.hasOwn(native.task, "path"));
    f.home.accept(r.items); assert.equal((await f.read()).changed, false);
    for (const resource of ["study", "media", "work", "tools"]) for (const project of ["shared-one", "shared-two"]) {
        const row = { task: { homePhysicalOwner: { type: "resource", id: resource }, mountedProject: project }, owner: { contextKind: "resource" } };
        assert.equal(C.mergeHome([row], [native.task], f.owner, { owner: f.owner, root: f.project.root, dashboard: f.project.path, status: f.project.status }, () => f.project)[0], row);
    }
});
test("native Home completion and independent Steps use retained native requests, never legacy History", async t => {
    const f = await S.consumerFixture(t); await f.create(); let r = await f.read(); f.home.accept(r.items);
    let task = r.items.find(i => i.task.nativeReference).task; const before = f.legacy.state();
    const step = await f.home.actions.mutate({ ...task, operation: "step", step: task.steps[0], stepCompleted: true }); assert.equal(step.outcome.status, "committed");
    r = await f.read(); task = r.items.find(i => i.task.nativeReference).task; assert(!task.completed); assert(task.steps[0].completed);
    const completed = await f.home.toggle(task, true); assert.equal(completed.outcome.status, "committed"); r = await f.read(); task = r.items.find(i => i.task.nativeReference).task; assert(task.completed);
    await f.home.toggle(task, false); assert.equal((await f.runtime.list()).tasks[0].completed, false); assert.equal(f.legacy.state(), before);
    const records = await f.runtime.retained(); assert.equal(records.length, 4); for (const record of records) assert.equal((await f.runtime.reconcile(record.operationId)).state, "committed");
});
test("Home rejects native clear/source before any legacy effects, while legacy actions remain unchanged", async t => {
    const f = await S.consumerFixture(t); await f.create(); const r = await f.read(), task = r.items.find(i => i.task.nativeReference).task, before = f.legacy.state();
    await assert.rejects(f.home.clear([r.items.find(i => !i.task.nativeReference).task, task], true), e => e.code === "UNSUPPORTED");
    await assert.rejects(f.home.reveal(task), e => e.code === "UNSUPPORTED"); assert.equal(f.legacy.state(), before);
    const calls = []; f.legacy.plugin.toggleTask = async (...args) => { calls.push(args); return "legacy-result"; };
    const legacyTask = r.items.find(i => i.task.hubTaskId === "unscheduled").task; const out = await f.home.toggle(legacyTask, true); assert.equal(out, "legacy-result"); assert.deepEqual(calls[0], [legacyTask.path, legacyTask.line, legacyTask.text, true, legacyTask.hubTaskId]);
});
for (const change of ["root", "dashboard", "status", "available"]) test("Home context " + change + " failure retains rows, disables native actions and withholds complete counts", async t => {
    const f = await S.consumerFixture(t); await f.create(); const r = await f.read(); f.home.accept(r.items); const task = r.items.find(i => i.task.nativeReference).task;
    f.registry.change(v => { const o = v.owners[0]; if (change === "root") o.root = "Projects/Moved"; else if (change === "dashboard") o.dashboard = null; else if (change === "status") o.status = "shelved"; else o.available = false; });
    const failed = await f.home.read(); assert.equal(failed.countComplete, false); assert.equal(failed.availability, "unavailable"); assert.equal(failed.items.length, r.items.length); assert(failed.items.find(i => i.task.nativeReference).task.nativeReadOnly);
    assert.throws(() => f.home.toggle(task, true)); assert.equal((await S.fs.readdir(f.directory)).filter(n => /^REQUEST-v1-/.test(n)).length, 1);
});
test("mixed composition replacement position and exact native UUID keys do not deduplicate legacy truthy IDs", () => {
    const owner = { type: "project", id: "p" }, context = { owner, root: "p", dashboard: "p/d", status: "active" }, wrapper = { projectId: "p", root: "p", path: "p/d", status: "active" };
    const a = { task: { hubTaskId: 1 }, owner: wrapper }, drop = { task: { homePhysicalOwner: owner }, owner: wrapper }, b = { task: { hubTaskId: "1" }, owner: wrapper };
    const task = { nativeReference: { authorityId: "authority", owner, taskId: "task" } };
    assert.deepEqual(C.mergeHome([a, drop, b, drop], [task], owner, context, () => wrapper).map(x => x.task), [a.task, task, b.task]);
    assert.notEqual(C.taskKey(task), C.taskKey({ nativeReference: { ...task.nativeReference, authorityId: "other" } }));
    assert.throws(() => C.mergeHome([], [task, task], owner, context, () => wrapper));
});
test("closed Home cannot publish a late feed or admit native actions", async t => {
    const f = await S.consumerFixture(t); await f.create(); const r = await f.read(), task = r.items.find(i => i.task.nativeReference).task; f.home.close();
    assert.equal(await f.home.read(), null); assert.throws(() => f.home.toggle(task, true));
});

test("registry invalidation during authoritative acceptance cannot publish old Home owner context", async t => {
    let f, armed = false, injected = 0;
    f = await S.consumerFixture(t, { repositoryOptions: { fault(stage) { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; injected++; f.registry.change(r => { r.owners[0].status = "shelved"; }); } } } });
    await f.create(); const before = await f.read(); f.home.accept(before.items); armed = true;
    const result = await f.home.read(); assert.equal(injected, 1); assert.equal(result.countComplete, false); assert.equal(result.availability, "unavailable");
    assert.equal(result.items.length, before.items.length); assert(result.items.find(i => i.task.nativeReference).task.nativeReadOnly);
});
test("disposed Home rejects late presentation without undoing an accepted native commit", async t => {
    let armed = false, enter, release; const entered = new Promise(r => enter = r), go = new Promise(r => release = r);
    const f = await S.consumerFixture(t, { repositoryOptions: { fault: async stage => { if (armed && stage === "beforeAcknowledgement") { armed = false; enter(); await go; } } } });
    await f.create(); const before = await f.read(); f.home.accept(before.items); const task = before.items.find(i => i.task.nativeReference).task;
    armed = true; const writing = f.home.toggle(task, true); await entered; f.home.close(); release(); const result = await writing;
    assert.equal(result.outcome.status, "committed"); assert.deepEqual(f.home.reconcile(before.items, result), []); assert.equal(f.repository.queryTasks()[0].completed, true);
});
