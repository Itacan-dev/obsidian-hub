"use strict";
const { Component } = require("obsidian");
const { createTaskRow, mountTaskCardPresentation, createTaskChecklist } = require("./task-card");
const { createHubMarkdown } = require("./markdown");
const { mountTaskSteps } = require("./task-form");
const { mountWrappingTaskTitle, mountTaskNecessity, mountTaskPhaseButton, bindPropertyPopover } = require("./task-compact-form");
const { mountTaskAccordion } = require("./task-accordion");
const { createTaskDatePopoverInput, measureNativeDatePopover } = require("./date-time");
const { validateTaskDates } = require("../domain/task-compact-form");
const { bindCompletionSound, playTaskCompletionSound } = require("./completion-audio");
const { setHubIcon } = require("./icons");
const { mountTransientEffects } = require("./attention");

function configurationAction(host, name, icon, property) {
    const button = host.createEl("button", { cls: "hub-task-config-action", attr: { type: "button", "aria-label": name, "data-task-property": property } });
    const graphic = button.createSpan({ attr: { "aria-hidden": "true" } }); setHubIcon(graphic, icon);
    const label = button.createSpan({ cls: "hub-task-config-label", text: name });
    const indicator = button.createSpan({ cls: "hub-task-config-check", attr: { "aria-hidden": "true" } }); setHubIcon(indicator, "check");
    return { button, graphic, update(value) { label.textContent = value; button.setAttribute("aria-label", value + (button.classList.contains("is-configured") ? ", configured" : "")); } };
}

function mountTaskDateEndpoint(control, state, prefix, onChange, bind = bindPropertyPopover) {
    const name = prefix === "from" ? "Start date" : "Due date", dateKey = prefix + "Date", timeKey = prefix + "Time";
    const refresh = () => control.update((state[dateKey] ? "Change " : "Add ") + name.toLowerCase());
    const picker = bind(control, { title: name, width: (element, width) => measureNativeDatePopover(element, width, { equalColumns: true }), avoidFooter: true, className: "hub-task-date-endpoint",
        render({ body, close, register }) {
            const draft = { ...state };
            const fields = body.createDiv({ cls: "hub-task-popover-date-inputs hub-task-popover-date" });
            const date = createTaskDatePopoverInput(fields, "date", name, "Select date", { keyboardPicker: true });
            const time = createTaskDatePopoverInput(fields, "time", name + " time", "Add time", { keyboardPicker: true });
            register(() => { date.destroy(); time.destroy(); });
            const sync = () => {
                date.input.value = draft[dateKey] ?? ""; time.input.value = draft[timeKey] ?? "";
                time.input.disabled = !draft[dateKey]; date.refresh(); time.refresh();
            };
            date.clear.onclick = () => { draft[dateKey] = draft[timeKey] = ""; sync(); date.input.focus(); };
            time.clear.onclick = () => { draft[timeKey] = ""; sync(); time.input.focus(); };
            for (const type of ["input", "change"]) {
                date.input.addEventListener(type, () => {
                    if (date.input.validity.badInput) return;
                    draft[dateKey] = date.input.value; if (!draft[dateKey]) draft[timeKey] = "";
                    time.input.value = draft[timeKey] ?? ""; time.input.disabled = !draft[dateKey]; date.refresh(); time.refresh();
                });
                time.input.addEventListener(type, () => {
                    if (time.input.disabled || time.input.validity.badInput) return;
                    draft[timeKey] = time.input.value; time.refresh();
                });
            }
            sync();
            const error = body.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = body.createDiv({ cls: "hub-task-popover-actions" });
            actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => close();
            const apply = actions.createEl("button", { text: "Apply", cls: "mod-cta", attr: { type: "button" } });
            apply.onclick = () => {
                if (!date.input.reportValidity() || !time.input.reportValidity()) return;
                const next = { ...state, [dateKey]: draft[dateKey], [timeKey]: draft[timeKey] };
                try { validateTaskDates(next); } catch (problem) { error.textContent = problem.message; return; }
                state[dateKey] = draft[dateKey] ?? ""; state[timeKey] = draft[timeKey] ?? "";
                refresh(); onChange({ [dateKey]: state[dateKey], [timeKey]: state[timeKey] }); close();
            };
            body.addEventListener("keydown", event => {
                if (event.key === "Enter" && !event.isComposing && event.target.tagName === "INPUT") { event.preventDefault(); apply.click(); }
            });
        } });
    refresh(); return { ...picker, refresh };
}

