"use strict";
const assert = require("assert");
const { editTaskContent, applyTaskEdit, taskLineMatchesText } = require("../domain/tasks");
const toggle = line => line.includes("[ ]")
    ? line.replace("[ ]", "[x]").trimEnd() + " ✅ 2026-09-06"
    : line.replace("[x]", "[ ]").replace(" ✅ 2026-09-06", "");
const path = "Projects/Test/Tasks.md";
const source = "- [ ] Top task  \r\n1. [ ] Middle task\r\n* [ ] Bottom task\t\r\n";
const initial = source.trimEnd().split("\r\n").map((line, index) => ({
    path, line: index, text: line.replace(/^.*?\[ \]\s+/, "").trim(), completed: false
}));
assert.equal(taskLineMatchesText("- [ ] Top task  \r", "Top task"), true);
assert.equal(taskLineMatchesText("- [ ] First line  ", "First line\n  Continued text"), true);
assert.equal(taskLineMatchesText("- [ ] Other task", "Top task"), false);
assert.equal(taskLineMatchesText("- [ ] Two  spaces", "Two spaces"), false);
for (const index of [0, 1, 2]) {
    const request = { path, line: index, text: initial[index].text, completed: true };
    const result = editTaskContent(source, request, toggle);
    assert.ok(result.edit.completed, "Top/middle/bottom completion");
    assert.equal(result.content.split("\r\n").length, 4, "Preserve CRLF and final newline");
    const next = applyTaskEdit(initial.map(task => ({ ...task })), result.edit);
    assert.equal(next[index].completed, true);
    assert.ok(next[index].text.endsWith("✅ 2026-09-06"), "Keep canonical saved text for subsequent clicks");
    const undone = editTaskContent(result.content, { ...next[index], completed: false }, toggle);
    assert.equal(undone.edit.completed, false, "Check/uncheck without waiting for Dataview");
    assert.equal(applyTaskEdit(next, undone.edit)[index].completed, false);
}
const moved = editTaskContent("# Added heading\n- [ ] Unique  ", { path, line: 0, text: "Unique", completed: true }, toggle);
assert.equal(moved.edit.line, 1);
assert.throws(() => editTaskContent("- [ ] Same\n- [ ] Same", { path, line: 4, text: "Same" }, toggle), /uniquely/);
assert.throws(() => editTaskContent("- [ ] Changed", { path, line: 0, text: "Original" }, toggle), /uniquely/);
const already = editTaskContent("- [x] Done", { path, line: 0, text: "Done", completed: true }, () => { throw Error("Must not toggle twice"); });
assert.equal(already.content, "- [x] Done");
const wrapped = initial.map(task => ({ task, owner: { id: "a" } }));
const recurring = editTaskContent(source, { ...initial[0], completed: true },
    () => "- [ ] Next occurrence\n- [x] Top task ✅ 2026-09-06");
const next = applyTaskEdit(wrapped, recurring.edit);
assert.deepEqual(next.map(item => item.task.line), [0, 1, 2, 3]);
assert.deepEqual(next.map(item => item.task.completed), [false, true, false, false]);
assert.equal(next[1].owner, wrapped[0].owner);
assert.equal(initial[1].line, 1, "Do not mutate stale Dataview objects");
const middle = editTaskContent(recurring.content, { ...initial[1], completed: true }, toggle);
assert.equal(middle.edit.line, 2, "Locate a shifted task after recurrence inserts a line");
assert.equal(applyTaskEdit(next, middle.edit)[2].task.completed, true);
const removed = editTaskContent(source, { ...initial[0], completed: true }, () => "");
assert.deepEqual(applyTaskEdit(initial, removed.edit).map(task => task.line), [0, 1]);
console.log("Task tests passed: whitespace/CRLF/multiline lookup, top/middle/bottom, repeated toggles, stale lines, duplicate safety, recurrence and model reconciliation.");
