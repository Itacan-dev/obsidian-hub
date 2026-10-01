"use strict";
const { timelinePlacement, dayNumber, shiftDay } = require("../domain/task-views");
const { localISODate, taskDateLabel } = require("../domain/dates");
const { button, iconButton, bindTask, empty } = require("./task-view-primitives");

function renderTaskTimeline(host, tasks, context, state) {
    const panel = host.createDiv({ cls: "hub-task-timeline-panel" });
    const toolbar = panel.createDiv({ cls: "hub-task-date-toolbar" });
    const move = amount => { state.timelineAnchor = new Date(state.timelineAnchor.getFullYear(), state.timelineAnchor.getMonth() + amount, 1); context.render(); };
    iconButton(toolbar, "Previous range", "chevron-left", () => move(-state.months));
    iconButton(toolbar, "Next range", "chevron-right", () => move(state.months));
    button(toolbar, "Today", () => { state.timelineAnchor = new Date(context.now.getFullYear(), context.now.getMonth(), 1); context.render(); });
    const start = new Date(state.timelineAnchor.getFullYear(), state.timelineAnchor.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + state.months, 1);
    const monthLabel = date => date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    toolbar.createEl("h3", { text: monthLabel(start) + " – " + monthLabel(shiftDay(end, -1)) });
    const scale = toolbar.createEl("select", { attr: { "aria-label": "Timeline range" } });
    for (const months of [3, 6, 12]) scale.createEl("option", { attr: { value: String(months) }, text: months + " months" });
    scale.value = String(state.months); scale.addEventListener("change", () => { state.months = Number(scale.value); context.render(); });
    const scroll = panel.createDiv({ cls: "hub-task-local-scroll" });
    const grid = scroll.createDiv({ cls: "hub-task-timeline" });
    grid.style.setProperty("--hub-timeline-width", Math.max(700, state.months * 150) + "px");
    const total = dayNumber(localISODate(end)) - dayNumber(localISODate(start));
    grid.style.setProperty("--hub-timeline-week-size", 7 / total * 100 + "%");
    grid.style.setProperty("--hub-timeline-week-offset", (8 - start.getDay()) % 7 / total * 100 + "%");
    const position = date => (dayNumber(localISODate(date)) - dayNumber(localISODate(start))) / total * 100;
    const heading = grid.createDiv({ cls: "hub-task-timeline-row hub-task-timeline-heading" });
    heading.createDiv({ cls: "hub-task-timeline-name", text: "Task" });
    const axis = heading.createDiv({ cls: "hub-task-timeline-axis" });
    for (let i = 0; i < state.months; i++) {
        const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const next = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
        const label = axis.createSpan({ cls: "hub-task-timeline-month", text: monthLabel(date) });
        label.style.left = position(date) + "%"; label.style.width = position(next) - position(date) + "%";
    }
    for (let date = shiftDay(start, (8 - start.getDay()) % 7); date < end; date = shiftDay(date, 7)) {
        const label = axis.createSpan({ cls: "hub-task-timeline-week", text: String(date.getDate()) });
        label.style.left = position(date) + "%";
    }
    let visible = 0;
    for (const task of tasks) {
        const placement = timelinePlacement(task, localISODate(start), localISODate(end));
        if (!placement) continue;
        visible++;
        const row = grid.createDiv({ cls: "hub-task-timeline-row" });
        const name = row.createDiv({ cls: "hub-task-timeline-name" });
        const checkbox = name.createEl("input", { type: "checkbox" });
        const title = name.createDiv({ cls: "hub-full-task-title", text: task.text, attr: { title: task.text } });
        bindTask(name, title, checkbox, task, context);
        const track = row.createDiv({ cls: "hub-task-timeline-track" });
        const schedule = (task.fromDate ? "Start: " + taskDateLabel(task.fromDate, task.fromTime, false, context.now, true) : "") +
            (task.fromDate && task.dueDate ? "; " : "") + (task.dueDate ? "Due: " + taskDateLabel(task.dueDate, task.dueTime, false, context.now, true) : "");
        const bar = button(track, "", () => context.edit(task), "hub-button-plain hub-task-timeline-bar is-" + placement.kind + (task.necessity ? " is-" + task.necessity : ""));
        bar.style.left = placement.left + "%"; bar.style.width = placement.kind === "range" ? placement.width + "%" : "10px";
        bar.title = task.text + " · " + schedule; bar.setAttribute("aria-label", bar.title);
        if (placement.kind === "start") bar.textContent = "›";
        row.classList.toggle("is-completed", !!task.completed);
    }
    const today = position(context.now);
    if (today >= 0 && today < 100) {
        const line = grid.createDiv({ cls: "hub-task-timeline-today", attr: { "aria-label": "Today" } });
        line.style.left = "calc(240px + (100% - 240px) * " + today / 100 + ")";
    }
    if (!visible) empty(panel, "No dated tasks in this range.");
    const undated = tasks.filter(task => !task.fromDate && !task.dueDate).length;
    if (undated) panel.createDiv({ cls: "hub-task-view-note", text: undated + " undated " + (undated === 1 ? "task" : "tasks") });
}
module.exports = { renderTaskTimeline };
