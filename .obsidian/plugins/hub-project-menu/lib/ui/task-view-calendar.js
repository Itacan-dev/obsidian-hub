"use strict";
const { calendarRange, shiftDay } = require("../domain/task-views");
const { localISODate } = require("../domain/dates");
const { button, iconButton, taskCard } = require("./task-view-primitives");

function renderTaskCalendar(host, tasks, context, state) {
    const panel = host.createDiv({ cls: "hub-task-calendar-panel" });
    const toolbar = panel.createDiv({ cls: "hub-task-date-toolbar" });
    const move = direction => {
        state.anchor = state.calendarMode === "week" ? shiftDay(state.anchor, 7 * direction) :
            new Date(state.anchor.getFullYear(), state.anchor.getMonth() + direction, 1);
        context.render();
    };
    iconButton(toolbar, "Previous " + state.calendarMode, "chevron-left", () => move(-1));
    iconButton(toolbar, "Next " + state.calendarMode, "chevron-right", () => move(1));
    button(toolbar, "Today", () => { state.anchor = new Date(); context.render(); });
    const days = calendarRange(state.anchor, state.calendarMode);
    const format = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    toolbar.createEl("h3", { text: state.calendarMode === "month" ? state.anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) :
        format(days[0]) + " – " + format(days.at(-1)) });
    const modes = toolbar.createDiv({ cls: "hub-panel-selectors" });
    for (const mode of ["month", "week"]) {
        const choice = button(modes, mode === "month" ? "Month" : "Week", () => { state.calendarMode = mode; context.render(); }, state.calendarMode === mode ? "is-active" : "");
        choice.setAttribute("aria-pressed", String(state.calendarMode === mode));
    }
    const scroll = panel.createDiv({ cls: "hub-task-local-scroll" });
    const grid = scroll.createDiv({ cls: "hub-task-calendar is-" + state.calendarMode });
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
        for (const task of byDate.get(iso) ?? []) taskCard(cell, task, context, true);
    }
    const count = tasks.filter(task => !task.dueDate && !task.fromDate).length;
    if (count) panel.createDiv({ cls: "hub-task-view-note", text: count + " undated " + (count === 1 ? "task" : "tasks") + " · Available in Upcoming and All tasks" });
}
module.exports = { renderTaskCalendar };
