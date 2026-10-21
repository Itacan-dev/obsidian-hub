"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, clone, notices, restoreObsidianStub } = require("./task-service-fixture.cjs");
const { legacyTaskHandle } = require("../services/task-service-legacy-values");
const { TaskService, TASK_SERVICE_OPERATIONS } = require("../services/task-service");
const { TaskServiceError } = require("../services/task-service-errors");
after(restoreObsidianStub);
const path = "Projects/Private/Notes.md";
const source = "# Synthetic\r\n- [ ] Parent <!-- hub-task:parent -->\r\n    prose\r\n    - [ ] First <!-- hub-task:first -->\r\n        - [x] Nested <!-- hub-task:nested -->\r\n    - [ ] Second <!-- hub-task:second -->\r\n- [x] Done <!-- hub-task:done -->\r\n- [ ] Unassigned\r\n";
const emptyDraft = title => ({ title, completed: false, importance: null, start: null, due: null, description: "", phase: null, steps: [] });
const code = expected => error => error instanceof TaskServiceError && error.code === expected;
async function setup(t, options = {}) { const f = fixture(options); f.add(path, source); t.after(() => f.close()); return f; }
const stableEffects = value => {
    const ids = new Map();
    return JSON.parse(JSON.stringify(value).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        id => { if (!ids.has(id)) ids.set(id, "allocated-" + ids.size); return ids.get(id); }));
};

test("portable DTO preserves existing IDs, Steps and ancestry without source/UI objects", async t => {
    const f = await setup(t, { metadata: { parent: { necessity: "must", fromDate: "2026-10-16", dueDate: "2026-10-18", description: "**Description**\nkept", phaseId: "phase-1" } } });
    const task = await f.service.getTask(f.handle("parent"));
    assert.equal(task.existingId, "parent"); assert.equal(task.title, "Parent"); assert.equal(task.importance, "must");
    assert.deepEqual(task.start, { date: "2026-10-16", time: null }); assert.deepEqual(task.due, { date: "2026-10-18", time: null });
    assert.equal(task.description, "**Description**\nkept"); assert.deepEqual(task.phase, { projectId: "private", phaseId: "phase-1" });
    assert.deepEqual(task.owner, { type: "project", id: "private" });
    assert.equal(task.steps.length, 3); assert.deepEqual(task.steps[1].parent, task.steps[0].handle);
    assert.equal(task.steps[2].parent, null); assert.equal(task.steps[2].order, 1);
    assert.deepEqual(task.progress, { completedSteps: 1, totalSteps: 3, completedAt: null, consistency: "legacy-best-effort" });
    assert.deepEqual(JSON.parse(JSON.stringify(task)), task);
    assert.equal("file" in task, false); assert.equal("block" in task, false); assert.equal("line" in task.steps[0], false);
    task.title = "Detached"; task.steps[0].title = "Detached step";
    assert.equal((await f.service.getTask(f.handle("parent"))).title, "Parent");
    assert.equal((await f.service.readSteps(f.handle("parent")))[0].title, "First");
    assert.equal((await f.service.getTask(f.handle("done"))).completed, true);
});

test("reads do not assign identities, save metadata or notify; date-only and midnight remain distinct", async t => {
    const f = await setup(t, { metadata: { parent: { dueDate: "2026-10-18", dueTime: "00:00" } } });
    const before = f.snapshot(); let calls = 0;
    const off = f.service.subscribe(() => calls++);
    const unassigned = legacyTaskHandle({ path, line: 7, text: "Unassigned" });
    const task = await f.service.getTask(unassigned), edit = await f.service.readEditable(unassigned);
    assert.equal(task.handle.identity, null); assert.equal(task.existingId, null); assert.equal(task.editSafety.saveSupported, false);
    assert.equal((await f.service.getTask(f.handle("parent"))).due.time, "00:00");
    await f.service.queryOwned({ type: "project", id: "private" }); f.flush();
    assert.equal(calls, 0); assert.deepEqual(f.snapshot(), before); assert.equal(f.state.writes, 0); assert.equal(f.state.metadataSaves, 0);
    await assert.rejects(f.service.saveEditable(edit.token, edit.draft), code("UNSUPPORTED"));
    await f.service.releaseEditable(edit.token); off();
});

