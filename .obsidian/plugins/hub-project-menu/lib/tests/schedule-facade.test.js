"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./task-service-fixture.cjs");
const { legacyReadTask, legacyActionRequest } = require("../services/task-service-legacy-bridge");
const { TaskReadSession } = require("../services/task-read-session");
const source = "- [ ] Parent <!-- hub-task:parent -->\n    - [ ] Child <!-- hub-task:child -->\n";
function normalizeEvents(snapshot) {
    const ids = new Map(snapshot.history.map((event, index) => [event.id, "event-" + index]));
    const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === "object" ?
        Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)])) : ids.get(value) ?? value;
    return normalize(snapshot);
}
for (const operation of ["complete", "step", "edit"]) test(`Schedule ${operation} compatibility calls the unchanged legacy writer with identical source/history effects`, async t => {
    const previousNow = Date.now; Date.now = () => 1793000000000; t.after(() => { Date.now = previousNow; });
    const direct = fixture(), bridged = fixture(); t.after(async () => { await direct.close(); await bridged.close(); });
    for (const f of [direct, bridged]) f.add("Projects/Private/Tasks.md", source);
    async function request(f) {
        const query = await f.service.queryStructured({ workspace: { type: "project", id: "private" }, policy: "workspace" });
        const task = legacyReadTask(query.rows[0].view);
        return operation === "step" ? { ...task, operation: "step", step: task.steps[0], stepCompleted: true } :
            operation === "edit" ? { ...task, operation: "edit", value: "Renamed Parent" } : { ...task, completed: true };
    }
    const originalRequest = await request(direct), projectedRequest = await request(bridged);
    const writes = bridged.state.writes;
    const legacyRequest = await legacyActionRequest(bridged.service, projectedRequest);
    assert.equal(bridged.state.writes, writes, "Action resolution is a read");
    await direct.plugin.mutateTask(originalRequest); await bridged.plugin.mutateTask(legacyRequest);
    assert.deepEqual(normalizeEvents(bridged.snapshot()), normalizeEvents(direct.snapshot()));
    assert.equal(bridged.state.writes, 1); assert.equal(bridged.state.metadataSaves, 0);
});
test("Schedule read session refreshes only after the established indexed import and retains no extra watcher after close", async t => {
    const f = fixture(); t.after(() => f.close()); const file = f.add("Projects/Private/Tasks.md", source);
    let invalidations = 0; const session = new TaskReadSession(f.service, () => invalidations++);
    const options = { workspace: { type: "project", id: "private" }, policy: "workspace", validation: "indexed" };
    const first = await session.read(options); assert.equal(first.rows[0].view.completed, false);
    f.contents.set(file.path, source.replace("[ ] Parent", "[x] Parent")); f.vault.emit("modify", file); f.flush();
    assert.equal(await session.read(options), first, "Raw modification does not claim completed Dataview import");
    f.index(file); f.metadataCache.emit("dataview:metadata-change", "update", file); f.flush();
    const next = await session.read(options); assert.notEqual(next, first); assert.equal(next.rows[0].view.completed, true);
    assert.equal(invalidations, 1); assert.equal(f.plugin.taskData.subscribers.size, 1);
    session.close(); session.close(); assert.equal(f.plugin.taskData.subscribers.size, 0); assert.equal(f.state.writes, 0);
});
