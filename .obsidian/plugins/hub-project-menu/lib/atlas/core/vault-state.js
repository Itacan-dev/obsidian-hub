"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readVaultTiming = void 0;
exports.freezeVaultData = freezeVaultData;
exports.canonicalPolicy = canonicalPolicy;
exports.samePolicy = samePolicy;
exports.createVaultState = createVaultState;
exports.readVaultState = readVaultState;
exports.prepareVaultContext = prepareVaultContext;
const access_state_js_1 = require("./access-state.js");
const policy_js_1 = require("./policy.js");
const configuration_js_1 = require("./configuration.js");
var configuration_js_2 = require("./configuration.js");
Object.defineProperty(exports, "readVaultTiming", { enumerable: true, get: function () { return configuration_js_2.readVaultTiming; } });
function hasFields(value, fields) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        && Object.keys(value).length === fields.length
        && fields.every((field) => Object.hasOwn(value, field));
}
/** Only use on newly owned, acyclic domain data; never freeze caller-owned inputs. */
function freezeVaultData(value) {
    if (value !== null && typeof value === "object") {
        for (const child of Object.values(value))
            freezeVaultData(child);
        Object.freeze(value);
    }
    return value;
}
function canonicalPolicy(value) {
    const policy = (0, policy_js_1.normalizePolicy)(value);
    if (policy === null)
        return null;
    return {
        whitelist: [...new Set(policy.whitelist)].sort(),
        blacklist: [...new Set(policy.blacklist)].sort(),
    };
}
function sameEntries(left, right) {
    return left.length === right.length && left.every((host, index) => host === right[index]);
}
/** Both arguments have already been canonicalized. */
function samePolicy(left, right) {
    return sameEntries(left.whitelist, right.whitelist) && sameEntries(left.blacklist, right.blacklist);
}
/** Explicit initialization only; never a fallback for damaged existing state. */
function createVaultState() {
    return freezeVaultData({
        pendingProposal: null, nextProposalId: 1, lastObservedAt: 0,
        policyRevision: 0, lastApplied: null,
    });
}
function readProposal(value) {
    const protectedFields = value !== null && typeof value === 'object' && Object.hasOwn(value, 'candidateConfiguration');
    if (!hasFields(value, [
        "id", "basePolicyRevision", "candidatePolicy", "createdAt", "readyAt", "confirmBy",
        ...(protectedFields ? ['candidateConfiguration', 'baseConfigurationRevision'] : []),
    ]))
        return null;
    const candidateConfiguration = protectedFields ? (0, configuration_js_1.readConfiguration)(value.candidateConfiguration) : undefined;
    if (candidateConfiguration === null || (protectedFields && !(0, access_state_js_1.nonnegativeInteger)(value.baseConfigurationRevision)))
        return null;
    if (!(0, access_state_js_1.positiveInteger)(value.id) || !(0, access_state_js_1.nonnegativeInteger)(value.basePolicyRevision)
        || !(0, access_state_js_1.nonnegativeInteger)(value.createdAt) || !(0, access_state_js_1.nonnegativeInteger)(value.readyAt)
        || !(0, access_state_js_1.nonnegativeInteger)(value.confirmBy)
        || value.readyAt <= value.createdAt || value.confirmBy <= value.readyAt)
        return null;
    const candidatePolicy = canonicalPolicy(value.candidatePolicy);
    // Stored proposals must already be canonical; validation must not repair reviewed contents.
    if (candidatePolicy === null || !hasFields(value.candidatePolicy, ["whitelist", "blacklist"])
        || !Array.isArray(value.candidatePolicy.whitelist) || !Array.isArray(value.candidatePolicy.blacklist)
        || !sameEntries(value.candidatePolicy.whitelist, candidatePolicy.whitelist)
        || !sameEntries(value.candidatePolicy.blacklist, candidatePolicy.blacklist))
        return null;
    return {
        id: value.id, basePolicyRevision: value.basePolicyRevision, candidatePolicy,
        ...(candidateConfiguration === undefined ? {} : { candidateConfiguration, baseConfigurationRevision: value.baseConfigurationRevision }),
        createdAt: value.createdAt, readyAt: value.readyAt, confirmBy: value.confirmBy,
    };
}
function readApplied(value) {
    const protectedFields = value !== null && typeof value === 'object' && Object.hasOwn(value, 'configurationRevision');
    if (!hasFields(value, ['proposalId', 'policyRevision', ...(protectedFields ? ['configurationRevision'] : [])])
        || !(0, access_state_js_1.positiveInteger)(value.proposalId) || !(0, access_state_js_1.nonnegativeInteger)(value.policyRevision)
        || (protectedFields ? !(0, access_state_js_1.nonnegativeInteger)(value.configurationRevision)
            || (value.policyRevision === 0 && value.configurationRevision === 0) : value.policyRevision === 0))
        return null;
    return { proposalId: value.proposalId, policyRevision: value.policyRevision,
        ...(protectedFields ? { configurationRevision: value.configurationRevision } : {}) };
}
function readVaultState(value) {
    if (!hasFields(value, [
        "pendingProposal", "nextProposalId", "lastObservedAt", "policyRevision", "lastApplied",
    ]) || !(0, access_state_js_1.positiveInteger)(value.nextProposalId) || !(0, access_state_js_1.nonnegativeInteger)(value.lastObservedAt)
        || !(0, access_state_js_1.nonnegativeInteger)(value.policyRevision))
        return null;
    const pendingProposal = value.pendingProposal === null ? null : readProposal(value.pendingProposal);
    const lastApplied = value.lastApplied === null ? null : readApplied(value.lastApplied);
    if ((value.pendingProposal !== null && pendingProposal === null)
        || (value.lastApplied !== null && lastApplied === null))
        return null;
    if (pendingProposal !== null && (pendingProposal.id >= value.nextProposalId
        || pendingProposal.createdAt > value.lastObservedAt
        || pendingProposal.basePolicyRevision > value.policyRevision))
        return null;
    if (lastApplied !== null && (lastApplied.proposalId >= value.nextProposalId
        || lastApplied.policyRevision > value.policyRevision))
        return null;
    if (pendingProposal !== null && lastApplied !== null
        && (pendingProposal.id <= lastApplied.proposalId
            || pendingProposal.basePolicyRevision < lastApplied.policyRevision
            || (pendingProposal.baseConfigurationRevision !== undefined && lastApplied.configurationRevision !== undefined
                && pendingProposal.baseConfigurationRevision < lastApplied.configurationRevision)))
        return null;
    return {
        pendingProposal, nextProposalId: value.nextProposalId, lastObservedAt: value.lastObservedAt,
        policyRevision: value.policyRevision, lastApplied,
    };
}
/** Validate and copy the complete latest snapshot before computing any change. */
function prepareVaultContext(input) {
    const protectedFields = input !== null && typeof input === 'object' && Object.hasOwn(input, 'configuration');
    if (!hasFields(input, ["policy", "policyRevision", "state", "accessState", "now",
        ...(protectedFields ? ['configuration', 'configurationRevision'] : [])])) {
        return { ok: false, reason: "INVALID_STATE" };
    }
    const configuration = protectedFields ? (0, configuration_js_1.readConfiguration)(input.configuration) : undefined;
    if (configuration === null || (protectedFields && !(0, access_state_js_1.nonnegativeInteger)(input.configurationRevision)))
        return { ok: false, reason: 'INVALID_CONFIGURATION' };
    const policy = canonicalPolicy(input.policy);
    if (policy === null)
        return { ok: false, reason: "INVALID_POLICY" };
    if (!(0, access_state_js_1.nonnegativeInteger)(input.policyRevision))
        return { ok: false, reason: "INVALID_POLICY_REVISION" };
    const state = readVaultState(input.state);
    if (state === null)
        return { ok: false, reason: "INVALID_STATE" };
    const proposal = state.pendingProposal;
    if (protectedFields) {
        if ((proposal !== null && proposal.candidateConfiguration === undefined)
            || (state.lastApplied !== null && state.lastApplied.configurationRevision === undefined))
            return { ok: false, reason: 'INVALID_STATE' };
        if ((proposal?.baseConfigurationRevision ?? 0) > input.configurationRevision
            || (state.lastApplied?.configurationRevision ?? 0) > input.configurationRevision)
            return { ok: false, reason: 'CONFIGURATION_ROLLBACK' };
    }
    else if (proposal?.candidateConfiguration !== undefined || state.lastApplied?.configurationRevision !== undefined)
        return { ok: false, reason: 'INVALID_STATE' };
    if (!(0, access_state_js_1.nonnegativeInteger)(input.now))
        return { ok: false, reason: "INVALID_TIME" };
    if (input.now < state.lastObservedAt)
        return { ok: false, reason: "CLOCK_ROLLBACK" };
    if (input.policyRevision < state.policyRevision)
        return { ok: false, reason: "POLICY_ROLLBACK" };
    const access = (0, access_state_js_1.prepareContext)({
        policy, policyRevision: input.policyRevision, state: input.accessState, now: input.now,
    });
    if (!access.ok) {
        return { ok: false, reason: access.reason === "INVALID_STATE" ? "INVALID_ACCESS_STATE" : access.reason };
    }
    if (state.pendingProposal !== null && state.pendingProposal.basePolicyRevision === input.policyRevision
        && samePolicy(state.pendingProposal.candidatePolicy, policy)
        && (configuration === undefined || (state.pendingProposal.baseConfigurationRevision === input.configurationRevision
            && (0, configuration_js_1.sameConfiguration)(state.pendingProposal.candidateConfiguration, configuration)))) {
        return { ok: false, reason: "INVALID_STATE" };
    }
    return {
        ok: true,
        value: {
            policy, policyRevision: input.policyRevision, now: input.now, accessState: access.value.state,
            ...(configuration === undefined ? {} : { configuration, configurationRevision: input.configurationRevision }),
            state: { ...state, lastObservedAt: input.now, policyRevision: input.policyRevision },
        },
    };
}
