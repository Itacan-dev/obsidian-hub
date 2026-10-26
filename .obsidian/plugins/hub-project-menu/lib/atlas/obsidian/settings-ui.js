"use strict";
const { el, button, countdown, updateCountdowns, configurationInput, formatMilliseconds, renderNavigation } = require("./ui");
const { getAtlasSession, createDestinationDraft, draftBase } = require("./session");
const { describeOutcome, describeAuthorityFailure, storageSummary } = require("./feedback");
const { normalizeTarget } = require("../core/target");
const { pendingActions, phaseAt, presentationNow } = require("./pending");
const { keyed, phaseAnnouncer, text: setText } = require("./dom");
let settingsInstance = 0;
const pages = [["sites", "Sites & Access"], ["temporary", "Temporary Access"], ["timings", "Timings / Behaviour"],
    ["vault", "Vault"], ["managed", "Managed Lists"], ["diagnostics", "Diagnostics / Recovery"]];
const timestamp = value => value === null || value === undefined ? "Never" : new Date(value).toLocaleString();
const access = destination => destination.decision?.reason === "BLACKLISTED" ? "BLACKLIST" : destination.decision?.reason === "WHITELISTED" ? "WHITELIST" : "GREYLIST";
const manualAccess = (policy, hostname) => policy.blacklist.includes(hostname) ? "BLACKLIST" : policy.whitelist.includes(hostname) ? "WHITELIST" : "GREYLIST";
function field(parent, label, value = "", type = "text") {
    const wrapper = el(parent, "label", label), input = el(wrapper, "input"); input.type = type; input.value = value; input.setAttribute("aria-label", label); return input;
}
function mountAtlasSettings(parent, bridge) {
    const session = getAtlasSession(bridge), prefix = "atlas-settings-" + ++settingsInstance; const announce = phaseAnnouncer(parent); let captureDraft = null, draftAvailability = null, captureTimings = null, captureSetup = null, temporalSignature = null;
    const phase = proposal => phaseAt(proposal, presentationNow(bridge.view()));
    parent.classList.add("hub-atlas-overview");
    const header = el(parent, "header", undefined, "hub-atlas-settings-header"); el(header, "p", "Atlas / Itacan", "hub-atlas-eyebrow"); el(header, "h2", "Your destinations, your terms");
    const status = el(parent, "p", undefined, "hub-atlas-state"), message = el(parent, "p", undefined, "hub-atlas-message"); message.setAttribute("role", "status");
    const sessionSummary = el(parent, "div", undefined, "hub-atlas-edit-session"); sessionSummary.setAttribute("role", "status");
    const onboarding = el(parent, "section", undefined, "hub-atlas-onboarding");
    // Startup failures have no verified snapshot, so the ordinary settings
    // shell cannot render. Keep their diagnostics outside that shell.
    const startupDiagnostics = el(parent, "section", undefined, "hub-atlas-startup-diagnostics");
    startupDiagnostics.setAttribute("aria-label", "Diagnostics / Recovery");
    el(startupDiagnostics, "h3", "Diagnostics / Recovery");
    const startupCause = el(startupDiagnostics, "p"), startupCodes = el(startupDiagnostics, "p");
    const shell = el(parent, "div", undefined, "hub-atlas-settings-shell");
    const navigation = el(shell, "nav"); navigation.setAttribute("aria-label", "Atlas settings sections");
    const sections = new Map(), navButtons = new Map(), signatures = new Map(), mounts = new Map();
    let selected = session.route.section, mode = null, review = null, disposed = false, reviewKey = null, vaultTick = null, reviewRetryAt = 0;
    const show = id => { const changed = selected !== id; selected = id; session.route = { section: id, context: session.route.section === id ? session.route.context : null }; for (const [key, node] of sections) {
        if (node.hidden !== (key !== id)) node.hidden = key !== id;
    } for (const [key, node] of navButtons) { const value = key === id ? "page" : "false"; if (node.getAttribute("aria-current") !== value) node.setAttribute("aria-current", value); node.setAttribute("aria-selected", String(key === id)); node.tabIndex = key === id ? 0 : -1; } if (changed) navButtons.get(id)?.scrollIntoView({ block: "nearest", inline: "nearest" }); };
    navigation.setAttribute("role", "tablist");
    for (const [id, title] of pages) {
        const tab = button(navigation, title, () => show(id)); tab.id = prefix + "-" + id; tab.setAttribute("role", "tab"); tab.setAttribute("aria-controls", prefix + "-" + id + "-panel"); navButtons.set(id, tab);
        const section = el(shell, "section", undefined, "hub-atlas-settings-section"); section.id = prefix + "-" + id + "-panel"; section.setAttribute("role", "tabpanel"); section.setAttribute("aria-labelledby", tab.id); section.tabIndex = -1; section.dataset.atlasPage = id; sections.set(id, section);
    }
    navigation.addEventListener("keydown", event => {
        const index = [...navButtons.values()].indexOf(event.target); if (index < 0) return;
        const next = event.key === "ArrowRight" ? (index + 1) % pages.length : event.key === "ArrowLeft" ? (index + pages.length - 1) % pages.length : event.key === "Home" ? 0 : event.key === "End" ? pages.length - 1 : null;
        if (next === null) return; event.preventDefault(); const id = pages[next][0]; show(id); navButtons.get(id).focus();
    });
    const protectedButton = (parent, label, action) => { const node = button(parent, label, action); node.dataset.atlasProtected = ""; return node; };
    const navigate = route => { if (bridge.open) bridge.open(route); else session.navigate(route); };
    function focusRoute() {
        const context = session.route.context;
        const section = sections.get(selected);
        if (!context) { section.focus({ preventScroll: true }); return; }
        for (const [key, value] of Object.entries(context)) {
            const attribute = "atlas" + key[0].toUpperCase() + key.slice(1);
            const node = [...section.querySelectorAll("[data-" + attribute.replace(/[A-Z]/g, c => "-" + c.toLowerCase()) + "]")].find(n => n.dataset[attribute] === String(value));
            if (node) { node.tabIndex = -1; node.focus({ preventScroll: true }); node.scrollIntoView({ block: "nearest" }); }
        }
    }
    const paint = (target, feedback) => {
        target.replaceChildren(); if (!feedback) return;
        target.dataset.tone = feedback.tone; el(target, "span", feedback.text);
        if (feedback.detail) target.title = feedback.detail;
        if (feedback.section) button(target, feedback.section === "vault" ? "Open Vault" : feedback.section === "diagnostics" ? "Open recovery" : "Review current state", () => navigate({ section: feedback.section }));
    };
    function updateSessionSummary() {
        const destination = session.draft && (session.draft.dirty || session.draft.submission), timing = session.timings?.dirty;
        const signature = JSON.stringify([destination ? session.draft.token : null, session.draft?.submission?.status, timing, session.timings?.busy, session.timings?.unresolved]);
        sessionSummary.hidden = !destination && !timing;
        if (sessionSummary.dataset.signature === signature) return;
        sessionSummary.dataset.signature = signature; sessionSummary.replaceChildren();
        if (destination || timing) el(sessionSummary, "span", session.draft?.submission?.status === "unresolved" || session.timings?.unresolved ? "Submission outcome unresolved. Your local copy is kept." : session.draft?.submission?.status === "submitting" || session.timings?.busy ? "Saving. Your local copy is kept until the outcome is verified." : "Unsubmitted edits are kept for this session.");
        if (destination) button(sessionSummary, "Resume destination draft", () => navigate({ section: "sites" }));
        if (timing) button(sessionSummary, "Resume timing draft", () => navigate({ section: "timings" }));
    }
    async function send(command) {
        if (["INITIALIZE", "INITIALIZE_CURATED"].includes(command.kind)) captureSetup?.();
        let result;
        try { result = await bridge.command(command); }
        catch (_) { result = { type: "BLOCKED", reason: "TRANSPORT_UNRESOLVED" }; }
        const proposed = (command.kind.startsWith("PROPOSE_") || ["IMPORT_CURATED", "RECREATE_POLICY", "RESTORE_RECOVERY"].includes(command.kind)) && result.type === "COMMITTED" && bridge.view().snapshot?.vaultState.pendingProposal;
        if (result.type === "REVIEW") review = result.review;
        if (command.kind === "CONFIRM_POLICY" && result.type === "COMMITTED") review = null;
        if (bridge.view().status === "READY") session.setup = null;
        session.feedback = describeOutcome(command, result, bridge.view()); paint(message, session.feedback);
        if (proposed) { session.navigate({ section: "vault", context: { proposalId: bridge.view().snapshot.vaultState.pendingProposal.id } }); }
        refresh(); return result;
    }
    function beginEditor(parent, destination, state) {
        captureDraft?.();
        if (session.draft && destination && session.draft.base.destination?.id === destination.id) {
            if (!parent.querySelector(".hub-atlas-draft")) editor(parent, session.draft.base.destination, state);
            parent.querySelector('[aria-label="Name"]')?.focus(); return;
        }
        if (session.draft && (session.draft.dirty || session.draft.submission)) {
            parent.querySelector(".hub-atlas-replace-draft")?.remove();
            const choice = el(parent, "div", undefined, "hub-atlas-replace-draft"); choice.setAttribute("role", "status");
            el(choice, "p", "An unfinished draft is kept for this session. Continue it or explicitly discard it before starting another.");
            button(choice, "Continue current edit", () => { choice.remove(); parent.querySelector('[aria-label="Name"]')?.focus(); });
            button(choice, "Discard and start requested edit", () => {
                if (session.draft?.submission?.status === "submitting") { el(choice, "p", "Wait for the current save outcome before replacing this draft."); return; }
                const current = bridge.view(), latest = destination ? current.application?.destinations.find(d => d.id === destination.id) : null;
                if (destination && !latest) { el(choice, "p", "The requested destination was removed. Your existing draft is still kept."); return; }
                session.draft = null; captureDraft = null; draftAvailability = null; parent.replaceChildren(); editor(parent, latest, current);
            });
            return;
        }
        session.draft = null; captureDraft = null; draftAvailability = null; parent.replaceChildren(); editor(parent, destination, state);
    }
    function rebuild(id, signature, render) {
        if (signatures.get(id) === signature) return;
        signatures.set(id, signature); mounts.get(id)?.(); mounts.delete(id);
        const section = sections.get(id), established = !!section.firstChild, top = established ? section.scrollTop : 0;
        const expanded = new Set([...section.querySelectorAll("details[open]")].map(d => d.querySelector("summary")?.textContent));
        section.replaceChildren(); render(section);
        for (const d of section.querySelectorAll("details")) if (expanded.has(d.querySelector("summary")?.textContent)) d.open = true;
        if (established) section.scrollTop = top;
    }
    function editor(parent, destination, state) {
        const model = session.draft ?? createDestinationDraft(state, destination); session.draft = model;
        destination = model.base.destination;
        state = { snapshot: { policyRevision: model.base.policyRevision }, application: { revision: model.base.applicationRevision } };
        const baseAccess = hostname => model.base.classes[hostname] ?? "GREYLIST", draftId = model.id;
        const draft = el(parent, "section", undefined, "hub-atlas-draft"); el(draft, "p", "Editable draft", "hub-atlas-eyebrow"); el(draft, "h3", destination ? "Edit destination" : "Add a destination");
        el(draft, "p", "Host policy stays unchanged until Vault confirmation succeeds. Names, categories and pins are display preferences.");
        const occupancy = el(draft, "div", undefined, "hub-atlas-proposal-occupancy"), notice = el(draft, "div", undefined, "hub-atlas-draft-feedback"); notice.setAttribute("role", "status");
        const form = el(draft, "div", undefined, "hub-atlas-form-grid"), name = field(form, "Name", destination?.label ?? ""), hostname = field(form, "Primary hostname", destination?.hostname ?? "");
        const selectAccess = (parent, label) => {
            const wrapper = el(parent, "label", label), select = el(wrapper, "select"); select.setAttribute("aria-label", label);
            for (const [value, text] of [["WHITELIST", "Whitelist"], ["BLACKLIST", "Blacklist"], ["GREYLIST", "Greylist"]]) { const option = el(select, "option", text); option.value = value; }
            return select;
        };
        const choice = selectAccess(form, "Primary host access");
        choice.value = destination ? baseAccess(destination.hostname) : "WHITELIST";
        const category = field(form, "Category", destination?.category ?? "My destinations"), wwwLabel = el(draft, "label", undefined, "hub-atlas-check"), www = el(wwwLabel, "input"); www.type = "checkbox";
        const wwwText = el(wwwLabel, "span"), othersLabel = el(draft, "label", "Other explicit hostnames"), others = el(othersLabel, "textarea"); others.rows = 3; others.setAttribute("aria-label", "Other explicit hostnames");
        others.value = [...(destination?.aliases ?? []), ...(destination?.destinations ?? [])].filter(h => h !== "www." + destination?.hostname).join("\n");
        www.checked = [...(destination?.aliases ?? []), ...(destination?.destinations ?? [])].includes("www." + destination?.hostname);
        const allLabel = el(draft, "label", undefined, "hub-atlas-check"), allHosts = el(allLabel, "input"); allHosts.type = "checkbox"; allHosts.setAttribute("aria-label", "Apply primary access to all hosts"); el(allLabel, "span", "Apply primary access to every listed host");
        el(draft, "p", "Existing aliases keep their own access unless you change them below or explicitly select every host.", "hub-atlas-muted");
        const hostControls = el(draft, "div", undefined, "hub-atlas-host-access"), overrides = new Map(), selects = new Map();
        const pinLabel = el(draft, "label", undefined, "hub-atlas-check"), pin = el(pinLabel, "input"); pin.type = "checkbox"; pin.setAttribute("aria-label", "Pin on Home after commit"); pin.checked = destination?.pinned ?? false; el(pinLabel, "span", "Pin on Home after commit");
        const preview = el(draft, "p", undefined, "hub-atlas-exact-hosts"), conflict = el(draft, "div", undefined, "hub-atlas-draft-conflict"); conflict.setAttribute("role", "status");
        const primary = () => hostname.value.trim().toLowerCase(), extraHosts = () => others.value.split(/[\n,]/).map(h => h.trim().toLowerCase()).filter(Boolean);
        const readHosts = () => [...new Set([primary(), ...(www.checked && !www.disabled ? ["www." + primary()] : []), ...extraHosts()])].filter(Boolean);
        const initialHosts = () => destination ? [destination.hostname, ...destination.aliases, ...destination.destinations] : [];
        const hostAccess = () => readHosts().map(hostname => ({ hostname, access: hostname === primary() || allHosts.checked ? choice.value : overrides.get(hostname) ??
            (initialHosts().includes(hostname) || baseAccess(hostname) !== "GREYLIST" ? baseAccess(hostname) : choice.value) }));
        const draftSignature = () => JSON.stringify([name.value, hostname.value, category.value, others.value, www.checked, allHosts.checked, pin.checked, choice.value, hostAccess()]);
        const displayOnly = () => destination && primary() === destination.hostname &&
            JSON.stringify(readHosts().sort()) === JSON.stringify(initialHosts().sort()) &&
            hostAccess().every(h => h.access === baseAccess(h.hostname));
        const readFields = () => ({ name: name.value, hostname: hostname.value, access: choice.value, category: category.value,
            www: www.checked, others: others.value, allHosts: allHosts.checked, pinned: pin.checked, previousPrimary });
        const capture = () => {
            if (session.draft?.token !== model.token) return;
            model.fields = readFields(); model.overrides = [...overrides];
            const signature = JSON.stringify([model.fields, model.overrides]);
            model.initialSignature ??= signature;
            model.dirty = model.reviewed === true || signature !== model.initialSignature; updateSessionSummary();
        };
        const update = () => {
            www.disabled = !primary() || primary().startsWith("www."); wwwText.textContent = "Include www." + (primary() || "example.com") + " (exact host)";
            const intents = hostAccess(), signature = JSON.stringify(intents.map(h => h.hostname).filter(h => h !== primary()));
            if (hostControls.dataset.signature !== signature) {
                hostControls.dataset.signature = signature; hostControls.replaceChildren(); selects.clear();
                for (const intent of intents.filter(h => h.hostname !== primary())) {
                    const select = selectAccess(hostControls, "Access for " + intent.hostname); selects.set(intent.hostname, select);
                    select.addEventListener("change", () => { if (select.value === baseAccess(intent.hostname)) overrides.delete(intent.hostname); else overrides.set(intent.hostname, select.value); update(); });
                }
            }
            for (const intent of intents) { const select = selects.get(intent.hostname); if (select) { select.value = intent.access; select.disabled = allHosts.checked; } }
            preview.textContent = "Proposed exact hosts: " + (readHosts().join(", ") || "Enter a hostname") + ". " + intents.map(h => h.hostname + ": " + h.access.toLowerCase()).join("; ") + ". No wildcard access.";
            submit.textContent = displayOnly() ? "Save display details" : "Review change in Vault"; capture(); draftAvailability?.();
        };
        function explainConflict() {
            model.conflict = true;
            conflict.replaceChildren(); el(conflict, "p", "Committed data changed after this editor opened. Your input is preserved. Review the current values before retrying.");
            button(conflict, "Review current changes", () => {
                const current = bridge.view(), latest = current.application?.destinations.find(d => d.id === destination?.id), intended = hostAccess(), reviewedInput = draftSignature();
                conflict.replaceChildren();
                if (!current.snapshot || destination && !latest) { el(conflict, "p", "This destination is no longer available. Your input is kept; discard it or copy it into a new destination."); return; }
                el(conflict, "p", "Current committed revisions: policy " + current.snapshot.policyRevision + ", display " + current.application.revision + ".");
                if (latest) el(conflict, "p", "Committed destination: " + latest.label + " / " + latest.category + " / " + latest.hostname + " / " + (latest.pinned ? "Pinned" : "Unpinned") + ".");
                for (const h of intended) el(conflict, "p", h.hostname + ": current " + manualAccess(current.snapshot.policy, h.hostname).toLowerCase() + " \u2192 draft " + h.access.toLowerCase());
                const retained = new Set(readHosts());
                for (const h of latest ? [latest.hostname, ...latest.aliases, ...latest.destinations] : []) if (!retained.has(h)) el(conflict, "p", h + ": removed from this destination; unshared policy entries will be removed in Vault.");
                el(conflict, "p", "Using these revisions keeps your entered values. Any policy differences still require Vault review and confirmation.");
                button(conflict, "Use reviewed revisions", () => {
                    const newest = bridge.view();
                    if (newest.snapshot?.policyRevision !== current.snapshot.policyRevision || newest.application?.revision !== current.application.revision || draftSignature() !== reviewedInput) { explainConflict(); return; }
                    // The user reviewed these exact final choices. Retain them
                    // rather than silently adopting concurrent classifications.
                    for (const h of intended) if (h.hostname !== primary()) overrides.set(h.hostname, h.access);
                    model.base = draftBase(current, latest ?? null); state = current; destination = latest ?? null; model.conflict = false; model.reviewed = true;
                    conflict.replaceChildren(); el(conflict, "p", "Reviewed revisions loaded. Your input is unchanged. Save or review this draft when ready."); update();
                });
            });
            button(conflict, "Reload committed destination (discard input)", () => {
                const current = bridge.view(), latest = current.application?.destinations.find(d => d.id === destination?.id);
                if (destination && !latest) { el(conflict, "p", "The destination was removed. Your input is still preserved."); return; }
                session.clearDraft(model.token); captureDraft = null; parent.replaceChildren(); editor(parent, latest ?? null, current);
            });
        }
        const submit = protectedButton(draft, "Review change in Vault", async () => {
            capture();
            for (const node of draft.querySelectorAll("[aria-invalid]")) node.removeAttribute("aria-invalid");
            const invalid = !name.value.trim() || name.value.trim().length > 200 ? [name, "Enter a destination name of at most 200 characters."] :
                !category.value.trim() || category.value.trim().length > 100 ? [category, "Enter a category of at most 100 characters."] :
                readHosts().length === 0 || readHosts().some(h => normalizeTarget({ hostname: h })?.hostname !== h) ? [hostname, "Enter exact hostnames, such as example.com. URLs, wildcard hosts and IP addresses are not accepted."] : null;
            if (invalid) { model.feedback = { text: invalid[1] + " Your draft is kept.", tone: "error" }; paint(notice, model.feedback); invalid[0].setAttribute("aria-invalid", "true"); invalid[0].focus(); return; }
            let command;
            if (displayOnly()) command = { kind: "SAVE_DISPLAY_DETAILS", destinationId: destination.id, label: name.value.trim(), category: category.value.trim(), pinned: pin.checked,
                basePolicyRevision: state.snapshot.policyRevision, baseApplicationRevision: state.application.revision };
            else {
                const hosts = readHosts(), originalDestinations = destination?.destinations ?? [];
                const entry = { id: draftId, label: name.value.trim(), category: category.value.trim(), hostname: primary(),
                    aliases: hosts.filter(h => h !== primary() && !originalDestinations.includes(h)), destinations: hosts.filter(h => h !== primary() && originalDestinations.includes(h)), pinned: pin.checked };
                command = { kind: "PROPOSE_DESTINATION", destination: entry, hostAccess: hostAccess(), previousId: destination?.id ?? null,
                    basePolicyRevision: state.snapshot.policyRevision, baseApplicationRevision: state.application.revision };
            }
            model.submission = { status: "submitting", command }; draftAvailability();
            const result = await send(command);
            if (session.draft?.token !== model.token) return;
            model.feedback = describeOutcome(command, result, bridge.view());
            if (result?.type === "COMMITTED") {
                session.clearDraft(model.token); draft.remove();
            } else {
                model.submission = model.feedback.tone === "unresolved" ? { status: "unresolved", command } : null;
                if (["STALE_DRAFT", "STALE_DESTINATION"].includes(result?.reason)) explainConflict();
                session.changed();
            }
        });
        const restoring = !!model.fields;
        let previousPrimary = model.fields?.previousPrimary ?? primary();
        if (model.fields) {
            const f = model.fields; name.value = f.name; hostname.value = f.hostname; choice.value = f.access; category.value = f.category;
            www.checked = f.www; others.value = f.others; allHosts.checked = f.allHosts; pin.checked = f.pinned;
            for (const [h, access] of model.overrides) overrides.set(h, access);
        }
        captureDraft = capture;
        draftAvailability = () => {
            updateSessionSummary();
            const current = bridge.view(), pending = current.snapshot?.vaultState.pendingProposal, busy = model.submission?.status === "submitting";
            const unavailable = busy || model.submission?.status === "unresolved" || !!pending || current.status !== "READY";
            submit.dataset.atlasNotReady = unavailable ? "true" : "false"; submit.disabled = unavailable || submit.dataset.atlasBusy === "true";
            for (const node of draft.querySelectorAll("input, textarea, select")) node.disabled = busy;
            if (!busy) { www.disabled = !primary() || primary().startsWith("www."); for (const select of selects.values()) select.disabled = allHosts.checked; }
            const signature = JSON.stringify([pending?.id, model.submission?.status, current.status]);
            if (occupancy.dataset.signature !== signature) {
                occupancy.dataset.signature = signature; occupancy.replaceChildren();
                if (pending) { el(occupancy, "p", "A proposal is already in Vault. Your local draft is kept; finish or cancel that proposal before submitting another."); button(occupancy, "Review existing proposal", () => navigate({ section: "vault", context: { proposalId: pending.id } })); }
                if (model.submission?.status === "unresolved") {
                    el(occupancy, "p", "The last submission outcome is unresolved. This local copy is kept and will not be resubmitted automatically.");
                    button(occupancy, "Review saved state", () => navigate({ section: "diagnostics" }));
                    if (current.status === "READY") {
                        el(occupancy, "p", pending ? "Review the saved proposal in Vault before deciding whether to discard this local copy." : "Reconciliation completed. Compare committed values before deciding to edit or discard this local copy.");
                        if (!pending) button(occupancy, "Keep editing after recovery", () => { model.submission = null; model.conflict = true; explainConflict(); session.changed(); });
                    }
                }
            }
            const feedbackSignature = JSON.stringify(model.feedback);
            if (notice.dataset.signature !== feedbackSignature) { notice.dataset.signature = feedbackSignature; paint(notice, model.feedback); }
        };

        hostname.addEventListener("input", () => {
            if (previousPrimary !== primary()) {
                // Preserve a committed www alias when changing the primary.
                // A new www counterpart is a separate explicit selection.
                const previousWww = "www." + previousPrimary, nextWww = "www." + primary(), extras = extraHosts();
                if (www.checked && initialHosts().includes(previousWww) && !extras.includes(previousWww)) extras.push(previousWww);
                www.checked = extras.includes(nextWww); others.value = extras.filter(h => h !== primary() && h !== nextWww).join("\n");
                if (initialHosts().includes(primary()) || baseAccess(primary()) !== "GREYLIST") choice.value = baseAccess(primary());
                previousPrimary = primary();
            }
            update();
        });
        for (const node of [www, others, allHosts]) node.addEventListener("input", update);
        for (const node of [name, category, pin]) { node.addEventListener("input", capture); node.addEventListener("change", capture); }
        choice.addEventListener("change", update); update();
        if (model.conflict) explainConflict();
        button(draft, "Discard draft", () => { if (model.submission?.status === "submitting") { model.feedback = { text: "Wait for the current save outcome before discarding this local copy.", tone: "info" }; paint(notice, model.feedback); return; } session.clearDraft(model.token); draft.remove(); }); sections.get("sites").scrollTop = 0; if (!restoring) name.focus({ preventScroll: true }); return draft;
    }
    function refresh() {
        if (disposed) return;
        const state = bridge.view(), snapshot = state.snapshot, application = state.application; updateSessionSummary();
        setText(status, state.status === "READY" ? "Saved access rules" : `Atlas: ${state.status.toLowerCase()}`); status.title = state.reason ?? "";
        startupDiagnostics.hidden = !!snapshot || state.status === "UNINITIALIZED";
        if (!startupDiagnostics.hidden) {
            setText(startupCause, describeAuthorityFailure(state));
            setText(startupCodes, ["Authority: " + state.status, "Reason: " + (state.reason ?? "unavailable"),
                "Storage issue: " + (state.repositoryIssue ?? "none reported"),
                ...(state.pendingCommitId ? ["A transaction awaits explicit reconciliation."] : []), ...storageSummary(state)].join(" · "));
        }
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
                const numbers = [...terms.querySelectorAll("input")], saved = session.setup;
                if (saved) { numbers.forEach((input, i) => { input.value = saved.values[i]; }); whitelist.value = saved.whitelist; blacklist.value = saved.blacklist; terms.open = saved.termsOpen; advanced.open = saved.advancedOpen; }
                captureSetup = () => { if (bridge.view().status === "UNINITIALIZED") session.setup = { values: numbers.map(input => input.value), whitelist: whitelist.value, blacklist: blacklist.value, termsOpen: terms.open, advancedOpen: advanced.open }; };
                onboarding.addEventListener("input", () => captureSetup?.()); captureSetup();
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
            const draftHost = el(sites, "div"), search = field(sites, "Search destinations", session.search, "search"), list = el(sites, "div", undefined, "hub-atlas-site-list");
            const rows = el(list, "div"), empty = el(list, "p", "No destinations match.");
            const syncRows = keyed(rows, destination => {
                const node = el(rows, "article", undefined, "hub-atlas-site-row"), copy = el(node, "div"), record = { node };
                node.dataset.atlasDestinationId = destination.id;
                record.name = el(copy, "h4"); record.host = el(copy, "small"); record.aliases = el(copy, "p", undefined, "hub-atlas-muted");
                record.hosts = keyed(el(copy, "div"), host => ({ node: el(copy, "small") }), (r, host) => setText(r.node, host.hostname + ": " + host.decision.reason.replaceAll("_", " ").toLowerCase()), host => host.hostname);
                record.badge = el(node, "span", undefined, "hub-atlas-badge");
                const latest = () => {
                    const state = bridge.view(), value = state.application?.destinations.find(d => d.id === destination.id);
                    if (!value || !state.snapshot) { setText(message, "This destination changed or was removed. Reload Sites & Access."); return null; }
                    return { state, record: value };
                };
                record.pin = protectedButton(node, "", () => { const data = latest(); if (!data) return;
                    return send({ kind: "SAVE_DISPLAY_DETAILS", destinationId: data.record.id, label: data.record.label, category: data.record.category, pinned: !data.record.pinned,
                        basePolicyRevision: data.state.snapshot.policyRevision, baseApplicationRevision: data.state.application.revision }); });
                protectedButton(node, "Edit", () => { const data = latest(); if (data) beginEditor(draftHost, data.record, data.state); });
                protectedButton(node, "Remove", () => { const data = latest(); if (data) return send({ kind: "PROPOSE_DESTINATION", destination: null, hostAccess: [], previousId: data.record.id,
                    basePolicyRevision: data.state.snapshot.policyRevision, baseApplicationRevision: data.state.application.revision }); });
                return record;
            }, (r, d) => {
                setText(r.name, d.label); setText(r.host, d.category + " · " + d.hostname);
                setText(r.aliases, [...d.aliases, ...d.destinations].join(", ") || "Primary exact hostname only");
                r.hosts(d.hosts?.filter(h => h.decision.reason !== d.decision?.reason) ?? []);
                const classification = d.decision?.reason === "MANAGED_BLACKLISTED" ? "Managed blocked" : d.decision?.reason === "ACTIVE_GRANT" ? "Temporary access" : access(d).toLowerCase();
                setText(r.badge, classification); r.badge.dataset.state = d.decision?.reason ?? access(d); setText(r.pin, d.pinned ? "Unpin" : "Pin");
                r.node.hidden = !(d.label + " " + d.category + " " + d.hostname + " " + d.aliases.join(" ") + " " + d.destinations.join(" ")).toLowerCase().includes(search.value.toLowerCase());
            });
            const renderList = () => {
                const current = bridge.view(); syncRows(current.destinations ?? []);
                empty.hidden = [...rows.children].some(row => !row.hidden);
            };
            search.addEventListener("input", () => { session.search = search.value; renderList(); }); sites.renderList = renderList;
            protectedButton(actions, "Add a destination", () => beginEditor(draftHost, null, bridge.view()));
            if (session.draft) editor(draftHost, session.draft.base.destination, state);
            const curatedImport = protectedButton(actions, "Review curated updates in Vault", () => send({ kind: "IMPORT_CURATED" }));
            sites.updateImport = current => {
                const missing = current.starter.policy.whitelist.filter(h => !current.snapshot.policy.whitelist.includes(h));
                curatedImport.hidden = !missing.length; importHint.hidden = !missing.length;
                setText(importHint, `${missing.length} curated hosts are missing from your Whitelist, including ${missing.slice(0, 3).join(", ")}. Import preserves your manual Blacklist and display preferences; confirmation is required.`);
            };
        }
        sites.renderList(); sites.updateImport(state); draftAvailability?.();
        const pendingRequests = snapshot.accessState.pendingRequests, grants = snapshot.accessState.grants, now = presentationNow(state);
        const temporary = sections.get("temporary");
        if (!temporary.updateTemporary) {
            el(temporary, "h3", "Temporary Access"); el(temporary, "p", "Temporary grants expire. They do not become Whitelist entries.");
            const empty = el(temporary, "p", "No temporary grants."), grantList = el(temporary, "div");
            const syncGrants = keyed(grantList, grant => {
                const node = el(grantList, "article", undefined, "hub-atlas-site-row");
                const r = { node, host: el(node, "strong"), status: el(node, "span") }; countdown(node, "Grant expires in", grant.expiresAt); r.count = node.querySelector("[data-atlas-deadline]"); return r;
            }, (r, grant) => {
                setText(r.host, grant.hostname); const current = bridge.view(), usable = current.temporaryDestinations?.some(g => g.hostname === grant.hostname && g.decision.outcome === "ALLOW");
                setText(r.status, usable ? "Temporary grant — usable now" : "Saved grant — not currently usable"); r.node.dataset.state = usable ? "ACTIVE_GRANT" : "EXPIRED"; r.count.dataset.atlasDeadline = String(grant.expiresAt);
            }, grant => grant.requestId);
            el(temporary, "h4", "Pending requests"); const requestList = el(temporary, "div"), otherContexts = el(temporary, "div");
            const syncRequests = keyed(requestList, request => {
                const node = el(requestList, "article", undefined, "hub-atlas-request"), r = { node, host: el(node, "h4"), detail: el(node, "p") };
                node.dataset.atlasRequestId = String(request.id); countdown(node, "", 0); r.count = node.querySelector("[data-atlas-deadline]"); r.panel = el(node, "section", undefined, "hub-atlas-panel"); return r;
            }, (r, request) => {
                const current = bridge.view(), item = pendingActions(current, presentationNow(current)).find(i => i.key === "access:" + request.id);
                setText(r.host, request.hostname); setText(r.detail, item?.detail ?? "Review current request state."); r.node.dataset.state = item?.phase ?? "STALE";
                r.count.hidden = !item?.deadline; r.count.dataset.atlasDeadline = String(item?.deadline ?? 0); r.count.dataset.atlasLabel = item?.phase === "WAITING" ? "Confirmation available in" : "Confirmation window";
                const context = current.contexts.find(c => c.id === item?.contextId); r.panel.hidden = !context; renderNavigation(r.panel, current, context, bridge);
            });
            const syncContexts = keyed(otherContexts, () => ({ node: el(otherContexts, "section", undefined, "hub-atlas-panel") }), (r, context) => renderNavigation(r.node, bridge.view(), context, bridge));
            temporary.updateTemporary = current => {
                const items = pendingActions(current, presentationNow(current)), ids = new Set(items.filter(i => i.route.section === "temporary").map(i => i.contextId));
                empty.hidden = !!current.snapshot.accessState.grants.length; syncGrants(current.snapshot.accessState.grants); syncRequests(current.snapshot.accessState.pendingRequests);
                syncContexts(current.contexts.filter(c => c.origin && ["BLOCKED", "ENFORCEMENT_FAILED"].includes(c.phase) && !ids.has(c.id)));
            };
        }
        temporary.updateTemporary(state);
        if (!sections.get("timings").dataset.mounted) {
            const section = sections.get("timings"); section.dataset.mounted = "true"; el(section, "h3", "Timings / Behaviour");
            el(section, "p", "Waits make confirmation available. Fixed grant and Journey terms never extend because you browse or reload. Existing terms remain active until Vault commits.");
            const form = el(section, "div", undefined, "hub-atlas-timing-form"), feedback = el(section, "div"); feedback.setAttribute("role", "status");
            const reset = () => {
                form.replaceChildren();
                const current = bridge.view(), model = session.timings ?? { baseRevision: current.snapshot.configurationRevision, values: null, original: null, feedback: null, unresolved: false };
                session.timings = model;
                const read = configurationInput(form, current.snapshot.configuration), inputs = [...form.querySelectorAll("input")];
                if (model.values) inputs.forEach((input, i) => { input.value = model.values[i]; });
                const capture = () => { model.values = inputs.map(input => input.value); model.original ??= JSON.stringify(model.values); model.dirty = JSON.stringify(model.values) !== model.original; updateSessionSummary(); };
                captureTimings = capture; for (const input of inputs) input.addEventListener("input", capture); capture();
                let feedbackSignature = JSON.stringify(model.feedback); paint(feedback, model.feedback);
                const submitTiming = protectedButton(form, "Review timing change in Vault", async () => {
                    if (disposed || session.timings !== model || model.busy) return;
                    capture();
                    if (model.unresolved) { paint(feedback, { text: "The timing submission outcome is unresolved. Your values are kept; review saved state before retrying.", tone: "unresolved", section: "diagnostics" }); return; }
                    const latest = bridge.view();
                    if (latest.snapshot.vaultState.pendingProposal) { paint(feedback, describeOutcome({ kind: "PROPOSE_SETTINGS" }, { type: "REJECTED", reason: "PROPOSAL_PENDING" }, latest)); return; }
                    if (latest.snapshot.configurationRevision !== model.baseRevision) {
                        feedback.replaceChildren(); el(feedback, "p", "Committed timing values changed. Your input is kept. Review the current and proposed values before retrying.");
                        let candidate; try { candidate = read(); } catch (error) { el(feedback, "p", error.message); return; }
                        for (const [group, values] of Object.entries(candidate)) for (const [key, value] of Object.entries(values)) el(feedback, "p", group + "." + key + ": " + latest.snapshot.configuration[group][key] + " → " + value);
                        const reviewed = JSON.stringify(model.values);
                        button(feedback, "Use reviewed timing revisions", () => {
                            capture(); if (bridge.view().snapshot.configurationRevision !== latest.snapshot.configurationRevision || JSON.stringify(model.values) !== reviewed) { el(feedback, "p", "Values changed again. Review them once more."); return; }
                            model.baseRevision = latest.snapshot.configurationRevision; model.feedback = { text: "Reviewed timing revisions loaded. Your entered values are kept; submit when ready.", tone: "info" }; paint(feedback, model.feedback);
                        }); return;
                    }
                    try {
                        const command = { kind: "PROPOSE_SETTINGS", candidateConfiguration: read() }; model.busy = true; session.changed();
                        const result = await send(command); model.busy = false;
                        if (result?.type === "COMMITTED") session.clearTimings(model);
                        else { model.feedback = describeOutcome(command, result, bridge.view()); model.unresolved = model.feedback.tone === "unresolved"; }
                    } catch (error) { model.feedback = { text: error.message + " Your timing draft is kept.", tone: "error" }; }
                    finally { model.busy = false; if (session.timings === model) session.changed(); }
                });
                section.syncTimings = () => {
                    if (session.timings !== model) { reset(); return; }
                    for (const input of inputs) input.disabled = !!model.busy;
                    submitTiming.dataset.atlasNotReady = model.busy || model.unresolved ? "true" : "false";
                    submitTiming.disabled = !!model.busy || !!model.unresolved || submitTiming.dataset.atlasBusy === "true" || bridge.view().status !== "READY";
                    const next = JSON.stringify(model.feedback); if (next !== feedbackSignature) { feedbackSignature = next; paint(feedback, model.feedback); }
                };
                section.syncTimings();
            };
            reset(); button(section, "Reload committed timings (discard edits)", () => { if (session.timings?.busy) return; feedback.replaceChildren(); session.clearTimings(session.timings); });
        }
        sections.get("timings").syncTimings?.();
        const pending = snapshot.vaultState.pendingProposal;
        if (review?.proposalId !== pending?.id) review = null;
        rebuild("vault", JSON.stringify([pending && [pending.id, pending.basePolicyRevision, pending.baseConfigurationRevision, pending.createdAt, pending.readyAt, pending.confirmBy, pending.candidatePolicy, pending.candidateConfiguration], snapshot.policyRevision, snapshot.configurationRevision, application?.recovery ? application.revision : null, application?.pending, application?.recovery, state.status]), section => {
            vaultTick = null;
            section.classList.add("hub-atlas-vault"); if (pending) section.dataset.atlasProposalId = String(pending.id); else delete section.dataset.atlasProposalId;
            el(section, "h3", "Vault"); el(section, "p", `Active policy revision ${snapshot.policyRevision} · configuration revision ${snapshot.configurationRevision}. Waiting alone never applies a proposal.`);
            const recovery = application?.recovery;
            if (recovery) {
                const saved = el(section, "article", undefined, "hub-atlas-recovery-draft"); saved.dataset.atlasRecoveryId = recovery.id;
                el(saved, "h4", "Saved recovery draft");
                el(saved, "p", "This saved copy is not active policy or a pending proposal. Storage reconciliation never retries or confirms it.");
                const replacement = pending && pending.id !== recovery.sourceProposalId &&
                    (recovery.operation === "PROPOSE_SETTINGS" ? JSON.stringify(pending.candidateConfiguration) === JSON.stringify(recovery.configuration) :
                        JSON.stringify(pending.candidatePolicy) === JSON.stringify(recovery.policy)) &&
                    (recovery.destinations === null || JSON.stringify(application.pending?.destinations) === JSON.stringify(recovery.destinations));
                const terms = el(saved, "details"); el(terms, "summary", "Review saved changes against committed values");
                el(terms, "p", "Review bases: policy " + snapshot.policyRevision + ", timing " + snapshot.configurationRevision + ", display " + application.revision + ".");
                if (recovery.basePolicyRevision !== snapshot.policyRevision || recovery.baseConfigurationRevision !== snapshot.configurationRevision || recovery.baseApplicationRevision !== application.revision)
                    el(terms, "p", "Committed revisions changed. Review every difference before creating a replacement.");
                if (recovery.operation === "PROPOSE_POLICY") {
                    el(terms, "p", "Restore the saved policy and destination values. Current timing terms govern the new proposal.");
                    for (const hostname of [...new Set([...snapshot.policy.whitelist, ...snapshot.policy.blacklist, ...recovery.policy.whitelist, ...recovery.policy.blacklist])].sort()) {
                        const before = manualAccess(snapshot.policy, hostname), after = manualAccess(recovery.policy, hostname);
                        if (before !== after) el(terms, "p", hostname + ": " + before.toLowerCase() + " → " + after.toLowerCase());
                    }
                    for (const list of ["whitelist", "blacklist"]) {
                        const added = recovery.policy[list].filter(h => !snapshot.policy[list].includes(h)), removed = snapshot.policy[list].filter(h => !recovery.policy[list].includes(h));
                        if (added.length) el(terms, "p", list + " additions: " + added.join(", "));
                        if (removed.length) el(terms, "p", list + " removals: " + removed.join(", "));
                    }
                    if (recovery.destinations) {
                        for (const d of recovery.destinations) {
                            const old = application.destinations.find(current => current.id === d.id);
                            if (!old) el(terms, "p", "Add destination: " + d.label + " / " + d.category + " / " + d.hostname + " / " + [...d.aliases, ...d.destinations].join(", ") + " / " + (d.pinned ? "Pinned" : "Unpinned"));
                            else for (const key of ["label", "category", "hostname", "aliases", "destinations", "pinned"])
                                if (JSON.stringify(old[key]) !== JSON.stringify(d[key])) el(terms, "p", d.label + " " + key + ": " + String(old[key]) + " → " + String(d[key]));
                        }
                        for (const d of application.destinations) if (!recovery.destinations.some(saved => saved.id === d.id)) el(terms, "p", "Remove destination: " + d.label + " (" + d.hostname + ")");
                    }
                } else {
                    el(terms, "p", "Restore saved timing values. Current host policy is retained.");
                    for (const [group, values] of Object.entries(recovery.configuration)) for (const [key, value] of Object.entries(values))
                        el(terms, "p", group + "." + key + ": " + snapshot.configuration[group][key] + " → " + value);
                }
                if (replacement) el(saved, "p", "The replacement proposal is saved. Review and confirm it below; no retry is needed.");
                else {
                    el(terms, "p", "Create a replacement only after reviewing these values. It receives a full new wait and requires explicit confirmation.");
                    const unchanged = recovery.operation === "PROPOSE_SETTINGS" ? JSON.stringify(snapshot.configuration) === JSON.stringify(recovery.configuration) :
                        ["whitelist", "blacklist"].every(list => JSON.stringify([...snapshot.policy[list]].sort()) === JSON.stringify([...recovery.policy[list]].sort()));
                    if (unchanged) el(terms, "p", "The saved security values are already committed. Only the reviewed display values and recovery copy will be saved; no policy changes.");
                    if (pending && pending.id !== recovery.sourceProposalId) el(terms, "p", "A different proposal is pending. Finish or cancel it before restoring this saved draft.");
                    protectedButton(terms, unchanged ? "Save reviewed recovery details" : "Create reviewed replacement", () => send({ kind: "RESTORE_RECOVERY", recoveryId: recovery.id,
                        basePolicyRevision: snapshot.policyRevision, baseConfigurationRevision: snapshot.configurationRevision, baseApplicationRevision: application.revision }));
                }
                if (state.status !== "READY") { el(saved, "p", "The last save outcome is unresolved. Reconcile saved state before taking another action."); button(saved, "Recover saved state", () => send({ kind: "RECOVER" })); }
                protectedButton(saved, "Discard recovery copy", () => send({ kind: "DISCARD_RECOVERY", recoveryId: recovery.id }));
            }
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
                summary.dataset.state = currentPhase; setText(phaseLabel, currentPhase === "READY" ? "Ready to confirm" : currentPhase === "WAITING" ? "Waiting" : "Expired");
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
        const managedSection = sections.get("managed");
        if (!managedSection.updateManaged) {
            el(managedSection, "h3", "Managed Lists");
            el(managedSection, "p", "Managed blocking is separate from your manual policy. Refreshing requires no Vault wait. Explicit Whitelist exceptions retain Core's precedence.");
            const summary = el(managedSection, "p"), sync = el(managedSection, "p"), error = el(managedSection, "p", undefined, "hub-atlas-operation-feedback"), exceptions = el(managedSection, "p");
            const details = el(managedSection, "details"); el(details, "summary", "Source and version");
            const source = el(details, "p", undefined, "hub-atlas-source"), categories = el(details, "p"), version = el(details, "p", undefined, "hub-atlas-source"), hash = el(details, "p", undefined, "hub-atlas-source");
            const refresh = button(managedSection, "Refresh now", () => send({ kind: "REFRESH_MANAGED" }));
            const lookup = field(managedSection, "Look up an exact hostname"), result = el(managedSection, "p"); result.setAttribute("role", "status");
            const find = async () => { const hostname = lookup.value.trim(), response = await bridge.command({ kind: "LOOKUP_MANAGED", hostname });
                if (!disposed && lookup.value.trim() === hostname) setText(result, response.type === "MANAGED_LOOKUP" ? response.hostname + ": " + (response.blocked === null ? "Authority unavailable" : response.blocked ? "In managed list" : "Not in managed list") : "Enter a valid exact hostname."); };
            button(managedSection, "Look up", find); lookup.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); void find(); } });
            managedSection.updateManaged = current => {
                const m = current.managed;
                setText(summary, m ? m.count.toLocaleString() + " exact hosts · " + m.origin.toLowerCase() + " · " + m.status.toLowerCase().replaceAll("_", " ") : "Managed service is unavailable in this host.");
                setText(sync, m ? "Last successful sync: " + timestamp(m.lastSuccessfulSync) + " · Last attempt: " + timestamp(m.lastAttemptAt) : "");
                setText(error, m?.error ? "The latest update did not complete. Review source details; current list status is shown above." : ""); error.dataset.tone = "error"; error.title = m?.error ?? ""; error.hidden = !m?.error;
                setText(exceptions, m?.conflicts.length ? "Explicit Whitelist exceptions: " + m.conflicts.join(", ") : ""); exceptions.hidden = !m?.conflicts.length;
                setText(source, m?.source); setText(categories, m ? "Categories: " + m.categories.join(", ") : ""); setText(version, m?.version ? "Version: " + m.version : ""); setText(hash, m?.hash ? "SHA-256: " + m.hash : "");
                details.hidden = !m; refresh.dataset.atlasNotReady = !m || m.status === "UPDATING" ? "true" : "false";
                refresh.disabled = refresh.dataset.atlasNotReady === "true" || refresh.dataset.atlasBusy === "true";
            };
        }
        managedSection.updateManaged(state);
        const diagnostics = sections.get("diagnostics");
        if (!diagnostics.updateDiagnostics) {
            el(diagnostics, "h3", "Diagnostics / Recovery"); const lines = Array.from({ length: 6 }, () => el(diagnostics, "p"));
            const details = el(diagnostics, "details"); el(details, "summary", "Technical details");
            const version = el(details, "p", undefined, "hub-atlas-source"); version.dataset.atlasStorageVersion = "";
            const issue = el(details, "p"), storageLines = Array.from({ length: 6 }, () => el(details, "p")), journeyList = el(details, "div");
            const syncJourneys = keyed(journeyList, () => ({ node: el(journeyList, "p") }), (r, j) => setText(r.node, j.rootHostname + " → " + j.currentHostname + " · " + j.phase.toLowerCase() + (j.endReason ? " · " + j.endReason.toLowerCase() : "")));
            el(diagnostics, "p", "Recovery reloads and reconciles authority. It never clears your policy, confirms a proposal or replays a browser request.");
            button(diagnostics, "Recover saved state", () => send({ kind: "RECOVER" }));
            diagnostics.updateDiagnostics = current => {
                const s = current.snapshot, app = current.application;
                const values = ["Authority: " + current.status + " · " + (current.reason ?? "available"),
                    "Policy revision " + s.policyRevision + " · configuration revision " + s.configurationRevision,
                    "Storage envelope schema 2 · application schema " + (app?.schemaVersion ?? "unavailable"),
                    "Whitelist " + s.policy.whitelist.length + " · manual Blacklist " + s.policy.blacklist.length + " · managed " + (current.managed?.count ?? "unavailable"),
                    "Active grants " + (current.temporaryDestinations ?? []).filter(g => g.decision.outcome === "ALLOW").length + " · saved grants " + s.accessState.grants.length + " · pending requests " + s.accessState.pendingRequests.length + " · Vault proposal " + (s.vaultState.pendingProposal?.id ?? "none"),
                    "Managed sync " + (current.managed?.status ?? "unavailable") + " · last success " + timestamp(current.managed?.lastSuccessfulSync)];
                values.forEach((value, i) => setText(lines[i], value)); setText(version, "Storage version: " + current.storageVersion);
                setText(issue, current.repositoryIssue ? "Storage issue: " + current.repositoryIssue : ""); const storageText = storageSummary(current); storageLines.forEach((node, i) => setText(node, storageText[i] ?? "")); syncJourneys(s.journeyState.journeys);
            };
        }
        diagnostics.updateDiagnostics(state);
        const version = parent.querySelector("[data-atlas-storage-version]"); if (version) setText(version, `Storage version: ${state.storageVersion}`);
        for (const node of parent.querySelectorAll("[data-atlas-protected]")) { node.dataset.atlasUnavailable = state.status !== "READY" ? "true" : "false";
            node.disabled = node.dataset.atlasUnavailable === "true" || node.dataset.atlasNotReady === "true" || node.dataset.atlasBusy === "true"; }
        const pendingItems = pendingActions(state, Date.now(), session); announce(pendingItems);
        for (const [id, node] of navButtons) { const count = pendingItems.filter(item => item.route.section === id).length; node.dataset.pendingCount = count ? String(count) : ""; node.setAttribute("aria-label", pages.find(p => p[0] === id)[1] + (count ? `, ${count} pending` : "")); }
        updateCountdowns(parent, presentationNow(state)); show(selected);
    }
    const unsubscribeRoute = session.subscribe((route, event) => { if (!session.draft) { for (const node of parent.querySelectorAll(".hub-atlas-draft, .hub-atlas-replace-draft")) node.remove(); captureDraft = null; draftAvailability = null; } show(route.section); refresh(); if (event?.navigation !== false) focusRoute(); });
    paint(message, session.feedback);
    const unsubscribe = bridge.subscribe(refresh); refresh(); for (const [id, node] of sections) { const top = session.scrolls.get(id); if (top) node.scrollTop = top; } if (session.settingsScroll) parent.scrollTop = session.settingsScroll; if (session.route.context) focusRoute();
    const timer = setInterval(() => {
        const state = bridge.view(), next = JSON.stringify([pendingActions(state, Date.now(), session), state.contexts.map(c => [c.id, !bridge.canActOnContext || bridge.canActOnContext(c)])]);
        if (next !== temporalSignature) { temporalSignature = next; refresh(); } else { vaultTick?.(); updateCountdowns(parent, presentationNow(state)); }
    }, 250);
    return () => { captureDraft?.(); captureTimings?.(); captureSetup?.(); for (const [id, node] of sections) session.scrolls.set(id, node.scrollTop); session.settingsScroll = parent.scrollTop; disposed = true; clearInterval(timer); unsubscribe(); unsubscribeRoute(); for (const dispose of mounts.values()) dispose(); parent.classList.remove("hub-atlas-overview"); };
}
module.exports = { mountAtlasSettings };