test("temporary locators reject moved lines, changed text, duplicate titles and identity reassignment", async t => {
    const f = await setup(t); const handle = legacyTaskHandle({ path, line: 7, text: "Unassigned" });
    f.contents.set(path, "Inserted\n" + source); f.index(f.files.get(path));
    await assert.rejects(f.service.getTask(handle), code("STALE_REFERENCE"));
    f.contents.set(path, source.replace("Unassigned", "Different")); f.index(f.files.get(path));
    await assert.rejects(f.service.getTask(handle), code("STALE_REFERENCE"));
    f.contents.set(path, source + "- [ ] Unassigned\n"); f.index(f.files.get(path));
    await assert.rejects(f.service.getTask(handle), code("AMBIGUOUS_REFERENCE"));
    f.contents.set(path, source.replace("Unassigned", "Unassigned <!-- hub-task:new-id -->")); f.index(f.files.get(path));
    await assert.rejects(f.service.getTask(handle), code("STALE_REFERENCE"));
});

test("hidden IDs follow indexed source moves while ownership follows the real source", async t => {
    const f = await setup(t), handle = f.handle("parent");
    f.move(f.files.get(path), "Resources/Knowledge/Mounted/Moved.md");
    const task = await f.service.getTask(handle);
    assert.deepEqual(task.owner, { type: "resource", id: "study" });
    assert.equal(task.source.locator.path, "Resources/Knowledge/Mounted/Moved.md");
    assert.deepEqual(await f.service.resolveReveal(handle), { kind: "legacy-source", path: "Resources/Knowledge/Mounted/Moved.md", line: 1, existingId: "parent" });
});

test("missing/deleted source, missing indexed identity and renamed temporary locators have typed errors", async t => {
    const f = await setup(t), handle = f.handle("parent"), file = f.files.get(path);
    const temporary = legacyTaskHandle({ path, line: 7, text: "Unassigned" });
    f.move(file, "Projects/Private/Renamed.md");
    await assert.rejects(f.service.getTask(temporary), code("SOURCE_MISSING"));
    f.remove(file); await assert.rejects(f.service.getTask(handle), code("SOURCE_MISSING"));
    f.add(path, "- [ ] Other\n"); await assert.rejects(f.service.getTask(handle), code("REFERENCE_UNRESOLVED"));
});

test("copied parent IDs and Step IDs across sources are ambiguous, including another workspace", async t => {
    const f = await setup(t), handle = f.handle("parent");
    const copy = f.add("Projects/Itacan/Copy.md", "- [ ] Parent <!-- hub-task:parent -->\n");
    await assert.rejects(f.service.getTask(handle), code("AMBIGUOUS_REFERENCE"));
    f.remove(copy);
    f.add("Resources/Knowledge/Copy.md", "- [ ] Copied Step <!-- hub-task:first -->\n");
    await assert.rejects(f.service.getTask(handle), code("AMBIGUOUS_REFERENCE"));
});

test("same-file copied IDs remain rejected by the actual source snapshot validator", async t => {
    const f = await setup(t), handle = f.handle("parent");
    // Deliberately leave Dataview stale to exercise the source-file safeguard.
    f.contents.set(path, source + "- [ ] Parent <!-- hub-task:parent -->\n");
    await assert.rejects(f.service.getTask(handle), code("AMBIGUOUS_REFERENCE"));
});

test("panel and workspace visibility preserve physical filters and do not add Resource mounts", async t => {
    const f = await setup(t);
    f.add("Projects/Itacan/Notes.md", "- [ ] Shared <!-- hub-task:shared -->\n");
    f.add("Projects/Private/System/Hidden.md", "- [ ] System task <!-- hub-task:system -->\n");
    f.add("Resources/Knowledge/Mounted/Notes.md", "- [ ] Mounted <!-- hub-task:resource -->\n");
    assert.deepEqual((await f.service.queryOwned({ type: "resource", id: "study" })).map(task => task.existingId), ["resource"]);
    assert.deepEqual((await f.service.queryVisible({ type: "project", id: "itacan" })).map(task => task.existingId), ["shared"]);
    const panel = await f.service.queryVisible({ type: "project", id: "private" });
    const workspace = await f.service.queryVisible({ type: "project", id: "private" }, { policy: "workspace" });
    assert(panel.some(task => task.existingId === "system")); assert(!workspace.some(task => task.existingId === "system"));
    assert.deepEqual((await f.service.queryVisible({ type: "resource", id: "study" })).map(task => task.existingId), ["resource"]);
    await assert.rejects(f.service.queryVisible({ type: "project", id: "itacan" }, { policy: "oath" }), code("UNSUPPORTED"));
    await assert.rejects(f.service.queryVisible({ type: "project", id: "itacan" }, { policy: "home" }), code("UNSUPPORTED"));
});

