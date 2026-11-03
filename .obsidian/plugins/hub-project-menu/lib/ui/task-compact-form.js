"use strict";
const { mountTaskText, mountWrappingTaskInput, mountTaskSteps, taskSection } = require("./task-form");
const { openTaskPopover } = require("./task-popover");
const { setHubIcon } = require("./icons");
const { createTaskDatePopoverInput } = require("./date-time");
const { taskDatesButtonLabel, validateTaskDates } = require("../domain/task-compact-form");
const { bindCompletionSound, playTaskCompletionSound } = require("./completion-audio");
let descriptionId = 0;

function propertyButton(host, name, icon) {
    const button = host.createEl("button", { cls: "hub-task-property", attr: { type: "button", "aria-label": name, "aria-expanded": "false" } });
    const graphic = button.createSpan({ cls: "hub-task-property-icon", attr: { "aria-hidden": "true" } });
    setHubIcon(graphic, icon);
    const label = button.createSpan({ cls: "hub-task-property-value", text: name });
    return { button, graphic, label, update(text) { label.textContent = text; button.title = name + ": " + text; button.setAttribute("aria-label", text === name ? name : name + ": " + text); } };
}

function bindPropertyPopover(control, options) {
    let picker = null;
    const close = (restore = true) => picker?.close(restore);
    const open = () => {
        if (control.button.disabled) return;
        if (picker) { close(); return; }
        picker = openTaskPopover(control.button, { ...options, onClose: () => { picker = null; options.onClose?.(); } });
    };
    control.button.setAttribute("aria-haspopup", "dialog");
    control.button.addEventListener("click", open);
    control.button.addEventListener("keydown", event => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } });
    return { close, destroy: () => close(false) };
}

function mountTaskDescription(host, state, onChange = () => {}) {
    const section = taskSection(host); section.dataset.taskField = "description";
    const heading = section.createEl("h3", { text: "Description" });
    const action = section.createEl("button", { cls: "hub-task-inline-action hub-task-description-action", attr: {
        type: "button", "aria-expanded": "false", "aria-controls": "hub-task-description-" + ++descriptionId } });
    setHubIcon(action.createSpan({ attr: { "aria-hidden": "true" } }), "align-left"); action.createSpan({ text: "Add a description" });
    const input = section.createEl("textarea", { cls: "hub-task-description", attr: { rows: "1", id: action.getAttribute("aria-controls"),
        "aria-label": "Description", placeholder: "Add a description..." } });
    const preview = section.createEl("button", { cls: "hub-task-description-preview", attr: { type: "button", "aria-label": "Edit description",
        "aria-controls": input.id, "aria-describedby": input.id + "-copy" } });
    const copy = preview.createSpan({ cls: "hub-task-description-copy", attr: { id: input.id + "-copy" } });
    setHubIcon(preview.createSpan({ cls: "hub-task-description-edit", attr: { "aria-hidden": "true" } }), "pencil");
    input.value = state.description ?? "";
    const resize = () => { if (!input.hidden) { input.style.height = "auto"; input.style.height = input.scrollHeight + 2 + "px"; } };
    const show = (expanded, focus = false) => {
        const populated = !!state.description;
        heading.hidden = !expanded && !populated;
        input.hidden = !expanded; action.hidden = expanded || populated; preview.hidden = expanded || !populated;
        copy.textContent = state.description ?? "";
        action.setAttribute("aria-expanded", String(expanded)); preview.setAttribute("aria-expanded", String(expanded)); resize();
        if (focus) input.focus();
    };
    action.addEventListener("click", () => show(true, true));
    preview.addEventListener("click", () => show(true, true));
    input.addEventListener("blur", () => show(false));
    input.addEventListener("keydown", event => {
        if (event.key === "Escape" && !event.isComposing && event.keyCode !== 229) {
            event.preventDefault(); event.stopPropagation(); show(false);
            (state.description ? preview : action).focus({ preventScroll: true });
        }
    });
    input.addEventListener("input", () => { state.description = input.value; resize(); onChange({ description: state.description }); });
    let width;
    const observer = new input.ownerDocument.defaultView.ResizeObserver(() => {
        if (width !== input.clientWidth) { width = input.clientWidth; resize(); }
    });
    observer.observe(input); show(false);
    return { input, destroy: () => observer.disconnect() };
}

