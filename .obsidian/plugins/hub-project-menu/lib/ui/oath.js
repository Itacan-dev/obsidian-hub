"use strict";
const { ownColorRoot } = require("./color-system");
const { ownMenuColors, ownModalColors } = require("./color-system");

const { createWindowTitle, setWindowUndertext, mountModalSeparators, layoutModal } = require("./window-title");
const { renderReadOnlyTask } = require("./tasks");
const { createHubMarkdown } = require("./markdown");
const { parseLocalISODate, formatDate, formatDateTime } = require("../domain/dates");
const { bindNativeDateTimePicker } = require("./date-time");
const { disclosureIcons } = require("./disclosure");
const { mountTransientEffects } = require("./attention");
const { bindMenuToggle, mountDisclosure } = require("./menu-toggle");
const { setHubIcon } = require("./icons");
const { taskKey } = require("../domain/oath-workspace");
const { isCommitted, oathTime, oathProgress, shortOathTime, fulfilmentLabel, oathDuration, validDuration } = require("../domain/oath");
const { mountOathApplications } = require("./oath-applications");

const dateLabel = time => formatDateTime(new Date(time));
const OATH_COPY = Object.freeze({
    start: "When will your Oath begin?",
    work: "What will you work on?",
    duration: "How long will you commit?",
    confirmation: "Review your Oath",
    pledge: "“I solemnly swear that I will do the work, the whole work, and nothing but the work.”"
});
// Obsidian aliases bare "fullscreen" to "maximize"; the Lucide ID bypasses that alias.
const duringOathRows = [
    ["lucide-fullscreen", "Itacan enters and remains in fullscreen"],
    ["shield-user", "Your selected Plan items remain the focus"],
    ["info", "External websites and notifications are not restricted"]
];
function endingOathRows(draft) {
    return [
        ["circle-check", `The Oath is fulfilled after ${oathDuration(draft.durationMs)}`],
        ["triangle-alert", draft.mode === "strict" ? "Ordinary early exit is unavailable until fulfillment" : "Ending before fulfillment will break the Oath"],
        ["timer-off", "After fulfillment, you may remain Oathbound and continue working"],
        ["clipboard-clock", "The result is recorded in Oath History"]
    ];
}

function oathIcon(parent, name) {
    const icon = parent.createSpan({ cls: "hub-oath-row-icon", attr: { "aria-hidden": "true" } });
    if (name === "folder") setHubIcon(icon, name);
    else require("obsidian").setIcon(icon, name);
    return icon;
}
function oathRow(group, icon, text, label = null) {
    const row = group.createDiv({ cls: `hub-oath-review-row${label ? " has-label" : ""}` });
    oathIcon(row, icon);
    if (label) row.createEl("strong", { text: label });
    const value = row.createDiv({ cls: "hub-oath-review-value" });
    if (Array.isArray(text)) {
        const list = value.createEl("ul", { cls: "hub-oath-review-tasks" });
        for (const title of text) list.createEl("li", { text: title });
    } else value.createDiv({ text });
    return row;
}
let choiceGroupId = 0;


