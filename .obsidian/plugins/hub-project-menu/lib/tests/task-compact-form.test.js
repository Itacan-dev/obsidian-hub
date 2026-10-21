"use strict";
const assert = require("assert").strict;
const { taskDatesButtonLabel, validateTaskDates, initialTaskLocation } = require("../domain/task-compact-form");
const { HubTaskEditor } = require("../services/task-editor");
const { taskMetadata } = require("../domain/task-planning");
const now = new Date(2026, 9, 12);
for (const [state, label] of [
    [{}, "Dates"], [{ dueDate: "2026-10-14" }, "Due 14 Oct"],
    [{ dueDate: "2026-10-14", dueTime: "12:00" }, "Due 14 Oct, 12:00"],
    [{ fromDate: "2026-10-12" }, "Start 12 Oct"],
    [{ fromDate: "2026-10-12", dueDate: "2026-10-14" }, "12–14 Oct"],
    [{ fromDate: "2026-10-01", dueDate: "2026-10-14" }, "1–14 Oct"],
    [{ fromDate: "2026-10-12", fromTime: "09:00", dueDate: "2026-10-14", dueTime: "12:00" }, "12 Oct, 09:00 – 14 Oct, 12:00"],
    [{ fromDate: "2026-10-12", dueDate: "2026-10-12", dueTime: "00:00" }, "12 Oct – 12 Oct, 00:00"],
    [{ fromDate: "2026-10-12", fromTime: "09:00", dueDate: "2026-10-12" }, "12 Oct, 09:00 – 12 Oct"],
    [{ fromDate: "2026-10-31", dueDate: "2026-11-02" }, "31 Oct – 2 Nov"],
    [{ fromDate: "2026-12-31", dueDate: "2027-01-02" }, "31 Dec 2026 – 2 Jan 2027"],
    [{ fromDate: "2027-10-12", dueDate: "2027-10-14" }, "12–14 Oct 2027"]
]) assert.equal(taskDatesButtonLabel(state, now), label);
assert.throws(() => validateTaskDates({ fromDate: "2026-10-14", dueDate: "2026-10-12" }), /Due/);
assert.throws(() => validateTaskDates({ fromDate: "2026-10-12", fromTime: "12:00", dueDate: "2026-10-12", dueTime: "09:00" }), /Due time/);
assert.throws(() => validateTaskDates({ dueTime: "12:00" }), /date/);
assert.throws(() => validateTaskDates({ dueDate: "2026-02-30" }), /valid date/);
for (const state of [{}, { fromDate: "2026-10-12" }, { dueDate: "2026-10-12", dueTime: "00:00" },
    { fromDate: "2026-10-12", fromTime: "12:00", dueDate: "2026-10-12" }]) validateTaskDates(state);
const p = { root: "Projects/P", projectId: "p", name: "P", contextKind: "project", status: "active" };
const q = { root: "Projects/Q", projectId: "q", name: "Q", contextKind: "project", status: "active" };
const r = { root: "Resources/R", projectId: "r", name: "R", contextKind: "resource" };
const contexts = [p, q, r], context = path => contexts.find(owner => path === owner.root || path?.startsWith(owner.root + "/"));
let active = "Home.md";
const locations = root => contexts.filter(owner => !root || root === owner.root).flatMap(workspace => [{ path: workspace.root, workspace, folder: true }, { path: workspace.root + "/Tasks.md", workspace }]);
const routing = { app: { workspace: { getActiveFile: () => ({ path: active }) } }, context, locations };
assert.equal(initialTaskLocation(routing), "");
assert.equal(initialTaskLocation(routing, { root: p.root }), p.root);
active = p.root + "/Tasks.md";
assert.equal(initialTaskLocation(routing), active);
assert.equal(initialTaskLocation({ ...routing, currentContext: () => null }), "", "Authoritative Home context overrides stale active note");
assert.equal(initialTaskLocation(routing, { location: r.root, root: p.root }), r.root);
assert.equal(initialTaskLocation(routing, { location: "missing/path" }), "missing/path", "Never silently substitute another destination");

