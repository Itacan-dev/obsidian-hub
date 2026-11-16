"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { classifyWindows, windowHandle } = require("../domain/oath-strict");
const { OathProcessObserver } = require("../services/oath-process-observer");
const { StrictOathCoordinator } = require("../services/oath-strict");
const policy = { mode: "strict", confirmationVersion: 1, applications: [] };
const row = (handle = "22", executable = "C:\\Apps\\Code.exe") => ({ pid: 10, handle, executable, title: "" });
const snapshot = (records, handles = []) => ({ records, sources: { status: "ok", records: handles.map(handle => ({ id: `window:${handle}:0`, title: "Same title" })) }, warnings: [] });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function observerFixture(getSources, response = { records: [row()], failures: 0 }, timeoutMs = 30) {
    return new OathProcessObserver({ getSources, timeoutMs, execute: (_file, _args, _options, callback) => {
        const timer = setTimeout(() => callback(null, JSON.stringify(response)), 0);
        return { kill() { clearTimeout(timer); callback(Error("cancelled")); } };
    } });
}
test("matching handles block known unpermitted windows and permit only configured executables", () => {
    const value = snapshot([row()], ["00022", "22"]);
    assert.equal(classifyWindows(value, policy).blockers.length, 1);
    assert.equal(classifyWindows(value, { ...policy, applications: ["c:\\apps\\code.exe"] }).blockers.length, 0);
    assert.equal(classifyWindows(snapshot([row()], []), policy).uncertain.length, 1);
    assert.equal(classifyWindows([row()], policy).blockers.length, 0);
});
test("Explorer, input utilities and overlays follow window evidence without executable exemptions", () => {
    for (const file of ["explorer.exe", "TextInputHost.exe", "NVIDIA Overlay.exe", "firefox.exe"]) {
        const record = row("22", "C:\\Windows\\" + file);
        assert.equal(classifyWindows(snapshot([record], ["22"]), policy).blockers.length, 1);
        assert.equal(classifyWindows(snapshot([record]), policy).uncertain.length, 1);
    }
});
test("unknown paths and additional windows remain unknown even with identical titles", () => {
    const value = snapshot([row("22", null)], ["22", "23"]);
    const result = classifyWindows(value, policy);
    assert.equal(result.blockers.length, 0); assert.equal(result.unknown.length, 2);
    assert.equal(result.unknown[1].sourceOnly, true);
});
test("host and dock exemptions use exact handles and do not permit another same-process window", () => {
    const value = snapshot([row("22"), row("23"), row("24")], ["22", "23", "24", "25"]);
    const result = classifyWindows(value, policy, { pid: 10, handle: "00022", dockHandle: "23" });
    assert.deepEqual(result.blockers.map(item => item.handle), ["24"]);
    assert.equal(result.unknown.length, 1);
});
test("handle parsing preserves 64-bit values and rejects invalid or overflowing identifiers", () => {
    assert.equal(windowHandle("9007199254740993"), "9007199254740993");
    assert.equal(windowHandle("-1"), "18446744073709551615");
    for (const value of [0, "0", "abc", "1.5", "18446744073709551616"]) assert.equal(windowHandle(value), null);
    const value = snapshot([row("9007199254740993")], ["9007199254740993"]);
    value.sources.records.push({ id: "screen:22:0" });
    const result = classifyWindows(value, policy);
    assert.equal(result.blockers.length, 1); assert(result.coverageLimited);
});
test("observer preserves partial rows and requests window metadata with zero thumbnails", async () => {
    let settings;
    const observer = observerFixture(async options => { settings = options; return [{ id: "window:22:0", name: "Title", thumbnail: "discard" }]; }, { records: [row()], failures: 2 });
    const pending = observer.listWindows(); assert.equal(observer.listWindows(), pending);
    const result = await pending;
    assert.deepEqual(settings, { types: ["window"], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false });
    assert.equal(result.records.length, 1); assert.equal(result.warnings.length, 1);
    assert.equal(result.sources.records[0].thumbnail, undefined);
});
test("timeout retains one source lease and discards late evidence before a fresh request", async () => {
    let resolve, calls = 0;
    const observer = observerFixture(() => { calls++; return new Promise(done => { resolve = done; }); });
    assert.equal((await observer.listWindows()).sources.status, "unavailable");
    assert.equal((await observer.listWindows()).sources.status, "unavailable"); assert.equal(calls, 1);
    resolve([{ id: "window:22:0" }]); await delay(0);
    const next = observer.listWindows(); await delay(5); assert.equal(calls, 2);
    resolve([]); assert.equal((await next).sources.records.length, 0);
});
test("cancellation rejects the snapshot and never reuses late source results", async () => {
    let resolve;
    const observer = observerFixture(() => new Promise(done => { resolve = done; }));
    const pending = observer.listWindows(); await delay(5); observer.cancel(); resolve([{ id: "window:22:0" }]);
    await assert.rejects(pending, /cancelled/);
    assert.equal((await observerFixture(async () => []).listWindows()).sources.records.length, 0);
});
test("malformed primary snapshots fail while source failures produce uncertain windows", async () => {
    for (const response of [null, [], { records: [null], failures: 0 }, { records: [], failures: -1 }]) {
        await assert.rejects(observerFixture(async () => [], response).listWindows(), /Invalid/);
    }
    const result = classifyWindows(await observerFixture(async () => { throw Error("Unavailable"); }).listWindows(), policy);
    assert.equal(result.blockers.length, 0); assert.equal(result.uncertain.length, 1); assert(result.coverageLimited);
});
test("preflight allows uncertainty, rechecks before preparation and nudges only corroborated blockers", async () => {
    let value = snapshot([row()]), focused = 0, releases = 0;
    const host = { identity: {}, enter: async () => {}, release: async () => releases++, focus: () => focused++, healthy: () => true };
    const coordinator = new StrictOathCoordinator({ enabled: true, host, observer: { listWindows: async () => value } });
    assert.equal((await coordinator.preflight(policy)).ready, true);
    await coordinator.prepare({ id: "a", policy }); coordinator.commit("a");
    await coordinator.poll(); assert.equal(focused, 0); assert.equal(coordinator.health.status, "degraded");
    value = snapshot([row()], ["22"]); await coordinator.poll(); assert.equal(focused, 1);
    await coordinator.poll(); assert.equal(focused, 1);
    await coordinator.release("a"); assert.equal(releases, 1);
    host.enter = async () => { value = snapshot([row()], ["22"]); };
    value = snapshot([]);
    assert.equal((await coordinator.prepare({ id: "b", policy })).ready, false); assert.equal(releases, 2);
    coordinator.observer.listWindows = async () => { throw Error("Unavailable"); };
    assert.equal((await coordinator.preflight(policy)).ready, false);
});

