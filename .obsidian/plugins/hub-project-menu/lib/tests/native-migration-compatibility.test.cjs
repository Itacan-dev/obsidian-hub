"use strict";
const { test, after } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { legacy, currentNative, readVectors } = require("./native-migration-compatibility-probes.cjs");
const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "native-migration-compatibility-v1.json"), "utf8"));
const vectors = readVectors(dataset), byId = id => vectors.find(v => v.caseId === id);
after(() => require("./task-service-fixture.cjs").restoreObsidianStub());
for (const vector of vectors) test(vector.caseId + ": " + vector.description, async () => {
    assert.deepEqual(await legacy(vector.legacyInput), vector.observedLegacyResult, "Frozen legacy observation changed; investigate, do not rewrite the capture");
    assert.deepEqual(await currentNative(vector.currentNativeInput), vector.observedNativeResult, "Frozen inactive-native observation changed");
});
test("fixture versions reject unknown newer formats independently of native schema", () => {
    assert.throws(() => readVectors({ ...dataset, fixtureVersion: 2 }), /Unsupported compatibility fixture version/);
    assert.throws(() => readVectors({ ...dataset, nativeSchemaVersion: 2 }), /Invalid compatibility dataset/);
    assert.throws(() => readVectors({ ...dataset, format: "unknown-format" }), /Invalid compatibility dataset/);
    assert.equal(new Set(vectors.map(v => v.caseId)).size, vectors.length);
});
test("every vector separates observations, preservation and pending policy", () => {
    for (const v of vectors) {
        for (const name of ["legacyInput", "legacyContext", "observedLegacyResult", "currentNativeInput", "observedNativeResult", "requiredPreservedMeaning", "proposedMapping", "expectedDisposition", "evidenceReferences", "openDecisionIds"]) assert(Object.hasOwn(v, name), v.caseId + ": " + name);
        assert.equal(v.fixtureVersion, 1); assert.equal(v.requiredPreservedMeaning.status, "established-preserve");
        assert.equal(v.expectedDisposition.status, "proposed-not-implemented");
        assert(v.evidenceReferences.length); assert(v.openDecisionIds.every(id => /^D\d{2}$/.test(id)));
        for (const result of [v.observedLegacyResult, v.observedNativeResult]) assert(["observed", "rejected", "unsupported", "source-inspected", "unverified"].includes(result.status));
    }
});
test("legacy same-day reversed times are accepted while native validation rejects", () => {
    const v = byId("DATE-same-day-reversed"); assert.equal(v.observedLegacyResult.status, "observed");
    assert.equal(v.observedNativeResult.status, "rejected"); assert.equal(v.expectedDisposition.value, "quarantine");
});
test("date-only and explicit midnight remain different; local DST bins vary in duration", () => {
    assert.equal(byId("DATE-date-only").observedNativeResult.value.start.time, null);
    assert.equal(byId("DATE-midnight").observedNativeResult.value.start.time, "00:00");
    for (const key of ["spring", "autumn"]) {
        const { range, timezone } = byId("DATE-local-" + key).observedLegacyResult.value;
        assert.equal(timezone, "Europe/Stockholm"); assert(range.bins.some(b => b.end - b.start !== 86400000));
    }
});
test("reopening removes legacy linked event but native retains uncounted evidence", () => {
    const v = byId("HIST-progress-check-reopen-recheck"), old = v.observedLegacyResult.value, n = v.observedNativeResult.value;
    assert.deepEqual(old.map(s => s.history.length), [1, 0, 1]);
    assert.equal(n.history.length, 2); assert.equal(n.counted, 1); assert.equal(n.bindings.length, 1);
    assert.equal(n.history.filter(h => !h.counted && h.reopenedAt !== null).length, 1);
});
test("raw truthy-ID deduplication precedes timestamp filtering and scalar types stay distinct", () => {
    assert.equal(byId("HIST-raw-duplicate-order-invalid-first").observedLegacyResult.value.statistics.completions.length, 0);
    assert.equal(byId("HIST-raw-duplicate-order-valid-first").observedLegacyResult.value.statistics.completions.length, 1);
    const v = byId("HIST-raw-raw-scalars").observedLegacyResult.value;
    assert.equal(v.records.length, 6); assert.equal(v.statistics.completions.length, 6);
    assert.equal(typeof v.records[0].id, "number"); assert.equal(typeof v.records[1].id, "string");
    assert.equal(Object.hasOwn(v.records[5], "id"), false);
});
test("both legitimate awaitingIndex cases remain resolved in isolated scheduled enrollment", () => {
    for (const name of ["new", "preexisting"]) {
        const old = byId("OATH-awaiting-" + name).observedLegacyResult.value;
        assert.equal(old.state, "scheduled"); assert.equal(old.work.length, 1); assert(old.work[0].task);
        assert(old.pending.includes(old.id));
    }
    assert.equal(byId("OATH-awaiting-preexisting").observedLegacyResult.value.id, "source-existing");
});
test("receipt retries and lost acknowledgements have one task/event effect", () => {
    for (const name of ["replay", "lost-ack", "precommit"]) {
        const n = byId("RETRY-" + name).observedNativeResult.value;
        assert.equal(n.tasks.length, 1); assert.equal(n.history.length, 1); assert.equal(n.receiptCount, 1); assert.equal(n.revision, 1);
    }
    assert.equal(byId("RETRY-changed-input").observedNativeResult.value.outcomes[1].code, "OPERATION_CONFLICT");
});
test("both shared Projects exclude private provenance and all Resource partitions reject export", () => {
    for (const name of ["itacan", "hub"]) {
        const packet = byId("PRIVATE-" + name).observedNativeResult.value;
        assert.equal(Object.hasOwn(packet.tasks[0], "migration"), false); assert.equal(Object.hasOwn(packet.tasks[0], "captureSource"), false);
    }
    for (const name of ["private", "knowledge", "research", "explorations", "inspiration"]) assert.equal(byId("PRIVATE-" + name).observedNativeResult.code, "PARTITION_PRIVATE");
});
test("separate historical append and completed create demonstrate semantic double counting", () => {
    const n = byId("HIST-import-double-count-risk").observedNativeResult.value;
    assert.equal(n.tasks.length, 1); assert.equal(n.history.length, 2); assert.equal(n.counted, 2);
    assert.equal(n.bindings.length, 1); assert.equal(n.history.filter(e => e.taskId === null).length, 1);
});
test("source/history partial failure and clear preserve their actual distinct outcomes", () => {
    const failure = byId("HIST-source-commits-history-fails").observedLegacyResult.value;
    assert(failure.snapshot.contents[Object.keys(failure.snapshot.contents)[0]].includes("[x] Parent"));
    assert.equal(failure.snapshot.history.length, 0); assert(failure.notices.some(n => n === "The task changed, but its History could not be saved."));
    const cleared = byId("HIST-clear-recorded").observedLegacyResult.value;
    assert.equal(cleared.history.length, 1); assert.equal(cleared.history[0].id, "old-event");
    assert.equal(cleared.checks.length, 0); assert.equal(Object.values(cleared.contents)[0], "- [ ] Following\n");
});