function openOathSetup(service) {
    const { Modal, Component, Menu } = require("obsidian");
    class Setup extends Modal {
        onOpen() { ownModalColors(this);
            this.modalEl.classList.add("hub-oath-dialog");
            this.contentEl.classList.add("hub-button-scope");
            const plan = service.activePlan();
            this.draft = { start: "now", scheduledAt: null, durationMs: null, planEntryIds: [], planId: plan?.id };
            if (!this.draft.planId) {
                createWindowTitle(this.contentEl, "The Oath", "shield-user");
                this.contentEl.createEl("p", { text: "An active Plan with at least one item is required to take an Oath." });
                this.contentEl.createEl("button", { text: "Open Plans" }).onclick = () => {
                    this.close();
                    require("./plan").openPlan(service.plugin);
                };
                mountModalSeparators(this);
                return;
            }
            this.choiceGroupId = ++choiceGroupId;
            this.owner = new Component(); this.owner.load();
            this.owner.register(service.onChange(() => this.updateNext?.(), true));
            service.plugin.globalPlan.subscribe(this.owner, () => { void this.refreshItems(); });
            this.items = plan.content.entries.map(entry => ({ entry, label: entry.lastKnownLabel }));
            this.setup();
            void this.refreshItems();
        }
        async refreshItems() {
            const generation = this.itemGeneration = (this.itemGeneration ?? 0) + 1;
            const plan = service.activePlan();
            const items = plan?.id === this.draft.planId ? await service.readPlanItems(plan).catch(() =>
                plan.content.entries.map(entry=>({entry,label:entry.lastKnownLabel}))) : [];
            if (!this.closed && generation === this.itemGeneration) {
                this.items = items;
                this.renderItems?.();
                this.updateNext?.();
            }
        }
        section(title) {
            const el = this.contentEl.createEl("section", { cls: "hub-oath-section" });
            el.createEl("h3", { text: title }); return el;
        }
        choices(parent, name, choices, value, changed) {
            const group = parent.createDiv({ cls: "hub-oath-choices hub-equal-selectors hub-option-group", attr: { role: "radiogroup", "aria-label": parent.querySelector("h3").textContent } });
            if (name === "duration") group.classList.add("hub-oath-duration-choices");
            if (name === "start") group.classList.add("hub-oath-start-choices");
            const radioName = `hub-oath-${this.choiceGroupId}-${name}`;
            for (const [key, label, help] of choices) {
                const card = group.createEl("label", { cls: "hub-oath-choice" });
                const radio = card.createEl("input", { type: "radio", attr: { name: radioName, value: key } });
                radio.checked = value === key;
                const copy = card.createSpan({ cls: "hub-oath-choice-copy" });
                const title = copy.createSpan({ text: label, cls: "hub-oath-choice-title", attr: { id: `${radioName}-${key}` } });
                radio.setAttribute("aria-labelledby", title.id);
                if (help) {
                    const hint = copy.createSpan({ text: help, cls: "hub-oath-choice-help", attr: { id: `${radioName}-${key}-help` } });
                    radio.setAttribute("aria-describedby", hint.id);
                }
                radio.addEventListener("change", () => {
                    if (!radio.checked) return;
                    changed(key);
                    const selected = this.contentEl.querySelector(`input[name="${radioName}"]:checked`);
                    (selected?.closest(".hub-oath-choice").querySelector("[data-oath-autofocus]") ?? selected)?.focus();
                });
            }
            return group;
        }
        customDuration() {
            const { value = "", unit = "minutes" } = this.customValue ?? {};
            return value.trim() ? Number(value) * (unit === "hours" ? 3600000 : 60000) : null;
        }
        setup() {
            const draft = this.draft;
            draft.applicationCheckMode = "automatic";
            draft.manualApplicationReviewAcknowledged = false;
            delete draft.strictConfirmation;
            this.clearSetupEffects(); this.updateNext = null; this.contentEl.empty();
            this.effects = mountTransientEffects(this.contentEl);
            this.contentEl.classList.remove("hub-oath-review");
            this.contentEl.classList.add("hub-oath-setup");
            const heading = createWindowTitle(this.contentEl, "Make an Oath", "shield-user");
            setWindowUndertext(heading, this.contentEl.createEl("p", { cls: "hub-oath-muted", text: "Set the terms of your commitment" }));
            if (service.strictEnabled || draft.mode === "strict") {
                const mode = this.section("Commitment mode");
                this.choices(mode, "mode", [["ordinary", "Ordinary Oath", "Early exit records a broken Oath"], ["strict", "Strict Oath", "Ordinary early exit is unavailable"]], draft.mode ?? "ordinary", value => {
                    draft.mode = value; delete draft.strictConfirmation; this.setup();
                });
                if (draft.mode === "strict") {
                    const apps = this.section("Permitted desktop applications");
                    const label = apps.createEl("label");
                    const override = label.createEl("input", { type: "checkbox", attr: { "aria-label": "Override application defaults for this Oath" } });
                    label.createSpan({ text: "Override application defaults for this Oath" });
                    override.checked = Array.isArray(draft.applications);
                    override.addEventListener("change", () => {
                        if (override.checked) draft.applications = service.strictApplications; else delete draft.applications;
                        delete draft.strictConfirmation; this.setup();
                    });
                    if (override.checked) this.stopApplications = mountOathApplications(apps, service, draft.applications, async values => {
                        const verified = await service.strict.verifyApplications(values);
                        draft.applications = verified; delete draft.strictConfirmation; return verified;
                    });
                    else apps.createEl("p", { text: service.strictApplications.length ? service.strictApplications.join("\n") : "Default: Itacan only.", cls: "hub-oath-muted hub-oath-application-paths" });
                }
            }
            const start = this.section(OATH_COPY.start);
            const startChoices = this.choices(start, "start", [["now", "Now"], ["scheduled", "Select date and time"]], draft.start, value => {
                if (value === "now") { draft.start = "now"; this.setup(); }
                else this.dateDisclosure.open();
            });
            const nowRadio = startChoices.querySelector('input[value="now"]');
            const scheduledRadio = startChoices.querySelector('input[value="scheduled"]');
            const scheduledLabel = scheduledRadio.closest(".hub-oath-choice");
            // Restore the former styled option with its native picker surface.
            // A div keeps the radio and date editor out of one native label.
            const scheduledCard = scheduledLabel.ownerDocument.createElement("div");
            scheduledCard.className = scheduledLabel.className + " hub-oath-start-disclosure hub-oath-scheduled-card";
            scheduledCard.append(...scheduledLabel.childNodes); scheduledLabel.replaceWith(scheduledCard);
            disclosureIcons(scheduledCard);
            const datePanel = scheduledCard.createSpan({ cls: "hub-oath-schedule-editor", attr: {
                id: `hub-oath-date-${this.choiceGroupId}`, role: "group", "aria-label": "Scheduled Oath start"
            } });
            scheduledCard.setAttribute("aria-controls", datePanel.id);
            scheduledRadio.setAttribute("aria-controls", datePanel.id);
            const dateInput = datePanel.createEl("input", { type: "datetime-local", cls: "hub-oath-start-input", attr: {
                id: `${datePanel.id}-input`, lang: "en", "aria-label": "Scheduled Oath start", "data-oath-autofocus": ""
            } });
            if (draft.scheduledAt) {
                const date = new Date(draft.scheduledAt);
                this.scheduledValue = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            }
            dateInput.value = this.scheduledValue ?? "";
            const startValid = () => service.setupRequirements(draft).find(item => item.key === "Start").complete;
            const syncStart = () => {
                const opened = this.dateDisclosure?.isOpen ?? false;
                nowRadio.checked = draft.start === "now";
                scheduledRadio.checked = opened || draft.start === "scheduled" && startValid();
                scheduledRadio.setAttribute("aria-expanded", String(opened));
                const [date = "", time = ""] = dateInput.value.split("T"), local = parseLocalISODate(date);
                const label = local && time ? `${formatDate(local)}, ${time}` : "Select date and time";
                scheduledCard.querySelector(".hub-oath-choice-title").textContent = label;
                dateInput.setAttribute("aria-label", `Scheduled Oath start: ${label}`);
            };
            const nativePicker = this.nativeDatePicker = bindNativeDateTimePicker({ input: dateInput, surface: scheduledCard,
                bindEvents: false, onClose: () => this.dateDisclosure?.close() });
            this.dateDisclosure = mountDisclosure({ trigger: scheduledCard, panel: datePanel,
                onOpen: () => { draft.start = "scheduled"; syncStart(); this.updateNext?.(); nativePicker.open(); },
                onClose: () => {
                    const focused = datePanel.contains(datePanel.ownerDocument.activeElement);
                    nativePicker.close();
                    syncStart(); this.updateNext?.();
                    if (focused) scheduledRadio.focus({ preventScroll: true });
                }
            });
            // A label's cancelled native activation can restore its radio after click.
            scheduledCard.addEventListener("click", () => queueMicrotask(syncStart));
            const updateDate = () => {
                this.scheduledValue = dateInput.value;
                draft.start = "scheduled";
                draft.scheduledAt = dateInput.value && dateInput.validity.valid ? new Date(dateInput.value).getTime() : null;
                syncStart(); this.updateNext?.();
            };
            dateInput.addEventListener("input", updateDate);
            dateInput.addEventListener("change", () => {
                updateDate();
                // The combined popover can update its date before the user
                // finishes choosing hours/minutes. Let its own dismissal close it.
                if (startValid() && !dateInput.matches(":open")) this.dateDisclosure.close();
            });
            dateInput.addEventListener("keydown", event => {
                if (event.key === "Enter") { event.preventDefault(); updateDate(); if (startValid()) this.dateDisclosure.close(); }
            });
            syncStart();
            const work = this.section(OATH_COPY.work);
            const list = work.createDiv({ cls: "hub-oath-plan-items hub-scrollbar", attr: { role: "group", "aria-label": "Items from the active Plan" } });
            this.renderItems = () => {
                const doc = list.ownerDocument, focusId = doc.activeElement?.dataset.oathPlanEntry, scroll = list.scrollTop;
                list.empty();
                for (const item of this.items) {
                    const { entry } = item;
                    const label = list.createEl("label", { cls: "hub-oath-plan-item" });
                    const checkbox = label.createEl("input", { type: "checkbox" });
                    checkbox.dataset.oathPlanEntry = entry.id;
                    checkbox.checked = draft.planEntryIds.includes(entry.id);
                    const copy = label.createSpan();
                    copy.createSpan({ text: item.label ?? entry.lastKnownLabel ?? "Unavailable item" });
                    const context = item.context?.name ?? item.context?.label;
                    copy.createSpan({ cls: "hub-oath-muted", text: [entry.kind === "workspace" ? "Workspace" : entry.kind === "file" ? "File" : "Task", context].filter(Boolean).join(" · ") });
                    checkbox.onchange = () => {
                        draft.planEntryIds = checkbox.checked ? [...draft.planEntryIds, entry.id] : draft.planEntryIds.filter(id => id !== entry.id);
                        this.updateNext?.();
                    };
                }
                [...list.querySelectorAll("input")].find(el => el.dataset.oathPlanEntry === focusId)?.focus({ preventScroll: true });
                list.scrollTop = scroll;
            };
            this.renderItems();
            const duration = this.section(OATH_COPY.duration);
            const durationChoices = this.choices(duration, "duration", [["25", "25 minutes"], ["50", "50 minutes"], ["90", "90 minutes"], ["custom", "Custom"]],
                this.custom ? "custom" : draft.durationMs == null ? null : String(draft.durationMs / 60000), value => {
                    if (value === "custom") this.customDisclosure.open();
                    else if(Number(value)*60000<=service.durationLimit(draft)) {
                        this.customDisclosure.close();
                        this.custom = false;
                        draft.durationMs = Number(value) * 60000;
                        this.setup();
                    }
                });
            const customRadio = durationChoices.querySelector('input[value="custom"]');
            const customLabel = customRadio.closest(".hub-oath-choice");
            const customCard = customLabel.ownerDocument.createElement("div");
            customCard.className = customLabel.className + " hub-oath-custom-disclosure";
            customCard.append(...customLabel.childNodes); customLabel.replaceWith(customCard);
            // Keep the radio and editable controls out of a shared native label.
            const customTitle = customCard.querySelector(".hub-oath-choice-title");
            disclosureIcons(customCard);
            const editorId = `hub-oath-custom-${this.choiceGroupId}`;
            let customOpen = false, customEditor = null;
            const syncCustom = () => {
                customCard.setAttribute("aria-expanded", String(customOpen));
                customRadio.setAttribute("aria-expanded", String(customOpen));
                if (customOpen) customRadio.setAttribute("aria-controls", editorId);
                else customRadio.removeAttribute("aria-controls");
                customRadio.checked = customOpen || !!this.custom;
                customCard.classList.toggle("is-editor", customOpen);
                customTitle.classList.toggle("hub-oath-editor-label", customOpen);
                const { value, unit } = this.customValue ?? {};
                customTitle.textContent = this.custom && !customOpen ? `${Number(value)} ${unit === "hours"
                    ? Number(value) === 1 ? "hour" : "hours" : Number(value) === 1 ? "minute" : "minutes"}` : "Custom";
            };
            const closeCustom = ({ cancel = false } = {}) => {
                if (!customOpen) return;
                const focused = customCard.contains(customCard.ownerDocument.activeElement);
                // Only the UI remembers the last commit; the draft keeps durationMs.
                if (!cancel && validDuration(this.customDuration()) && this.customDuration()<=service.durationLimit(draft))
                    this.committedCustomValue = { ...this.customValue };
                else if (this.committedCustomValue) this.customValue = { ...this.committedCustomValue };
                this.custom = !!this.committedCustomValue;
                draft.durationMs = this.custom ? this.customDuration() : null;
                customOpen = false;
                this.unitMenu?.hide(); this.stopUnitToggle?.(); this.stopUnitToggle = null;
                customEditor?.remove(); customEditor = null;
                syncCustom(); this.updateNext?.();
                if (focused) customRadio.focus({ preventScroll: true });
            };
            const openCustom = () => {
                if (customOpen) return;
                this.dateDisclosure.close();
                this.customValue ??= { value: "", unit: "minutes" };
                this.custom = true; customOpen = true;
                for (const radio of durationChoices.querySelectorAll('input[type="radio"]')) radio.checked = radio === customRadio;
                const editor = customEditor = customCard.querySelector(".hub-oath-choice-copy").createSpan({ cls: "hub-oath-custom", attr: {
                    id: editorId, role: "group", "aria-label": "Custom duration editor"
                } });
                const input = editor.createEl("input", { type: "number", attr: {
                    min: "0", step: "any", "aria-label": "Custom duration", "data-oath-autofocus": ""
                } });
                input.value = this.customValue.value;
                const unit = editor.createEl("button", { cls: "hub-oath-duration-unit", attr: {
                    type: "button", "aria-haspopup": "menu", "aria-expanded": "false"
                } });
                const unitLabel = unit.createSpan({ cls: "hub-oath-duration-unit-label" }).createSpan();
                const update = () => {
                    this.customValue.value = input.value;
                    draft.durationMs = this.customDuration();
                    const singular = Number(input.value) === 1;
                    unitLabel.textContent = this.customValue.unit === "hours" ? singular ? "hour" : "hours" : singular ? "minute" : "minutes";
                    unit.setAttribute("aria-label", `Duration unit: ${unitLabel.textContent}`);
                    this.updateNext?.();
                };
                const showUnits = () => {
                    if (this.unitMenu) { this.unitMenu.hide(); return; }
                    this.dateDisclosure.close();
                    const menu = this.unitMenu = ownMenuColors(new Menu());
                    for (const value of ["minutes", "hours"]) menu.addItem(item => item.setTitle(value)
                        .setChecked(this.customValue.unit === value).onClick(() => {
                            this.customValue.unit = value; update();
                        }));
                    menu.onHide(() => {
                        if (this.unitMenu !== menu) return;
                        this.unitMenu = null;
                        unit.setAttribute("aria-expanded", "false");
                        if (unit.isConnected) unit.focus();
                    });
                    unit.setAttribute("aria-expanded", "true");
                    const rect = unit.getBoundingClientRect();
                    menu.showAtPosition({ x: rect.left, y: rect.bottom });
                };
                this.stopUnitToggle = bindMenuToggle(unit, { isOpen: () => !!this.unitMenu, close: () => this.unitMenu?.hide() });
                unit.addEventListener("click", event => { event.stopPropagation(); showUnits(); });
                unit.addEventListener("keydown", event => {
                    if (event.key === "ArrowDown") { event.preventDefault(); showUnits(); }
                });
                input.addEventListener("click", event => event.stopPropagation());
                input.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        event.preventDefault(); event.stopPropagation(); update();
                        if (input.validity.valid && validDuration(draft.durationMs)) closeCustom();
                    }
                });
                input.addEventListener("input", update); update(); syncCustom(); input.focus({ preventScroll: true });
            };
            const toggleCustom = event => {
                event.preventDefault();
                if (customOpen) closeCustom(); else openCustom();
            };
            const customOutside = event => {
                if (!customCard.contains(event.target) && !(this.unitMenu && event.target.closest?.(".menu"))) closeCustom();
            };
            const customKey = event => {
                if (!customOpen || event.key !== "Escape" || this.unitMenu) return;
                event.preventDefault(); event.stopImmediatePropagation(); closeCustom({ cancel: true });
            };
            const customDoc = customCard.ownerDocument;
            customCard.addEventListener("click", toggleCustom);
            // Cancelled native radio activation can restore its old checked state.
            customCard.addEventListener("click", () => queueMicrotask(syncCustom));
            customRadio.addEventListener("keydown", event => {
                if (["Enter", " "].includes(event.key)) toggleCustom(event);
            });
            customCard.addEventListener("focusout", event => {
                // Native Tab can run microtasks before the destination receives focus.
                if (customCard.contains(event.relatedTarget)) return;
                queueMicrotask(() => {
                    if (!customCard.contains(customDoc.activeElement) && !this.unitMenu) closeCustom();
                });
            });
            customDoc.addEventListener("pointerdown", customOutside, true);
            customDoc.addEventListener("keydown", customKey, true);
            this.customDisclosure = { open: openCustom, close: closeCustom, destroy: () => {
                closeCustom();
                customDoc.removeEventListener("pointerdown", customOutside, true);
                customDoc.removeEventListener("keydown", customKey, true);
            } };
            syncCustom();
            const limitMessage=duration.createDiv({ cls:"hub-oath-muted" });
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const hint = this.contentEl.createSpan({ cls: "hub-guidance-status", attr: { role: "status", "aria-live": "polite" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
            const next = actions.createEl("button", { text: "Review Oath", cls: "mod-cta hub-guided-submit" });
            this.requirementGroups = { Start: start, Tasks: work, Duration: duration };
            this.updateNext = () => {
                const limit=service.durationLimit(draft);
                for(const radio of durationChoices.querySelectorAll("input[type=radio]")){
                    radio.disabled=radio===customRadio?limit<60000:Number(radio.value)*60000>limit;
                }
                const maximum=customEditor?.querySelector("input[type=number]");
                if(maximum) {
                    if(Number.isFinite(limit))maximum.max=String(Math.floor(limit/60000)/(this.customValue.unit==="hours"?60:1));
                    else maximum.removeAttribute("max");
                }
                limitMessage.textContent=Number.isFinite(limit)?(limit<60000?"The next Plan starts in less than a minute.":"Maximum before the next Plan: "+oathDuration(Math.floor(limit/60000)*60000)):"";
                const missing = service.setupRequirements(draft).find(item => !item.complete);
                next.setAttribute("aria-disabled", String(!!missing));
                if (!missing) error.textContent = "";
                if (this.guidedGroup && this.requirementGroups[missing?.key] !== this.guidedGroup) {
                    this.effects.cancel(this.guidedGroup); this.guidedGroup = null;
                }
                syncStart();
            };
            this.updateNext();
            layoutModal(this, { footer: actions });
            next.addEventListener("click", async () => {
                if (this.reviewing) return;
                try {
                    service.validateDraft(draft);
                    this.reviewing = true; next.disabled = true;
                    const review = draft.mode === "strict" ? await service.reviewStrict(draft) : null;
                    if (!this.closed) this.review(review);
                } catch (problem) {
                    const missing = service.setupRequirements(draft).find(item => !item.complete);
                    // An empty choice only needs guidance. Invalid populated
                    // values, unavailable destinations/tasks and index errors
                    // still explain what the user needs to correct or await.
                    const unchosen = missing && {
                        Start: !this.scheduledValue,
                        Tasks: !draft.planEntryIds.length,
                        Duration: draft.durationMs == null && !this.customValue?.value
                    }[missing.key];
                    error.textContent = unchosen ? "" : missing?.error ?? problem.message;
                    if (missing) {
                        this.effects.cancel(this.guidedGroup);
                        this.guidedGroup = this.requirementGroups[missing.key];
                        hint.textContent = missing.error;
                        this.effects.pulse(this.guidedGroup, this.contentEl.querySelector(".hub-modal-body"), () => { hint.textContent = ""; });
                    }
                } finally { this.reviewing = false; next.disabled = false; }
            });
        }
        clearSetupEffects() {
            this.stopApplications?.(); this.stopApplications = null;
            this.customDisclosure?.destroy(); this.customDisclosure = null;
            this.nativeDatePicker?.close(); this.nativeDatePicker = null;
            this.dateDisclosure?.destroy(); this.dateDisclosure = null;
            this.unitMenu?.hide(); this.stopUnitToggle?.(); this.stopUnitToggle = null;
            this.effects?.destroy();
            this.guidedGroup = null;
        }
        review(strictReview = null) {
            const draft = this.draft;
            service.validateDraft(draft);
            this.clearSetupEffects();
            this.renderItems = null; this.updateNext = null;
            this.contentEl.empty();
            this.contentEl.classList.remove("hub-oath-setup");
            this.contentEl.classList.add("hub-oath-review");
            const heading = createWindowTitle(this.contentEl, OATH_COPY.confirmation, "shield-user");
            setWindowUndertext(heading, this.contentEl.createEl("p", { text: "Review the terms of your commitment before taking the Oath", cls: "hub-oath-muted" }));
            const summary = this.section("Your Oath").createDiv({ cls: "hub-oath-row-group" });
            for (const [icon, label, value] of [
                ["clock", "Start time", draft.start === "now" ? "Now" : dateLabel(draft.scheduledAt)],
                ["goal", "Plan items", this.items.filter(item=>draft.planEntryIds.includes(item.entry.id))
                    .map(item=>item.label??item.entry.lastKnownLabel??"Unavailable item")],
                ["timer", "Duration", oathDuration(draft.durationMs)]
            ]) {
                oathRow(summary, icon, value, label);
            }
            for (const [heading, rows] of [["During the Oath", duringOathRows], ["Ending the Oath", endingOathRows(draft)]]) {
                const group = this.section(heading).createDiv({ cls: "hub-oath-row-group" });
                for (const [icon, text] of rows) oathRow(group, icon, text);
            }
            let accepted = null, refresh = null, manualChoice = null, manualAck = null, manualOptions = null, manualAcknowledgment = null;
            if (draft.mode === "strict") {
                if (!strictReview) throw Error("Refresh the Strict review before confirming.");
                const section = this.section("Strict Oath confirmation");
                section.createEl("p", { text: strictReview.terms, cls: "hub-oath-muted" });
                section.createEl("p", { text: "The dock opens permitted applications and returns to Itacan. Use Alt+Tab to switch existing windows; external minimize and restore controls are unavailable.", cls: "hub-oath-muted" });
                const findings = section.createDiv({ cls: "hub-oath-preflight", attr: { role: "status", "aria-live": "polite" } });
                this.paintStrictReview = review => {
                    if (manualOptions) manualOptions.hidden = !(review.preflight.blockers?.length || draft.applicationCheckMode === "manual-review");
                    strictReview = review; draft.strictConfirmation = review.confirmation;
                    findings.empty();
                    findings.createEl("p", { text: review.policy.applications.length ? "Permitted: " + review.policy.applications.join(", ") : "Permitted: Itacan only." });
                    const grouped = new Map();
                    for (const blocker of review.preflight.candidates ?? review.preflight.blockers ?? []) {
                        const key = blocker.executable;
                        grouped.set(key, [...(grouped.get(key) ?? []), blocker.title || "Untitled window"]);
                    }
                    for (const [executable, titles] of grouped) findings.createEl("p", { text: "Possible non-permitted application (switchability unverified): " + executable + " — " + titles.join(", ") });
                    for (const warning of review.preflight.warnings ?? []) findings.createEl("p", { text: warning });
                    for (const unknown of review.preflight.unknown ?? []) findings.createEl("p", { text: "Identity unavailable: " + (unknown.title || "Untitled window") });
                    for (const uncertain of review.preflight.uncertain ?? []) findings.createEl("p", { text: "Could not confirm switchability: " + uncertain.executable + " — " + (uncertain.title || "Untitled window") });
                    findings.createEl("p", { text: review.preflight.ready ? draft.applicationCheckMode === "manual-review" ? "Manual review confirmed. The Oath Reminder appears during sustained non-permitted foreground activity." : "Application checks allow starting. They will run again at activation." : draft.start === "scheduled" ? "This scheduled Oath will wait for checks to succeed and known blockers to close." : "Close or permit the listed candidates, or choose manual application review, then confirm again." });
                };
                manualOptions = section.createDiv();
                const manualLabel = manualOptions.createEl("label");
                manualChoice = manualLabel.createEl("input", { type: "checkbox", attr: { "aria-label": "Use manual application review for this Oath" } });
                manualChoice.checked = draft.applicationCheckMode === "manual-review";
                manualLabel.createSpan({ text: "Use manual application review for this Oath" });
                manualOptions.createEl("p", { text: "Application findings allow activation for this Oath. Newly observed non-permitted application paths may still trigger a return-to-Itacan attempt after two checks, up to three attempts at least 60 seconds apart. A scheduled Oath keeps this choice even if applications change before it starts." });
                manualAcknowledgment = manualOptions.createEl("label");
                manualAck = manualAcknowledgment.createEl("input", { type: "checkbox", attr: { "aria-label": "I checked Alt+Tab and accept incomplete application detection" } });
                manualAcknowledgment.createSpan({ text: "I checked Alt+Tab and closed or permitted the non-permitted applications I can switch to. I accept incomplete application detection and the foreground-dependent Oath Reminder during this Oath." });
                manualAcknowledgment.hidden = !manualChoice.checked;
                this.paintStrictReview(strictReview);
                refresh = section.createEl("button", { text: "Refresh application checks", attr: { type: "button" } });
                const label = section.createEl("label", { cls: "hub-oath-strict-accept" });
                accepted = label.createEl("input", { type: "checkbox", attr: { "aria-label": "I understand and accept the Strict Oath restrictions" } });
                label.createSpan({ text: "I understand and accept the Strict Oath restrictions" });
            }
            const pledge = this.contentEl.createEl("blockquote", { cls: "hub-oath-pledge" });
            oathIcon(pledge, "scroll-text");
            pledge.createEl("p", { text: OATH_COPY.pledge });
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            const back = actions.createEl("button", { text: "Back" });
            const take = actions.createEl("button", { text: "Take the Oath", cls: "mod-cta" });
            const updateTake = () => { take.disabled = !!accepted && (!accepted.checked || !draft.strictConfirmation || !strictReview.preflight.ready && draft.start !== "scheduled"); };
            accepted?.addEventListener("change", updateTake); updateTake();
            const renewStrictReview = async () => {
                if (this.saving || this.reviewing) return;
                accepted.checked = false;
                delete draft.strictConfirmation;
                draft.applicationCheckMode = manualChoice.checked ? "manual-review" : "automatic";
                draft.manualApplicationReviewAcknowledged = manualAck.checked;
                manualAcknowledgment.hidden = !manualChoice.checked;
                if (manualChoice.checked && !manualAck.checked) { updateTake(); return; }
                this.reviewing = true;
                refresh.disabled = take.disabled = back.disabled = manualChoice.disabled = manualAck.disabled = accepted.disabled = true;
                try { this.paintStrictReview(await service.reviewStrict(draft)); error.textContent = ""; }
                catch (problem) { delete draft.strictConfirmation; error.textContent = problem.message; }
                finally {
                    this.reviewing = false;
                    refresh.disabled = back.disabled = manualChoice.disabled = manualAck.disabled = accepted.disabled = false;
                    updateTake();
                }
            };
            manualChoice?.addEventListener("change", () => { manualAck.checked = false; void renewStrictReview(); });
            manualAck?.addEventListener("change", () => void renewStrictReview());
            refresh?.addEventListener("click", () => {
                manualChoice.checked = false; manualAck.checked = false;
                void renewStrictReview();
            });
            layoutModal(this, { footer: actions });
            back.addEventListener("click", () => this.setup());
            take.addEventListener("click", async () => {
                if (this.saving || this.reviewing || take.disabled) return; this.saving = true; take.disabled = back.disabled = true; if (refresh) refresh.disabled = true;
                try { await service.take(draft); this.saving = false; this.close(); }
                catch (problem) { this.saving = false; back.disabled = false; if (refresh) refresh.disabled = false; updateTake(); error.textContent = problem.message; }
            });
        }
        close() { if (!this.saving && !this.reviewing) super.close(); }
        onClose() { this.closed = true; this.clearSetupEffects(); this.owner?.unload(); this.contentEl.empty(); }
    }
    const modal = new Setup(service.app); modal.open(); return modal;
}

