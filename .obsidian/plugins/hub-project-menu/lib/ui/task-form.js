"use strict";
const { setHubIcon } = require("./icons");
const { bindCompletionSound, playStepCompletionSound } = require("./completion-audio");
const { mountTaskDateTime } = require("./date-time");

function taskSection(host, title, help) {
    const section = host.createEl("section", { cls: "hub-task-section" });
    if (title) section.createEl("h3", { text: title });
    if (help) section.createEl("p", { cls: "hub-task-help", text: help });
    return section;
}

function mountTaskText(host, state, onChange = () => {}, { placeholder = "", multiline = false } = {}) {
    const input = host.createEl(multiline ? "textarea" : "input", { cls: multiline ? "hub-quick-add-input" : "hub-task-title-input",
        attr: { ...(multiline ? { rows: "3" } : { type: "text" }), "aria-label": "Task", required: "" } });
    input.value = state.text ?? ""; input.placeholder = placeholder;
    input.addEventListener("input", () => { state.text = input.value; onChange({ text: state.text }); });
    return input;
}

function mountTaskFields({ app, host, state, onChange = () => {}, section = (title, help) => taskSection(host, title, help) }) {
    const necessity = section("Necessity");
    const heading = necessity.createDiv({ cls: "hub-task-necessity-heading" });
    const title = necessity.querySelector("h3"); if (title) heading.appendChild(title);
    const choices = necessity.createDiv({ cls: "hub-task-necessity-choices", attr: { role: "group", "aria-label": "Necessity" } });
    const buttons = ["should", "must"].map(value => {
        const button = choices.createEl("button", { text: value === "should" ? "Should do" : "Must do",
            cls: `hub-task-necessity-choice is-${value}`, attr: { type: "button" } });
        button.addEventListener("click", () => { state.necessity = state.necessity === value ? null : value; syncNecessity(); onChange({ necessity: state.necessity }); });
        return { button, value };
    });
    const clear = heading.createEl("button", { text: "Clear", cls: "hub-button-plain hub-task-clear-necessity", attr: { type: "button" } });
    const syncNecessity = () => {
        for (const { button, value } of buttons) button.setAttribute("aria-pressed", String(state.necessity === value));
        clear.disabled = !state.necessity;
    };
    clear.addEventListener("click", () => { state.necessity = null; syncNecessity(); onChange({ necessity: null }); }); syncNecessity();

    const dates = section();
    const fields = dates.createDiv({ cls: "hub-task-date-fields" });
    const from = mountTaskDateTime({ app, host: fields, label: "Start date", state, dateKey: "fromDate", timeKey: "fromTime", onChange: patch => {
        due.setMin(state.fromDate); onChange(patch);
    } });
    const due = mountTaskDateTime({ app, host: fields, label: "Due date", state, dateKey: "dueDate", timeKey: "dueTime", onChange });
    due.setMin(state.fromDate);

    const steps = section("Steps");
    const list = steps.createDiv({ cls: "hub-task-step-list" });
    state.steps ??= [];
    const renderSteps = () => {
        list.replaceChildren();
        state.steps.forEach((step, index) => {
            const row = list.createDiv({ cls: "hub-task-step" });
            const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": "Step complete" } }); checkbox.checked = !!step.completed;
            bindCompletionSound(checkbox, playStepCompletionSound);
            checkbox.addEventListener("change", () => { step.completed = checkbox.checked; step.completedAt = checkbox.checked ? Date.now() : null; onChange({ steps: state.steps }); });
            const input = row.createEl("input", { type: "text", attr: { "aria-label": "Step text", required: "" } }); input.value = step.text ?? "";
            input.addEventListener("input", () => { step.text = input.value; onChange({ steps: state.steps }); });
            const remove = row.createEl("button", { attr: { type: "button", "aria-label": "Remove step " + (index + 1) } }); setHubIcon(remove, "x");
            remove.addEventListener("click", () => {
                // Removing an existing Markdown Step also removes its nested
                // descendants, exactly as in the ordinary editor.
                state.steps = state.steps.filter(child => child !== step && !(step.line != null && child.line > step.line && child.line < step.end));
                renderSteps(); onChange({ steps: state.steps });
            });
        });
    };
    renderSteps();
    const add = steps.createEl("button", { cls: "hub-task-add-step", attr: { type: "button" } });
    setHubIcon(add.createSpan(), "plus"); add.createSpan({ text: "Add step" });
    add.addEventListener("click", () => {
        state.steps.push({ text: "", completed: false }); renderSteps();
        list.lastElementChild?.querySelector("input[type=text]")?.focus(); onChange({ steps: state.steps });
    });
    return {
        refresh() { syncNecessity(); from.refresh(); due.refresh(); due.setMin(state.fromDate); renderSteps(); },
        destroy() { from.destroy(); due.destroy(); }
    };
}

function mountTaskRelationshipFields({ host, state, service, location, onChange = () => {}, section = (title, help) => taskSection(host, title, help) }) {
    const project = section("Project (optional)");
    const association = project.createEl("select", { attr: { "aria-label": "Project (optional)" } });
    const phaseSection = section("Phase");
    const phaseLabel = phaseSection.createEl("label");
    phaseLabel.createSpan({ text: "Project phase (optional)", cls: "hub-task-help" });
    const phase = phaseLabel.createEl("select", { attr: { "aria-label": "Project phase (optional)" } });
    const options = (select, items, selected, placeholder) => {
        select.replaceChildren(); select.createEl("option", { text: placeholder, attr: { value: "" } });
        for (const item of items) select.createEl("option", { text: item.name, attr: { value: item.id } });
        if (selected && !items.some(item => item.id === selected)) select.createEl("option", { text: "Unavailable selection", attr: { value: selected } });
        select.value = selected ?? "";
    };
    let initialized = false;
    const refresh = () => {
        if (initialized) { state.linkedProjectId = association.value; state.phaseId = phase.value; }
        const path = location(); const owner = path ? service.context?.(path) : null;
        project.hidden = owner?.contextKind !== "resource";
        phaseSection.hidden = owner?.contextKind !== "project";
        options(association, (service.projects?.() ?? []).map(item => ({ ...item, id: item.projectId })), state.linkedProjectId, "No project");
        options(phase, path ? service.phases?.(path) ?? [] : [], state.phaseId, "No phase");
        initialized = true;
    };
    association.addEventListener("change", () => { state.linkedProjectId = association.value; onChange({ linkedProjectId: state.linkedProjectId }); });
    phase.addEventListener("change", () => { state.phaseId = phase.value; onChange({ phaseId: state.phaseId }); });
    refresh(); return { refresh, value: () => ({ linkedProjectId: project.hidden ? null : association.value, phaseId: phaseSection.hidden ? null : phase.value }) };
}

module.exports = { taskSection, mountTaskText, mountTaskFields, mountTaskRelationshipFields };
