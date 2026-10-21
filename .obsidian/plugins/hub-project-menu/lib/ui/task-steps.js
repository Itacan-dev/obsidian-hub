"use strict";
const { bindCompletionSound, playStepCompletionSound } = require("./completion-audio");

const { createTaskChecklist } = require("./task-card");

// Panel-local disclosure and pending state; reusable wherever a parent task is
// rendered. Receives existing Markdown rendering and source-mutation boundaries.
function createTaskSteps({ markdown, mutate, onEdit, report, setIcon }) {
    const states = new Map();
    function bind(info, task, getPath) {
        if (!task.steps?.length) return;
        const native = task.nativeReference;
        const sourceKey = native ? JSON.stringify([native.authorityId, native.owner, native.taskId]) : `${getPath()}\0${task.line}\0${task.text}`;
        const key = native ? sourceKey : task.hubTaskId ?? sourceKey;
        let state = states.get(key) ?? states.get(sourceKey);
        // First completion can assign an ID; retain the open/pending disclosure.
        if (state && key !== sourceKey) { states.set(key, state); states.delete(sourceKey); }
        if (!state) states.set(key, state = { open: false, pending: null });
        const checklist = createTaskChecklist(info, { setIcon });
        const rows = task.steps.map(step => {
            const { row, checkbox, text } = checklist.createRow(step);
            void markdown.render(text, step.text, getPath);
            bindCompletionSound(checkbox, playStepCompletionSound);
            checkbox.addEventListener("change", async () => {
                if (state.pending) { refresh(); return; }
                const pending = state.pending = { id: step.id, line: step.line, completed: checkbox.checked };
                refresh();
                try {
                    const edit = await mutate({ ...task, ...(native ? {} : { path: getPath() }), operation: "step", step, stepCompleted: pending.completed });
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
                checkbox.checked = state.pending && (native ? state.pending.id === step.id : state.pending.line === step.line) ? state.pending.completed : step.completed;
                checkbox.disabled = !!state.pending || !!(native && task.nativeReadOnly);
                row.classList.toggle("is-completed", checkbox.checked);
                if (checkbox.checked) completed++;
            }
            checklist.update(state.open, completed, rows.length);
        }
        checklist.toggle.addEventListener("click", () => { state.open = !state.open; refresh(); });
        state.refresh = refresh;
        refresh();
    }
    return { bind, clear: () => states.clear() };
}

module.exports = { createTaskSteps };
