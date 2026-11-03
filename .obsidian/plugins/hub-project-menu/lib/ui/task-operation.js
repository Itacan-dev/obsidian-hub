"use strict";
// Pending UI only. The requested checkbox value is never an accepted task state.
async function runNativeTaskToggle({ checkbox, task, completed, run, onEdit, report }) {
    if (checkbox.dataset.nativePending) return;
    const row = checkbox.closest(".home-task-row, .project-task-row, .hub-task-step") ?? checkbox.parentElement;
    const status = checkbox.ownerDocument.createElement("span"); status.className = "hub-task-operation-status";
    status.setAttribute("role", "status"); status.textContent = "Saving…"; row.append(status);
    checkbox.dataset.nativePending = "true"; checkbox.checked = !!task.completed; checkbox.disabled = true; row.setAttribute("aria-busy", "true");
    let settled = false;
    try {
        // Wait through a frame and then a task boundary before admission starts.
        // A zero-delay timer alone can run before the browser's first paint.
        await new Promise(resolve => {
            const view = checkbox.ownerDocument.defaultView;
            if (view?.requestAnimationFrame) view.requestAnimationFrame(() => setTimeout(resolve, 0));
            else setTimeout(resolve, 0);
        });
        const edit = await run(completed);
        if (edit.availability === "current") { settled = true; onEdit(edit); }
        else { status.textContent = "Saved; refreshing…"; onEdit(edit); }
    } catch (error) {
        const uncertain = error.outcome?.status === "uncertain";
        status.textContent = uncertain ? "Outcome needs review. Open Native task recovery." : error.message || "Could not update task.";
        if (error.operationId) status.dataset.operationId = error.operationId;
        checkbox.checked = !!task.completed; checkbox.disabled = uncertain || !!task.nativeReadOnly || !!task.nativeLocationUnavailable;
        if (!uncertain) delete checkbox.dataset.nativePending;
        if (report) report(error); else new (require("obsidian").Notice)(error.message || "Could not update task.");
    } finally {
        row.removeAttribute("aria-busy");
        if (settled) { delete checkbox.dataset.nativePending; status.remove(); }
    }
}
module.exports = { runNativeTaskToggle };
