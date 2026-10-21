"use strict";
const { test } = require("node:test"), S = require("./support.cjs"), { assert } = S;
test("existing queue captures before a competing accepted mutation", async t => { let armed = false, enter, release; const entered = new Promise(r => enter = r), wait = new Promise(r => release = r); const f = await S.fixture(t, { fault: async stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; enter(); await wait; } } }); armed = true; const reading = f.read(); await entered; const writing = f.repo.execute({ type: "task.update", operationId: S.id(), taskId: f.task.id, expectedRevision: f.task.revision, payload: { patch: { title: "Later title" } } }); release(); const first = await reading; await writing; assert.equal(first.editor.draft.metadata.title, f.task.title); assert.equal((await f.read()).editor.draft.metadata.title, "Later title"); });
test("registry change during capture cannot publish old owner pins", async t => {
    let armed = false, captures = 0, injected = null;
    const order = [];
    const f = await S.hosted(t, { repositoryOptions: { fault: async stage => {
        if (armed && stage === "snapshot:beforeAcceptance" && ++captures === 1) {
            armed = false;
            const before = f.reg.snapshot().digest;
            f.reg.change(v => v.owners[2].status = "shelved");
            injected = { stage, capture: captures, before, after: f.reg.snapshot().digest };
            order.push("registry-mutated");
        }
    } } });
    const prototype = S.J.JsonGenerationStorage.prototype, original = prototype.assertReadObservation;
    prototype.assertReadObservation = async function (...args) {
        order.push("final-observation-start");
        const result = await original.apply(this, args);
        order.push("final-observation-accepted");
        return result;
    };
    let r;
    try { armed = true; r = await f.read(); }
    finally { prototype.assertReadObservation = original; }
    assert(injected, "The registry mutation must actually execute");
    assert.equal(injected.stage, "snapshot:beforeAcceptance");
    assert.equal(injected.capture, 1);
    assert.notEqual(injected.before, injected.after);
    assert.equal(order[0], "registry-mutated");
    assert(order.indexOf("final-observation-start") > order.indexOf("registry-mutated"));
    assert(order.indexOf("final-observation-accepted") > order.indexOf("registry-mutated"));
    assert.notEqual(r.stamp?.ownerContextPin, injected.before, "Stale owner pins cannot be published");
    assert.notEqual(r.status, "ok");
});
test("cancelled hosted editor read cannot publish accepted data", async t => { const f = await S.hosted(t), abort = new AbortController(); abort.abort(); const r = await f.port.read({ version: 1, authorityId: f.authorityId, owner: f.task.owner, partitionId: f.task.partitionId, taskId: f.task.id }, abort.signal); assert.notEqual(r.status, "ok"); });
test("live pointer-byte change is rejected by the existing JSON observation boundary", async t => { let armed = false; const f = await S.hosted(t, { repositoryOptions: { fault: async stage => { if (armed && stage === "snapshot:beforeAcceptance") { armed = false; const p = S.path.join(f.directory, "CURRENT.json"); await S.fs.appendFile(p, "\n"); } } } }); armed = true; const r = await f.read(); assert.notEqual(r.status, "ok"); });
test("closing revokes a late editor result", async t => { const f = await S.hosted(t); await f.session.close(); const r = await f.read(); assert.notEqual(r.status, "ok"); });
