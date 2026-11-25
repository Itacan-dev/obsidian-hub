"use strict";
const { Component, Modal } = require("obsidian");
const { formatDateTime } = require("../domain/dates");
const { oathDuration } = require("../domain/oath");
const { lifecycleHistory, oathMode, oathOutcome, planOutcome } = require("../domain/progress-history");
const { createHistoryPager } = require("./history-pager");
const { createHubMarkdown } = require("./markdown");
const { ownModalColors } = require("./color-system");
const { setHubIcon } = require("./icons");
const { createWindowTitle, layoutModal } = require("./window-title");

const categories = [
    ["reports", "Reports"], ["tasks", "Tasks"], ["plans", "Plans"], ["oaths", "Oaths"], ["activity", "Activity"]
];
const time = value => formatDateTime(new Date(value));

class OathHistoryModal extends Modal {
    constructor(plugin, record) {
        super(plugin.app);
        this.plugin = plugin;
        this.record = record;
    }
    onOpen() {
        ownModalColors(this);
        this.modalEl.classList.add("hub-oath-history-window");
        this.contentEl.classList.add("hub-button-scope");
        const record = this.record;
        createWindowTitle(this.contentEl, "Oath details", "shield-user");
        const body = this.contentEl.createDiv();
        const fields = body.createEl("dl", { cls: "hub-oath-history-details" });
        const detail = (name, value) => {
            fields.createEl("dt", { text: name });
            return fields.createEl("dd", { text: value });
        };
        detail("Outcome", oathOutcome(record));
        detail("Mode", oathMode(record));
        detail("Intended duration", Number.isFinite(record.durationMs) ? oathDuration(record.durationMs) : "Unavailable");
        if (record.startedAt != null) detail("Started", time(record.startedAt));
        if (record.completedAt != null) detail("Ended", time(record.completedAt));
        const plan = this.plugin.globalPlan?.readPlan(record.planId);
        const linked = detail("Associated Plan", plan ? "" : record.planId ? "Plan unavailable" : "No Plan link recorded");
        if (plan) {
            const button = linked.createEl("button", { text: plan.snapshot ? "Open Plan snapshot" : "Open Plan", attr: { type: "button" } });
            button.onclick = () => {
                this.close();
                require("./plan").openPlan(this.plugin, plan.id);
            };
        }
        const items = record.planItems ?? record.tasks?.map(task => ({ label: task.text })) ?? [];
        if (items.length) {
            body.createEl("h3", { text: "Selected items" });
            const list = body.createEl("ul");
            for (const item of items) list.createEl("li", { text: item.label ?? "Unavailable item" });
        }
        layoutModal(this, { body });
    }
}

