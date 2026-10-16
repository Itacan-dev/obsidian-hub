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
        if (node.dataset.atlasBusy === "true") return;
        node.dataset.atlasBusy = "true";
        // Let a synchronous route capture the focused opener before disabling it.
        try { const work = action(); if (work && typeof work.then === "function") { node.disabled = true; node.setAttribute("aria-busy", "true"); await work; } } finally {
            node.removeAttribute("aria-busy");
            delete node.dataset.atlasBusy;
            if (node.isConnected) node.disabled = disabled || node.dataset.atlasUnavailable === "true" || node.dataset.atlasNotReady === "true";
        }
    });
    return node;
}
const seconds = (deadline, now = Date.now()) => `${Math.max(0, Math.ceil((deadline - now) / 1000))} s`;
function countdown(parent, label, deadline) {
    const node = el(parent, "p", `${label}: ${seconds(deadline)}`);
    node.dataset.atlasDeadline = String(deadline); node.dataset.atlasLabel = label; node.setAttribute("aria-live", "off");
}
function updateCountdowns(parent, now = Date.now()) {
    for (const node of parent.querySelectorAll("[data-atlas-deadline]")) {
        const value = `${node.dataset.atlasLabel}: ${seconds(Number(node.dataset.atlasDeadline), now)}`;
        if (node.textContent !== value) node.textContent = value;
    }
}
const navigationMounts = new WeakMap();
function renderNavigation(parent, state, context, bridge) {
    const { getAtlasSession } = require("./session"), { describeOutcome } = require("./feedback"), { keyed, text } = require("./dom");
    const { presentationNow } = require("./pending"), now = presentationNow(state), session = getAtlasSession(bridge);
    let mount = navigationMounts.get(parent);
    if (!mount || mount.heading.parentNode !== parent) {
        parent.replaceChildren(); mount = { heading: el(parent, "h3", "Atlas"), origin: el(parent, "p"), context: null };
        mount.feedback = el(parent, "div", undefined, "hub-atlas-operation-feedback"); mount.feedback.setAttribute("role", "status");
        mount.feedbackText = el(mount.feedback, "p"); mount.feedbackAction = button(mount.feedback, "Review saved state", () => { const value = getAtlasSession(bridge).contextFeedback.get(mount.context?.id); if (value?.section) bridge.open?.({ section: value.section }); });
        mount.copy = el(parent, "p"); mount.copy.setAttribute("role", "status");
        countdown(parent, "", 0); mount.count = parent.querySelector("[data-atlas-deadline]");
        mount.journey = el(parent, "p"); const actions = el(parent, "div", undefined, "hub-atlas-context-actions");
        mount.actions = keyed(actions, item => { const r = { node: null, value: item }; r.node = button(actions, item.label, () => r.value.run()); return r; },
            (r, item) => { text(r.node, item.label); r.node.dataset.atlasNotReady = item.disabled ? "true" : "false"; r.node.disabled = !!item.disabled || r.node.dataset.atlasBusy === "true"; }, item => item.key);
        navigationMounts.set(parent, mount);
    }
    mount.context = context; parent.dataset.atlasContextId = context?.id ?? "";
    const decision = context?.response?.decision, expired = ["WAIT", "REQUIRE_CONFIRMATION"].includes(decision?.outcome) && now >= decision.confirmBy;
    const usable = !bridge.canActOnContext || !!context && bridge.canActOnContext(context), feedback = session.contextFeedback.get(context?.id);
    parent.dataset.state = state.status !== "READY" ? "UNRESOLVED" : expired ? "EXPIRED" : decision?.reason ?? decision?.outcome ?? "BLOCKED";
    text(mount.origin, context?.origin); mount.origin.hidden = !context?.origin;
    mount.feedback.hidden = !feedback; text(mount.feedbackText, feedback?.text); mount.feedback.dataset.tone = feedback?.tone ?? "info";
    mount.feedbackAction.hidden = !feedback?.section; text(mount.feedbackAction, feedback?.section === "diagnostics" ? "Review saved state" : "Review current state");
    const command = async kind => {
        const target = mount.context;
        if (!target) return;
        const input = { kind, contextId: target.id, generation: target.generation }, current = bridge.view();
        const live = current.contexts.find(c => c.id === target.id && c.generation === target.generation); let result;
        try { result = !live || bridge.canActOnContext && !bridge.canActOnContext(live) ? { type: "BLOCKED", reason: "STALE_CONTEXT" } : await bridge.command(input); }
        catch (_) { result = { type: "BLOCKED", reason: "TRANSPORT_UNRESOLVED" }; }
        session.contextFeedback.set(target.id, describeOutcome(input, result, bridge.view()));
        if (session.contextFeedback.size > 128) session.contextFeedback.delete(session.contextFeedback.keys().next().value);
        if (mount.context?.id === target.id) renderNavigation(parent, bridge.view(), bridge.view().contexts.find(c => c.id === target.id) ?? target, bridge);
        return result;
    };
    const actions = [], route = (label, section, routeContext) => actions.push({ key: "route:" + section, label, run: () => bridge.open?.({ section, ...(routeContext ? { context: routeContext } : {}) }) });
    const action = (label, kind) => actions.push({ key: kind, label, run: () => command(kind) });
    let copy, deadline = null, countdownLabel = "";
    if (state.status !== "READY" || !state.enabled) {
        copy = state.status === "UNINITIALIZED" ? "Set up Atlas before browsing." : "Saved authority is unavailable. Browsing stays blocked; reconcile saved state to continue.";
        route("Open Atlas", state.status === "UNINITIALIZED" ? "sites" : "diagnostics");
    } else if (!context) copy = "This browsing context is no longer available. Return to a destination in a Note tab to continue.";
    else if (!usable) {
        copy = "Access controls are available from an owned Note workspace. This request has not granted access."; route("Review Temporary Access", "temporary");
    } else if (expired) {
        copy = "This access request expired without granting access. Request again for a full new wait.";
        action("Request access again", "START_ACCESS"); route("Review Temporary Access", "temporary", { contextId: context.id });
    } else {
        switch (decision?.outcome) {
            case "GREYLIST":
                copy = decision.reason === "REQUEST_EXPIRED" ? "The previous request expired. Request again for a full new wait." : "This exact hostname needs temporary access.";
                action("Request access", "START_ACCESS"); break;
            case "WAIT":
                copy = now >= decision.readyAt ? "The wait has elapsed. Confirmation will appear after the current access check." : "Access requested. Waiting does not grant permission.";
                deadline = decision.readyAt; countdownLabel = "Confirmation available in"; action("Cancel request", "CANCEL_ACCESS"); break;
            case "REQUIRE_CONFIRMATION":
                copy = "Confirm temporary access to this hostname. A fresh homepage will open.";
                deadline = decision.confirmBy; countdownLabel = "Confirmation window remaining"; action("Confirm and open homepage", "CONFIRM_ACCESS_AND_OPEN"); action("Cancel request", "CANCEL_ACCESS"); break;
            case "ALLOW":
                copy = "Access is available. Open a fresh homepage to continue."; action("Open homepage", "OPEN_HOME"); break;
            default:
                copy = decision?.reason === "BLACKLISTED" ? "This exact host is blocked by your Blacklist." : decision?.reason === "MANAGED_BLACKLISTED" ? "This host is blocked by the managed list." : "Navigation is blocked by the current access rules.";
        }
        if (context.journey) action("Retry trusted destination", "RETRY_JOURNEY");
        route("Atlas policy and Vault", "vault");
    }
    text(mount.copy, copy); mount.count.hidden = deadline === null; mount.count.dataset.atlasDeadline = String(deadline ?? 0); mount.count.dataset.atlasLabel = countdownLabel;
    const hasJourney = context?.journey && usable && !expired && state.status === "READY" && state.enabled;
    text(mount.journey, hasJourney ? "A bounded Journey is associated with this tab. It does not authorize other tabs." : ""); mount.journey.hidden = !hasJourney;
    mount.actions(actions); updateCountdowns(parent, now);
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
