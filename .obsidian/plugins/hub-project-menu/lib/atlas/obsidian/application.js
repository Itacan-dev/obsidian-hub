"use strict";

// Application metadata only. Core continues to own every host classification.
const Core = require("../core/index");
const { sameConfiguration } = require("../core/configuration");
const { normalizePolicy } = require("../core/policy");
const { curatedWhitelist, serviceHostnames } = require("../presets/curated-whitelist");
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value, limit) => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= limit && !/[\x00-\x1f]/.test(value);
const host = value => typeof value === "string" && Core.normalizeTarget({ hostname: value })?.hostname === value;
const hosts = values => Array.isArray(values) && values.length <= 256 && values.every(host) && new Set(values).size === values.length;
const samePolicy = (a, b) => ["whitelist", "blacklist"].every(key =>
    JSON.stringify([...new Set(a[key])].sort()) === JSON.stringify([...new Set(b[key])].sort()));

function validateDestination(value) {
    if (!exact(value, ["id", "label", "category", "hostname", "aliases", "destinations", "pinned"]) ||
        !text(value.id, 256) || !text(value.label, 200) || !text(value.category, 100) || !host(value.hostname) ||
        !hosts(value.aliases) || !hosts(value.destinations) || typeof value.pinned !== "boolean") return null;
    const all = serviceHostnames(value);
    return new Set(all).size === all.length ? structuredClone(value) : null;
}
function validateDestinations(values) {
    if (!Array.isArray(values) || values.length > 2000) return null;
    const result = values.map(validateDestination);
    if (result.some(value => value === null) || new Set(result.map(value => value.id)).size !== result.length ||
        new Set(result.map(value => value.hostname)).size !== result.length) return null;
    return result;
}
function destinationsFromPolicy(policy) {
    const explicit = new Set([...policy.whitelist, ...policy.blacklist]), covered = new Set(), result = [];
    for (const group of curatedWhitelist) for (const service of group.services) {
        if (!explicit.has(service.hostname)) continue;
        const item = { id: `curated:${service.hostname}`, label: service.label, category: group.label,
            hostname: service.hostname, aliases: (service.aliases ?? []).filter(h => explicit.has(h)),
            destinations: (service.destinations ?? []).filter(h => explicit.has(h)),
            pinned: ["ChatGPT", "Gmail", "KTH Mail", "GitHub"].includes(service.label) };
        result.push(item); serviceHostnames(item).forEach(h => covered.add(h));
    }
    for (const hostname of explicit) if (!covered.has(hostname)) result.push({ id: `host:${hostname}`, label: hostname,
        category: "My destinations", hostname, aliases: [], destinations: [], pinned: false });
    return result;
}
function initialApplication(policy) {
    return { schemaVersion: 2, revision: 0, destinations: destinationsFromPolicy(policy), pending: null, recovery: null };
}
// IDs identify records, not mutable hostnames. Never reuse an occupied ID,
// including a curated seed ID retained by a user-edited primary hostname.
function unusedId(seed, destinations) {
    const occupied = new Set(destinations.map(d => d.id));
    let id = seed, suffix = 2;
    while (occupied.has(id)) id = seed + ":" + suffix++;
    return id;
}
const classification = (policy, hostname) => policy.blacklist.includes(hostname) ? "BLACKLIST" : policy.whitelist.includes(hostname) ? "WHITELIST" : "GREYLIST";
// Explicit curated import merges reviewed hosts into the existing service.
// User labels, categories, pins, custom services and manual Blacklist survive.
function mergeCuratedDestinations(application, policy) {
    const destinations = structuredClone(application.destinations);
    for (const curated of destinationsFromPolicy(policy)) {
        const old = destinations.find(d => d.hostname === curated.hostname);
        if (!old) {
            if (!destinations.some(d => serviceHostnames(d).includes(curated.hostname))) destinations.push({ ...curated, id: unusedId(curated.id, destinations) });
            continue;
        }
        old.aliases = [...new Set([...old.aliases, ...curated.aliases])].filter(h => !old.destinations.includes(h));
        old.destinations = [...new Set([...old.destinations, ...curated.destinations])].filter(h => !old.aliases.includes(h));
    }
    if (!validateDestinations(destinations)) throw new Error("CURATED_METADATA_CONFLICT");
    return destinations;
}
function validateRecovery(value) {
    return exact(value, ["id", "sourceProposalId", "operation", "basePolicyRevision", "baseConfigurationRevision", "baseApplicationRevision", "policy", "configuration", "destinations"]) &&
        text(value.id, 256) && Number.isSafeInteger(value.sourceProposalId) && value.sourceProposalId > 0 &&
        ["PROPOSE_POLICY", "PROPOSE_SETTINGS"].includes(value.operation) &&
        ["basePolicyRevision", "baseConfigurationRevision", "baseApplicationRevision"].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) &&
        normalizePolicy(value.policy) && Core.readConfiguration(value.configuration) &&
        (value.destinations === null || validateDestinations(value.destinations));
}
function replacementMatches(pending, recovery, destinations) {
    return !!pending && !!recovery && pending.id !== recovery.sourceProposalId &&
        (recovery.destinations === null || JSON.stringify(destinations) === JSON.stringify(recovery.destinations)) &&
        (recovery.operation === "PROPOSE_SETTINGS" ? sameConfiguration(pending.candidateConfiguration, recovery.configuration) : samePolicy(pending.candidatePolicy, recovery.policy));
}
function validateApplication(value, snapshot) {
    const legacy = value?.schemaVersion === 1;
    if (!exact(value, legacy ? ["schemaVersion", "revision", "destinations", "pending"] : ["schemaVersion", "revision", "destinations", "pending", "recovery"]) ||
        ![1, 2].includes(value.schemaVersion) || !legacy && value.recovery !== null && !validateRecovery(value.recovery) ||
        !Number.isSafeInteger(value.revision) || value.revision < 0 || !validateDestinations(value.destinations)) return null;
    if (value.pending !== null) {
        const p = value.pending, proposal = snapshot.vaultState.pendingProposal;
        if (!exact(p, ["proposalId", "policy", "destinations"]) || !proposal || p.proposalId !== proposal.id ||
            !normalizePolicy(p.policy) || !samePolicy(p.policy, proposal.candidatePolicy) || !validateDestinations(p.destinations)) return null;
    }
    return { ...structuredClone(value), schemaVersion: 2, recovery: legacy ? null : structuredClone(value.recovery) };
}
function transitionApplication(application, before, after, staged) {
    const value = structuredClone(application), pending = after.vaultState.pendingProposal;
    if (staged && pending && pending.id !== before.vaultState.pendingProposal?.id) {
        value.pending = { proposalId: pending.id, policy: structuredClone(pending.candidatePolicy), destinations: staged };
    }
    if (value.pending && !pending) {
        if (after.vaultState.lastApplied?.proposalId === value.pending.proposalId &&
            before.vaultState.lastApplied?.proposalId !== value.pending.proposalId && samePolicy(after.policy, value.pending.policy)) {
            value.destinations = value.pending.destinations; value.revision++;
        }
        value.pending = null;
    }
    if (!pending && after.vaultState.lastApplied?.proposalId === before.vaultState.pendingProposal?.id &&
        replacementMatches(before.vaultState.pendingProposal, value.recovery, application.pending?.destinations)) value.recovery = null;
    // Advanced/import changes have no presentation draft. Reflect their exact
    // committed host removals and additions instead of resurrecting the preset.
    if (!samePolicy(before.policy, after.policy) && !application.pending) {
        const explicit = new Set([...after.policy.whitelist, ...after.policy.blacklist]);
        value.destinations = value.destinations.filter(d => explicit.has(d.hostname)).map(d => ({ ...d,
            aliases: d.aliases.filter(h => explicit.has(h)), destinations: d.destinations.filter(h => explicit.has(h)) }));
        const covered = new Set(value.destinations.flatMap(serviceHostnames));
        for (const item of destinationsFromPolicy(after.policy)) if (!covered.has(item.hostname)) {
            value.destinations.push({ ...item, id: unusedId(item.id, value.destinations) });
            serviceHostnames(item).forEach(h => covered.add(h));
        }
        value.revision++;
    }
    return value;
}
function buildDestinationChange(snapshot, application, input) {
    if (input.basePolicyRevision !== snapshot.policyRevision || input.baseApplicationRevision !== application.revision) throw new Error("STALE_DRAFT");
    const destination = input.destination === null ? null : validateDestination(input.destination);
    if (input.destination !== null && !destination) throw new Error("INVALID_DESTINATION");
    const previous = application.destinations.find(d => d.id === input.previousId);
    if (input.previousId !== null && !previous) throw new Error("STALE_DESTINATION");
    if (previous && destination && previous.id !== destination.id) throw new Error("DESTINATION_ID_CHANGED");
    if (destination && application.destinations.some(d => d.id !== input.previousId && (d.id === destination.id || d.hostname === destination.hostname))) throw new Error("DUPLICATE_DESTINATION");
    if (!Object.hasOwn(input, "hostAccess") && !["WHITELIST", "BLACKLIST", "GREYLIST"].includes(input.access)) throw new Error("INVALID_HOST_ACCESS");
    const proposed = destination ? serviceHostnames(destination) : [];
    // Legacy access is an explicit all-host operation. Editors send a complete
    // classification per exact hostname, independent of interaction history.
    const hostAccess = Object.hasOwn(input, "hostAccess") ? input.hostAccess : proposed.map(hostname => ({ hostname, access: input.access }));
    if (!Array.isArray(hostAccess) || hostAccess.length !== proposed.length ||
        hostAccess.some(h => !exact(h, ["hostname", "access"]) || !proposed.includes(h.hostname) || !["WHITELIST", "BLACKLIST", "GREYLIST"].includes(h.access)) ||
        new Set(hostAccess.map(h => h.hostname)).size !== proposed.length) throw new Error("INVALID_HOST_ACCESS");
    const destinations = application.destinations.filter(d => d.id !== input.previousId);
    const shared = new Set(destinations.flatMap(serviceHostnames));
    const removed = new Set(previous ? serviceHostnames(previous).filter(h => !shared.has(h) && !proposed.includes(h)) : []);
    const policy = { whitelist: snapshot.policy.whitelist.filter(h => !removed.has(h)), blacklist: snapshot.policy.blacklist.filter(h => !removed.has(h)) };
    if (destination) destinations.push(destination);
    for (const intent of hostAccess) {
        // Preserve exact membership too: an untouched blacklisted host can also
        // have a Whitelist entry. Display edits cannot remove that entry.
        if (classification(snapshot.policy, intent.hostname) === intent.access) continue;
        policy.whitelist = policy.whitelist.filter(h => h !== intent.hostname);
        policy.blacklist = policy.blacklist.filter(h => h !== intent.hostname);
        if (intent.access !== "GREYLIST") policy[intent.access === "WHITELIST" ? "whitelist" : "blacklist"].push(intent.hostname);
    }
    policy.whitelist = [...new Set(policy.whitelist)]; policy.blacklist = [...new Set(policy.blacklist)];
    if (!normalizePolicy(policy) || !validateDestinations(destinations)) throw new Error("INVALID_DESTINATION");
    return { policy, destinations, presentationOnly: samePolicy(policy, snapshot.policy) };
}

module.exports = { validateDestination, validateDestinations, validateApplication, initialApplication, mergeCuratedDestinations,
    transitionApplication, buildDestinationChange, samePolicy, classification, replacementMatches };