function lifecycleFixture() {
    const { HubOathService } = require("../services/oath");
    let now = 1000000, failedSave = false, observation = snapshot([row()]);
    const owner = { type: "project", id: "a" };
    const task = { id: "task", text: "Synthetic task", completed: false,
        nativeReference: { authorityId: "fixture", taskId: "task", taskRevision: 1, owner } };
    const context = { projectId: "a", name: "A", root: "Projects/A", path: "Projects/A/A.md", status: "active" };
    let releases = 0;
    const strict = new StrictOathCoordinator({ createReminder: async () => ({ start() {}, dispose() {} }), enabled: true, now: () => now,
        host: { identity: {}, enter: async () => {}, release: async () => releases++, focus() {} },
        observer: { listWindows: async () => observation } });
    const data = {};
    const runtime = { list: async () => ({ tasks: [task] }), info: () => ({ authority: { authorityId: "fixture" } }) };
    const plugin = { app: { vault: { getAbstractFileByPath: () => ({ path: context.path }) } },
        register() {}, dataStore: { deviceId: "test", save: async () => { if (failedSave) throw Error("Disk unavailable"); } },
        projectWizard: { data, getProjectById: () => context, getProjectRecords: () => [context] },
        nativeTaskHost: { matches: () => true, runtime: () => runtime,
            nativeTasks: { owners: [owner], availability: () => "current", createPanelRead: () => ({ snapshot: () => ({ availability: "current", tasks: [task] }) }) } } };
    const full = { restore() {}, destroy() {}, enter: async () => true, isFull: () => true, exit: async () => {} };
    const service = new HubOathService(plugin, full, { strict, now: () => now, notice() {} });
    return { service, task, data, strict, get releases() { return releases; },
        advance: ms => now += ms, fail: value => failedSave = value, observe: value => observation = value,
        async draft(extra = {}) {
            const value = { mode: "strict", start: "now", workspace: owner, durationMs: 60000, tasks: [task], ...extra };
            return { ...value, strictConfirmation: (await service.reviewStrict(value)).confirmation };
        }, async dispose() { await strict.release(strict.current?.id); service.destroy(); } };
}
test("uncertain windows permit commitment while early exit, frozen policies and save-before-release remain enforced", async () => {
    const f = lifecycleFixture();
    try {
        await f.service.take(await f.draft()); assert.equal(f.service.current.state, "active");
        assert.equal(await f.service.end(f.service.current.id, "broken"), "strict-unfulfilled");
        f.advance(60000); await f.service.refresh(); assert(f.service.fulfilled);
        f.fail(true); const released = f.releases;
        await assert.rejects(f.service.end(f.service.current.id), /Disk/);
        assert.equal(f.releases, released); assert.equal(f.service.bucket.history.length, 0);
        f.fail(false); await f.service.end(f.service.current.id);
        assert.equal(f.service.bucket.history.length, 1); assert.equal(f.releases, released + 1);
        await f.service.end(f.service.current.id); assert.equal(f.service.bucket.history.length, 1);
    } finally { await f.dispose(); }
});
test("scheduled blockers delay actual start, permit due cancellation and do not block uncertain activation", async () => {
    const f = lifecycleFixture();
    try {
        f.observe(snapshot([row()], ["22"]));
        await f.service.take(await f.draft({ start: "scheduled", scheduledAt: 1001000 }));
        f.advance(2000); await f.service.refresh(); assert.equal(f.service.current.startedAt, null);
        assert.equal(await f.service.end(f.service.current.id, "cancel"), "cancelled");
        await f.service.take(await f.draft({ start: "scheduled", scheduledAt: 1003000 }));
        f.advance(7000); f.observe(snapshot([row()])); await f.service.refresh();
        assert.equal(f.service.current.state, "active"); assert.equal(f.service.current.startedAt, 1009000);
        f.task.completed = true; await f.service.refresh(); assert(f.service.fulfilled);
        await f.service.end(f.service.current.id); assert.equal(f.service.bucket.history.length, 1);
    } finally { await f.dispose(); }
});
test("failed preparation save rolls back guards and restart recovery records interruption once", async () => {
    const f = lifecycleFixture();
    try {
        const enter = f.strict.host.enter;
        f.strict.host.enter = async () => { await enter(); f.fail(true); };
        const originalError = console.error; console.error = () => {};
        try { await f.service.take(await f.draft()); } finally { console.error = originalError; }
        assert.equal(f.service.current.state, "scheduled"); assert.equal(f.strict.current, null); assert(f.releases > 0);
        f.fail(false); f.strict.host.enter = enter; f.advance(6000); await f.service.refresh();
        assert.equal(f.service.current.state, "active");
        await f.strict.release(f.strict.current?.id); await f.service.refresh();
        assert.equal(f.service.current.state, "interrupted"); assert.equal(f.service.bucket.history.length, 1);
        await f.service.refresh(); assert.equal(f.service.bucket.history.length, 1);
    } finally { await f.dispose(); }
});

