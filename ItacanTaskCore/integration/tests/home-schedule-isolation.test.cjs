"use strict";
const instrument = require("../../perf/instrument.cjs").install();
const test = require("node:test"), S = require("./home-schedule-support.cjs"), { assert } = S;
const N = require("../../host/tests/support.cjs"), B = require("../../tests/recurrence-generation-support.cjs");
const query = f => ({ version: 2, authorityId: f.authorityId, selection: "tasks", owners: [N.owners[2].owner] });
test("consumer facts are opt-in, within one capture/five validations, with default/v1 projection unchanged", async t => {
    const f = await N.fixture(t); await f.create(); await N.settle(f.host);
    const ordinary = await f.host.readScoped(query(f)), measured = await instrument.measure("consumer-capture", () => f.host.readScoped({ ...query(f), includeConsumerFacts: true }));
    const count = label => measured.record.groups.filter(g => g.label === label).reduce((n, g) => n + g.calls, 0);
    assert.equal(count("src/repository.js.TaskRepository.readSnapshot"), 1); assert.equal(count("src/domain.js.validateState"), 5);
    const current = measured.value; assert.equal(current.status, "ok"); assert.deepEqual(current.snapshot.tasks[0].consumerFacts, { version: 1, recurrenceMember: false });
    const strip = S.V.clone(current.snapshot); delete strip.tasks[0].consumerFacts; assert.deepEqual(strip, ordinary.snapshot);
    const v1 = await f.host.read({ ...query(f), version: 1, ownerContextPin: ordinary.stamp.ownerContextPin }); assert.deepEqual(v1.snapshot, ordinary.snapshot);
    await assert.rejects(f.host.read({ ...query(f), version: 1, ownerContextPin: ordinary.stamp.ownerContextPin, includeConsumerFacts: true }));
    for (const patch of [{ selection: "editor", targets: [] }, { includeConsumerFacts: "yes" }]) await assert.rejects(f.host.readScoped({ ...query(f), includeConsumerFacts: true, ...patch }));
});
test("actual recurrence membership is projected without its definitions or hidden content", async t => {
    const f = await N.fixture(t, { repositoryOptions: { externalReservations: B.inventory() } }), task = await f.create({ due: { date: "2026-10-24", time: null } });
    await f.repo.execute(B.define(f.repo, task));
    const r = await f.host.readScoped({ ...query(f), includeConsumerFacts: true }); assert.equal(r.status, "ok"); assert.equal(r.snapshot.tasks[0].consumerFacts.recurrenceMember, true);
    assert.equal(r.snapshot.tasks[0].recurrence, undefined); assert.equal(r.snapshot.tasks[0].content, undefined);
});
test("known commitment plus failed Home refresh preserves outcome, rows and unavailable count", async t => {
    let f, armed = false; f = await S.consumerFixture(t, { repositoryOptions: { fault(stage) { if (armed && stage === "beforeAcknowledgement") { armed = false; f.registry.change(r => r.owners[0].available = false); } } } });
    await f.create(); const good = await f.read(); f.home.accept(good.items); const task = good.items.find(i => i.task.nativeReference).task; armed = true;
    const out = await f.home.toggle(task, true); assert.equal(out.outcome.status, "committed"); assert.equal(out.availability, "unavailable");
    const rows = f.home.reconcile(good.items, out); assert.equal(rows.length, good.items.length); const failed = await f.home.read(); assert.equal(failed.countComplete, false); assert.equal(f.repository.queryTasks()[0].completed, true);
});
test("nested native trees remain intact, read-only and absent from legacy locators", async t => {
    const f = await S.fixture(t, { consumerUiV1: true }), i = await f.intent(); i.action.draft.continuation = "PRIVATE_CONTINUATION"; i.action.draft.steps[0].body = "PRIVATE_BODY";
    i.action.draft.steps[1].parentStepId = i.action.draft.steps[0].id; i.action.draft.steps[1].order = 0;
    const cap = await f.session.authorize({ version: 1, owners: f.writerPolicy.owners, commands: f.writerPolicy.commands }); await f.session.requests.prepare(cap, i);
    assert.equal((await f.session.writer.task(cap, require("../../application/intents").compile(i).request)).status, "committed"); f.session.revoke(cap);
    const r = await f.runtime.list(), task = r.tasks[0]; assert(task.nativeReadOnly); assert(!JSON.stringify(r).includes("PRIVATE_"));
    const c = f.runtime.nativeTasks.createPanelRead({ plugin: {}, component: f.component(), workspace: f.owner }); await assert.rejects(c.toggle(task, true));
    assert.equal((await f.runtime.list()).tasks[0].steps[1].parentStepId, i.action.draft.steps[0].id); assert.equal((await f.runtime.retained()).length, 1);
});
test("Home identity outage never publishes a legacy-only complete feed or admits a replacement operation", async t => {
    let down = false; const f = await S.consumerFixture(t, { identity: { read: async () => { if (down) throw Error("PRIVATE_IDENTITY"); return null; }, subscribe: () => () => {} } });
    await f.create(); const good = await f.read(); f.home.accept(good.items); down = true;
    const bad = await f.home.read(); assert.equal(bad.countComplete, false); assert.equal(bad.items.length, good.items.length); assert(!JSON.stringify(bad).includes("PRIVATE_IDENTITY"));
});
