"use strict";
const test = require("node:test"), S = require("./home-schedule-support.cjs"), { assert } = S;
const D = require(S.lib + "domain/dates"), T = require(S.lib + "domain/task-views"), G = require(S.lib + "domain/task-planning");
test("native endpoints preserve date-only, timed midnight, Start/Due and civil-day grouping without UTC conversion", async t => {
    const f = await S.fixture(t, { consumerUiV1: true });
    const values = [
        { text: "Date only", fromDate: "2026-03-28", dueDate: "2026-03-29" },
        { text: "Midnight", dueDate: "2026-03-29", dueTime: "00:00" },
        { text: "Timed", fromDate: "2026-03-29", fromTime: "12:15", dueDate: "2026-03-30", dueTime: "17:30" },
        { text: "Start only", fromDate: "2026-10-25" },
        { text: "Future", fromDate: "2027-01-01" }
    ];
    for (const v of values) assert.equal((await f.runtime.mutate(await f.intent(v))).status, "committed");
    const tasks = (await f.runtime.list()).tasks;
    for (let i = 0; i < tasks.length; i++) for (const k of ["fromDate", "fromTime", "dueDate", "dueTime"]) assert.equal(tasks[i][k], values[i][k] ?? null);
    assert.notEqual(tasks[0].dueTime, tasks[1].dueTime); assert.equal(T.dayNumber("2026-03-30") - T.dayNumber("2026-03-29"), 1);
    assert.equal(T.dayNumber("2026-10-26") - T.dayNumber("2026-10-25"), 1);
    assert.equal(T.upcomingBucket(tasks[0], new Date(2026, 2, 29, 20)), "today");
    for (const mode of ["week", "month"]) { const range = T.calendarRange(new Date(2026, 2, 29, 12), mode).map(D.localISODate); assert(range.includes("2026-03-29")); }
    assert(G.taskGroups(tasks, new Date(2026, 2, 29, 13)).future.some(t => t.text === "Future"));
});
test("unchanged grouping keeps Necessity order and stable input ties", () => {
    const tasks = [{ text: "neutral", necessity: null }, { text: "should", necessity: "should" }, { text: "must A", necessity: "must" }, { text: "must B", necessity: "must" }];
    assert.deepEqual(G.taskGroups(tasks, new Date(2026, 9, 20)).active.map(t => t.text), ["must A", "must B", "should", "neutral"]);
});
test("calendar-style creation uses the actual compact form and exact original retained identity across reconstruction", async t => {
    const f = await S.fixture(t, { consumerUiV1: true }), service = f.runtime.formService({}), values = { text: "Calendar", dueDate: "2026-10-25", steps: [{ text: "Flat", completed: false }] };
    const out = await service.create({ authorityId: f.config.authorityId, owner: f.owner }, values.text, values); assert.equal(out.outcome.status, "committed");
    const [record] = await f.runtime.retained(), original = await f.runtime.getRetained(record.operationId), ids = out.tasks.map(t => [t.id, ...t.steps.map(s => s.id)]);
    assert.equal(original.intent.action.draft.metadata.due.date, values.dueDate); assert.equal(original.intent.action.draft.metadata.due.time, null);
    await f.reopen(); const replay = await f.runtime.replay(record.operationId); assert.equal(replay.status, "replayed");
    assert.deepEqual((await f.runtime.list()).tasks.map(t => [t.id, ...t.steps.map(s => s.id)]), ids); assert.deepEqual(await f.runtime.getRetained(record.operationId), original);
});
test("native Schedule panel actions keep UUIDs and reject fabricated source mutations before retention", async t => {
    const f = await S.fixture(t, { consumerUiV1: true }); await f.runtime.mutate(await f.intent());
    const panel = f.runtime.nativeTasks.createPanelRead({ plugin: {}, component: f.component(), workspace: f.owner });
    let read; for (let i = 0; i < 6 && !read; i++) read = await panel.read(); const task = read.tasks[0];
    assert(read.stamp); assert.equal(read.context.owner.id, f.owner.id); assert(!Object.hasOwn(task, "path"));
    await assert.rejects(panel.actions.mutate({ ...task, operation: "insert", value: "source" }));
    await assert.rejects(panel.clear([task])); await assert.rejects(panel.reveal(task)); assert.equal((await f.runtime.retained()).length, 1);
    const out = await panel.toggle(task, true); assert.equal(out.outcome.status, "committed"); assert.equal(out.tasks[0].id, task.id);
});