function mountTaskDates(host, state, onChange = () => {}) {
    const control = propertyButton(host, "Dates", "calendar-days"); control.button.dataset.taskProperty = "dates";
    const refresh = () => control.update(taskDatesButtonLabel(state));
    const picker = bindPropertyPopover(control, { title: "Dates", className: "hub-task-dates-popover", width: 420, render({ body, close }) {
        const draft = Object.fromEntries(["fromDate", "fromTime", "dueDate", "dueTime"].map(key => [key, state[key] ?? ""]));
        const fields = [];
        for (const [prefix, name] of [["from", "Start date"], ["due", "Due date"]]) {
            const field = body.createEl("section", { cls: "hub-task-popover-date" });
            const heading = field.createDiv({ cls: "hub-task-popover-date-heading" }); heading.createEl("strong", { text: name });
            const inputs = field.createDiv({ cls: "hub-task-popover-date-inputs" });
            const nativeField = (type, label, placeholder) => createTaskDatePopoverInput(inputs, type, label, placeholder);
            const dateField = nativeField("date", name, "Select date"), timeField = nativeField("time", name + " time", "Add time");
            const { input: date, clear: clearDate } = dateField, { input: time, clear: clearTime } = timeField;
            const refresh = () => { time.disabled = !date.value; dateField.refresh(); timeField.refresh(); };
            const sync = () => { date.value = draft[prefix + "Date"]; time.value = draft[prefix + "Time"]; refresh(); };
            clearDate.onclick = () => { draft[prefix + "Date"] = ""; draft[prefix + "Time"] = ""; sync(); date.focus(); };
            clearTime.onclick = () => { draft[prefix + "Time"] = ""; sync(); time.focus(); };
            for (const event of ["input", "change"]) {
                date.addEventListener(event, () => {
                    if (date.validity.badInput) return;
                    draft[prefix + "Date"] = date.value;
                    if (!date.value) draft[prefix + "Time"] = "";
                    time.value = draft[prefix + "Time"]; refresh();
                });
                time.addEventListener(event, () => { if (!time.validity.badInput && !time.disabled) draft[prefix + "Time"] = time.value; refresh(); });
            }
            sync(); fields.push({ date, time, sync });
        }
        const error = body.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
        const actions = body.createDiv({ cls: "hub-task-popover-actions" });
        actions.createEl("button", { text: "Clear all", attr: { type: "button" } }).onclick = () => { for (const key of Object.keys(draft)) draft[key] = ""; fields.forEach(field => field.sync()); error.textContent = ""; fields[0].date.focus(); };
        actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => close();
        const apply = actions.createEl("button", { text: "Apply", cls: "mod-cta", attr: { type: "button" } });
        apply.onclick = () => {
            if (!fields.every(({ date, time }) => date.reportValidity() && time.reportValidity())) return;
            try { validateTaskDates(draft); } catch (problem) { error.textContent = problem.message; return; }
            Object.assign(state, draft); refresh(); onChange(draft); close();
        };
        body.addEventListener("keydown", event => { if (event.key === "Enter" && event.target.tagName === "INPUT") { event.preventDefault(); apply.click(); } });
    } });
    refresh(); return { ...picker, refresh };
}

