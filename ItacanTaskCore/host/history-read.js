"use strict";
const V = require("../src/value"), { freeze } = require("../src/snapshot-read"), { check } = require("../src/errors");
function createHistoryReadPort(host, { authorityId, owners }) {
    V.uuid(authorityId); owners = freeze(V.clone(owners)); let closed = false; const stops = new Set();
    return Object.freeze({
        async read(signal) {
            check(!closed, "History port closed.");
            const r = await host.readHistory({ version: 4, authorityId, owners, selection: "history" }, signal);
            check(!closed && r.status === "ok" && r.snapshot.readiness.state === "ready" && r.snapshot.recovery.state === "intact" && V.canonical(r.stamp.head) === V.canonical(r.snapshot.head), "History authority unavailable.");
            return freeze({ version: 1, authorityId, stamp: r.stamp, history: r.snapshot.history });
        },
        subscribe(listener) { check(!closed, "History port closed."); const stop = host.subscribe(change => { if (!closed) listener({ reason: change.reason, code: host.info().readiness.reason }); }); stops.add(stop); return () => { stops.delete(stop); stop(); }; },
        dispose() { if (closed) return; closed = true; stops.forEach(stop => stop()); stops.clear(); }
    });
}
module.exports = { createHistoryReadPort };
