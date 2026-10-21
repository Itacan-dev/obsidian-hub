"use strict";

function taskSourceLabel(path) {
    const parts = String(path ?? "").replace(/\\/g, "/").split("/").filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : (parts[0]?.replace(/\.md$/i, "") || "Vault");
}

// The original Tasks-panel row, with its Home/Project host class convention.
// Editing adapters attach controls to these parts; they do not recreate a card.
function createTaskRow(parent, task, completed = task.completed, { variant = "project", checkboxScope } = {}) {
    const row = parent.createDiv({ cls: variant + "-task-row" + (completed ? " is-completed" : "") });
    // Native Modal overrides checkbox-size with its smaller UI font. A composer
    // can inherit the dashboard's theme token without a second checkbox design.
    if (checkboxScope) row.style.setProperty("--checkbox-size", parent.ownerDocument.defaultView.getComputedStyle(checkboxScope).getPropertyValue("--checkbox-size"));
    const checkbox = row.createEl("input", { type: "checkbox", cls: variant + "-task-checkbox" });
    checkbox.checked = !!completed;
    const info = row.createDiv({ cls: variant + "-task-info" });
    const textEl = info.createDiv({ cls: variant + "-task-text", text: task.text });
    const source = info.createDiv({ cls: variant + "-task-location" });
    return { row, checkbox, info, textEl, source };
}

function mountDescriptionIndicator(row, info) {
    let indicator, tooltip;
    return {
        update(description) {
            const value = description ?? "";
            if (!indicator && value.trim()) {
                const { setHubIcon } = require("./icons");
                indicator = info.createEl("button", { cls: "hub-task-description-indicator", attr: {
                    type: "button", "aria-label": "Read task description" } });
                // square-info is absent from Obsidian 1.14.4's icon registry.
                // Use its native Lucide information icon in both contexts.
                setHubIcon(indicator, "info");
                tooltip = require("./tooltips").createImmediateHubTooltip(row, { interactive: true, contentOnly: true });
                tooltip.bind(indicator, { description: value });
                for (const type of ["pointerdown", "click", "keydown", "contextmenu"]) indicator.addEventListener(type, event => {
                    if (type !== "keydown" || ["Enter", " "].includes(event.key)) event.stopPropagation();
                });
            }
            if (indicator) indicator.hidden = !value.trim();
            row.classList.toggle("has-description", !!value.trim());
            if (indicator) tooltip.update(indicator, { description: value });
            if (!value.trim()) tooltip?.dismiss();
        }, get element() { return indicator; }, destroy() { tooltip?.dispose(); }
    };
}

