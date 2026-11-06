"use strict";
const { createTaskChecklist } = require("./task-card");
const { bindCompletionSound, playStepCompletionSound } = require("./completion-audio");
function createTaskSteps({ markdown, mutate, onEdit, report, setIcon, states = new Map() }) {
    function bind(info, task, getPath, component = null, alignToCheckbox = false) {
        if (!task.steps?.length)
            return;
        const key = JSON.stringify([task.nativeReference.authorityId, task.id]), state = states.get(key) ?? { open: false, pending: null };
        states.set(key, state);
        const checklist = createTaskChecklist(alignToCheckbox ? info.parentElement : info, { setIcon });
        if (alignToCheckbox) checklist.host.classList.add("hub-task-panel-steps");
        const rows = task.steps.map(step => {
            const { row, checkbox, text } = checklist.createRow(step);
            bindCompletionSound(checkbox, playStepCompletionSound);
            void markdown.render(text, step.text, getPath());
            checkbox.addEventListener("click", e => e.stopPropagation());
            checkbox.addEventListener("change", async () => {
                if (state.pending || task.nativeReadOnly || task.nativeLocationUnavailable) {
                    refresh();
                    return;
                }
                const pending = { id: step.id, completed: checkbox.checked };
                state.pending = pending;
                await require("./task-operation").runNativeTaskToggle({ checkbox, task: step, completed: pending.completed, run: stepCompleted => mutate({ ...task, operation: "step", step, stepCompleted }), onEdit: edit => { state.pending = null; state.refresh?.(); onEdit(edit); }, report: error => { state.pending = error.outcome?.status === "uncertain" ? { ...pending, uncertain: true } : null; state.refresh?.(); report(error); } });
            });
            return { row, checkbox, step };
        });
        function refresh() {
            let completed = 0;
            for (const { row, checkbox, step } of rows) {
                checkbox.checked = !!step.completed;
                checkbox.disabled = !!state.pending || !!task.nativeReadOnly || !!task.nativeLocationUnavailable;
                row.classList.toggle("is-completed", checkbox.checked);
                if (checkbox.checked)
                    completed++;
            }
            checklist.update(state.open, completed, rows.length);
        }
        checklist.toggle.addEventListener("click", () => { state.open = !state.open; refresh(); });
        state.refresh = refresh;
        component?.register(() => { if (state.refresh === refresh) delete state.refresh; });
        refresh();
    }
    return { bind, clear: () => states.clear() };
}
module.exports = { createTaskSteps };
