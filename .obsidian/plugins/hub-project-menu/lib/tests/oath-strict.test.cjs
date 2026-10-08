"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./oath.test");
const { HubOathService } = require("../services/oath");
const { StrictOathCoordinator } = require("../services/oath-strict");
const { classifyWindows, applications } = require("../domain/oath-strict");
const editor = "c:\\apps\\editor.exe", other = "c:\\apps\\other.exe";
function strictFixture() {
    const f = fixture(); let rows = [], enters = 0, releases = 0, focused = 0, failObservation = false;
    const host = { identity: { pid: 100, handle: "1" }, enter: async () => { enters++; }, release: async () => { releases++; }, focus: () => focused++ };
    const observer = { listWindows: async () => { if (failObservation) throw Error("Unavailable"); return rows; } };
    const strict = new StrictOathCoordinator({ enabled: true, host, observer, now: f.service.now, verifyExecutable: async value => value });
    f.service.strict = strict; strict.onHealth(value => { f.service.strictStatus = value; });
    const draft = extra => f.draft({ mode: "strict", ...extra });
    async function confirmed(extra) { const d = draft(extra), review = await f.service.reviewStrict(d); return { ...d, strictConfirmation: review.confirmation }; }
    return { ...f, strict, observer, confirmed, setRows: value => rows = value, failObservation: value => failObservation = value,
        get saved() { return f.saved; },
        get enters() { return enters; }, get releases() { return releases; }, get focused() { return focused; },
        async cleanup() { await strict.release(f.service.current?.id); f.destroy(); } };
}
const blocker = { pid: 20, handle: "22", executable: other, title: "Unsaved document" };
test("Strict remains disabled by default and confirmation is mandatory", async () => {
    const f = fixture(); await assert.rejects(f.service.reviewStrict(f.draft({ mode: "strict" })), /disabled/);
    await assert.rejects(f.service.take(f.draft({ mode: "strict" })), /confirm/); assert.equal(f.service.current, null); f.destroy();
    const s = strictFixture(); await assert.rejects(s.service.take(s.draft({ mode: "strict" })), /confirm/); await s.cleanup();
});
test("persistent defaults, per-Oath replacement and frozen confirmed snapshots", async () => {
    const f = strictFixture(); await f.service.setStrictApplications(["C:\\Apps\\Editor.exe", editor]);
    assert.deepEqual(f.saved.oathsByDevice["this-device"].strictApplications, [editor]);
    const draft = await f.confirmed({ start: "scheduled", scheduledAt: 1_100_000 });
    await f.service.setStrictApplications([other]); await f.service.take(draft);
    assert.deepEqual(f.service.current.policy.applications, [editor]);
    assert.deepEqual(f.service.strictApplications, [other]);
    await f.service.end(f.service.current.id, "cancel");
    const override = await f.confirmed({ applications: [] }); await f.service.take(override);
    assert.deepEqual(f.service.current.policy.applications, []);
    assert.deepEqual(f.service.strictApplications, [other]); await f.cleanup();
});
test("modified review requires confirmation again; expired reviews cannot activate", async () => {
    const f = strictFixture(); const d = await f.confirmed();
    await assert.rejects(f.service.take({ ...d, durationMs: 60000 }), /confirm/);
    f.advance(16 * 60000); await assert.rejects(f.service.take(d), /confirm/); assert.equal(f.enters, 0); await f.cleanup();
});
test("known blockers prevent immediate commitment without touching documents", async () => {
    const f = strictFixture(); f.setRows([blocker]); const before = [...f.files];
    await assert.rejects(f.service.take(await f.confirmed()), /Close/);
    assert.deepEqual([...f.files], before); assert.equal(f.service.current, null); assert.equal(f.enters, 0); await f.cleanup();
});
test("due blocked schedules stay cancellable; actual activation starts the timer", async () => {
    const f = strictFixture(); await f.service.take(await f.confirmed({ start: "scheduled", scheduledAt: 1_100_000 }));
    f.setRows([blocker]); f.advance(200000); await f.service.refresh();
    assert.equal(f.service.current.state, "scheduled"); assert.equal(f.service.current.startedAt, null);
    assert.equal(await f.service.end(f.service.current.id, "cancel"), "cancelled");
    await f.service.take(await f.confirmed({ start: "scheduled", scheduledAt: 1_300_000 }));
    f.advance(200000); await f.service.refresh(); f.setRows([]); f.advance(5000); await f.service.refresh();
    assert.equal(f.service.current.startedAt, f.service.now()); assert.equal(f.service.active, true); await f.cleanup();
});
test("activation recheck catches a new blocker and rolls back preparation", async () => {
    const f = strictFixture(); const d = await f.confirmed(); let calls = 0;
    f.observer.listWindows = async () => ++calls >= 3 ? [blocker] : [];
    await f.service.take(d); assert.equal(f.service.current.state, "scheduled"); assert.equal(f.service.current.startedAt, null);
    assert.equal(f.enters, 1); assert.equal(f.releases, 1); await f.cleanup();
});
test("activation save failure restores host and leaves a retryable schedule", async () => {
    const f = strictFixture(), save = f.plugin.dataStore.save;
    f.plugin.dataStore.save = async data => { if (data.oathsByDevice["this-device"].current?.state === "active") throw Error("activation disk failure"); return save(data); };
    await f.service.take(await f.confirmed()); assert.equal(f.service.current.state, "scheduled"); assert.equal(f.releases, 1);
    f.plugin.dataStore.save = save; f.advance(5000); await f.service.refresh(); assert.equal(f.service.active, true); await f.cleanup();
});
test("Strict service refuses early break, retains fulfillment and saves history before release", async () => {
    const f = strictFixture(); await f.service.take(await f.confirmed({ durationMs: 60000 }));
    assert.equal(await f.service.end(f.service.current.id, "broken"), "strict-unfulfilled"); assert.equal(f.releases, 0);
    f.advance(60000); await f.service.refresh(); assert(f.service.fulfilled); assert(f.service.active);
    f.fail(true); await assert.rejects(f.service.end(f.service.current.id), /Disk/); assert.equal(f.releases, 0);
    f.fail(false); await f.service.end(f.service.current.id); await f.service.end(f.service.current.id);
    assert.equal(f.service.bucket.history.length, 1); assert.equal(f.releases, 1); assert.equal(f.service.current.state, "fulfilled"); await f.cleanup();
});
test("missing workspace does not end Strict; time still fulfills", async () => {
    const f = strictFixture(); await f.service.take(await f.confirmed({ durationMs: 60000 }));
    f.files.delete(f.contexts[0].path); await f.service.invalidateWorkspace(); assert(f.service.active); assert.equal(f.releases, 0);
    f.advance(60000); await f.service.refresh(); assert(f.service.fulfilled); await f.cleanup();
});
test("same-process reattachment retains guards; lost session records interruption once", async () => {
    const f = strictFixture(); await f.service.take(await f.confirmed()); f.service.destroy();
    const reload = new HubOathService(f.plugin, f.full, { strict: f.strict, now: f.service.now, notice() {} });
    await reload.start(); assert(reload.active); assert.equal(f.enters, 1); reload.destroy();
    await f.strict.release(f.service.current.id);
    const restarted = new HubOathService(f.plugin, f.full, { now: f.service.now, notice() {} });
    await restarted.start(); assert.equal(restarted.current.state, "interrupted"); assert.equal(restarted.bucket.history.length, 1);
    await restarted.refresh(); assert.equal(restarted.bucket.history.length, 1); assert.equal(f.full.entries, 0); restarted.destroy(); await f.cleanup();
});
test("unknown identities warn; host matching is exact; titles do not grant allowance", () => {
    const result = classifyWindows([{ pid: 100, handle: "1" }, { pid: 100, handle: "2", executable: other },
        { pid: 33, handle: "3", title: editor }, { pid: 44, handle: "4", executable: editor }], { applications: [editor] }, { pid: 100, handle: "1" });
    assert.equal(result.blockers.length, 1); assert.equal(result.unknown.length, 1);
    assert.throws(() => applications(["editor.exe"]), /absolute/);
});
test("observer failure keeps active commitment; new blockers trigger bounded nudges only", async () => {
    const f = strictFixture(); await f.service.take(await f.confirmed());
    f.setRows([blocker]); await f.strict.poll(); await f.strict.poll(); assert.equal(f.focused, 1); assert(f.service.active);
    f.failObservation(true); await f.strict.poll(); assert.equal(f.strict.health.status, "degraded"); assert(f.service.active); assert.equal(f.releases, 0);
    f.failObservation(false); f.setRows([]); await f.strict.poll(); assert.equal(f.strict.health.status, "best-effort"); await f.cleanup();
});
test("whitelist save failure restores previous defaults without changing other device data", async () => {
    const f = strictFixture(); f.plugin.projectWizard.data.oathsByDevice = { other: { strictApplications: [other], history: [] } };
    await f.service.setStrictApplications([editor]); f.fail(true);
    await assert.rejects(f.service.setStrictApplications([other]), /Disk/);
    assert.deepEqual(f.service.strictApplications, [editor]); assert.deepEqual(f.plugin.projectWizard.data.oathsByDevice.other.strictApplications, [other]); f.fail(false); await f.cleanup();
});
test("selected task completion fulfills Strict and caller mutation cannot alter its snapshot", async () => {
    const f = strictFixture(); await f.service.setStrictApplications([editor]); await f.service.take(await f.confirmed());
    f.service.current.policy.applications.push(other); assert.deepEqual(f.service.current.policy.applications, [editor]);
    f.complete(0); f.complete(1); await f.service.refresh(); assert(f.service.fulfilled); assert(f.service.active);
    await f.service.end(f.service.current.id); assert.equal(f.service.bucket.history[0].state, "fulfilled"); await f.cleanup();
});
test("null observation blocks activation instead of treating the desktop as clear", async () => {
    const f = strictFixture(); f.setRows(null); await assert.rejects(f.service.take(await f.confirmed()), /observation/);
    assert.equal(f.enters, 0); assert.equal(f.service.current, null); await f.cleanup();
});
test("interruption save failure retries without lockdown or duplicate history", async () => {
    const f = strictFixture(); await f.service.take(await f.confirmed()); await f.strict.release(f.service.current.id);
    f.fail(true); await f.service.refresh(); assert.equal(f.service.current.state, "active"); assert.equal(f.service.bucket.history.length, 0);
    f.fail(false); f.advance(120000); await f.service.refresh(); assert.equal(f.service.current.state, "interrupted");
    assert.equal(f.service.current.elapsedMs, 0); assert.equal(f.service.current.interruptionTimeUnknown, true);
    assert.equal(f.service.current.interruptionDetectedAt, f.service.now()); await f.service.refresh(); assert.equal(f.service.bucket.history.length, 1); await f.cleanup();
});
test("fresh distribution bundles exclude Strict development infrastructure", () => {
    const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { execFileSync } = require("node:child_process");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "itacan-strict-build-audit-"));
    try {
        execFileSync(process.execPath, [path.resolve(__dirname, "../../build.js"), "--output-dir", root],
            { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, timeout: 30000 });
        const manifest = JSON.parse(fs.readFileSync(path.join(root, "strict-oath-assets.json")));
        assert.equal(manifest.schemaVersion, 1); assert.equal(Object.keys(manifest.files).length, 9);
        assert(manifest.files["lib/ui/oath-dock/preload.cjs"]); assert(manifest.files["lib/ui/oath-dock/index.html"]);
        for (const [name, hash] of Object.entries(manifest.files)) {
            assert.equal(require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(root, name))).digest("hex"), hash);
            assert(!name.includes("tests/"));
        }
        for (const name of ["main.js", "atlas-native.cjs", ...Object.keys(manifest.files)]) assert.doesNotMatch(fs.readFileSync(path.join(root, name), "utf8"),
            /oath-lifecycle|development-escape|ITACAN_OATH_FIXTURE|phase2-upstream|oath-preview:|two-minute-watchdog/);
        assert(!fs.existsSync(path.join(root, "lib/tests")));
    } finally {
        const resolved = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
        assert.equal(path.dirname(resolved).toLowerCase(), temp.toLowerCase());
        assert(path.basename(resolved).startsWith("itacan-strict-build-audit-")); fs.rmSync(resolved, { recursive: true, force: true });
    }
});
