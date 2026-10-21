"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), Module = require("node:module");
const original = Module._load;
Module._load = function(name) { return name === "obsidian" ? { Modal: class {}, Component: class {}, setIcon() {} } : original.apply(this, arguments); };
const { DailyBriefService } = require("../services/daily-brief"); Module._load = original;
const { createReadFixture, briefFacts } = require("./task-read-fixture.cjs");
const { dailyBriefSnapshot, briefFromSnapshot } = require("../domain/daily-brief");
const { RulesRecommendationProvider } = require("../domain/brief-recommendations");
const baseline = require("./task-read-parity.json");
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function setup(t, options = {}) {
    const f = createReadFixture(), service = new DailyBriefService(f.plugin, { now: f.now, ...options }); service.started = true;
    t.after(async () => { service.destroy(); await f.close(); }); return { ...f, service };
}
function replaceRead(f, queryStructured) {
    const actual = f.plugin.taskService;
    const wrapper = { subscribe: actual.subscribe.bind(actual), close: actual.close.bind(actual), queryStructured };
    f.plugin.taskService = wrapper; if (f.service.readSession) f.service.readSession.service = wrapper;
}
test("Daily Brief context and recommendation evidence match the old implementation at all captured day/DST boundaries", async t => {
    const f = setup(t), before = f.state();
    for (const entry of baseline.brief) assert.deepEqual(briefFacts(await f.service.context(new Date(entry.now))), entry.facts);
    assert.equal(f.counts.indexes, 1); assert.equal(f.state(), before); assert.equal(f.counts.writes, 0);
    assert.equal(f.plugin.taskData.subscribers.size, 1);
});
test("Daily Brief requires checked sources for eligibility and retains unrelated recommendations", async t => {
    const f = setup(t), originalWarn = console.warn; console.warn = () => {}; t.after(() => { console.warn = originalWarn; });
    f.contents.set("Projects/App/Tasks/Continuation.md", "# deleted task\n");
    const context = await f.service.context();
    assert.equal(context.relevantTasks.find(task => task.hubTaskId === "assignment").available, false);
    assert(context.relevantTasks.some(task => task.hubTaskId === "due"));
    assert.equal(new RulesRecommendationProvider().getRecommendation(context).reason, "no-clear-action");
    assert.equal(f.counts.writes, 0);
});
test("persisted Daily Brief artifacts are reused without requery, recalculation or schema/data writes", async t => {
    const f = setup(t), context = await f.service.context();
    const snapshot = dailyBriefSnapshot(context, new RulesRecommendationProvider().getRecommendation(context));
    f.wizard.data.dailyBriefSnapshot = snapshot;
    const before = JSON.stringify(f.wizard.data), reads = f.counts.indexes;
    replaceRead(f, async () => { throw Error("Saved records do not read current task data"); });
    f.projects[0].status = "shelved";
    assert.deepEqual(await f.service.load(), briefFromSnapshot(snapshot));
    assert.equal(JSON.stringify(f.wizard.data), before); assert.equal(f.counts.indexes, reads); assert.equal(f.counts.writes, 0);
});
test("a newer invalidation during provider work cannot save an older Daily Brief", async t => {
    const entered = deferred(), release = deferred(), newer = deferred(); let providerCalls = 0, saved = 0;
    const f = setup(t, { provider: { getRecommendation: async context => {
        providerCalls++; if (providerCalls === 1) { entered.resolve(); await release.promise; } else newer.resolve();
        return { title: "generation " + providerCalls, target: context.fallbackTarget };
    } } });
    f.plugin.dataStore.save = async () => { saved++; };
    const pending = f.service.load(); await entered.promise;
    f.plugin.taskData.invalidateAll(); f.flush(); release.resolve(); await newer.promise;
    const brief = await pending; assert.equal(brief.recommendation.title, "generation 2"); assert.equal(saved, 1);
});
test("Daily Brief disposal during discovery prevents provider and persistence work", async t => {
    const f = setup(t), read = deferred(), entered = deferred(); let provider = 0, saves = 0;
    replaceRead(f, () => { entered.resolve(); return read.promise; });
    f.service.provider = { getRecommendation: () => { provider++; } }; f.plugin.dataStore.save = async () => { saves++; };
    const pending = f.service.load(); await entered.promise; f.service.destroy(); read.resolve({ rows: [], diagnostics: [] });
    assert.equal(await pending, null); assert.equal(provider + saves, 0); assert.equal(f.plugin.taskData.subscribers.size, 0);
});
test("Oath activation during provider work prevents a stale snapshot save", async t => {
    const entered = deferred(), release = deferred(); let saves = 0;
    const f = setup(t, { provider: { getRecommendation: async () => { entered.resolve(); await release.promise; return { title: "old" }; } } });
    f.plugin.dataStore.save = async () => { saves++; };
    const pending = f.service.load(); await entered.promise; f.plugin.oath.active = true; release.resolve();
    assert.equal(await pending, null); assert.equal(saves, 0);
});
test("crossing the local 06:00 day boundary during provider work never saves the previous day's artifact", async t => {
    const entered = deferred(), release = deferred(); let now = new Date(2026, 9, 26, 5, 59), saves = 0;
    const f = setup(t, { now: () => now, provider: { getRecommendation: async () => { entered.resolve(); await release.promise; return { title: "old day" }; } } });
    f.wizard.getProgressReports = scope => scope?.kind === "resource" ? [] : [{ projectId: "app", projectName: "App",
        date: "2026-10-24", timestamp: new Date(2026, 9, 24, 14).getTime(), score: 1, summary: "Earlier work" }];
    f.plugin.dataStore.save = async () => { saves++; };
    const pending = f.service.load(); await entered.promise; now = new Date(2026, 9, 26, 6); release.resolve();
    assert.equal(await pending, null); assert.equal(saves, 0); assert.equal(f.wizard.data.dailyBriefSnapshot, undefined);
});
test("availability reads are asynchronous, read-only and safely ignore disposed/rejected work", async t => {
    const f = setup(t), before = f.state(); await f.service.refreshAvailability();
    assert.equal(f.service.availability().available, true); assert.equal(f.state(), before); assert.equal(f.counts.writes, 0);
    const read = deferred(), entered = deferred(); f.service.readSession.invalidate();
    replaceRead(f, () => { entered.resolve(); return read.promise; });
    const refresh = f.service.refreshAvailability(); await entered.promise; f.service.destroy(); read.reject(Error("late rejection")); await refresh;
    assert.equal(f.service.availability().available, false);
});
