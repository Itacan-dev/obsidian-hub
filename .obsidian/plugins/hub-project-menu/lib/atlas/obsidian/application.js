"use strict";

// Application metadata only. Core continues to own every host classification.
const Core = require("../core/index");
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
    return { schemaVersion: 1, revision: 0, destinations: destinationsFromPolicy(policy), pending: null };
}
// Explicit curated import merges reviewed hosts into the existing service.
// User labels, categories, pins, custom services and manual Blacklist survive.
function mergeCuratedDestinations(application, policy) {
    const destinations = structuredClone(application.destinations);
    for (const curated of destinationsFromPolicy(policy)) {
        const old = destinations.find(d => d.hostname === curated.hostname);
        if (!old) {
            if (!destinations.some(d => serviceHostnames(d).includes(curated.hostname))) destinations.push(curated);
            continue;
        }
        old.aliases = [...new Set([...old.aliases, ...curated.aliases])].filter(h => !old.destinations.includes(h));
        old.destinations = [...new Set([...old.destinations, ...curated.destinations])].filter(h => !old.aliases.includes(h));
    }
    return destinations;
}
function validateApplication(value, snapshot) {
    if (!exact(value, ["schemaVersion", "revision", "destinations", "pending"]) || value.schemaVersion !== 1 ||
        !Number.isSafeInteger(value.revision) || value.revision < 0 || !validateDestinations(value.destinations)) return null;
    if (value.pending !== null) {
        const p = value.pending, proposal = snapshot.vaultState.pendingProposal;
        if (!exact(p, ["proposalId", "policy", "destinations"]) || !proposal || p.proposalId !== proposal.id ||
            !normalizePolicy(p.policy) || !samePolicy(p.policy, proposal.candidatePolicy) || !validateDestinations(p.destinations)) return null;
    }
    return structuredClone(value);
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
    // Advanced/import changes have no presentation draft. Reflect their exact
    // committed host removals and additions instead of resurrecting the preset.
    if (!samePolicy(before.policy, after.policy) && !application.pending) {
        const explicit = new Set([...after.policy.whitelist, ...after.policy.blacklist]);
        value.destinations = value.destinations.filter(d => explicit.has(d.hostname)).map(d => ({ ...d,
            aliases: d.aliases.filter(h => explicit.has(h)), destinations: d.destinations.filter(h => explicit.has(h)) }));
        const covered = new Set(value.destinations.flatMap(serviceHostnames));
        value.destinations.push(...destinationsFromPolicy(after.policy).filter(d => !covered.has(d.hostname)));
        value.revision++;
    }
    return value;
}
function buildDestinationChange(snapshot, application, input) {
    if (input.basePolicyRevision !== snapshot.policyRevision || input.baseApplicationRevision !== application.revision) throw new Error("STALE_DRAFT");
    const destination = input.destination === null ? null : validateDestination(input.destination);
    if (input.destination !== null && !destination || !["WHITELIST", "BLACKLIST", "GREYLIST"].includes(input.access)) throw new Error("INVALID_DESTINATION");
    const previous = application.destinations.find(d => d.id === input.previousId);
    if (input.previousId !== null && !previous) throw new Error("STALE_DESTINATION");
    if (destination && application.destinations.some(d => d.id !== input.previousId && (d.id === destination.id || d.hostname === destination.hostname))) throw new Error("DUPLICATE_DESTINATION");
    const destinations = application.destinations.filter(d => d.id !== input.previousId);
    const shared = new Set(destinations.flatMap(serviceHostnames)), removed = new Set(previous ? serviceHostnames(previous).filter(h => !shared.has(h)) : []);
    const policy = { whitelist: snapshot.policy.whitelist.filter(h => !removed.has(h)), blacklist: snapshot.policy.blacklist.filter(h => !removed.has(h)) };
    if (destination) {
        destinations.push(destination);
        const proposed = new Set(serviceHostnames(destination));
        policy.whitelist = policy.whitelist.filter(h => !proposed.has(h)); policy.blacklist = policy.blacklist.filter(h => !proposed.has(h));
        if (input.access !== "GREYLIST") policy[input.access === "WHITELIST" ? "whitelist" : "blacklist"].push(...proposed);
    }
    policy.whitelist = [...new Set(policy.whitelist)]; policy.blacklist = [...new Set(policy.blacklist)];
    if (!normalizePolicy(policy) || !validateDestinations(destinations)) throw new Error("INVALID_DESTINATION");
    return { policy, destinations, presentationOnly: samePolicy(policy, snapshot.policy) };
}

module.exports = { validateDestination, validateDestinations, validateApplication, initialApplication, mergeCuratedDestinations,
    transitionApplication, buildDestinationChange, samePolicy };
