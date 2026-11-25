"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { GlobalPlanService } = require("../services/global-plan");
const { clone, entryFor } = require("../domain/global-plan");
const { orderPlans, planDay, shiftDay } = require("../domain/plan-timeline");

function fixture(shared = {}) {
    const cache = shared.cache ?? new Map();
    shared.cache = cache;
    const now = new Date(2026, 10, 21, 10);
    const storage = {
        getItem: key => cache.get(key) ?? null,
        setItem(key, value) { if (shared.storageFailure) throw Error("Storage full"); cache.set(key, value); },
        removeItem: key => cache.delete(key)
    };
    const plugin = {
        app: { vault: { adapter: { getBasePath: () => "/planner-test" } } },
        projectWizard: { data: { globalPlan: shared.disk } },
        dataStore: { async updatePlan(apply) {
            if (shared.diskFailure) throw Error("Disk full");
            const next = { globalPlan: clone(shared.disk ?? null) };
            apply(next);
            shared.disk = clone(next.globalPlan);
            if (shared.lostAcknowledgement) throw Error("Acknowledgement lost");
            return next;
        } }
    };
    const plan = new GlobalPlanService(plugin, { storage, now: () => shared.now ?? now });
    plan.references = {
        audit: async () => {},
        workspace: () => null,
        resolve: async entries => entries.map(entry => ({
            entry, label: entry.lastKnownLabel, availability: entry.unavailableReason ? "missing" : "current"
        }))
    };
    return plan;
}