const parity = [
    ["edit title, description, importance and timed due", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, text: "Edited", description: "Exact\ntext", necessity: "should", dueDate: "2026-10-20", dueTime: "12:30" }),
        async (f, edit) => f.service.saveEditable(edit.token, { ...edit.draft, title: "Edited", description: "Exact\ntext", importance: "should", due: { date: "2026-10-20", time: "12:30" } })],
    ["complete", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, completed: true }),
        async (f, edit) => f.service.setCompleted(edit.token, true)],
    ["append Step", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, steps: [...snapshot.steps, { text: "Added", completed: false }] }),
        async (f, edit) => f.service.addStep(edit.token, { title: "Added" })],
    ["edit Step", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, steps: snapshot.steps.map((step, index) => index ? step : { ...step, text: "Edited first" }) }),
        async (f, edit) => f.service.editStep(edit.token, edit.task.steps[0].handle, { title: "Edited first" })],
    ["delete leaf Step", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, steps: snapshot.steps.slice(0, 2) }),
        async (f, edit) => f.service.deleteStep(edit.token, edit.task.steps[2].handle)],
    ["delete Step subtree", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, steps: snapshot.steps.slice(2) }),
        async (f, edit) => f.service.deleteStep(edit.token, edit.task.steps[0].handle, { cascade: true })],
    ["complete Step", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, steps: snapshot.steps.map((step, index) => index ? step : { ...step, completed: true }) }),
        async (f, edit) => f.service.setStepCompleted(edit.token, edit.task.steps[0].handle, true)],
    ["Phase assignment", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { ...snapshot, phaseId: "phase-1" }),
        async (f, edit) => f.service.changeAssociations(edit.token, { phase: { projectId: "private", phaseId: "phase-1" } })],
    ["delete task and Steps", async (f, snapshot) => f.plugin.taskEditor.save(snapshot, { operation: "delete" }),
        async (f, edit) => f.service.deleteTask(edit.token)]
];
for (const [name, baseline, through] of parity) test(`direct legacy parity: ${name}`, async t => {
    const direct = await setup(t), wrapped = await setup(t);
    const now = Date.now; Date.now = () => 1792150000000;
    try {
        const raw = await direct.plugin.taskEditor.read({ path, line: 1, text: "Parent", hubTaskId: "parent" });
        const edit = await wrapped.service.readEditable(wrapped.handle("parent"));
        const before = clone(edit.draft);
        await baseline(direct, raw); const result = await through(wrapped, edit);
        assert.deepEqual(stableEffects(wrapped.snapshot()), stableEffects(direct.snapshot()));
        assert.deepEqual(edit.draft, before, "Facade leaves the caller's draft detached");
        assert.equal(result.status, "legacy-applied"); assert.equal(result.historyPersistence, "unconfirmed");
        if (result.task) {
            assert.deepEqual(result.task, await wrapped.service.getTask(result.task.handle));
            assert.equal(result.task.handle.identity.value, "parent");
        } else assert(!wrapped.contents.get(path).includes("Parent"));
        await assert.rejects(wrapped.service.saveEditable(edit.token, edit.draft), code("STALE_REFERENCE"));
    } finally { Date.now = now; }
});

