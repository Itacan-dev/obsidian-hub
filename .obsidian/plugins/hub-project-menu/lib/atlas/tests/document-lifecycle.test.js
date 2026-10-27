"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { fixture } = require("./helpers");
const { temporaryGrantUsable } = require("../obsidian/pending");
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function holdArrival(f) {
    const entered = deferred(), ack = deferred(), commit = f.repository.commit.bind(f.repository); let held = false;
    f.repository.commit = async request => {
        const receipt = await commit(request), last = request.next.snapshot.journeyState.journeys.at(-1);
        if (!held && last?.phase === "ENDED" && last.endReason === "REACHED") { held = true; entered.resolve(); await ack.promise; }
        return receipt;
    };
    return { entered: entered.promise, release: () => ack.resolve() };
}
test("document: native same-document updates wait for the exact arrival acknowledgement", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/original");
    const flight = c.flight, journey = structuredClone(f.snapshot().journeyState.journeys.at(-1)), held = holdArrival(f);
    const arrival = f.arrive(c); await held.entered;
    try {
        assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/responsive?width=420", loaderId: flight.loaderId }), true);
        assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/responsive?width=640", loaderId: flight.loaderId }), true);
        assert.equal(c.displayed, null); assert.equal(c.flight.url, "https://trusted.test/original"); assert.equal(f.effects.leases.length, 0);
    } finally { held.release(); }
    await arrival;
    assert.equal(c.phase, "DISPLAYED"); assert.equal(c.displayed.url, "https://trusted.test/responsive?width=640");
    assert.equal(c.displayed.loaderId, flight.loaderId); assert.equal(f.effects.releases.length, 1);
    assert.equal(f.snapshot().journeyState.journeys.at(-1).expiresAt, journey.expiresAt);
    assert.equal(f.snapshot().accessState.grants.length, 0);
});
test("document: loader mismatch, hostname change, missing flight and closed context cannot gain same-document binding", async t => {
    const f = await fixture(t), c = f.attach(); assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/", loaderId: "invented" }), false);
    await f.navigate(c, "https://trusted.test/start"); const flight = c.flight;
    assert.equal(f.runtime.sameDocument(c, { url: "https://blocked.test/", loaderId: flight.loaderId }), false);
    assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/other", loaderId: "other-loader" }), false);
    assert.equal(f.runtime.sameDocument(c, { url: "file:///private", loaderId: flight.loaderId }), false);
    assert.equal(flight.documentURL, undefined); await f.arrive(c);
    const original = c.displayed.url;
    assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/changed", loaderId: flight.loaderId }), true);
    assert.notEqual(c.displayed.url, original);
    await f.runtime.close(c); assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/revive", loaderId: flight.loaderId }), false);
    assert.equal(c.displayed, null);
});
test("document: buffered URLs cannot substitute for an uncorrelated full arrival", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/start"); const flight = c.flight;
    assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/changed", loaderId: flight.loaderId }), true);
    await f.runtime.arrive(c, { url: flight.url, loaderId: "unproven-loader" });
    assert.equal(c.phase, "BLOCKED"); assert.equal(c.response.reason, "UNCORRELATED_ARRIVAL"); assert.equal(c.displayed, null); assert.equal(f.effects.leases.length, 0);
});
test("document: old and pending same-host documents keep separate loader and URL identities", async t => {
    const f = await fixture(t), c = f.attach(); await f.navigate(c, "https://trusted.test/old"); await f.arrive(c);
    const old = c.displayed; await f.navigate(c, "https://trusted.test/new"); const flight = c.flight, held = holdArrival(f), arrival = f.arrive(c); await held.entered;
    try {
        assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/old#resize", loaderId: old.loaderId }), true);
        assert.equal(old.url, "https://trusted.test/old#resize");
        assert.equal(f.runtime.sameDocument(c, { url: "https://trusted.test/new#resize", loaderId: flight.loaderId }), true);
        assert.equal(c.displayed, old); assert.equal(old.url, "https://trusted.test/old#resize");
    } finally { held.release(); }
    await arrival; assert.equal(c.displayed.url, "https://trusted.test/new#resize"); assert.equal(c.displayed.loaderId, flight.loaderId);
    await f.navigate(c, "https://identity.test/login", { initiatorURL: "https://trusted.test/new#resize", initiatorIsMainFrame: true });
    assert.equal(c.response.decision.reason, "ACTIVE_JOURNEY");
});
test("document: responsive temporary pages keep their original expiry", async t => {
    const f = await fixture(t), denied = f.attach(); await f.navigate(denied, "https://grey.test/"); await f.command(denied, "START_ACCESS"); f.advance(10); await f.runtime.observe(); await f.command(denied, "CONFIRM_ACCESS_AND_OPEN");
    const grant = structuredClone(f.snapshot().accessState.grants[0]), c = f.attach(); await f.navigate(c, "https://grey.test/start"); await f.arrive(c);
    assert.equal(f.runtime.sameDocument(c, { url: "https://grey.test/resize", loaderId: c.displayed.loaderId }), true);
    f.setTime(grant.expiresAt); await f.runtime.observe(); assert.equal(c.phase, "BLOCKED"); assert.equal(c.displayed, null); assert.deepEqual(f.snapshot().accessState.grants[0], grant);
});
test("document: Whitelist decisions and cached expired ALLOW descriptions are not active temporary grants", () => {
    const grant = { hostname: "www.chatgpt.com", requestId: 1, expiresAt: 2000, policyRevision: 0 };
    const view = { status: "READY", enabled: true, snapshot: { policyRevision: 0 }, temporaryDestinations: [{ ...grant, decision: { outcome: "ALLOW", reason: "ACTIVE_GRANT" } }] };
    assert.equal(temporaryGrantUsable(view, grant, 1999), true); assert.equal(temporaryGrantUsable(view, grant, 2000), false);
    view.temporaryDestinations[0].decision.reason = "WHITELISTED"; assert.equal(temporaryGrantUsable(view, grant, 1999), false);
    view.temporaryDestinations[0].decision.reason = "ACTIVE_GRANT"; view.snapshot.policyRevision = 1; assert.equal(temporaryGrantUsable(view, grant, 1999), false);
    view.snapshot.policyRevision = 0; view.enabled = false; assert.equal(temporaryGrantUsable(view, grant, 1999), false);
});
