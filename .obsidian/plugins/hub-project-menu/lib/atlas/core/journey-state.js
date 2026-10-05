"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasJourneyFields = hasJourneyFields;
exports.validContextId = validContextId;
exports.freezeJourneyState = freezeJourneyState;
exports.createJourneyState = createJourneyState;
exports.readJourneyLimits = readJourneyLimits;
exports.readJourneyContinuation = readJourneyContinuation;
exports.continuesJourney = continuesJourney;
exports.readJourneyState = readJourneyState;
exports.finishJourney = finishJourney;
exports.replaceJourney = replaceJourney;
exports.prepareJourneyContext = prepareJourneyContext;
const access_state_js_1 = require("./access-state.js");
const evaluate_js_1 = require("./evaluate.js");
const policy_js_1 = require("./policy.js");
const target_js_1 = require("./target.js");
function hasJourneyFields(value, fields) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        && Object.keys(value).length === fields.length
        && fields.every((field) => Object.hasOwn(value, field));
}
function validContextId(value) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
/** All records must be owned copies before freezing; never freeze caller data. */
function freezeJourneyState(state) {
    state.journeys.forEach(Object.freeze);
    Object.freeze(state.journeys);
    return Object.freeze(state);
}
/** Explicit initialization only. Invalid state never becomes an empty state. */
function createJourneyState() {
    return freezeJourneyState({ journeys: [], nextJourneyId: 1, lastObservedAt: 0, policyRevision: 0 });
}
function readJourneyLimits(value) {
    if (!hasJourneyFields(value, ["lifetimeMs", "maxHops"])
        || !(0, access_state_js_1.positiveInteger)(value.lifetimeMs) || !(0, access_state_js_1.positiveInteger)(value.maxHops))
        return null;
    return { lifetimeMs: value.lifetimeMs, maxHops: value.maxHops };
}
function canonicalHostname(value) {
    return typeof value === "string" && (0, target_js_1.normalizeHostname)(value) === value;
}
function isEndReason(value) {
    return value === "RETURNED" || value === "EXPIRED" || value === "CANCELLED"
        || value === "CONTEXT_CLOSED" || value === "POLICY_CHANGED" || value === "INVALID_POLICY"
        || value === "ROOT_NOT_WHITELISTED" || value === "HOP_LIMIT" || value === "REACHED"
        || value === "UNRELATED_NAVIGATION" || value === "DESTINATION_CHANGED";
}
function readJourneyContinuation(value) {
    if (!hasJourneyFields(value, ["kind", "sourceHostname"]) || !canonicalHostname(value.sourceHostname)
        || !["HTTP_REDIRECT", "SAME_HOST", "RETAINED", "ARRIVAL", "ROOT_DEPARTURE", "FORM_POST"].includes(value.kind))
        return null;
    return { kind: value.kind, sourceHostname: value.sourceHostname };
}
function continuesJourney(journey, target, evidence) {
    if (journey.phase === "ENDED" || evidence === undefined || evidence.sourceHostname !== journey.currentHostname)
        return false;
    if (evidence.kind === "ROOT_DEPARTURE") {
        return journey.phase === "STARTED" && journey.currentHostname === journey.rootHostname
            && target !== journey.rootHostname;
    }
    // A trusted host attests a POST from the currently loaded intermediate.
    // This continues an existing attempt; it cannot establish a new root departure.
    if (evidence.kind === "FORM_POST")
        return journey.phase === "IN_TRANSIT";
    return evidence.kind === "HTTP_REDIRECT" || target === journey.currentHostname
        || evidence.kind === "ARRIVAL" && target === journey.rootHostname;
}
function readJourney(value) {
    if (!hasJourneyFields(value, [
        "id", "contextId", "rootHostname", "currentHostname", "startedAt", "expiresAt",
        "hopCount", "maxHops", "policyRevision", "phase", "endedAt", "endReason",
    ]))
        return null;
    if (!(0, access_state_js_1.positiveInteger)(value.id) || !validContextId(value.contextId)
        || !canonicalHostname(value.rootHostname) || !canonicalHostname(value.currentHostname)
        || !(0, access_state_js_1.nonnegativeInteger)(value.startedAt) || !(0, access_state_js_1.nonnegativeInteger)(value.expiresAt)
        || value.expiresAt <= value.startedAt || !(0, access_state_js_1.nonnegativeInteger)(value.hopCount)
        || !(0, access_state_js_1.positiveInteger)(value.maxHops) || value.hopCount > value.maxHops
        || !(0, access_state_js_1.nonnegativeInteger)(value.policyRevision))
        return null;
    const details = {
        id: value.id, contextId: value.contextId,
        rootHostname: value.rootHostname, currentHostname: value.currentHostname,
        startedAt: value.startedAt, expiresAt: value.expiresAt,
        hopCount: value.hopCount, maxHops: value.maxHops, policyRevision: value.policyRevision,
    };
    const atRoot = value.currentHostname === value.rootHostname;
    if (value.phase === "STARTED" || value.phase === "IN_TRANSIT") {
        if (value.endedAt !== null || value.endReason !== null)
            return null;
        if (value.phase === "STARTED" ? !atRoot || value.hopCount !== 0 : atRoot || value.hopCount === 0) {
            return null;
        }
        return { ...details, phase: value.phase, endedAt: null, endReason: null };
    }
    if (value.phase !== "ENDED" || !(0, access_state_js_1.nonnegativeInteger)(value.endedAt)
        || value.endedAt < value.startedAt || !isEndReason(value.endReason))
        return null;
    if (value.endReason === "RETURNED") {
        if (!atRoot || value.hopCount === 0 || value.endedAt >= value.expiresAt)
            return null;
    }
    else if (value.endReason === "REACHED") {
        if (!atRoot || value.hopCount !== 0 || value.endedAt >= value.expiresAt)
            return null;
    }
    else if (atRoot ? value.hopCount !== 0 : value.hopCount === 0)
        return null;
    if (value.endReason === "DESTINATION_CHANGED"
        && (atRoot || value.endedAt >= value.expiresAt))
        return null;
    if (value.endReason === "EXPIRED" && value.endedAt < value.expiresAt)
        return null;
    if (value.endReason === "HOP_LIMIT" && value.hopCount !== value.maxHops)
        return null;
    return { ...details, phase: "ENDED", endedAt: value.endedAt, endReason: value.endReason };
}
function readJourneyState(value) {
    if (!hasJourneyFields(value, ["journeys", "nextJourneyId", "lastObservedAt", "policyRevision"])
        || !Array.isArray(value.journeys) || !(0, access_state_js_1.positiveInteger)(value.nextJourneyId)
        || !(0, access_state_js_1.nonnegativeInteger)(value.lastObservedAt) || !(0, access_state_js_1.nonnegativeInteger)(value.policyRevision))
        return null;
    const journeys = [];
    const ids = new Set();
    const contexts = new Set();
    for (const entry of value.journeys) {
        const journey = readJourney(entry);
        if (journey === null || ids.has(journey.id) || contexts.has(journey.contextId)
            || journey.id >= value.nextJourneyId || journey.startedAt > value.lastObservedAt
            || journey.policyRevision > value.policyRevision)
            return null;
        if (journey.phase === "ENDED") {
            if (journey.endedAt > value.lastObservedAt)
                return null;
        }
        else if (journey.expiresAt <= value.lastObservedAt || journey.policyRevision !== value.policyRevision) {
            return null;
        }
        ids.add(journey.id);
        contexts.add(journey.contextId);
        journeys.push(journey);
    }
    return { journeys, nextJourneyId: value.nextJourneyId,
        lastObservedAt: value.lastObservedAt, policyRevision: value.policyRevision };
}
function finishJourney(journey, endReason, now) {
    return journey.phase === "ENDED" ? journey : { ...journey, phase: "ENDED", endedAt: now, endReason };
}
function replaceJourney(state, journey) {
    return freezeJourneyState({
        ...state, journeys: state.journeys.map((entry) => entry.id === journey.id ? journey : entry),
    });
}
function prepareJourneyContext(input) {
    const invalid = (reason) => ({ ok: false, reason, nextState: null });
    if (!hasJourneyFields(input, ["policy", "policyRevision", "state", "now"]))
        return invalid("INVALID_STATE");
    const state = readJourneyState(input.state);
    if (state === null)
        return invalid("INVALID_STATE");
    if (!(0, access_state_js_1.nonnegativeInteger)(input.now))
        return invalid("INVALID_TIME");
    if (!(0, access_state_js_1.nonnegativeInteger)(input.policyRevision))
        return invalid("INVALID_POLICY_REVISION");
    if (input.now < state.lastObservedAt)
        return invalid("CLOCK_ROLLBACK");
    if (input.policyRevision < state.policyRevision)
        return invalid("POLICY_ROLLBACK");
    const now = input.now;
    const policyRevision = input.policyRevision;
    const policy = (0, policy_js_1.normalizePolicy)(input.policy);
    const nextState = freezeJourneyState({
        ...state, lastObservedAt: now, policyRevision,
        journeys: state.journeys.map((journey) => {
            if (journey.phase === "ENDED")
                return journey;
            if (policy === null)
                return finishJourney(journey, "INVALID_POLICY", now);
            if (journey.policyRevision !== policyRevision)
                return finishJourney(journey, "POLICY_CHANGED", now);
            if ((0, evaluate_js_1.evaluate)(journey.rootHostname, policy).outcome !== "ALLOW") {
                return finishJourney(journey, "ROOT_NOT_WHITELISTED", now);
            }
            return now >= journey.expiresAt ? finishJourney(journey, "EXPIRED", now) : journey;
        }),
    });
    if (policy === null)
        return { ok: false, reason: "INVALID_POLICY", nextState };
    return { ok: true, value: { policy, policyRevision, state: nextState, now } };
}
