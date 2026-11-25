"use strict";

const { Component, Modal, Notice } = require("obsidian");
const { ownModalColors, ownNoticeColors } = require("./color-system");
const { createModalHeader, mountModalSeparators } = require("./window-title");
const { mountPlanPresentation } = require("./plan-presentation");
const { mountFinishPlan } = require("./plan-finish");
const { localISODate, formatDate } = require("../domain/dates");
const { planDay, shiftDay, orderPlans, planLabel, planTime, planClockTime } = require("../domain/plan-timeline");

const { setHubIcon } = require("./icons");
const { createIconAction } = require("./controls");
const { editable } = require("../domain/plan-lifecycle");
const { mountPlanDelete } = require("./plan-delete");

function button(parent, text, onclick, cls) {
    const control = parent.createEl("button", { text, cls, attr: { type: "button" } });
    control.onclick = onclick;
    return control;
}

function mountPlanDetails({ root, component, plan, record, scroller, interactive = true, noteCaption, onRendered }) {
    return mountPlanPresentation({
        root, component, plan: plan.bind(record.id, { historicalNavigation: interactive }),
        context: "report", scroller, interactive, execute: interactive && record.status === "active",
        historicalNavigation: interactive, noteCaption, onRendered, showStatus: false, emptyMessage: false
    });
}

