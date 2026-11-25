"use strict";

const { Notice } = require("obsidian");
const { CaptureConfirmation } = require("./capture-modal");
const { ownNoticeColors } = require("./color-system");
const { createIconAction } = require("./controls");
const { setHubTooltip } = require("./tooltips");
const { hasContent } = require("../domain/plan-lifecycle");

function mountPlanDelete(host, component, plugin, id, onDeleted) {
    const plan = plugin.globalPlan;
    const button = createIconAction(host, "Delete Plan", "trash-2", async () => {
        if (plugin.planDeleteConfirmation) return;
        try {
            const record = plan.readPlan(id);
            if (!record) return;
            const confirmed = hasContent(record);
            if (confirmed) {
                const dialog = plugin.planDeleteConfirmation = new CaptureConfirmation(plugin.app, null, {
                    title: "Delete this Plan?",
                    message: "Its note and planned items will be removed from this Plan.",
                    cancelLabel: "Cancel", confirmLabel: "Delete Plan", destructive: true, returnFocus: button
                });
                if (!await dialog.ask()) return;
            }
            await plan.deletePlan(id, { confirmed });
            onDeleted?.();
        } catch (error) {
            ownNoticeColors(new Notice(error.message));
        } finally {
            plugin.planDeleteConfirmation = null;
        }
    });
    button.classList.add("hub-plan-delete");
    function update() {
        const protectedPlan = plan.oathProtects(id);
        button.disabled = plan.busy || protectedPlan;
        setHubTooltip(button, protectedPlan ? "End the Oath before deleting its Plan" : "Delete Plan");
    }
    plan.subscribe(component, update);
    update();
    return button;
}

module.exports = { mountPlanDelete };
