"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { createReadFixture, scheduleFacts } = require("./task-read-fixture.cjs");
const { legacyReadTask, legacyActionRequest } = require("../services/task-service-legacy-bridge");
const { TaskReadSession } = require("../services/task-read-session");
const baseline = require("./task-read-parity.json");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function setup(t) { const f = createReadFixture(); t.after(() => f.close()); return f; }
test("structured workspace reads preserve exact old Schedule task, date, group and calendar inputs", async t => {
    const f = setup(t), before = f.state();
    const query = await f.plugin.taskService.queryStructured({ workspace: { type: "project", id: "app" }, policy: "workspace", validation: "indexed" });
    assert.deepEqual(scheduleFacts(query.rows.filter(row => row.view).map(row => legacyReadTask(row.view))), baseline.schedule);
    assert.equal(f.counts.indexes, 1); assert.equal(f.counts.sources, 0); assert.equal(f.counts.writes, 0); assert.equal(f.state(), before);
    assert(query.rows.every(row => row.view.owner.id === "app" && !row.view.source.path.includes("/System/")));
});
test("source-checked structured reads batch sources and retain Steps/metadata without assigning IDs", async t => {
    const f = setup(t), before = f.state();
    const query = await f.plugin.taskService.queryStructured({ validation: "source" });
    assert(query.rows.every(row => row.state === "validated"));
    const assignment = query.rows.find(row => row.view.handle.identity?.value === "assignment").view;
    assert.equal(assignment.title, "Assignment"); assert.equal(assignment.compatibility.displayText, "Assignment\ncontinuation evidence");
    assert.deepEqual(assignment.steps.map(step => [step.title, step.completed]), [["First", true], ["Next", false]]);
    assert.equal(assignment.legacy.steps[1].text, "Next"); assert.equal(assignment.description, "Metadata prose");
    assert(query.rows.some(row => row.view.handle.identity === null));
    assert.equal(f.counts.sources, new Set(query.rows.map(row => row.view.source.path)).size);
    assert.equal(f.counts.indexes, 1); assert.equal(f.state(), before); assert.equal(f.counts.writes, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(query)), query);
});
test("indexed and checked Step ancestry agree through ordinary intervening list items", async t => {
    const f = setup(t), path = "Projects/App/Tasks/Nested.md";
    const task = f.addTask(path, "Parent", "nested-parent", { steps: [{ title: "Outer", id: "outer" }] });
    const outer = task.children[0], list = { path, line: outer.line + 1, parent: outer.line, task: false, text: "Context", children: [] };
    const inner = { path, line: outer.line + 2, parent: list.line, task: true, text: "Inner <!-- hub-task:inner -->", completed: false, children: [] };
    list.children.push(inner); outer.children.push(list); f.pages.get(path).file.tasks.push(inner); f.pages.get(path).file.lists.push(list, inner);
    f.contents.set(path, f.contents.get(path) + "        - Context\n            - [ ] Inner <!-- hub-task:inner -->\n");
    for (const validation of ["indexed", "source"]) {
        const query = await f.plugin.taskService.queryStructured({ validation });
        const view = query.rows.find(row => row.view?.handle.identity?.value === "nested-parent").view;
        assert.deepEqual(view.steps[1].parent, view.steps[0].handle);
        assert.deepEqual(view.steps.map(step => step.title), ["Outer", "Inner"]);
    }
    assert.equal(f.counts.writes, 0);
});
test("global copied parent/Step identities stay diagnostic in a scoped structured query", async t => {
    const f = setup(t);
    f.addTask("Resources/Knowledge/Copy.md", "Copy", "due");
    f.addTask("Projects/Other/Step.md", "Other", "other-step", { steps: [{ id: "next", title: "Copy Step" }] });
    const query = await f.plugin.taskService.queryStructured({ workspace: { type: "project", id: "app" }, policy: "workspace", validation: "source" });
    for (const id of ["due", "assignment"]) {
        const row = query.rows.find(row => row.view?.handle.identity?.value === id);
        assert.equal(row.state, "ambiguous"); assert.equal(row.view.capabilities.attemptReveal, false);
    }
    assert(query.rows.some(row => row.state === "validated")); assert.equal(f.counts.writes, 0);
});
test("failed/stale source rows cannot become eligible; other rows survive", async t => {
    const f = setup(t), file = "Projects/App/Tasks/Due only.md";
    f.contents.set(file, "# changed\n- [ ] A different task\n");
    const query = await f.plugin.taskService.queryStructured({ validation: "source" });
    const row = query.rows.find(row => row.view?.legacy.path === file);
    assert.equal(row.state, "unresolved"); assert.equal(row.view.validation, "indexed"); assert.equal(row.view.capabilities.attemptReveal, false);
    assert(query.rows.some(row => row.state === "validated")); assert(query.diagnostics.length); assert.equal(f.counts.writes, 0);
});
test("saved target compatibility resolves IDs/moves and rejects stale IDs, Steps and title locators", async t => {
    const f = setup(t), service = f.plugin.taskService;
    const target = { path: "Projects/App/Tasks/Continuation.md", taskId: "assignment", stepId: "next" };
    assert.equal((await service.resolveSavedTarget(target)).legacy.steps[1].hubTaskId, "next");
    await assert.rejects(service.resolveSavedTarget({ ...target, stepId: "gone" }));
    const old = "Projects/App/Tasks/ID-less.md";
    const row = (await service.queryStructured()).rows.find(row => row.view?.legacy.path === old);
    assert.equal((await service.resolveSavedTarget({ path: old, taskText: row.view.legacy.text, taskLine: row.view.legacy.line })).handle.identity, null);
    await assert.rejects(service.resolveSavedTarget({ path: old, taskText: row.view.legacy.text, taskLine: 999 }));
    const moved = "Projects/App/Tasks/Moved.md", page = f.pages.get(target.path), file = f.files.get(target.path);
    f.files.delete(target.path); f.pages.delete(target.path); file.path = moved; page.file.path = moved;
    f.files.set(moved, file); f.pages.set(moved, page); f.contents.set(moved, f.contents.get(target.path));
    assert.equal((await service.resolveSavedTarget(target)).legacy.path, moved); assert.equal(f.counts.writes, 0);
});
test("legacy action requests are freshly validated and preserve the old mutation intent and Step", async t => {
    const f = setup(t), service = f.plugin.taskService;
    const view = (await service.queryStructured()).rows.find(row => row.view?.handle.identity?.value === "assignment").view;
    const task = legacyReadTask(view), request = { ...task, operation: "step", step: task.steps[1], stepCompleted: true };
    const resolved = await legacyActionRequest(service, request);
    assert.equal(resolved.operation, "step"); assert.equal(resolved.stepCompleted, true); assert.equal(resolved.step.hubTaskId, "next");
    assert.equal(resolved.text, "Assignment", "Existing writers receive the source first line, not a display DTO or continuation");
    f.contents.set(task.path, f.contents.get(task.path).replace("Next", "Different"));
    await assert.rejects(legacyActionRequest(service, request)); assert.equal(f.counts.writes, 0);
});
test("read sessions coalesce, invalidate pending generations, isolate scopes and dispose subscriptions", async () => {
    const calls = [], callbacks = new Set(), restarted = deferred();
    const facade = { subscribe: fn => { callbacks.add(fn); return () => callbacks.delete(fn); }, queryStructured: options => {
        const pending = deferred(); calls.push({ options, pending }); if (calls.length === 2) restarted.resolve(); return pending.promise;
    } };
    const session = new TaskReadSession(facade); const first = session.read({ validation: "source" });
    const second = session.read({ validation: "source" }); await Promise.resolve(); assert.equal(calls.length, 1);
    for (const fn of callbacks) fn(); calls[0].pending.resolve({ old: true });
    await restarted.promise;
    assert.equal(calls.length, 2); calls[1].pending.resolve({ current: true });
    assert.deepEqual(await first, { current: true }); assert.deepEqual(await second, { current: true });
    const pending = session.read({ workspace: { type: "project", id: "other" } }); await Promise.resolve();
    session.close(); calls[2].pending.reject(Error("late failure")); assert.equal(await pending, null); assert.equal(callbacks.size, 0);
});
test("plugin facade shutdown during source validation rejects the pending read and late action without writes", async t => {
    const f = setup(t), entered = deferred(), release = deferred(), read = f.vault.read;
    f.vault.read = async file => { entered.resolve(); await release.promise; return read(file); };
    const pending = f.plugin.taskService.queryStructured({ validation: "source" });
    await entered.promise; await f.plugin.taskService.close(); release.resolve();
    await assert.rejects(pending, error => error.code === "CLOSED"); assert.equal(f.counts.writes, 0);
    await assert.rejects(f.plugin.taskService.resolveLegacyAction({ kind: "legacy", identity: { kind: "hidden-id", value: "due" },
        locator: { path: "Projects/App/Tasks/Due only.md", line: 1, expectedTitle: "Due only" } }), error => error.code === "CLOSED");
});