async function persistence() {
    const path = p.root + "/Tasks.md", target = r.root + "/Tasks.md";
    const original = "---\r\ntitle: Preserved\r\n---\r\n# Tasks\r\n- [x] Parent ^native\r\n    Original prose\r\n    - [x] Step <!-- hub-task:step-1 -->\r\n        - [ ] Nested\r\n    ```md\r\n    - [ ] Code, not a step\r\n    ```\r\n\r\nOutside content\r\n- [ ] Unrelated\r\n";
    const objects = new Map([path, target, q.root + "/Tasks.md"].map(path => [path, { path, extension: "md" }]));
    const contents = new Map([[path, original], [target, "# Target\n"], [q.root + "/Tasks.md", "# Q\n"]]);
    let stored, fail = false;
    const plugin = { app: { vault: { getAbstractFileByPath: path => objects.get(path), read: async file => contents.get(file.path),
        process: async (file, transform) => contents.set(file.path, transform(contents.get(file.path))) } },
        projectWizard: { data: { taskMetadata: {} }, getContextForPath: context, recordTaskMutation: async () => false },
        planning: { phases: id => [{ id: "phase-" + id, name: "Phase" }] },
        dataStore: { save: async data => { if (fail) { fail = false; throw Error("Disk conflict"); } stored = JSON.parse(JSON.stringify(data)); } },
        enqueueTaskMutation: run => run(), markProjectChangedByPath() {}, taskData: { invalidate() {}, currentPath: path => path } };
    let service = new HubTaskEditor(plugin), snapshot = await service.read({ path, line: 4, text: "Parent ^native" });
    const description = "  **Markdown**\n\n- [ ] This is description text, never a Step\n```js\nconst value = '<!-- hub-task:not-an-id -->';\n```\n";
    await service.save(snapshot, { ...snapshot, description, phaseId: "phase-p" });
    const id = stored.taskMetadata && Object.keys(stored.taskMetadata)[0]; assert.ok(id);
    assert.equal(contents.get(path).replace(/ <!-- hub-task:[\w-]+ --> (?=\^native)/, " "), original, "Only stable parent identity added; source and nested structure untouched");
    plugin.projectWizard.data = JSON.parse(JSON.stringify(stored)); service = new HubTaskEditor(plugin);
    snapshot = await service.read({ path, line: 4, text: "Parent ^native", hubTaskId: id });
    assert.equal(snapshot.description, description); assert.equal(snapshot.steps.length, 2); assert.equal(snapshot.completed, true);
    await service.save(snapshot, { text: snapshot.text, steps: snapshot.steps, phaseId: snapshot.phaseId });
    snapshot = await service.read(snapshot);
    assert.equal(snapshot.description, description, "Other adapters that omit description retain it");
    const before = JSON.stringify([...contents]); fail = true;
    await assert.rejects(service.save(snapshot, { ...snapshot, description: "Changed", location: target, phaseId: null }), /Disk conflict/);
    assert.equal(JSON.stringify([...contents]), before, "Failed relocation rolls back both notes");
    assert.equal(service.metadata(id).description, description);
    await assert.rejects(service.save(snapshot, { ...snapshot, location: target }), /task's Project/);
    await assert.rejects(service.save(snapshot, { ...snapshot, location: q.root + "/Tasks.md" }), /no longer available/);
    await service.save(snapshot, { ...snapshot, location: target, phaseId: null });
    snapshot = await service.read({ ...snapshot, path: target });
    assert.equal(snapshot.description, description); assert.equal(snapshot.hubTaskId, id); assert.equal(snapshot.phaseId, undefined);
    assert.equal(snapshot.steps[0].hubTaskId, "step-1"); assert.equal(snapshot.completed, true);
    assert.ok(contents.get(path).includes("Outside content\r\n- [ ] Unrelated"));
    const stale = { ...snapshot }; await service.save(snapshot, { ...snapshot, description: "new description" });
    await assert.rejects(service.save(stale, { ...stale, description: "stale overwrite" }), /metadata changed/);
    snapshot = await service.read(snapshot); const beforeClear = contents.get(target);
    await service.save(snapshot, { ...snapshot, description: "" });
    snapshot = await service.read(snapshot); assert.equal(snapshot.description, undefined); assert.equal(contents.get(target), beforeClear);
    await service.save(snapshot, { operation: "delete" }); assert.equal(service.metadata(id).description, undefined);
    await service.create(target, "Created", { description, steps: [{ text: "New Step", completed: false }] });
    const line = contents.get(target).split("\n").findIndex(line => line.startsWith("- [ ] Created"));
    const created = await service.read({ path: target, line, text: "Created" }); assert.equal(created.description, description);
    assert.equal(created.steps.length, 1); assert.equal(created.completed, false);
    assert.deepEqual(taskMetadata({ description: "" }), taskMetadata({}), "Legacy tasks need no migration");
}
persistence().then(() => console.log("PASS: compact date ranges, independent dates/times, context defaults, descriptions across reload/edit/clear/delete, Markdown safety, identity, cross-workspace relocation, phase checks, rollback and stale-editor protection.")).catch(error => { console.error(error); process.exitCode = 1; });