function openOathStatus(service) {
    const { Modal, Component } = require("obsidian");
    class Status extends Modal {
        onOpen() { ownModalColors(this);
            this.modalEl.classList.add("hub-oath-dialog", "hub-oath-status"); this.contentEl.classList.add("hub-button-scope");
            this.id = service.current.id; this.render();
            this.dispose = service.onChange(() => {
                if (!service.committed || service.current.id !== this.id) this.close(); else this.render();
            });
            this.clockDispose = service.onChange(() => this.updateClock(), true);
        }
        updateClock() {
            if (!this.clock) return;
            const oath = service.current; if (!oath || oath.id !== this.id) return;
            const time = oathTime(oath, service.now());
            this.clock.textContent = oath.state === "scheduled" ? `Starts ${dateLabel(oath.scheduledAt)}` : service.fulfilled ? `Fulfilled · ${shortOathTime(time.elapsedMs)} Oathbound` : `${shortOathTime(time.remainingMs)} remaining`;
        }
        render() {
            this.taskOwner?.unload();
            this.taskOwner = new Component(); this.taskOwner.load();
            const markdown = createHubMarkdown({ app: service.app, component: this.taskOwner, interactive: false });
            const oath = service.current; this.contentEl.empty();
            const heading = createWindowTitle(this.contentEl, oath.state === "scheduled" ? "Scheduled Oath" : "Oathbound", "shield-user");
            this.clock = this.contentEl.createEl("p", { cls: "hub-oath-status-time" }); this.updateClock();
            setWindowUndertext(heading, this.clock);
            setWindowUndertext(heading, this.contentEl.createEl("p", { text: fulfilmentLabel(oath), cls: "hub-oath-muted" }));
            if (service.isStrict) {
                this.contentEl.createEl("p", { text: "Strict Oath: ordinary exit becomes available after fulfillment. Desktop application checks are best effort.", cls: "hub-oath-muted" });
                const monitoring = service.strictStatus?.monitoring;
                if (monitoring) {
                    this.contentEl.createEl("p", { text: `Application focus attempts ${monitoring.attempts} of ${monitoring.limit}. Windows may refuse a request.`, cls: "hub-oath-muted" });
                    const event = monitoring.lastEvent;
                    if (event) {
                        const outcomes = { attempted: "Return requested", "focus-error": "Focus request failed", cooldown: "Cooldown suppressed return", "budget-exhausted": "Session limit suppressed return" };
                        this.contentEl.createEl("p", { text: `${outcomes[event.outcome]} | ${new Date(event.observedAt).toLocaleTimeString()} | ${event.applications.join(", ")}`, cls: "hub-oath-muted" });
                    }
                }
                for (const warning of service.strictStatus?.warnings ?? []) this.contentEl.createEl("p", { text: warning, cls: "hub-oath-muted" });
                for (const blocker of service.strictStatus?.candidates ?? service.strictStatus?.blockers ?? []) this.contentEl.createEl("p", { text: `Possible non-permitted application (switchability unverified): ${blocker.title || blocker.executable || "Unknown application"}`, cls: "hub-oath-muted" });
                for (const uncertain of service.strictStatus?.uncertain ?? []) this.contentEl.createEl("p", { text: `Could not confirm switchability: ${uncertain.title || uncertain.executable || "Untitled window"}`, cls: "hub-oath-muted" });
            }
            const work = this.contentEl.createDiv({ cls: "hub-oath-status-work" });
            const focus=service.focus;
            if (focus.planId) {
                work.createEl("button", { text: "View Plan" }).onclick = () => {
                    this.close();
                    require("./plan").openPlan(service.plugin, focus.planId);
                };
                for (const item of focus.planItems ?? []) if (item.kind !== "task") work.createDiv({ text: item.label });
            }
            for (const ref of focus.tasks) {
                const task = service.work.find(item => taskKey(item.ref)===taskKey(ref))?.task;
                renderReadOnlyTask(work, task || { text: ref.text, path: ref.path }, markdown, { unavailable: !task });
            }
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const run = async fn => {
                if (this.saving) return; this.saving = true;
                try { await fn(); this.saving = false; if (!service.committed) this.close(); }
                catch (problem) { this.saving = false; error.textContent = problem.message; }
            };
            if (service.isStrict && service.active) {
                const applications = this.contentEl.createEl("section", { cls: "hub-oath-section" });
                applications.createEl("h3", { text: "Permitted applications" });
                applications.createEl("p", { text: "Open may create another window. Use Alt+Tab to switch existing windows.", cls: "hub-oath-muted" });
                for (const executable of oath.policy.applications) {
                    const open = applications.createEl("button", { text: "Open " + executable.split("\\").pop(), attr: { type: "button" } });
                    open.addEventListener("click", async () => {
                        open.disabled = true;
                        try { await service.launchStrictApplication(executable); }
                        catch (problem) { error.textContent = problem.message; }
                        finally { open.disabled = false; }
                    });
                }
                applications.createEl("button", { text: "Return to Itacan", attr: { type: "button" } }).addEventListener("click", () => service.strict.host.focus());
            }
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            if (oath.state === "scheduled" && (service.isStrict || service.now() < oath.scheduledAt)) {
                actions.createEl("button", { text: "Cancel Oath" }).addEventListener("click", () => run(() => service.end(this.id, "cancel")));
                actions.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
                layoutModal(this, { footer: actions }); return;
            }
            const end = actions.createEl("button", { text: service.isStrict && !service.fulfilled ? "Available after fulfillment" : "End Oath" });
            end.disabled = service.isStrict && !service.fulfilled;
            end.addEventListener("click", () => {
                this.close(); void requestOathExit(service);
            });
            actions.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
            layoutModal(this, { footer: actions });
        }
        onClose() { this.dispose?.(); this.clockDispose?.(); this.taskOwner?.unload(); this.contentEl.empty(); }
    }
    const modal = new Status(service.app); modal.open(); return modal;
}

