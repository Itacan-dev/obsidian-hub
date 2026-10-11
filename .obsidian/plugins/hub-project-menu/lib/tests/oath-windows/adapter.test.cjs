"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), { EventEmitter } = require("node:events");
const { Inventory } = require("./identity.cjs"), { Supervisor } = require("./supervisor.cjs");
const raw = (id, pid = 10, exe = "C:\\Apps\\Editor.exe", title = "same") => ({ id, owner: { processId: pid, path: exe }, title });
test("identity uses verified executable plus PID/HWND, never title", () => {
    const inventory = new Inventory(value => value), values = inventory.update([raw(1), raw(2)]);
    assert.notEqual(values[0].token, values[1].token);
    const changed = inventory.update([raw(1, 10, "c:\\apps\\editor.exe", "renamed")]);
    assert.equal(changed[0].token, values[0].token); assert.equal(inventory.resolve(changed[0].token).pid, 10);
});
test("unknown path failures remain visible and cannot resolve", () => {
    const inventory = new Inventory(() => { throw Error("access denied"); });
    const [unknown] = inventory.update([raw(1)]); assert.equal(unknown.identity, "unknown");
    assert.throws(() => inventory.resolve(unknown.token), /unknown/);
});
test("null enumeration fails closed and invalidates cached tokens", () => {
    const inventory = new Inventory(value => value), [old] = inventory.update([raw(1)]);
    assert.throws(() => inventory.update(null), /unavailable/); assert.throws(() => inventory.resolve(old.token), /Stale/);
});
test("disappearance, changed PID and changed executable invalidate old tokens", () => {
    for (const next of [[], [raw(1, 11)], [raw(1, 10, "C:\\Other.exe")]]) {
        const inventory = new Inventory(value => value), [old] = inventory.update([raw(1)]);
        inventory.update(next); assert.throws(() => inventory.resolve(old.token), /Stale/);
    }
});
test("observed handle reuse generates new token; empty title allowed", () => {
    const inventory = new Inventory(value => value), [old] = inventory.update([raw(1)]);
    inventory.update([]); const [next] = inventory.update([raw(1, 10, "C:\\Apps\\Editor.exe", "")]);
    assert.notEqual(old.token, next.token); assert.equal(next.identity, "observed");
});
function fake() {
    const children = []; return { children, fork() { const child = new EventEmitter(); child.postMessage = value => { child.sent = value; }; child.kill = () => { child.killed = true; }; children.push(child); return child; } };
}
test("supervisor rejects overlap, kills stalled helper and ignores old replies", async () => {
    const factory = fake(), s = new Supervisor(factory, 20); s.start();
    const first = s.request("sample"); await assert.rejects(s.request("sample"), /in flight/);
    await assert.rejects(first, /timed out/); assert(factory.children[0].killed);
    s.start(); const next = s.request("capabilities");
    factory.children[0].emit("message", { id: factory.children[1].sent.id, result: "stale" });
    factory.children[1].emit("message", { id: factory.children[1].sent.id, result: "fresh" });
    assert.equal(await next, "fresh"); s.stop(); assert.throws(() => s.start(), /stopped/);
});
test("helper exit rejects pending work and does not auto-restart endlessly", async () => {
    const factory = fake(), s = new Supervisor(factory); s.start(); const pending = s.request("sample");
    factory.children[0].emit("exit", 17); await assert.rejects(pending, /exited/);
    assert.equal(factory.children.length, 1); await assert.rejects(s.request("sample"), /unavailable/); s.stop();
});
test("pinned public provider explicitly lacks minimize and restore", () => {
    const fs = require("node:fs"), path = require("node:path");
    const file = path.join(__dirname, "node_modules/phase2-upstream/nut-providers-libnut-lib-libnut-window.class.ts");
    const source = fs.readFileSync(file, "utf8");
    for (const method of ["minimizeWindow", "restoreWindow"]) assert.match(source, new RegExp(method + "\\([^]*?throw new Error\\(\"Method not implemented in libnut\\.\"\\)"));
});
