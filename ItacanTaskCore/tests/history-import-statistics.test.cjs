"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { spawnSync } = require("node:child_process");
const S = require("./history-import-support.cjs");
async function parity(vector, t) {
    const c = S.rawCapture(vector.records), v = await S.imported("memory", t, c);
    try {
        const actual = v.f.repo.historyCompatibility({ version: 1, projection: "statistics" });
        assert.deepEqual(S.observe(actual.records, vector.inputs, vector.now), S.observe(vector.records, vector.inputs, vector.now));
        assert.deepEqual(v.f.repo.historyCompatibility({ version: 1, projection: "recorded" }).records, vector.records);
        await v.f.reopen(); assert.deepEqual(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, actual.records);
    } finally { if (!t) await v.f.close(); }
}
if (process.argv[2] === "--timezone-e2") {
    (async () => { for (const v of S.vectorInputs()) await parity(v); process.stdout.write(JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, cases: S.vectorInputs().length, wholeAggregateParity: true })); })().catch(e => { process.stderr.write(e.stack); process.exitCode = 1; });
} else {
    for (const v of S.vectorInputs()) test("E2 committed full aggregate/recorded parity: " + v.id, t => parity(v, t));
    for (const timezone of ["UTC", "Europe/Stockholm", "America/New_York"]) test("E2 durable whole-corpus parity in " + timezone, () => {
        const child = spawnSync(process.execPath, [...process.execArgv.filter(a => a !== "--test"), __filename, "--timezone-e2"], { env: { ...process.env, TZ: timezone, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
        assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout), { timezone, cases: 47, wholeAggregateParity: true });
    });
    test("E2 genuine lifecycle matches actual legacy mutation and preserves full unrelated aggregates", async t => {
        const v = await S.imported("memory", t), task = v.f.repo.queryTasks()[0], check = v.capture.checks[0];
        const inputs = { workspaces: [{ projectId: "private", name: "Recorded private", contextKind: "project" }], reports: [{ projectId: "private", date: "2026-10-17", score: 3 }], notes: [{ path: "Projects/Private/Note.md", projectId: "private", createdAt: S.NOW - 90000000 }] };
        const edit = { path: check.path, line: check.line, hubTaskId: check.hubTaskId, oldText: check.text, wasCompleted: true, completed: false, tasks: [{ text: check.text, hubTaskId: check.hubTaskId, completed: false, steps: [] }], progressTransitions: [], lineDelta: 0 };
        const reopened = S.taskProgressMutation(v.capture.checks, v.capture.history, edit, { projectId: "private", name: "Recorded private", contextKind: "project" }, S.NOW + 1000, () => { throw Error("Reopen cannot allocate"); });
        await v.f.repo.execute(S.mutate(task, "task.complete", { completed: false }));
        assert.deepEqual(S.observe(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, inputs, S.NOW + 2000).models, S.observe(reopened.history, inputs, S.NOW + 2000).models);
        await v.f.repo.execute(S.mutate(v.f.repo.getTask(task.id), "task.complete", { completed: true }));
        const fresh = v.f.repo.queryHistory({ counted: true })[0];
        const completed = S.taskProgressMutation(reopened.checks, reopened.history, { ...edit, wasCompleted: false, completed: true, tasks: [{ ...edit.tasks[0], text: task.title, completed: true }] }, { projectId: "private", name: "Recorded private", contextKind: "project" }, S.NOW + 1000, () => fresh.id);
        assert.deepEqual(S.observe(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, inputs, S.NOW + 2000).models, S.observe(completed.history, inputs, S.NOW + 2000).models);
    });
    test("E2 reviewed historical owner labels survive absence from current workspaces", async t => {
        const v = await S.imported("memory", t), task = v.f.repo.queryTasks()[0];
        await v.f.repo.execute(S.mutate(task, "task.complete", { completed: false })); await v.f.repo.execute(S.mutate(v.f.repo.getTask(task.id), "task.complete", { completed: true }));
        const result = S.observe(v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }).records, {}, S.NOW + 2000);
        assert.equal(result.prepared.registry[0][1].name, "Recorded private"); assert.equal(result.prepared.registry[0][1].deleted, true);
    });
    test("E2 unavailable opaque raw capture publishes evidence without successful empty totals", async t => {
        const c = S.rawCapture([], [], { rawSource: { ...S.byteSource([], [], "opaque-original"), encoding: "opaque" } }), v = await S.imported("memory", t, c);
        assert.equal(v.f.repo.queryHistory().length, 0); assert.throws(() => v.f.repo.historyCompatibility({ version: 1, projection: "statistics" }), e => e.code === "HISTORY_UNAVAILABLE");
    });
}