function selectionOption(body, { label, value, selected, marker, reserveMarker = false, onSelect }) {
    const button = body.createEl("button", { cls: "hub-task-property-option", attr: { type: "button", role: "menuitemradio", "aria-checked": String(selected), "data-value": value } });
    if (marker || reserveMarker) button.createSpan({ cls: "hub-task-necessity-bar " + (marker ? "is-" + marker : "hub-task-necessity-spacer"), attr: { "aria-hidden": "true" } });
    button.createSpan({ text: label }); button.onclick = onSelect;
    return button;
}
function selectionKeys(body) {
    body.setAttribute("role", "menu");
    body.addEventListener("keydown", event => {
        const options = [...body.querySelectorAll('[role="menuitemradio"]')], index = options.indexOf(body.ownerDocument.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : event.key === "ArrowDown" ? (index + 1) % options.length : event.key === "ArrowUp" ? (index + options.length - 1) % options.length : null;
        if (next !== null) { event.preventDefault(); options[next]?.focus(); }
    });
}
function mountTaskNecessity(host, state, onChange = () => {}, { control = propertyButton(host, "Necessity", "flag"), heading = true, keepLabel = false, clearLabel = "None / Clear selection", persistent = false, order = ["must", "should"], terminology = "necessity", bind = bindPropertyPopover } = {}) {
    const title = terminology === "importance" ? "Importance" : "Necessity";
    const actionLabel = terminology === "importance" ? "Set importance" : "Select necessity level";
    control.button.dataset.taskProperty = "necessity";
    const refresh = () => {
        const value = state.necessity;
        const configured = value === "must" || value === "should";
        control.update(keepLabel ? (terminology === "importance" && configured ? "Change importance" : actionLabel) : value === "must" ? "Must do" : value === "should" ? "Should do" : title);
        if (keepLabel) return;
        control.graphic.replaceChildren();
        if (value) control.graphic.createSpan({ cls: "hub-task-necessity-bar is-" + value }); else setHubIcon(control.graphic, "flag");
    };
    const picker = bind(control, { title, heading, avoidFooter: persistent, className: "hub-task-necessity-popover", width: 240, render({ body, close }) {
        const choices = persistent ? body.createDiv() : body;
        selectionKeys(choices);
        const select = value => {
            state.necessity = value; refresh(); onChange({ necessity: value });
            for (const option of choices.querySelectorAll('[role="menuitemradio"]')) option.setAttribute("aria-checked", String(option.dataset.value === (value ?? "")));
            if (!persistent) close();
        };
        for (const [value, label] of [...order.map(value => [value, value === "must" ? "Must do" : "Should do"]), ...(!persistent ? [[null, clearLabel]] : [])]) {
            selectionOption(choices, { value: value ?? "", label, marker: value, reserveMarker: true, selected: (state.necessity || null) === value,
                onSelect: () => select(value) });
        }
        if (persistent) {
            const actions = body.createDiv({ cls: "hub-task-popover-actions hub-task-popover-clear-actions" });
            actions.createEl("button", { text: "Clear", attr: { type: "button", "aria-label": "Clear " + terminology } }).onclick = () => select(null);
            actions.createEl("button", { text: "Done", cls: "mod-cta", attr: { type: "button" } }).onclick = () => close();
        }
    } });
    refresh(); return { ...picker, refresh };
}

function mountTaskPhaseButton({ host, state, service, location, notice, onChange = () => {}, control = propertyButton(host, "Phase", "layers"), heading = true, keepLabel = false, persistent = false, unassignedLabel = "No phase", bind = bindPropertyPopover }) {
    control.button.dataset.taskProperty = "phase";
    let previousOwner, initialized = false;
    const picker = bind(control, { title: "Phase", heading, avoidFooter: persistent, maxHeight: persistent ? 360 : Infinity, className: "hub-task-phase-popover" + (persistent ? " hub-task-phase-live" : ""), width: 300, render({ body, close }) {
        if (body.classList.contains("hub-task-config-section")) body.style.setProperty("--hub-task-phase-scrollbar", (body.offsetWidth - body.clientWidth) + "px");
        selectionKeys(body);
        for (const item of [{ id: "", name: unassignedLabel }, ...(service.phases?.(location(), state.nativeOwner) ?? [])]) {
            selectionOption(body, { value: item.id, label: item.name, selected: (state.phaseId || "") === item.id,
                onSelect: () => { state.phaseId = item.id || null; notice.textContent = ""; refresh(); onChange({ phaseId: state.phaseId });
                    for (const option of body.querySelectorAll('[role="menuitemradio"]')) option.setAttribute("aria-checked", String(option.dataset.value === (state.phaseId ?? "")));
                    if (!persistent) close(); } });
        }
    } });
    function refresh() {
        const path = location(), owner = state.nativeOwner && service.workspaceContext ? service.workspaceContext(state.nativeOwner) : path ? service.context?.(path) : null;
        const key = owner ? owner.contextKind + ":" + (owner.projectId ?? owner.root) : null;
        const phases = owner?.contextKind === "project" ? service.phases?.(path, state.nativeOwner) ?? [] : [];
        if (initialized && key !== previousOwner && state.phaseId) {
            state.phaseId = null; notice.textContent = "Phase cleared because the task's workspace changed. Choose a phase in the new project if needed.";
            onChange({ phaseId: null }); picker.close(false);
        }
        if (state.phaseId && !phases.some(phase => phase.id === state.phaseId)) {
            state.phaseId = null; notice.textContent = "The previous phase is no longer available and has been cleared from this draft.";
            onChange({ phaseId: null });
        }
        control.button.hidden = !phases.length; if (!phases.length) picker.close(false);
        const assigned = phases.find(phase => phase.id === state.phaseId);
        control.update(keepLabel ? (assigned ? "Change Phase assignment" : "Assign to Phase") : assigned?.name ?? (state.phaseId ? "Unavailable phase" : "Phase"));
        previousOwner = key; initialized = true;
    }
    refresh(); return { ...picker, refresh, value: () => ({ phaseId: state.phaseId || null }) };
}

// One draft, one set of domain rules; only the ordinary Add/Edit adapter opts
// into this compact layout. Capture/Inbox keep their existing presentation.
function mountWrappingTaskTitle(host, state, onChange, options) {
    const input = mountTaskText(host, state, onChange, { ...options, wrapTitle: true });
    // Measurement must use the final editor typography/padding, not the native
    // textarea defaults that will be replaced by its editing adapter.
    if (options?.className) input.classList.add(options.className);
    const sizing = mountWrappingTaskInput(input);
    const submit = event => { event.preventDefault(); if (!input.disabled && !input.readOnly) input.form?.requestSubmit(); };
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) submit(event);
    });
    // Native/mobile editing commands can insert a break without a keydown.
    input.addEventListener("beforeinput", event => {
        if (!event.isComposing && ["insertLineBreak", "insertParagraph"].includes(event.inputType)) submit(event);
    });
    return { input, ...sizing };
}



module.exports = { mountTaskDescription, mountTaskDates, mountTaskNecessity, mountTaskPhaseButton, mountWrappingTaskTitle, bindPropertyPopover };
