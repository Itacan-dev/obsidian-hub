"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJourney = startJourney;
exports.evaluateJourneyNavigation = evaluateJourneyNavigation;
exports.recordJourneyNavigation = recordJourneyNavigation;
exports.observeJourneys = observeJourneys;
exports.cancelJourney = cancelJourney;
exports.closeJourneyContext = closeJourneyContext;
const access_state_js_1 = require("./access-state.js");
const evaluate_js_1 = require("./evaluate.js");
const journey_state_js_1 = require("./journey-state.js");
const target_js_1 = require("./target.js");
function reject(reason, nextState) {
    return { ok: false, reason, nextState };
}
function deny(reason, nextState) {
    return { decision: { outcome: "DENY", reason }, nextState };
}
function findJourney(id, contextId, state) {
    if (!(0, access_state_js_1.positiveInteger)(id))
        return "INVALID_JOURNEY_ID";
    if (!(0, journey_state_js_1.validContextId)(contextId))
        return "INVALID_CONTEXT_ID";
    const journey = state.journeys.find((entry) => entry.id === id);
    if (journey === undefined)
        return "JOURNEY_NOT_FOUND";
    return journey.contextId === contextId ? journey : "CONTEXT_MISMATCH";
}
/** Only a trusted explicit start may create an attempt; no arrival or redirect calls this automatically. */
function startJourney(requestedRoot, contextId, input, limitsInput) {
    const prepared = (0, journey_state_js_1.prepareJourneyContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, prepared.nextState);
    const { policy, policyRevision, state, now } = prepared.value;
    if (!(0, journey_state_js_1.validContextId)(contextId))
        return reject("INVALID_CONTEXT_ID", state);
    const target = (0, target_js_1.normalizeTarget)(requestedRoot);
    if (target === null)
        return reject("INVALID_TARGET", state);
    if ((0, evaluate_js_1.evaluate)(target, policy).outcome !== "ALLOW")
        return reject("NOT_WHITELISTED", state);
    const limits = (0, journey_state_js_1.readJourneyLimits)(limitsInput);
    if (limits === null)
        return reject("INVALID_LIMITS", state);
    if (state.journeys.some((entry) => entry.contextId === contextId && entry.phase !== "ENDED")) {
        return reject("JOURNEY_ACTIVE", state);
    }
    if (!(0, access_state_js_1.positiveInteger)(state.nextJourneyId + 1))
        return reject("ID_EXHAUSTED", state);
    const expiresAt = now + limits.lifetimeMs;
    if (!(0, access_state_js_1.nonnegativeInteger)(expiresAt))
        return reject("TIME_OVERFLOW", state);
    const journey = {
        id: state.nextJourneyId, contextId, rootHostname: target.hostname, currentHostname: target.hostname,
        phase: "STARTED", startedAt: now, expiresAt, hopCount: 0, maxHops: limits.maxHops,
        policyRevision, endedAt: null, endReason: null,
    };
    const nextState = (0, journey_state_js_1.freezeJourneyState)({
        ...state, nextJourneyId: state.nextJourneyId + 1,
        journeys: [...state.journeys.filter((entry) => entry.contextId !== contextId), journey],
    });
    return { ok: true, type: "STARTED", journey, nextState };
}
function navigate(navigation, input, record) {
    const prepared = (0, journey_state_js_1.prepareJourneyContext)(input);
    if (!prepared.ok)
        return deny(prepared.reason, prepared.nextState);
    const { policy, now } = prepared.value;
    let state = prepared.value.state;
    const fields = ["journeyId", "contextId", "target"];
    if (navigation !== null && typeof navigation === "object" && Object.hasOwn(navigation, "continuation"))
        fields.push("continuation");
    if (!(0, journey_state_js_1.hasJourneyFields)(navigation, fields)) {
        return deny("INVALID_NAVIGATION", state);
    }
    const continuation = Object.hasOwn(navigation, "continuation") ? (0, journey_state_js_1.readJourneyContinuation)(navigation.continuation) : undefined;
    if (continuation === null)
        return deny("INVALID_NAVIGATION", state);
    let journey = findJourney(navigation.journeyId, navigation.contextId, state);
    if (typeof journey === "string")
        return deny(journey, state);
    const target = (0, target_js_1.normalizeTarget)(navigation.target);
    if (target === null)
        return deny("INVALID_TARGET", state);
    const base = (0, evaluate_js_1.evaluate)(target, policy);
    if (base.outcome === "DENY")
        return { decision: base, nextState: state };
    const returning = target.hostname === journey.rootHostname;
    if (journey.phase !== "ENDED" && !returning && !(0, journey_state_js_1.continuesJourney)(journey, target.hostname, continuation)) {
        journey = (0, journey_state_js_1.finishJourney)(journey, "UNRELATED_NAVIGATION", now);
        state = (0, journey_state_js_1.replaceJourney)(state, journey);
    }
    const hop = !returning && target.hostname !== journey.currentHostname;
    if (journey.phase !== "ENDED" && hop && journey.hopCount >= journey.maxHops) {
        journey = (0, journey_state_js_1.finishJourney)(journey, "HOP_LIMIT", now);
        state = (0, journey_state_js_1.replaceJourney)(state, journey);
    }
    if (journey.phase === "ENDED") {
        return {
            decision: base.outcome === "ALLOW" ? base : {
                outcome: "GREYLIST", reason: "JOURNEY_ENDED", target,
                journeyId: journey.id, endReason: journey.endReason,
            },
            nextState: state,
        };
    }
    const decision = base.outcome === "ALLOW" ? base : {
        outcome: "ALLOW", reason: "ACTIVE_JOURNEY",
        target, journeyId: journey.id, expiresAt: journey.expiresAt,
    };
    if (record) {
        if (returning) {
            journey = (0, journey_state_js_1.finishJourney)({ ...journey, currentHostname: target.hostname }, journey.phase === "STARTED" ? "REACHED" : "RETURNED", now);
        }
        else if (hop) {
            journey = { ...journey, currentHostname: target.hostname,
                phase: "IN_TRANSIT", hopCount: journey.hopCount + 1 };
        }
        if (journey.phase !== "ENDED" && continuation?.kind === "ARRIVAL" && base.outcome === "ALLOW") {
            journey = (0, journey_state_js_1.finishJourney)(journey, "DESTINATION_CHANGED", now);
        }
        state = (0, journey_state_js_1.replaceJourney)(state, journey);
    }
    return { decision, nextState: state };
}
/** Evaluate a proposed step. It cannot move the current location or complete a return. */
function evaluateJourneyNavigation(navigation, input) {
    return navigate(navigation, input, false);
}
/** Trusted owner records an adopted step, or an actual root arrival, against latest state. */
function recordJourneyNavigation(navigation, input) {
    return navigate(navigation, input, true);
}
/** Explicit housekeeping permits expiry handling even when no navigation occurs. */
function observeJourneys(input) {
    const prepared = (0, journey_state_js_1.prepareJourneyContext)(input);
    return prepared.ok ? { ok: true, type: "OBSERVED", nextState: prepared.value.state }
        : reject(prepared.reason, prepared.nextState);
}
function endJourney(id, contextId, input, reason) {
    const prepared = (0, journey_state_js_1.prepareJourneyContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, prepared.nextState);
    const { state, now } = prepared.value;
    const existing = findJourney(id, contextId, state);
    if (typeof existing === "string")
        return reject(existing, state);
    if (existing.phase === "ENDED")
        return reject("JOURNEY_ENDED", state);
    const journey = (0, journey_state_js_1.finishJourney)(existing, reason, now);
    return { ok: true, type: "ENDED", journey, nextState: (0, journey_state_js_1.replaceJourney)(state, journey) };
}
function cancelJourney(id, contextId, input) {
    return endJourney(id, contextId, input, "CANCELLED");
}
function closeJourneyContext(id, contextId, input) {
    return endJourney(id, contextId, input, "CONTEXT_CLOSED");
}
