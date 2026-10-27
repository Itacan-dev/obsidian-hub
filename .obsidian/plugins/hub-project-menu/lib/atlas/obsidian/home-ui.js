"use strict";
const { el, button, countdown, updateCountdowns } = require("./ui");
const { pendingForBridge, presentationNow, temporaryGrantUsable } = require("./pending");
const { text, place, keyed, phaseAnnouncer } = require("./dom");

function mountAtlasHome(parent, bridge, navigate) {
    const header = el(parent, "header", undefined, "hub-atlas-home-header");
    el(header, "p", "Your internet, with intention", "hub-atlas-eyebrow");
    el(header, "h1", "Atlas"); el(header, "p", "A place for the things you choose.");
    const toolbar = el(parent, "div", undefined, "hub-atlas-home-toolbar");
    const search = el(toolbar, "input"); search.type = "search"; search.placeholder = "Search your destinations…";
    search.setAttribute("aria-label", "Search Atlas destinations");
    button(toolbar, "Sites & Access", () => bridge.open({ section: "sites" }));
    const status = el(parent, "p", undefined, "hub-atlas-state"); status.setAttribute("role", "status");
    const pending = el(parent, "section", undefined, "hub-atlas-pending");
    el(pending, "h2", "Needs your attention"); const first = el(pending, "div"), overflow = el(pending, "details"), overflowLabel = el(overflow, "summary"), extra = el(overflow, "div");
    const announce = phaseAnnouncer(parent), pendingRows = new Map();
    const temporary = el(parent, "section"), pinned = el(parent, "section"), groups = el(parent, "div"), empty = el(parent, "p");
    pinned.dataset.atlasPinned = ""; el(pinned, "h2", "Pinned"); const pinnedGrid = el(pinned, "div", undefined, "hub-atlas-grid");
    el(temporary, "h2", "Temporary access"); const noGrants = el(temporary, "p", "No temporary access is active.", "hub-atlas-muted"), grantList = el(temporary, "div");
    const syncGrants = keyed(grantList, grant => {
        const node = el(grantList, "div", undefined, "hub-atlas-temporary-row"), record = { node, value: grant };
        record.link = button(node, grant.hostname, () => navigate("https://" + record.value.hostname + "/"));
        countdown(node, "Remaining", grant.expiresAt); record.count = node.querySelector("[data-atlas-deadline]"); node.dataset.state = "ACTIVE_GRANT"; return record;
    }, (record, grant) => { text(record.link, grant.hostname); record.count.dataset.atlasDeadline = String(grant.expiresAt); }, grant => grant.requestId);
    let disposed = false;
    function refreshPending() {
        if (disposed) return;
        const state = bridge.view(), items = pendingForBridge(bridge), wanted = new Set(items.map(i => i.key));
        pending.hidden = !items.length; overflow.hidden = items.length <= 3; text(overflowLabel, "More pending actions (" + Math.max(0, items.length - 3) + ")");
        for (const [key, record] of pendingRows) if (!wanted.has(key)) { record.node.remove(); pendingRows.delete(key); }
        const positions = new Map([[first, first.firstChild], [extra, extra.firstChild]]);
        for (const [index, item] of items.entries()) {
            let record = pendingRows.get(item.key); const host = index < 3 ? first : extra;
            if (!record) {
                const node = el(host, "article", undefined, "hub-atlas-pending-row"), copy = el(node, "div");
                record = { node, label: el(copy, "strong"), detail: el(copy, "p"), item };
                countdown(copy, "", 0); record.count = copy.querySelector("[data-atlas-deadline]");
                record.action = button(node, "", () => { const current = pendingForBridge(bridge).find(i => i.key === record.item.key); if (current) bridge.open(current.route); });
                pendingRows.set(item.key, record); node.dataset.atlasPendingKey = item.key;
            }
            record.item = item; record.node.dataset.state = item.phase; text(record.label, item.label); text(record.detail, item.detail);
            record.count.hidden = !item.deadline; record.count.dataset.atlasDeadline = String(item.deadline ?? 0); record.count.dataset.atlasLabel = item.phase === "WAITING" ? "Confirmation available in" : "Confirmation window";
            text(record.action, item.route.section === "vault" ? "Review in Vault" : item.route.section === "temporary" ? "Review access request" : "Review recovery");
            const cursor = positions.get(host); if (record.node !== cursor) place(host, record.node, cursor); positions.set(host, record.node.nextSibling);
        }
        announce(items); updateCountdowns(pending, presentationNow(state));
    }
    function cards(container) {
        return keyed(container, destination => {
            const node = el(container, "article", undefined, "hub-atlas-card"), record = { node, value: destination };
            node.dataset.atlasDestinationId = destination.id;
            record.link = button(node, destination.label, () => navigate("https://" + record.value.hostname + "/")); record.link.className = "hub-atlas-destination-link";
            record.host = el(node, "small"); record.more = el(node, "details"); const summary = el(record.more, "summary", "Other entry points"); record.summary = summary;
            const entries = el(record.more, "div");
            record.entries = keyed(entries, host => { const r = { node: null, value: host }; r.node = button(entries, host.hostname, () => navigate("https://" + r.value.hostname + "/")); return r; },
                (r, host) => text(r.node, host.hostname), host => host.hostname);
            return record;
        }, (r, d) => {
            text(r.link, d.label); text(r.host, d.hostname); r.summary.setAttribute("aria-label", d.label + " other entry points");
            const hosts = d.hosts?.filter(h => d.destinations.includes(h.hostname) && h.decision.outcome === "ALLOW") ?? [];
            r.more.hidden = !hosts.length; r.entries(hosts);
            r.node.hidden = !matches(d);
        });
    }
    const syncPinned = cards(pinnedGrid);
    const syncGroups = keyed(groups, category => {
        const node = el(groups, "section"), heading = el(node, "div", undefined, "hub-atlas-section-heading");
        const record = { node, title: el(heading, "h2"), count: el(heading, "small") }; record.cards = cards(el(node, "div", undefined, "hub-atlas-grid")); return record;
    }, (r, category) => { text(r.title, category.name); const count = category.entries.filter(matches).length; text(r.count, count + " destination" + (count === 1 ? "" : "s")); r.node.hidden = !count; r.cards(category.entries); }, category => category.name);
    const matches = d => (d.label + " " + d.category + " " + d.hostname + " " + d.aliases.join(" ") + " " + d.destinations.join(" ")).toLowerCase().includes(search.value.trim().toLowerCase());
    function refreshGrants(state, now) {
        const grants = (state.temporaryDestinations ?? []).filter(g => temporaryGrantUsable(state, g, now));
        noGrants.hidden = !!grants.length; syncGrants(grants); updateCountdowns(temporary, now);
    }
    function refresh() {
        if (disposed) return;
        const state = bridge.view(), now = presentationNow(state); refreshPending();
        const available = state.status === "READY" && state.enabled;
        const destinations = available ? (state.destinations ?? []).filter(d => d.decision?.outcome === "ALLOW" && d.decision.reason === "WHITELISTED") : [];

        text(status, available ? "" : state.status === "UNINITIALIZED" ? "Initialize Atlas to begin with " + (state.starter?.serviceCount ?? "curated") + " destinations." : "Atlas is unavailable. External browsing stays blocked.");
        refreshGrants(state, now);
        const favorites = destinations.filter(d => d.pinned); pinned.hidden = !favorites.some(matches); syncPinned(favorites);
        const categories = [...new Set(destinations.map(d => d.category))].map(name => ({ name, entries: destinations.filter(d => d.category === name) })); syncGroups(categories);
        const visible = destinations.some(matches); empty.hidden = visible || !available;
        text(empty, search.value.trim() ? "No destinations match your search." : "No committed Whitelist destinations. Add one in Sites & Access.");
        setup.hidden = !!available; text(setup, state.status === "UNINITIALIZED" ? "Initialize Atlas" : "Diagnostics & recovery");
    }
    const setup = button(parent, "Initialize Atlas", () => bridge.open({ section: bridge.view().status === "UNINITIALIZED" ? "sites" : "diagnostics" }));
    search.addEventListener("input", refresh);
    const key = event => { if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !event.target.isContentEditable) { event.preventDefault(); search.focus(); } };
    parent.addEventListener("keydown", key);
    const unsubscribe = bridge.subscribe(refresh); refresh();
    const timer = setInterval(() => { refreshPending(); const state = bridge.view(); refreshGrants(state, presentationNow(state)); }, 1000);
    return () => { disposed = true; unsubscribe(); clearInterval(timer); parent.removeEventListener("keydown", key); search.removeEventListener("input", refresh); };
}
module.exports = { mountAtlasHome };
