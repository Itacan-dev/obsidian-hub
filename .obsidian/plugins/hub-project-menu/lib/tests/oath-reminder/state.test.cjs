"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const { ReminderState } = require("./state.cjs");
function feed(state, start, end, kind = "non-permitted", label = "App") {
    let value;
    for (let time = start; time <= end; time += 250) value = state.sample(kind, time, label);
    return value;
}
test("three seconds required, including switches between non-permitted applications", () => {
    const s = new ReminderState();
    assert.equal(feed(s, 0, 1500).visible, false);
    assert.equal(feed(s, 1750, 2750, "non-permitted", "Other").visible, false);
    assert.equal(s.sample("non-permitted", 3000, "Other").visible, true);
    assert.equal(s.lastExternal, "Other");
});
test("permitted work hides immediately and a later episode starts from zero", () => {
    const s = new ReminderState(); feed(s, 0, 3000);
    assert.equal(s.sample("permitted", 3250).visible, false);
    assert.equal(feed(s, 3500, 6250).visible, false);
    assert.equal(s.sample("non-permitted", 6500).visible, true);
});
test("reminder self-focus retains visibility and neutralizes the application label", () => {
    const s = new ReminderState(); feed(s, 0, 3000);
    assert.equal(s.sample("self", 3250).visible, true);
    assert.equal(s.sample("self", 3500).label, "");
    assert.equal(s.sample("non-permitted", 3750, "Other").visible, true);
});
test("unknown interrupts pending persistence and visible grace is bounded", () => {
    const s = new ReminderState(); feed(s, 0, 2750);
    s.sample("unknown", 3000); assert.equal(feed(s, 3250, 6000).visible, false);
    assert.equal(s.sample("non-permitted", 6250).visible, true);
    assert.equal(s.sample("unknown", 6500).visible, true);
    assert.equal(s.sample("unknown", 6750).visible, true);
    assert.equal(s.sample("unknown", 7000).visible, false);
});
test("stale observations reset visibility, recovery reset clears all state", () => {
    const s = new ReminderState(); feed(s, 0, 3000);
    assert.equal(s.sample("non-permitted", 3600).visible, false);
    assert.equal(s.since, 3600); s.reset(); assert.equal(s.lastSample, null);
    assert.equal(s.lastExternal, null); assert.equal(s.state, "hidden");
});
test("unknown cannot manufacture a permitted identity or a completed timer", () => {
    const s = new ReminderState();
    assert.equal(feed(s, 0, 5000, "unknown").visible, false);
    assert.equal(s.sample("non-permitted", 5250).visible, false);
    assert.throws(() => s.sample("invalid", 5500), /Invalid/);
});
