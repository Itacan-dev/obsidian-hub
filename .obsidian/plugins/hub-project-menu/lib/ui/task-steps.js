"use strict";
const { bindCompletionSound, playStepCompletionSound } = require("./completion-audio");

// Panel-local disclosure and pending state; reusable wherever a parent task is
// rendered. Receives existing Markdown rendering and source-mutation boundaries.
function createTaskSteps({ markdown, mutate, onEdit, report, setIcon }) {
    const states = new Map();
    function bind(info, task, getPath) {
        if (!task.steps?.length) return;
        const sourceKey = `${getPath()}\0${task.line}\0${task.text}`;
        const key = task.hubTaskId ?? sourceKey;
        let state = states.get(key) ?? states.get(sourceKey);
        // First completion can assign an ID; retain the open/pending disclosure.
        if (state && key !== sourceKey) { states.set(key, state); states.delete(sourceKey); }
        if (!state) states.set(key, state = { open: false, pending: null });
        const host = info.createDiv({ cls: "hub-task-steps" });
        // Neither disclosure nor Step interactions bubble into parent editing,
        // source navigation, or the parent's context menu.
        for (const event of ["click", "keydown", "contextmenu"]) host.addEventListener(event, e => e.stopPropagation());
        const toggle = host.createEl("button", { cls: "hub-task-steps-toggle", attr: { type: "button" } });
        const chevron = toggle.createSpan({ cls: "hub-task-steps-chevron", attr: { "aria-hidden": "true" } });
        toggle.createSpan({ cls: "hub-task-steps-label", text: "Steps" });
        const progress = toggle.createSpan({ cls: "hub-task-step-progress", attr: { "aria-live": "polite" } });
        const list = host.createDiv({ cls: "hub-task-step-items" });
        const rows = task.steps.map(step => {
            const row = list.createEl("label", { cls: "hub-task-step-item" });
            const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": `Complete Step: ${step.text}` } });
            const text = row.createSpan({ cls: "hub-task-step-text" });
            void markdown.render(text, step.text, getPath);
            bindCompletionSound(checkbox, playStepCompletionSound);
            checkbox.addEventListener("change", async () => {
                if (state.pending) { refresh(); return; }
                const pending = state.pending = { line: step.line, completed: checkbox.checked };
                refresh();
                try {
                    const edit = await mutate({ ...task, path: getPath(), operation: "step", step, stepCompleted: pending.completed });
                    state.pending = null;
                    onEdit(edit);
                } catch (error) {
                    state.pending = null;
                    state.refresh?.();
                    report(error);
                }
            });
            return { row, checkbox, step };
        });
        function refresh() {
            let completed = 0;
            for (const { row, checkbox, step } of rows) {
                checkbox.checked = state.pending?.line === step.line ? state.pending.completed : step.completed;
                checkbox.disabled = !!state.pending;
                row.classList.toggle("is-completed", checkbox.checked);
                if (checkbox.checked) completed++;
            }
            progress.textContent = `${completed}/${rows.length}`;
            toggle.setAttribute("aria-expanded", String(state.open));
            toggle.setAttribute("aria-label", `${state.open ? "Collapse" : "Expand"} Steps: ${progress.textContent}`);
            setIcon(chevron, state.open ? "chevron-down" : "chevron-right");
            list.hidden = !state.open;
        }
        toggle.addEventListener("click", () => { state.open = !state.open; refresh(); });
        state.refresh = refresh;
        refresh();
    }
    return { bind, clear: () => states.clear() };
}

module.exports = { createTaskSteps };