test("ordinary Oath can still end explicitly before fulfillment", async () => {
    const f = lifecycleFixture();
    try {
        const draft = await f.draft();
        await f.service.take({ ...draft, mode: "ordinary", strictConfirmation: undefined });
        assert.equal(f.service.current.state, "active");
        assert.equal(await f.service.end(f.service.current.id), "confirmation-required");
        assert.equal(await f.service.end(f.service.current.id, "broken"), "ended");
        assert.equal(f.service.current.state, "broken"); assert.equal(f.releases, 0);
    } finally { await f.dispose(); }
});
test("changing permitted defaults does not change an active confirmed policy", async () => {
    const f = lifecycleFixture();
    try {
        f.strict.verifyExecutable = async value => value;
        await f.service.setStrictApplications(["C:\\Apps\\Code.exe"]);
        await f.service.take(await f.draft());
        await f.service.setStrictApplications(["C:\\Apps\\Other.exe"]);
        assert.deepEqual(f.service.current.policy.applications, ["c:\\apps\\code.exe"]);
        assert.deepEqual(f.service.strictApplications, ["c:\\apps\\other.exe"]);
    } finally { await f.dispose(); }
});

const { strictPolicy, validPolicy } = require("../domain/oath-strict");
const manualDraft = { applicationCheckMode: "manual-review", manualApplicationReviewAcknowledged: true };
test("new policies require explicit manual acknowledgment and retain legacy automatic compatibility", () => {
    assert.equal(strictPolicy({ mode: "strict" }).applicationCheckMode, "automatic");
    assert.throws(() => strictPolicy({ mode: "strict", applicationCheckMode: "manual-review" }), /acknowledge/);
    const manual = strictPolicy({ mode: "strict", ...manualDraft });
    assert.equal(manual.confirmationVersion, 4); assert(validPolicy(manual)); assert(validPolicy(policy));
    assert.equal(validPolicy({ ...policy, applicationCheckMode: "manual-review" }), false);
    assert.equal(validPolicy({ ...manual, applicationCheckMode: "invalid" }), false);
    const findings = classifyWindows(snapshot([row()], ["22"]), manual);
    assert.equal(findings.blockers.length, 0); assert.equal(findings.candidates[0].switchability, "unverified"); assert(findings.coverageLimited);
});
test("manual review survives activation rechecks, overlay restarts without inventory focus nudges", async () => {
    const f = lifecycleFixture(); let focused = 0;
    f.strict.host.focus = () => focused++;
    try {
        const overlay = row("22", "C:\\Apps\\NVIDIA Overlay.exe");
        f.observe(snapshot([overlay], ["22"]));
        await assert.rejects(f.service.take(await f.draft()), /Resolve/);
        const enter = f.strict.host.enter;
        f.strict.host.enter = async () => { await enter(); f.observe(snapshot([{ ...overlay, pid: 11, handle: "33" }], ["33"])); };
        await f.service.take(await f.draft({ ...manualDraft, durationMs: 120000 }));
        assert.equal(f.service.current.state, "active");
        for (const handle of ["44", "55", "66"]) {
            f.observe(snapshot([{ ...overlay, pid: Number(handle), handle }, row("77")], [handle, "77"]));
            f.advance(20000); await f.strict.poll();
            assert.equal(f.strict.health.candidates.length, 2); assert.equal(focused, 0);
        }
        assert.equal(await f.service.end(f.service.current.id, "broken"), "strict-unfulfilled");
        await assert.rejects(f.strict.launch("C:\\Apps\\Code.exe"), /not permitted/);
        f.observe(snapshot([])); await f.service.refresh();
        assert.equal(f.service.current.policy.applicationCheckMode, "manual-review");
    } finally { await f.dispose(); }
});
test("manual mode and acknowledgment are bound to the review nonce", async () => {
    const f = lifecycleFixture();
    try {
        const automatic = await f.draft();
        await assert.rejects(f.service.take({ ...automatic, ...manualDraft }), /confirm/);
        const manual = await f.draft(manualDraft);
        await assert.rejects(f.service.take({ ...manual, manualApplicationReviewAcknowledged: false }), /acknowledge|confirm/);
        await assert.rejects(f.service.take({ ...manual, applicationCheckMode: "automatic" }), /confirm/);
        assert.equal(f.service.current, null);
        assert.equal((await f.service.reviewStrict(await f.draft())).policy.applicationCheckMode, "automatic");
    } finally { await f.dispose(); }
});
test("manual scheduled Oath retains its frozen mode when application candidates change", async () => {
    const f = lifecycleFixture();
    try {
        f.observe(snapshot([row()], ["22"]));
        await f.service.take(await f.draft({ ...manualDraft, start: "scheduled", scheduledAt: 1001000 }));
        f.observe(snapshot([row("99")], ["99"])); f.advance(2000); await f.service.refresh();
        assert.equal(f.service.current.state, "active");
        assert.equal(f.service.current.policy.applicationCheckMode, "manual-review");
    } finally { await f.dispose(); }
});
test("manual mode cannot bypass observation failure and active observation failure preserves commitment", async () => {
    const f = lifecycleFixture();
    try {
        const draft = await f.draft(manualDraft), observer = f.strict.observer;
        f.strict.observer = { listWindows: async () => { throw Error("Primary query unavailable"); } };
        await assert.rejects(f.service.take(draft), /Primary/); assert.equal(f.service.current, null);
        f.strict.observer = observer;
        await f.service.take(await f.draft(manualDraft));
        f.strict.observer = { listWindows: async () => { throw Error("Primary query unavailable"); } };
        await f.strict.poll(); assert.equal(f.service.current.state, "active"); assert.equal(f.strict.health.status, "degraded");
    } finally { await f.dispose(); }
});


