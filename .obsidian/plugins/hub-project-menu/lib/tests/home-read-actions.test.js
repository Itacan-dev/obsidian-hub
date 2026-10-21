"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { fixture, notices } = require("./task-service-fixture.cjs");
const { createHomeTaskRead } = require("../services/home-task-read");
const source = "- [ ] Parent <!-- hub-task:parent -->\n    - [ ] First <!-- hub-task:first -->\n        - [ ] Nested <!-- hub-task:nested -->\n    - [x] Last <!-- hub-task:last -->\n- [ ] Sibling <!-- hub-task:sibling -->\n";
function connect(f) {
    const cleanups = []; f.plugin.taskService = f.service; f.plugin.register = fn => cleanups.push(fn);
    const home = createHomeTaskRead({ plugin: f.plugin, component: { register: fn => cleanups.push(fn) },
        resolveOwner: task => f.presentationOwner ?? f.wizard.getContextForPath(task.path), changed() {}, editTask: async (task, saved) => {
            const snapshot = await f.plugin.taskEditor.read(task); await saved(snapshot);
        } });
    return { reader: { ...home, read: async () => ({ tasks: (await home.read()).items.map(item => item.task) }) }, close: () => cleanups.forEach(fn => fn()) };
}
function normalized(snapshot) {
    const ids = new Map(snapshot.history.map((event, index) => [event.id, "event-" + index]));
    const visit = value => Array.isArray(value) ? value.map(visit) : value && typeof value === "object" ?
        Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)])) : ids.get(value) ?? value;
    return visit(snapshot);
}
async function directRow(f) { return f.plugin.taskData.readPages({ pages: () => ({ array: () => [...f.pages.values()] }) }, "Projects/Private")[0].file.tasks[0]; }
for (const operation of ["complete", "reopen", "step-complete", "step-reopen", "inline-edit", "inline-add", "inline-delete",
    "edit", "add-step", "edit-step", "delete-step", "phase", "delete", "add-task", "recurrence", "clear"]) {
    test("Home " + operation + " keeps actual legacy Markdown, metadata, history, Oath feedback and write counts", async t => {
        const oldNow = Date.now; Date.now = () => 1793000000000; t.after(() => { Date.now = oldNow; });
        const direct = fixture(), bridged = fixture(); const p = connect(bridged);
        t.after(async () => { p.close(); await direct.close(); await bridged.close(); });
        const events = [[], []], noticesBefore = notices.length;
        for (const [index, f] of [direct, bridged].entries()) {
            const content = operation === "reopen" || operation === "clear" ? source.replace("[ ] Parent", "[x] Parent") :
                operation === "step-reopen" ? source.replace("[ ] First", "[x] First") : source;
            const file = f.add("Projects/Private/Tasks.md", content);
            Object.setPrototypeOf(file, require("obsidian").TFile.prototype);
            f.plugin.oath.changed = edit => events[index].push([edit.completed, edit.operation ?? "complete"]);
            if (operation === "recurrence") f.plugin.app.plugins.plugins["obsidian-tasks-plugin"] = { apiV1: { executeToggleTaskDoneCommand:
                line => line.replace("[ ]", "[x]") + "\n- [ ] Next occurrence" } };
        }
        const old = await directRow(direct), next = (await p.reader.read()).tasks[0];
        async function act(f, task, bridge) {
            if (["complete", "reopen", "recurrence"].includes(operation)) return bridge ? bridge.toggle(task, operation !== "reopen") :
                f.plugin.toggleTask(task.path, task.line, task.text, operation !== "reopen", task.hubTaskId);
            if (operation.startsWith("step-")) {
                const request = { ...task, operation: "step", step: task.steps[0], stepCompleted: operation === "step-complete" };
                return bridge ? bridge.actions.mutate(request) : f.plugin.mutateTask(request);
            }
            if (operation.startsWith("inline-")) {
                const request = { ...task, operation: operation.slice(7).replace("edit", "edit"), value: "Replacement", position: "below" };
                return bridge ? bridge.actions.mutate(request) : f.plugin.mutateTask(request);
            }
            if (operation === "clear") return bridge ? bridge.clear([{ ...task, projectId: "private" }], false) : f.plugin.clearCompletedTasks([{ ...task, projectId: "private" }], false);
            if (operation === "add-task") return f.plugin.taskEditor.create(task.path, "Created", { hubTaskId: "created", necessity: "must", description: "Captured" });
            const reference = bridge ? await new Promise((resolve, reject) => {
                // The real editor receives the validated reference, then reads
                // its own unchanged source snapshot, exactly as openTaskEditor.
                bridge.actions.editTask(task, resolve).catch(reject);
            }) : await f.plugin.taskEditor.read(task);
            const values = { ...reference, text: operation === "edit" ? "Edited title" : reference.text };
            if (operation === "phase") values.phaseId = "phase-1";
            if (operation === "delete") values.operation = "delete";
            if (operation === "add-step") values.steps = [...reference.steps, { text: "New Step", completed: false }];
            if (operation === "edit-step") values.steps = reference.steps.map((step, index) => index ? step : { ...step, text: "Edited Step" });
            if (operation === "delete-step") values.steps = reference.steps.slice(2);
            return f.plugin.taskEditor.save(reference, values);
        }
        const oldResult = await act(direct, old), result = await act(bridged, next, p.reader);
        assert.deepEqual(normalized(bridged.snapshot()), normalized(direct.snapshot()));
        assert.deepEqual(bridged.state, direct.state); assert.deepEqual(events[1], events[0]);
        assert.equal(notices.length, noticesBefore); assert.equal(bridged.state.writes, 1);
        if (operation !== "clear") assert.equal(result.tasks?.length ?? result.existingId, oldResult.tasks?.length ?? oldResult.existingId);
    });
}
test("multiline inline edit preserves the original continuation-validation and block replacement semantics", async t => {
    const f = fixture(), p = connect(f); t.after(async () => { p.close(); await f.close(); });
    f.add("Projects/Private/Tasks.md", "- [ ] Parent <!-- hub-task:parent -->\n    Paragraph\n    - prose item\n- [ ] Other\n");
    // Dataview's actual full display text includes continuation prose/lists.
    f.pages.get("Projects/Private/Tasks.md").file.tasks[0].text += "\nParagraph\n- prose item";
    const task = (await p.reader.read()).tasks[0]; await p.reader.actions.mutate({ ...task, operation: "edit", value: "Changed" });
    assert.equal(f.contents.get(task.path), "- [ ] Changed <!-- hub-task:parent -->\n- [ ] Other\n");
});
test("ambiguous/stale action, reveal, Step and clear references never reach legacy writers", async t => {
    const f = fixture(), p = connect(f); t.after(async () => { p.close(); await f.close(); });
    f.add("Projects/Private/Tasks.md", source); const task = (await p.reader.read()).tasks[0];
    await assert.rejects(p.reader.actions.mutate({ ...task, operation: "step", step: { ...task.steps[0], text: "Wrong" }, stepCompleted: true }), { code: "STALE_REFERENCE" });
    f.add("Projects/Itacan/Copy.md", source); f.plugin.taskData.invalidateAll(); f.flush();
    await assert.rejects(p.reader.toggle(task, true), { code: "AMBIGUOUS_REFERENCE" });
    await assert.rejects(p.reader.reveal(task), { code: "AMBIGUOUS_REFERENCE" });
    await assert.rejects(p.reader.clear([task], false), { code: "AMBIGUOUS_REFERENCE" });
    assert.equal(f.state.writes, 0);
});
test("a Home reference moved across physical owners cannot clear or mutate using the previous workspace context", async t => {
    const f = fixture(), p = connect(f); t.after(async () => { p.close(); await f.close(); });
    const file = f.add("Projects/Private/Tasks.md", source), task = (await p.reader.read()).tasks[0];
    f.move(file, "Resources/Knowledge/Moved.md"); f.flush();
    await assert.rejects(p.reader.toggle(task, true), { code: "STALE_REFERENCE" });
    await assert.rejects(p.reader.clear([task], false), { code: "STALE_REFERENCE" });
    await assert.rejects(p.reader.reveal(task), { code: "STALE_REFERENCE" });
    assert.equal(f.state.writes, 0);
});
test("existing raw Resource Oath references retain their actual owner when bound by the shared Home UI", async t => {
    const f = fixture(), p = connect(f); t.after(async () => { p.close(); await f.close(); });
    f.add("Resources/Knowledge/Tasks.md", source);
    const task = f.plugin.taskData.readPages({ pages: () => ({ array: () => [...f.pages.values()] }) })[0].file.tasks[0];
    await p.reader.toggle(task, true);
    assert(f.contents.get(task.path).includes("[x] Parent")); assert.equal(f.wizard.completedTaskHistory[0].resourceType, "study");
});
test("read-session disposal preserves the existing inline cleanup commit while plugin shutdown rejects new preflight", async t => {
    const f = fixture(), p = connect(f); t.after(async () => { p.close(); await f.close(); });
    f.add("Projects/Private/Tasks.md", source); const task = (await p.reader.read()).tasks[0];
    p.close(); await p.reader.actions.mutate({ ...task, operation: "edit", value: "Saved on close" });
    assert(f.contents.get(task.path).includes("Saved on close"));
    await f.service.close();
    await assert.rejects(p.reader.actions.mutate({ ...task, operation: "edit", value: "Late" }), { code: "CLOSED" });
    assert.equal(f.state.writes, 1);
});
test("explicit Home attribution never redirects completion metadata/history away from physical owner", async t => {
    const f = fixture(); f.presentationOwner = f.owners.find(owner => owner.projectId === "itacan");
    const p = connect(f); t.after(async () => { p.close(); await f.close(); });
    f.add("Projects/Private/Tasks.md", source); const task = (await p.reader.read()).tasks[0];
    assert.deepEqual(task.homePhysicalOwner, { type: "project", id: "private" });
    await p.reader.toggle(task, true); assert.equal(f.wizard.completedTaskHistory[0].projectId, "private");
    assert(f.contents.get(task.path).includes("[x] Parent")); assert.equal(f.state.writes, 1);
});
test("explicit Project attribution outside all roots retains historically valid source actions", async t => {
    const f = fixture(); f.presentationOwner = f.owners[0]; const p = connect(f);
    t.after(async () => { p.close(); await f.close(); });
    f.add("Outside/Attributed.md", source); const task = (await p.reader.read()).tasks[0];
    assert.equal(task.homePhysicalOwner, null); assert.equal((await p.reader.reveal(task)).path, task.path);
    await p.reader.actions.mutate({ ...task, operation: "edit", value: "Outside edited safely" });
    assert(f.contents.get(task.path).includes("Outside edited safely")); assert.equal(f.state.writes, 1);
});
