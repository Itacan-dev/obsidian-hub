"use strict";
const { calendarRange } = require("../domain/task-views");
const { localISODate, formatDate } = require("../domain/dates");
const { iconButton, taskCard } = require("./task-view-primitives");

const { renderScheduleToolbar } = require("./schedule-toolbar");

function renderTaskCalendar(host, tasks, context, state) {
    const panel = host.createDiv({ cls: "hub-task-calendar-panel" });
    state.calendarMode = state.scheduleView;
    renderScheduleToolbar(panel, context, state);
    const days = calendarRange(state.anchor, state.calendarMode);
    const format = date => formatDate(date);
    const scroll = panel.createDiv({ cls: "hub-task-local-scroll" });
    const grid = scroll.createDiv({ cls: "hub-task-calendar is-" + state.calendarMode });
    grid.style.setProperty("--hub-calendar-weeks", String(days.length / 7));
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) grid.createDiv({ cls: "hub-task-weekday", text: day });
    const byDate = new Map();
    for (const task of tasks) {
        const scheduled = task.dueDate ?? task.fromDate;
        if (!scheduled) continue;
        if (!byDate.has(scheduled)) byDate.set(scheduled, []);
        byDate.get(scheduled).push(task);
    }
    for (const day of days) {
        const iso = localISODate(day);
        const cell = grid.createEl("section", { cls: "hub-task-calendar-day", attr: { "aria-label": format(day) } });
        cell.classList.toggle("is-today", iso === localISODate(context.now));
        cell.classList.toggle("is-other-month", state.calendarMode === "month" && day.getMonth() !== state.anchor.getMonth());
        const heading = cell.createDiv({ cls: "hub-task-calendar-day-heading" });
        heading.createSpan({ text: String(day.getDate()) });
        iconButton(heading, "Add task on " + format(day), "plus", () => context.create({ dueDate: iso }));
        const body = cell.createDiv({ cls: "hub-task-calendar-day-body" });
        for (const task of byDate.get(iso) ?? []) taskCard(body, task, context, true);
    }
    const count = tasks.filter(task => !task.dueDate && !task.fromDate).length;
    if (count) panel.createDiv({ cls: "hub-task-view-note", text: count + " undated " + (count === 1 ? "task" : "tasks") });
}
module.exports = { renderTaskCalendar };
