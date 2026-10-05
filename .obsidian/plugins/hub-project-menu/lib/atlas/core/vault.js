"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPolicyProposal = createPolicyProposal;
exports.createSettingsProposal = createSettingsProposal;
exports.reviewPolicyProposal = reviewPolicyProposal;
exports.prepareVaultCommit = prepareVaultCommit;
exports.cancelPolicyProposal = cancelPolicyProposal;
const access_state_js_1 = require("./access-state.js");
const evaluate_js_1 = require("./evaluate.js");
const vault_state_js_1 = require("./vault-state.js");
const configuration_js_1 = require("./configuration.js");
function reject(reason, nextState) {
    return (0, vault_state_js_1.freezeVaultData)({ ok: false, reason, nextState });
}
/** Freeze one complete proposed policy without changing active policy or access. */
function createProposal(candidateInput, configurationInput, input, timingInput) {
    const prepared = (0, vault_state_js_1.prepareVaultContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    const { policy, policyRevision, state, now, configuration, configurationRevision } = prepared.value;
    if (state.pendingProposal !== null)
        return reject("PROPOSAL_PENDING", state);
    const candidatePolicy = (0, vault_state_js_1.canonicalPolicy)(candidateInput);
    if (candidatePolicy === null)
        return reject("INVALID_CANDIDATE_POLICY", state);
    const candidateConfiguration = configuration === undefined ? undefined
        : (0, configuration_js_1.readConfiguration)(configurationInput === undefined ? configuration : configurationInput);
    if (candidateConfiguration === null || (configuration === undefined && configurationInput !== undefined))
        return reject('INVALID_CONFIGURATION', state);
    if ((0, vault_state_js_1.samePolicy)(candidatePolicy, policy) && (configuration === undefined
        || (0, configuration_js_1.sameConfiguration)(candidateConfiguration, configuration)))
        return reject("NO_POLICY_CHANGE", state);
    // Active protection governs its own replacement. Candidate terms never control this delay.
    const timing = (0, vault_state_js_1.readVaultTiming)(configuration?.vaultTiming ?? timingInput);
    if (timing === null)
        return reject("INVALID_TIMING", state);
    if (!(0, access_state_js_1.positiveInteger)(state.nextProposalId + 1))
        return reject("ID_EXHAUSTED", state);
    const readyAt = now + timing.waitMs;
    const confirmBy = readyAt + timing.confirmationWindowMs;
    if (!(0, access_state_js_1.nonnegativeInteger)(readyAt) || !(0, access_state_js_1.nonnegativeInteger)(confirmBy))
        return reject("TIME_OVERFLOW", state);
    const proposal = {
        id: state.nextProposalId, basePolicyRevision: policyRevision, candidatePolicy,
        createdAt: now, readyAt, confirmBy,
        ...(candidateConfiguration === undefined ? {} : { candidateConfiguration, baseConfigurationRevision: configurationRevision }),
    };
    return (0, vault_state_js_1.freezeVaultData)({
        ok: true, type: "PROPOSED", proposal,
        nextState: { ...state, pendingProposal: proposal, nextProposalId: state.nextProposalId + 1 },
    });
}
function createPolicyProposal(candidateInput, input, timingInput) {
    return createProposal(candidateInput, undefined, input, timingInput);
}
/** Settings share the same pending slot, freeze, review, confirmation and consumption. */
function createSettingsProposal(candidateInput, input) {
    const prepared = (0, vault_state_js_1.prepareVaultContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    if (prepared.value.configuration === undefined)
        return reject('INVALID_CONFIGURATION', prepared.value.state);
    return createProposal(prepared.value.policy, candidateInput, input, undefined);
}
function findProposal(proposalId, context) {
    if (!(0, access_state_js_1.positiveInteger)(proposalId))
        return "INVALID_PROPOSAL_ID";
    if (context.state.lastApplied?.proposalId === proposalId)
        return "ALREADY_COMMITTED";
    const proposal = context.state.pendingProposal;
    if (proposal === null || proposal.id !== proposalId)
        return "PROPOSAL_NOT_FOUND";
    return proposal;
}
function listChanges(before, after) {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    return {
        added: after.filter((host) => !beforeSet.has(host)),
        removed: before.filter((host) => !afterSet.has(host)),
    };
}
function classification(hostname, policy) {
    const decision = (0, evaluate_js_1.evaluate)(hostname, policy);
    return decision.outcome === "ALLOW" ? "WHITELIST"
        : decision.outcome === "DENY" ? "BLACKLIST" : "GREYLIST";
}
/** A read-only view of the frozen proposal, including actual Blacklist precedence. */
function reviewPolicyProposal(proposalId, input) {
    const prepared = (0, vault_state_js_1.prepareVaultContext)(input);
    if (!prepared.ok)
        return { ok: false, reason: prepared.reason };
    const { policy, policyRevision, now, configuration, configurationRevision } = prepared.value;
    const proposal = findProposal(proposalId, prepared.value);
    if (typeof proposal === "string")
        return { ok: false, reason: proposal };
    if (proposal.basePolicyRevision !== policyRevision)
        return { ok: false, reason: "POLICY_CHANGED" };
    if (configuration !== undefined && proposal.baseConfigurationRevision !== configurationRevision)
        return { ok: false, reason: 'CONFIGURATION_CHANGED' };
    const candidate = proposal.candidatePolicy;
    const hosts = [...new Set([
            ...policy.whitelist, ...policy.blacklist, ...candidate.whitelist, ...candidate.blacklist,
        ])].sort();
    const classifications = [];
    for (const hostname of hosts) {
        const before = classification(hostname, policy);
        const after = classification(hostname, candidate);
        if (before !== after)
            classifications.push({ hostname, before, after });
    }
    return (0, vault_state_js_1.freezeVaultData)({
        ok: true,
        review: {
            proposalId: proposal.id, basePolicyRevision: proposal.basePolicyRevision,
            candidatePolicy: candidate, createdAt: proposal.createdAt,
            readyAt: proposal.readyAt, confirmBy: proposal.confirmBy,
            phase: now >= proposal.confirmBy ? "EXPIRED" : now < proposal.readyAt ? "WAITING" : "READY",
            whitelist: listChanges(policy.whitelist, candidate.whitelist),
            blacklist: listChanges(policy.blacklist, candidate.blacklist),
            classifications, invalidatesAccess: !(0, vault_state_js_1.samePolicy)(candidate, policy),
            ...(configuration === undefined ? {} : { currentConfiguration: configuration,
                candidateConfiguration: proposal.candidateConfiguration, baseConfigurationRevision: proposal.baseConfigurationRevision }),
        },
    });
}
/** Explicit confirmation computes a complete candidate. It does not publish or save policy. */
function prepareVaultCommit(proposalId, input) {
    const prepared = (0, vault_state_js_1.prepareVaultContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    const { policy, policyRevision, state, accessState, now, configuration, configurationRevision } = prepared.value;
    const proposal = findProposal(proposalId, prepared.value);
    if (typeof proposal === "string")
        return reject(proposal, state);
    if (proposal.basePolicyRevision !== policyRevision)
        return reject("POLICY_CHANGED", state);
    if (configuration !== undefined && proposal.baseConfigurationRevision !== configurationRevision)
        return reject('CONFIGURATION_CHANGED', state);
    if (now >= proposal.confirmBy)
        return reject("PROPOSAL_EXPIRED", state);
    if (now < proposal.readyAt)
        return reject("NOT_READY", state);
    const nextRevision = policyRevision + ((0, vault_state_js_1.samePolicy)(policy, proposal.candidatePolicy) ? 0 : 1);
    const nextConfigurationRevision = configuration === undefined ? undefined : configurationRevision
        + ((0, configuration_js_1.sameConfiguration)(configuration, proposal.candidateConfiguration) ? 0 : 1);
    if (!(0, access_state_js_1.nonnegativeInteger)(nextRevision) || (nextConfigurationRevision !== undefined && !(0, access_state_js_1.nonnegativeInteger)(nextConfigurationRevision)))
        return reject("REVISION_EXHAUSTED", state);
    return (0, vault_state_js_1.freezeVaultData)({
        ok: true, type: "COMMIT_PREPARED", nextState: state,
        candidate: {
            proposalId: proposal.id, expectedPolicyRevision: policyRevision, preparedAt: now,
            nextSnapshot: {
                ...(configuration === undefined ? {} : { configuration: proposal.candidateConfiguration, configurationRevision: nextConfigurationRevision }),
                policy: proposal.candidatePolicy,
                policyRevision: nextRevision,
                vaultState: {
                    ...state, pendingProposal: null, policyRevision: nextRevision,
                    lastApplied: { proposalId: proposal.id, policyRevision: nextRevision,
                        ...(configuration === undefined ? {} : { configurationRevision: nextConfigurationRevision }) },
                },
                accessState: { ...accessState, policyRevision: nextRevision },
            },
        },
    });
}
/** Consume a pending proposal, including expired/stale ones, without changing policy. */
function cancelPolicyProposal(proposalId, input) {
    const prepared = (0, vault_state_js_1.prepareVaultContext)(input);
    if (!prepared.ok)
        return reject(prepared.reason, null);
    const { state } = prepared.value;
    const proposal = findProposal(proposalId, prepared.value);
    if (typeof proposal === "string")
        return reject(proposal, state);
    return (0, vault_state_js_1.freezeVaultData)({
        ok: true, type: "CANCELLED", proposalId: proposal.id,
        nextState: { ...state, pendingProposal: null },
    });
}
