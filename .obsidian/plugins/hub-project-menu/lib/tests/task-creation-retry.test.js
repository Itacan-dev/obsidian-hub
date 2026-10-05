"use strict";
const assert = require("assert/strict");
const { HubTaskEditor } = require("../services/task-editor");
const { readTaskSnapshot } = require("../domain/task-planning");

async function run() {
    const project = { root: "Projects/Research", projectId: "project-1", contextKind: "project" };
    const files = new Map(), contents = new Map(), changes = [], recorded = [];
    const folder = { path: project.root, children: [] }; files.set(folder.path, folder);
    const addNote = (path, text) => {
        const file = { path, extension: "md" }; files.set(path, file); contents.set(path, text); return file;
    };
    const first = addNote(project.root + "/Tasks.md", "# Tasks\n");
    let failStore = false, saves = 0, queue = Promise.resolve();
    const plugin = {
        app: { vault: {
            getAbstractFileByPath: path => files.get(path),
            getMarkdownFiles: () => [...files.values()].filter(file => file.extension === "md"),
            read: async file => contents.get(file.path),
            create: async (path, text) => addNote(path, text),
            process: async (file, transform) => { contents.set(file.path, transform(contents.get(file.path))); }
        } },
        projectWizard: {
            data: {}, getContextForPath: path => path === project.root || path.startsWith(project.root + "/") ? project : null,
            getProjectRecords: () => [project],
            recordTaskMutation: async edit => { recorded.push(edit); return false; }
        },
        enqueueTaskMutation(work) { const result = queue.then(work); queue = result.catch(() => {}); return result; },
        dataStore: { async save() { if (failStore) throw Error("Store unavailable"); saves++; } },
        markProjectChangedByPath: path => changes.push(path)
    };
    const editor = new HubTaskEditor(plugin);
    const receiptId = "inbox-task-1";
    const captureSource = { origin: "Quick Add", workspaceId: project.projectId, workspaceName: "Research", path: project.root + "/Paper.md", pageTitle: "Paper", pageUrl: "https://example.org/paper", binary: "excluded" };
    const expectedSource = { origin: "Quick Add", workspaceId: project.projectId, workspaceName: "Research", path: project.root + "/Paper.md", title: "Paper", url: "https://example.org/paper" };
    const options = { hubTaskId: receiptId, captureSource, necessity: "must", dueDate: "2026-10-05", steps: [{ text: "Read paper", completed: false }] };
    const results = await Promise.all([
        editor.create(project.root, "Review experiment", options),
        editor.create(project.root, "Review experiment", options)
    ]);
    assert.deepEqual(results, [first, first]);
    assert.equal((contents.get(first.path).match(/Review experiment/g) ?? []).length, 1, "Concurrent receipt retries add one task");
    assert.equal(recorded.length, 1, "Retry never records duplicate task history or progress");
    assert.equal(changes.length, 1);
    assert.equal(saves, 1);
    const snapshot = readTaskSnapshot(contents.get(first.path), { path: first.path, hubTaskId: receiptId, text: "Review experiment" });
    assert.equal(snapshot.hubTaskId, receiptId);
    assert.equal(snapshot.steps[0].text, "Read paper");
    assert.equal(editor.metadata(receiptId).dueDate, "2026-10-05");
    assert.deepEqual(editor.metadata(receiptId).captureSource, expectedSource, "Task source metadata is bounded and excludes attachments or binary data");
    await assert.rejects(() => editor.create(first.path, "Different title", options), /identity changed or was copied/);
    await assert.rejects(() => editor.create(first.path, "Review experiment\nMore content", options), /one line/);
    assert.equal(recorded.length, 1);

    const moved = addNote(project.root + "/Moved.md", contents.get(first.path));
    contents.set(first.path, "# Tasks\n");
    assert.equal(await editor.create(project.root, "Review experiment", options), moved, "Retry finds normal task after moving its source note");
    const copied = addNote(project.root + "/Copy.md", contents.get(moved.path));
    await assert.rejects(() => editor.create(project.root, "Review experiment", options), /identity changed or was copied/);
    files.delete(copied.path); contents.delete(copied.path);
    addNote(project.root + "/Example.md", "```md\n- [ ] Review experiment <!-- hub-task:" + receiptId + " -->\n```\n");
    assert.equal(await editor.create(project.root, "Review experiment", options), moved, "Code examples are not duplicate tasks");

    const before = contents.get(first.path);
    failStore = true;
    await assert.rejects(() => editor.create(first.path, "Retry after rollback", { hubTaskId: "inbox-task-2" }), /Store unavailable/);
    assert.equal(contents.get(first.path), before, "Metadata persistence failure rolls back stable-ID Markdown write");
    assert.equal(recorded.length, 1);
    failStore = false;
    await editor.create(first.path, "Retry after rollback", { hubTaskId: "inbox-task-2" });
    assert.equal((contents.get(first.path).match(/Retry after rollback/g) ?? []).length, 1);
    assert.equal(recorded.length, 2);
    await assert.rejects(() => editor.create(first.path, "Invalid", { hubTaskId: "bad --> id" }), /valid task identity/);
    await editor.create(first.path, "Existing caller");
    assert.ok(contents.get(first.path).includes("- [ ] Existing caller\n"), "Normal creation keeps its existing unassigned shape");
    const editing = await editor.read({ path: moved.path, hubTaskId: receiptId, text: "Review experiment" });
    await editor.save(editing, { location: first.path, text: editing.text, necessity: "should", steps: editing.steps });
    assert.deepEqual(editor.metadata(receiptId).captureSource, expectedSource, "Ordinary editing and moving preserve captured source even when the editor does not expose it");
    assert.equal(await editor.create(project.root, "Review experiment", options), first, "Receipt retry follows the ordinary task move");
    console.log("Task creation retries passed: stable IDs, concurrent retries, history, moved sources, identity conflicts, rollback and legacy creation.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
