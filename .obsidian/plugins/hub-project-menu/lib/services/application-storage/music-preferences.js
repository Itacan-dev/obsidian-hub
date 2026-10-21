"use strict";
// Private, injected caller adapter. Owns no storage, lease, subscription or queue.
const { randomUUID } = require("crypto");
const C = require("./codec");
const { normalizeMusicConfig, musicProvider } = require("../../domain/music");
function createMusicPreferences({ store, authorityId, applicationContextId }) {
    C.uuid(authorityId); C.text(applicationContextId);
    C.check(store && ["readScopes", "transact", "reconcile"].every(k => typeof store[k] === "function"));
    const scope = { version: 1, authorityId, applicationContextId, fields: ["music"] };
    function intent(value) {
        C.portable(value);
        C.check(value?.kind === "set-enabled" || value?.kind === "set-provider-enabled");
        C.fields(value, value.kind === "set-enabled" ? ["kind", "enabled"] : ["kind", "provider", "enabled"]);
        C.check(typeof value.enabled === "boolean");
        if (value.kind === "set-provider-enabled") C.check(!!musicProvider(value.provider), "MUSIC_PROVIDER_UNSUPPORTED");
        return C.copy(value);
    }
    function music(field) {
        const value = field.present ? C.copy(field.value) : undefined;
        let normalized;
        try { normalized = normalizeMusicConfig(value); } catch (_) { C.fail("MUSIC_REPAIR_REQUIRED"); }
        C.check(!field.present || C.same(value, normalized), "MUSIC_REPAIR_REQUIRED");
        return C.copy(normalized);
    }
    function original(value) {
        C.portable(value); C.fields(value, ["observation", "field"]);
        const o = value.observation, f = value.field;
        C.fields(o, ["version", "privacy", "authorityId", "applicationContextId", "revision", "snapshotDigest", "ownerEpoch", "allowedScopes"]);
        C.check(o.version === 1 && o.privacy === "local-private");
        C.check(o.authorityId === authorityId, "AUTHORITY_MISMATCH");
        C.check(o.applicationContextId === applicationContextId, "CONTEXT_MISMATCH");
        C.revision(o.revision); C.digest(o.snapshotDigest); C.uuid(o.ownerEpoch); C.scopes(o.allowedScopes);
        C.check(o.allowedScopes.some(s => s.field === "music" && s.dependencies.length === 0), "SCOPE_UNSUPPORTED");
        C.fields(f, f.present ? ["field", "present", "digest", "value"] : ["field", "present", "digest"]);
        C.check(f.field === "music" && typeof f.present === "boolean");
        C.check(C.same({ present: f.present, digest: f.digest }, C.fact(f.present ? { music: f.value } : {}, "music")));
        music(f); return C.copy(value);
    }
    function build(action, observed, operationId) {
        const i = intent(action), r = original(observed); C.text(operationId);
        const next = music(r.field);
        if (i.kind === "set-enabled") next.enabled = i.enabled;
        else next.providers[i.provider] = i.enabled;
        const intentDigest = C.hash(i), o = r.observation;
        const request = C.request({ version: 1, authorityId, applicationContextId, operationId,
            reason: "music-preferences-v1:" + intentDigest + ":" + i.kind, participant: "local-private",
            observation: { revision: o.revision, snapshotDigest: o.snapshotDigest, ownerEpoch: o.ownerEpoch },
            changes: [{ field: "music", expected: { present: r.field.present, digest: r.field.digest }, operation: "replace", value: next }], dependencies: [] });
        return C.copy({ version: 1, privacy: "local-private", intent: i, intentDigest, original: r, request });
    }
    function validated(prepared) {
        C.portable(prepared); C.fields(prepared, ["version", "privacy", "intent", "intentDigest", "original", "request"]);
        const expected = build(prepared.intent, prepared.original, prepared.request?.operationId);
        C.check(C.same(prepared, expected), "MUSIC_PREPARATION_MISMATCH"); return expected;
    }
    const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
    return Object.freeze({
        async read() {
            const r = await store.readScopes(C.copy(scope));
            C.check(Array.isArray(r.fields) && r.fields.length === 1);
            return freeze(original({ observation: r.observation, field: r.fields[0] }));
        },
        prepare(action, observed, operationId = randomUUID()) { return freeze(build(action, observed, operationId)); },
        async submit(prepared, signal) {
            const p = validated(prepared);
            try { return C.copy(await store.transact(p.request, signal)); }
            catch (_) { return { version: 1, privacy: "local-private", status: "uncertain", code: "MUSIC_SUBMIT_UNAVAILABLE", operationId: p.request.operationId, retry: "identical-request-after-reconciliation" }; }
        },
        async reconcile(prepared) {
            const p = validated(prepared);
            try { return C.copy(await store.reconcile(p.request)); }
            catch (_) { return { version: 1, privacy: "local-private", status: "recovery-required", code: "MUSIC_RECONCILIATION_UNAVAILABLE", operationId: p.request.operationId, retry: "review" }; }
        }
    });
}
module.exports = { createMusicPreferences };
