"use strict";
// Presentation only: every action below is a route, never an authorization.
function presentationNow(state, now = Date.now()) {
    const s = state.snapshot;
    return Math.max(now, s?.accessState.lastObservedAt ?? 0, s?.vaultState.lastObservedAt ?? 0, s?.journeyState.lastObservedAt ?? 0);
}
function temporaryGrantUsable(state, grant, now = presentationNow(state)) {
    return state.status === "READY" && state.enabled !== false && now < grant.expiresAt && grant.policyRevision === state.snapshot?.policyRevision &&
        (state.temporaryDestinations ?? []).some(g => g.requestId === grant.requestId && g.hostname === grant.hostname &&
            g.decision?.outcome === "ALLOW" && g.decision.reason === "ACTIVE_GRANT");
}
const phaseAt = (p, now) => now < p.readyAt ? "WAITING" : now < p.confirmBy ? "READY" : "EXPIRED";
const labels = { WAITING: "Waiting", READY: "Ready for explicit confirmation", EXPIRED: "Expired", STALE: "Review required", UNRESOLVED: "Outcome unresolved" };
function pendingActions(state, wallNow = Date.now(), session = null) {
    const now = presentationNow(state, wallNow), s = state.snapshot, available = state.status === "READY" && state.enabled !== false, items = [];
    if (!available && state.status !== "UNINITIALIZED") items.push({ key: "authority", label: "Saved state needs recovery", phase: "UNRESOLVED", detail: "Browsing stays blocked until saved state is reconciled.", route: { section: "diagnostics" } });
    if (session?.draft?.submission?.status === "unresolved" || session?.timings?.unresolved) items.push({ key: "local-submission", label: "Submission needs review", phase: "UNRESOLVED", detail: "Save acknowledgement unresolved. Your local copy is kept; compare saved state before retrying.", route: { section: "diagnostics" } });
    const p = s?.vaultState.pendingProposal;
    if (p) {
        const phase = !available ? "UNRESOLVED" : p.basePolicyRevision !== s.policyRevision || p.baseConfigurationRevision !== undefined && p.baseConfigurationRevision !== s.configurationRevision ? "STALE" : phaseAt(p, now);
        items.push({ key: "vault:" + p.id, label: "Vault proposal", phase, detail: labels[phase], deadline: phase === "WAITING" ? p.readyAt : phase === "READY" ? p.confirmBy : null,
            route: { section: "vault", context: { proposalId: p.id } } });
    }
    if (state.application?.recovery) items.push({ key: "recovery:" + state.application.recovery.id, label: "Saved recovery copy", phase: available ? "RECOVERY" : "UNRESOLVED",
        detail: "Saved draft only; it has not changed active policy.", route: { section: "vault", context: { recoveryId: state.application.recovery.id } } });
    for (const request of s?.accessState.pendingRequests ?? []) {
        const context = (state.contexts ?? []).find(c => c.origin && ["BLOCKED", "ENFORCEMENT_FAILED"].includes(c.phase) &&
            c.response?.decision?.requestId === request.id && c.response.decision.target?.hostname === request.hostname);
        const phase = !available ? "UNRESOLVED" : request.policyRevision !== s.policyRevision ? "STALE" : phaseAt(request, now);
        items.push({ key: "access:" + request.id, label: request.hostname, phase, detail: context ? labels[phase] : labels[phase] + ". Return to this destination in a Note tab to continue.",
            contextId: context?.id ?? null, deadline: phase === "WAITING" ? request.readyAt : phase === "READY" ? request.confirmBy : null,
            route: { section: "temporary", context: { requestId: request.id, ...(context ? { contextId: context.id } : {}) } } });
    }
    return items;
}
function pendingForBridge(bridge, now = Date.now()) { return pendingActions(bridge.view(), now, require("./session").getAtlasSession(bridge)); }
module.exports = { pendingActions, pendingForBridge, phaseAt, presentationNow, temporaryGrantUsable };
