"use strict";
const test = require("node:test"), S = require("./history-support.cjs"), { assert } = S;
const { createTaskHistoryRead } = require(S.lib + "services/task-history-read");
test("actual History reader uses owner-qualified UUID navigation, keeps recorded title and never requires a source", async t => {
 const f = await S.fixture(t), task = await f.create({ text: "Recorded title", completed: true });
 const service = f.runtime.formService({}), draft = await service.read(task); await service.save(draft, { ...draft, operation: "edit", text: "Later title" });
 const reader = createTaskHistoryRead({ plugin: { register() {}, taskService: { queryHistory() { throw Error("Legacy fallback"); } }, app: { vault: { getAbstractFileByPath() { throw Error("Native source lookup"); } } } }, component: f.component(), completionFeed: f.feed });
 const r = await reader.read(), record = r.records[0]; assert.equal(record.text, "Recorded title"); for (const key of ["path", "line", "hubTaskId"]) assert(!Object.hasOwn(record, key));
 assert.deepEqual(await reader.reveal(record), { kind: "native-task", taskId: task.id, owner: f.owner }); reader.close(); assert.throws(() => reader.reveal(record));
});
test("deleting task or retired Step retains counted History with unavailable navigation", async t => {
 const f = await S.fixture(t), task = await f.create({ completed: true, steps: [{ text: "Checked", completed: true }] });
 const form = f.runtime.formService({}), draft = await form.read(task); await form.save(draft, { ...draft, steps: [], operation: "edit" });
 let r = await f.read(); assert.equal(r.completions.length, 2); const step = r.records.find(r => r.kind === "step"); assert.equal(step.nativeHistory.navigation.state, "retired-step"); await assert.rejects(f.feed.reveal(step));
 const e = await f.runtime.editor(task.id); await f.runtime.mutate(S.B.remove(e)); r = await f.read(); assert.equal(r.completions.length, 2); assert(r.records.every(r => r.nativeHistory.navigation.state === "deleted")); await assert.rejects(f.feed.reveal(r.records[0]));
});
test("published replay returns the original event once; parent and Steps reopen independently", async t => {
 const f = await S.fixture(t), task = await f.create(); const { intent } = await f.complete(task.id, true); const before = await f.read(); assert.equal((await f.runtime.replay(intent.operationId)).status, "replayed"); assert.deepEqual((await f.read()).completions, before.completions);
 await f.complete(task.id, true, task.steps[0].id); await f.complete(task.id, false); let r = await f.read(); assert.equal(r.completions.length, 1); assert.equal(r.completions[0].kind, "step"); await f.complete(task.id, true); r = await f.read(); assert.equal(r.completions.length, 2); assert.notEqual(r.completions.find(r => r.kind === "task").id, before.completions[0].id);
});
