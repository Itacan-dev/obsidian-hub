"use strict";
const assert = require("assert");
const { taskGroups, taskMetadata, validateTaskMetadata, readTaskSnapshot, saveTaskSnapshot, appendTask, insertTaskAtCursor, toggleTaskStep } = require("../domain/task-planning");
const { tasksForPage, HubTaskDataService } = require("../services/task-data");
const { taskIdentity, taskDisplayText, editTaskContent, applyTaskEdit } = require("../domain/tasks");
const { HubTaskEditor } = require("../services/task-editor");

const path = "Projects/A/Tasks.md", today = "2026-09-19";
assert.deepEqual(taskMetadata({ necessity: "todo", dueDate: "2026-02-30" }), { necessity: null, fromDate: null, dueDate: null });
assert.throws(() => validateTaskMetadata({ fromDate: "2026-09-21", dueDate: "2026-09-20" }), /Due/);
assert.throws(() => validateTaskMetadata({ dueDate: "2026-02-30" }), /valid date/);
const items = [
    { text: "Distant must", dueDate: "2026-12-01", necessity: "must" },
    { text: "Unclassified earlier", dueDate: "2026-09-20" },
    { text: "Same day should", dueDate: "2026-09-20", necessity: "should" },
    { text: "Same day must", dueDate: "2026-09-20", necessity: "must" },
    { text: "Overdue later", dueDate: "2026-09-18", necessity: "must" },
    { text: "Overdue earliest", dueDate: "2026-09-16" },
    { text: "No date" }, { text: "No date must", necessity: "must" }, { text: "Stable tie" },
    { text: "Future", fromDate: "2026-09-20", dueDate: "2026-09-21", necessity: "must" },
    { text: "From today", fromDate: today },
    { text: "Done", completed: true, fromDate: "2026-10-20" }
];
const expected = ["Overdue earliest", "Overdue later", "Same day must", "Same day should", "Unclassified earlier", "Distant must", "No date must", "No date", "Stable tie", "From today"];
assert.deepEqual(taskGroups(items, today).active.map(x => x.text), expected);
assert.deepEqual(taskGroups(items.map(task => ({ task, owner: {} })), today).active.map(x => x.task.text), expected);
assert.equal(taskGroups(items, today).future[0].necessity, "must");
assert.equal(taskGroups(items, "2026-09-20").future.length, 0);
assert.equal(taskGroups(items, today).completed.length, 1);

const child = { line: 2, parent: 0, text: "Step", task: true, completed: true, children: [] };
const other = { line: 6, parent: 5, text: "Task under ordinary bullet", task: true, children: [] };
const page = { file: { path, tasks: [{ line: 0, text: "Parent <!-- hub-task:id-a -->", children: [child] }, child, other], lists: [
    { line: 0 }, child, { line: 5, children: [other] }, other
] } };
assert.deepEqual(tasksForPage(page).map(x => x.text), ["Parent", "Task under ordinary bullet"]);
assert.equal(tasksForPage(page)[0].steps.length, 1);
assert.equal(tasksForPage(page)[0].hubTaskId, "id-a");
assert.ok(page.file.tasks[0].text.includes("hub-task"), "Never alter Dataview-owned objects");
const service = new HubTaskDataService({ vault: { getAbstractFileByPath: () => ({ extension: "md" }) } }, { metadata: () => ({ necessity: "must" }) });
const dv = { pages: () => ({ array: () => [page] }) };
assert.equal(service.readPages(dv)[0].file.tasks[0].necessity, "must");
dv.pages = () => ({ array: () => [page, { file: { ...page.file, path: "Projects/B/Copied.md" } }] });
assert.equal(service.readPages(dv, "Projects/A")[0].file.tasks[0].necessity, null, "A copy in another Workspace never aliases metadata");
assert.equal(service.readPages(dv, "Projects/A")[0].file.tasks[0].identityConflict, true);