test("completion/reopening preserves legacy progress/history; Steps never complete the parent", async t => {
    const f = await setup(t);
    let edit = await f.service.readEditable(f.handle("parent"));
    let result = await f.service.setStepCompleted(edit.token, edit.task.steps[0].handle, true);
    assert.equal(result.task.completed, false); assert.equal((await f.service.queryHistory()).filter(item => item.kind === "step").length, 1);
    edit = await f.service.readEditable(f.handle("parent")); await f.service.setStepCompleted(edit.token, edit.task.steps[0].handle, false);
    assert.equal((await f.service.queryHistory()).length, 0);
    edit = await f.service.readEditable(f.handle("parent")); await f.service.setCompleted(edit.token, true);
    let history = await f.service.queryHistory({ handle: f.handle("parent") }); assert.equal(history.length, 1);
    assert.equal(history[0].taskIdentity, "parent"); assert.deepEqual(history[0].ownerAtEvent, { type: "project", id: "private" });
    assert((await f.service.getTask(f.handle("parent"))).progress.completedAt > 0);
    edit = await f.service.readEditable(f.handle("parent")); await f.service.setCompleted(edit.token, false);
    assert.equal((await f.service.queryHistory()).length, 0, "Legacy reopen removes the counted history, unlike native retained evidence");
    edit = await f.service.readEditable(f.handle("parent")); await f.service.setCompleted(edit.token, true);
    edit = await f.service.readEditable(f.handle("parent")); await f.service.deleteTask(edit.token);
    history = await f.service.queryHistory(); assert.equal(history.length, 1); assert.equal(f.wizard.completedTaskChecks.length, 0);
    await assert.rejects(f.service.queryHistory({ handle: legacyTaskHandle({ path, line: 0, text: "Unassigned" }) }), code("UNSUPPORTED"));
});

test("creation delegates unchanged, keeps caller-owned retry behavior and never guesses the new task", async t => {
    const direct = await setup(t), f = await setup(t);
    const request = { owner: { type: "project", id: "private" }, destination: { kind: "legacy-source", path },
        retry: { kind: "legacy-create-id", id: "inbox-existing-receipt" }, draft: { ...emptyDraft("Created"), importance: "must", description: "Capture", steps: [{ title: "Read", completed: false }] } };
    await direct.plugin.taskEditor.create(path, "Created", { hubTaskId: request.retry.id, necessity: "must", description: "Capture", steps: [{ text: "Read", completed: false }] });
    const result = await f.service.createTask(request);
    assert.deepEqual(stableEffects(f.snapshot()), stableEffects(direct.snapshot()));
    assert.equal(result.task, null); assert.equal(result.existingId, request.retry.id); assert.equal(result.reveal.path, path);
    const before = f.snapshot(); await Promise.all([f.service.createTask(request), f.service.createTask(request)]);
    assert.deepEqual(f.snapshot(), before);
    await assert.rejects(f.service.createTask({ ...request, draft: emptyDraft("Different") }), code("AMBIGUOUS_REFERENCE"));
    const ordinary = await f.service.createTask({ owner: request.owner, destination: request.destination, draft: emptyDraft("No ID") });
    assert.equal(ordinary.existingId, null); assert(f.contents.get(path).includes("- [ ] No ID\r\n"));
});

test("metadata and source preconditions reject stale saves without writes", async t => {
    const f = await setup(t);
    let edit = await f.service.readEditable(f.handle("parent"));
    f.wizard.data.taskMetadata.parent = { necessity: "must" };
    const before = f.contents.get(path); await assert.rejects(f.service.saveEditable(edit.token, edit.draft), code("STATE_CONFLICT"));
    assert.equal(f.contents.get(path), before);
    edit = await f.service.readEditable(f.handle("parent"));
    f.contents.set(path, source.replace("    prose", "    changed prose"));
    await assert.rejects(f.service.saveEditable(edit.token, edit.draft), code("STALE_REFERENCE"));
    edit = await f.service.readEditable(f.handle("parent"));
    f.contents.set(path, source.replace("Parent", "Other"));
    await assert.rejects(f.service.saveEditable(edit.token, edit.draft), code("AMBIGUOUS_REFERENCE"));
});

test("invalid metadata, invalid Phase, invalid title and unsafe Step drafts reject explicitly", async t => {
    const f = await setup(t), edit = await f.service.readEditable(f.handle("parent")), before = f.snapshot();
    for (const draft of [
        { ...edit.draft, due: { date: "2026-02-30", time: null } },
        { ...edit.draft, due: { date: "2026-10-18", time: "25:00" } },
        { ...edit.draft, phase: { projectId: "private", phaseId: "deleted-phase" } },
        { ...edit.draft, phase: { projectId: "itacan", phaseId: "phase-1" } },
        { ...edit.draft, title: "Two\nlines" }, { ...edit.draft, importance: "invalid" },
        { ...edit.draft, steps: edit.draft.steps.slice(1) }
    ]) await assert.rejects(f.service.saveEditable(edit.token, draft), code("VALIDATION"));
    await assert.rejects(f.service.deleteStep(edit.token, edit.task.steps[0].handle), code("VALIDATION"));
    await assert.rejects(f.service.saveEditable(edit.token, { ...edit.draft, steps: [...edit.draft.steps].reverse() }), code("UNSUPPORTED"));
    assert.deepEqual(f.snapshot(), before);
});

