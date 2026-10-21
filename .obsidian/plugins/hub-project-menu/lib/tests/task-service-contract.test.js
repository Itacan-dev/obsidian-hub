"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, clone, restoreObsidianStub } = require("./task-service-fixture.cjs");
const { TaskService, TASK_SERVICE_OPERATIONS } = require("../services/task-service");
after(restoreObsidianStub);
const owner = { type: "project", id: "private" };

async function legacy(t) {
    const f = fixture({ metadata: { existing: { necessity: "should", dueDate: "2026-10-18", dueTime: "00:00", description: "Portable description", phaseId: "phase-1" } } });
    f.add("Projects/Private/Notes.md", "- [ ] Read evidence <!-- hub-task:existing -->\n    - [x] Check source <!-- hub-task:step -->\n");
    t.after(() => f.close());
    return { service: f.service, handle: f.handle("existing"), backend: "legacy-markdown" };
}
async function nativeRepresentative(t) {
    // A static DTO adapter fixture, not a native repository/application adapter.
    // Persistence guarantees are tested separately in the unchanged Phase 2A core.
    const id = "00000000-0000-4000-8000-000000000001", step = { kind: "native-step", id: "00000000-0000-4000-8000-000000000002" };
    const task = { handle: { kind: "native", id }, existingId: id, title: "Read evidence", completed: false,
        steps: [{ handle: step, title: "Check source", completed: true, parent: null, order: 0 }],
        importance: "should", start: null, due: { date: "2026-10-18", time: "00:00" }, description: "Portable description",
        phase: { projectId: "private", phaseId: "phase-1" }, owner, source: null, location: null, captureSource: null, revision: 1,
        progress: { totalSteps: 1, completedSteps: 1, completedAt: null, consistency: "native-committed" },
        editSafety: { kind: "native-revision", persistentIdentity: true, saveSupported: true, durableRevision: true } };
    const operations = Object.fromEntries(TASK_SERVICE_OPERATIONS.map(name => [name, ["getTask", "queryOwned", "readSteps", "resolveReveal"].includes(name)]));
    const service = new TaskService({
        capabilities: () => ({ backend: "native", operations, restrictions: ["Representative read fixture only"],
            guarantees: { durableRevisions: true, atomicTaskHistory: true, persistentIdempotency: true, nativeLocations: true,
                portableSharing: true, existingGitSharing: false, crossWorkspaceRelocation: true, creationRetry: "durable-operation-receipt", completion: "native-command", notifications: "committed" } }),
        getTask: async () => clone(task), readSteps: async () => clone(task.steps),
        queryOwned: async ref => ref.id === owner.id && ref.type === owner.type ? [clone(task)] : [],
        resolveReveal: async () => ({ kind: "native-task", id }), subscribe: () => () => {}, close: async () => {}
    });
    t.after(() => service.close());
    return { service, handle: task.handle, backend: "native" };
}

for (const [name, setup] of [["legacy", legacy], ["native representative", nativeRepresentative]]) {
    test(`common application read expectations: ${name}`, async t => {
        const { service, handle } = await setup(t);
        const dto = await service.getTask(handle);
        assert.equal(dto.title, "Read evidence"); assert.equal(dto.completed, false); assert.equal(dto.importance, "should");
        assert.deepEqual(dto.owner, owner); assert.deepEqual(dto.due, { date: "2026-10-18", time: "00:00" });
        assert.equal(dto.start, null); assert.equal(dto.description, "Portable description");
        assert.deepEqual(dto.phase, { projectId: "private", phaseId: "phase-1" });
        assert.equal(dto.steps.length, 1); assert.equal(dto.steps[0].completed, true); assert.equal(dto.steps[0].parent, null);
        assert.equal(dto.progress.totalSteps, 1); assert.equal(dto.progress.completedSteps, 1);
        assert.equal("file" in dto, false); assert.equal("block" in dto, false); assert.equal("line" in dto.steps[0], false);
        assert.deepEqual(JSON.parse(JSON.stringify(dto)), dto);
        assert.deepEqual((await service.readSteps(handle)), dto.steps);
        assert.equal((await service.queryOwned(owner)).length, 1);
        dto.steps[0].title = "Detached"; assert.equal((await service.getTask(handle)).steps[0].title, "Check source");
    });
    test(`capability differences and explicit reveal variants: ${name}`, async t => {
        const { service, handle, backend } = await setup(t);
        const capabilities = service.capabilities(), target = await service.resolveReveal(handle);
        assert.equal(capabilities.backend, backend);
        assert.equal(capabilities.guarantees.durableRevisions, backend === "native");
        assert.equal(capabilities.guarantees.atomicTaskHistory, backend === "native");
        assert.equal(capabilities.guarantees.persistentIdempotency, backend === "native");
        assert.equal(target.kind, backend === "native" ? "native-task" : "legacy-source");
        if (backend === "native") assert.equal("path" in target, false);
    });
}
