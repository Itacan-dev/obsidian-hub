"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createTaskFocus } = require("../domain/task-views");
const { createOathTaskSection } = require("../ui/oath-tasks");

const task = (id, authorityId = "authority", completed = false) => ({ id, completed, nativeReference: { authorityId, taskId: id } });

test("task markers use explicit Plan membership and maintain stable order within each rank", () => {
    const unrelated = task("unrelated");
    const planned = task("planned");
    const sworn = task("sworn");
    const foreign = task("planned", "another-authority");
    const completed = task("completed", "authority", true);
    const focus = createTaskFocus({ content: { entries: [
        { kind: "workspace", reference: { type: "project", id: "one" } },
        ...[planned, sworn, completed].map(item => ({ kind: "task", reference: item.nativeReference }))
    ] } }, { tasks: [sworn.nativeReference] });
    const source = [unrelated, foreign, planned, sworn, completed];
    assert.deepEqual(focus.order(source), [sworn, planned, unrelated, foreign, completed]);
    assert.deepEqual(source.map(focus.label), ["", "", "In Plan", "Oath · In Plan", ""]);
    assert.deepEqual(focus.order(source.map(task => ({ task }))).map(item => item.task), [sworn, planned, unrelated, foreign, completed]);
});

test("a compact task panel cannot pull pinned Oath tasks from outside its scope", () => {
    const ordinary = [task("active")];
    const oath = {
        active: true, current: { workspace: { type: "project", id: "future" } },
        onChange: () => () => {},
        work: [{ task: task("future") }]
    };
    const section = createOathTaskSection(oath, {}, { register() {} });
    const result = section.partition(ordinary, undefined, owner => owner.id === "active");
    assert.deepEqual(result, { ordinary, pinned: [], missing: [] });
});
