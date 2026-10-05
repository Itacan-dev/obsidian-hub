"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAccess = evaluateAccess;
exports.startAccess = startAccess;
exports.confirmAccess = confirmAccess;
exports.cancelAccess = cancelAccess;
const access_state_js_1 = require("./access-state.js");
const evaluate_js_1 = require("./evaluate.js");
function reject(reason, nextState) {
    return { ok: false, reason, nextState };
}
/** Derive access and advance observation metadata, without creating authorization. */
function evaluateAccess(requestedSite, input) {
    const prepared = (0, access_state_js_1.prepareContext)(input);
    if (!prepared.ok) {
        return { decision: { outcome: "DENY", reason: prepared.reason }, nextState: null };
    }
    const { policy, policyRevision, now, state } = prepared.value;
    const base = (0, evaluate_js_1.evaluate)(requestedSite, policy);
    if (base.outcome !== "GREYLIST")
        return { decision: base, nextState: state };
    const target = base.target;
    const grant = state.grants.find((entry) => (0, access_state_js_1.accessScope)(entry).includes(target.hostname));
    const request = state.pendingRequests.find((entry) => (0, access_state_js_1.accessScope)(entry).includes(target.hostname));
    const record = grant ?? request;
    if (record !== undefined && record.policyRevision !== policyRevision) {
        return {
            decision: { outcome: "GREYLIST", reason: "POLICY_CHANGED", target }, nextState: state,
        };
    }
    if (grant !== undefined) {
        return {
            decision: now < grant.expiresAt
                ? { outcome: "ALLOW", reason: "ACTIVE_GRANT", target,
                    requestId: grant.requestId, expiresAt: grant.expiresAt }
                : { outcome: "GREYLIST", reason: "GRANT_EXPIRED", target },
            nextState: state,
        };
    }
    if (request !== undefined) {
        if (now >= request.confirmBy) {
            return {
                decision: { outcome: "GREYLIST", reason: "REQUEST_EXPIRED", target }, nextState: state,
            };
        }
        const details = {
            target, requestId: request.id, readyAt: request.readyAt, confirmBy: request.confirmBy,
        };
        return {
            decision: now < request.readyAt
                ? { outcome: "WAIT", reason: "COOLDOWN", ...details }
                : { outcome: "REQUIRE_CONFIRMATION", reason: "CONFIRMATION_REQUIRED", ...details },
            nextState: state,
        };
    }
    return { decision: base, nextState: state };
}
/** Start explicitly, or return the existing unexpired request without changing its terms. */
function startAccess(requestedSite, input, timingInput, scopeInput) {
    const prepared = (0, access_state_js_1.prepareContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    const { policy, policyRevision, now, state } = prepared.value;
    const decision = (0, evaluate_js_1.evaluate)(requestedSite, policy);
    if (decision.outcome === "DENY" && decision.reason === "INVALID_TARGET") {
        return reject("INVALID_TARGET", state);
    }
    if (decision.outcome !== "GREYLIST")
        return reject("NOT_GREYLIST", state);
    const timing = (0, access_state_js_1.readTiming)(timingInput);
    if (timing === null)
        return reject("INVALID_TIMING", state);
    const hostname = decision.target.hostname;
    const scope = scopeInput === undefined ? [hostname] : (0, access_state_js_1.readAccessScope)(scopeInput, hostname);
    if (scope === null)
        return reject("INVALID_SCOPE", state);
    if (scope.some((host) => (0, evaluate_js_1.evaluate)(host, policy).outcome !== "GREYLIST"))
        return reject("NOT_GREYLIST", state);
    const existing = state.pendingRequests.find((entry) => (0, access_state_js_1.accessScope)(entry).includes(hostname));
    if (existing !== undefined && existing.policyRevision === policyRevision && now < existing.confirmBy) {
        return { ok: true, type: "EXISTING_REQUEST", request: existing, nextState: state };
    }
    const grant = state.grants.find((entry) => (0, access_state_js_1.accessScope)(entry).includes(hostname));
    if (grant !== undefined && grant.policyRevision === policyRevision && now < grant.expiresAt) {
        return reject("GRANT_ACTIVE", state);
    }
    const overlaps = (entry) => (0, access_state_js_1.accessScope)(entry).some((host) => scope.includes(host));
    if (state.pendingRequests.some((entry) => overlaps(entry) && entry.policyRevision === policyRevision && now < entry.confirmBy)
        || state.grants.some((entry) => overlaps(entry) && entry.policyRevision === policyRevision && now < entry.expiresAt))
        return reject("SCOPE_CONFLICT", state);
    if (!(0, access_state_js_1.positiveInteger)(state.nextRequestId + 1))
        return reject("ID_EXHAUSTED", state);
    const readyAt = now + timing.waitMs;
    const confirmBy = readyAt + timing.confirmationWindowMs;
    if (!(0, access_state_js_1.nonnegativeInteger)(readyAt) || !(0, access_state_js_1.nonnegativeInteger)(confirmBy)) {
        return reject("TIME_OVERFLOW", state);
    }
    const request = {
        id: state.nextRequestId, hostname, startedAt: now, readyAt, confirmBy,
        ...(scopeInput === undefined ? {} : { scopeHostnames: scope }),
        grantDurationMs: timing.grantDurationMs, policyRevision,
    };
    return {
        ok: true, type: "STARTED", request,
        nextState: {
            ...state, nextRequestId: state.nextRequestId + 1,
            pendingRequests: [...state.pendingRequests.filter((entry) => !overlaps(entry)), request],
            grants: state.grants.filter((entry) => !overlaps(entry)),
        },
    };
}
function findRequest(requestId, context) {
    if (!(0, access_state_js_1.positiveInteger)(requestId))
        return "INVALID_REQUEST_ID";
    const request = context.state.pendingRequests.find((entry) => entry.id === requestId);
    if (request === undefined)
        return "REQUEST_NOT_FOUND";
    if (request.policyRevision !== context.policyRevision)
        return "POLICY_CHANGED";
    if (context.now >= request.confirmBy)
        return "REQUEST_EXPIRED";
    return request;
}
/** Request consumption and grant creation are one complete candidate transition. */
function confirmAccess(requestId, input) {
    const prepared = (0, access_state_js_1.prepareContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    const context = prepared.value;
    const { policy, now, state } = context;
    const request = findRequest(requestId, context);
    if (typeof request === "string")
        return reject(request, state);
    if ((0, access_state_js_1.accessScope)(request).some((host) => (0, evaluate_js_1.evaluate)(host, policy).outcome !== "GREYLIST")) {
        return reject("NOT_GREYLIST", state);
    }
    if (now < request.readyAt)
        return reject("NOT_READY", state);
    const expiresAt = now + request.grantDurationMs;
    if (!(0, access_state_js_1.nonnegativeInteger)(expiresAt))
        return reject("TIME_OVERFLOW", state);
    const grant = {
        requestId: request.id, hostname: request.hostname, issuedAt: now,
        ...(request.scopeHostnames === undefined ? {} : { scopeHostnames: request.scopeHostnames }),
        expiresAt, policyRevision: context.policyRevision,
    };
    return {
        ok: true, type: "CONFIRMED", grant,
        nextState: {
            ...state,
            pendingRequests: state.pendingRequests.filter((entry) => entry.id !== request.id),
            grants: [...state.grants, grant],
        },
    };
}
/** Cancelling a pending request never revokes or renews an already issued grant. */
function cancelAccess(requestId, input) {
    const prepared = (0, access_state_js_1.prepareContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    const context = prepared.value;
    const request = findRequest(requestId, context);
    if (typeof request === "string")
        return reject(request, context.state);
    return {
        ok: true, type: "CANCELLED", requestId: request.id,
        nextState: {
            ...context.state,
            pendingRequests: context.state.pendingRequests.filter((entry) => entry.id !== request.id),
        },
    };
}
