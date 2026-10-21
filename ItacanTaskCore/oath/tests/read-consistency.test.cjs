"use strict";
const test = require("node:test"), { assert, fixture, gate, settle } = require("./adapter-support.cjs");
test("subscribe before read, capture race and newest generation win", async t => {
 const b = await fixture(t), entered = gate(), release = gate(); let first = true;
 b.provider.settings.afterProof = async p => { if (first) { first = false; entered.resolve(); await release.promise; } return p; };
 const old = b.adapter.refresh(); await entered.promise; assert.equal(b.provider.readListeners.size, 1); assert.equal(b.provider.proofListeners.size, 1);
 await b.v.mutate("task.complete", { completed: true }); const current = await settle(b.adapter); assert.equal(current.rows[0].eligibility.state, "eligible"); release.resolve(); await old; assert.equal(b.adapter.getSnapshot().generation, current.generation); assert.equal(b.adapter.getSnapshot().rows[0].task.completed, true);
});
test("invalidations revoke cached qualification immediately and coalesce", async t => {
 const b = await fixture(t); await b.v.mutate("task.complete", { completed: true }); await b.adapter.refresh(); const before = b.provider.counts.proofs;
 for (let i=0;i<50;i++) b.provider.invalidate(); assert.equal(b.adapter.getSnapshot().rows[0].eligibility.state, "unknown"); await settle(b.adapter); assert(b.provider.counts.proofs - before < 8);
});
for (const fault of ["revision", "step", "owner", "stale-proof"]) test("three inconsistent captures then recovering: " + fault, async t => {
 const b = await fixture(t);
 if (fault === "stale-proof") b.provider.settings.freshness = "stale";
 else b.provider.settings.afterRead = r => { if (fault === "revision") r.rows[0].task.revision++; if (fault === "owner") r.rows[0].task.owner.id = "other"; if (fault === "step") r.rows[0].task.completed = true; return r; };
 const r = await b.adapter.refresh(); assert.equal(r.readiness.reason, "SNAPSHOT_UNSTABLE"); assert.equal(b.provider.counts.proofs, 3); assert.notEqual(r.rows[0].eligibility.state, "eligible");
});
for (const state of ["not-ready", "unavailable", "recovering", "unsupported"]) test("outage cannot preserve old qualified evidence: " + state, async t => {
 const b = await fixture(t); await b.v.mutate("task.complete", { completed: true }); assert.equal((await b.adapter.refresh()).rows[0].eligibility.state, "eligible");
 b.provider.settings.state = state; b.provider.invalidate(); assert.notEqual((await settle(b.adapter)).rows[0].eligibility.state, "eligible");
 b.provider.settings.state = "ready"; b.provider.invalidate(); assert.equal((await settle(b.adapter)).rows[0].eligibility.reason, "ENROLLMENT_ORDER_UNPROVEN");
});
test("provider reconnect epoch permanently loses volatile enrollment witness", async t => {
 const b = await fixture(t); await b.adapter.refresh(); await b.v.mutate("task.complete", { completed: true }); await settle(b.adapter);
 b.provider.settings.epoch++; b.provider.invalidate(); assert.equal((await settle(b.adapter)).rows[0].eligibility.reason, "ENROLLMENT_ORDER_UNPROVEN");
});
for (const during of ["proof", "read"]) test("disposal during " + during + " drops late result and callbacks", async t => {
 const b = await fixture(t), entered = gate(), release = gate(); const key = during === "proof" ? "beforeProof" : "beforeRead";
 b.provider.settings[key] = async () => { entered.resolve(); await release.promise; }; const pending = b.adapter.refresh(); await entered.promise;
 const callback = [...b.provider.proofListeners][0]; b.adapter.dispose(); b.adapter.dispose(); callback({ version: 1, kind: "proof-invalidated", providerEpoch: 999 }); release.resolve(); await pending;
 assert.equal(b.adapter.getSnapshot().readiness.reason, "DISPOSED"); assert.equal(b.adapter.getSnapshot().rows.length, 0); assert.equal(b.provider.counts.readStops, 1); assert.equal(b.provider.counts.proofStops, 1); await assert.rejects(b.adapter.refresh(), e => e.code === "ADAPTER_DISPOSED");
});
test("subscription failure cleans partially acquired listener", async t => {
 const b = await fixture(t); b.adapter.dispose(); b.options.evidence = { ...b.options.evidence, subscribeInvalidations() { throw Error("PRIVATE_SECRET"); } }; const { createOathAdapter } = require("../adapter"); const a = createOathAdapter(b.options); t.after(() => a.dispose()); assert.equal((await a.refresh()).readiness.reason, "SUBSCRIPTION_UNAVAILABLE"); assert.equal(b.provider.readListeners.size, 0); assert(!JSON.stringify(a.getSnapshot()).includes("PRIVATE_SECRET"));
});
test("observer failure does not alter authoritative snapshot", async t => { const b = await fixture(t); b.adapter.subscribe(() => { throw Error("SECRET"); }); await b.v.mutate("task.complete", { completed: true }); assert.equal((await b.adapter.refresh()).rows[0].eligibility.state, "eligible"); });
test("observer can request refresh without reentrant recursion", async t => { const b = await fixture(t); let once = true; b.adapter.subscribe(() => { if (once) { once = false; void b.adapter.refresh(); } }); assert.equal((await b.adapter.refresh()).readiness.state, "ready"); });
for (const stage of ["beforeRead", "afterRead", "beforeProof", "afterProof"]) test("provider exception is coded and private: " + stage, async t => { const b = await fixture(t); b.provider.settings[stage] = () => { throw Error("SECRET_PATH_AND_RECEIPT"); }; const r = await b.adapter.refresh(); assert.equal(r.readiness.state, "unavailable"); assert(!JSON.stringify(r).includes("SECRET_PATH_AND_RECEIPT")); });
test("invalidation synchronously during subscribe is captured before first read", async t => { const b = await fixture(t); b.adapter.dispose(); const original = b.options.evidence.subscribeInvalidations; b.options.evidence = { ...b.options.evidence, subscribeInvalidations(cb) { const stop = original(cb); cb({ version: 1, kind: "proof-invalidated", providerEpoch: 0 }); return stop; } }; const a = require("../adapter").createOathAdapter(b.options); t.after(() => a.dispose()); assert.equal((await a.refresh()).readiness.state, "ready"); });