function mountTaskDescriptionPopover(control, state, onChange, onFeedback, bind = bindPropertyPopover) {
    const refresh = () => control.update(state.description?.trim() ? "Edit description" : "Add description");
    let original, introduced;
    const picker = bind(control, { title: "Description", avoidFooter: true, className: "hub-task-description-editor", width: 400,
        onClose() { refresh(); if (!introduced && original !== state.description && state.description?.trim()) onFeedback(); },
        render({ body, close }) {
            original = state.description ?? ""; introduced = false;
            const input = body.createEl("textarea", { cls: "hub-task-description", attr: { rows: "3", "aria-label": "Description", placeholder: "Add a description..." } });
            input.value = original;
            input.addEventListener("input", () => {
                if (!state.description?.trim() && input.value.trim()) introduced = true;
                state.description = input.value; onChange({ description: state.description });
            });
            const actions = body.createDiv({ cls: "hub-task-popover-actions" });
            actions.createEl("button", { text: "Clear", attr: { type: "button" } }).onclick = () => {
                state.description = input.value = ""; onChange({ description: "" }); input.focus();
            };
            actions.createEl("button", { text: "Done", cls: "mod-cta", attr: { type: "button" } }).onclick = () => close();
        } });
    refresh(); return { ...picker, refresh };
}