test("write failures and metadata rollback preserve source; rollback failure exposes partial state", async t => {
    const f = await setup(t), edit = await f.service.readEditable(f.handle("parent")), before = f.snapshot();
    f.state.failWrite = true;
    await assert.rejects(f.service.saveEditable(edit.token, { ...edit.draft, title: "Changed" }), code("WRITE_FAILED"));
    assert.deepEqual(f.snapshot(), before); f.state.failWrite = false; f.state.failMetadata = true;
    await assert.rejects(f.service.saveEditable(edit.token, { ...edit.draft, title: "Changed" }), code("WRITE_FAILED"));
    assert.deepEqual(f.snapshot(), before);
    f.state.writes = 0; f.state.failRollback = true;
    await assert.rejects(f.service.saveEditable(edit.token, { ...edit.draft, title: "Partial" }), code("PARTIAL_FAILURE"));
    assert(f.contents.get(path).includes("Partial")); assert.deepEqual(f.wizard.data.taskMetadata, before.metadata);
});

test("legacy history failure is visible as unconfirmed durability, without claiming a native commit", async t => {
    t.mock.method(console, "error", () => {});
    const f = await setup(t), edit = await f.service.readEditable(f.handle("parent")), count = notices.length;
    f.state.failHistory = true;
    const result = await f.service.setCompleted(edit.token, true);
    assert.equal(result.task.completed, true); assert.equal(result.status, "legacy-applied");
    assert.equal(result.historyPersistence, "unconfirmed"); assert.equal((await f.service.queryHistory()).length, 0);
    assert.equal(notices.length, count + 1); assert.match(notices.at(-1), /History could not be updated/);
});

test("capabilities and unsupported methods are honest; foreign snapshot tokens are rejected", async t => {
    const f = await setup(t), other = await setup(t), edit = await f.service.readEditable(f.handle("parent"));
    await other.service.readEditable(other.handle("parent"));
    await assert.rejects(other.service.setCompleted(edit.token, true), code("STALE_REFERENCE"));
    const caps = f.service.capabilities();
    assert.deepEqual(Object.keys(caps.operations).sort(), [...TASK_SERVICE_OPERATIONS].sort());
    for (const key of ["durableRevisions", "atomicTaskHistory", "persistentIdempotency", "nativeLocations", "crossWorkspaceRelocation", "portableSharing"]) assert.equal(caps.guarantees[key], false);
    assert.equal(caps.guarantees.existingGitSharing, true);
    for (const operation of ["reorderSteps", "archiveTask", "clearCompleted"]) await assert.rejects(f.service[operation](edit.token), code("UNSUPPORTED"));
    await assert.rejects(f.service.changeAssociations(edit.token, { owner: { type: "resource", id: "study" } }), code("UNSUPPORTED"));
    await assert.rejects(f.service.getTask({ kind: "native", id: "00000000-0000-4000-8000-000000000001" }), code("UNSUPPORTED"));
    assert.equal(f.state.writes, 0);
    await f.service.close(); await assert.rejects(f.service.getTask(edit.task.handle), code("CLOSED"));
});