// Extracted verbatim presentation rules from createTaskUi.bind. Both panel
// handlers and the draft composer use this renderer and the existing panel CSS.
function mountTaskCardPresentation(row, textEl, task, getPath, { now = new Date(), phaseLabel, ...options } = {}) {
    const { taskDatePresentation, taskIsFuture, taskIsOverdue } = require("../domain/task-planning");
    row.classList.add("hub-planned-task-row");
    const info = textEl.parentElement, checkbox = row.querySelector('input[type="checkbox"]');
    const source = info.querySelector(".home-task-location, .project-task-location");
    const description = options.selection || options.description === false ? null : mountDescriptionIndicator(row, info);
    let indicator, dates, dateSpan, dateValue, phase;
    function update(next = task) {
        task = next;
        row.classList.toggle("is-completed", !!task.completed);
        checkbox?.setAttribute("aria-label", `Complete task: ${task.text}`);
        if (task.necessity === "must" || task.necessity === "should") {
            if (!indicator) {
                indicator = row.ownerDocument.createElement("span");
                indicator.setAttribute("role", "img"); checkbox?.before(indicator);
            }
            indicator.classList.remove("is-must", "is-should");
            indicator.classList.add("hub-task-necessity-bar", "is-" + task.necessity);
            indicator.setAttribute("aria-label", task.necessity === "must" ? "Must do" : "Should do");
        } else { indicator?.remove(); indicator = null; }
        const future = taskIsFuture(task, now), presentation = taskDatePresentation(task, now);
        if (options.dates !== false && presentation?.label) {
            if (!dates) {
                dates = info.createDiv({ cls: "hub-task-dates" });
                dateSpan = dates.createSpan();
            }
            const tag = presentation.dateTime ? "TIME" : "SPAN";
            if (dateValue?.tagName !== tag) { dateSpan.replaceChildren(); dateValue = dateSpan.createEl(tag.toLowerCase()); }
            if (presentation.dateTime) dateValue.dateTime = presentation.dateTime;
            dateValue.textContent = presentation.label;
            const overdue = taskIsOverdue(task, now) && !task.completed && !future;
            dateSpan.className = overdue ? "is-overdue" : "";
            if (overdue) { dateSpan.title = "Overdue"; dateSpan.setAttribute("aria-label", presentation.label + " (overdue)"); }
            else { dateSpan.removeAttribute("title"); dateSpan.removeAttribute("aria-label"); }
        } else { dates?.remove(); dates = dateSpan = dateValue = null; }
        if (source) {
            const label = options.sourceLabel ?? (options.selection && !options.normalSource ? getPath().replace(/\.md$/i, "").split("/").join(" › ") : taskSourceLabel(getPath()));
            const labelText = source.firstChild;
            if (labelText?.nodeType === 3) labelText.textContent = label;
            else source.prepend(row.ownerDocument.createTextNode(label));
            const phaseText = !options.selection && phaseLabel?.(task);
            if (phaseText) {
                phase ??= source.createSpan({ cls: "hub-task-phase" });
                phase.textContent = phaseText; phase.title = "Phase: " + phaseText;
            } else { phase?.remove(); phase = null; }
        }
        description?.update(task.description);
    }
    update();
    return { update, get indicator() { return indicator; }, get dates() { return dates; }, get phase() { return phase; },
        get descriptionIndicator() { return description?.element; }, destroy() { description?.destroy(); } };
}

// Actual Tasks-panel disclosure/checklist markup. The panel and draft Step
// adapter own their state and interactions, while sharing every visible part.
function createTaskChecklist(info, { setIcon = require("./icons").setHubIcon, emptyAction = false } = {}) {
    const host = info.createDiv({ cls: "hub-task-steps" });
    for (const event of ["click", "keydown", "contextmenu"]) host.addEventListener(event, e => e.stopPropagation());
    const toggle = host.createEl("button", { cls: "hub-task-steps-toggle", attr: { type: "button" } });
    const chevron = toggle.createSpan({ cls: "hub-task-steps-chevron", attr: { "aria-hidden": "true" } });
    const label = toggle.createSpan({ cls: "hub-task-steps-label", text: "Steps" });
    const progress = toggle.createSpan({ cls: "hub-task-step-progress", attr: { "aria-live": "polite" } });
    const list = host.createDiv({ cls: "hub-task-step-items" });
    const rowsHost = list.createDiv({ cls: "hub-task-step-list" });
    function update(open, completed, count) {
        const empty = emptyAction && !count;
        label.textContent = empty ? "Add steps" : "Steps";
        progress.hidden = empty;
        if (emptyAction) host.hidden = false;
        progress.textContent = empty ? "" : `${completed}/${count}`;
        toggle.classList.toggle("is-empty-steps", empty);
        toggle.setAttribute("aria-expanded", String(!empty && open));
        toggle.setAttribute("aria-label", empty ? "Add steps" : `${open ? "Collapse" : "Expand"} Steps: ${progress.textContent}`);
        setIcon(chevron, empty ? "list-tree" : open ? "chevron-down" : "chevron-right"); list.hidden = empty || !open;
    }
    function createRow(step, parent = rowsHost) {
        const row = parent.createEl("label", { cls: "hub-task-step-item" });
        const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": `Complete Step: ${step.text}` } });
        const text = row.createSpan({ cls: "hub-task-step-text" });
        return { row, checkbox, text };
    }
    return { host, toggle, chevron, progress, list, rowsHost, update, createRow };
}

module.exports = { createTaskRow, taskSourceLabel, mountTaskCardPresentation, createTaskChecklist };
