"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { lifecycleHistory, oathMode, oathOutcome, planOutcome } = require("../domain/progress-history");

const project = { type: "project", id: "project" };
const resource = { type: "resource", id: "study" };
const other = { type: "project", id: "other" };
const deadline = Date.UTC(2026, 10, 20, 12);
const plan = (id, status, at, entries, archiveReason) => ({
    id, status, endedAt: new Date(at).toISOString(), archiveReason,
    snapshot: { note: "Saved note", entries }
});
const completed = plan("finished", "finished", deadline - 1000, [{ kind: "task", reference: { ownerHint: project } }]);
const skipped = plan("missed", "timed-out", deadline - 500, [
    { kind: "file", reference: { sourceWorkspace: resource }, intendedContext: other }
], "never-activated");
const oath = { id: "oath", state: "fulfilled", completedAt: deadline, workspaces: [project, resource],
    policy: { mode: "strict" }, planId: completed.id };
const broken = { id: "broken", state: "broken", completedAt: deadline - 1500, workspace: other };
const input = {
    plans: [completed, skipped, { id: "future" }],
    oathsByDevice: {
        device1: { history: [oath, broken], current: oath },
        device2: { history: [oath], current: { id: "running", state: "active", completedAt: deadline } },
        device3: { current: { id: "no-timestamp", state: "invalid" } }
    }
};
const keys = options => lifecycleHistory(options).map(event => event.key);

test("History interleaves independent Oaths and archived Plans newest first, once per record", () => {
    assert.deepEqual(keys(input), ["oath:oath", "plan:missed", "plan:finished", "oath:broken"]);
    assert.equal(lifecycleHistory(input)[0].record.planId, completed.id);
    assert.equal(planOutcome(skipped), "Plan never activated");
    assert.equal(oathMode(oath), "Strict");
    assert.equal(oathMode(broken), "Regular");
    assert.equal(oathOutcome(broken), "Broken");
});

test("Workspace History uses recorded membership across task, file, and multi-workspace Oath references", () => {
    assert.deepEqual(keys({ ...input, workspace: project }), ["oath:oath", "plan:finished"]);
    assert.deepEqual(keys({ ...input, workspace: resource }), ["oath:oath", "plan:missed"]);
    assert.deepEqual(keys({ ...input, workspace: other }), ["plan:missed", "oath:broken"]);
    assert.deepEqual(keys({ ...input, workspace: { type: "resource", id: "unrelated" } }), []);
});
