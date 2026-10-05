"use strict";

/** @type {Array<[string, string, string, boolean]>} */
const fields = [
    ["accessTiming", "waitMs", "Access wait", true],
    ["accessTiming", "confirmationWindowMs", "Access confirmation window", true],
    ["accessTiming", "grantDurationMs", "Temporary access duration", true],
    ["vaultTiming", "waitMs", "Vault wait", true],
    ["vaultTiming", "confirmationWindowMs", "Vault confirmation window", true],
    ["journeyLimits", "lifetimeMs", "Journey lifetime", true],
    ["journeyLimits", "maxHops", "Journey hop budget", false]
];
function formatMilliseconds(value) {
    const integer = BigInt(value), fraction = String(integer % 1000n).padStart(3, "0").replace(/0+$/, "");
    return `${integer / 1000n}${fraction ? "." + fraction : ""}`;
}
function el(parent, tag, text, className) {
    const node = parent.ownerDocument.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    parent.appendChild(node); return node;
}
function button(parent, label, action, disabled = false) {
    const node = el(parent, "button", label); node.type = "button"; node.disabled = disabled;
    node.addEventListener("click", async () => { node.disabled = true; try { await action(); } finally { if (node.isConnected) node.disabled = disabled; } });
    return node;
}
const seconds = deadline => `${Math.max(0, Math.ceil((deadline - Date.now()) / 1000))} s`;
function countdown(parent, label, deadline) {
    const node = el(parent, "p", `${label}: ${seconds(deadline)}`);
    node.dataset.atlasDeadline = String(deadline); node.dataset.atlasLabel = label;
}
function updateCountdowns(parent) {
    for (const node of parent.querySelectorAll("[data-atlas-deadline]")) node.textContent = `${node.dataset.atlasLabel}: ${seconds(Number(node.dataset.atlasDeadline))}`;
}
function renderNavigation(parent, state, context, bridge) {
    const decision = context?.response?.decision;
    const signature = JSON.stringify([state.status, state.reason, state.enabled, context?.id, context?.generation,
        context?.phase, decision, context?.journey]);
    if (parent.dataset.atlasSignature === signature) { updateCountdowns(parent); return; }
    parent.dataset.atlasSignature = signature; parent.replaceChildren();
    el(parent, "h3", "Atlas");
    if (context?.origin) el(parent, "p", context.origin);
    const command = kind => bridge.command({ kind, contextId: context.id, generation: context.generation });
    if (state.status !== "READY" || !state.enabled) {
        el(parent, "p", state.status === "UNINITIALIZED" ? "Set up Atlas before browsing." : `Browsing is blocked: ${state.reason ?? "Atlas is unavailable"}.`);
        button(parent, "Open Atlas", () => bridge.open()); return;
    }
    if (!context) { el(parent, "p", "Waiting for a protected webviewer."); return; }
    switch (decision?.outcome) {
        case "GREYLIST":
            el(parent, "p", "This exact hostname needs temporary access.");
            button(parent, "Request access", () => command("START_ACCESS")); break;
        case "WAIT":
            el(parent, "p", "Access requested. Waiting does not grant permission.");
            countdown(parent, "Confirmation available in", decision.readyAt);
            button(parent, "Cancel request", () => command("CANCEL_ACCESS")); break;
        case "REQUIRE_CONFIRMATION":
            el(parent, "p", "Confirm temporary access to this hostname. A fresh homepage will open.");
            countdown(parent, "Confirmation window remaining", decision.confirmBy);
            button(parent, "Confirm and open homepage", () => command("CONFIRM_ACCESS_AND_OPEN"));
            button(parent, "Cancel request", () => command("CANCEL_ACCESS")); break;
        case "ALLOW":
            el(parent, "p", "Access is available. Open a fresh homepage to continue.");
            button(parent, "Open homepage", () => command("OPEN_HOME")); break;
        default:
            el(parent, "p", `Navigation blocked: ${(decision?.reason ?? context.response?.reason ?? "authorization unavailable").replaceAll("_", " ").toLowerCase()}.`);
    }
    if (context.journey) {
        el(parent, "p", `Journey to ${context.journey.rootHostname}: ${context.journey.phase.toLowerCase()}.`);
        button(parent, "Retry trusted destination", () => command("RETRY_JOURNEY"));
    }
    button(parent, "Atlas policy and Vault", () => bridge.open());
}

