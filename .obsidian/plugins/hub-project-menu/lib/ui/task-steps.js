"use strict";

// Panel-local disclosure and pending state; reusable wherever a parent task is
// rendered. Receives existing Markdown rendering and source-mutation boundaries.
function createTaskSteps({ markdown, mutate, onEdit, report }) {
    const states = new Map();
    function bind(info, task, getPath) {
        if (!task.steps?.length) return;
        const key = task.hubTaskId ?? `${getPath()}\0${task.line}\0${task.text}`;
        let state = states.get(key);
        if (!state) states.set(key, state = { open: false, pending: null });
        const host = info.createDiv({ cls: "hub-task-steps" });
        // Neither disclosure nor Step interactions bubble into parent editing,
        // source navigation, or the parent's context menu.
        for (const event of ["click", "keydown", "contextmenu"]) host.addEventListener(event, e => e.stopPropagation());
        const toggle = host.createEl("button", { cls: "hub-task-steps-toggle", attr: { type: "button" } });
        const chevron = toggle.createSpan({ cls: "hub-task-steps-chevron", attr: { "aria-hidden": "true" } });
        const progress = toggle.createSpan({ cls: "hub-task-step-progress", attr: { "aria-live": "polite" } });
        const list = host.createDiv({ cls: "hub-task-step-items" });
        const rows = task.steps.map(step => {
            const row = list.createEl("label", { cls: "hub-task-step-item" });
            const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": `Complete Step: ${step.text}` } });
            const text = row.createSpan({ cls: "hub-task-step-text" });
            void markdown.render(text, step.text, getPath);
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
            progress.textContent = `${completed} / ${rows.length} steps`;
            toggle.setAttribute("aria-expanded", String(state.open));
            toggle.setAttribute("aria-label", `${state.open ? "Collapse" : "Expand"} Steps: ${progress.textContent}`);
            chevron.textContent = state.open ? "⌄" : "›";
            list.hidden = !state.open;
        }
        toggle.addEventListener("click", () => { state.open = !state.open; refresh(); });
        state.refresh = refresh;
        refresh();
    }
    return { bind, clear: () => states.clear() };
}

module.exports = { createTaskSteps };
