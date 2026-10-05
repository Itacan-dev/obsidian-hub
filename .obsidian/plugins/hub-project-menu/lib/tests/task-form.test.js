"use strict";
const assert = require("assert").strict;
const { taskFormValues, validTaskForm } = require("../domain/task-form");

const input = { text: "  Review research  ", workspaceId: "p1", location: "Projects/Thesis/Work",
    necessity: "must", fromDate: "2026-10-03", dueDate: "2026-10-05", phaseId: "phase1",
    steps: [{ text: " Read source ", completed: true, completedAt: 123, line: 4, end: 5 }] };
const result = taskFormValues(input);
assert.equal(result.text, "Review research");
assert.equal(result.location, input.location);
assert.equal(result.workspaceId, input.workspaceId);
assert.equal(result.phaseId, input.phaseId);
assert.deepEqual(result.steps, [{ text: "Read source", completed: true, completedAt: 123, line: 4, end: 5 }]);
assert.equal(input.steps[0].text, " Read source ", "Validation does not mutate original snapshots");
assert.ok(!result.fromTime && !result.dueTime, "Date-only tasks do not gain midnight metadata");
assert.equal(taskFormValues({ text: "Task", dueDate: "2026-10-05", dueTime: "00:00" }).dueTime, "00:00", "Explicit midnight survives");
assert.ok(validTaskForm({ text: "Task" }), "Task enrichment remains optional");
for (const invalid of [
    { text: "" }, { text: "two\nlines" }, { text: "Copied <!-- hub-task:id -->" },
    { text: "Task", steps: [{ text: "" }] }, { text: "Task", steps: [{ text: "two\nlines" }] },
    { text: "Task", fromDate: "2026-10-08", dueDate: "2026-10-05" },
    { text: "Task", dueTime: "12:30" }, { text: "Task", dueDate: "2026-02-30" }
]) {
    assert.ok(!validTaskForm(invalid));
    assert.throws(() => taskFormValues(invalid));
}
console.log("Shared task form passed: canonical text/Steps, optional enrichment, snapshot safety and date-only semantics.");