function hostInput(parent, label, hostnames) {
    const wrapper = el(parent, "label", label), input = el(wrapper, "textarea");
    input.rows = 4; input.value = hostnames.join("\n");
    input.placeholder = "One exact hostname per line"; input.spellcheck = false;
    return () => input.value.split(/[\n,]/).map(value => value.trim()).filter(Boolean);
}
function configurationInput(parent, configuration) {
    const inputs = fields.map(([group, key, label, duration]) => {
        const wrapper = el(parent, "label", `${label}${duration ? " (seconds)" : ""}`), input = el(wrapper, "input");
        input.type = "number"; input.min = "0"; input.step = duration ? "0.001" : "1";
        input.value = duration ? formatMilliseconds(configuration[group][key]) : String(configuration[group][key]);
        return { group, key, duration, input };
    });
    return () => {
        const result = { accessTiming: {}, vaultTiming: {}, journeyLimits: {} };
        for (const { group, key, duration, input } of inputs) {
            // Parse decimal seconds exactly into integer milliseconds. Core owns
            // all timing constraints, positive requirements and overflow rules.
            const match = /^(\d+)(?:\.(\d{1,3}))?$/.exec(input.value);
            if (!match || (!duration && match[2])) throw new Error("Enter nonnegative whole hops and seconds with at most three decimal places.");
            const integer = BigInt(match[1]) * (duration ? 1000n : 1n) + (duration ? BigInt((match[2] ?? "").padEnd(3, "0")) : 0n);
            if (integer > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Value is too large.");
            result[group][key] = Number(integer);
        }
        return result;
    };
}
function describeConfiguration(parent, config, title) {
    if (!config) return;
    el(parent, "h4", title);
    for (const [group, key, label, duration] of fields) el(parent, "p", `${label}: ${duration ? formatMilliseconds(config[group][key]) : config[group][key]}${duration ? " s" : ""}`);
}

function mountAtlasOverview(parent, bridge) {
    parent.classList.add("hub-atlas-overview");
    el(parent, "h2", "Atlas access and Vault");
    el(parent, "p", "Atlas governs top-level webviewer destinations by exact hostname. Waiting only makes explicit confirmation available.");
    const status = el(parent, "div"), message = el(parent, "p"), forms = el(parent, "div"), navigation = el(parent, "div"), activity = el(parent, "div"), vault = el(parent, "div");
    message.setAttribute("role", "status");
    let formMode = null, review = null, activitySignature = null, vaultSignature = null, disposed = false;
    const panels = new Map();
    async function send(input) {
        try {
            const result = await bridge.command(input);
            if (result.type === "REVIEW") review = result.review;
            else if (result.type === "COMMITTED") review = null;
            message.textContent = result.reason ?? (result.type === "COMMITTED" ? "Saved." : result.type === "REVIEW" ? "Review the frozen proposal below." : result.status ?? result.type);
            vaultSignature = null; refresh(); return result;
        } catch (error) { message.textContent = error.message; }
    }
    function refresh() {
        if (disposed) return;
        const state = bridge.view(), snapshot = state.snapshot;
        status.textContent = `Atlas: ${state.status.toLowerCase()}${state.reason ? ` · ${state.reason}` : ""}${state.repositoryIssue ? ` · ${state.repositoryIssue}` : ""}`;
        const mode = state.status === "UNINITIALIZED" ? "setup" : snapshot ? "protected" : "unavailable";
        if (formMode !== mode) {
            formMode = mode; forms.replaceChildren();
            if (mode === "unavailable") {
                el(forms, "p", "Atlas cannot establish authoritative state. Browsing stays blocked. Recovery reloads and reconciles saved state; it never resets it.");
                button(forms, "Recover saved state", () => send({ kind: "RECOVER" }));
            } else {
                el(forms, "h3", mode === "setup" ? "First setup" : "Propose protected changes");
                if (mode === "setup") el(forms, "p", "Choose your initial host policy and review the development timing defaults below. There is no implicit service preset. Setup is available only for an unused repository.");
                const policy = snapshot?.policy ?? { whitelist: [], blacklist: [] };
                const readWhitelist = hostInput(forms, "Whitelist", policy.whitelist), readBlacklist = hostInput(forms, "Blacklist", policy.blacklist);
                const readConfig = configurationInput(forms, snapshot?.configuration ?? state.initialConfiguration);
                const readPolicy = () => ({ whitelist: readWhitelist(), blacklist: readBlacklist() });
                if (mode === "setup") button(forms, "Initialize Atlas with these terms", async () => {
                    try { await send({ kind: "INITIALIZE", policy: readPolicy(), configuration: readConfig() }); } catch (error) { message.textContent = error.message; }
                });
                else {
                    button(forms, "Propose policy in Vault", () => send({ kind: "PROPOSE_POLICY", candidatePolicy: readPolicy() })).dataset.atlasProtected = "";
                    button(forms, "Propose timing settings in Vault", async () => {
                        try { await send({ kind: "PROPOSE_SETTINGS", candidateConfiguration: readConfig() }); } catch (error) { message.textContent = error.message; }
                    }).dataset.atlasProtected = "";
                    button(forms, "Recover saved state", () => send({ kind: "RECOVER" }));
                }
            }
        }
        for (const node of forms.querySelectorAll("[data-atlas-protected]")) node.disabled = state.status !== "READY";
        if (!snapshot) return;
        const blockedContexts = state.contexts.filter(context => context.origin && ["BLOCKED", "ENFORCEMENT_FAILED"].includes(context.phase));
        for (const [id, panel] of panels) if (!blockedContexts.some(context => context.id === id)) { panel.remove(); panels.delete(id); }
        for (const context of blockedContexts) {
            let panel = panels.get(context.id);
            if (!panel) { panel = el(navigation, "section", undefined, "hub-atlas-panel"); panels.set(context.id, panel); }
            renderNavigation(panel, state, context, bridge);
        }
        const signature = JSON.stringify([snapshot.policy, snapshot.policyRevision, snapshot.configuration, snapshot.configurationRevision,
            snapshot.accessState.pendingRequests, snapshot.accessState.grants, snapshot.journeyState.journeys]);
        if (activitySignature !== signature) {
            activitySignature = signature; activity.replaceChildren();
            el(activity, "h3", `Active policy · revision ${snapshot.policyRevision}`);
            el(activity, "p", `Whitelist: ${snapshot.policy.whitelist.join(", ") || "empty"}`);
            el(activity, "p", `Blacklist: ${snapshot.policy.blacklist.join(", ") || "empty"}`);
            describeConfiguration(activity, snapshot.configuration, `Active timing settings · revision ${snapshot.configurationRevision}`);
            el(activity, "h3", "Temporary access");
            for (const grant of snapshot.accessState.grants) countdown(activity, `${(grant.scopeHostnames ?? [grant.hostname]).join(", ")} · remaining`, grant.expiresAt);
            if (!snapshot.accessState.grants.length) el(activity, "p", "No temporary grants.");
            for (const request of snapshot.accessState.pendingRequests) countdown(activity, `${request.hostname} · request ${request.id} · ready in`, request.readyAt);
            el(activity, "h3", "Journeys");
            for (const journey of snapshot.journeyState.journeys) {
                el(activity, "p", `${journey.rootHostname} → ${journey.currentHostname} · ${journey.phase.toLowerCase()}${journey.endReason ? ` · ${journey.endReason.toLowerCase()}` : ""}`);
                const context = state.contexts.find(item => item.id === journey.contextId);
                if (context && journey.phase !== "ENDED") button(activity, "End this Journey", () => send({ kind: "CANCEL_JOURNEY", contextId: context.id, generation: context.generation }));
            }
        }
        updateCountdowns(activity);
        const pending = snapshot.vaultState.pendingProposal;
        if (review && review.proposalId !== pending?.id) review = null;
        const nextVaultSignature = JSON.stringify([pending, review, state.status]);
        if (vaultSignature !== nextVaultSignature) {
            vaultSignature = nextVaultSignature; vault.replaceChildren(); el(vault, "h3", "Vault");
            if (!pending) el(vault, "p", "No pending proposal. Policy and settings share one proposal slot.");
            else {
                countdown(vault, `Proposal ${pending.id} · ready in`, pending.readyAt);
                countdown(vault, "Confirmation window ends in", pending.confirmBy);
                button(vault, "Review proposal", () => send({ kind: "REVIEW_POLICY", proposalId: pending.id }));
                button(vault, "Cancel proposal", () => send({ kind: "CANCEL_POLICY", proposalId: pending.id }));
                if (review) {
                    el(vault, "p", `Review: ${review.phase.toLowerCase()}. ${review.invalidatesAccess ? "Policy confirmation invalidates old access and Journey bindings." : "Existing request and Journey terms remain frozen."}`);
                    for (const change of review.classifications) el(vault, "p", `${change.hostname}: ${change.before.toLowerCase()} → ${change.after.toLowerCase()}`);
                    describeConfiguration(vault, review.currentConfiguration, "Current terms");
                    describeConfiguration(vault, review.candidateConfiguration, "Proposed terms");
                    button(vault, "Confirm reviewed proposal", () => send({ kind: "CONFIRM_POLICY", proposalId: review.proposalId }), review.phase !== "READY" || state.status !== "READY");
                }
            }
        }
        updateCountdowns(vault);
    }
    const unsubscribe = bridge.subscribe(refresh); refresh();
    return () => { disposed = true; unsubscribe(); };
}

module.exports = { mountAtlasOverview, renderNavigation, configurationInput, formatMilliseconds };
