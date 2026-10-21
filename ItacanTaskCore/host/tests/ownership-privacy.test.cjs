"use strict";
const test = require("node:test"), H = require("./support.cjs"), { assert } = H;
const { TaskService } = require(H.root + "/.obsidian/plugins/hub-project-menu/lib/services/task-service");
for (const owner of H.owners) test("N0 physical owner, proof and source-free navigation: " + owner.partitionId, async t => {
    const v = await H.fixture(t), task = await v.create({ owner: owner.owner }), target = v.target(task), service = new TaskService(H.API.createNativeReadAdapter(v.host)); t.after(() => service.close());
    const r = await service.read({ backend: "native", operation: "committed", workspace: owner.owner, references: [{ kind: "native", id: task.id }] }); assert.equal(r.status, "ok"); assert.equal(r.rows[0].state, "resolved"); assert.deepEqual(r.rows[0].task.owner, owner.owner); assert(!("partitionId" in r.rows[0].task));
    const nav = await service.read({ backend: "native", operation: "navigation", handle: { kind: "native", id: task.id }, mode: "task" }); assert.deepEqual(nav.target, { kind: "native-task", id: task.id });
    const missingLocation = await service.read({ backend: "native", operation: "navigation", handle: { kind: "native", id: task.id }, mode: "location" }); assert.equal(missingLocation.state, "missing-location");
    assert.equal((await v.proof([target])).rows[0].resolution.state, "resolved-native");
});
for (const project of H.owners.slice(0, 2)) for (const resource of H.owners.slice(3)) test("mount " + resource.partitionId + " into " + project.partitionId + " preserves privacy/owner", async t => {
    const v = await H.fixture(t), task = await v.create({ owner: resource.owner }); v.reg.change(s => { s.owners.find(o => o.partitionId === project.partitionId).mounts.push(resource.owner); });
    const result = await v.read(); assert.deepEqual(result.snapshot.tasks[0].owner, resource.owner); assert.equal(result.snapshot.tasks[0].partitionId, resource.partitionId); const foreign = H.clone(v.target(task)); foreign.owner = project.owner; foreign.authority.partitionId = project.partitionId; assert.equal((await v.proof([foreign])).rows[0].task, null);
});
for (const change of ["unavailable", "missing-dashboard", "wrong-partition", "deleted-owner"]) test("registry failure is explicit: " + change, async t => {
    const v = await H.fixture(t); await v.create(); v.reg.change(s => { const o = s.owners[2]; if (change === "unavailable") o.available = false; if (change === "missing-dashboard") o.dashboard = null; if (change === "wrong-partition") o.partitionId = "unmapped"; if (change === "deleted-owner") s.owners.splice(2, 1); }); assert.notEqual((await v.host.refresh()).readiness.state, "ready");
});
test("shelved owner excludes new candidates but retains committed hydration", async t => { const v = await H.fixture(t), task = await v.create(), service = new TaskService(H.API.createNativeReadAdapter(v.host)); t.after(() => service.close()); v.reg.change(s => { s.owners[2].status = "shelved"; }); const candidates = await service.read({ backend: "native", operation: "candidates", workspace: task.owner }); assert.equal(candidates.rows.length, 0); const r = await service.read({ backend: "native", operation: "committed", workspace: task.owner, references: [{ kind: "native", id: task.id }] }); assert.equal(r.rows[0].state, "resolved"); });
test("History, provenance, mutation and legacy-backend fallback are unsupported", async t => {
    const v = await H.fixture(t), service = new TaskService(H.API.createNativeReadAdapter(v.host)); t.after(() => service.close());
    for (const selection of ["retained", "counted", "current-bindings", "legacy-statistics"]) assert.equal((await service.read({ backend: "native", operation: "history", selection })).status, "unsupported");
    assert.equal((await service.read({ backend: "legacy-markdown", operation: "structured" })).code, "BACKEND_MISMATCH");
    await assert.rejects(async () => service.setCompleted({}, true)); assert.equal(v.host.info().permissions.mutations, "unsupported");
});
test("actual registry helpers resolve physical roots; labels and mounts do not assign owner", () => {
    const C = require(H.root + "/.obsidian/plugins/hub-project-menu/lib/domain/contexts"), projects = H.owners.slice(0, 3).map(o => ({ projectId: o.owner.id, root: o.root, name: "Same label", path: o.dashboard }));
    assert.equal(C.findProjectById(projects, "hub").root, "Projects/Obsidian Hub"); assert.equal(C.findProjectForPath(projects, "Resources/Knowledge/Tasks.md"), null); assert.equal(C.findProjectForPath(projects, "Projects/Itacan/Tasks.md").projectId, "itacan");
});
test("DTOs, errors, callbacks and info omit private sentinels and root/lease details", async t => {
    const v = await H.fixture(t); const task = await v.create({ captureSource: { path: "SOURCE_SECRET" }, migration: { source: "private", sourceId: "ALIAS_SECRET", importedAt: null, evidence: { oath: "OATH_SECRET", strict: "STRICT_SECRET", history: "HISTORY_SECRET" } } });
    const service = new TaskService(H.API.createNativeReadAdapter(v.host)); t.after(() => service.close()); const callbacks = []; const stop = v.host.subscribe(e => callbacks.push(e));
    const r = await service.read({ backend: "native", operation: "structured" }); const raw = JSON.stringify([r, v.host.info(), callbacks]); for (const secret of ["SOURCE_SECRET", "ALIAS_SECRET", "OATH_SECRET", "STRICT_SECRET", "HISTORY_SECRET", v.directory, '"token"']) assert(!raw.includes(secret)); stop();
    assert.throws(() => require("../../src/serialization").serializeSharedPartition({ partition: v.repo.info().partitions.find(p => p.id === task.partitionId), tasks: [r.rows[0]] }));
    v.reg.settings.unavailable = true; const bad = await v.host.refresh(); assert(!JSON.stringify(bad).includes("PRIVATE_REGISTRY_ERROR"));
});
test("complete legacy capability shape explicitly denies all writer operations", async t => { const v = await H.fixture(t), adapter = H.API.createNativeReadAdapter(v.host); t.after(() => adapter.close()); const caps = adapter.capabilities(); assert.equal(caps.guarantees.creationRetry, "unsupported"); assert.equal(caps.guarantees.completion, "unsupported"); assert.equal(caps.guarantees.notifications, "invalidation"); assert(Object.values(caps.operations).every(x => x === false)); assert(caps.restrictions.length > 0); });
