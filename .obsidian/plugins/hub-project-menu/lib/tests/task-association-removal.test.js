"use strict";
const assert = require("assert").strict;
const { HubDataStore } = require("../services/data-store");
const { taskMetadata } = require("../domain/task-planning");
const { taskFormValues } = require("../domain/task-form");
const { captureIntent, captureDraft } = require("../domain/inbox");

async function run() {
    const legacy = { linkedProjectId: "p", necessity: "must", fromDate: "2026-10-12", dueDate: "2026-10-14",
        dueTime: "00:00", captureSource: { origin: "Quick Add" } };
    const receipt = { id: "receipt", kind: "task", state: "prepared", taskId: "existing-task-id", workspaceId: "resource:r",
        location: "Resources/R/Tasks.md", text: "Resource task", input: { text: "Resource task", attachments: [] },
        values: { ...legacy, text: "Resource task", steps: [{ text: "A Step", completed: true, hubTaskId: "step-id", completedAt: 123 }] } };
    const data = { hubState: { schemaVersion: 1, revision: 4, updatedAt: "2026-10-12T09:00:00.000Z", deviceId: "fixture" },
        taskMetadata: { "existing-task-id": legacy, "project-task": { phaseId: "phase-p", necessity: "should" } },
        inbox: { version: 1, captures: [{ id: "capture", text: "Resource task", attachments: [],
            intent: { type: "task", workspaceId: "resource:r", ...legacy }, operation: receipt }] },
        resourceFolders: { shared: { path: "Resources/R", projects: ["p"] } },
        history: [{ id: "history-id", projectId: "resource:r", kind: "step", timestamp: 123 }],
        checks: [{ hubTaskId: "step-id", parentTaskId: "existing-task-id", timestamp: 123 }] };
    const original = JSON.stringify(data), writes = [];
    const store = new HubDataStore({ app: { vault: {} }, loadData: async () => data,
        saveData: async value => writes.push(JSON.parse(JSON.stringify(value))) });
    const loaded = await store.load();
    assert.equal(writes.length, 0, "Cleanup does not force a startup save of production data");
    assert.equal(JSON.stringify(data), original, "Loaded raw state is never mutated");
    assert.equal(loaded.taskMetadata["existing-task-id"].linkedProjectId, undefined);
    assert.equal(loaded.inbox.captures[0].intent.linkedProjectId, undefined);
    assert.equal(loaded.inbox.captures[0].operation.values.linkedProjectId, undefined);
    for (const key of ["history", "checks", "resourceFolders"]) assert.deepEqual(loaded[key], data[key]);
    assert.equal(loaded.taskMetadata["project-task"].phaseId, "phase-p");
    assert.equal(loaded.inbox.captures[0].operation.taskId, "existing-task-id", "Pending retry identity is preserved");
    assert.deepEqual(loaded.inbox.captures[0].operation.values.steps, receipt.values.steps);
    const saved = await store.save(data);
    assert.equal(saved.taskMetadata["existing-task-id"].linkedProjectId, undefined);
    assert.equal(writes[0].inbox.captures[0].operation.values.linkedProjectId, undefined, "Ordinary writes durably retire receipt links");
    assert.equal(JSON.stringify(data), original, "Saving does not mutate live task metadata");
    assert.deepEqual(taskMetadata(legacy), taskMetadata(loaded.taskMetadata["existing-task-id"]));
    assert.equal(taskFormValues({ text: "Resource task", ...legacy }).linkedProjectId, undefined);
    assert.equal(captureIntent({ type: "task", ...legacy }).linkedProjectId, undefined);
    assert.equal(captureDraft(data.inbox.captures[0]).linkedProjectId, undefined, "Legacy retry drafts cannot restore the retired field");
    const reload = new HubDataStore({ app: { vault: {} }, loadData: async () => writes[0], saveData: async () => {} });
    assert.deepEqual((await reload.load()).taskMetadata, saved.taskMetadata);
    console.log("PASS: retired task links are ignored, removed on ordinary persistence and stay removed after reload; dates, Steps, capture receipts, phase membership, identities, History and Resource folder mounts survive.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