function mountLiveTaskForm({ host, state, service, location, text, initialStepsOpen = false, onChange = () => {}, presentationContext = null, onLocation = null, showRecurrenceAction = true }) {
    const element = host.createDiv({ cls: "hub-task-live-fields" });
    const surface = element.createDiv({ cls: "hub-task-card-container" });
    const parts = createTaskRow(surface, state, state.completed, { checkboxScope: host.ownerDocument.body });
    element.style.setProperty("--hub-task-card-checkbox-size", host.ownerDocument.defaultView.getComputedStyle(parts.row).getPropertyValue("--checkbox-size"));
    const effects = mountTransientEffects(element);
    const component = new Component(); component.load();
    const markdown = createHubMarkdown({ app: service.app, component });
    // Folder destinations use the existing Tasks.md convention on Save. The
    // card shows that eventual note's normal source label without creating it.
    const cardPath = () => { if (presentationContext) return presentationContext.sourcePath;
        const path = location(), file = service.app.vault.getAbstractFileByPath(path);
        return Array.isArray(file?.children) ? path + "/Tasks.md" : path; };
    const phaseLabel = task => (service.phases?.(location()) ?? []).find(phase => phase.id === task.phaseId)?.name;
    const presentation = mountTaskCardPresentation(parts.row, parts.textEl, state, cardPath, { phaseLabel,
        ...(presentationContext ? { sourceLabel: presentationContext.sourceLabel } : {}),
        ...(service.nativeLocations ? { locationAction: onLocation, locationWorkspace: Object.hasOwn(service, "locationWorkspace") ? service.locationWorkspace : service.nativeOwner, nativeDisplay: () => {
            const ref = state.nativeLocation ? service.nativeLocations.resolveId(state.nativeOwner, state.nativeLocation)?.reference ?? { id: state.nativeLocation, type: state.nativeLocationType } : null;
            return service.nativeLocations.describe(state.nativeOwner, ref);
        } } : {}) });
    parts.textEl.classList.add("hub-task-markdown");
    // Ordinary Add/Edit spans the card's checkbox and content tracks. Other
    // composers retain the shared renderer's title-column hierarchy.
    const checklist = createTaskChecklist(host.closest(".hub-task-live-dialog") ? parts.row : parts.info, { emptyAction: true });
    // Only seed disclosure at construction; refreshes respect the user's choice.
    let steps, phase, openSteps = initialStepsOpen && state.steps.length > 0, editingTitle = true, initialized = false, descriptionMeaningful = !!state.description?.trim();
    let last = { necessity: state.necessity, dates: [state.fromDate, state.fromTime, state.dueDate, state.dueTime].join("|"), phase: state.phaseId };
    const pulse = target => {
        if (!initialized || !state.text?.trim() || !target || element.ownerDocument.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        target.style.setProperty("--hub-attention-color", "var(--interactive-accent)"); effects.run(target, "hub-attention");
    };
    const refreshChecklist = () => {
        const pending = steps?.hasPending ? 1 : 0, count = state.steps.length + pending;
        const completed = state.steps.filter(step => step.completed).length + (pending && steps.pendingCompleted ? 1 : 0);
        checklist.update(openSteps, completed, count);
        checklist.toggle.disabled = !count && !state.text?.trim();
        return completed + "/" + count;
    };
    let specificationControls = [], configurationPickers = [], specifications = [];
    const refreshReadiness = () => {
        const disabled = !state.text?.trim();
        element.classList.toggle("is-title-empty", disabled);
        for (const button of specificationControls) button.disabled = disabled;
        steps?.refreshReadiness();
        const configured = [!!state.fromDate, !!state.dueDate, ["must", "should"].includes(state.necessity), !!state.description?.trim(),
            !!state.phaseId && !!presentation.phase];
        specifications.forEach((control, index) => {
            control.button.classList.toggle("is-configured", !!configured[index]);
            const label = control.button.querySelector(".hub-task-config-label").textContent;
            control.button.setAttribute("aria-label", label + (configured[index] ? ", configured" : ""));
        });
        if (disabled) for (const picker of configurationPickers) picker.close(false);
        if (disabled) for (const target of element.querySelectorAll(".hub-attention")) effects.cancel(target);
    };
    let renderedCompleted = !!state.completed;
    const refresh = () => {
        // Native checkbox preactivation precedes click bubbling and change.
        // An unrelated Step blur refresh must not undo that in-flight toggle.
        if (renderedCompleted !== !!state.completed) parts.checkbox.checked = renderedCompleted = !!state.completed;
        presentation.update(state); refreshChecklist(); refreshReadiness();
    };
    const changed = patch => {
        refresh(); onChange(patch);
        const next = { necessity: state.necessity, dates: [state.fromDate, state.fromTime, state.dueDate, state.dueTime].join("|"), phase: state.phaseId };
        for (const [key, target] of [["necessity", presentation.indicator], ["dates", presentation.dates], ["phase", presentation.phase]])
            if (next[key] !== last[key]) pulse(target);
        if (!descriptionMeaningful && state.description?.trim()) pulse(presentation.descriptionIndicator);
        descriptionMeaningful = !!state.description?.trim(); last = next;
    };
    parts.textEl.replaceChildren();
    const title = mountWrappingTaskTitle(parts.textEl, state, changed, { ...text, className: "hub-task-card-edit-input" }), input = title.input;
    parts.textEl.tabIndex = -1; parts.textEl.setAttribute("aria-label", "Edit task title");
    const editTitle = () => {
        if (input.disabled) return;
        editingTitle = true; parts.textEl.removeAttribute("role"); parts.textEl.tabIndex = -1;
        if (!parts.textEl.contains(input)) parts.textEl.replaceChildren(input);
        title.resize();
        input.focus();
    };
    const showTitle = () => {
        if (!input.value) return; // Retain native placeholder/required validation.
        editingTitle = false; parts.textEl.setAttribute("role", "button"); parts.textEl.tabIndex = 0; input.remove();
        parts.textEl.textContent = state.text;
        void markdown.render(parts.textEl, state.text, cardPath, () => !editingTitle);
    };
    input.addEventListener("blur", showTitle);
    // Focus the editor before an existing Step's blur commit can change row
    // height and retarget pointer-up. Active native input clicks stay native.
    parts.textEl.addEventListener("pointerdown", event => {
        if (event.button === 0 && event.target !== input && !input.disabled) { event.preventDefault(); editTitle(); }
    });
    parts.textEl.addEventListener("click", event => {
        if (event.target === input) return;
        event.preventDefault(); event.stopImmediatePropagation(); editTitle();
    }, true);
    parts.textEl.addEventListener("keydown", event => {
        if (event.target !== input && ["Enter", " "].includes(event.key)) { event.preventDefault(); editTitle(); }
    });
    bindCompletionSound(parts.checkbox, playTaskCompletionSound);
    parts.checkbox.addEventListener("change", () => {
        if (parts.checkbox.disabled) return;
        state.completed = parts.checkbox.checked; state.completedAt = state.completed ? Date.now() : null;
        changed({ completed: state.completed, completedAt: state.completedAt });
    });
    const actions = element.createDiv({ cls: "hub-task-config-actions" });
    const accordion = mountTaskAccordion(actions);
    const fromControl = configurationAction(actions, "Add start date", "calendar", "start");
    const dueControl = configurationAction(actions, "Add due date", "calendar-clock", "due");
    const necessityControl = configurationAction(actions, "Set importance", "flag", "necessity");
    const descriptionControl = configurationAction(actions, "Add description", "text-align-start", "description");
    const phaseControl = configurationAction(actions, "Assign to Phase", "layers", "phase");
    const recurrenceControl = showRecurrenceAction ? configurationAction(actions, "Repeat task", "repeat", "recurrence") : null;
    const recurrence = recurrenceControl ? require("./task-recurrence").mountTaskRecurrence(recurrenceControl, state, changed, accordion.bind) : null;
    specifications = [fromControl, dueControl, necessityControl, descriptionControl, phaseControl];
    steps = mountTaskSteps({ host: checklist.list, state, checklist, markdown, getPath: cardPath, inlineAdd: true, actionLabel: "Add step", pendingPlaceholder: "Describe this step...", focusFallback: checklist.toggle, onChange: changed,
        canAdd: () => !!state.text?.trim(), onBeforeAdd() { accordion.close(); openSteps = true; } });
    specificationControls = [fromControl.button, dueControl.button, necessityControl.button, descriptionControl.button, phaseControl.button];
    const start = mountTaskDateEndpoint(fromControl, state, "from", changed, accordion.bind), due = mountTaskDateEndpoint(dueControl, state, "due", changed, accordion.bind);
    const necessity = mountTaskNecessity(actions, state, changed, { control: necessityControl, keepLabel: true, persistent: true, order: ["should", "must"], terminology: "importance", bind: accordion.bind });
    const description = mountTaskDescriptionPopover(descriptionControl, state, changed, () => pulse(presentation.descriptionIndicator), accordion.bind);
    const notice = element.createDiv({ cls: "hub-task-location-notice", attr: { role: "status" } });
    phase = mountTaskPhaseButton({ host: actions, state, service, location, notice, onChange: changed, control: phaseControl, keepLabel: true, persistent: true, unassignedLabel: "Unassigned", bind: accordion.bind });
    configurationPickers = [start, due, necessity, description, phase, recurrence].filter(Boolean);
    if (recurrenceControl) specificationControls.push(recurrenceControl.button);
    checklist.toggle.addEventListener("click", () => {
        if (checklist.toggle.disabled) return;
        if (!state.steps.length && !steps.hasPending) { steps.focusNew(); return; }
        openSteps = !openSteps; refreshChecklist();
    });
    refresh();
    let refreshingPhase = false;
    const refreshContext = () => {
        if (!refreshingPhase) { refreshingPhase = true; phase.refresh(); refreshingPhase = false; }
        refresh();
    };
    for (const event of ["rename", "delete"]) if (service.app.vault.on) component.registerEvent(service.app.vault.on(event, refreshContext));
    initialized = true;
    return { element, input, completion: parts.checkbox, phase, card: parts, presentation, checklist, steps, state,
        commitPending: steps.commitPending, refresh, resizeTitle: title.resize,
        restorePendingStep(value) { if (value) { openSteps = true; steps.restorePending(value); refresh(); } },
        closePopovers() { recurrence?.close(false); start.close(false); due.close(false); necessity.close(false); description.close(false); phase.close(false); },
        destroy() { recurrence?.destroy(); start.destroy(); due.destroy(); necessity.destroy(); description.destroy(); phase.destroy(); steps.destroy(); title.destroy();
            accordion.destroy(); presentation.destroy(); effects.destroy(); component.unload(); element.remove(); } };
}

module.exports = { mountLiveTaskForm, mountTaskDateEndpoint };
