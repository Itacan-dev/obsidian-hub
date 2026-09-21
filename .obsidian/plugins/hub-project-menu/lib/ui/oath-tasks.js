"use strict";
const { oathProgress, fulfilmentLabel } = require("../domain/oath");
const { normalizedTaskText } = require("../domain/tasks");

function createOathTaskSection(service, body) {
    const taskOf = item => item.task && typeof item.task === "object" ? item.task : item;
    function partition(items, wrap = task => task) {
        if (!service?.active) return { ordinary: items, pinned: [], missing: [] };
        const selected = new Set(service.current.tasks.map(ref => ref.id));
        const selectedTask = task => selected.has(task.hubTaskId) && !task.identityConflict ||
            !task.hubTaskId && service.work.some(item => item.task && item.task.path === task.path && item.task.line === task.line &&
                normalizedTaskText(item.task.text) === normalizedTaskText(task.text));
        return { ordinary: items.filter(item => !selectedTask(taskOf(item))),
            pinned: service.work.filter(item => item.task).map(item => wrap(item.task)),
            missing: service.work.filter(item => !item.task), oath: service.current };
    }
    function render(plan, renderTask) {
        if (!plan.oath) return;
        const { setIcon } = require("obsidian");
        const progress = oathProgress(service.work), taskBased = plan.oath.tasks.length > 0;
        const banner = body.createDiv({ cls: "hub-oath-banner" });
        setIcon(banner.createSpan({ cls: "hub-oath-icon" }), "shield");
        banner.createSpan({ cls: "hub-oath-label", text: "Oathbound" });
        banner.createSpan({ cls: "hub-oath-condition", text: fulfilmentLabel(plan.oath) });
        banner.createSpan({ cls: "hub-oath-count", text: taskBased ? `${progress.completed} / ${progress.total} completed` : "In progress" });
        if (taskBased) banner.createEl("progress", { attr: { max: String(progress.total), value: String(progress.completed), "aria-label": "Oathbound task progress" } });
        if (!taskBased) return;
        const box = body.createDiv({ cls: "hub-oath-pinned" });
        const heading = box.createDiv({ cls: "hub-oath-pinned-heading" });
        setIcon(heading.createSpan({ cls: "hub-oath-icon" }), "pin");
        heading.createEl("strong", { text: "Pinned for Oath" });
        heading.createSpan({ text: "Your selected work" });
        for (const item of plan.pinned) renderTask(item, !!taskOf(item).completed, box);
        for (const item of plan.missing) {
            const missing = box.createDiv({ cls: "hub-oath-missing" });
            missing.createEl("strong", { text: item.ref.text });
            missing.createDiv({ text: "Source task unavailable. The commitment timer continues." });
        }
    }
    return { partition, render };
}
module.exports = { createOathTaskSection };