function mountPlans({ root, header, component, plugin, plannerButton, visible = true }) {
    const plan = plugin.globalPlan;
    const today = () => localISODate(plan.now());
    const modes = header.createDiv({ cls: "hub-panel-selectors hub-equal-selectors hub-plan-browser-modes", attr: { role: "group", "aria-label": "Plan browser layout" } });
    const byPlan = button(modes, "Plans", () => switchMode("plans"));
    const byDay = button(modes, "Days", () => switchMode("days"));
    header.insertBefore(modes, plannerButton.parentElement);
    plannerButton.onclick = () => openPlanner(plugin, {
        ...(showing ? (mode === "plans" && selectedId ? { planId: selectedId } : { date: day }) : {}),
        returnFocus: plannerButton
    });
    const columns = root.createDiv({ cls: "hub-plans-columns" });
    root.classList.add("hub-plans");
    let mode = "plans", day = today(), selectedId = null, records = [], initialized = false;
    let showing = visible, mounted, layoutKey, creating = false, createId;

    function switchMode(next) {
        if (next === mode) return;
        const selected = records.find(record => record.id === selectedId);
        if (next === "days" && selected) day = planDay(selected);
        if (next === "plans" && (!selected || planDay(selected) !== day)) {
            selectedId = records.find(record => planDay(record) === day)?.id ?? null;
        }
        mode = next;
        refresh();
    }

    function showPlan(id) {
        selectedId = id;
        refresh();
        columns.querySelector(".hub-plans-center h3")?.focus({ preventScroll: true });
    }

    function pane(label, cls = "", recenter) {
        const section = columns.createEl("section", { cls: "hub-plans-pane " + cls, attr: { "aria-label": label } });
        const headerRow = section.createDiv({ cls: "hub-plan-date-row" });
        const heading = headerRow.createEl("h3", { attr: { tabindex: "-1" } });
        if (recenter) {
            section.classList.add("hub-plans-side-day");
            const control = button(heading, label, recenter, "hub-button-plain hub-plans-day-heading");
            control.setAttribute("aria-label", "Center " + label);
            section.onclick = event => {
                if (!event.target.closest("button, a, input, [role=button]") && root.ownerDocument.getSelection()?.isCollapsed !== false) recenter();
            };
        }
        else heading.textContent = label;
        const body = section.createDiv({ cls: "hub-plans-scroll hub-scrollbar" });
        return { headerRow, body };
    }

    function statusIcon(host, record) {
        const label = planLabel(record);
        const icon = host.createSpan({ cls: "hub-plan-status-icon",
            attr: { role: "img", "aria-label": label, title: label } });
        icon.classList.toggle("is-finished", record.status === "finished");
        setHubIcon(icon, record.status === "finished" ? "check" : "clock-alert");
    }

    function recordAction(host, record) {
        if (editable(record)) {
            const edit = createIconAction(host, "Edit Plan", "pencil", () => {
                openPlanner(plugin, { planId: record.id, returnFocus: edit });
            });
        } else statusIcon(host, record);
    }

    function details(body, record, { interactive = true } = {}) {
        const article = body.createEl("article", { cls: "hub-plans-day-record", attr: { "data-record": record.id } });
        article.classList.toggle("is-active-plan", record.status === "active");
        const actions = article.createDiv({ cls: "hub-plan-record-tools hub-plan-card-actions" });
        recordAction(actions, record);
        mountPlanDelete(actions, mounted, plugin, record.id, focusBrowser);
        mountPlanDetails({ root: article.createDiv(), component: mounted, plan, record, scroller: body, interactive,
            noteCaption: planClockTime(record) });
        if (interactive && record.status === "active") {
            const finish = article.createDiv({ cls: "hub-plan-card-finish" });
            mountFinishPlan({ root: finish, component: mounted, plugin, planId: record.id });
        }
    }

    function focusBrowser() {
        columns.querySelector(".hub-plans-center h3")?.focus({ preventScroll: true });
    }

    function summaries(body, slice, empty) {
        if (!slice.length) body.createDiv({ cls: "hub-plans-empty", text: empty });
        for (const record of slice) {
            const article = body.createEl("article", { cls: "hub-plans-summary-card", attr: { "data-record": record.id } });
            const control = button(article, "", () => showPlan(record.id), "hub-plans-record");
            control.dataset.record = record.id;
            control.classList.toggle("is-active-plan", record.status === "active");
            const note = (record.content ?? record.snapshot).note.trim();
            control.createEl(note ? "span" : "em", { cls: "hub-plans-record-note", text: note || "No note" });
            control.createSpan({ cls: "hub-plans-record-time", text: planTime(record) });
            const actions = article.createDiv({ cls: "hub-plan-card-actions" });
            recordAction(actions, record);
            mountPlanDelete(actions, mounted, plugin, record.id, focusBrowser);
        }
    }

    function refresh() {
        root.hidden = modes.hidden = !showing;
        if (!showing) return;
        for (const [control, pressed] of [[byPlan, mode === "plans"], [byDay, mode === "days"]]) {
            control.setAttribute("aria-pressed", String(pressed));
            control.classList.toggle("is-active", pressed);
        }
        const state = plan.published();
        records = orderPlans(Object.values(state.plansById).filter(record => planDay(record)));
        if (!initialized && records.length) {
            initialized = true;
            selectedId = state.activePlanId ?? records.find(record => record.status === "scheduled")?.id ?? records.at(-1).id;
        }
        let index = records.findIndex(record => record.id === selectedId);
        if (mode === "plans" && selectedId && index < 0) {
            selectedId = records.find(record => planDay(record) === day)?.id ?? null;
            index = records.findIndex(record => record.id === selectedId);
        }
        const selected = records[index];
        if (mode === "plans" && selected) day = planDay(selected);
        const dates = [shiftDay(day, -1), day, shiftDay(day, 1)];
        const visibleRecords = mode === "days" ? records.filter(record => dates.includes(planDay(record))) : records;
        const key = JSON.stringify([mode, day, today(), selectedId, visibleRecords.map(record => [
            record.id, record.status, record.scheduledAt, planDay(record),
            mode === "plans" && record.id !== selectedId ? (record.content ?? record.snapshot).note : null
        ])]);
        if (key === layoutKey) return;
        const layoutClass = mode === "days" ? "is-by-day" : "is-by-plan";
        const sameLayout = columns.classList.contains(layoutClass) && columns.dataset.anchor === (mode === "days" ? day : selectedId ?? day);
        const scroll = sameLayout ? [...columns.querySelectorAll(".hub-plans-scroll")].map(body => body.scrollTop) : [];
        const focus = root.ownerDocument.activeElement;
        const focusedId = columns.contains(focus) ? focus?.closest("[data-record]")?.dataset.record : null;
        layoutKey = key;
        mounted?.unload();
        mounted = new Component();
        mounted.load();
        columns.empty();
        columns.className = "hub-plans-columns " + layoutClass;
        columns.dataset.anchor = mode === "days" ? day : selectedId ?? day;
        if (mode === "plans") {
            const earlier = index < 0 ? records.filter(record => planDay(record) < day) : records.slice(0, index);
            const later = index < 0 ? records.filter(record => planDay(record) > day) : records.slice(index + 1);
            summaries(pane("Earlier").body, earlier.reverse(), "No earlier Plans");
            const center = pane(formatDate(day, "full"), "hub-plans-center");
            if (selected) details(center.body, selected);
            else center.body.createDiv({ cls: "hub-plans-empty", text: "No Plans for this day" });
            summaries(pane("Later").body, later, "No later Plans");
        } else {
            for (const date of dates) {
                const recenter = date === day ? undefined : () => {
                    day = date;
                    refresh();
                    columns.querySelector(".hub-plans-center h3")?.focus({ preventScroll: true });
                };
                const cls = [date === today() ? "is-today" : "", date === day ? "hub-plans-center" : ""].join(" ");
                const { headerRow, body } = pane(formatDate(date, "full"), cls, recenter);
                if (date >= today()) {
                    const add = createIconAction(headerRow, "Create Plan for " + formatDate(date, "full"), "plus", async () => {
                        if (creating) return;
                        creating = true;
                        createId ??= crypto.randomUUID();
                        try {
                            const id = await plan.createPlannerPlan({ date, id: createId });
                            createId = null;
                            const returnFocus = columns.querySelector('[aria-label="' + add.getAttribute("aria-label") + '"]');
                            openPlanner(plugin, { planId: id, returnFocus });
                        } catch (error) {
                            ownNoticeColors(new Notice(error.message));
                        } finally {
                            creating = false;
                        }
                    });
                }
                const entries = visibleRecords.filter(record => planDay(record) === date);
                if (!entries.length) body.createDiv({ cls: "hub-plans-empty", text: "No Plans for this day" });
                for (const record of entries) details(body, record, { interactive: date === day });
            }
        }
        [...columns.querySelectorAll(".hub-plans-scroll")].forEach((body, index) => { body.scrollTop = scroll[index] ?? 0; });
        if (focusedId && sameLayout) [...columns.querySelectorAll("button[data-record]")]
            .find(control => control.dataset.record === focusedId)?.focus({ preventScroll: true });
    }

    plan.subscribe(component, refresh);
    const win = root.ownerDocument.defaultView;
    const clock = win.setInterval(() => { if (showing) refresh(); }, 30000);
    component.register(() => { win.clearInterval(clock); mounted?.unload(); });
    refresh();
    return {
        setVisible(value) { showing = value; refresh(); }
    };
}

