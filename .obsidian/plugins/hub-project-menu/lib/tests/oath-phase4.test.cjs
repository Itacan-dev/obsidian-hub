"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./oath.test");
const { StrictOathCoordinator } = require("../services/oath-strict");
const { HubOathService } = require("../services/oath");
const editor = "c:\\apps\\editor.exe";
function setup() {
    const f = fixture(); const launched = []; let dockDisposed = 0;
    const host = { identity: { pid: 1, handle: "1" }, enter: async () => {}, release: async () => { dockDisposed++; }, focus() {},
        launch: async exe => launched.push(exe), openDock: async () => {} };
    const strict = new StrictOathCoordinator({ host, observer: { listWindows: async () => [] }, verifyExecutable: async value => value, now: f.service.now });
    f.service.strict = strict;
    return { ...f, strict, host, launched, get saved() { return f.saved; }, get dockDisposed() { return dockDisposed; }, async take(extra = {}) {
        const draft = f.draft({ mode: "strict", durationMs: 60000, ...extra });
        const review = await f.service.reviewStrict(draft); await f.service.take({ ...draft, strictConfirmation: review.confirmation });
    }, async cleanup() { await strict.release(f.service.current?.id); f.destroy(); } };
}
test("device opt-in persists, survives reload, and failed save does not enable", async () => {
    const f = setup(); assert.equal(f.service.strictEnabled, false); f.fail(true);
    await assert.rejects(f.service.setStrictEnabled(true), /Disk/); assert.equal(f.strict.enabled, false);
    f.fail(false); await f.service.setStrictEnabled(true); assert.equal(f.saved.oathsByDevice["this-device"].strictEnabled, true);
    f.strict.enabled = false;
    const reloaded = new HubOathService(f.plugin, f.full, { strict: f.strict });
    assert.equal(reloaded.strictEnabled, true); assert.equal(f.strict.enabled, true); reloaded.destroy(); await f.cleanup();
});
test("disabling future Strict setup preserves active and scheduled commitments", async () => {
    for (const scheduled of [false, true]) {
        const f = setup(); await f.service.setStrictEnabled(true); await f.take(scheduled ? { start: "scheduled", scheduledAt: 1_100_000 } : {});
        await f.service.setStrictEnabled(false); assert.equal(f.service.strictEnabled, false); assert.equal(f.strict.enabled, true);
        await assert.rejects(f.service.reviewStrict(f.draft({ mode: "strict" })), /disabled/);
        if (scheduled) { f.advance(105000); await f.service.refresh(); assert(f.service.active); }
        else assert.equal(await f.service.end(f.service.current.id, "broken"), "strict-unfulfilled");
        f.advance(60000); await f.service.refresh(); await f.service.end(f.service.current.id); assert.equal(f.strict.enabled, false);
        await f.cleanup();
    }
});
test("launch requires an active frozen verified executable and rechecks after asynchronous verification", async () => {
    const f = setup(); await f.service.setStrictEnabled(true); await f.service.setStrictApplications([editor]);
    await assert.rejects(f.service.launchStrictApplication(editor), /active/); await f.take();
    await f.service.setStrictApplications([]); await f.service.launchStrictApplication(editor); assert.deepEqual(f.launched, [editor]);
    await assert.rejects(f.service.launchStrictApplication("c:\\apps\\other.exe"), /not permitted/);
    f.strict.verifyExecutable = async () => "c:\\apps\\replacement.exe";
    await assert.rejects(f.service.launchStrictApplication(editor), /permission changed/);
    f.strict.verifyExecutable = async value => { await f.strict.release(f.service.current.id); return value; };
    await assert.rejects(f.service.launchStrictApplication(editor), /permission changed/); assert.equal(f.launched.length, 1); await f.cleanup();
});
test("dock preparation failure rolls back host and leaves the Oath retryable", async () => {
    const f = setup(); await f.service.setStrictEnabled(true);
    f.host.openDock = async () => { throw Error("Dock failed"); }; await f.take();
    assert.equal(f.service.current.state, "scheduled"); assert.equal(f.strict.current, null); assert(f.dockDisposed > 0); await f.cleanup();
});
test("release during asynchronous dock preparation cannot commit a restored host", async () => {
    const f = setup(); await f.service.setStrictEnabled(true);
    f.host.openDock = async () => f.strict.release(f.service.current.id);
    await f.take(); assert.equal(f.service.current.state, "scheduled"); assert.equal(f.strict.current, null);
    assert.equal(f.service.current.startedAt, null); await f.cleanup();
});
test("implicit dock allowance matches only the participating process and dock handle", () => {
    const { classifyWindows } = require("../domain/oath-strict");
    const policy = { mode: "strict", confirmationVersion: 1, applications: [] };
    const rows = [{ pid: 1, handle: "2", executable: editor }, { pid: 1, handle: "3", executable: editor }, { pid: 2, handle: "2", executable: editor }];
    const result = classifyWindows(rows, policy, { pid: 1, handle: "1", dockHandle: "2" });
    assert.deepEqual(result.blockers.map(item => [item.pid, item.handle]), [[1, "3"], [2, "2"]]);
});
test("editing the draft during asynchronous application checks cannot issue a mismatched confirmation", async () => {
    const f = setup(); await f.service.setStrictEnabled(true);
    let complete, started; const observing = new Promise(resolve => { started = resolve; });
    f.strict.observer.listWindows = () => new Promise(resolve => { complete = resolve; started(); });
    const draft = f.draft({ mode: "strict" }), pending = f.service.reviewStrict(draft);
    await observing; draft.applications = []; complete([]);
    await assert.rejects(pending, /changed while checking/); assert.equal(f.service.strictReviews.size, 0); await f.cleanup();
});
test("permitted Firefox website shortcuts preserve URLs without exposing arbitrary process arguments", async () => {
    const f = setup(), firefox = "c:\\apps\\firefox.exe", calls = [];
    f.host.launch = async (exe, args) => calls.push({ exe, args });
    await f.service.setStrictEnabled(true); await f.service.setStrictApplications([firefox, editor]); await f.take();
    await f.service.launchStrictApplication(firefox, "https://www.overleaf.com/project");
    assert.deepEqual(calls, [{ exe: firefox, args: ["-new-tab", "https://www.overleaf.com/project"] }]);
    await assert.rejects(f.service.launchStrictApplication(editor, "https://example.com/"), /Firefox/);
    await assert.rejects(f.service.launchStrictApplication(firefox, "file:///private.txt"), /HTTP/);
    await assert.rejects(f.service.launchStrictApplication(firefox, "javascript:alert(1)"), /HTTP/);
    await assert.rejects(f.service.launchStrictApplication("c:\\other\\firefox.exe", "https://example.com/"), /not permitted/);
    assert.equal(calls.length, 1); await f.cleanup();
});
