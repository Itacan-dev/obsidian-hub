"use strict";
// One renderer-session owner. These drafts and routes never enter Core or disk.
const sessions = new WeakMap();
const SECTIONS = ["sites", "temporary", "timings", "vault", "managed", "diagnostics"];
function normalizeRoute(input, previous = { section: "sites", context: null }) {
    if (input === undefined) return previous;
    if (!input || typeof input !== "object" || Array.isArray(input) || !SECTIONS.includes(input.section) || Object.keys(input).some(key => !["section", "context"].includes(key))) return null;
    if (input.context !== undefined && input.context !== null && (!input.context || typeof input.context !== "object" || Array.isArray(input.context))) return null;
    const context = {};
    for (const [key, value] of Object.entries(input.context ?? {})) {
        if (!["proposalId", "requestId", "recoveryId", "contextId"].includes(key) ||
            !(typeof value === "string" && value.length > 0 && value.length <= 256 || Number.isSafeInteger(value) && value > 0)) return null;
        context[key] = value;
    }
    return { section: input.section, context };
}
function getAtlasSession(bridge) {
    if (sessions.has(bridge)) return sessions.get(bridge);
    const listeners = new Set();
    const session = { route: { section: "sites", context: null }, draft: null, timings: null, setup: null, search: "", scrolls: new Map(), settingsScroll: 0, feedback: null, contextFeedback: new Map(),
        navigate(input) { const next = normalizeRoute(input, session.route); if (!next) return false;
            session.route = next; for (const fn of listeners) fn(next, { navigation: true }); return true; },
        changed() { for (const fn of listeners) fn(session.route, { navigation: false }); },
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        clearDraft(token) { if (session.draft?.token !== token) return false; session.draft = null; session.changed(); return true; },
        dispose() { listeners.clear(); session.draft = null; session.timings = null; session.setup = null; session.feedback = null; session.contextFeedback.clear(); session.scrolls.clear(); sessions.delete(bridge); }
    };
    sessions.set(bridge, session); return session;
}
function draftBase(view, destination) {
    // Historical per-host intent, not a second live policy/snapshot. Overlapping
    // lists are retained by the runtime when final classification is unchanged.
    const classes = Object.create(null);
    for (const h of view.snapshot.policy.whitelist) classes[h] = "WHITELIST";
    for (const h of view.snapshot.policy.blacklist) classes[h] = "BLACKLIST";
    return { policyRevision: view.snapshot.policyRevision, applicationRevision: view.application.revision,
        destination: destination ? structuredClone(destination) : null, classes };
}
function createDestinationDraft(view, destination) {
    const token = globalThis.crypto.randomUUID();
    return { token, id: destination?.id ?? "destination:" + token, base: draftBase(view, destination), fields: null,
        overrides: [], initialSignature: null, dirty: false, conflict: false, feedback: null, submission: null };
}
module.exports = { getAtlasSession, normalizeRoute, createDestinationDraft, draftBase, SECTIONS };