const source = "# Tasks\r\n- [ ] Parent\r\n    detail to preserve\r\n    - [x] First\r\n    - [ ] Second\r\n\r\n    More details\r\n- [ ] Next\r\n";
const snapshot = readTaskSnapshot(source, { path, line: 1, text: "Parent" });
assert.equal(snapshot.steps.length, 2);
const stepRequest = { ...snapshot, step: snapshot.steps[1], stepCompleted: true };
const checkedStep = toggleTaskStep(source, stepRequest);
assert.equal(checkedStep.content, source.replace("- [ ] Second", "- [x] Second"), "Only the chosen nested checkbox changes, retaining CRLF and parent text/state");
assert.equal(checkedStep.edit.tasks[0].steps.filter(step => step.completed).length, 2);
assert.equal(checkedStep.edit.tasks[0].completed, false, "All Steps done does not complete parent");
assert.equal(toggleTaskStep(checkedStep.content, stepRequest).content, checkedStep.content, "Requested Step state is idempotent");
assert.equal(toggleTaskStep("Heading\r\n" + source, stepRequest).content, "Heading\r\n" + checkedStep.content, "Resolve relative Step position after moving parent");
assert.throws(() => toggleTaskStep(source.replace("Second", "Changed") + "- [ ] Second\r\n", stepRequest), /Step moved or changed/, "Never resolve a Step outside its parent");
assert.equal(applyTaskEdit([snapshot], checkedStep.edit)[0].steps[1].completed, true, "Return a parent edit for existing dashboard reconciliation");
let result = saveTaskSnapshot(source, snapshot, { text: "Edited", necessity: "must", dueDate: "2026-09-20", steps: [
    { ...snapshot.steps[0], text: "First edited", completed: false }, snapshot.steps[1], { text: "Third", completed: false }
] }, "id-a");
assert.ok(result.content.includes("- [ ] Edited <!-- hub-task:id-a -->\r\n    detail to preserve"));
assert.ok(result.content.includes("    - [ ] First edited\r\n"));
assert.ok(result.content.includes("    More details\r\n    - [ ] Third\r\n- [ ] Next"));
assert.equal(result.edit.tasks[0].steps.length, 3);
assert.equal(applyTaskEdit([{ ...snapshot }, { path, line: 7, text: "Next" }], result.edit)[1].line, 8);
assert.throws(() => saveTaskSnapshot(source.replace("[x] First", "[ ] First"), snapshot, { text: "Edited" }), /changed/);
const shifted = saveTaskSnapshot("Inserted heading\r\n" + source, snapshot, { text: "Moved" });
assert.equal(shifted.edit.line, 2, "Unchanged block can move within a note");
assert.equal(saveTaskSnapshot(source, snapshot, { operation: "delete" }).content, "# Tasks\r\n- [ ] Next\r\n", "Delete includes Steps and task-owned prose, preserves siblings");
const fenced = "- [ ] Parent\n    ```markdown\n    - [ ] Example\n    ```\n    - [ ] Actual Step\n";
assert.equal(readTaskSnapshot(fenced, { path, line: 0, text: "Parent" }).steps.length, 1);
const native = readTaskSnapshot("- [ ] Linked ^existing\n", { path, line: 0, text: "Linked ^existing" });
assert.ok(saveTaskSnapshot("- [ ] Linked ^existing\n", native, { text: native.text }, "id-b").content.includes("Linked <!-- hub-task:id-b --> ^existing"));
assert.equal(taskIdentity(result.content), "id-a");
assert.ok(!taskDisplayText(result.edit.tasks[0].text).includes("hub-task"));
const toggled = editTaskContent(result.content, { ...result.edit.tasks[0], completed: true }, line => line.replace("[ ]", "[x]"));
assert.equal(toggled.edit.tasks[0].hubTaskId, "id-a");
assert.ok(!toggled.edit.tasks[0].text.includes("hub-task"));
assert.throws(() => editTaskContent(result.content + result.content, { ...result.edit.tasks[0], completed: true }, x => x), /copied/);
assert.equal(appendTask("# Title\r\n", "Quick"), "# Title\r\n\r\n- [ ] Quick\r\n");
assert.throws(() => appendTask("", ""), /Enter task text/);
assert.throws(() => appendTask("```js\ncode", "Task"), /code fence/);
assert.throws(() => appendTask("---\ntitle: Test", "Task"), /Properties/);
assert.ok(appendTask("---\ntitle: Test\n---\n```\nexample\n```\n", "Task").endsWith("- [ ] Task\n"));
for (const [before, after] of [["", "- [ ] "], ["Plain text", "- [ ] Plain text"], ["  * Bullet", "  * [ ] Bullet"], ["- [ ] Existing", "- [ ] Existing"]]) {
    let line = before;
    insertTaskAtCursor({ getCursor: () => ({ line: 0, ch: before.length }), getLine: () => line,
        replaceRange: (text, from, to) => { line = line.slice(0, from.ch) + text + line.slice(to.ch); }, setCursor() {} });
    assert.equal(line, after);
}

