"use strict";
// Host-owned immutable request evidence; receipts alone establish task outcomes.
const V = require("../src/value"), P = require("../writer/policy"), A = require("../writer/admission");
const { check, fail } = require("../src/errors"), { freeze } = require("../src/snapshot-read");
const markerName = "REQUEST-RETENTION-v1.json", prefix = "REQUEST-v1-";
const fields = (v, keys) => V.fields(v, keys, keys);
function createPendingRequests(port, config, settings, inspect) {
    fields(settings, ["version", "rehearsalId"]); check(settings.version === 1, "Unsupported retention version."); V.uuid(settings.rehearsalId);
    const markerBody = { format: "itacan-native-request-retention", version: 1, authorityId: config.authorityId, applicationContextId: config.applicationContextId, rehearsalId: settings.rehearsalId };
    let stopped = false, ready = false, reviews = new WeakMap(), permits = new WeakMap(); const inflight = new Set(), preparing = new Map(), prior = new Set();
    const sealed = body => ({ ...body, checksum: P.hash(body) });
    const name = id => prefix + P.hash(id) + ".json";
    const owned = () => port.assertWriter();
    function tracked(work) {
        check(ready && !stopped, "Retention is closed."); const job = work().catch(error => { const code = ["OPERATION_CONFLICT", "OUTCOME_RECONCILIATION_REQUIRED", "WRITER_ADMISSION_REQUIRED", "LOCK_LOST", "ROOT_IDENTITY_CHANGED", "ENOENT", "VALIDATION", "RECOVERY_REVIEW_REQUIRED", "RECOVERY_REVIEW_STALE", "ORIGINAL_GUARDS_STALE", "EXACT_REPLAY_SAFETY_UNPROVEN"].includes(error?.code) ? error.code : "REQUEST_RETENTION_INVALID"; fail(code, "Retained request evidence is unavailable."); }); inflight.add(job); job.finally(() => inflight.delete(job)).catch(() => {}); return job;
    }
    function record(intent) {
        const compiled = require("../application/intents").compile(intent), i = compiled.intent;
        check(compiled.request && ["rich-create", "full-save", "set-completion", "set-step-completion", "delete-tree"].includes(i.action.kind), "Action is outside Project rehearsal.");
        check(i.authority.backend === "native" && i.authority.authorityId === config.authorityId && i.authority.applicationContextId === config.applicationContextId && ["project", "resource"].includes(i.owner.type) && i.guard.partitions.length === 1, "Retention scope differs.");
        if (i.action.kind === "rich-create") { V.uuid(i.action.draft.id); for (const step of i.action.draft.steps) V.uuid(step.id); }
        return sealed({ format: "itacan-native-ui-request", version: 1, authorityId: config.authorityId, applicationContextId: config.applicationContextId,
            rehearsalId: settings.rehearsalId, owner: V.clone(i.owner), partitionId: i.guard.partitions[0].id, operationId: i.operationId,
            intent: V.clone(i), intentDigest: P.hash(i), writerRequest: V.clone(compiled.request), writerRequestDigest: P.hash(compiled.request), commandDigest: P.hash(A.compile(compiled.request)) });
    }
    function validate(raw, expectedName) {
        const value = JSON.parse(raw); V.jsonValue(value);
        fields(value, ["format", "version", "authorityId", "applicationContextId", "rehearsalId", "owner", "partitionId", "operationId", "intent", "intentDigest", "writerRequest", "writerRequestDigest", "commandDigest", "checksum"]);
        const expected = record(value.intent); check(P.same(value, expected) && (!expectedName || expectedName === name(value.operationId)), "Retained request integrity differs."); return freeze(expected);
    }
    async function names() {
        const all = await port.list();
        check(all.filter(n => n.startsWith("REQUEST-")).every(n => n === markerName || /^REQUEST-v1-[a-f0-9]{64}\.json$/.test(n)), "Unsupported request evidence.");
        return all.filter(n => n.startsWith(prefix));
    }
    async function marker() { check(P.same(JSON.parse(await port.read(markerName)), sealed(markerBody)), "Retention marker differs."); }
    async function getRaw(id) { await owned(); await marker(); const n = name(id), raw = await port.read(n), value = validate(raw, n); await owned(); return value; }
    async function all() { await owned(); await marker(); const records = []; for (const n of await names()) records.push(validate(await port.read(n), n)); await owned(); return records; }
    async function write(n, value) {
        const raw = V.canonical(value) + "\n"; await owned();
        try { await port.writeNew(n, raw); }
        catch (error) { if (error.code !== "EEXIST") throw error; if (await port.read(n) !== raw) fail("OPERATION_CONFLICT", "Retained operation conflicts."); }
        check(await port.read(n) === raw, "Retention readback differs."); await owned();
    }
    async function observation(r) { await owned(); const value = await inspect(r); await owned(); return value; }
    async function reconcileRecord(r) { return (await observation(r)).operation; }
    async function requireResolved(records, currentId = null, state = null, recovery = false) {
        for (const r of records) {
            if (r.operationId === currentId && (!prior.has(r.operationId) || recovery)) continue;
            if (state) {
                const receipt = state.receipts.find(x => x.operationId === r.operationId);
                if (!receipt || P.hash(JSON.parse(receipt.payload)) !== r.commandDigest) fail("OUTCOME_RECONCILIATION_REQUIRED", "A retained request requires review.");
            } else {
                const out = await reconcileRecord(r);
                if (out.state !== "committed") fail("OUTCOME_RECONCILIATION_REQUIRED", "A retained request requires review.");
            }
        }
    }
    function replayCode(r, o) {
        if (!o?.ready || !o.stamp) return "AUTHORITY_UNAVAILABLE";
        if (r.writerRequest.scope.ownerContextPin !== o.stamp.ownerContextPin || r.writerRequest.scope.identityPin !== o.stamp.identityPin) return "ORIGINAL_GUARDS_STALE";
        if (o.operation.state === "committed") return "EXACT_COMMITTED_REPLAY";
        if (o.operation.state !== "missing") return "OPERATION_CONFLICT";
        // Enabled roots fence every write/replay after known fallback. Missing
        // evidence alone never establishes nonexecution or permits rebasing.
        if (o.taskMutationVersion !== 1) return "EXACT_REPLAY_SAFETY_UNPROVEN";
        if (r.writerRequest.command.expectedRepositoryRevision !== o.stamp.head.repositoryRevision ||
            r.writerRequest.scope.partitions.some(p => !o.partitions.some(q => q.id === p.id && P.same(q.owner, p.owner) && q.revision === p.expectedRevision))) return "ORIGINAL_GUARDS_STALE";
        return "EXACT_ORIGINAL_HEAD_REPLAY";
    }
    const sameObservation = (a, b) => P.same(a.head, b.head) && a.hostEpoch === b.hostEpoch && a.ownerContextPin === b.ownerContextPin && a.identityPin === b.identityPin;
    function replayPermit(permission, r, state, info) {
        const p = permission && permits.get(permission);
        if (!p || !p.active || stopped || p.record.checksum !== r.checksum || !sameObservation(p.stamp, { head: { authorityId: state.storeId, repositoryRevision: state.revision, revisionId: state.revisionId }, hostEpoch: info.hostEpoch, ownerContextPin: info.ownerContextPin, identityPin: info.identityPin })) fail("RECOVERY_REVIEW_STALE", "Recovery review is unavailable.");
        return p;
    }
    return Object.freeze({
        async start(creating) {
            stopped = false; ready = false; prior.clear(); await owned();
            if (creating) await write(markerName, sealed(markerBody));
            else check(P.same(JSON.parse(await port.read(markerName)), sealed(markerBody)), "Retention marker differs.");
            for (const r of await all()) prior.add(r.operationId); ready = true;
        },
        prepare(input) {
            const r = record(input), id = r.operationId;
            if (preparing.has(id)) { const held = preparing.get(id); if (held.digest !== r.checksum) fail("OPERATION_CONFLICT", "Retained operation conflicts."); return held.promise; }
            const promise = tracked(async () => {
                check(preparing.size === 0, "Another request preparation is in progress.");
                const records = await all(), old = records.find(x => x.operationId === id);
                if (old) { if (!P.same(old, r)) fail("OPERATION_CONFLICT", "Retained operation conflicts."); return old; }
                await requireResolved(records); await write(name(id), r); return freeze(V.clone(r));
            });
            preparing.set(id, { digest: r.checksum, promise }); promise.finally(() => preparing.delete(id)).catch(() => {}); return promise;
        },
        list() { return tracked(async () => freeze((await all()).map(r => ({ operationId: r.operationId, intentDigest: r.intentDigest, owner: r.owner, partitionId: r.partitionId })))); },
        get(id) { V.text(id); return tracked(() => getRaw(id)); },
        reconcile(id) { V.text(id); return tracked(async () => reconcileRecord(await getRaw(id))); },
        inspect(id) { V.text(id); return tracked(async () => {
            let r = null, o, damaged = false;
            try { r = await getRaw(id); o = await observation(r); await all(); }
            catch (error) {
                if (["LOCK_LOST", "ROOT_IDENTITY_CHANGED"].includes(error?.code)) return freeze({ version: 1, privacy: "local-private", authorityId: config.authorityId, applicationContextId: config.applicationContextId, operationId: id, classification: "authority-unavailable", code: error.code, owner: null, partitionId: null, recordChecksum: null, commandDigest: null, observation: null, receipt: null, taskIds: [], eventIds: [], canReplay: false, replayCode: "AUTHORITY_UNAVAILABLE" });
                damaged = true; o = await observation(null);
            }
            const op = o.operation, classification = !o.ready ? "authority-unavailable" : damaged ? "damaged" : op.state === "committed" ? "confirmed-committed" : op.state === "missing" ? "execution-uncertain" : op.state === "conflict" ? "conflict" : "authority-unavailable";
            let code = !o.ready ? "AUTHORITY_UNAVAILABLE" : damaged ? "REQUEST_RETENTION_INVALID" : op.code, replay = damaged ? "REQUEST_RETENTION_INVALID" : replayCode(r, o);
            if (["EXACT_COMMITTED_REPLAY", "EXACT_ORIGINAL_HEAD_REPLAY"].includes(replay)) {
                try { await requireResolved((await all()).filter(x => x.operationId !== id)); } catch (_) { replay = "OTHER_REQUEST_UNRESOLVED"; }
            }
            const report = freeze({ version: 1, privacy: "local-private", authorityId: config.authorityId, applicationContextId: config.applicationContextId, operationId: id, classification, code,
                owner: damaged ? null : r.owner, partitionId: damaged ? null : r.partitionId, recordChecksum: damaged ? null : r.checksum, commandDigest: damaged ? null : r.commandDigest,
                observation: o.stamp, receipt: classification === "confirmed-committed" ? op.receipt : null, taskIds: classification === "confirmed-committed" ? op.taskIds : [], eventIds: classification === "confirmed-committed" ? op.eventIds : [],
                canReplay: ["EXACT_COMMITTED_REPLAY", "EXACT_ORIGINAL_HEAD_REPLAY"].includes(replay), replayCode: replay });
            if (report.canReplay) reviews.set(report, { record: r, stamp: o.stamp }); return report;
        }); },
        permit(review) { return tracked(async () => {
            const selected = reviews.get(review); if (!selected) fail("RECOVERY_REVIEW_REQUIRED", "An original accepted recovery review is required."); reviews.delete(review);
            const r = await getRaw(selected.record.operationId), o = await observation(r);
            if (r.checksum !== selected.record.checksum || !o.ready || !sameObservation(selected.stamp, o.stamp)) fail("RECOVERY_REVIEW_STALE", "Recovery observation changed.");
            const code = replayCode(r, o); if (!["EXACT_COMMITTED_REPLAY", "EXACT_ORIGINAL_HEAD_REPLAY"].includes(code)) fail(code, "Exact replay cannot be admitted.");
            await requireResolved((await all()).filter(x => x.operationId !== r.operationId));
            const permission = Object.freeze({ version: 1 }); permits.set(permission, { active: true, record: r, stamp: o.stamp }); return permission;
        }); },
        finishReplay(permission) { const p = permits.get(permission); if (p) p.active = false; },
        assertReplayContext(permission, context, info) {
            const p = permits.get(permission); if (!p?.active || stopped || p.stamp.hostEpoch !== info.hostEpoch || p.stamp.ownerContextPin !== context.ownerContextPin || p.stamp.identityPin !== context.identityPin) fail("RECOVERY_REVIEW_STALE", "Recovery context changed.");
        },
        async verify(request, state, permission, info) {
            check(ready, "Retention unavailable.");
            const records = await all(), r = records.find(x => x.operationId === request.command.operationId);
            if (!r || r.writerRequestDigest !== P.hash(request) || r.commandDigest !== P.hash(A.compile(request))) fail("WRITER_ADMISSION_REQUIRED", "Exact retained request required.");
            if (permission) replayPermit(permission, r, state, info);
            await requireResolved(records, r.operationId, state, !!permission);
            return r;
        },
        stop() { stopped = true; reviews = new WeakMap(); permits = new WeakMap(); },
        async drain() { await Promise.allSettled([...inflight]); },
        markerName
    });
}
module.exports = { createPendingRequests, markerName };