test("timeline orders Plans by intended day and observed start", () => {
    const day = "2026-11-21", now = new Date(2026, 10, 21, 8);
    const stamp = hour => new Date(2026, 10, 21, hour).toISOString();
    const record = (id, status, fields) => ({ id, status, calendarDate: day, createdAt: now.toISOString(), ...fields });
    const records = [
        record("ran", "active", { scheduledAt: stamp(8), startedAt: stamp(13) }),
        record("later", "scheduled", { scheduledAt: stamp(14) }),
        record("skipped", "timed-out", { archiveReason: "never-activated", scheduledAt: stamp(9) }),
        record("finished", "finished", { startedAt: stamp(10), endedAt: stamp(14) })
    ];
    assert.deepEqual(orderPlans(records).map(record => record.id), ["skipped", "finished", "ran", "later"]);
    assert.equal(planDay(records[1]), day);
    assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

test("explicit creation persists distinct records and contextual add keeps its target", async () => {
    const shared = {};
    const plan = fixture(shared);
    const active = await plan.createPlannerPlan({ date: "2026-11-21" });
    assert.equal(shared.disk.plansById[active].status, "active");
    assert.equal(shared.disk.plansById[active].startedAt, plan.now().toISOString());
    const scheduled = await plan.createPlannerPlan({ date: "2026-11-21" });
    assert.notEqual(active, scheduled);
    await plan.reschedulePlan(scheduled, "2026-11-21T15:00");
    assert.equal(shared.disk.plansById[scheduled].status, "draft");
    assert.equal(await plan.createPlan(), active);
    const another = await plan.createPlannerPlan();
    await assert.rejects(plan.reschedulePlan(another, "2026-11-21T15:00"), /same time/);
    await assert.rejects(plan.createPlannerPlan({ date: "2026-11-20" }), /today or a future day/);
    await assert.rejects(plan.reschedulePlan(another, "2026-11-22T"), /start time/);
    plan.setNote("A note only", scheduled);
    await plan.flush();
    assert.equal(shared.disk.plansById[scheduled].status, "scheduled");
    assert.equal(fixture(shared).readPlan(scheduled).content.note, "A note only");
});

test("retrying a creation after a lost acknowledgement commits only one record", async () => {
    const shared = { lostAcknowledgement: true };
    const plan = fixture(shared);
    const options = { date: "2026-11-22", id: "same-operation" };
    await assert.rejects(plan.createPlannerPlan(options), /Acknowledgement lost/);
    assert.equal(plan.readPlan(options.id), null);
    shared.lostAcknowledgement = false;
    assert.equal(await plan.createPlannerPlan(options), options.id);
    assert.deepEqual(Object.keys(shared.disk.plansById), [options.id]);
});

test("history resolves current navigation without reading snapshot tasks or changing captured fields", async () => {
    const plan = fixture();
    const file = entryFor("file", { path: "Old.md" }, { lastKnownLabel: "Old name" });
    const task = entryFor("task", { authorityId: "a", taskId: "t" }, { lastKnownLabel: "Task" });
    const id = await plan.createPlan([file, task]);
    const bound = plan.bind(id);
    bound.assertExecutable();
    await plan.finishPlan(id);
    assert.throws(() => bound.assertExecutable(), /no longer active/);
    const scheduled = await plan.schedulePlan("2026-11-21T13:00");
    assert.throws(() => plan.bind(scheduled).assertExecutable(), /no longer active/);
    const snapshot = plan.readPlan(id).snapshot;
    plan.mutateReferences(({ entries }) => { entries.find(entry => entry.id === file.id).reference.path = "New.md"; });
    await plan.flush();
    plan.references.resolve = async entries => {
        assert.deepEqual(entries.map(entry => entry.reference.path), ["New.md"]);
        return entries.map(entry => ({ entry, availability: "current" }));
    };
    const items = await plan.resolvePlan(id, { historicalNavigation: true });
    assert.equal(items[0].label, "Old name");
    assert.equal(items[0].navigationAvailability, "current");
    assert.equal(items[1].historical, true);
    assert.deepEqual(plan.readPlan(id).snapshot, snapshot);
});

test("a saved Plan reaches Saved while a deferred note remains available to recover", async () => {
    const plan = fixture();
    const id = await plan.createPlan();
    assert.throws(() => plan.setNote("Preserve this note", "old-plan"));
    plan.setNote("Current note", id);
    await plan.flush();
    assert.equal(plan.status, "Saved");
    assert.equal(plan.deferredInput.text, "Preserve this note");
    assert.equal(plan.recovery.read().deferredInput.text, "Preserve this note");
    plan.status = "Saving...";
    await plan.flush();
    assert.equal(plan.status, "Saved");
});

test("contentless scheduled proposals never replace or archive another Plan", async () => {
    const shared = {};
    const plan = fixture(shared);
    const active = await plan.createPlannerPlan();
    assert.equal(plan.active().id, active);
    assert.equal(plan.canFinish(active), false);
    plan.setNote("Active work", active);
    await plan.flush();

    const draft = await plan.createPlannerPlan();
    assert.equal(plan.readPlan(draft).calendarDate, null);
    await plan.reschedulePlan(draft, "2026-11-21T11:00");
    assert.equal(plan.readPlan(draft).status, "draft");
    assert.deepEqual(plan.listScheduled(), []);
    assert.equal(plan.nextScheduledTime(), Infinity);
    shared.now = new Date(2026, 10, 21, 11, 1);
    await plan.ensureLifecycle();
    assert.equal(plan.active().id, active);
    assert.equal(plan.readState().lastScheduledActivation, undefined);
    assert.deepEqual(plan.listHistorical(), []);
    plan.setNote("Keep this research", draft);
    await plan.flush();
    assert.equal(plan.readPlan(draft).status, "draft");
    await plan.closePlanner();
    const restarted = fixture(shared);
    assert.equal(restarted.readPlan(draft).content.note, "Keep this research");
    await restarted.reschedulePlan(draft, "2026-11-21T13:00");
    assert.equal(restarted.readPlan(draft).status, "scheduled");
    shared.now = new Date(2026, 10, 21, 13);
    await restarted.ensureLifecycle();
    assert.equal(restarted.active().id, draft);
    assert.equal(restarted.readPlan(active).archiveReason, "replaced");
});

test("real starts release an empty active card and cleanup waits for Planner exit", async () => {
    const shared = {};
    const plan = fixture(shared);
    const emptyActive = await plan.createPlannerPlan();
    const emptyDraft = await plan.createPlannerPlan();
    const noteOnly = await plan.createPlannerPlan({ date: "2026-11-22" });
    plan.setNote("A note", noteOnly);
    await plan.flush();
    const real = await plan.schedulePlan("2026-11-21T11:30");
    shared.now = new Date(2026, 10, 21, 11, 30);
    await plan.ensureLifecycle();
    assert.equal(plan.active().id, real);
    assert.equal(plan.readPlan(emptyActive).status, "draft");
    assert.equal(plan.readPlan(emptyDraft).status, "draft");
    assert.deepEqual(plan.listHistorical(), []);
    await plan.closePlanner();
    assert.equal(plan.readPlan(emptyActive), null);
    assert.equal(plan.readPlan(emptyDraft), null);
    assert.equal(plan.readPlan(noteOnly).content.note, "A note");
    assert.equal(plan.active().id, real);
});

test("a cleared or unsuccessfully saved note cannot authorize a fullscreen handoff", async () => {
    const shared = {};
    const plan = fixture(shared);
    const active = await plan.createPlannerPlan();
    plan.setNote("Ongoing work", active);
    await plan.flush();
    plan.plugin.oath = { active: true, committed: true, fulfilled: true, current: { id: "focus", planId: active } };
    const deferred = await plan.createPlannerPlan();
    await plan.reschedulePlan(deferred, "2026-11-21T11:30");
    plan.setNote("Initial note", deferred);
    await plan.flush();
    assert.equal(plan.listScheduled()[0].id, deferred);
    plan.setNote(" ", deferred);
    await plan.flush();
    shared.diskFailure = true;
    plan.setNote("Unsaved works", deferred);
    await assert.rejects(plan.flush(), /Disk full/);
    shared.now = new Date(2026, 10, 21, 11, 30);
    assert.deepEqual(plan.focusPrompts(), []);
    await plan.ensureLifecycle();
    assert.equal(plan.active().id, active);
    assert.deepEqual(plan.listHistorical(), []);
    await assert.rejects(plan.deletePlan(active, { confirmed: true }), /Disk full/);
    shared.diskFailure = false;
    await plan.flush();
    assert.deepEqual(plan.focusPrompts(), []);
    assert.equal(plan.readPlan(deferred).status, "draft");
    await assert.rejects(plan.deletePlan(active, { confirmed: true }), /Oath/);
});

test("restarting cleans up an interrupted empty Planner session before catch-up", async () => {
    const shared = {};
    const plan = fixture(shared);
    const empty = await plan.createPlannerPlan();
    const dated = await plan.createPlannerPlan({ date: "2026-11-22" });
    await plan.reschedulePlan(dated, "2026-11-22T08:00");
    const populated = await plan.createPlannerPlan();
    plan.add([entryFor("task", { authorityId: "a", taskId: "t" })], populated);
    await plan.flush();

    shared.now = new Date(2026, 10, 22, 9);
    const restarted = fixture(shared);
    await restarted.ensureLifecycle();
    assert.equal(restarted.readPlan(empty), null);
    assert.equal(restarted.readPlan(dated), null);
    assert.equal(restarted.readPlan(populated).content.entries.length, 1);
    assert.equal(restarted.active(), null);
    assert.deepEqual(restarted.listHistorical(), []);
    await assert.rejects(restarted.deletePlan(populated), /Confirm/);
    await restarted.deletePlan(populated, { confirmed: true });
    assert.equal(restarted.readPlan(populated), null);
});

test("midnight retains an empty card for the visit and deletion targets a single record", async () => {
    const shared = {};
    const plan = fixture(shared);
    const empty = await plan.createPlannerPlan();
    shared.now = new Date(2026, 10, 22, 0, 0);
    await plan.ensureLifecycle();
    assert.equal(plan.active(), null);
    assert.equal(plan.readPlan(empty).status, "draft");
    assert.deepEqual(plan.listHistorical(), []);

    const active = await plan.createPlannerPlan();
    plan.setNote("Finish deliberately", active);
    await plan.flush();
    await plan.finishPlan(active);
    const scheduled = await plan.createPlannerPlan({ date: "2026-11-23" });
    await plan.reschedulePlan(scheduled, "2026-11-23T08:00");
    plan.setNote("Cancel without activation", scheduled);
    await plan.flush();
    await plan.deletePlan(scheduled, { confirmed: true });
    assert.equal(plan.nextScheduledTime(), Infinity);
    assert.equal(plan.readPlan(active).status, "finished");
    await plan.deletePlan(active, { confirmed: true });
    assert.deepEqual(plan.listHistorical(), []);
    assert.equal(plan.finishedPreviewPlanId, null);
    assert.equal(plan.readPlan(empty).status, "draft");
});

test("a late retry after lost acknowledgement preserves draft content without a handoff", async () => {
    const shared = {};
    const plan = fixture(shared);
    const active = await plan.createPlannerPlan();
    plan.setNote("Current work", active);
    await plan.flush();
    const draft = await plan.createPlannerPlan();
    await plan.reschedulePlan(draft, "2026-11-21T11:00");
    shared.lostAcknowledgement = true;
    plan.setNote("Saved but not acknowledged", draft);
    await assert.rejects(plan.flush(), /Acknowledgement lost/);
    shared.now = new Date(2026, 10, 21, 11);
    shared.lostAcknowledgement = false;
    await plan.flush();
    await plan.ensureLifecycle();
    assert.equal(plan.active().id, active);
    assert.deepEqual(plan.listHistorical(), []);
    assert.equal(plan.readPlan(draft).status, "draft");
    assert.equal(plan.readPlan(draft).content.note, "Saved but not acknowledged");
});