async function nudgeFixture(mode = "manual-review", baseline = snapshot([]), version = 3) {
    let value = baseline, now = 0, focused = 0;
    const coordinator = new StrictOathCoordinator({ enabled: true, now: () => now,
        verifyExecutable: async value => value,
        host: { identity: { pid: 90, handle: "90", dockHandle: "91" }, enter: async () => {}, release: async () => {},
            focus: () => focused++, healthy: () => true },
        observer: { listWindows: async () => { if (value instanceof Error) throw value; return value; } } });
    const selected = { mode: "strict", confirmationVersion: version, applicationCheckMode: mode, applications: ["c:\\apps\\allowed.exe"] };
    await coordinator.prepare({ id: "nudge", policy: selected });
    return { coordinator, get focused() { return focused; }, set: next => value = next, advance: ms => now += ms,
        commit: () => coordinator.commit("nudge"), poll: () => coordinator.poll(),
        dispose: () => coordinator.release("nudge") };
}

test("version 3 uses final preparation baseline and two snapshots, across corroboration and PID changes", async () => {
    for (const mode of ["automatic", "manual-review"]) {
        const f = await nudgeFixture(mode, snapshot([row()]));
        try {
            f.set(snapshot([row("99", "C:\\Apps\\New.exe")]));
            await f.poll(); assert.equal(f.focused, 0); // not committed
            f.commit();
            await f.poll(); assert.equal(f.focused, 0);
            f.set(snapshot([{ ...row("98", "C:\\Apps\\New.exe"), pid: 44 }], ["98"]));
            await f.poll(); assert.equal(f.focused, 1);
            f.set(snapshot([])); await f.poll(); f.advance(60000);
            f.set(snapshot([row("55"), row("98", "C:\\Apps\\New.exe")]));
            await f.poll(); await f.poll(); assert.equal(f.focused, 1);
            assert.equal(f.coordinator.health.uncertain.length, 2);
            f.coordinator.detach(); await f.poll(); assert.equal(f.focused, 1);
        } finally { await f.dispose(); }
        assert.equal(f.coordinator.monitor, null);
    }
});

