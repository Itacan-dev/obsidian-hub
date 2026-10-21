"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { createHomeFixture, originalHome, homeFacts, homeOwnerResolver } = require("./home-read-fixture.cjs");
const { createHomeTaskRead } = require("../services/home-task-read");
function consumer(f, changed = () => {}) {
    const cleanup = [], reader = createHomeTaskRead({ plugin: f.plugin, component: { register: fn => cleanup.push(fn) }, changed,
        resolveOwner: homeOwnerResolver(f), editTask: () => {} });
    return { reader, close: () => cleanup.forEach(fn => fn()) };
}
const split = items => ({ projectTasks: items.filter(item => item.owner.contextKind !== "resource"), resourceTasks: items.filter(item => item.owner.contextKind === "resource") });
test("actual original Home inclusion, full task/Step fields, grouping, ordering and both owners match", async () => {
    const f = createHomeFixture(), before = f.state(), original = homeFacts(f, originalHome(f)), c = consumer(f);
    const result = await c.reader.read();
    assert.deepEqual(homeFacts(f, split(result.items)), original);
    assert.deepEqual(original, require("./home-read-baseline.json"));
    assert.equal(f.state(), before); assert.equal(f.counts.writes, 0); assert.equal(f.counts.sources, 0);
    c.close(); await f.close();
});
for (const [id, presentation, physical] of [["outside", "app", null], ["attributed", "app", "other"],
    ["resource-first", "resource:study", "resource:study"], ["mounted", "resource:study", "resource:study"],
    ["inactive-reference", "other", "app"], ["global-template", "app", null], ["global-hidden", "app", null]]) {
    test("Home ownership: " + id, async () => {
        const f = createHomeFixture(), c = consumer(f), result = await c.reader.read(), item = result.items.find(item => item.task.hubTaskId === id);
        assert(item); assert.equal(item.owner.contextKind === "resource" ? "resource:" + item.owner.resourceType : item.owner.projectId, presentation);
        assert.equal(item.task.homePhysicalOwner ? (item.task.homePhysicalOwner.type === "resource" ? "resource:" : "") + item.task.homePhysicalOwner.id : null, physical);
        if (presentation === "app") assert.equal(item.owner, f.projects[0]);
        c.close(); await f.close();
    });
}
test("typed global Home policy rejects scoped composition and returns portable reference evidence", async () => {
    const f = createHomeFixture(); await assert.rejects(f.plugin.taskService.queryStructured({ policy: "home", workspace: { type: "project", id: "app" } }));
    const query = await f.plugin.taskService.queryStructured({ policy: "home" });
    const outside = query.rows.find(row => row.view?.legacy.hubTaskId === "outside");
    assert.deepEqual(outside.home, { physicalOwner: null, projectReference: "Projects/App/App.md" });
    assert.equal(JSON.parse(JSON.stringify(query)).rows.length, query.rows.length);
    await f.close();
});
test("cached reads share one scan; invalidation retries; unchanged projection is acknowledged only after publication", async () => {
    const f = createHomeFixture(), c = consumer(f); f.counts.indexes = 0;
    const a = await c.reader.read(); assert(a.changed); assert((await c.reader.read()).changed);
    c.reader.accept(a.items); assert.equal((await c.reader.read()).changed, false); assert.equal(f.counts.indexes, 1);
    f.plugin.taskData.invalidateAll(); f.flush(); assert.equal((await c.reader.read()).changed, false); assert.equal(f.counts.indexes, 2);
    c.close(); await f.close();
});
test("mutable Project status/deletion and explicit reference invalidation retain registry objects", async () => {
    const f = createHomeFixture(), c = consumer(f), a = await c.reader.read(); c.reader.accept(a.items);
    f.projects[0].status = "shelved"; let b = await c.reader.read(); assert(b.changed); assert.equal(b.items.find(item => item.task.hubTaskId === "outside").owner, f.projects[0]);
    f.pages.get("Outside/Attributed.md").project = "Other"; f.plugin.taskData.invalidateAll(); f.flush();
    b = await c.reader.read(); assert.equal(b.items.find(item => item.task.hubTaskId === "outside").owner, f.projects[1]);
    c.close(); await f.close();
});
test("copied parent/Step IDs, ID-less duplicates and bad locators preserve other rows without writes", async () => {
    const f = createHomeFixture(); f.addTask("Projects/App/Copied.md", "Copy", "outside");
    f.addTask("Projects/App/Copied.md", "No ID"); f.addTask("Projects/App/Copied.md", "No ID");
    f.addTask("Projects/App/Invalid.md", "Invalid locator", "invalid").line = -1;
    f.pages.get("Projects/App/Copied.md").file.tasks.push({ text: null });
    const c = consumer(f), result = await c.reader.read();
    assert(result.items.filter(item => item.task.hubTaskId === "outside").every(item => item.task.identityConflict));
    assert(result.items.filter(item => item.task.text === "No ID").every(item => item.task.identityConflict));
    assert(result.items.some(item => item.task.text === "Invalid locator" && item.task.identityConflict));
    assert(result.items.some(item => item.task.hubTaskId === "rich")); assert(result.diagnostics.length >= 4); assert.equal(f.counts.writes, 0);
    c.close(); await f.close();
});
test("query failure differs from empty and recovers without a raw reader fallback", async () => {
    const f = createHomeFixture(), c = consumer(f), a = await c.reader.read(); c.reader.accept(a.items);
    f.dv.index.initialized = false; f.plugin.taskData.invalidateAll(); f.flush();
    await assert.rejects(c.reader.read(), { code: "INDEX_UNAVAILABLE" });
    f.dv.index.initialized = true; assert.equal((await c.reader.read()).changed, false);
    c.close(); await f.close();
});
test("old A cannot publish after newer B; close cancels pending read and removes only owned subscription", async () => {
    const f = createHomeFixture(), service = f.plugin.taskService, queue = [];
    f.plugin.taskService = { queryStructured: options => new Promise((resolve, reject) => queue.push({ resolve, reject, options })),
        subscribe: fn => service.subscribe(fn), close: () => service.close() };
    const c = consumer(f), first = c.reader.read(); await Promise.resolve();
    f.plugin.taskData.invalidateAll(); f.flush(); const second = c.reader.read(); await Promise.resolve();
    const fresh = await service.queryStructured({ policy: "home" }); queue[1].resolve(fresh); assert((await second).items.length);
    queue[0].resolve(fresh); assert.equal(await first, null);
    f.plugin.taskData.invalidateAll(); f.flush(); const pending = c.reader.read(); await Promise.resolve(); c.close(); queue[2].resolve(fresh); assert.equal(await pending, null);
    assert((await service.queryStructured()).rows.length); await f.close();
});
test("repeated Home sessions share the facade watcher and dispose independently", async () => {
    const f = createHomeFixture();
    for (let i = 0; i < 20; i++) { const a = consumer(f), b = consumer(f); await a.reader.read(); assert.equal(f.plugin.taskData.subscribers.size, 1);
        a.close(); assert((await b.reader.read()).items.length); b.close(); assert.equal(f.plugin.taskData.subscribers.size, 0); }
    await f.close();
});
test("Home metadata failures retain the affected display row and all unrelated valid tasks", async t => {
    const f = createHomeFixture(), previous = f.plugin.taskData.metadata;
    f.plugin.taskData.metadata = id => { if (id === "timed") throw Error("Metadata unavailable"); return previous(id); };
    const c = consumer(f); t.after(async () => { c.close(); await f.close(); });
    const result = await c.reader.read();
    assert(result.items.some(item => item.task.hubTaskId === "timed" && item.task.identityConflict));
    assert(result.items.some(item => item.task.hubTaskId === "outside" && !item.task.identityConflict));
    assert(result.diagnostics.some(item => item.code === "METADATA_UNAVAILABLE"));
    assert.equal(f.counts.sources, 0); assert.equal(f.counts.writes, 0);
});
