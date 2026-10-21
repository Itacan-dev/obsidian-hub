"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { createPhaseFixture, candidateFacts } = require("./phase-read-fixture.cjs");
const { PhaseTaskRead, taskKey } = require("../services/phase-task-read");
const baseline = require("./phase-read-baseline.json");
function session(f, id = "app") { return new PhaseTaskRead(f.plugin.planning, id, f.plugin.planning.phases(id)[0].id); }
for (const record of baseline) test("original planning candidate/assignment/label/order parity: " + record.id, async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const before = f.state(), data = JSON.stringify(f.plugin.projectWizard.data);
    const tasks = await f.plugin.planning.tasks(f.dv, record.id);
    assert.deepEqual(candidateFacts(tasks, f.plugin.planning.read(record.id), f.plugin.planning.phases(record.id)[0].id), record.facts);
    assert.equal(f.state(), before); assert.equal(JSON.stringify(f.plugin.projectWizard.data), data);
    assert.equal(f.counts.sources, 0); assert.equal(f.counts.indexes, 1); assert.equal(f.counts.writes, 0);
});
test("workspace exclusions and physical owner checks exclude mounted/Resource/System/Templates/hidden tasks", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const tasks = await f.plugin.planning.tasks(f.dv, "app");
    assert(tasks.every(task => task.path.startsWith("Projects/App/")));
    for (const name of ["System", "Templates", ".hidden"]) assert(!tasks.some(task => task.path.includes("/" + name + "/")));
    const original = f.plugin.taskService, foreign = await original.queryStructured({ workspace: { type: "resource", id: "study" }, policy: "workspace" });
    f.plugin.taskService = { queryStructured: async () => foreign, close: original.close.bind(original) };
    assert.deepEqual(await f.plugin.planning.tasks(f.dv, "app"), []);
    await assert.rejects(f.plugin.planning.tasks(f.dv, "resource:study"), /no longer available/);
});
test("refresh never turns missing selected tasks into a removal, including a failed first read", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close());
    assert(draft.selected.has("timed") && draft.selected.has("rich"));
    f.dv.index.initialized = false; await assert.rejects(draft.refresh(), { code: "INDEX_UNAVAILABLE" });
    assert.equal((await draft.assignments()).length, 0);
    f.dv.index.initialized = true; await draft.refresh(); const selected = [...draft.selected.keys()];
    f.pages.get("Projects/App/Tasks/Timed.md").file.tasks = []; f.plugin.taskData.invalidateAll(); f.flush(); await draft.refresh();
    assert.deepEqual([...draft.selected.keys()], selected); assert.equal(await draft.assignments().then(items => items.length), 0);
    assert.equal(draft.usable(draft.selected.get("timed")), false);
});
test("explicit additions/removals survive refresh and missing references block only affected save deltas", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close()); await draft.refresh();
    const task = draft.pickerItems().find(task => task.hubTaskId === "unscheduled"); assert(draft.add(task)); draft.remove("timed");
    f.plugin.taskData.invalidateAll(); f.flush(); await draft.refresh();
    assert(!draft.selected.has("timed") && draft.selected.has("unscheduled"));
    assert.deepEqual((await draft.assignments()).map(item => [item.task.hubTaskId, item.included]), [["timed", false], ["unscheduled", true]]);
    f.files.delete(task.path); f.plugin.taskData.invalidateAll(); f.flush(); await draft.refresh();
    await assert.rejects(draft.assignments()); assert(draft.additions.has("unscheduled") && draft.removals.has("timed")); assert.equal(f.counts.writes, 0);
});
test("ambiguous initial assignments retain identity without inventing a source and recover when unique", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close());
    f.addTask("Projects/App/Copy.md", "Copied", "timed"); await draft.refresh();
    assert(draft.selected.has("timed")); assert.equal(draft.selected.get("timed").ref, null);
    draft.remove("timed"); await assert.rejects(draft.assignments(), /unavailable/);
    f.files.delete("Projects/App/Copy.md"); f.plugin.taskData.invalidateAll(); f.flush(); await draft.refresh();
    assert(draft.baseline.get("timed").ref); assert(!draft.selected.has("timed"));
    assert.equal((await draft.assignments())[0].included, false);
});
for (const change of ["title", "phase", "copy", "delete"]) test("selected " + change + " keeps draft and rejects unsafe explicit deltas", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close()); await draft.refresh(); draft.remove("timed");
    const ref = draft.baseline.get("timed").ref;
    if (change === "title") f.contents.set(ref.path, f.contents.get(ref.path).replace("Timed", "Changed"));
    if (change === "phase") f.plugin.projectWizard.data.taskMetadata.timed.phaseId = "other-app";
    if (change === "copy") f.addTask("Projects/App/Copy.md", "Timed", "timed");
    if (change === "delete") f.files.delete(ref.path);
    f.plugin.taskData.invalidateAll(); f.flush(); await draft.refresh(); await assert.rejects(draft.assignments());
    assert(draft.removals.has("timed")); assert.equal(f.counts.writes, 0);
});
test("ID-less candidates preserve locator identity and reading/picker cancellation allocates no ID", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const before = f.state(), draft = session(f); await draft.refresh();
    const task = draft.pickerItems().find(task => !task.hubTaskId); assert(task && draft.add(task));
    const assignments = await draft.assignments(); assert.equal(assignments[0].task.hubTaskId, null); assert.equal(taskKey(task), task.path + ":" + task.line);
    draft.close(); assert.equal(f.state(), before); assert.equal(f.counts.writes, 0); assert.equal(f.plugin.taskData.subscribers.size, 0);
});
test("save freeze, superseded refresh, multi-Project sessions and close never publish obsolete data or duplicate watchers", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const actual = f.plugin.taskService; let release;
    const wrapper = { subscribe: actual.subscribe.bind(actual), resolveLegacyAction: actual.resolveLegacyAction.bind(actual), queryStructured: async options => {
        const value = await actual.queryStructured(options); if (options.workspace.id === "app") await new Promise(resolve => { release = resolve; }); return value;
    }, close: actual.close.bind(actual) };
    f.plugin.taskService = wrapper; const a = session(f), pending = a.refresh(); while (!release) await Promise.resolve();
    const b = session(f, "other"); await b.refresh(); a.freeze(); release(); assert.equal(await pending, null);
    assert(b.candidates.every(task => task.path.startsWith("Projects/Other/"))); assert.equal(f.plugin.taskData.subscribers.size, 1);
    a.close(); b.close(); assert.equal(f.plugin.taskData.subscribers.size, 0);
});
test("explicit deltas preserve the original candidate write order rather than user click order", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close()); await draft.refresh();
    draft.add(draft.pickerItems().find(task => !task.hubTaskId)); draft.add(draft.pickerItems().find(task => task.hubTaskId === "start"));
    assert.deepEqual((await draft.assignments()).map(item => item.task.hubTaskId), ["start", null]);
});
test("a selected persistent task follows a source rename while keeping its original action evidence", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close()); await draft.refresh();
    const entry = draft.selected.get("timed"), ref = entry.ref, old = ref.path, next = old.replace("Timed.md", "Renamed.md");
    const file = f.files.get(old), page = f.pages.get(old), source = f.contents.get(old);
    f.files.delete(old); f.pages.delete(old); f.contents.delete(old); file.path = next; page.file.path = next;
    f.files.set(next, file); f.pages.set(next, page); f.contents.set(next, source); f.vault.emit("rename", file, old); f.flush();
    await draft.refresh(); assert.equal(entry.ref, ref); assert.equal(entry.path, next); assert(draft.usable(entry));
    draft.remove("timed"); assert.equal((await draft.assignments())[0].task.path, next); assert.equal(f.counts.writes, 0);
});
test("initially missing assigned sources remain unresolved baseline entries, never inferred owners or removals", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); f.files.delete("Projects/App/Tasks/Timed.md");
    const draft = session(f); t.after(() => draft.close()); await draft.refresh(); const entry = draft.selected.get("timed");
    assert(entry && entry.ref === null && entry.path === null); assert.deepEqual(await draft.assignments(), []);
    draft.remove("timed"); await assert.rejects(draft.assignments(), /unavailable/); assert.equal(f.counts.writes, 0);
});
test("user Add/Remove choices made while an incomplete refresh is pending remain explicit", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const draft = session(f); t.after(() => draft.close()); await draft.refresh();
    const original = f.plugin.planning.taskCandidates.bind(f.plugin.planning); let release;
    f.plugin.planning.taskCandidates = async (...args) => { const value = await original(...args); await new Promise(resolve => { release = resolve; }); return { ...value, tasks: value.tasks.filter(task => task.hubTaskId !== "unscheduled") }; };
    const pending = draft.refresh(); while (!release) await Promise.resolve();
    draft.add(draft.pickerItems().find(task => task.hubTaskId === "unscheduled")); draft.remove("timed"); release(); await pending;
    assert(draft.selected.has("unscheduled") && !draft.selected.has("timed")); assert(draft.additions.has("unscheduled") && draft.removals.has("timed"));
    assert.equal((await draft.assignments()).length, 2);
});
test("missing Phase labels preserve original candidate eligibility and label semantics", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); f.plugin.projectWizard.data.taskMetadata.unscheduled = { phaseId: "missing-phase" };
    const Old = require("./phase-read-fixture.cjs").originalPlanning(), old = new Old(f.plugin), tasks = old.tasks(f.dv, "app");
    assert.deepEqual(candidateFacts(await f.plugin.planning.tasks(f.dv, "app"), f.plugin.planning.read("app"), "phase"), candidateFacts(tasks, old.read("app"), "phase"));
});
test("equal legacy Phase IDs in another Project/Resource or excluded source never become current Project assignments", async t => {
    const f = createPhaseFixture(); t.after(() => f.close()); const data = f.plugin.projectWizard.data.taskMetadata;
    data["owner-other"].phaseId = "phase"; data["owner-resource-study"] = { phaseId: "phase" }; data["excluded-System"] = { phaseId: "phase" };
    const draft = session(f); t.after(() => draft.close()); await draft.refresh();
    assert.deepEqual([...draft.selected.keys()], ["timed", "rich"]); assert.deepEqual(await draft.assignments(), []);
    assert(draft.candidates.every(task => task.path.startsWith("Projects/App/") && !task.path.includes("/System/")));
    assert.equal(f.counts.sources, 0); assert.equal(f.counts.writes, 0);
});