async function persistence() {
    let content = source, stored, fail = false, intervening = false;
    const file = { path, extension: "md" };
    const plugin = { app: { vault: { getAbstractFileByPath: value => value === file.path ? file : null,
        read: async () => content, process: async (_file, update) => { content = update(content); } } },
        projectWizard: { data: {}, recordTaskMutation: async () => {}, getContextForPath: () => ({}) },
        dataStore: { save: async data => { if (fail) { if (intervening) content += "External text\r\n"; throw Error("Disk conflict"); } stored = JSON.parse(JSON.stringify(data)); } },
        enqueueTaskMutation: fn => fn(), markProjectChangedByPath() {}, taskData: { invalidate() {}, currentPath: path => path } };
    const editor = new HubTaskEditor(plugin);
    let draft = await editor.read({ path, line: 1, text: "Parent" });
    await editor.save(draft, { text: "Persisted", necessity: "must", fromDate: today, dueDate: "2026-10-01", steps: draft.steps });
    const id = taskIdentity(content);
    assert.ok(id);
    assert.deepEqual(stored.taskMetadata[id], { necessity: "must", fromDate: today, dueDate: "2026-10-01" });
    plugin.projectWizard.data = JSON.parse(JSON.stringify(stored));
    assert.equal(new HubTaskEditor(plugin).metadata(id).necessity, "must", "Metadata survives restart");
    draft = await editor.read({ path, line: 1, text: "Persisted", hubTaskId: id });
    file.path = "Projects/A/Renamed.md";
    await editor.save(draft, { text: "Renamed source", necessity: "should", steps: draft.steps });
    assert.equal(taskIdentity(content), id);
    assert.equal(plugin.projectWizard.data.taskMetadata[id].necessity, "should", "Open editor follows the native file object on rename");
    await assert.rejects(() => editor.save(draft, { text: "Stale modal", necessity: "must", steps: draft.steps }), /metadata changed/);
    draft = await editor.read({ path: file.path, line: 1, text: "Renamed source", hubTaskId: id });
    const before = content;
    fail = true;
    await assert.rejects(() => editor.save(draft, { text: "Must roll back", necessity: "must", steps: draft.steps }), /Disk conflict/);
    assert.equal(content, before, "Metadata failure rolls back exact source write");
    assert.equal(plugin.projectWizard.data.taskMetadata[id].necessity, "should");
    intervening = true;
    await assert.rejects(() => editor.save(draft, { text: "Changed source", necessity: "must", steps: draft.steps }), /note also changed/);
    assert.ok(content.endsWith("External text\r\n"), "Rollback never overwrites a subsequent note edit");
    fail = false;
    draft = await editor.read({ path: file.path, line: 1, text: "Changed source", hubTaskId: id });
    await editor.save(draft, { text: draft.text, necessity: null, steps: draft.steps });
    assert.equal(plugin.projectWizard.data.taskMetadata[id], undefined, "Removing all metadata removes only its record");
    assert.equal(taskIdentity(content), id, "Stable identity retained after clearing metadata");
    draft = await editor.read({ path: file.path, line: 1, text: "Changed source", hubTaskId: id });
    await editor.save(draft, { operation: "delete" });
    assert.ok(!content.includes("hub-task") && !content.includes("First"));
    await editor.create(file.path, "Fast task");
    assert.ok(content.endsWith("- [ ] Fast task\r\n"));
    assert.ok(!content.includes("hub-task"), "Fast creation is ordinary unannotated Markdown");
}
persistence().then(() => console.log("Task planning passed: date-first ordering, future activation, neutral fallback, nested discovery, copy conflicts, source-safe Steps, identity, CRLF, quick creation, reload/rename, rollback and deletion.")).catch(error => { console.error(error); process.exitCode = 1; });