// One warning per service; incidental dismissal never calls end().
const exitUi = new WeakMap();
async function requestOathExit(service) {
    const state = exitUi.get(service) ?? { warning: null, pending: false };
    exitUi.set(service, state);
    if (state.warning) { state.warning.close(); return; }
    if (state.pending || !service.active) return;
    state.pending = true;
    const id = service.current.id;
    try {
        const decision = await service.end(id);
        if (decision !== "confirmation-required") return;
        const { Modal } = require("obsidian");
        class BreakWarning extends Modal {
            onOpen() { ownModalColors(this);
                this.modalEl.classList.add("hub-oath-dialog", "hub-oath-status");
                this.contentEl.classList.add("hub-button-scope");
                this.contentEl.createEl("h2", { text: "Break your Oath?" });
                this.contentEl.createEl("p", { text: "Your Oath has not been fulfilled yet. Ending it now will break the Oath." });
                const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
                const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
                const breakOath = actions.createEl("button", { text: "Break Oath", cls: "hub-oath-break" });
                const keep = actions.createEl("button", { text: "Keep Oath", cls: "mod-cta" });
                keep.addEventListener("click", () => this.close());
                breakOath.addEventListener("click", async () => {
                    if (this.saving) return; this.saving = true; breakOath.disabled = true;
                    try { await service.end(id, "broken"); this.close(); }
                    catch (problem) { this.saving = false; breakOath.disabled = false; error.textContent = problem.message; }
                });
                mountModalSeparators(this, { footer: actions });
                this.dispose = service.onChange(() => { if (!service.active || service.fulfilled) this.close(); });
                keep.focus();
            }
            onClose() { this.dispose?.(); if (state.warning === this) state.warning = null; this.contentEl.empty(); }
        }
        state.warning = new BreakWarning(service.app); state.warning.open();
    } catch (error) { service.error(error); }
    finally { state.pending = false; }
}

