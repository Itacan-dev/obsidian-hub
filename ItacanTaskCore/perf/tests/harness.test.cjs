"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
const { install, union } = require("../instrument.cjs");
test("interval subtraction counts overlapping children once", () => { assert.equal(union([[1, 4], [3, 8], [10, 11]]), 8); assert.equal(union([]), 0); });
test("small samples do not invent p95 and empty reports cannot pass", () => { const { stats } = require("../analyze.cjs"); assert.equal(stats([1, 2, 3]).medianMs, 2); assert.equal(Object.hasOwn(stats([1, 2, 3]), "p95Ms"), false); assert.equal(stats(Array.from({ length: 20 }, (_, i) => i + 1)).p95Ms, 19); assert.throws(() => stats([])); assert.throws(() => stats([NaN])); });
test("CPU sample attribution preserves total time without adding inclusive stacks", () => { const { cpuSummary } = require("../analyze.cjs"), frame = name => ({ functionName: name, url: "synthetic.js", lineNumber: 0 }), r = cpuSummary({ nodes: [{ id: 1, callFrame: frame("root"), children: [2] }, { id: 2, callFrame: frame("work"), children: [3] }, { id: 3, callFrame: frame("leaf") }], samples: [2, 3], timeDeltas: [1000, 3000] }); assert.equal(r.sampledMs, 4); assert.equal(r.topSelf[0].percent, 75); assert.equal(r.topInclusive.find(x => x.source.includes(":work:")).percent, 100); });
test("wrappers preserve receiver, arguments, return values and thrown identity", async () => {
    const i = install(); try { const error = Error("Expected diagnostic probe"), obj = { n: 4 }, value = {};
        const sync = i.wrap("probe.sync", function (a) { assert.equal(this, obj); assert.equal(a, value); return a; });
        const async = i.wrap("probe.async", async function (a) { assert.equal(this, obj); return a; });
        const thrown = i.wrap("probe.throw", () => { throw error; });
        const malformed = i.wrap("probe.validateState", () => { throw error; });
        const result = await i.measure("probe", async () => { assert.equal(sync.call(obj, value), value); assert.equal(await async.call(obj, value), value); assert.throws(thrown, e => e === error); assert.throws(() => malformed({ tasks: {}, receipts: [] }), e => e === error); });
        assert.equal(result.record.groups.length, 4); assert(result.record.groups.every(g => g.calls === 1 && g.selfMs >= 0));
    } finally { i.restore(); }
});
test("diagnostic loading cannot bypass writer admission or manufacture no-op events", async () => {
    // Existing source checks run through the real host, writer, adapter and Save.
    const i = install(); try { const F = require("../fixtures.cjs"), parent = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-perf-semantic-")), base = await F.prepare(parent, 8), r = await F.R.openRuntime(base.directory), owner = r.info().workspaces[0].owner;
        try { const before = await F.describe(base.directory), editor = (await r.editor(base.taskId, owner)).editor, intent = await F.intent(editor, "save-noop");
            const out = await i.measure("native-noop", () => r.mutate(intent)); assert.equal(out.value.status, "committed"); assert.equal(out.value.atomicTask.createdEventIds.length, 0);
            const after = await F.describe(base.directory); assert.equal(after.events, before.events); assert.equal(after.receipts, before.receipts + 1);
            assert(out.record.groups.some(g => g.label === "src/domain.js.validateState")); assert(out.record.groups.some(g => g.label.includes("JsonGenerationStorage.commit")));
            const replay = await r.mutate(intent); assert.equal(replay.status, "replayed"); assert.deepEqual(replay.taskIds, out.value.taskIds); assert.equal((await F.describe(base.directory)).receipts, after.receipts);
            const changed = JSON.parse(JSON.stringify(intent)); changed.reason += " changed"; assert.equal((await r.mutate(changed)).status, "conflict");
        } finally { await r.close(); }
        const f = await F.direct(base.directory); try { const owner = f.profile.registry.owners[0].owner, e = (await f.editor.read({ version: 1, authorityId: f.profile.authorityId, owner, partitionId: "itacan", taskId: base.taskId })).editor, request = require("../../application/intents").compile(await F.intent(e, "save-noop")), before = await F.describe(base.directory), rejected = await f.writer.task(Object.freeze({ version: 1 }), request.request); assert.equal(rejected.status, "rejected"); assert.equal(rejected.code, "WRITER_CAPABILITY_REVOKED"); assert.deepEqual(await F.describe(base.directory), before); } finally { await f.close(); }
    } finally { i.restore(); }
});
test("fixed synthetic baseline copy refuses active locks and protected roots", async () => {
    const F = require("../fixtures.cjs"), parent = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-perf-contract-"));
    const base = await F.prepare(parent, 8), before = await F.describe(base.directory), clone = await F.copyClosed(base.directory, parent);
    assert.deepEqual(await F.describe(clone), before); assert.equal(before.tasks, 8); assert.equal(before.receipts, 2); assert.equal(before.events, 1);
    await assert.rejects(F.prepare(base.directory, 1), /separate/); assert.deepEqual(await F.describe(base.directory), before);
    const invalid = await fs.mkdtemp(path.join(parent, "invalid-root-")); await fs.writeFile(path.join(invalid, "RECOVERY.json"), "{}"); await assert.rejects(F.auditRoot(invalid), /separate/);
    const r = await F.R.openRuntime(base.directory); try { await assert.rejects(F.copyClosed(base.directory, parent), /held/); } finally { await r.close(); }
    await assert.rejects(F.pinRoot(process.cwd())); await assert.rejects(F.copyClosed(process.cwd(), parent));
});
