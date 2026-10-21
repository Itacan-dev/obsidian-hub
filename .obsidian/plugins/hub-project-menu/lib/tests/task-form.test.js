"use strict";
const assert = require("assert").strict;
const { taskFormValues, validTaskForm } = require("../domain/task-form");
const { HubTaskEditor } = require("../services/task-editor");

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
const project = { root: "Projects/P", projectId: "p", contextKind: "project" };
const other = { root: "Projects/Q", projectId: "q", contextKind: "project" };
const resource = { root: "Resources/R", projectId: "resource:r", contextKind: "resource" };
const editor = new HubTaskEditor({ app: {}, projectWizard: {
    getContextForPath: path => [project, other, resource].find(owner => path === owner.root || path?.startsWith(owner.root + "/")),
    getProjectRecords: () => [{ ...project, status: "active", name: "P" }], data: {}
}, planning: { phases: id => id === "p" ? [{ id: "phase-p", name: "P phase" }] : [{ id: "phase-q", name: "Q phase" }] } });
assert.equal(editor.checkedMetadata({ phaseId: "phase-p" }, project).phaseId, "phase-p");
assert.throws(() => editor.checkedMetadata({ phaseId: "phase-p" }, other), /no longer available/);
assert.throws(() => editor.checkedMetadata({ phaseId: "phase-p" }, resource), /task's Project/);
assert.throws(() => editor.checkedMetadata({ phaseId: "phase-p" }, null), /task's Project/);
assert.equal(editor.checkedMetadata({ linkedProjectId: "p" }, resource).linkedProjectId, undefined, "Retired Resource association is ignored");
assert.equal(taskFormValues({ text: "Legacy", linkedProjectId: "p" }).linkedProjectId, undefined);
assert.equal(editor.checkedMetadata({ linkedProjectId: "p" }, project).linkedProjectId, undefined);
console.log("Shared task form passed: canonical text/Steps, optional enrichment, snapshot safety, date-only semantics and project-scoped phase validation.");
