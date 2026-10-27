"use strict";
const Core = require("../core/index");
const { serviceHostnames, compileCuratedWhitelist, curatedWhitelist } = require("../presets/curated-whitelist");
function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
}
const starter = freeze({ groups: curatedWhitelist.map(g => ({ label: g.label, count: g.services.length })),
    serviceCount: curatedWhitelist.reduce((count, g) => count + g.services.length, 0),
    hostCount: compileCuratedWhitelist().whitelist.length, policy: compileCuratedWhitelist() });
const phase = (record, now) => now < record.readyAt ? "WAITING" : now < record.confirmBy ? "READY" : "EXPIRED";
// A display projection of controller-validated data. No result from this module
// enters controller.handle, native release, leases or a policy transition.
function createPresentation() {
    let previous = null, previousManaged, cached;
    return (state, application, enabled, now, managed, hasManaged) => {
        const snapshot = state.snapshot, access = snapshot?.accessState;
        const validTime = Number.isSafeInteger(now) && now >= 0 && (!snapshot ||
            [access, snapshot.vaultState, snapshot.journeyState].every(s => now >= s.lastObservedAt));
        const key = JSON.stringify([state.status, enabled, application, snapshot?.policy, snapshot?.policyRevision,
            snapshot?.configuration, snapshot?.configurationRevision, access?.grants, access?.pendingRequests,
            access?.grants.map(g => now < g.expiresAt), access?.pendingRequests.map(r => phase(r, now)), validTime, hasManaged]);
        if (key === previous && managed === previousManaged) return cached;
        const white = new Set(snapshot?.policy.whitelist), black = new Set(snapshot?.policy.blacklist), grants = new Map(), requests = new Map(), decisions = new Map();
        for (const grant of access?.grants ?? []) for (const host of grant.scopeHostnames ?? [grant.hostname]) grants.set(host, grant);
        for (const request of access?.pendingRequests ?? []) for (const host of request.scopeHostnames ?? [request.hostname]) requests.set(host, request);
        const describe = hostname => {
            if (decisions.has(hostname)) return decisions.get(hostname);
            const target = { hostname }; let decision;
            if (state.status !== "READY" || !enabled) decision = { outcome: "DENY", reason: "ATLAS_UNAVAILABLE" };
            else if (!validTime || hasManaged && !Core.isManagedBlacklist(managed)) decision = { outcome: "DENY", reason: "REJECTED" };
            else if (black.has(hostname)) decision = { outcome: "DENY", reason: "BLACKLISTED", target };
            else if (white.has(hostname)) decision = { outcome: "ALLOW", reason: "WHITELISTED", target };
            else if (hasManaged && Core.managedBlacklistContains(managed, hostname)) decision = { outcome: "DENY", reason: "MANAGED_BLACKLISTED", target };
            else {
                const grant = grants.get(hostname), request = requests.get(hostname), record = grant ?? request;
                if (record && record.policyRevision !== snapshot.policyRevision) decision = { outcome: "GREYLIST", reason: "POLICY_CHANGED", target };
                else if (grant) decision = now < grant.expiresAt ? { outcome: "ALLOW", reason: "ACTIVE_GRANT", target, requestId: grant.requestId, expiresAt: grant.expiresAt }
                    : { outcome: "GREYLIST", reason: "GRANT_EXPIRED", target };
                else if (request && now < request.confirmBy) decision = { outcome: now < request.readyAt ? "WAIT" : "REQUIRE_CONFIRMATION",
                    reason: now < request.readyAt ? "COOLDOWN" : "CONFIRMATION_REQUIRED", target, requestId: request.id, readyAt: request.readyAt, confirmBy: request.confirmBy };
                else decision = { outcome: "GREYLIST", reason: request ? "REQUEST_EXPIRED" : "UNLISTED", target };
            }
            decisions.set(hostname, decision); return decision;
        };
        cached = freeze({ destinations: (application?.destinations ?? []).map(d => ({ ...d,
            hosts: serviceHostnames(d).map(hostname => ({ hostname, decision: describe(hostname) })), decision: describe(d.hostname) })),
            temporaryDestinations: (access?.grants ?? []).map(g => ({ ...g, decision: describe(g.hostname) })) });
        previous = key; previousManaged = managed; return cached;
    };
}
// Ignore only persistence checkpoint bookkeeping. Policy, configuration,
// recovery, grants, requests, Journey/context changes and phase boundaries notify.
function presentationKey(view, now) {
    const s = view.snapshot;
    return JSON.stringify([view.status, view.reason, view.enabled, view.pendingCommitId, view.repositoryIssue, view.storage?.lastFailure, view.recovery, view.application,
        s?.policy, s?.policyRevision, s?.configuration, s?.configurationRevision, s?.accessState.pendingRequests, s?.accessState.grants,
        s?.vaultState.pendingProposal, s?.vaultState.pendingProposal && phase(s.vaultState.pendingProposal, now), s?.journeyState.journeys,
        view.destinations, view.temporaryDestinations, view.contexts.map(c => [c.id, c.nativeId, c.generation, c.closed, c.phase, c.origin,
            c.response?.type, c.response?.reason, c.response?.decision, c.journey])]);
}
function createViewJSON(read, encode = JSON.stringify) {
    let key, destinations, temporary, encoded;
    return () => {
        const view = read(), next = JSON.stringify([view.status, view.reason, view.enabled, view.storageVersion, view.pendingCommitId,
            view.repositoryIssue, view.storage, view.recovery, view.contexts, view.managed]);
        if (next !== key || destinations !== view.destinations || temporary !== view.temporaryDestinations) {
            encoded = encode(view); key = next; destinations = view.destinations; temporary = view.temporaryDestinations;
        }
        return encoded;
    };
}
module.exports = { createPresentation, presentationKey, createViewJSON, starter, freeze };