test("simultaneous identities share an event, cooldown consumes identities and three attempts exhaust budget", async () => {
    const f = await nudgeFixture();
    try {
        f.commit();
        const show = async names => {
            f.set(snapshot(names.map((name, i) => row(String(i + 22), `C:\\Apps\\${name}.exe`))));
            await f.poll(); await f.poll();
        };
        await show(["one", "two"]); assert.equal(f.focused, 1);
        assert.equal(f.coordinator.health.monitoring.lastEvent.applications.length, 2);
        await show(["three"]); assert.equal(f.focused, 1);
        assert.equal(f.coordinator.health.monitoring.lastEvent.outcome, "cooldown");
        f.advance(60000); await f.poll(); assert.equal(f.focused, 1);
        await show(["four"]); assert.equal(f.focused, 2);
        f.advance(60000); await show(["five"]); assert.equal(f.focused, 3);
        f.advance(60000); await show(["six"]); assert.equal(f.focused, 3);
        assert.equal(f.coordinator.health.monitoring.lastEvent.outcome, "budget-exhausted");
        assert.equal(f.coordinator.health.uncertain.length, 1);
    } finally { await f.dispose(); }
});

test("primary failure breaks persistence while supplemental failure still permits a bounded attempt", async () => {
    const f = await nudgeFixture();
    try {
        f.commit(); f.set(snapshot([row()])); await f.poll();
        f.set(Error("primary failed")); await f.poll();
        assert.equal(f.coordinator.health.status, "degraded");
        const degraded = snapshot([row()]); degraded.sources.status = "unavailable";
        f.set(degraded); await f.poll(); assert.equal(f.focused, 0);
        await f.poll(); assert.equal(f.focused, 1);
    } finally { await f.dispose(); }
});

