"use strict";
const test = require("node:test"), { assert, H, fixture, actualHost, pure, settle } = require("./adapter-support.cjs");
for (const mode of ["standard", "strict"]) test("actual " + mode + " service latches once, then repeated end is inactive", async t => {
 const v = await H.nativeFixture(t), b = await actualHost(t, v, mode); await b.refresh(); assert.equal(b.progress().completed, 0);
 await v.mutate("task.complete", { completed: true, completedAt: null }, "genuine"); await b.refresh(); assert.equal(b.progress().completed, 1); await b.f.oath.markFulfilled(); const at = b.f.oath.current.fulfilledAt; assert(at !== null);
 for (let i=0;i<5;i++) { b.provider.invalidate(); await b.refresh(); await b.f.oath.markFulfilled(); } assert.equal(b.f.oath.bucket.history.length, 0);
 await v.mutate("task.complete", { completed: false }, "reopen"); await b.refresh(); assert.equal(b.progress().completed, 0); assert.equal(b.f.oath.current.fulfilledAt, at);
 assert.equal(await b.f.oath.end(b.f.oath.current.id, "broken"), "ended"); assert.equal(await b.f.oath.end("committed-oath", "broken"), "inactive"); assert.equal(b.f.oath.bucket.history.length, 1); assert.equal(b.f.oath.bucket.history[0].state, "fulfilled");
});
test("actual helper display can be complete while task fulfillment remains unproven", async t => {
 const b = await fixture(t, { unproven: true }); await b.v.mutate("task.complete", { completed: true }); const r = await b.adapter.refresh(); const oath = { state: "active", startedAt: 1000, durationMs: 60000, tasks: [b.v.target.original], fulfilledAt: null };
 const display = r.rows.map(row => ({ task: row.task })), qualified = r.rows.map(row => ({ task: { ...row.task, completed: row.eligibility.state === "eligible" } }));
 assert.equal(pure.oathProgress(display).allComplete, true); assert.equal(pure.fulfilmentTime(oath, qualified, 2000), null); assert.equal(pure.fulfilmentTime(oath, qualified, 61000), 61000);
});
test("scheduled completion qualifies only after actual activation; reopen before activation removes work", async t => {
 const v = await H.nativeFixture(t), b = await actualHost(t, v, "standard", "scheduled"); await v.mutate("task.complete", { completed: true }, "scheduled-work"); await b.refresh(); await b.f.oath.markFulfilled(); assert.equal(b.f.oath.current.fulfilledAt, null);
 await v.mutate("task.complete", { completed: false }, "scheduled-open"); await b.refresh(); b.f.oath.now = () => b.f.oath.current.scheduledAt; await b.f.oath.activate(); await b.f.oath.markFulfilled(); assert.equal(b.f.oath.current.fulfilledAt, null);
 await v.mutate("task.complete", { completed: true }, "active-work"); await b.refresh(); await b.f.oath.markFulfilled(); assert(b.f.oath.current.fulfilledAt !== null);
});
test("valid scheduled completion is recognized on activation", async t => { const v = await H.nativeFixture(t), b = await actualHost(t, v, "standard", "scheduled"); await v.mutate("task.complete", { completed: true }); await b.refresh(); b.f.oath.now = () => b.f.now + 60000; await b.f.oath.activate(); await b.f.oath.markFulfilled(); assert(b.f.oath.fulfilled); });
test("actual scheduled cancel and active break preserve separate outcome rules", async t => {
 const v = await H.nativeFixture(t), b = await actualHost(t, v, "standard", "scheduled"); await b.refresh(); assert.equal(await b.f.oath.end(b.f.oath.current.id, "cancel"), "cancelled"); assert.equal(b.f.oath.bucket.history.length, 0);
 const other = await H.nativeFixture(t), a = await actualHost(t, other); await a.refresh(); assert.equal(await a.f.oath.end(a.f.oath.current.id, "fulfilled"), "confirmation-required"); assert.equal(await a.f.oath.end(a.f.oath.current.id, "broken"), "ended"); assert.equal(a.f.oath.bucket.history[0].state, "broken");
});
test("actual failed fulfillment save retains in-process latch after reopening", async t => {
 const v = await H.nativeFixture(t), b = await actualHost(t, v); await v.mutate("task.complete", { completed: true }); await b.refresh(); b.f.failPersist(true); await assert.rejects(b.f.oath.markFulfilled()); assert(b.f.oath.pendingFulfilment);
 await v.mutate("task.complete", { completed: false }, "open"); await b.refresh(); assert.equal(b.progress().completed, 0); assert.equal(b.f.oath.fulfilled, true); b.f.failPersist(false); await b.f.oath.markFulfilled(); assert(b.f.oath.current.fulfilledAt !== null);
});
test("unavailable evidence does not disable actual deadline fulfillment", async t => { const v = await H.nativeFixture(t), b = await actualHost(t, v); b.provider.settings.recovery = "unknown"; await b.refresh(); const deadline = b.f.oath.current.startedAt + b.f.oath.current.durationMs; b.f.oath.now = () => deadline; await b.f.oath.markFulfilled(); assert.equal(b.f.oath.current.fulfilledAt, deadline); });
test("service reconstruction exposes unsaved latch loss without repairing it", async t => {
 const v = await H.nativeFixture(t), b = await actualHost(t, v); await v.mutate("task.complete", { completed: true }); await b.refresh(); b.f.failPersist(true); await assert.rejects(b.f.oath.markFulfilled()); await v.mutate("task.complete", { completed: false }, "open");
 const Constructor = b.f.oath.constructor; b.f.oath.destroy(); b.f.oath = new Constructor(b.f.plugin, { restore() {}, exit: async () => {}, destroy() {} }, { now: () => b.f.now, notice() {} }); assert.equal(b.f.oath.pendingFulfilment, undefined); assert.equal(b.f.oath.fulfilled, false);
});
test("Strict missing host uses actual interruption writer, never prepares enforcement", async t => { const v = await H.nativeFixture(t), b = await actualHost(t, v, "strict"); let prepared=0; b.f.oath.strict.owns=()=>false; b.f.oath.strict.prepare=()=>{prepared++;throw Error("Forbidden");}; await b.f.oath.recoverStrict(); assert.equal(prepared,0); assert.equal(b.f.oath.current.state,"interrupted"); assert.equal(b.f.oath.bucket.history.length,1); });