test("one backend watcher serves many listeners; errors, unsubscribe and close are isolated", async t => {
    const f = await setup(t); let a = 0, b = 0; const events = [];
    const offA = f.service.subscribe(change => { a++; events.push(change); });
    const offB = f.service.subscribe(() => { b++; });
    const bad = f.service.subscribe(() => { throw Error("sync subscriber"); });
    const badAsync = f.service.subscribe(async () => { throw Error("async subscriber"); });
    assert.equal(f.plugin.taskData.subscribers.size, 1); assert.equal(f.vault.listeners.size, 3); assert.equal(f.metadataCache.listeners.size, 2);
    f.metadataCache.emit("dataview:metadata-change", "update", f.files.get(path)); f.flush(); await Promise.resolve();
    assert.equal(a, 1); assert.equal(b, 1); assert.equal(f.errors.length, 2);
    assert.deepEqual(events[0], { kind: "invalidation", backend: "legacy-markdown", reason: "legacy-refresh", requiresRequery: true, durability: "unknown", taskHandles: null });
    offA(); f.metadataCache.emit("dataview:index-ready"); f.flush(); assert.equal(a, 1); assert.equal(b, 2);
    offB(); bad(); badAsync(); assert.equal(f.plugin.taskData.subscribers.size, 0); assert.equal(f.vault.listeners.size + f.metadataCache.listeners.size, 0);
    // A current UI subscription survives adapter shutdown.
    let external = 0; const externalOff = f.plugin.taskData.subscribe({ register() {} }, () => external++);
    f.service.subscribe(() => a++); f.metadataCache.emit("dataview:index-ready");
    await f.service.close(); f.flush(); assert.equal(a, 1); assert.equal(external, 1); assert.equal(f.plugin.taskData.subscribers.size, 1);
    externalOff(); assert.equal(f.frames.size + f.vault.listeners.size + f.metadataCache.listeners.size, 0);
});

test("facade accepts a test-only native DTO authority without a path, Dataview or fallback", async () => {
    const dto = { handle: { kind: "native", id: "00000000-0000-4000-8000-000000000001" }, existingId: "00000000-0000-4000-8000-000000000001",
        title: "Native representative", completed: false, steps: [], importance: null, start: null, due: { date: "2026-10-18", time: null },
        description: "", phase: null, owner: { type: "project", id: "private" }, source: null, location: null, captureSource: null, revision: 1,
        progress: { completedSteps: 0, totalSteps: 0, completedAt: null, consistency: "native-committed" },
        editSafety: { kind: "native-revision", persistentIdentity: true, saveSupported: true, durableRevision: true } };
    let closed = false;
    const service = new TaskService({ capabilities: () => ({ backend: "native" }), subscribe: () => () => {}, close: async () => { closed = true; },
        getTask: async handle => { assert.deepEqual(handle, dto.handle); return clone(dto); }, resolveReveal: async handle => ({ kind: "native-task", id: handle.id }) });
    assert.deepEqual(await service.getTask(dto.handle), dto); assert.deepEqual(await service.resolveReveal(dto.handle), { kind: "native-task", id: dto.existingId });
    await assert.rejects(service.createTask({}), code("UNSUPPORTED"));
    await service.close(); assert.equal(closed, true);
});

test("pending drafts are copied at invocation, concurrent stale saves cannot overwrite newer source", async t => {
    const f = await setup(t), first = await f.service.readEditable(f.handle("parent")), second = await f.service.readEditable(f.handle("parent"));
    const draft = { ...first.draft, title: "First change" };
    const pending = f.service.saveEditable(first.token, draft);
    draft.title = "Mutated after invocation";
    const stale = f.service.saveEditable(second.token, { ...second.draft, title: "Second change" });
    assert.equal((await pending).task.title, "First change");
    await assert.rejects(stale, error => ["STALE_REFERENCE", "AMBIGUOUS_REFERENCE"].includes(error.code));
    assert(f.contents.get(path).includes("First change")); assert(!f.contents.get(path).includes("Second change"));
});

test("Step handles are scoped to their parent task, including Steps without IDs", async t => {
    const f = await setup(t);
    f.add("Projects/Private/Other.md", "- [ ] Other <!-- hub-task:other -->\n    - [ ] Unassigned step\n");
    f.contents.set(path, source.replace(" <!-- hub-task:first -->", "")); f.index(f.files.get(path));
    const first = await f.service.readEditable(f.handle("parent")), other = await f.service.readEditable(f.handle("other"));
    await assert.rejects(f.service.setStepCompleted(first.token, other.task.steps[0].handle, true), code("STALE_REFERENCE"));
    assert.equal(f.state.writes, 0);
});

