"use strict";
const assert = require("assert").strict;
const { randomUUID } = require("crypto");
const { HubTaskEditor } = require("../services/task-editor");
const { taskProgressMutation } = require("../domain/task-progress");
const { prepareStatistics, aggregateStatistics, seriesFor } = require("../domain/statistics");

async function verify(contextKind) {
    const owner = { root: contextKind === "project" ? "Projects/P" : "Resources/R", projectId: contextKind,
        name: contextKind, contextKind };
    const file = { path: owner.root + "/Tasks.md", extension: "md" };
    let content = "# Existing\r\n- [ ] Unrelated ^keep\r\n", checks = [], history = [], fail = false, release;
    const notifications = [];
    const plugin = { app: { vault: { getAbstractFileByPath: path => path === file.path ? file : null,
        getMarkdownFiles: () => [file], read: async () => content,
        process: async (_file, transform) => { content = transform(content); } } },
        projectWizard: { data: { taskMetadata: {} }, getContextForPath: () => owner,
            recordTaskMutation: async (edit, context, at) => {
                const next = taskProgressMutation(checks, history, edit, context, at, randomUUID);
                checks = next.checks; history = next.history; return next.changed;
            } }, dataStore: { save: async () => { if (fail) throw Error("Creation failed"); } },
        enqueueTaskMutation: async run => { if (release) await release; return run(); },
        markProjectChangedByPath() {}, notifyCompletedTasksChanged: () => notifications.push(true) };
    const service = new HubTaskEditor(plugin), at = Date.now() - 1000;
    const values = { hubTaskId: "completed-creation-" + contextKind, completed: true, completedAt: at,
        description: "**Exact**\n\nDescription\n", steps: [{ text: "Untouched step", completed: false },
            { text: "Checked step", completed: true, completedAt: at - 100 }] };
    const original = JSON.stringify({ content, checks, history, data: plugin.projectWizard.data });
    fail = true;
    await assert.rejects(service.create(file.path, "Completed on creation ^native", values), /Creation failed/);
    assert.equal(JSON.stringify({ content, checks, history, data: plugin.projectWizard.data }), original,
        "Failed creation rolls back Markdown/metadata without recording progress");
    assert.equal(values.completed, true); assert.equal(values.completedAt, at);
    fail = false;
    let unblock; release = new Promise(resolve => { unblock = resolve; });
    const pending = service.create(file.path, "Completed on creation ^native", values);
    unblock(); await pending; release = null;
    assert.ok(content.startsWith("# Existing\r\n- [ ] Unrelated ^keep\r\n"));
    assert.ok(content.includes("- [x] Completed on creation <!-- hub-task:" + values.hubTaskId + " --> ^native\r\n"));
    const snapshot = await service.read({ path: file.path, text: "Completed on creation ^native", hubTaskId: values.hubTaskId });
    assert.equal(snapshot.completed, true); assert.equal(snapshot.description, values.description);
    assert.equal(snapshot.steps[0].completed, false); assert.equal(snapshot.steps[1].completed, true);
    assert.equal(history.filter(event => event.kind === "task").length, 1);
    assert.equal(history.find(event => event.kind === "task").timestamp, at);
    assert.equal(history.find(event => event.kind === "step").timestamp, at - 100);
    assert.equal(checks.find(event => event.kind === "task").hubTaskId, values.hubTaskId);
    assert.equal(notifications.length, 1);
    const statistics = aggregateStatistics(prepareStatistics({ workspaces: [owner], completions: history }), "all");
    assert.equal(seriesFor(statistics, "tasks", "all").reduce((sum, value) => sum + value, 0), 1);
    assert.equal(seriesFor(statistics, "steps", "all").reduce((sum, value) => sum + value, 0), 1);
    const persisted = JSON.stringify({ content, checks, history, data: plugin.projectWizard.data });
    await service.create(file.path, "Completed on creation ^native", values);
    assert.equal(JSON.stringify({ content, checks, history, data: plugin.projectWizard.data }), persisted,
        "Stable-ID retry cannot duplicate the task or its completed-task statistics");
    await service.save(snapshot, { ...snapshot, text: snapshot.text, completedAt: at + 100 });
    assert.equal(history.find(event => event.kind === "task").timestamp, at, "Unchanged Edit preserves creation completion time");
    const reopened = await service.read({ path: file.path, hubTaskId: values.hubTaskId, text: snapshot.text });
    await service.save(reopened, { ...reopened, completed: false });
    assert.equal(history.filter(event => event.kind === "task").length, 0);
    assert.equal(history.filter(event => event.kind === "step").length, 1, "Parent uncheck preserves Step completion");
    await service.create(file.path, "Unchecked default");
    await service.create(file.path, "Toggled off", { completed: false, completedAt: at });
    assert.ok(content.includes("- [ ] Unchecked default\r\n"));
    assert.ok(content.includes("- [ ] Toggled off\r\n"));
    assert.equal(history.filter(event => event.kind === "task").length, 0);
}
Promise.all([verify("project"), verify("resource")]).then(() => console.log("PASS: completed creation for Projects/Resources, queued exact timestamps, History/statistics, CRLF/native IDs, Step isolation, rollback/retry, stable-ID deduplication, reopen/uncheck and incomplete defaults.")).catch(error => { console.error(error); process.exitCode = 1; });
