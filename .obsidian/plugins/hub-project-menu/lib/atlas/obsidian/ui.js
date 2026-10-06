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
    node.addEventListener("click", async () => {
        node.dataset.atlasBusy = "true"; node.disabled = true;
        try { await action(); } finally {
            delete node.dataset.atlasBusy;
            if (node.isConnected) node.disabled = disabled || node.dataset.atlasUnavailable === "true" || node.dataset.atlasNotReady === "true";
        }
    });
    return node;
}
const seconds = deadline => `${Math.max(0, Math.ceil((deadline - Date.now()) / 1000))} s`;
function countdown(parent, label, deadline) {
    const node = el(parent, "p", `${label}: ${seconds(deadline)}`);
    node.dataset.atlasDeadline = String(deadline); node.dataset.atlasLabel = label;
}
function updateCountdowns(parent) {
    for (const node of parent.querySelectorAll("[data-atlas-deadline]")) {
        const value = `${node.dataset.atlasLabel}: ${seconds(Number(node.dataset.atlasDeadline))}`;
        if (node.textContent !== value) node.textContent = value;
    }
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
    const descriptions = {
        waitMs: "Waiting makes an explicit confirmation available; it never grants permission.",
        confirmationWindowMs: "Confirm within this window. Expiry requires a fresh request or proposal.",
        grantDurationMs: "Fixed lifetime after confirmation. Browsing and reloads never extend it.",
        lifetimeMs: "Maximum fixed time for a continuation from a trusted destination.",
        maxHops: "Maximum continuation steps. No other tab or popup inherits them."
    };
    const inputs = fields.map(([group, key, label, duration]) => {
        const wrapper = el(parent, "label", `${label}${duration ? " (seconds)" : ""}`), input = el(wrapper, "input");
        input.type = "number"; input.min = "0"; input.step = duration ? "0.001" : "1";
        input.value = duration ? formatMilliseconds(configuration[group][key]) : String(configuration[group][key]);
        el(wrapper, "small", descriptions[key]);
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
    return require("./settings-ui").mountAtlasSettings(parent, bridge);
}

module.exports = { mountAtlasOverview, renderNavigation, configurationInput, formatMilliseconds, el, button, countdown, updateCountdowns, describeConfiguration };
