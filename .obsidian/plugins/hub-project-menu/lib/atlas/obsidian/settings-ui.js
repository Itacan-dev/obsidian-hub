"use strict";
const { el, button, countdown, updateCountdowns, configurationInput, formatMilliseconds, renderNavigation } = require("./ui");
const pages = [["sites", "Sites & Access"], ["temporary", "Temporary Access"], ["timings", "Timings / Behaviour"],
    ["vault", "Vault"], ["managed", "Managed Lists"], ["diagnostics", "Diagnostics / Recovery"]];
const timestamp = value => value === null || value === undefined ? "Never" : new Date(value).toLocaleString();
const phase = proposal => Date.now() < proposal.readyAt ? "WAITING" : Date.now() < proposal.confirmBy ? "READY" : "EXPIRED";
const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
const access = destination => destination.decision?.reason === "BLACKLISTED" ? "BLACKLIST" : destination.decision?.reason === "WHITELISTED" ? "WHITELIST" : "GREYLIST";
function field(parent, label, value = "", type = "text") {
    const wrapper = el(parent, "label", label), input = el(wrapper, "input"); input.type = type; input.value = value; input.setAttribute("aria-label", label); return input;
}
function mountAtlasSettings(parent, bridge) {
    parent.classList.add("hub-atlas-overview");
    const header = el(parent, "header", undefined, "hub-atlas-settings-header"); el(header, "p", "Atlas / Itacan", "hub-atlas-eyebrow"); el(header, "h2", "Your destinations, your terms");
    const status = el(parent, "p", undefined, "hub-atlas-state"), message = el(parent, "p", undefined, "hub-atlas-message"); message.setAttribute("role", "status");
    const onboarding = el(parent, "section", undefined, "hub-atlas-onboarding"), shell = el(parent, "div", undefined, "hub-atlas-settings-shell");
    const navigation = el(shell, "nav"); navigation.setAttribute("aria-label", "Atlas settings sections");
    const sections = new Map(), navButtons = new Map(), signatures = new Map(), mounts = new Map();
    let selected = "sites", mode = null, review = null, disposed = false, reviewKey = null, vaultTick = null, reviewRetryAt = 0;
    const show = id => { const changed = selected !== id; selected = id; for (const [key, node] of sections) {
        if (node.hidden !== (key !== id)) node.hidden = key !== id;
        if (changed && key === id) node.scrollTop = 0;
    } for (const [key, node] of navButtons) { const value = key === id ? "page" : "false"; if (node.getAttribute("aria-current") !== value) node.setAttribute("aria-current", value); } };
    for (const [id, title] of pages) {
        navButtons.set(id, button(navigation, title, () => show(id)));
        const section = el(shell, "section", undefined, "hub-atlas-settings-section"); section.dataset.atlasPage = id; sections.set(id, section);
    }
    const protectedButton = (parent, label, action) => { const node = button(parent, label, action); node.dataset.atlasProtected = ""; return node; };
    async function send(command) {
        try {
            const result = await bridge.command(command);
            const proposed = (command.kind.startsWith("PROPOSE_") || ["IMPORT_CURATED", "RECREATE_POLICY"].includes(command.kind)) && result.type === "COMMITTED" && bridge.view().snapshot?.vaultState.pendingProposal;
            if (result.type === "REVIEW") review = result.review;
            if (command.kind === "CONFIRM_POLICY" && result.type === "COMMITTED") review = null;
            message.textContent = result.type === "REJECTED" || result.type === "BLOCKED" ? result.reason.replaceAll("_", " ") : result.type === "REVIEW" ? "Review the frozen changes in Vault." :
                proposed ? "Proposal saved. Active policy and timing terms stay unchanged until Vault confirmation." : result.type === "COMMITTED" ? "Saved. Only committed values are active." : result.status ?? result.type;
            if (proposed) show("vault");
            refresh(); return result;
        } catch (_) { message.textContent = "The action could not complete. Check Diagnostics / Recovery."; }
    }
    function rebuild(id, signature, render) {
        if (signatures.get(id) === signature) return;
        signatures.set(id, signature); mounts.get(id)?.(); mounts.delete(id);
        const section = sections.get(id); section.replaceChildren(); render(section);
    }
    function editor(parent, destination, state) {
        const draft = el(parent, "section", undefined, "hub-atlas-draft"); el(draft, "p", "Editable draft", "hub-atlas-eyebrow"); el(draft, "h3", destination ? "Edit destination" : "Add a destination");
        el(draft, "p", "Host policy stays unchanged until Vault confirmation succeeds. Names, categories and pins are display preferences.");
        const form = el(draft, "div", undefined, "hub-atlas-form-grid"), name = field(form, "Name", destination?.label ?? ""), hostname = field(form, "Primary hostname", destination?.hostname ?? "");
        const accessLabel = el(form, "label", "Access"), choice = el(accessLabel, "select"); choice.setAttribute("aria-label", "Access");
        for (const [value, label] of [["WHITELIST", "Whitelist"], ["BLACKLIST", "Blacklist"], ["GREYLIST", "Greylist"]]) { const option = el(choice, "option", label); option.value = value; }
        choice.value = destination ? access(destination) : "WHITELIST";
        let accessEdited = false;
        const category = field(form, "Category", destination?.category ?? "My destinations"), wwwLabel = el(draft, "label", undefined, "hub-atlas-check"), www = el(wwwLabel, "input"); www.type = "checkbox";
        const wwwText = el(wwwLabel, "span"), othersLabel = el(draft, "label", "Other explicit hostnames"), others = el(othersLabel, "textarea"); others.rows = 3; others.setAttribute("aria-label", "Other explicit hostnames");
        others.value = [...(destination?.aliases ?? []), ...(destination?.destinations ?? [])].filter(h => h !== `www.${destination?.hostname}`).join("\n");
        www.checked = destination?.aliases.includes(`www.${destination.hostname}`) ?? false;
        const pinLabel = el(draft, "label", undefined, "hub-atlas-check"), pin = el(pinLabel, "input"); pin.type = "checkbox"; pin.checked = destination?.pinned ?? false; el(pinLabel, "span", "Pin on Home after commit");
        const preview = el(draft, "p", undefined, "hub-atlas-exact-hosts");
        const readHosts = () => [...new Set([hostname.value.trim().toLowerCase(), ...(www.checked && !www.disabled ? [`www.${hostname.value.trim().toLowerCase()}`] : []), ...others.value.split(/[\n,]/).map(h => h.trim().toLowerCase()).filter(Boolean)])];
        const displayOnly = () => destination && !accessEdited && choice.value === access(destination) && hostname.value.trim().toLowerCase() === destination.hostname &&
            JSON.stringify(readHosts().sort()) === JSON.stringify([destination.hostname, ...destination.aliases, ...destination.destinations].sort());
        const update = () => { const primary = hostname.value.trim().toLowerCase(); www.disabled = !primary || primary.startsWith("www."); wwwText.textContent = `Include www.${primary || "example.com"} (exact host)`; preview.textContent = `Proposed exact hosts: ${readHosts().filter(Boolean).join(", ") || "Enter a hostname"}. No wildcard access.`; submit.textContent = displayOnly() ? "Save display details" : "Review change in Vault"; };
        const submit = protectedButton(draft, "Review change in Vault", async () => {
            if (displayOnly()) {
                const result = await send({ kind: "SAVE_DISPLAY_DETAILS", destinationId: destination.id, label: name.value.trim(), category: category.value.trim(), pinned: pin.checked,
                    basePolicyRevision: state.snapshot.policyRevision, baseApplicationRevision: state.application.revision });
                if (result?.type === "COMMITTED") draft.remove(); return;
            }
            const all = readHosts(), primary = hostname.value.trim().toLowerCase(), originalDestinations = destination?.destinations ?? [];
            const entry = { id: destination?.id ?? `destination:${primary}`, label: name.value.trim(), category: category.value.trim(), hostname: primary,
                aliases: all.filter(h => h !== primary && !originalDestinations.includes(h)), destinations: all.filter(h => originalDestinations.includes(h)), pinned: pin.checked };
            const result = await send({ kind: "PROPOSE_DESTINATION", destination: entry, access: choice.value, previousId: destination?.id ?? null,
                basePolicyRevision: state.snapshot.policyRevision, baseApplicationRevision: state.application.revision });
            if (result?.type === "COMMITTED") draft.remove();
        });
        for (const node of [hostname, www, others]) node.addEventListener("input", update);
        choice.addEventListener("change", () => { accessEdited = true; update(); }); update();
        button(draft, "Discard draft", () => draft.remove()); sections.get("sites").scrollTop = 0; name.focus({ preventScroll: true }); return draft;
    }
    function refresh() {
        if (disposed) return;
        const state = bridge.view(), snapshot = state.snapshot, application = state.application;
        setText(status, state.status === "READY" ? `Committed policy · revision ${snapshot.policyRevision}` : `Atlas: ${state.status.toLowerCase()}${state.reason ? ` · ${state.reason}` : ""}`);
        const nextMode = state.status === "UNINITIALIZED" ? "setup" : snapshot ? "ready" : "unavailable";
        if (nextMode !== mode) {
            mode = nextMode; onboarding.replaceChildren();
            if (mode === "setup") {
                el(onboarding, "h3", "Initialize Atlas"); el(onboarding, "p", `${state.starter.serviceCount} curated destinations, ${state.starter.hostCount} explicit hosts. Nothing is applied until you initialize.`);
                for (const group of state.starter?.groups ?? []) el(onboarding, "span", `${group.label} · ${group.count}`, "hub-atlas-category-chip");
                const terms = el(onboarding, "details"); el(terms, "summary", "Review timing terms");
                const readConfiguration = configurationInput(terms, state.initialConfiguration);
                button(onboarding, "Initialize Atlas", async () => { try { await send({ kind: "INITIALIZE_CURATED", configuration: readConfiguration() }); } catch (error) { message.textContent = error.message; } });
                const advanced = el(onboarding, "details"); el(advanced, "summary", "Advanced: exact starter hosts or custom initial policy");
                const whitelistLabel = el(advanced, "label", "Whitelist"), whitelist = el(whitelistLabel, "textarea"); whitelist.rows = 5; whitelist.value = state.starter?.policy.whitelist.join("\n") ?? "";
                const blacklistLabel = el(advanced, "label", "Blacklist"), blacklist = el(blacklistLabel, "textarea"); blacklist.rows = 3;
                button(advanced, "Initialize custom policy", async () => { try { await send({ kind: "INITIALIZE", policy: { whitelist: whitelist.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean), blacklist: blacklist.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean) }, configuration: readConfiguration() }); } catch (error) { message.textContent = error.message; } });
            } else if (mode === "unavailable") {
                el(onboarding, "p", "Saved authority could not be established. Browsing stays blocked. Recovery reconciles saved state and never resets it."); button(onboarding, "Recover saved state", () => send({ kind: "RECOVER" }));
            }
        }
        shell.hidden = !snapshot;
        if (!snapshot) { show(selected); return; }
        // Sites list and draft have independent lifetimes. Core housekeeping and
        // countdowns cannot destroy focused controls or partially entered text.
        const sites = sections.get("sites");
        if (!sites.dataset.mounted) {
            sites.dataset.mounted = "true"; el(sites, "h3", "Sites & Access"); el(sites, "p", "Explicit hosts, never wildcard permission. Protected changes are frozen and reviewed in Vault.");
            const actions = el(sites, "div", undefined, "hub-atlas-site-actions"), importHint = el(sites, "p", undefined, "hub-atlas-muted");
            const draftHost = el(sites, "div"), search = field(sites, "Search destinations", "", "search"), list = el(sites, "div", undefined, "hub-atlas-site-list");
            const renderList = () => {
                const current = bridge.view(), entries = (current.destinations ?? []).filter(d => `${d.label} ${d.category} ${d.hostname} ${d.aliases.join(" ")} ${d.destinations.join(" ")}`.toLowerCase().includes(search.value.toLowerCase()));
                const signature = JSON.stringify([current.status, entries]); if (list.dataset.signature === signature) return; list.dataset.signature = signature; list.replaceChildren();
                for (const destination of entries) {
                    const row = el(list, "article", undefined, "hub-atlas-site-row"), copy = el(row, "div"); el(copy, "h4", destination.label); el(copy, "small", `${destination.category} · ${destination.hostname}`);
                    el(copy, "p", [...destination.aliases, ...destination.destinations].join(", ") || "Primary exact hostname only", "hub-atlas-muted");
                    const different = destination.hosts?.filter(h => h.decision.reason !== destination.decision?.reason) ?? [];
                    for (const host of different) el(copy, "small", `${host.hostname}: ${host.decision.reason.replaceAll("_", " ").toLowerCase()}`);
                    el(row, "span", destination.decision?.reason === "MANAGED_BLACKLISTED" ? "Managed blocked" : destination.decision?.reason === "ACTIVE_GRANT" ? "Temporary access" : access(destination).toLowerCase(), "hub-atlas-badge");
                    protectedButton(row, destination.pinned ? "Unpin" : "Pin", () => send({ kind: "SAVE_DISPLAY_DETAILS", destinationId: destination.id, label: destination.label, category: destination.category, pinned: !destination.pinned,
                        basePolicyRevision: current.snapshot.policyRevision, baseApplicationRevision: current.application.revision }));
                    protectedButton(row, "Edit", () => { draftHost.replaceChildren(); editor(draftHost, destination, current); });
                    protectedButton(row, "Remove", () => send({ kind: "PROPOSE_DESTINATION", destination: null, access: "GREYLIST", previousId: destination.id,
                        basePolicyRevision: current.snapshot.policyRevision, baseApplicationRevision: current.application.revision }));
                }
                if (!entries.length) el(list, "p", "No destinations match.");
            };
            search.addEventListener("input", renderList); sites.renderList = renderList;
            protectedButton(actions, "Add a destination", () => { draftHost.replaceChildren(); editor(draftHost, null, bridge.view()); });
            const curatedImport = protectedButton(actions, "Review curated updates in Vault", () => send({ kind: "IMPORT_CURATED" }));
            sites.updateImport = current => {
                const missing = current.starter.policy.whitelist.filter(h => !current.snapshot.policy.whitelist.includes(h));
                curatedImport.hidden = !missing.length; importHint.hidden = !missing.length;
                setText(importHint, `${missing.length} curated hosts are missing from your Whitelist, including ${missing.slice(0, 3).join(", ")}. Import preserves your manual Blacklist and display preferences; confirmation is required.`);
            };
        }
        sites.renderList(); sites.updateImport(state);
        const pendingRequests = snapshot.accessState.pendingRequests, grants = snapshot.accessState.grants, now = Date.now();
        const temporarySignature = JSON.stringify([snapshot.policyRevision, grants.map(g => [g, g.expiresAt > now]), pendingRequests.map(r => [r, now < r.readyAt ? "waiting" : now <= r.confirmBy ? "ready" : "expired"]),
            state.contexts.filter(c => c.origin && c.closed).map(c => [c.id, c.generation, c.phase, c.response?.decision, c.response?.reason, c.journey])]);
        rebuild("temporary", temporarySignature, section => {
            el(section, "h3", "Temporary Access"); el(section, "p", "Temporary grants expire. They do not become Whitelist entries.");
            if (!grants.length) el(section, "p", "No temporary grants.");
            for (const grant of grants) { const row = el(section, "article", undefined, "hub-atlas-site-row"); el(row, "strong", grant.hostname); el(row, "span", grant.expiresAt > now && grant.policyRevision === snapshot.policyRevision ? "Active" : "Expired / invalidated"); countdown(row, "Remaining", grant.expiresAt); }
            el(section, "h4", "Pending requests");
            for (const request of pendingRequests) { el(section, "p", `${request.hostname} · ${now < request.readyAt ? "Waiting" : now <= request.confirmBy ? "Confirmation available" : "Expired"}`); countdown(section, "Ready in", request.readyAt); countdown(section, "Confirmation window", request.confirmBy); }
            for (const context of state.contexts.filter(c => c.origin && ["BLOCKED", "ENFORCEMENT_FAILED"].includes(c.phase))) renderNavigation(el(section, "section", undefined, "hub-atlas-panel"), state, context, bridge);
        });
        if (!sections.get("timings").dataset.mounted) {
            const section = sections.get("timings"); section.dataset.mounted = "true"; el(section, "h3", "Timings / Behaviour");
            el(section, "p", "Waits make confirmation available. Fixed grant and Journey terms never extend because you browse or reload. Existing terms remain active until Vault commits.");
            const form = el(section, "div", undefined, "hub-atlas-timing-form");
            const reset = () => { form.replaceChildren(); const read = configurationInput(form, bridge.view().snapshot.configuration);
                protectedButton(form, "Review timing change in Vault", async () => { try { await send({ kind: "PROPOSE_SETTINGS", candidateConfiguration: read() }); } catch (error) { message.textContent = error.message; } }); };
            reset(); button(section, "Reload committed timings", reset);
        }
        const pending = snapshot.vaultState.pendingProposal;
        if (review?.proposalId !== pending?.id) review = null;
        rebuild("vault", JSON.stringify([pending, snapshot.policyRevision, snapshot.configurationRevision, application?.pending]), section => {
            vaultTick = null;
            section.classList.add("hub-atlas-vault");
            el(section, "h3", "Vault"); el(section, "p", `Active policy revision ${snapshot.policyRevision} · configuration revision ${snapshot.configurationRevision}. Waiting alone never applies a proposal.`);
            if (!pending) { el(section, "p", "No pending proposal. Policy and timing changes share one protected slot."); return; }
            const summary = el(section, "div", undefined, "hub-atlas-vault-status"), phaseLabel = el(summary, "strong"), wait = el(summary, "div"), window = el(summary, "div"), explanation = el(summary, "p");
            countdown(wait, "Confirmation available in", pending.readyAt); countdown(window, "Confirm within", pending.confirmBy);
            const details = el(section, "div", undefined, "hub-atlas-vault-details"), changes = el(details, "div");
            el(details, "small", `Created ${timestamp(pending.createdAt)} · Confirmation deadline ${timestamp(pending.confirmBy)}`);
            if (application?.pending) for (const draft of application.pending.destinations) {
                const old = application.destinations.find(d => d.id === draft.id);
                if (!old) el(details, "p", `Add ${draft.label} · ${draft.category} · ${draft.pinned ? "Pinned" : "Unpinned"}`);
                else for (const [key, label] of [["label", "Name"], ["category", "Category"], ["pinned", "Pin on Home"]]) {
                    if (old[key] !== draft[key]) el(details, "p", `${label}: ${old[key]} → ${draft[key]}`);
                }
            }
            if (application?.pending) for (const old of application.destinations) if (!application.pending.destinations.some(d => d.id === old.id)) el(details, "p", `Remove ${old.label} (${old.hostname})`);
            const actions = el(section, "footer", undefined, "hub-atlas-vault-actions");
            const confirm = protectedButton(actions, "Confirm change", () => send({ kind: "CONFIRM_POLICY", proposalId: pending.id })); confirm.classList.add("hub-atlas-primary");
            const recreate = protectedButton(actions, "Recreate proposal", () => send({ kind: "RECREATE_POLICY", proposalId: pending.id }));
            protectedButton(actions, "Cancel proposal", () => send({ kind: "CANCEL_POLICY", proposalId: pending.id }));
            let changesSignature = null;
            vaultTick = () => {
                const current = bridge.view(), active = current.snapshot?.vaultState.pendingProposal;
                if (active?.id !== pending.id) return;
                const currentPhase = phase(pending), available = current.status === "READY";
                setText(phaseLabel, currentPhase === "READY" ? "Ready to confirm" : currentPhase === "WAITING" ? "Waiting" : "Expired");
                wait.hidden = currentPhase !== "WAITING"; window.hidden = currentPhase !== "READY";
                setText(explanation, currentPhase === "EXPIRED" ? "Nothing changed. Recreate this proposal to start a fresh wait, or cancel it." : "Your current policy stays active until you confirm and the change is saved.");
                confirm.dataset.atlasNotReady = currentPhase !== "READY" || review?.phase !== "READY" ? "true" : "false";
                confirm.disabled = !available || confirm.dataset.atlasNotReady === "true" || confirm.dataset.atlasBusy === "true";
                recreate.hidden = currentPhase !== "EXPIRED"; recreate.disabled = !available || recreate.dataset.atlasBusy === "true";
                if (review?.proposalId === pending.id) {
                    const signature = JSON.stringify([review.classifications, review.whitelist, review.blacklist, review.currentConfiguration, review.candidateConfiguration]);
                    if (signature !== changesSignature) {
                        changesSignature = signature; changes.replaceChildren();
                        for (const change of review.classifications) el(changes, "p", `${change.hostname}: ${change.before.toLowerCase()} → ${change.after.toLowerCase()}`);
                        for (const list of ["whitelist", "blacklist"]) {
                            if (review[list].added.length) el(changes, "p", `${list} additions: ${review[list].added.join(", ")}`);
                            if (review[list].removed.length) el(changes, "p", `${list} removals: ${review[list].removed.join(", ")}`);
                        }
                        const before = review.currentConfiguration, after = review.candidateConfiguration;
                        if (before && after) for (const [group, values] of Object.entries(before)) for (const key of Object.keys(values)) {
                            if (before[group][key] !== after[group][key]) el(changes, "p", `${group}.${key}: ${key.endsWith("Ms") ? formatMilliseconds(before[group][key]) + " s" : before[group][key]} → ${key.endsWith("Ms") ? formatMilliseconds(after[group][key]) + " s" : after[group][key]}`);
                        }
                    }
                }
                const key = `${pending.id}:${currentPhase}`;
                if (available && reviewKey !== key && Date.now() >= reviewRetryAt) {
                    reviewKey = key;
                    void bridge.command({ kind: "REVIEW_POLICY", proposalId: pending.id }).then(result => {
                        if (disposed || bridge.view().snapshot?.vaultState.pendingProposal?.id !== pending.id) return;
                        if (result.type === "REVIEW") {
                            review = result.review;
                            // A queued result may straddle a phase boundary.
                            // Refresh its Core review once more on the next tick.
                            if (review.phase !== phase(pending)) { reviewKey = null; reviewRetryAt = Date.now() + 250; }
                        }
                        else { setText(message, result.reason?.replaceAll("_", " ") ?? "Proposal review is unavailable."); reviewKey = null; reviewRetryAt = Date.now() + 1000; }
                        vaultTick?.();
                    }).catch(() => { setText(message, "Proposal review could not complete. Retrying when authority is available."); reviewKey = null; reviewRetryAt = Date.now() + 1000; });
                }
            };
        });
        vaultTick?.();
        rebuild("managed", JSON.stringify(state.managed), section => {
            el(section, "h3", "StevenBlack"); el(section, "p", "Managed blocking is enabled separately from your manual policy. Refreshing data requires no Vault wait. Explicit Whitelist exceptions retain Core's precedence.");
            const managed = state.managed;
            if (!managed) { el(section, "p", "Managed service is unavailable in this host."); return; }
            el(section, "p", `${managed.count.toLocaleString()} exact hosts · ${managed.origin.toLowerCase()} · ${managed.status.toLowerCase().replaceAll("_", " ")}`);
            el(section, "p", `Last successful sync: ${timestamp(managed.lastSuccessfulSync)} · Last attempt: ${timestamp(managed.lastAttemptAt)}`);
            el(section, "p", `Categories: ${managed.categories.join(", ")}`); el(section, "p", managed.source, "hub-atlas-source");
            if (managed.version) el(section, "p", `Version: ${managed.version}`, "hub-atlas-source"); if (managed.error) el(section, "p", `Most recent error: ${managed.error}`);
            if (managed.hash) el(section, "p", `SHA-256: ${managed.hash}`, "hub-atlas-source");
            if (managed.conflicts.length) el(section, "p", `Explicit Whitelist exceptions: ${managed.conflicts.join(", ")}`);
            button(section, "Refresh now", () => send({ kind: "REFRESH_MANAGED" }), managed.status === "UPDATING");
            const lookup = field(section, "Look up an exact hostname"), result = el(section, "p");
            button(section, "Look up", async () => { const response = await bridge.command({ kind: "LOOKUP_MANAGED", hostname: lookup.value.trim() }); result.textContent = response.type === "MANAGED_LOOKUP" ? `${response.hostname}: ${response.blocked === null ? "Authority unavailable" : response.blocked ? "In managed list" : "Not in managed list"}` : response.reason; });
        });
        rebuild("diagnostics", JSON.stringify([state.status, state.reason, state.repositoryIssue, snapshot.policyRevision, snapshot.configurationRevision,
            application?.revision, snapshot.accessState.grants.length, pendingRequests.length, snapshot.journeyState.journeys, pending?.id, state.managed?.status,
            state.managed?.count, state.managed?.lastSuccessfulSync, (state.temporaryDestinations ?? []).filter(g => g.decision.outcome === "ALLOW").length]), section => {
            el(section, "h3", "Diagnostics / Recovery");
            for (const line of [`Authority: ${state.status} · ${state.reason ?? "available"}`, `Policy revision ${snapshot.policyRevision} · configuration revision ${snapshot.configurationRevision}`,
                `Storage envelope schema 2 · application schema ${application?.schemaVersion ?? "unavailable"}`,
                `Whitelist ${snapshot.policy.whitelist.length} · manual Blacklist ${snapshot.policy.blacklist.length} · managed ${state.managed?.count ?? "unavailable"}`,
                `Active grants ${(state.temporaryDestinations ?? []).filter(g => g.decision.outcome === "ALLOW").length} · saved grants ${grants.length} · pending requests ${pendingRequests.length} · Vault proposal ${pending?.id ?? "none"}`,
                `Managed sync ${state.managed?.status ?? "unavailable"} · last success ${timestamp(state.managed?.lastSuccessfulSync)}`]) el(section, "p", line);
            const version = el(section, "p", `Storage version: ${state.storageVersion}`, "hub-atlas-source"); version.dataset.atlasStorageVersion = "";
            if (state.repositoryIssue) el(section, "p", `Storage issue: ${state.repositoryIssue}`);
            for (const journey of snapshot.journeyState.journeys) el(section, "p", `${journey.rootHostname} → ${journey.currentHostname} · ${journey.phase.toLowerCase()}${journey.endReason ? ` · ${journey.endReason.toLowerCase()}` : ""}`);
            el(section, "p", "Recovery reloads and reconciles authority. It never clears your policy, confirms a proposal or replays a browser request."); button(section, "Recover saved state", () => send({ kind: "RECOVER" }));
        });
        const version = parent.querySelector("[data-atlas-storage-version]"); if (version) setText(version, `Storage version: ${state.storageVersion}`);
        for (const node of parent.querySelectorAll("[data-atlas-protected]")) { node.dataset.atlasUnavailable = state.status !== "READY" ? "true" : "false";
            node.disabled = node.dataset.atlasUnavailable === "true" || node.dataset.atlasNotReady === "true" || node.dataset.atlasBusy === "true"; }
        updateCountdowns(parent); show(selected);
    }
    const unsubscribe = bridge.subscribe(refresh); refresh();
    const timer = setInterval(() => { vaultTick?.(); updateCountdowns(parent); }, 250);
    return () => { disposed = true; clearInterval(timer); unsubscribe(); for (const dispose of mounts.values()) dispose(); parent.classList.remove("hub-atlas-overview"); };
}
module.exports = { mountAtlasSettings };
