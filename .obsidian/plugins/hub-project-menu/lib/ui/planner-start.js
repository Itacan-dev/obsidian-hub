"use strict";

const { localISODate } = require("../domain/dates");
const { createTaskDatePopoverInput } = require("./date-time");
const { openTaskPopover } = require("./task-popover");

function openPlanStart(plugin, trigger, record, onSaved, onClose) {
    const plan = plugin.globalPlan;
    return openTaskPopover(trigger, {
        title: "Plan start time", alignEnd: true, width: 290, avoidFooter: ".hub-planner-controls",
        className: "hub-planner-start-popover", onClose,
        render({ body, position, close, register }) {
            const form = body.createEl("form", { cls: "hub-planner-specific-time" });
            const date = createTaskDatePopoverInput(form, "date", "Start date", "Start date", { keyboardPicker: true });
            const time = createTaskDatePopoverInput(form, "time", "Start time", "Start time", { keyboardPicker: true });
            const original = record.scheduledAt ? new Date(record.scheduledAt) : null;
            date.input.value = original ? localISODate(original) : record.calendarDate ?? "";
            date.input.min = localISODate(plan.now());
            time.input.value = original ? require("../domain/plan-lifecycle").localTime(original).slice(-5) : "";
            const error = form.createDiv({ cls: "hub-task-error", attr: { role: "alert", hidden: "" } });
            const actions = form.createDiv({ cls: "hub-task-popover-actions hub-equal-selectors" });
            actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => close();
            const apply = actions.createEl("button", { text: "Apply", cls: "mod-cta", attr: { type: "submit" } });
            date.input.required = time.input.required = true;
            const refresh = () => {
                time.input.disabled = !date.input.value;
                apply.disabled = !date.input.value || !time.input.value;
                date.refresh();
                time.refresh();
            };
            for (const field of [date, time]) {
                field.input.addEventListener("input", refresh);
                field.input.addEventListener("change", refresh);
                field.clear.onclick = () => {
                    field.input.value = "";
                    refresh();
                    field.input.focus();
                };
                register(field.destroy);
            }
            refresh();
            form.onsubmit = async event => {
                event.preventDefault();
                if (apply.disabled) return;
                apply.disabled = true;
                try {
                    await plan.reschedulePlan(record.id, date.input.value + "T" + time.input.value);
                    onSaved(record.id);
                    close();
                } catch (problem) {
                    error.textContent = problem.message;
                    error.hidden = false;
                    refresh();
                    position();
                }
            };
        }
    });
}

module.exports = { openPlanStart };
