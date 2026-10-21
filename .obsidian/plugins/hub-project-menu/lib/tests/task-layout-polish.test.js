"use strict";
const assert = require("assert").strict;
const { HubTaskEditor } = require("../services/task-editor");
const { readTaskSnapshot, saveTaskSnapshot } = require("../domain/task-planning");
const { taskProgressMutation } = require("../domain/task-progress");
const { randomUUID } = require("crypto");

async function verify(kind) {
    const owner = { root: kind === "project" ? "Projects/P" : "Resources/R", projectId: kind, contextKind: kind, name: kind };
    const other = { root: "Projects/Q", projectId: "q", contextKind: "project", name: "Q" };
    const path = owner.root + "/Tasks.md", target = other.root + "/Tasks.md";
    const original = "# Tasks\r\n* [ ] Parent ^native\r\n    Keep this prose\r\n    - [x] Existing Step <!-- hub-task:step-id -->\r\n        - [ ] Nested\r\n- [ ] Sibling\r\n";
    const notes = new Map([[path, original], [target, "# Destination\n"]]);
    const files = new Map([...notes.keys()].map(path => [path, { path, extension: "md" }]));
    let checks = [], history = [], fail = false, notifications = 0, release;
    const plugin = { app: { vault: { getAbstractFileByPath: path => files.get(path), read: async file => notes.get(file.path),
        process: async (file, transform) => notes.set(file.path, transform(notes.get(file.path))) } },
        projectWizard: { data: { taskMetadata: {} }, getContextForPath: path => [owner, other].find(o => path?.startsWith(o.root + "/") || path === o.root),
            recordTaskMutation: async (edit, context, at) => { const next = taskProgressMutation(checks, history, edit, context, at, randomUUID);
                checks = next.checks; history = next.history; return next.changed; } },
        planning: { phases: () => [{ id: "phase", name: "Development" }] },
        dataStore: { save: async () => { if (fail) throw Error("Metadata save failure"); } },
        enqueueTaskMutation: async run => { if (release) await release; return run(); }, markProjectChangedByPath() {},
        notifyCompletedTasksChanged: () => notifications++, taskData: { invalidate() {}, currentPath: path => path } };
    const service = new HubTaskEditor(plugin), read = (source = path) => service.read({ path: source, line: 1, text: "Parent ^native", hubTaskId: history.find(h => h.kind === "task")?.hubTaskId });
    let snapshot = await read();
    const untouched = JSON.stringify(snapshot), pending = { ...snapshot, completed: true, completedAt: 100, steps: snapshot.steps.map(step => ({ ...step })) };
    assert.equal(JSON.stringify(snapshot), untouched, "Checkbox draft cannot mutate the read snapshot");
    assert.equal(notes.get(path), original, "Draft completion has no source write");
    await service.save(snapshot, pending);
    snapshot = await read(); const id = snapshot.hubTaskId;
    assert.ok(id); assert.equal(snapshot.completed, true); assert.equal(snapshot.steps[1].completed, false);
    assert.ok(notes.get(path).includes("* [x] Parent <!-- hub-task:" + id + " --> ^native"));
    assert.ok(notes.get(path).includes("    Keep this prose\r\n    - [x] Existing Step <!-- hub-task:step-id -->\r\n        - [ ] Nested"));
    assert.equal(history.length, 1); assert.equal(history[0].timestamp, 100); assert.equal(history[0].kind, "task");
    assert.equal(history[0].projectId, owner.projectId); assert.equal(notifications, 1);
    const recorded = JSON.stringify(history);
    await service.save(snapshot, { ...snapshot, description: "**Exact**\n\nMarkdown", completedAt: 200 });
    assert.equal(JSON.stringify(history), recorded, "Saving unchanged completion does not duplicate History");
    snapshot = await read();
    await service.save(snapshot, { ...snapshot, completed: false, text: "Renamed ^native" });
    assert.equal(history.length, 0, "Unchecking and renaming removes the prior completion record");
    snapshot = await service.read({ path, line: 1, text: "Renamed ^native", hubTaskId: id });
    assert.equal(snapshot.completed, false); assert.equal(snapshot.hubTaskId, id);
    assert.equal(snapshot.description, "**Exact**\n\nMarkdown");
    const before = JSON.stringify({ notes: [...notes], metadata: plugin.projectWizard.data.taskMetadata, history, checks });
    fail = true;
    await assert.rejects(service.save(snapshot, { ...snapshot, completed: true, completedAt: 300, necessity: "must" }), /Metadata save failure/);
    fail = false;
    assert.equal(JSON.stringify({ notes: [...notes], metadata: plugin.projectWizard.data.taskMetadata, history, checks }), before, "Failed save rolls back completion and leaves History untouched");
    await service.save(snapshot, { ...snapshot, completed: true, completedAt: 400, ...(kind === "project" ? { phaseId: "phase" } : {}) });
    assert.equal(history.length, 1, "Completion with a phase change still records progress");
    assert.equal(history[0].timestamp, 400); snapshot = await service.read({ path, line: 1, text: "Renamed ^native", hubTaskId: id });
    await service.save(snapshot, { ...snapshot, completed: false, location: target, phaseId: null });
    assert.equal(history.length, 0, "Uncheck during relocation removes the original record");
    snapshot = await service.read({ path: target, line: 2, text: "Renamed ^native", hubTaskId: id });
    await service.save(snapshot, { ...snapshot, completed: true, completedAt: 500, location: path });
    assert.equal(history.length, 1); assert.equal(history[0].projectId, owner.projectId); assert.equal(history[0].path, path);
    assert.equal(history[0].hubTaskId, id); assert.equal(history[0].timestamp, 500);
    assert.equal(snapshot.steps[0].hubTaskId, "step-id");
    await service.create(target, "New task", { completed: true, completedAt: 700, description: "Description", steps: [{ text: "Step", completed: false }] });
    assert.ok(notes.get(target).includes("- [x] New task"), "Explicit creation completion uses the ordinary checked marker");
    assert.equal(history.length, 2); assert.equal(history[0].timestamp, 700);
    assert.equal(history[0].kind, "task"); assert.equal(history[0].projectId, other.projectId);
    await service.create(target, "Default task");
    assert.ok(notes.get(target).includes("- [ ] Default task"), "Existing callers still create incomplete tasks by default");
    assert.equal(history.length, 2);
    notes.set(target, "- [x] Legacy\n"); history = [{ id: "legacy", text: "Legacy", projectId: other.projectId, path: target, timestamp: 10 }];
    checks = [{ historyId: "legacy", text: "Legacy", path: target, line: 0, timestamp: 10 }];
    snapshot = await service.read({ path: target, line: 0, text: "Legacy" });
    await service.save(snapshot, { ...snapshot, text: "Legacy edited", completed: false });
    assert.equal(history.length, 0, "Legacy completion without task ID reverses correctly");
    assert.equal(notes.get(target), "- [ ] Legacy edited\n");
}
async function run() {
    await verify("project"); await verify("resource");
    const source = "- [/] Custom status\n";
    const snapshot = readTaskSnapshot(source, { path: "Tasks.md", line: 0, text: "Custom status" });
    assert.equal(saveTaskSnapshot(source, snapshot, { ...snapshot, completed: false }).content, source, "Unchanged custom status survives");
}
run().then(() => console.log("PASS: main-task draft completion, exact timestamps, identities/native block IDs, nested Steps, metadata/History retention, phase changes, rollback, relocation, legacy unchecking and optional completed creation.")).catch(error => { console.error(error); process.exitCode = 1; });
