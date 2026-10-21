"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), { spawnSync } = require("node:child_process");
const { H, NOW, rawCapture, mappingCapture, seal, review, observe, summary, vectorInputs, sourcePins, nativeSpec, support, taskProgressMutation, statistics, pluginRoot, normalize } = require("./legacy-harness.cjs");
const frozen = require("./decision-vectors-v1.json");
const vectors = vectorInputs();
test("E1 frozen observations pin the actual source graph separately from proposed policies", () => {
    assert.equal(frozen.format, "itacan-history-e1-observations"); assert.equal(frozen.version, 1); assert.equal(frozen.decisionRevision, H.HISTORY_DECISION);
    assert.deepEqual(frozen.sourcePins, sourcePins()); assert.deepEqual(frozen.policies.map(p => p.id), [...H.HISTORY_POLICIES]);
    assert(frozen.policies.every(p => p.status === "E1-contract-reviewed; E2-unimplemented"));
    assert.deepEqual(frozen.cases.map(({ observation, ...input }) => input), vectors);
});
for (const vector of vectors) test("E1 full actual-helper parity and frozen observation: " + vector.id, () => {
    const capture = rawCapture(vector.records), before = structuredClone(capture);
    const projection = H.projectStatisticsCompletions(capture), recorded = H.projectRecordedHistory(capture);
    assert.deepEqual(projection.records, vector.records); assert.deepEqual(recorded.records, vector.records);
    const actual = observe(vector.records, vector.inputs, vector.now), projected = observe(projection.records, vector.inputs, vector.now);
    assert.deepEqual(projected, actual); // Entire aggregate, registry, order and unrelated metrics, or the actual error.
    assert.deepEqual(summary(projection.records, vector.inputs, vector.now), frozen.cases.find(c => c.id === vector.id).observation);
    assert.deepEqual(capture, before); const a = H.analyzeHistoryCapture(capture);
    assert.equal(a.accounting.groupedRows, vector.records.length);
    assert.deepEqual(a.groups.flatMap(g => g.ordinals).sort((a, b) => a - b), vector.records.map((_, i) => i));
});
for (const [id, count] of [["raw-id-missing", 2], ["raw-id-null", 2], ["raw-id-empty", 2], ["raw-id-zero", 2], ["raw-id-false", 2], ["raw-id-string-zero", 1], ["raw-id-number-seven", 1], ["raw-id-string-seven", 1], ["mixed-id-types", 7], ["duplicate-invalid-first", 0], ["duplicate-valid-first", 1], ["duplicate-future-first", 0], ["timestamp-fractional", 1], ["timestamp-string", 0]]) test("E1 source-backed count: " + id, () => {
    const v = vectors.find(v => v.id === id); assert.equal(summary(v.records, v.inputs, v.now).completionRows, count);
});
test("E1 History presentation retains ordered duplicate rows independently of global Statistics deduplication", () => {
    const v = vectors.find(v => v.id === "history-display-order"), a = observe(H.projectRecordedHistory(rawCapture(v.records)).records);
    assert.equal(a.display.length, 3); assert.equal(a.prepared.completions.length, 2);
    assert.deepEqual(a.completions.map(r => r.id), ["old", "new", "old"]);
});
test("E1 owner selection occurs after global preparation and cannot rescue a suppressed duplicate", () => {
    const v = vectors.find(v => v.id === "duplicate-other-owner-first"), a = observe(H.projectStatisticsCompletions(rawCapture(v.records)).records);
    assert.equal(a.prepared.completions.length, 1); assert.equal(a.prepared.completions[0].projectId, "hub");
    assert.equal(a.models.find(m => m.range === "all" && m.workspace === "project:private"), undefined);
});
test("E1 unsupported relevant evidence reproduces actual unavailability, never successful empty totals", () => {
    for (const id of ["unsupported-relevant-id", "unsupported-relevant-owner"]) {
        const v = vectors.find(v => v.id === id), p = H.projectStatisticsCompletions(rawCapture(v.records));
        assert.equal(p.records.length, 1); const r = observe(p.records); assert.equal(r.status, "rejected"); assert.equal(r.code, "HISTORY_UNAVAILABLE");
    }
});
test("E1 deleted/unassigned/resource/moved-note attribution follows recorded facts and preserves all cohorts", () => {
    const v = vectors.find(v => v.id === "all-owner-cohorts"), a = observe(H.projectStatisticsCompletions(rawCapture(v.records)).records, v.inputs);
    assert.equal(a.status, "observed");
    for (const key of ["project:private", "project:itacan", "project:hub", "resource:resource:study", "resource:resource:literature", "resource:resource:references", "resource:resource:inspiration", "project:deleted", "project:unassigned"]) assert(a.prepared.registry.some(([k]) => k === key), key);
    assert.equal(a.prepared.registry.find(([k]) => k === "project:deleted")[1].deleted, true);
});
test("E1 full aggregates preserve independent work, notes, reports, Oath metrics and All-time earliest contributions", () => {
    const v = vectors.find(v => v.id === "independent-metric-sentinels"), original = observe(v.records, v.inputs), projected = observe(H.projectStatisticsCompletions(rawCapture(v.records)).records, v.inputs);
    assert.deepEqual(projected, original); assert.equal(projected.prepared.progress.length, 3); assert.equal(projected.prepared.sessions.length, 1); assert.equal(projected.prepared.totalNotes, 1); assert.equal(projected.prepared.noteEdits.length, 1);
    assert(projected.prepared.earliest < NOW - 9 * 86400000);
});
for (const timezone of ["UTC", "Europe/Stockholm", "America/New_York"]) test("E1 actual calendar/DST/month/leap/bin observations in " + timezone, () => {
    const child = spawnSync(process.execPath, [__dirname + "/legacy-harness.cjs", "--timezone-observations"], { env: { ...process.env, TZ: timezone, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout), frozen.timezones.find(t => t.requested === timezone).observation);
});
test("E1 UI remains All time while the actual internal aggregate default remains 3m", () => {
    assert.match(fs.readFileSync(path.join(pluginRoot, "ui/statistics.js"), "utf8"), /this\.range\s*=\s*["']all["']/);
    const prepared = statistics.prepareStatistics({}, NOW); assert.deepEqual(statistics.aggregateStatistics(prepared), statistics.aggregateStatistics(prepared, "3m"));
});
test("E1 actual legacy reopen/recomplete matches the explicit visibility specimen without erasing raw evidence", async () => {
    const c = await mappingCapture(), a = H.analyzeHistoryCapture(c), binding = a.bindings[0], represented = nativeSpec(c, { origin: "represented-import", groupKey: binding.groupKey });
    const current = c.checks[0], edit = { path: current.path, line: current.line, hubTaskId: current.hubTaskId, oldText: current.text, wasCompleted: true, completed: false, tasks: [{ hubTaskId: current.hubTaskId, text: current.text, completed: false, steps: [] }], progressTransitions: [], lineDelta: 0 };
    const context = { projectId: "private", name: "Private", contextKind: "project" };
    const reopened = taskProgressMutation(c.checks, c.history, edit, context, NOW, () => "must-not-allocate");
    assert.equal(reopened.history.length, 0); assert.equal(reopened.checks.length, 0);
    const visibility = { version: 1, captureDigest: c.digest, reopenedTargets: [binding.entryId] };
    const p = H.projectStatisticsCompletions(c, [represented], visibility); assert.deepEqual(observe(p.records), observe(reopened.history));
    const genuine = nativeSpec(c, { eventId: support.id(7100), completedAt: NOW, publication: { revision: 6, index: 0 } });
    const completed = taskProgressMutation(reopened.checks, reopened.history, { ...edit, wasCompleted: false, completed: true, tasks: [{ ...edit.tasks[0], completed: true }] }, context, NOW, () => genuine.event.id);
    const inputs = { workspaces: [{ projectId: "private", contextKind: "project", name: "Private" }] };
    const result = H.projectStatisticsCompletions(c, [represented, genuine], visibility), expected = observe(completed.history, inputs), actual = observe(result.records, inputs);
    // Minimal native snapshots intentionally have no fabricated source navigation.
    // Statistics sees the same semantic input and entire aggregate after conversion.
    assert.deepEqual(actual.models, expected.models); assert.equal(actual.prepared.completions.length, 1); assert.equal(c.history.length, 1);
});
test("E1 actual deletion housekeeping detaches checks while retaining historical activity", async () => {
    const c = await mappingCapture(), check = c.checks[0];
    const deleted = taskProgressMutation(c.checks, c.history, { operation: "delete", path: check.path, line: check.line, oldText: check.text, hubTaskId: check.hubTaskId, tasks: [], removedLines: 1, lineDelta: -1, progressTransitions: [] }, null, NOW, () => { throw Error("Deletion must not allocate"); });
    assert.equal(deleted.checks.length, 0); assert.deepEqual(deleted.history, c.history); assert.deepEqual(observe(H.projectStatisticsCompletions(c).records).models, observe(deleted.history).models);
});
test("E1 actual isolated host History-save failure leaves source completion without a surviving History event", async () => {
    const probes = require(path.join(pluginRoot, "tests/native-migration-compatibility-probes.cjs"));
    try {
        const observation = await probes.legacy({ probe: "history-write-failure" }); assert.equal(observation.status, "observed");
        const snapshot = observation.value.snapshot;
        assert.match(JSON.stringify(snapshot), /\[x\]/); assert.equal(snapshot.history.length, 0);
        assert(observation.value.notices.length > 0);
    } finally { require(path.join(pluginRoot, "tests/task-service-fixture.cjs")).restoreObsidianStub(); }
});
