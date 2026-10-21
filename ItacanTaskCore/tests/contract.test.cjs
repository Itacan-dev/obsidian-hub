"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { deserializeSharedPartition, serializeSharedPartition, comparePartitionHeads, dateEndpoint } = require("../src");
const { fixture, owners, create, mutate, rejected, randomUUID } = require("./support.cjs");

for (const kind of ["memory", "json"]) {
    test(`${kind}: create/read/update portable properties and immutable reads`, async t => {
        const { repo: r } = await fixture(kind, t);
        const input = create({ description: "Unicode Å 日本語\n**Markdown**", importance: "must", start: { date: "2026-12-31", time: "23:59" }, due: { date: "2027-01-01", time: "00:00" }, createdAt: null, modifiedAt: null,
            migration: { source: "synthetic", sourceId: "legacy-id", importedAt: null, evidence: { unknownProperty: "preserved" } }, captureSource: { origin: "capture", path: "C:/private/source.md" } });
        const result = await r.execute(input), task = result.task;
        assert.equal(task.revision, 1); assert.equal(result.repositoryRevision, 1); assert.equal(task.createdAt, null); assert.deepEqual(task.due, input.payload.task.due);
        task.title = "outside mutation"; task.owner.id = "other"; input.payload.task.description = "outside";
        assert.equal(r.getTask(result.taskId).title, "Task α"); assert.match(r.getTask(result.taskId).description, /日本語/);
        const updated = await r.execute(mutate(r.getTask(result.taskId), "task.update", { patch: { title: "Changed", importance: "should" } }));
        assert.equal(updated.task.id, result.taskId); assert.equal(updated.taskRevision, 2); assert.equal(updated.task.migration.evidence.unknownProperty, "preserved");
    });
    test(`${kind}: completion, snapshot, reopen and counted history semantics`, async t => {
        const { repo: r } = await fixture(kind, t); let task = (await r.execute(create())).task;
        const completion = { ...mutate(task, "task.complete", { completed: true, completedAt: 123 }), context: { workingContext: owners.b, oathId: "private-oath", sessionId: "private-session" } };
        let result = await r.execute(completion); task = result.task;
        assert.equal(task.completedAt, 123); assert.equal(r.queryHistory({ counted: true }).length, 1);
        assert.equal((await r.execute(completion)).replayed, true); assert.equal(r.queryHistory().length, 1);
        const event = r.queryHistory()[0]; assert.deepEqual(event.ownerAtEvent, owners.a); assert.deepEqual(event.workingContext, owners.b);
        task = (await r.execute(mutate(task, "task.update", { patch: { title: "Edited after completion" } }))).task;
        assert.equal(r.queryHistory()[0].snapshot.title, "Task α");
        task = (await r.execute(mutate(task, "task.complete", { completed: false }))).task;
        assert.equal(task.completedAt, null); assert.equal(r.queryHistory({ counted: true }).length, 0); assert.equal(r.queryHistory().length, 1);
        assert.notEqual(r.queryHistory()[0].reopenedAt, null);
        task = (await r.execute(mutate(task, "task.complete", { completed: true, completedAt: null }))).task;
        assert.equal(task.completedAt, null); assert.equal(r.queryHistory({ counted: true }).length, 1); assert.equal(r.queryHistory().length, 2);
        const before = r.info().revision; await r.execute(mutate(task, "task.complete", { completed: true }));
        assert.equal(r.getTask(task.id).revision, task.revision); assert.equal(r.queryHistory().length, 2); assert.equal(r.info().revision, before + 1);
    });
    test(`${kind}: nested Steps, edit/reorder, completion and explicit cascade`, async t => {
        const { repo: r } = await fixture(kind, t), parent = randomUUID(), child = randomUUID(), sibling = randomUUID();
        let task = (await r.execute(create({ steps: [{ id: parent, title: "Parent", order: 0 }, { id: sibling, title: "Sibling", order: 1 }, { id: child, parentStepId: parent, title: "Child", order: 0 }] }))).task;
        task = (await r.execute(mutate(task, "step.reorder", { parentStepId: null, stepIds: [sibling, parent] }))).task;
        assert.equal(task.steps.find(s => s.id === parent).order, 1); assert.equal(task.steps.find(s => s.id === child).parentStepId, parent);
        task = (await r.execute(mutate(task, "step.update", { stepId: child, patch: { title: "Edited child" } }))).task;
        task = (await r.execute(mutate(task, "step.complete", { stepId: child, completed: true, completedAt: 456 }))).task;
        assert.equal(task.completed, false); assert.equal(r.queryHistory({ stepId: child, counted: true })[0].snapshot.parentTitle, "Task α");
        task = (await r.execute(mutate(task, "step.complete", { stepId: child, completed: false }))).task;
        assert.equal(r.queryHistory({ stepId: child, counted: true }).length, 0);
        await rejected(assert, () => r.execute(mutate(task, "step.delete", { stepId: parent })), "VALIDATION");
        task = (await r.execute(mutate(task, "step.delete", { stepId: parent, cascade: true }))).task;
        assert.deepEqual(task.steps.map(s => s.id), [sibling]);
        await rejected(assert, () => r.execute(mutate(task, "step.add", { step: { id: child, order: 2, title: "Reuse" } })), "IDENTITY_CONFLICT");
        task = (await r.execute(mutate(task, "step.add", { step: { order: 2, title: "New", completed: true } }))).task;
        assert.equal(task.steps.length, 2); assert.equal(r.queryHistory({ kind: "step", counted: true }).length, 1);
    });
    test(`${kind}: location/Phase resolvers and explicit ownership changes`, async t => {
        const { repo: r } = await fixture(kind, t);
        let task = (await r.execute(create({ location: { type: "note", id: "note-a" }, phase: { projectId: owners.a.id, phaseId: "phase-a" } }))).task;
        const stepId = randomUUID(); task = (await r.execute(mutate(task, "step.add", { step: { id: stepId, order: 0, title: "Step" } }))).task;
        await rejected(assert, () => r.execute(mutate(task, "task.relocate", { owner: owners.resource, location: { type: "folder", id: "resource-folder" }, phase: task.phase })), "VALIDATION");
        task = (await r.execute(mutate(task, "task.relocate", { owner: owners.resource, location: { type: "folder", id: "resource-folder" }, phase: null }))).task;
        assert.equal(task.partitionId, "resource-study"); assert.equal(task.steps[0].id, stepId);
        await rejected(assert, () => r.execute(mutate(task, "task.relocate", { owner: owners.a, location: task.location, phase: null })), "VALIDATION");
        task = (await r.execute(mutate(task, "task.relocate", { owner: owners.a, location: null, phase: null }))).task;
        assert.equal(task.location, null);
        await rejected(assert, () => r.execute(create({ phase: { projectId: owners.a.id, phaseId: "missing" } })), "VALIDATION");
    });
    test(`${kind}: IDs are globally reserved and stale updates are atomic`, async t => {
        const { repo: r } = await fixture(kind, t), id = randomUUID(), stepId = randomUUID();
        const task = (await r.execute(create({ id, steps: [{ id: stepId, order: 0, title: "Step" }] }))).task;
        await rejected(assert, () => r.execute(create({ id })), "IDENTITY_CONFLICT");
        await rejected(assert, () => r.execute(create({ id: stepId })), "IDENTITY_CONFLICT");
        await rejected(assert, () => r.execute(create({ steps: [{ id: stepId, order: 0, title: "Copied" }] })), "IDENTITY_CONFLICT");
        const command = mutate(task, "task.update", { patch: { title: "One" } }); await r.execute(command);
        const revision = r.info().revision;
        await rejected(assert, () => r.execute(mutate(task, "task.update", { patch: { title: "Stale" } })), "REVISION_CONFLICT");
        assert.equal(r.getTask(id).title, "One"); assert.equal(r.info().revision, revision);
        await rejected(assert, () => r.execute({ ...mutate(r.getTask(id), "task.update", { patch: { title: "Stale store" } }), expectedRepositoryRevision: 0 }), "REPOSITORY_CONFLICT");
        assert.equal(r.info().revision, revision);
    });
    test(`${kind}: rejected schemas, dates, ancestry and unsupported fields leave no state`, async t => {
        const { repo: r } = await fixture(kind, t), x = randomUUID(), y = randomUUID();
        const invalid = [
            { owner: null }, { owner: { type: "folder", id: "x" } }, { owner: { type: "project", id: "unregistered" } },
            { id: null }, { schemaVersion: null }, { completed: null }, { description: null }, { steps: null }, { steps: "not an array" },
            { id: "not-a-uuid" }, { title: "" }, { title: "two\nlines" }, { unsupported: "must not disappear" }, { importance: "urgent" }, { schemaVersion: 2 },
            { start: { date: "2025-02-29", time: null } }, { start: { date: "2026-04-31", time: null } }, { due: { date: "2026-01-01", time: "24:00" } },
            { start: { date: "2027-01-01", time: null }, due: { date: "2026-12-31", time: null } },
            { start: { date: "2026-10-16", time: "12:00" }, due: { date: "2026-10-16", time: "00:00" } },
            { location: { type: "folder", id: "missing" } }, { location: { type: "folder", id: "resource-folder" } },
            { owner: owners.resource, phase: { projectId: owners.a.id, phaseId: "phase-a" } }, { phase: { projectId: owners.b.id, phaseId: "phase-a" } },
            { completed: false, completedAt: 123 }, { createdAt: -1 }, { createdAt: Infinity }, { captureSource: { unknown: "x" } },
            { steps: [{ id: x, order: 0, title: "One" }, { id: x, order: 1, title: "Two" }] },
            { steps: [{ order: 0, title: "One" }, { order: 0, title: "Two" }] }, { steps: [{ order: -1, title: "Negative" }] },
            { steps: [{ parentStepId: x, order: 0, title: "Missing parent" }] },
            { steps: [{ id: x, parentStepId: y, order: 0, title: "X" }, { id: y, parentStepId: x, order: 0, title: "Y" }] },
            { steps: [{ taskId: x, order: 0, title: "Wrong task" }] }, { steps: [{ order: 0, title: "Bad", completed: "yes" }] },
            { steps: [{ id: null, order: 0, title: "Invalid ID" }] }, { steps: [{ order: null, title: "Invalid order" }] }, { steps: [{ order: 0, title: "Invalid completion", completed: null }] }
        ];
        for (const values of invalid) {
            await assert.rejects(async () => r.execute(create(values)), error => ["VALIDATION", "IDENTITY_CONFLICT", "UNSUPPORTED_SCHEMA"].includes(error.code));
            assert.equal(r.info().revision, 0, JSON.stringify(values)); assert.equal(r.queryTasks().length, 0); assert.equal(r.queryHistory().length, 0);
        }
        await rejected(assert, () => r.execute({ type: "task.create", operationId: randomUUID(), payload: { task: null } }), "VALIDATION");
        const valid = await r.execute(create({ start: { date: "2024-02-29", time: "00:00" }, due: { date: "2024-02-29", time: null } }));
        assert.equal(valid.task.start.date, "2024-02-29");
    });
    test(`${kind}: idempotency persists across restart and concurrent retries`, async t => {
        const f = await fixture(kind, t); const command = create({ completed: true }); let r = f.repo;
        const [a, b] = await Promise.all([r.execute(command), r.execute(command)]);
        assert.equal(a.taskId, b.taskId); assert.equal(b.replayed, true); assert.equal(r.info().revision, 1);
        await rejected(assert, () => r.execute({ ...command, payload: { task: { owner: owners.a, title: "Different" } } }), "OPERATION_CONFLICT");
        r = await f.reopen(); const replay = await r.execute(command);
        assert.equal(replay.replayed, true); assert.equal(replay.taskId, a.taskId); assert.equal(r.queryHistory().length, 1); assert.equal(r.info().revision, 1);
        const updates = await Promise.allSettled([r.execute(mutate(a.task, "task.update", { patch: { title: "A" } })), r.execute(mutate(a.task, "task.update", { patch: { title: "B" } }))]);
        assert.equal(updates.filter(x => x.status === "fulfilled").length, 1); assert.equal(updates.find(x => x.status === "rejected").reason.code, "REVISION_CONFLICT");
        assert.equal((await r.execute(command)).task.title, "Task α", "Receipt returns original committed result, not later state");
    });
    test(`${kind}: interrupted acknowledgment has one committed effect`, async t => {
        let armed = false; const f = await fixture(kind, t, { fault(stage) { if (armed && stage === "beforeAcknowledgement") { armed = false; throw Error("lost response"); } } });
        const events = []; f.repo.subscribe(change => events.push(change)); const command = create({ completed: true }); armed = true;
        await rejected(assert, () => f.repo.execute(command), "ACKNOWLEDGEMENT_LOST");
        assert.equal(f.repo.queryTasks().length, 1); assert.equal(f.repo.queryHistory({ counted: true }).length, 1); assert.equal(events.length, 1);
        const r = await f.reopen(); assert.equal((await r.execute(command)).replayed, true); assert.equal(r.queryHistory().length, 1); assert.equal(r.info().revision, 1);
    });
    test(`${kind}: rejected pre-commit candidate emits no state/history/receipt/change`, async t => {
        let armed = false;
        const { repo: r } = await fixture(kind, t, { fault(stage) { if (armed && stage === "beforeCommit") throw Error("candidate rejected"); } });
        const task = (await r.execute(create())).task, command = mutate(task, "task.complete", { completed: true });
        const events = []; r.subscribe(change => events.push(change)); armed = true;
        await assert.rejects(() => r.execute(command));
        assert.equal(r.getTask(task.id).completed, false); assert.equal(r.getReceipt(command.operationId), null);
        assert.equal(r.queryHistory().length, 0); assert.equal(r.info().revision, 1); assert.equal(events.length, 0);
        armed = false; await r.execute(command); assert.equal(r.queryHistory().length, 1); assert.equal(events.length, 1);
    });
    test(`${kind}: archive/delete retain evidence and identities`, async t => {
        const { repo: r } = await fixture(kind, t); let task = (await r.execute(create({ completed: true, steps: [{ title: "Completed Step", completed: true }] }))).task;
        task = (await r.execute(mutate(task, "task.archive", { archived: true }))).task;
        assert.equal(r.queryTasks().length, 0); assert.equal(r.queryTasks({ includeArchived: true }).length, 1); assert.equal(r.queryHistory({ counted: true }).length, 2);
        task = (await r.execute(mutate(task, "task.archive", { archived: false }))).task;
        task = (await r.execute(mutate(task, "task.delete", {}))).task;
        assert.equal(r.getTask(task.id), null); assert.equal(r.getTask(task.id, { includeDeleted: true }).deletedAt, task.deletedAt);
        assert.equal(r.queryHistory({ counted: true }).length, 2); assert.equal(r.queryTasks({ includeDeleted: true }).length, 1);
        await rejected(assert, () => r.execute(create({ id: task.id })), "IDENTITY_CONFLICT");
        await rejected(assert, () => r.execute(mutate(task, "task.complete", { completed: false })), "TASK_DELETED");
    });
    test(`${kind}: historical-only evidence never invents a live identity`, async t => {
        const { repo: r } = await fixture(kind, t), operationId = randomUUID();
        const record = { id: randomUUID(), operationId, partitionId: "resource-study", kind: "step", taskId: null, stepId: null,
            timestamp: null, recordedAt: null, ownerAtEvent: owners.resource, workingContext: null, oathId: null, sessionId: null,
            snapshot: { title: "Legacy Step", parentTitle: "Unknown parent" }, counted: true, reopenedAt: null, legacy: { originalRecord: { text: "Legacy Step", line: 7 } } };
        const command = { type: "history.record", operationId, payload: { record } };
        await r.execute(command); await r.execute(command); assert.equal(r.queryHistory().length, 1); assert.equal(r.queryTasks().length, 0);
        assert.equal(r.queryHistory()[0].taskId, null);
    });
    test(`${kind}: indexed queries, scope extension and isolated subscriptions`, async t => {
        const observerErrors = []; let scopedIds = [];
        const { repo: r } = await fixture(kind, t, { resolvers: { ...require("./support.cjs").resolvers, queryScope: () => scopedIds }, onSubscriberError: error => observerErrors.push(error.message) });
        const events = [], unsubscribe = r.subscribe(change => { events.push(change); change.taskIds.length = 0; });
        r.subscribe(() => { throw Error("subscriber error"); }); r.subscribe(async () => { throw Error("async subscriber error"); });
        const a = (await r.execute(create({ due: { date: "2026-12-31", time: null }, start: { date: "2026-10-16", time: "00:00" }, phase: { projectId: owners.a.id, phaseId: "phase-a" }, location: { type: "folder", id: "folder-a" } }))).task;
        const b = (await r.execute(create({ owner: owners.resource, completed: true }))).task; scopedIds = [b.id];
        assert.equal(r.queryTasks({ owner: owners.a }).length, 1); assert.equal(r.queryTasks({ completed: true })[0].id, b.id);
        assert.equal(r.queryTasks({ due: { from: "2026-01-01", to: "2027-01-01" } })[0].id, a.id);
        assert.equal(r.queryTasks({ start: { to: "2026-10-16" }, phase: a.phase, location: a.location })[0].id, a.id);
        assert.equal(r.queryTasks({ scope: { mountedSubtree: "synthetic" } })[0].id, b.id);
        assert.equal(r.queryTasks({ location: null, predicate: task => task.completed }).length, 1);
        assert.equal(events.length, 2); assert.equal(observerErrors.length, 4);
        unsubscribe(); const count = events.length; await r.execute(create()); assert.equal(events.length, count);
        await r.close(); assert.throws(() => r.queryTasks(), error => error.code === "CLOSED");
    });
    test(`${kind}: shared export excludes Resource tasks and private evidence`, async t => {
        const { repo: r } = await fixture(kind, t);
        const parent = randomUUID(), child = randomUUID();
        const a = (await r.execute(create({ steps: [{ id: parent, title: "Parent", order: 0 }, { id: child, parentStepId: parent, title: "Nested", order: 0 }], captureSource: { path: "C:/private/secret.md", url: "https://private.example" }, migration: { source: "legacy", sourceId: "private-alias", importedAt: null, evidence: { secret: "migration-secret" } } }))).task;
        await r.execute({ ...mutate(a, "task.complete", { completed: true }), context: { oathId: "private-oath", sessionId: "private-session", workingContext: owners.b }, coordination: { service: "inbox", id: "private-receipt", evidence: "private-operation" } });
        await r.execute(create({ owner: owners.resource, title: "Resource private", location: { type: "folder", id: "resource-folder" } }));
        await r.execute(create({ owner: owners.private, title: "Other private Project" }));
        const serialized = r.exportSharedPartition("git-a"), packet = deserializeSharedPartition(serialized);
        assert.equal(packet.tasks.length, 1); assert.equal(packet.tasks[0].id, a.id); assert.equal(packet.tasks[0].completed, true);
        for (const secret of ["Resource private", "Other private Project", "private-oath", "private-session", "private-receipt", "private-operation", "migration-secret", "private.example", "secret.md"]) assert.equal(serialized.includes(secret), false, secret);
        assert.throws(() => r.exportSharedPartition("resource-study"), error => error.code === "PARTITION_PRIVATE");
        assert.throws(() => r.exportSharedPartition("private-a"), error => error.code === "PARTITION_PRIVATE");
        const tasks = r.queryTasks({ partitionId: "git-a" }); assert.equal(serializeSharedPartition({ partition: packet.partition, tasks, completionRefs: packet.completionRefs }), serialized);
        assert.deepEqual(deserializeSharedPartition(serialized).tasks.map(t => t.id), [a.id]);
        assert.deepEqual(new Set(packet.tasks[0].steps.map(s => s.id)), new Set([parent, child]));
        assert.equal(packet.tasks[0].steps.find(s => s.id === child).parentStepId, parent);
        assert.equal(serializeSharedPartition({ partition: packet.partition, tasks: tasks.map(task => ({ ...task, steps: [...task.steps].reverse() })), completionRefs: packet.completionRefs }), serialized);
        assert.equal(packet.completionRefs[0].eventId, r.queryHistory({ taskId: a.id, kind: "task", counted: true })[0].id);
        const missingCompletion = JSON.parse(serialized); missingCompletion.completionRefs = [];
        assert.throws(() => deserializeSharedPartition(JSON.stringify(missingCompletion)), error => error.code === "VALIDATION");
        const injected = JSON.parse(serialized); injected.history = [{ secret: "device-private" }];
        assert.throws(() => deserializeSharedPartition(JSON.stringify(injected)), error => error.code === "VALIDATION");
        const resource = r.queryTasks({ owner: owners.resource })[0];
        assert.throws(() => serializeSharedPartition({ partition: packet.partition, tasks: [{ ...resource, partitionId: "git-a" }] }), error => error.code === "VALIDATION");
    });
    test(`${kind}: independent partition revisions and conflicting metadata`, async t => {
        const { repo: r } = await fixture(kind, t); const before = r.info();
        await r.execute(create()); const after = r.info(), a = after.partitions.find(p => p.id === "git-a"), b = after.partitions.find(p => p.id === "git-b");
        assert.equal(a.revision, 1); assert.equal(b.revision, 0); assert.equal(comparePartitionHeads(before.partitions[0], a), "remote-direct-child");
        const task = (await r.execute(create({ owner: owners.b }))).task; assert.equal(r.info().partitions.find(p => p.id === "git-a").head, a.head);
        const b1 = r.info().partitions.find(p => p.id === "git-b"); assert.equal(b1.revision, 1);
        const divergent = { ...b1, head: randomUUID() }; assert.equal(comparePartitionHeads(b1, divergent), "conflict-or-unproven-ancestry");
        const packet = JSON.parse(r.exportSharedPartition("git-b")); packet.partition.owner = owners.resource;
        assert.throws(() => deserializeSharedPartition(JSON.stringify(packet)), error => error.code === "VALIDATION");
        assert.throws(() => deserializeSharedPartition(r.exportSharedPartition("git-b"), a), error => error.code === "VALIDATION");
        assert.equal(task.partitionId, "git-b");
    });
    test(`${kind}: large nested Step ancestry stays portable and stable`, async t => {
        const { repo: r } = await fixture(kind, t); const ids = Array.from({ length: 1500 }, randomUUID);
        const task = (await r.execute(create({ steps: ids.map((id, index) => ({ id, title: `Step ${index}`, order: 0, parentStepId: index ? ids[index - 1] : null })) }))).task;
        assert.equal(task.steps.length, 1500); assert.equal(task.steps.at(-1).parentStepId, ids.at(-2));
        const reopened = await r.getTask(task.id); assert.deepEqual(reopened.steps.map(s => s.id), ids);
    });
    test(`${kind}: invalid batch and cyclic reparenting have no partial effects`, async t => {
        const { repo: r } = await fixture(kind, t);
        await rejected(assert, () => r.execute({ operationId: randomUUID(), type: "task.createMany", payload: { tasks: [{ owner: owners.a, title: "Would be valid", completed: true }, { owner: owners.a, title: "Invalid", unexpected: "x" }] } }), "VALIDATION");
        assert.equal(r.queryTasks().length, 0); assert.equal(r.queryHistory().length, 0); assert.equal(r.info().revision, 0);
        const parent = randomUUID(), child = randomUUID();
        const task = (await r.execute(create({ steps: [{ id: parent, title: "Parent", order: 0 }, { id: child, title: "Child", order: 0, parentStepId: parent }] }))).task;
        await rejected(assert, () => r.execute(mutate(task, "step.update", { stepId: parent, patch: { parentStepId: child } })), "VALIDATION");
        assert.deepEqual(r.getTask(task.id), task);
        assert.equal(JSON.stringify(r).includes(task.id), false, "Repository internals are not enumerable export data");
    });
}
test("date endpoints validate Gregorian leap years and midnight without a timezone conversion", () => {
    for (const date of ["2000-02-29", "0001-01-01", "0099-12-31", "2026-12-31"]) dateEndpoint({ date, time: "00:00" });
    for (const date of ["1900-02-29", "0000-01-01", "2026-02-29"]) assert.throws(() => dateEndpoint({ date, time: null }));
});