test("adapter shutdown drains accepted writes and rejects subsequent writes", async t => {
    const f = await setup(t), edit = await f.service.readEditable(f.handle("parent"));
    let release;
    f.plugin.taskMutationQueue = new Promise(resolve => { release = resolve; });
    const write = f.service.setCompleted(edit.token, true);
    const closing = f.service.close();
    await assert.rejects(f.service.setCompleted(edit.token, false), code("CLOSED"));
    release(); await write; await closing;
    assert(f.contents.get(path).includes("- [x] Parent"));
    await assert.rejects(async () => f.adapter.setCompleted(edit.token, false), code("CLOSED"));
});

test("duplicate listener callbacks have independent disposal; read-only refresh never signals a commit", async t => {
    const f = await setup(t); let calls = 0;
    const listener = event => { calls++; assert.equal(event.kind, "invalidation"); };
    const a = f.service.subscribe(listener), b = f.service.subscribe(listener);
    f.plugin.taskData.invalidateAll(); f.flush(); assert.equal(calls, 2);
    a(); f.plugin.taskData.invalidateAll(); f.flush(); assert.equal(calls, 3);
    b(); assert.equal(f.plugin.taskData.subscribers.size, 0);
});

test("Resource Phase assignment and malformed portable drafts reject without changing legacy state", async t => {
    const f = await setup(t);
    f.add("Resources/Knowledge/Notes.md", "- [ ] Resource <!-- hub-task:resource -->\n");
    const edit = await f.service.readEditable(f.handle("resource")), before = f.snapshot();
    await assert.rejects(f.service.changeAssociations(edit.token, { phase: { projectId: "private", phaseId: "phase-1" } }), code("VALIDATION"));
    await assert.rejects(f.service.saveEditable(edit.token, { ...edit.draft, due: { date: "2026-10-18", time: NaN } }), code("VALIDATION"));
    const cyclic = { ...edit.draft }; cyclic.captureSource = cyclic;
    await assert.rejects(f.service.saveEditable(edit.token, cyclic), code("VALIDATION"));
    assert.deepEqual(f.snapshot(), before);
});

test("task and Step completion retain invocation time through preflight and queued persistence", async t => {
    const f = await setup(t), now = Date.now;
    let clock = 1792150000000;
    Date.now = () => clock;
    try {
        for (const kind of ["step", "task"]) {
            const edit = await f.service.readEditable(f.handle("parent"));
            let release; f.plugin.taskMutationQueue = new Promise(resolve => { release = resolve; });
            const at = clock;
            const pending = kind === "step" ? f.service.setStepCompleted(edit.token, edit.task.steps[0].handle, true) : f.service.setCompleted(edit.token, true);
            clock += 60000; release(); await pending;
            const records = await f.service.queryHistory(); assert.equal(records.find(record => record.kind === kind).timestamp, at);
        }
        const before = f.wizard.completedTaskHistory.map(record => record.id);
        let edit = await f.service.readEditable(f.handle("parent")); await f.service.setCompleted(edit.token, true);
        edit = await f.service.readEditable(f.handle("parent")); await f.service.setStepCompleted(edit.token, edit.task.steps[0].handle, true);
        assert.deepEqual(f.wizard.completedTaskHistory.map(record => record.id), before, "Repeated requested state creates no new history event");
    } finally { Date.now = now; }
});

test("completed creation preserves task/Step action times, and explicit draft times take precedence", async t => {
    const f = await setup(t), now = Date.now;
    let clock = 1792150000000;
    Date.now = () => clock;
    try {
        let release; f.plugin.taskMutationQueue = new Promise(resolve => { release = resolve; });
        const at = clock;
        const pending = f.service.createTask({ owner: { type: "project", id: "private" }, destination: { kind: "legacy-source", path },
            retry: { kind: "legacy-create-id", id: "completed-create" },
            draft: { ...emptyDraft("Created done"), completed: true, steps: [{ title: "Done step", completed: true, completedAt: at - 100 }] } });
        clock += 60000; release(); await pending;
        const records = await f.service.queryHistory({ handle: f.handle("completed-create") });
        assert.equal(records.find(record => record.kind === "task").timestamp, at);
        assert.equal(records.find(record => record.kind === "step").timestamp, at - 100);
        const edit = await f.service.readEditable(f.handle("parent"));
        await f.service.saveEditable(edit.token, { ...edit.draft, completed: true, completedAt: at - 200 });
        assert.equal((await f.service.queryHistory({ handle: f.handle("parent") }))[0].timestamp, at - 200);
    } finally { Date.now = now; }
});
