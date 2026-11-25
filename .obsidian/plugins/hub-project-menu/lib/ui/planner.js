"use strict";

const { Component } = require("obsidian");
const { openPlanPicker } = require("./plan-picker");
const { setHubIcon } = require("./icons");
const { mountPlanPresentation } = require("./plan-presentation");
const { button, mountPlanDetails } = require("./plan");
const { localISODate, parseLocalISODate } = require("../domain/dates");
const { editable } = require("../domain/plan-lifecycle");
const { planDay, shiftDay, orderPlans, planLabel, planClockTime } = require("../domain/plan-timeline");
const { openPlanStart } = require("./planner-start");
const { mountPlanDelete } = require("./plan-delete");
const { planFeedback, showPlanFeedback } = require("./plan-feedback");

function mountPlanner({ root, component, plugin, context = {} }) {
    const plan = plugin.globalPlan;
    let startPicker, creating = false, createId, contextualDay = false;
    const today = () => localISODate(plan.now());
    const cards = new Map();
    const viewKey = "itacan-planner-location:" + plugin.app.vault.adapter.getBasePath();
    const window = root.ownerDocument.defaultView;
    let remembered = plugin.plannerLocation;
    if (!remembered) {
        try { remembered = JSON.parse(window.localStorage.getItem(viewKey)); }
        catch { /* The window can still remember the location for this session. */ }
    }
    let day = parseLocalISODate(remembered?.day) ? remembered.day : today();
    let selectedId = remembered?.planId ?? null, fullDay = remembered?.fullDay === true;
    let failure = "", recoveryKey, restoreScroll;
    root.classList.add("hub-plans", "hub-planner", "hub-button-scope");
    const stack = root.createDiv({ cls: "hub-planner-stack hub-scrollbar", attr: { role: "region", "aria-label": "Plans for selected day" } });
    const draftsLabel = stack.createEl("h3", { cls: "hub-planner-drafts-title", text: "Drafts", attr: { hidden: "" } });
    const empty = stack.createDiv({ cls: "hub-plans-empty", text: "No Plans for this day" });
    for (const event of ["pointerdown", "keydown", "wheel"]) root.addEventListener(event, () => { restoreScroll = undefined; }, { capture: true });
    const status = root.createDiv({ cls: "hub-plans-status", attr: { role: "status" } });
    const recovery = root.createDiv({ cls: "hub-plans-recovery" });
    const footer = root.createEl("footer", { cls: "hub-planner-controls" });
    const modes = footer.createDiv({ cls: "hub-panel-selectors hub-equal-selectors hub-planner-modes", attr: { role: "group", "aria-label": "Planner layout" } });
    const focused = button(modes, "Focused", () => { fullDay = false; render(); });
    const full = button(modes, "Full day", () => { fullDay = true; render(); });
    const navigation = footer.createDiv({ cls: "hub-plans-day-navigation", attr: { role: "group", "aria-label": "Planner date" } });
    function dayButton(label, icon, delta) {
        const control = button(navigation, "", () => reveal({ date: shiftDay(day, delta) }), "hub-planner-day-button");
        control.setAttribute("aria-label", label);
        control.title = label;
        setHubIcon(control.createSpan({ attr: { "aria-hidden": "true" } }), icon);
    }
    dayButton("Previous day", "chevron-left", -1);
    const date = navigation.createEl("input", { type: "date", attr: { "aria-label": "Planner date" } });
    date.onchange = () => {
        if (parseLocalISODate(date.value)) reveal({ date: date.value });
        else date.value = day;
    };
    dayButton("Next day", "chevron-right", 1);
    const create = button(footer, "", () => run(async () => {
        if (creating) return;
        creating = true;
        createId ??= window.crypto.randomUUID();
        render();
        try {
            const id = await plan.createPlannerPlan({ date: contextualDay || day !== today() ? day : null, id: createId });
            createId = null;
            reveal({ planId: id });
            cards.get(id)?.note?.focus({ preventScroll: true });
        } finally {
            creating = false;
            render();
        }
    }), "mod-cta hub-planner-create");
    setHubIcon(create.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "plus");
    create.createSpan({ text: "New Plan" });

    function revealInStack(control) {
        if (!control) return;
        const bounds = control.getBoundingClientRect(), viewport = stack.getBoundingClientRect();
        if (bounds.top < viewport.top) stack.scrollTop += bounds.top - viewport.top;
        else if (bounds.bottom > viewport.bottom) stack.scrollTop += bounds.bottom - viewport.bottom;
    }

    function restoreStackScroll() {
        if (restoreScroll === undefined) return;
        stack.scrollTop = restoreScroll;
        if (Math.abs(stack.scrollTop - restoreScroll) < 1) restoreScroll = undefined;
    }

    function run(action) {
        failure = "";
        void Promise.resolve().then(action).catch(error => { failure = error.message; render(); });
    }

    function recordsForDay() {
        return orderPlans(Object.values(plan.published().plansById)
            .filter(record => !planDay(record) || planDay(record) === day));
    }

    function reveal({ planId, date: requestedDay } = {}) {
        restoreScroll = undefined;
        const record = plan.readPlan(planId);
        if (parseLocalISODate(requestedDay)) contextualDay = true;
        const next = (record && planDay(record)) || (parseLocalISODate(requestedDay) ? requestedDay : day);
        if (next !== day) stack.scrollTop = 0;
        day = next;
        selectedId = record?.id ?? null;
        failure = planId && !record ? "That Plan is unavailable." : "";
        render();
        revealInStack(cards.get(selectedId)?.heading);
    }

    function select(id) {
        if (selectedId === id) return;
        selectedId = id;
        failure = "";
        render();
        revealInStack(cards.get(id)?.heading);
    }

    function renderRecovery() {
        showPlanFeedback(status, [...new Set([failure, planFeedback(plan)].filter(Boolean))].join(" "));
        const key = JSON.stringify([!!plan.conflict, !!plan.error && !plan.readOnly, !!plan.deferredInput]);
        if (key === recoveryKey) return;
        recoveryKey = key;
        recovery.empty();
        if (plan.conflict) {
            button(recovery, "Keep saved Plans", () => run(() => plan.resolveConflict(false)));
            button(recovery, "Restore recovered changes", () => run(() => plan.resolveConflict(true)));
        } else if (plan.error && !plan.readOnly) {
            button(recovery, "Retry saving", () => run(async () => {
                if (plan.pendingTransition) await plan.ensureLifecycle();
                else await plan.flush();
                render();
            }));
        }
        if (plan.deferredInput) button(recovery, "Copy preserved note", () => run(() =>
            window.navigator.clipboard.writeText(plan.deferredInput.text)));
    }

    function picker(record, trigger, relink) {
        const options = { planId: record.id };
        const returnFocus = () => {
            if (trigger?.isConnected) return trigger;
            const card = cards.get(record.id);
            const rows = relink && card ? [...card.body.querySelectorAll("[data-plan-id]")] : [];
            const row = rows.find(item => item.dataset.planId === relink.id);
            return row?.querySelector("[data-plan-control=relink], button.hub-plan-title") ?? card?.add ?? card?.heading;
        };
        return openPlanPicker(plugin, { ...options, relink, returnFocus });
    }

    function openStart(card, id) {
        if (startPicker) { startPicker.close(); return; }
        const record = plan.readPlan(id);
        if (!record) return;
        startPicker = openPlanStart(plugin, card.start, record, saved => {
            reveal({ planId: saved });
            (cards.get(saved)?.start ?? cards.get(saved)?.heading)?.focus({ preventScroll: true });
        }, () => { startPicker = null; });
    }

    function editor(card, record) {
        const { body, owner } = card;
        const bound = plan.bind(record.id);
        mountPlanPresentation({
            root: body.createDiv(), component: owner, plan: bound, context: "editor", scroller: stack,
            editable: true, interactive: true, execute: record.status === "active", showStatus: false,
            emptyMessage: true,
            onRendered: restoreStackScroll,
            onRelink: (entry, trigger) => picker(record, trigger, entry),
            noteEditor: input => {
                card.note = input;
                input.oninput = () => {
                    failure = "";
                    try {
                        plan.setNote(input.value, record.id);
                    } catch (error) { failure = error.message; renderRecovery(); }
                };
            }
        });
        card.add = button(body, "", () => picker(record, card.add), "hub-button-plain hub-planner-add");
        setHubIcon(card.add.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "plus");
        card.add.createSpan({ text: "Add to Plan" });
    }

    function renderCard(card, record) {
        const selected = record.id === selectedId, expanded = selected || fullDay;
        const mode = !expanded ? "summary" : selected && editable(record) ? "editor" : "details";
        const { heading, stamp, body, summary } = card;
        const label = planLabel(record);
        if (heading.textContent !== label) heading.textContent = label;
        card.status.hidden = editable(record);
        if (!editable(record) && card.status.getAttribute("aria-label") !== label) {
            card.status.setAttribute("aria-label", label);
            card.status.title = label;
            card.status.classList.toggle("is-finished", record.status === "finished");
            setHubIcon(card.status, record.status === "finished" ? "check" : "clock-alert");
        }
        const timed = record.status === "draft" || record.status === "scheduled";
        const timeLabel = planClockTime(record);
        stamp.hidden = timed;
        if (stamp.textContent !== timeLabel) stamp.textContent = timeLabel;
        card.start.hidden = !timed;
        card.start.disabled = plan.busy;
        const missed = record.status === "draft" && record.scheduledAt && +new Date(record.scheduledAt) <= +plan.now();
        card.startLabel.textContent = missed ? "Set new start time" : timeLabel || "Set start time";
        card.start.setAttribute("aria-label", missed ? "Selected start passed. Set new start time" :
            timeLabel ? "Change start time, " + timeLabel : "Set start time");
        heading.setAttribute("aria-expanded", String(expanded));
        heading.setAttribute("aria-pressed", String(selected));
        card.element.classList.toggle("is-selected", selected);
        summary.hidden = expanded;
        summary.textContent = expanded ? "" : (record.content ?? record.snapshot).note.trim();
        const key = mode + ":" + (record.status === "active");
        if (key !== card.key) {
            card.key = key;
            card.owner?.unload();
            body.empty();
            for (const key of ["note", "add"]) delete card[key];
            body.hidden = !expanded;
            if (expanded) {
                card.owner = new Component();
                card.owner.load();
                if (mode !== "details") editor(card, record);
                else mountPlanDetails({ root: body, component: card.owner, plan, record, scroller: stack, onRendered: restoreStackScroll });
            }
        }
        if (!card.note) return;
        const blocked = plan.busy || plan.enrollingOathId === record.id;
        if (card.note.value !== record.content.note && root.ownerDocument.activeElement !== card.note) card.note.value = record.content.note;
        card.note.disabled = card.add.disabled = blocked;
    }

    function render() {
        const activeElement = root.ownerDocument.activeElement;
        const anchor = cards.get(selectedId)?.element;
        const offset = anchor?.getBoundingClientRect().top;
        if (date.value !== day) date.value = day;
        create.disabled = creating || plan.busy || day < today();
        focused.setAttribute("aria-pressed", String(!fullDay));
        full.setAttribute("aria-pressed", String(fullDay));
        focused.classList.toggle("is-active", !fullDay);
        full.classList.toggle("is-active", fullDay);
        const records = recordsForDay();
        const ids = new Set(records.map(record => record.id));
        if (!ids.has(selectedId)) selectedId = (records.find(record => planDay(record) === day) ?? records[0])?.id ?? null;
        empty.hidden = records.some(record => !!planDay(record));
        draftsLabel.hidden = records.every(record => !!planDay(record));
        for (const [id, card] of cards) {
            if (ids.has(id)) continue;
            card.owner?.unload();
            card.controls.unload();
            card.element.remove();
            cards.delete(id);
        }
        let previous = draftsLabel;
        for (const record of records) {
            let card = cards.get(record.id);
            if (!card) {
                const element = stack.createEl("article", { cls: "hub-planner-card", attr: { "data-record": record.id } });
                const header = element.createEl("header", { cls: "hub-planner-card-header" });
                const title = header.createEl("h3", { cls: "hub-planner-card-title" });
                const heading = button(title, "", () => select(record.id), "hub-button-plain");
                const actions = header.createDiv({ cls: "hub-plan-card-actions" });
                const stamp = actions.createSpan({ cls: "hub-plans-date" });
                const status = actions.createSpan({ cls: "hub-plan-status-icon", attr: { role: "img" } });
                const start = button(actions, "", () => openStart(card, record.id), "hub-button-plain hub-plan-set-start");
                start.setAttribute("aria-haspopup", "dialog");
                start.setAttribute("aria-expanded", "false");
                setHubIcon(start.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "calendar-days");
                const startLabel = start.createSpan();
                const controls = new Component();
                controls.load();
                mountPlanDelete(actions, controls, plugin, record.id, () => {
                    (cards.get(selectedId)?.heading ?? create).focus({ preventScroll: true });
                });
                const summary = element.createDiv({ cls: "hub-plans-record-note" });
                const body = element.createDiv({ cls: "hub-planner-card-body" });
                element.onclick = event => {
                    if (!event.target.closest("button, input, textarea, label, a, [role=button]") &&
                        root.ownerDocument.getSelection()?.isCollapsed !== false) select(record.id);
                };
                card = { element, header, heading, stamp, status, start, startLabel, controls, summary, body };
                cards.set(record.id, card);
            }
            if (planDay(record) && (previous === draftsLabel || previous.dataset.undated === "true")) previous = empty;
            if (previous.nextElementSibling !== card.element) {
                if (stack.moveBefore) stack.moveBefore(card.element, previous.nextElementSibling);
                else previous.after(card.element);
            }
            card.element.dataset.undated = String(!planDay(record));
            previous = card.element;
            renderCard(card, record);
        }
        if (anchor?.isConnected && anchor === cards.get(selectedId)?.element) stack.scrollTop += anchor.getBoundingClientRect().top - offset;
        if (activeElement?.isConnected && stack.contains(activeElement) && root.ownerDocument.activeElement !== activeElement && !activeElement.disabled) {
            activeElement.focus({ preventScroll: true });
        } else if (activeElement && !activeElement.isConnected && root.ownerDocument.activeElement === root.ownerDocument.body) {
            (cards.get(selectedId)?.heading ?? date).focus({ preventScroll: true });
        }
        renderRecovery();
    }

    plan.subscribe(component, render);
    const refreshTime = window.setInterval(render, 30000);
    component.register(() => {
        window.clearInterval(refreshTime);
        startPicker?.close(false);
        for (const card of cards.values()) { card.owner?.unload(); card.controls.unload(); }
    });
    if (context.planId || context.date) reveal(context);
    else {
        render();
        if (selectedId === remembered?.planId && Number.isFinite(remembered.scrollTop)) {
            restoreScroll = Math.max(0, remembered.scrollTop);
            restoreStackScroll();
        } else revealInStack(cards.get(selectedId)?.heading);
    }
    return {
        reveal,
        dismissTimePopover() { if (!startPicker) return false; startPicker.close(); return true; },
        rememberLocation() {
            const location = { day, planId: selectedId, fullDay, scrollTop: stack.scrollTop };
            plugin.plannerLocation = location;
            try { window.localStorage.setItem(viewKey, JSON.stringify(location)); }
            catch { /* Keep the in-memory location when storage is unavailable. */ }
        }
    };
}

module.exports = { mountPlanner };