function mountProgressHistory({ plugin, root, panel, heatmap, toolbar, container, bodyClass, signal, storageKey, workspace, renderers, onLayout, onViewChange }) {
    const component = new Component();
    component.load();
    const storage = root.ownerDocument.defaultView.sessionStorage;
    const view = root.ownerDocument.defaultView;
    const saved = storage.getItem(storageKey);
    let category = categories.some(([key]) => key === saved) ? saved : "reports";
    let expanded = false;
    const timelineKeys = new Map();
    let oathModal;
    const entries = new Map();
    const closeOath = () => { if (oathModal?.containerEl.isConnected) oathModal.close(); };
    const painters = { ...renderers, plans: body => renderTimeline(body, "plan"),
        oaths: body => renderTimeline(body, "oath") };
    const selectorLane = toolbar.createDiv({ cls: "hub-progress-history-selector-lane" });
    const selectors = selectorLane.createDiv({ cls: "hub-panel-selectors hub-equal-selectors hub-progress-history-selectors",
        attr: { role: "group", "aria-label": "History category" } });
    heatmap.classList.add("hub-progress-heatmap");
    container.classList.add("hub-progress-history-grid");
    for (const [key, label] of categories) {
        const button = selectors.createEl("button", { text: label, attr: { type: "button",
            "aria-pressed": String(key === category) } });
        button.classList.toggle("is-active", key === category);
        button.addEventListener("click", () => {
            if (key === category) return;
            remember();
            category = key;
            storage.setItem(storageKey, category);
            layout();
        }, { signal });
        const column = container.createEl("section", { cls: "hub-progress-history-column", attr: { "data-history-category": key } });
        const body = column.createDiv({ cls: bodyClass + " hub-scrollbar hub-progress-history-scroll",
            attr: { tabindex: "0", role: "region", "aria-label": label + " history" } });
        const pager = createHistoryPager(body, component);
        const entry = { column, button, body, pager, dirty: true, top: 0, minimum: 50 };
        body.hubHistoryPager = {
            reset: pager.reset,
            render: (items, renderRow) => pager.render(items, renderRow, entry.minimum)
        };
        if (key !== "oaths" && key !== "plans") body.hubMarkdown = createHubMarkdown({ app: plugin.app, component });
        entries.set(key, entry);
        column.hidden = key !== category;
    }

    const isVisible = key => category === key;
    function paint(key) {
        const entry = entries.get(key);
        if (!entry.dirty || !isVisible(key)) return;
        entry.dirty = false;
        entry.minimum = Math.max(50, entry.pager.renderedCount);
        painters[key]?.(entry.body);
        entry.body.scrollTop = entry.top;
    }
    function refresh(key) {
        const entry = entries.get(key);
        if (isVisible(key)) entry.top = entry.body.scrollTop;
        entry.dirty = true;
        paint(key);
    }
    function remember() {
        for (const [key, entry] of entries) if (isVisible(key)) entry.top = entry.body.scrollTop;
    }
    function layout() {
        panel.classList.toggle("is-progress-expanded", expanded);
        for (const [key, entry] of entries) {
            entry.column.hidden = !isVisible(key);
            entry.button.classList.toggle("is-active", isVisible(key));
            entry.button.setAttribute("aria-pressed", String(isVisible(key)));
            if (isVisible(key)) {
                paint(key);
                entry.body.scrollTop = entry.top;
            }
        }
        onLayout?.();
        onViewChange?.();
    }
    function renderTimeline(body, kind) {
        const records = lifecycleHistory({
            plans: plugin.globalPlan?.listHistorical(),
            oathsByDevice: plugin.projectWizard.data.oathsByDevice,
            workspace
        }).filter(event => event.kind === kind);
        const key = JSON.stringify(records.map(({ key, at, record }) => [key, at, record.state, record.status, record.snapshot?.note]));
        if (key === timelineKeys.get(kind)) return;
        timelineKeys.set(kind, key);
        const focusKey = body.contains(body.ownerDocument.activeElement) ? body.ownerDocument.activeElement.dataset.record : null;
        body.empty();
        if (!records.length) body.createDiv({ cls: "hub-progress-history-empty", text: kind === "plan" ? "No historical Plans yet." : "No Oaths yet." });
        body.hubHistoryPager.render(records, event => {
            const { record } = event;
            const plan = event.kind === "plan";
            const finished = plan && record.status === "finished";
            const row = body.createEl("button", { cls: "hub-lifecycle-history-row", attr: { type: "button", "data-record": event.key } });
            setHubIcon(row.createSpan({ cls: "hub-lifecycle-history-icon", attr: { "aria-hidden": "true" } }),
                plan ? finished ? "check" : "clock-alert" : "shield-user");
            row.classList.toggle("is-finished-plan", Boolean(finished));
            const copy = row.createSpan({ cls: "hub-lifecycle-history-copy" });
            copy.createSpan({ text: plan ? planOutcome(record) : "Oath " + oathOutcome(record).toLowerCase() });
            const metadata = plan ? record.snapshot.note.trim() : oathMode(record);
            if (metadata) copy.createSpan({ cls: "hub-lifecycle-history-meta", text: metadata });
            row.createEl("time", { text: time(event.at), attr: { datetime: new Date(event.at).toISOString() } });
            row.onclick = () => {
                if (plan) require("./plan").openPlan(plugin, record.id);
                else {
                    closeOath();
                    oathModal = new OathHistoryModal(plugin, record);
                    oathModal.open();
                }
            };
        });
        if (focusKey) [...body.querySelectorAll("button")].find(row => row.dataset.record === focusKey)?.focus({ preventScroll: true });
    }
    plugin.globalPlan?.subscribe(component, () => refresh("plans"));
    const stopOath = plugin.oath?.onChange(() => refresh("oaths"));
    if (stopOath) component.register(stopOath);
    component.register(closeOath);
    signal.addEventListener("abort", () => component.unload(), { once: true });
    return {
        body: key => entries.get(key).body,
        bodies: [...entries.values()].map(entry => entry.body),
        get category() { return category; },
        isVisible, refresh,
        setExpanded(value) {
            if (value === expanded) return;
            remember();
            expanded = value;
            layout();
        }
    };
}

module.exports = { mountProgressHistory };
