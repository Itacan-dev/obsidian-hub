"use strict";
const { oathProgress, oathTime } = require("../domain/oath");
const { normalizedTaskText } = require("../domain/tasks");

function countdown(ms) {
    const seconds = Math.ceil(ms / 1000), hours = Math.floor(seconds / 3600);
    const minutes = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
    const remainder = String(seconds % 60).padStart(2, "0");
    return `${hours ? hours + ":" : ""}${minutes}:${remainder}`;
}

function createOathTaskSection(service, body, component) {
    let status = null;
    function updateClock() {
        if (!status || !service.active || service.current.id !== status.id) return;
        const timer = service.fulfilled ? "Fulfilled" :
            `${countdown(oathTime(service.current, service.now()).remainingMs)} remaining`;
        if (status.timer.textContent !== timer) status.timer.textContent = timer;
    }
    // Reuse the service clock; task rows only rerender on ordinary state changes.
    if (service) component.register(service.onChange(updateClock, true));
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
        status = null;
        if (!plan.oath?.tasks.length) return;
        const { setIcon } = require("obsidian");
        const progress = oathProgress(service.work);
        const box = body.createDiv({ cls: "hub-oath-pinned" });
        const heading = box.createDiv({ cls: "hub-oath-pinned-heading" });
        const title = heading.createDiv({ cls: "hub-oath-pinned-title" });
        setIcon(title.createSpan({ cls: "hub-oath-icon" }), "pin");
        title.createEl("strong", { text: "Pinned for Oath" });
        const live = heading.createDiv({ cls: "hub-oath-pinned-status" });
        const timer = live.createSpan({ cls: "hub-oath-pinned-timer" });
        const completion = live.createSpan({ cls: "hub-oath-pinned-completion" });
        completion.createSpan({ text: "\u00b7", attr: { "aria-hidden": "true" } });
        completion.createSpan({ text: `${progress.completed} / ${progress.total} completed` });
        status = { id: plan.oath.id, timer };
        updateClock();
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
