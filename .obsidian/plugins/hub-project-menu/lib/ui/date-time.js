"use strict";
const { Modal } = require("obsidian");
const { parseLocalISODate, validLocalTime } = require("../domain/dates");
const { setHubIcon } = require("./icons");

// The native calendar/time interaction is shared with The Oath. Showing the
// real input on typing also keeps the control usable without showPicker().
function bindNativeDateTimePicker({ input, surface, beforeOpen = () => {}, onClose = () => {}, bindEvents = true }) {
    const view = input.ownerDocument.defaultView;
    let frame = null;
    const watch = () => {
        frame = null;
        if (input.isConnected && input.matches(":open")) frame = view.requestAnimationFrame(watch);
        else onClose();
    };
    const open = () => {
        view.cancelAnimationFrame(frame);
        beforeOpen(); surface.classList.remove("is-typing"); input.focus();
        try {
            if (input.showPicker) {
                input.showPicker();
                if (input.matches(":open")) frame = view.requestAnimationFrame(watch);
            } else surface.classList.add("is-typing");
        } catch (_) { surface.classList.add("is-typing"); }
    };
    if (bindEvents) input.addEventListener("click", open);
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " " || (event.altKey && event.key === "ArrowDown")) {
            event.preventDefault(); open();
        } else if (!["Tab", "Escape", "Shift", "Alt", "Control", "Meta"].includes(event.key)) surface.classList.add("is-typing");
    });
    input.addEventListener("blur", () => surface.classList.remove("is-typing"));
    return { open, close() { view.cancelAnimationFrame(frame); frame = null; input.blur(); surface.classList.remove("is-typing"); } };
}

function mountTaskDateTime({ app, host, label, state, dateKey, timeKey, onChange = () => {} }) {
    const field = host.createDiv({ cls: "hub-date-time-field" });
    const title = field.createEl("label", { text: label });
    const control = field.createEl("button", { cls: "hub-date-time-control hub-date-time-trigger", attr: {
        type: "button", "aria-label": label, "aria-haspopup": "dialog", "aria-expanded": "false"
    } });
    const display = control.createSpan({ cls: "hub-date-time-value" });
    setHubIcon(control.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "chevron-down");
    let picker = null, minimum = "";
    const sync = () => {
        const date = parseLocalISODate(state[dateKey]);
        const time = date && validLocalTime(state[timeKey]) ? state[timeKey] : "";
        const text = date ? `${date.getDate()} ${date.toLocaleDateString("en-US", { month: "short" })} ${date.getFullYear()}${time ? ", " + time : ""}` : "Select date and time";
        display.textContent = text;
        picker?.refresh();
    };
    const update = (date, time) => {
        state[dateKey] = date; state[timeKey] = date ? time : "";
        sync(); onChange({ [dateKey]: state[dateKey], [timeKey]: state[timeKey] });
    };
    // Native datetime-local cannot represent a date without a time. Keep the
    // native date/time interactions inside one shared picker, with independent
    // optional time precision rather than seeding a persisted midnight.
    class TaskDateTimePicker extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-task-date-time-picker");
            this.contentEl.classList.add("hub-button-scope", "hub-capture-form-scope");
            this.setTitle(label);
            const fields = this.contentEl.createDiv({ cls: "hub-task-date-time-picker-fields" });
            const dateLabel = fields.createEl("label", { cls: "hub-capture-field" });
            dateLabel.createSpan({ cls: "hub-capture-field-title", text: "Date" });
            this.date = dateLabel.createEl("input", { type: "date", attr: { "aria-label": label + " date", lang: "en" } });
            const timeLabel = fields.createEl("label", { cls: "hub-capture-field" });
            timeLabel.createSpan({ cls: "hub-capture-field-title", text: "Time (optional)" });
            const timeRow = timeLabel.createDiv({ cls: "hub-task-time-field" });
            this.time = timeRow.createEl("input", { type: "time", attr: { "aria-label": label + " time", lang: "en" } });
            this.clearTime = timeRow.createEl("button", { text: "Clear time", attr: { type: "button" } });
            this.clearTime.onclick = () => update(state[dateKey], "");
            for (const event of ["input", "change"]) {
                this.date.addEventListener(event, () => { if (!this.date.validity.badInput) update(this.date.value, state[timeKey] ?? ""); });
                this.time.addEventListener(event, () => { if (!this.time.validity.badInput) update(state[dateKey], this.time.value); });
            }
            const actions = this.contentEl.createDiv({ cls: "hub-capture-actions" });
            actions.createEl("button", { text: "Clear date", attr: { type: "button" } }).onclick = () => update("", "");
            actions.createEl("button", { text: "Done", attr: { type: "button" } }).onclick = () => {
                if (this.date.reportValidity() && this.time.reportValidity()) this.close();
            };
            this.refresh(); this.date.focus();
        }
        refresh() {
            this.date.value = state[dateKey] ?? ""; this.date.min = minimum;
            this.time.value = state[timeKey] ?? ""; this.time.disabled = !state[dateKey];
            this.clearTime.disabled = !state[timeKey];
        }
        onClose() {
            picker = null; control.setAttribute("aria-expanded", "false"); this.contentEl.empty();
            if (control.isConnected) control.focus({ preventScroll: true });
        }
    }
    const open = () => {
        if (control.disabled || picker) return;
        control.focus({ preventScroll: true });
        picker = new TaskDateTimePicker(app); control.setAttribute("aria-expanded", "true"); picker.open();
    };
    control.addEventListener("click", open);
    control.addEventListener("keydown", event => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } });
    title.addEventListener("click", open);
    sync();
    return { input: control, field, refresh: sync, setMin: date => { minimum = date ?? ""; picker?.refresh(); }, destroy: () => picker?.close() };
}

module.exports = { bindNativeDateTimePicker, mountTaskDateTime };
