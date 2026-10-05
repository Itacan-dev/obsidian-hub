"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAtlasSnapshot = validateAtlasSnapshot;
exports.migrateAtlasSnapshotV1 = migrateAtlasSnapshotV1;
const access_state_js_1 = require("./access-state.js");
const journey_state_js_1 = require("./journey-state.js");
const policy_js_1 = require("./policy.js");
const vault_state_js_1 = require("./vault-state.js");
const configuration_js_1 = require("./configuration.js");
/** Validate and copy without observing time, ending Journeys, or initializing missing state. */
function validateAtlasSnapshot(input) {
    const invalid = (reason, component) => ({ ok: false, reason, component });
    if (!(0, journey_state_js_1.hasJourneyFields)(input, ["policy", "policyRevision", "configuration", "configurationRevision", "accessState", "vaultState", "journeyState"])) {
        return invalid("INVALID_SNAPSHOT", "snapshot");
    }
    const policy = (0, policy_js_1.normalizePolicy)(input.policy);
    if (policy === null)
        return invalid("INVALID_POLICY", "policy");
    if (!(0, access_state_js_1.nonnegativeInteger)(input.policyRevision))
        return invalid("INVALID_POLICY_REVISION", "policyRevision");
    const configuration = (0, configuration_js_1.readConfiguration)(input.configuration);
    if (configuration === null || !(0, access_state_js_1.nonnegativeInteger)(input.configurationRevision))
        return invalid('INVALID_CONFIGURATION', 'configuration');
    const accessState = (0, access_state_js_1.readAccessState)(input.accessState);
    if (accessState === null)
        return invalid("INVALID_ACCESS_STATE", "accessState");
    const vaultState = (0, vault_state_js_1.readVaultState)(input.vaultState);
    if (vaultState === null)
        return invalid("INVALID_VAULT_STATE", "vaultState");
    const journeyState = (0, journey_state_js_1.readJourneyState)(input.journeyState);
    if (journeyState === null)
        return invalid("INVALID_JOURNEY_STATE", "journeyState");
    for (const [component, state] of [
        ["accessState", accessState], ["vaultState", vaultState], ["journeyState", journeyState],
    ]) {
        if (state.policyRevision > input.policyRevision)
            return invalid("POLICY_ROLLBACK", component);
    }
    const proposal = vaultState.pendingProposal;
    if ((proposal !== null && proposal.candidateConfiguration === undefined)
        || (vaultState.lastApplied !== null && vaultState.lastApplied.configurationRevision === undefined))
        return invalid('INVALID_VAULT_STATE', 'vaultState');
    if ((proposal?.baseConfigurationRevision ?? 0) > input.configurationRevision
        || (vaultState.lastApplied?.configurationRevision ?? 0) > input.configurationRevision)
        return invalid('CONFIGURATION_ROLLBACK', 'configurationRevision');
    // Preserve Vault's rejection of a contradictory current proposal without rewriting its contents.
    const canonical = (0, vault_state_js_1.canonicalPolicy)(policy);
    if (proposal !== null && proposal.basePolicyRevision === input.policyRevision
        && proposal.baseConfigurationRevision === input.configurationRevision
        && (0, vault_state_js_1.samePolicy)(proposal.candidatePolicy, canonical)
        && (0, configuration_js_1.sameConfiguration)(proposal.candidateConfiguration, configuration)) {
        return invalid("INVALID_VAULT_STATE", "vaultState");
    }
    return (0, vault_state_js_1.freezeVaultData)({
        ok: true,
        snapshot: { policy, policyRevision: input.policyRevision, configuration, configurationRevision: input.configurationRevision, accessState, vaultState, journeyState },
    });
}
/** Explicit v1 migration only. Validate legacy shape before freezing the existing deployment settings. */
function migrateAtlasSnapshotV1(input, configurationInput) {
    const invalid = () => ({ ok: false, reason: 'INVALID_SNAPSHOT', component: 'snapshot' });
    const configuration = (0, configuration_js_1.readConfiguration)(configurationInput);
    if (configuration === null || !(0, journey_state_js_1.hasJourneyFields)(input, ['policy', 'policyRevision', 'accessState', 'vaultState', 'journeyState']))
        return invalid();
    const vault = (0, vault_state_js_1.readVaultState)(input.vaultState);
    if (vault === null || vault.pendingProposal?.candidateConfiguration !== undefined
        || vault.lastApplied?.configurationRevision !== undefined)
        return invalid();
    const policy = (0, vault_state_js_1.canonicalPolicy)(input.policy);
    if (policy === null || (vault.pendingProposal !== null && vault.pendingProposal.basePolicyRevision === input.policyRevision
        && (0, vault_state_js_1.samePolicy)(vault.pendingProposal.candidatePolicy, policy)))
        return invalid();
    return validateAtlasSnapshot({ ...input, configuration, configurationRevision: 0, vaultState: {
            ...vault, pendingProposal: vault.pendingProposal === null ? null : { ...vault.pendingProposal,
                candidateConfiguration: configuration, baseConfigurationRevision: 0 },
            lastApplied: vault.lastApplied === null ? null : { ...vault.lastApplied, configurationRevision: 0 },
        } });
}