function mountOathControl(plugin, service) {
    const { setIcon } = require("obsidian");
    // Reuse Obsidian's status bar, turning it into a reserved full-width footer.
    // It is outside individual leaves and survives Home/Workspace/note changes.
    const item = plugin.addStatusBarItem(); item.classList.add("hub-oath-control", "hub-button-scope"); plugin.register(ownColorRoot(item));
    let bar = item.parentElement, fallback = false;
    if (!bar) { fallback = true; bar = document.createElement("div"); document.querySelector(".app-container").appendChild(bar); bar.appendChild(item); }
    bar.classList.add("hub-oath-statusbar");
    const button = item.createEl("button", { cls: "hub-oath-button", attr: { type: "button" } });
    setIcon(button.createSpan({ cls: "hub-oath-icon" }), "shield-user");
    const label = button.createSpan();
    const prompt=item.createEl("section",{cls:"hub-oath-plan-prompt",attr:{hidden:"","aria-label":"Scheduled Plan ready"}});
    const prompts=new Map();
    let awaiting=false;
    const plans=plugin.globalPlan;
    function updatePrompt(){
        const pending=plans?.focusPrompts()??[],ids=new Set(pending.map(record=>record.id));
        for(const [id,row] of prompts)if(!ids.has(id)){row.remove();prompts.delete(id);}
        prompt.hidden=!pending.length;
        for(const record of pending){
            if(prompts.has(record.id))continue;
            const row=prompt.createDiv({cls:"hub-oath-plan-prompt-row"});
            prompts.set(record.id,row);
            row.createDiv({text:"Your "+dateLabel(Date.parse(record.scheduledAt))+" Plan is ready. You can stay in focus.",
                attr:{role:"status","aria-live":"polite"}});
            const actions=row.createDiv({cls:"hub-oath-plan-prompt-actions"});
            const update=actions.createEl("button",{text:"Update Plan"});
            const keep=actions.createEl("button",{text:"Continue current Plan"});
            const error=row.createDiv({attr:{role:"alert",hidden:""}});
            update.onclick=()=>void choose(record.id,true,error);
            keep.onclick=()=>void choose(record.id,false,error);
        }
        for(const control of prompt.querySelectorAll("button"))control.disabled=awaiting;
    }
    async function choose(id,update,status){
        if(awaiting)return;
        awaiting=true;
        status.hidden=true;
        updatePrompt();
        try{await plans.focusChoice(id,update);}
        catch(error){status.textContent=error.message;status.hidden=false;}
        finally{awaiting=false;updatePrompt();}
    }
    let modal = null;
    const open = () => { modal?.close(); modal = service.committed ? openOathStatus(service) : openOathSetup(service); };
    button.addEventListener("click", open);
    service.fullscreen.onExitRequest?.(() => { void requestOathExit(service); });
    const update = () => {
        const oath = service.current;
        button.classList.toggle("is-active", service.active);
        button.classList.toggle("is-scheduled", oath?.state === "scheduled");
        label.textContent = !isCommitted(oath) ? "The Oath" : oath.state === "scheduled" ? "The Oath · Scheduled" : service.fulfilled ?
            `The Oath · Fulfilled · ${shortOathTime(oathTime(oath, service.now()).elapsedMs)} Oathbound` :
            `The Oath · ${shortOathTime(oathTime(oath, service.now()).remainingMs)}${oath.tasks.length ? ` · ${oathProgress(service.work).completed} / ${oath.tasks.length}` : ""}`;
        if (service.isStrict && service.strictStatus?.status === "waiting") label.textContent = "The Oath · Waiting to start";
        if (service.isStrict && service.active && service.strictStatus?.status === "degraded") label.textContent += " · Desktop checks limited";
        updatePrompt();
    };
    const stop = service.onChange(update, true); update();
    const stopPlans=plans?.subscribe(null,updatePrompt);
    return { item, open, destroy() { stop(); stopPlans?.(); service.fullscreen.onExitRequest?.(() => {}); exitUi.get(service)?.warning?.close(); modal?.close(); item.remove(); bar.classList.remove("hub-oath-statusbar"); if (fallback) bar.remove(); } };
}
module.exports = { openOathSetup, openOathStatus, mountOathControl, requestOathExit };
