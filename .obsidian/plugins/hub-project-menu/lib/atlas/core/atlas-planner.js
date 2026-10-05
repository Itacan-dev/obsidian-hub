"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readConfiguration = void 0;
exports.planAtlasOperation = planAtlasOperation;
const access_js_1 = require("./access.js");
const access_state_js_1 = require("./access-state.js");
const atlas_state_js_1 = require("./atlas-state.js");
const journey_js_1 = require("./journey.js");
const journey_state_js_1 = require("./journey-state.js");
const policy_js_1 = require("./policy.js");
const target_js_1 = require("./target.js");
const managed_blacklist_js_1 = require("./managed-blacklist.js");
const vault_js_1 = require("./vault.js");
const vault_state_js_1 = require("./vault-state.js");
const configuration_js_1 = require("./configuration.js");
var configuration_js_2 = require("./configuration.js");
Object.defineProperty(exports, "readConfiguration", { enumerable: true, get: function () { return configuration_js_2.readConfiguration; } });
function makePlan(result, observationSnapshot = null, candidateSnapshot = null) {
    // Only copied/validated data or module-owned results reach this helper.
    return (0, vault_state_js_1.freezeVaultData)({ result, observationSnapshot, candidateSnapshot });
}
function reject(reason, observation = null) {
    return makePlan({ type: "REJECTED", reason }, observation);
}
function readTarget(input) {
    return (0, journey_state_js_1.hasJourneyFields)(input, ["hostname"]) ? (0, target_js_1.normalizeTarget)(input) : null;
}
/** Closed command shapes prevent smuggling replacement state/terms into confirmation. */
function readOperation(value) {
    const invalid = (reason = "INVALID_OPERATION") => ({ ok: false, reason });
    const valid = (operation) => ({ ok: true, operation });
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return invalid();
    const input = value;
    const kind = input.kind;
    switch (kind) {
        case "BEGIN_NAVIGATION":
        case "CHECK_NAVIGATION":
        case "RECORD_JOURNEY_NAVIGATION": {
            const fields = ["contextId", "journeyId"];
            if (input.context !== null && typeof input.context === "object" && Object.hasOwn(input.context, "continuation"))
                fields.push("continuation");
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "target", "context"])
                || !(0, journey_state_js_1.hasJourneyFields)(input.context, fields))
                return invalid();
            const target = readTarget(input.target);
            if (target === null)
                return invalid("INVALID_TARGET");
            const { contextId, journeyId } = input.context;
            if (!(0, journey_state_js_1.validContextId)(contextId))
                return invalid("INVALID_CONTEXT_ID");
            if (journeyId !== null && !(0, access_state_js_1.positiveInteger)(journeyId))
                return invalid("INVALID_JOURNEY_ID");
            const continuation = Object.hasOwn(input.context, "continuation") ? (0, journey_state_js_1.readJourneyContinuation)(input.context.continuation) : undefined;
            if (continuation === null)
                return invalid("INVALID_NAVIGATION");
            return valid({ kind, target, context: { contextId, journeyId, ...(continuation === undefined ? {} : { continuation }) } });
        }
        case "START_ACCESS": {
            const scoped = Object.hasOwn(input, "scopeHostnames");
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "target", ...(scoped ? ["scopeHostnames"] : [])]))
                return invalid();
            const target = readTarget(input.target);
            if (target === null)
                return invalid("INVALID_TARGET");
            const scopeHostnames = scoped ? (0, access_state_js_1.readAccessScope)(input.scopeHostnames, target.hostname) : undefined;
            return scopeHostnames === null ? invalid("INVALID_SCOPE") : valid({ kind, target,
                ...(scopeHostnames === undefined ? {} : { scopeHostnames }) });
        }
        case "CONFIRM_ACCESS":
        case "CANCEL_ACCESS":
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "requestId"]))
                return invalid();
            return (0, access_state_js_1.positiveInteger)(input.requestId) ? valid({ kind, requestId: input.requestId })
                : invalid("INVALID_REQUEST_ID");
        case "PROPOSE_POLICY": {
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "candidatePolicy"]))
                return invalid();
            const candidatePolicy = (0, policy_js_1.normalizePolicy)(input.candidatePolicy);
            return candidatePolicy === null ? invalid("INVALID_CANDIDATE_POLICY") : valid({ kind, candidatePolicy });
        }
        case "PROPOSE_SETTINGS": {
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ['kind', 'candidateConfiguration']))
                return invalid();
            const candidateConfiguration = (0, configuration_js_1.readConfiguration)(input.candidateConfiguration);
            return candidateConfiguration === null ? invalid('INVALID_CONFIGURATION') : valid({ kind, candidateConfiguration });
        }
        case "REVIEW_POLICY":
        case "CONFIRM_POLICY":
        case "CANCEL_POLICY":
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "proposalId"]))
                return invalid();
            return (0, access_state_js_1.positiveInteger)(input.proposalId) ? valid({ kind, proposalId: input.proposalId })
                : invalid("INVALID_PROPOSAL_ID");
        case "START_JOURNEY": {
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "root", "contextId"]))
                return invalid();
            if (!(0, journey_state_js_1.validContextId)(input.contextId))
                return invalid("INVALID_CONTEXT_ID");
            const root = readTarget(input.root);
            return root === null ? invalid("INVALID_TARGET") : valid({ kind, root, contextId: input.contextId });
        }
        case "CANCEL_JOURNEY":
        case "CLOSE_JOURNEY_CONTEXT":
            if (!(0, journey_state_js_1.hasJourneyFields)(input, ["kind", "journeyId", "contextId"]))
                return invalid();
            if (!(0, journey_state_js_1.validContextId)(input.contextId))
                return invalid("INVALID_CONTEXT_ID");
            return (0, access_state_js_1.positiveInteger)(input.journeyId)
                ? valid({ kind, journeyId: input.journeyId, contextId: input.contextId })
                : invalid("INVALID_JOURNEY_ID");
        case "OBSERVE_TIME":
            return (0, journey_state_js_1.hasJourneyFields)(input, ["kind"]) ? valid({ kind }) : invalid();
        default:
            return invalid();
    }
}
function accessContext(snapshot, now) {
    return { policy: snapshot.policy, policyRevision: snapshot.policyRevision, state: snapshot.accessState, now };
}
function journeyContext(snapshot, now) {
    return { policy: snapshot.policy, policyRevision: snapshot.policyRevision, state: snapshot.journeyState, now };
}
function vaultContext(snapshot, now) {
    return { policy: snapshot.policy, policyRevision: snapshot.policyRevision,
        state: snapshot.vaultState, accessState: snapshot.accessState, now,
        configuration: snapshot.configuration, configurationRevision: snapshot.configurationRevision };
}
function accessPlan(operation, transition, snapshot) {
    if (!transition.ok)
        return reject(transition.reason, snapshot);
    const id = "request" in transition ? transition.request.id
        : "grant" in transition ? transition.grant.requestId : transition.requestId;
    return makePlan({ type: "TRANSITION_PREPARED", operation, id }, snapshot, { ...snapshot, accessState: transition.nextState });
}
function journeyPlan(operation, transition, snapshot) {
    if (!transition.ok)
        return reject(transition.reason, snapshot);
    if (transition.type === "OBSERVED")
        return makePlan({ type: "OBSERVED" }, snapshot);
    return makePlan({ type: "TRANSITION_PREPARED", operation, id: transition.journey.id }, snapshot, { ...snapshot, journeyState: transition.nextState });
}
function checkBinding(context, snapshot) {
    if (context.journeyId === null) {
        return snapshot.journeyState.journeys.some((j) => j.contextId === context.contextId && j.phase !== "ENDED")
            ? "CONTEXT_MISMATCH" : null;
    }
    const journey = snapshot.journeyState.journeys.find((j) => j.id === context.journeyId);
    if (journey === undefined)
        return "JOURNEY_NOT_FOUND";
    return journey.contextId === context.contextId ? null : "CONTEXT_MISMATCH";
}
function navigationPlan(operation, snapshot, now, managed) {
    const bindingError = checkBinding(operation.context, snapshot);
    if (bindingError !== null)
        return reject(bindingError, snapshot);
    const access = (0, access_js_1.evaluateAccess)(operation.target, accessContext(snapshot, now));
    if (access.nextState === null)
        return reject("INVALID_ACCESS_STATE");
    let observation = { ...snapshot, accessState: access.nextState };
    const decision = access.decision;
    const managedDecision = managedDenies(snapshot, operation.target.hostname, managed)
        ? { outcome: "DENY", reason: "MANAGED_BLACKLISTED", target: operation.target } : null;
    const navigation = { ...operation.context, target: operation.target };
    if (operation.context.journeyId !== null) {
        const journey = (0, journey_js_1.evaluateJourneyNavigation)(navigation, journeyContext(observation, now));
        if (journey.nextState === null)
            return reject("INVALID_JOURNEY_STATE");
        observation = { ...observation, journeyState: journey.nextState };
        // Invalid Journey operations must never disappear behind another module's ALLOW.
        if (journey.decision.outcome === "DENY" && journey.decision.reason !== "BLACKLISTED") {
            return reject(journey.decision.reason, observation);
        }
        const combined = managedDecision ?? (access.decision.outcome === "DENY" || access.decision.outcome === "ALLOW"
            ? access.decision : journey.decision.outcome === "ALLOW" ? journey.decision : access.decision);
        if (operation.kind === "RECORD_JOURNEY_NAVIGATION" && combined.outcome === "ALLOW") {
            const recorded = (0, journey_js_1.recordJourneyNavigation)(navigation, journeyContext(observation, now));
            if (recorded.nextState === null)
                return reject("INVALID_JOURNEY_STATE");
            if (recorded.decision.outcome === "DENY") {
                return makePlan({ type: "ASSESSMENT", decision: recorded.decision }, observation);
            }
            // A spent Journey may coexist with an independently valid grant/Whitelist ALLOW.
            return makePlan({ type: "ASSESSMENT", decision: combined }, observation, { ...observation, journeyState: recorded.nextState });
        }
        return makePlan({ type: "ASSESSMENT", decision: combined }, observation);
    }
    // Recording requires a Journey; ordinary navigation needs only an assessment.
    if (operation.kind === "RECORD_JOURNEY_NAVIGATION")
        return reject("INVALID_JOURNEY_ID", observation);
    return makePlan({ type: "ASSESSMENT", decision: managedDecision ?? decision }, observation);
}
function beginNavigation(operation, snapshot, now, managed, configuration) {
    const bindingError = checkBinding(operation.context, snapshot);
    if (bindingError !== null)
        return reject(bindingError, snapshot);
    const current = snapshot.journeyState.journeys.find((j) => j.id === operation.context.journeyId);
    const access = (0, access_js_1.evaluateAccess)(operation.target, accessContext(snapshot, now));
    const departure = operation.context.continuation?.kind === "ROOT_DEPARTURE"
        ? operation.context.continuation : undefined;
    if (departure !== undefined) {
        // A trusted owner attests one departure from a physically loaded Whitelist root.
        // Target denial cannot create an attempt, and current policy validates its source.
        if (access.decision.outcome === "DENY" || managedDenies(snapshot, operation.target.hostname, managed)) {
            return navigationPlan(operation, snapshot, now, managed);
        }
        if ((0, access_js_1.evaluateAccess)({ hostname: departure.sourceHostname }, accessContext(snapshot, now)).decision.reason !== "WHITELISTED") {
            return reject("NOT_WHITELISTED", snapshot);
        }
        if (departure.sourceHostname === operation.target.hostname)
            return reject("INVALID_NAVIGATION", snapshot);
        if (access.decision.outcome === "ALLOW" && access.decision.reason === "WHITELISTED") {
            // Independently trusted destinations keep the ordinary requested-root contract.
            return beginNavigation({ ...operation, context: { contextId: operation.context.contextId,
                    journeyId: operation.context.journeyId } }, snapshot, now, managed, configuration);
        }
        if (current !== undefined && current.phase !== "ENDED") {
            // Only the first step of this attempt can use the departure fact. It cannot
            // replace or renew an active attempt, including one rooted elsewhere.
            return navigationPlan(operation, snapshot, now, managed);
        }
        const started = (0, journey_js_1.startJourney)({ hostname: departure.sourceHostname }, operation.context.contextId, journeyContext(snapshot, now), configuration.journeyLimits);
        if (!started.ok || started.type !== "STARTED")
            return reject(started.ok ? "INVALID_JOURNEY_STATE" : started.reason, snapshot);
        const candidate = { ...snapshot, journeyState: started.nextState };
        const plan = navigationPlan({ ...operation, context: { ...operation.context, journeyId: started.journey.id } }, candidate, now, managed);
        return makePlan(plan.result, snapshot, plan.observationSnapshot ?? candidate);
    }
    if (access.decision.outcome !== "ALLOW" || access.decision.reason !== "WHITELISTED") {
        return navigationPlan(operation, snapshot, now, managed);
    }
    if (current !== undefined && current.phase !== "ENDED") {
        if ((0, journey_state_js_1.continuesJourney)(current, operation.target.hostname, operation.context.continuation)
            || current.phase === "STARTED" && current.rootHostname === operation.target.hostname) {
            return navigationPlan(operation, snapshot, now, managed);
        }
        snapshot = { ...snapshot, journeyState: (0, journey_state_js_1.replaceJourney)(snapshot.journeyState, (0, journey_state_js_1.finishJourney)(current, "UNRELATED_NAVIGATION", now)) };
    }
    const started = (0, journey_js_1.startJourney)(operation.target, operation.context.contextId, journeyContext(snapshot, now), configuration.journeyLimits);
    if (!started.ok || started.type !== "STARTED")
        return reject(started.ok ? "INVALID_JOURNEY_STATE" : started.reason, snapshot);
    const candidate = { ...snapshot, journeyState: started.nextState };
    const plan = navigationPlan({ ...operation, context: { contextId: operation.context.contextId, journeyId: started.journey.id } }, candidate, now, managed);
    return makePlan(plan.result, snapshot, plan.observationSnapshot ?? candidate);
}
function managedDenies(snapshot, hostname, managed) {
    return managed !== undefined && !snapshot.policy.blacklist.includes(hostname)
        && !snapshot.policy.whitelist.includes(hostname) && (0, managed_blacklist_js_1.managedBlacklistContains)(managed, hostname) === true;
}
/** Pure composition only: no storage, clocks, browser events, or mutable owner state. */
function planAtlasOperation(operationInput, contextInput) {
    const fields = ["snapshot", "now", "configuration"];
    if (contextInput !== null && typeof contextInput === "object" && Object.hasOwn(contextInput, "managedBlacklist"))
        fields.push("managedBlacklist");
    if (!(0, journey_state_js_1.hasJourneyFields)(contextInput, fields))
        return reject("INVALID_CONTEXT");
    const validated = (0, atlas_state_js_1.validateAtlasSnapshot)(contextInput.snapshot);
    if (!validated.ok)
        return reject(validated.reason);
    const managed = Object.hasOwn(contextInput, "managedBlacklist") ? contextInput.managedBlacklist : undefined;
    if (Object.hasOwn(contextInput, "managedBlacklist") && !(0, managed_blacklist_js_1.isManagedBlacklist)(managed))
        return reject("INVALID_MANAGED_BLACKLIST");
    const managedList = managed;
    const snapshot = validated.snapshot;
    const now = contextInput.now;
    if (!(0, access_state_js_1.nonnegativeInteger)(now))
        return reject("INVALID_TIME");
    if ([snapshot.accessState, snapshot.vaultState, snapshot.journeyState].some((s) => now < s.lastObservedAt)) {
        return reject("CLOCK_ROLLBACK");
    }
    const configuration = snapshot.configuration;
    if ((0, configuration_js_1.readConfiguration)(contextInput.configuration) === null)
        return reject("INVALID_CONFIGURATION");
    const parsed = readOperation(operationInput);
    const journeys = (0, journey_js_1.observeJourneys)(journeyContext(snapshot, now));
    if (!journeys.ok)
        return reject(journeys.reason);
    const observation = {
        ...snapshot,
        accessState: { ...snapshot.accessState, lastObservedAt: now, policyRevision: snapshot.policyRevision },
        vaultState: { ...snapshot.vaultState, lastObservedAt: now, policyRevision: snapshot.policyRevision },
        journeyState: journeys.nextState,
    };
    if (!parsed.ok)
        return reject(parsed.reason, observation);
    const operation = parsed.operation;
    const pending = operation.kind === "CONFIRM_ACCESS" ? observation.accessState.pendingRequests.find((r) => r.id === operation.requestId) : undefined;
    const guardedHosts = operation.kind === "START_ACCESS" ? operation.scopeHostnames ?? [operation.target.hostname]
        : pending === undefined ? [] : (0, access_state_js_1.accessScope)(pending);
    if (guardedHosts.some((host) => managedDenies(observation, host, managedList)))
        return reject("MANAGED_BLACKLISTED", observation);
    switch (operation.kind) {
        case "BEGIN_NAVIGATION":
            return beginNavigation(operation, observation, now, managedList, configuration);
        case "CHECK_NAVIGATION":
        case "RECORD_JOURNEY_NAVIGATION":
            return navigationPlan(operation, observation, now, managedList);
        case "OBSERVE_TIME":
            return makePlan({ type: "OBSERVED" }, observation);
        case "START_ACCESS":
            return accessPlan(operation.kind, (0, access_js_1.startAccess)(operation.target, accessContext(observation, now), configuration.accessTiming, operation.scopeHostnames), observation);
        case "CONFIRM_ACCESS":
            return accessPlan(operation.kind, (0, access_js_1.confirmAccess)(operation.requestId, accessContext(observation, now)), observation);
        case "CANCEL_ACCESS":
            return accessPlan(operation.kind, (0, access_js_1.cancelAccess)(operation.requestId, accessContext(observation, now)), observation);
        case "START_JOURNEY":
            return journeyPlan(operation.kind, (0, journey_js_1.startJourney)(operation.root, operation.contextId, journeyContext(observation, now), configuration.journeyLimits), observation);
        case "CANCEL_JOURNEY":
        case "CLOSE_JOURNEY_CONTEXT": {
            const end = operation.kind === "CANCEL_JOURNEY" ? journey_js_1.cancelJourney : journey_js_1.closeJourneyContext;
            return journeyPlan(operation.kind, end(operation.journeyId, operation.contextId, journeyContext(observation, now)), observation);
        }
        case "PROPOSE_SETTINGS":
        case "PROPOSE_POLICY": {
            const proposed = operation.kind === 'PROPOSE_SETTINGS'
                ? (0, vault_js_1.createSettingsProposal)(operation.candidateConfiguration, vaultContext(observation, now))
                : (0, vault_js_1.createPolicyProposal)(operation.candidatePolicy, vaultContext(observation, now), configuration.vaultTiming);
            return proposed.ok ? makePlan({ type: "TRANSITION_PREPARED", operation: operation.kind, id: proposed.proposal.id }, observation, { ...observation, vaultState: proposed.nextState }) : reject(proposed.reason, observation);
        }
        case "CANCEL_POLICY": {
            const cancelled = (0, vault_js_1.cancelPolicyProposal)(operation.proposalId, vaultContext(observation, now));
            return cancelled.ok ? makePlan({ type: "TRANSITION_PREPARED", operation: operation.kind, id: cancelled.proposalId }, observation, { ...observation, vaultState: cancelled.nextState }) : reject(cancelled.reason, observation);
        }
        case "CONFIRM_POLICY": {
            const prepared = (0, vault_js_1.prepareVaultCommit)(operation.proposalId, vaultContext(observation, now));
            if (!prepared.ok)
                return reject(prepared.reason, observation);
            const next = { ...observation, ...prepared.candidate.nextSnapshot,
                policy: prepared.candidate.nextSnapshot.policyRevision === observation.policyRevision
                    ? observation.policy : prepared.candidate.nextSnapshot.policy };
            const invalidated = (0, journey_js_1.observeJourneys)(journeyContext(next, now));
            if (!invalidated.ok)
                return reject(invalidated.reason, observation);
            return makePlan({ type: "POLICY_COMMIT_PREPARED", proposalId: operation.proposalId,
                expectedPolicyRevision: prepared.candidate.expectedPolicyRevision }, observation, { ...next, journeyState: invalidated.nextState });
        }
        case "REVIEW_POLICY": {
            // Review uses original validated state and publishes no observation checkpoint.
            const reviewed = (0, vault_js_1.reviewPolicyProposal)(operation.proposalId, vaultContext(snapshot, now));
            return reviewed.ok ? makePlan({ type: "REVIEW", review: reviewed.review }) : reject(reviewed.reason);
        }
    }
}