test("focus errors consume attempts and never retry an executable", async () => {
    const f = await nudgeFixture(); let calls = 0;
    try {
        f.coordinator.host.focus = () => { calls++; throw Error("focus refused"); };
        f.commit(); f.set(snapshot([row()])); await f.poll(); await f.poll();
        assert.equal(f.coordinator.health.monitoring.lastEvent.outcome, "focus-error");
        f.advance(60000); await f.poll(); assert.equal(calls, 1);
        assert.equal(f.coordinator.health.monitoring.attempts, 1);
    } finally { await f.dispose(); }
});

test("permitted applications, exact host/dock windows and unknown sources never nudge", async () => {
    const f = await nudgeFixture();
    try {
        f.commit();
        f.set(snapshot([row("22", "C:\\Apps\\Allowed.exe"), row("23", null),
            { ...row("90"), pid: 90 }, { ...row("91"), pid: 90 }], ["22", "23", "90", "91", "92"]));
        await f.poll(); await f.poll(); assert.equal(f.focused, 0);
        assert.equal(f.coordinator.health.unknown.length, 2);
        await assert.rejects(f.coordinator.launch("C:\\Apps\\Code.exe"), /not permitted/);
    } finally { await f.dispose(); }
});

test("version 2 manual commitments retain nudge-free monitoring", async () => {
    assert(validPolicy({ ...policy, confirmationVersion: 2, applicationCheckMode: "automatic" }));
    const f = await nudgeFixture("manual-review", snapshot([]), 2);
    try {
        f.commit(); f.set(snapshot([row()], ["22"]));
        await f.poll(); f.advance(60000); await f.poll(); assert.equal(f.focused, 0);
        assert.equal(f.coordinator.health.blockers.length, 0);
        assert.equal(f.coordinator.health.monitoring, undefined);
    } finally { await f.dispose(); }
});

test("scheduled activation baselines the actual activation inventory and rollback clears provisional state", async () => {
    const f = lifecycleFixture();
    try {
        f.observe(snapshot([]));
        await f.service.take(await f.draft({ ...manualDraft, start: "scheduled", scheduledAt: 1001000 }));
        assert.equal(f.strict.monitor, undefined);
        f.observe(snapshot([row()])); f.advance(2000); await f.service.refresh();
        assert(f.strict.monitor.baseline.has("c:\\apps\\code.exe"));
    } finally { await f.dispose(); }
    const rollback = lifecycleFixture();
    try {
        rollback.strict.host.openDock = async () => { throw Error("dock unavailable"); };
        const originalError = console.error; console.error = () => {};
        try { await rollback.service.take(await rollback.draft(manualDraft)); }
        finally { console.error = originalError; }
        assert.equal(rollback.strict.monitor, null);
        assert.equal(rollback.strict.current, null);
    } finally { await rollback.dispose(); }
});


test("final activation recheck replaces earlier inventory in the baseline", async () => {
    const f = await nudgeFixture();
    try {
        await f.dispose();
        f.coordinator.host.enter = async () => f.set(snapshot([row()]));
        f.set(snapshot([]));
        await f.coordinator.prepare({ id: "nudge", policy: { ...strictPolicy({ mode: "strict", ...manualDraft }), confirmationVersion: 3 } });
        assert(f.coordinator.monitor.baseline.has("c:\\apps\\code.exe"));
        f.commit(); await f.poll(); await f.poll(); assert.equal(f.focused, 0);
    } finally { await f.dispose(); }
});

test("release discards a pending observation and prevents late nudges", async () => {
    const f = await nudgeFixture(); let resolve;
    try {
        f.commit(); f.set(snapshot([row()])); await f.poll();
        f.coordinator.observer = { listWindows: () => new Promise(done => { resolve = done; }) };
        const pending = f.poll();
        await Promise.resolve();
        await f.dispose(); resolve(snapshot([row()])); await pending;
        assert.equal(f.focused, 0); assert.equal(f.coordinator.monitor, null);
        assert.equal(f.coordinator.health.status, "idle");
    } finally { await f.dispose(); }
});
