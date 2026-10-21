"use strict";
// Read-only accounting: observations identify content, never a cross-store lease.
const V = require("../src/value"), I = require("../src/history-import"), { check } = require("../src/errors"), { freeze } = require("../src/snapshot-read");
const lib = "../../.obsidian/plugins/hub-project-menu/lib/";
const { recordedHistoryQuery } = require(lib + "services/task-history-legacy-read"), { queryHistory } = require(lib + "domain/history");
const { historyRecords } = require(lib + "services/task-history-read"), { statisticsCompletions } = require(lib + "services/statistics");
const same = (a, b) => V.canonical(a) === V.canonical(b);
function unavailable(code = "HISTORY_UNAVAILABLE") { const e = Error("Completion evidence is unavailable."); e.code = code; return e; }
function nativeReference(native, e) { return { authorityId: native.authorityId, eventId: e.eventId, taskId: e.taskId, stepId: e.stepId, owner: V.clone(e.ownerAtEvent), origin: e.origin, navigation: V.clone(e.navigation) }; }
function account(raw, native) {
    V.jsonValue(raw); check(Array.isArray(raw) && native?.version === 1, "Complete observations required.");
    const h = native.history, byDigest = new Map(), suppressed = new Set(), representedRows = new Map();
    raw.forEach((row, i) => { const d = I.hash(row); if (!byDigest.has(d)) byDigest.set(d, []); byDigest.get(d).push(i); });
    const eventMap = new Map();
    for (const e of h.events) { check(!eventMap.has(e.eventId) && e.receipt.repositoryRevision <= native.stamp.head.repositoryRevision, "Duplicate/uncommitted event."); eventMap.set(e.eventId, e); }
    if (h.overlap) {
        const expected = new Map(), keys = new Set();
        for (const r of h.overlap.rows) { check(!keys.has(r.key), "Duplicate capture row."); keys.add(r.key); expected.set(r.digest, (expected.get(r.digest) ?? 0) + 1); }
        for (const [digest, count] of expected) check(byDigest.get(digest)?.length === count, "Import overlap changed or absent.");
        for (const r of h.overlap.rows) {
            const i = byDigest.get(r.digest)[r.occurrence]; check(i !== undefined, "Import occurrence missing.");
            if (r.suppressed) suppressed.add(i);
            if (r.eventId) { const e = eventMap.get(r.eventId); check(e?.origin === "represented-import", "Import representation missing."); representedRows.set(i, e); }
        }
        check(h.overlap.representedEventIds.every(id => eventMap.get(id)?.origin === "represented-import"), "Represented import is unverified.");
    }
    const live = h.events.filter(e => e.origin !== "represented-import" && e.counted).sort((a, b) => b.receipt.repositoryRevision - a.receipt.repositoryRevision || b.receipt.index - a.receipt.index);
    for (const e of live) check(!raw.some(row => row && typeof row === "object" && row.id === e.eventId), "Native/legacy event identity collision.");
    const legacy = [], references = [];
    raw.forEach((r, i) => { if (suppressed.has(i) || !r) return; legacy.push({ ...r }); references.push(representedRows.get(i) ?? null); });
    const query = recordedHistoryQuery(queryHistory(legacy));
    const completions = statisticsCompletions(query), records = historyRecords(query);
    // Join only exact detached recorded values, with an occurrence counter. IDs alone are insufficient.
    const queues = new Map(); query.rows.forEach((r, i) => { if (r.fact) { const d = I.hash(r.fact.recorded); if (!queues.has(d)) queues.set(d, []); queues.get(d).push(references[i]); } });
    for (const record of records) { const { historyReadKey, ...body } = record, ref = queues.get(I.hash(body)).shift(); if (ref) record.nativeHistory = nativeReference(native, ref); }
    const fresh = live.map(e => ({ id: e.eventId, kind: e.kind, text: e.title, ...(e.kind === "step" ? { parentText: e.parentTitle } : {}), timestamp: e.timestamp,
        projectId: e.ownerAtEvent === null ? null : e.ownerAtEvent.type === "resource" ? "resource:" + e.ownerAtEvent.id : e.ownerAtEvent.id,
        contextKind: e.ownerAtEvent?.type ?? "project", resourceType: e.ownerAtEvent?.type === "resource" ? e.ownerAtEvent.id : null,
        ...(e.attribution ? { projectName: e.attribution.label, projectStatus: e.attribution.status } : {}) }));
    return freeze({ version: 1, privacy: "local-private", stamp: native.stamp,
        records: [...fresh.map((r, i) => ({ ...r, historyReadKey: V.canonical(["native-history", native.authorityId, r.id]), nativeHistory: nativeReference(native, live[i]) })), ...records],
        completions: [...fresh, ...completions], diagnostics: query.diagnostics });
}
function createCompletionFeed({ native, legacy, navigate }) {
    check(native && legacy && typeof legacy.subscribe === "function", "Read-only completion ports required.");
    let closed = false, generation = 0, reading = 0, failureCode = null; const listeners = new Set();
    const invalidate = (selfFailure = false) => { generation++; if ((!reading || !selfFailure) && !closed) for (const listener of [...listeners]) { try { Promise.resolve(listener()).catch(() => {}); } catch (_) {} } };
    // Reads can themselves save verification barriers and generate storage/failure
    // notifications. Coalesce those during a demand. Actual commits and provider
    // changes still revoke other consumers immediately, including during a read.
    const stops = [native.subscribe(change => {
        const repeatedFailure = change?.reason === "unavailable" && failureCode === change.code;
        if (change?.reason === "unavailable") failureCode = change.code;
        invalidate(change?.reason === "storage" || repeatedFailure);
    }), legacy.subscribe(() => invalidate())];
    return Object.freeze({
        async read() {
            if (closed) throw unavailable("CLOSED"); reading++;
            try { for (let attempt = 0; attempt < 3; attempt++) {
                const ticket = generation, before = V.clone(await legacy.read()), n = await native.read(), after = V.clone(await legacy.read());
                for (const o of [before, after]) { V.fields(o, ["version", "revision", "records"], ["version", "revision", "records"]); check(o.version === 1 && Array.isArray(o.records), "Legacy observation required."); V.text(o.revision); }
                if (closed) throw unavailable("CLOSED");
                if (ticket !== generation || !same(before, after)) continue;
                const result = account(before.records, n);
                failureCode = null;
                return result;
            } throw unavailable("SNAPSHOT_UNSTABLE"); } catch (e) { throw unavailable(e.code === "CLOSED" ? "CLOSED" : e.code === "SNAPSHOT_UNSTABLE" ? e.code : "HISTORY_UNAVAILABLE"); }
            finally { reading--; }
        },
        subscribe(listener) { check(!closed && typeof listener === "function", "Completion subscription unavailable."); listeners.add(listener); return () => listeners.delete(listener); },
        async reveal(record) {
            check(!closed && record.nativeHistory, "Native History target required.");
            const current = await this.read(), match = current.records.find(r => r.nativeHistory?.authorityId === record.nativeHistory.authorityId && r.nativeHistory?.eventId === record.nativeHistory.eventId);
            check(match?.nativeHistory.navigation.state === "available" && same(match.nativeHistory.owner, record.nativeHistory.owner), "Native History target unavailable.");
            check(typeof navigate === "function", "Native navigation unavailable."); return navigate(freeze(V.clone(match.nativeHistory)));
        },
        dispose() { if (closed) return; closed = true; generation++; stops.forEach(stop => stop()); listeners.clear(); }
    });
}
module.exports = { createCompletionFeed, account };
