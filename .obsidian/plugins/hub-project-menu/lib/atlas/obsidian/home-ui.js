"use strict";
const { el, button, countdown, updateCountdowns } = require("./ui");

function mountAtlasHome(parent, bridge, navigate) {
    const header = el(parent, "header", undefined, "hub-atlas-home-header");
    el(header, "p", "Your internet, with intention", "hub-atlas-eyebrow");
    el(header, "h1", "Atlas"); el(header, "p", "A place for the things you choose.");
    const toolbar = el(parent, "div", undefined, "hub-atlas-home-toolbar");
    const search = el(toolbar, "input"); search.type = "search"; search.placeholder = "Search your destinations…";
    search.setAttribute("aria-label", "Search Atlas destinations");
    button(toolbar, "Sites & Access", () => bridge.open());
    const status = el(parent, "p", undefined, "hub-atlas-state"), temporary = el(parent, "section"), pinned = el(parent, "section"), groups = el(parent, "div");
    let signature = null, temporarySignature = null, disposed = false;
    const card = (container, destination, href = `https://${destination.hostname}/`) => {
        const item = el(container, "article", undefined, "hub-atlas-card");
        const target = button(item, destination.label, () => navigate(href)); target.className = "hub-atlas-destination-link";
        el(item, "small", new URL(href).hostname);
        if (destination.destinations?.length) {
            const more = el(item, "details"), summary = el(more, "summary", "Other entry points"); summary.setAttribute("aria-label", `${destination.label} other entry points`);
            for (const host of destination.hosts.filter(h => destination.destinations.includes(h.hostname) && h.decision.outcome === "ALLOW")) button(more, host.hostname, () => navigate(`https://${host.hostname}/`));
        }
    };
    function refresh() {
        if (disposed) return;
        const state = bridge.view(), now = Date.now();
        const destinations = (state.destinations ?? []).filter(d => d.decision?.outcome === "ALLOW" && d.decision.reason === "WHITELISTED");
        const grants = (state.temporaryDestinations ?? []).filter(g => g.expiresAt > now && g.policyRevision === state.snapshot.policyRevision && g.decision.outcome === "ALLOW");
        const next = JSON.stringify([state.status, state.enabled, destinations, search.value]);
        const statusText = state.status === "READY" && state.enabled ? "" : state.status === "UNINITIALIZED"
            ? `Initialize Atlas to begin with ${state.starter?.serviceCount ?? "curated"} destinations.` : "Atlas is unavailable. External browsing stays blocked.";
        if (status.textContent !== statusText) status.textContent = statusText;
        const nextTemporary = JSON.stringify([state.status, state.enabled, grants]);
        if (temporarySignature !== nextTemporary) {
            temporarySignature = nextTemporary; temporary.replaceChildren(); el(temporary, "h2", "Temporary access");
            if (!grants.length) el(temporary, "p", "No temporary access is active.", "hub-atlas-muted");
            for (const grant of grants) {
                const row = el(temporary, "div", undefined, "hub-atlas-temporary-row");
                button(row, grant.hostname, () => navigate(`https://${grant.hostname}/`)); countdown(row, "Remaining", grant.expiresAt);
            }
        }
        updateCountdowns(temporary);
        if (next === signature) return;
        signature = next; pinned.replaceChildren(); groups.replaceChildren();
        if (state.status !== "READY" || !state.enabled) { button(groups, state.status === "UNINITIALIZED" ? "Initialize Atlas" : "Diagnostics & recovery", () => bridge.open()); return; }
        const query = search.value.trim().toLowerCase();
        const visible = destinations.filter(d => `${d.label} ${d.category} ${d.hostname} ${d.aliases.join(" ")} ${d.destinations.join(" ")}`.toLowerCase().includes(query));
        const favorites = visible.filter(d => d.pinned);
        if (favorites.length) {
            el(pinned, "h2", "Pinned"); const grid = el(pinned, "div", undefined, "hub-atlas-grid"); favorites.forEach(d => card(grid, d));
        }
        const categories = [...new Set(visible.map(d => d.category))];
        for (const category of categories) {
            const section = el(groups, "section"), heading = el(section, "div", undefined, "hub-atlas-section-heading"), entries = visible.filter(d => d.category === category);
            el(heading, "h2", category); el(heading, "small", `${entries.length} destination${entries.length === 1 ? "" : "s"}`);
            const grid = el(section, "div", undefined, "hub-atlas-grid"); entries.forEach(d => card(grid, d));
        }
        if (!visible.length) el(groups, "p", query ? "No destinations match your search." : "No committed Whitelist destinations. Add one in Sites & Access.");
    }
    search.addEventListener("input", refresh);
    const key = event => { if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !event.target.isContentEditable) { event.preventDefault(); search.focus(); } };
    parent.addEventListener("keydown", key);
    const unsubscribe = bridge.subscribe(refresh); refresh();
    const timer = setInterval(() => updateCountdowns(temporary), 1000);
    return () => { disposed = true; unsubscribe(); clearInterval(timer); parent.removeEventListener("keydown", key); };
}
module.exports = { mountAtlasHome };