class PlanModal extends Modal {
    constructor(plugin, context) {
        super(plugin.app);
        this.hasInitialInputFocus = false;
        this.plugin = plugin;
        this.context = { ...context };
    }
    onOpen() {
        ownModalColors(this);
        this.modalEl.classList.add("hub-plans-window", "hub-planner-window");
        const { heading } = createModalHeader(this.contentEl, {
            title: "Planner", subtitle: "Plan and schedule your work.", icon: "goal"
        });
        this.heading = heading;
        this.heading.tabIndex = -1;
        this.component = new Component();
        this.component.load();
        this.presentation = require("./planner").mountPlanner({
            root: this.contentEl.createDiv(), component: this.component, plugin: this.plugin, context: this.context
        });
        mountModalSeparators(this, { footer: this.contentEl.querySelector(".hub-planner-controls") });
        this.heading.focus({ preventScroll: true });
    }
    onEscapeKey(event) {
        if (!event.defaultPrevented && this.presentation?.dismissTimePopover()) {
            event.preventDefault();
            return;
        }
        super.onEscapeKey(event);
    }
    close() {
        if (this.closing) return;
        this.closing = true;
        void this.plugin.globalPlan.closePlanner().then(safe => {
            if (safe) {
                this.presentation.rememberLocation();
                super.close();
            }
            else ownNoticeColors(new Notice("Retry saving the Plan changes before closing."));
        }).catch(error => ownNoticeColors(new Notice(error.message))).finally(() => {
            this.closing = false;
        });
    }
    onClose() {
        this.component?.unload();
        if (this.plugin.planModal === this) this.plugin.planModal = null;
        const target = this.context.returnFocus;
        if (target?.isConnected && target.getClientRects().length) queueMicrotask(() => target.focus({ preventScroll: true }));
    }
}

function openPlanner(plugin, context = {}) {
    if (plugin.planPicker?.containerEl?.isConnected && plugin.planModal?.containerEl?.isConnected) {
        plugin.planPicker.modalEl.focus();
        return plugin.planModal;
    }
    if (plugin.planModal?.containerEl?.isConnected) {
        if (context.returnFocus) plugin.planModal.context.returnFocus = context.returnFocus;
        // Ordinary repeated opens bring back the same window and its work.
        if (context.planId || context.date) plugin.planModal.presentation.reveal(context);
        plugin.planModal.heading.focus({ preventScroll: true });
        return plugin.planModal;
    }
    const modal = plugin.planModal = new PlanModal(plugin, context);
    modal.open();
    return modal;
}

function openPlan(plugin, planId) {
    return openPlanner(plugin, { planId });
}

module.exports = { mountPlans, PlanModal, openPlan, openPlanner, button, mountPlanDetails };
