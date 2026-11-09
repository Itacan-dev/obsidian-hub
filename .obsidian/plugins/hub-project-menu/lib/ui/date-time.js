"use strict";
const { ownModalColors } = require("./color-system");

const { Modal } = require("obsidian");
const { layoutModal } = require("./window-title");
const { parseLocalISODate, validLocalTime, formatDate } = require("../domain/dates");
const { setHubIcon } = require("./icons");

// Independent native fields preserve optional time precision in both layouts.
function createTaskDateTimeInput(host, type, label) {
    return host.createEl("input", { type, attr: { "aria-label": label, lang: "en" } });
}

function createTaskDatePopoverInput(host, type, label, placeholder, { keyboardPicker = false } = {}) {
    const surface = host.createDiv({ cls: "hub-task-date-surface" });
    const input = createTaskDateTimeInput(surface, type, label);
    // Once native segments have been shown, retain that presentation for this
    // mounted editor. Pointer focus transfer precedes the dismissing click;
    // reverting to its hint on blur would flash a placeholder before removal.
    if (keyboardPicker) input.addEventListener("focus", () => surface.classList.add("is-native-editing"));
    // Chromium omits its time indicator when disabled. Supply the native
    // Lucide glyph only in that unavailable state; enabled fields keep theirs.
    const unavailableIcon = type === "time" && keyboardPicker ? surface.createSpan({ cls: "hub-task-date-unavailable-icon", attr: { "aria-hidden": "true" } }) : null;
    if (unavailableIcon) setHubIcon(unavailableIcon, "clock");
    const hint = surface.createSpan({ cls: "hub-task-date-placeholder", text: placeholder, attr: { "aria-hidden": "true" } });
    const clear = surface.createEl("button", { cls: "hub-task-date-clear", attr: { type: "button", "aria-label": "Clear " + label.toLowerCase() } });
    setHubIcon(clear, "x");
    const refresh = () => {
        const populated = !!input.value || input.validity.badInput;
        surface.classList.toggle("is-empty", !populated); surface.classList.toggle("is-disabled", input.disabled);
        if (input.disabled) surface.classList.remove("is-native-editing");
        hint.hidden = populated; clear.hidden = !input.value;
        if (unavailableIcon) unavailableIcon.hidden = !input.disabled;
    };
    const picker = keyboardPicker ? bindNativeDateTimePicker({ input, surface, bindEvents: false, pickerKeys: [" "] }) : null;
    return { input, clear, refresh, destroy: () => picker?.close() };
}

// Let Chromium measure its own localized segments, indicators and field chrome.
// Measure an empty native field so configured/cleared endpoints retain geometry.
function measureNativeDatePopover(element, availableWidth, { equalColumns = false } = {}) {
    const fields = element.querySelector('.hub-task-popover-date-inputs');
    const view = element.ownerDocument.defaultView;
    const widths = [...fields.querySelectorAll('input')].map(input => {
        const probe = input.cloneNode(); probe.value = ""; probe.disabled = false;
        Object.assign(probe.style, { position: "absolute", visibility: "hidden", width: "auto", minWidth: "0", maxWidth: "none", fieldSizing: "content" });
        input.parentElement.append(probe);
        const width = Math.ceil(probe.getBoundingClientRect().width); probe.remove(); return width;
    });
    const style = view.getComputedStyle(element), gap = parseFloat(view.getComputedStyle(fields).columnGap);
    const chrome = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const desired = (equalColumns ? 2 * Math.max(...widths) : widths[0] + widths[1]) + gap + chrome;
    const stacked = desired > availableWidth;
    fields.style.gridTemplateColumns = stacked ? "minmax(0,1fr)" : equalColumns ? "repeat(2,minmax(0,1fr))" : `minmax(0,${widths[0]}fr) minmax(0,${widths[1]}fr)`;
    return stacked ? Math.max(...widths) + chrome : desired;
}

// The native calendar/time interaction is shared with The Oath. Showing the
// real input on typing also keeps the control usable without showPicker().
function bindNativeDateTimePicker({ input, surface, beforeOpen = () => {}, onClose = () => {}, bindEvents = true, pickerKeys = ["Enter", " "] }) {
    const view = input.ownerDocument.defaultView;
    let frame = null;
    const watch = () => {
        frame = null;
        if (input.isConnected && input.matches(":open")) frame = view.requestAnimationFrame(watch);
        else onClose();
    };
    const open = () => {
        if (input.disabled || input.readOnly) return;
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
        if (pickerKeys.includes(event.key) || (event.altKey && event.key === "ArrowDown")) {
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
        const text = date ? `${formatDate(date)}${time ? ", " + time : ""}` : "Select date and time";
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
        onOpen() { ownModalColors(this);
            this.modalEl.classList.add("hub-task-date-time-picker");
            this.contentEl.classList.add("hub-button-scope", "hub-capture-form-scope");
            this.setTitle(label);
            const fields = this.contentEl.createDiv({ cls: "hub-task-date-time-picker-fields" });
            const dateLabel = fields.createEl("label", { cls: "hub-capture-field" });
            dateLabel.createSpan({ cls: "hub-capture-field-title", text: "Date" });
            this.date = createTaskDateTimeInput(dateLabel, "date", label + " date");
            const timeLabel = fields.createEl("label", { cls: "hub-capture-field" });
            timeLabel.createSpan({ cls: "hub-capture-field-title", text: "Time (optional)" });
            const timeRow = timeLabel.createDiv({ cls: "hub-task-time-field" });
            this.time = createTaskDateTimeInput(timeRow, "time", label + " time");
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
            layoutModal(this, { footer: actions });
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

module.exports = { bindNativeDateTimePicker, mountTaskDateTime, createTaskDateTimeInput, createTaskDatePopoverInput, measureNativeDatePopover };
