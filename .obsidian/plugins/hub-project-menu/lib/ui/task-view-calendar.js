"use strict";
const { calendarRange } = require("../domain/task-views");
const { localISODate, formatDate, formatTime } = require("../domain/dates");
const { iconButton, taskCard } = require("./task-view-primitives");

const { renderScheduleToolbar } = require("./schedule-toolbar");
const { taskIsOverdue } = require("../domain/task-planning");
const { renderCalendarEvent } = require("./calendar-events");

function calendarEntries(tasks) {
    const entries = new Map();
    for (const task of tasks) {
        const date = task.dueDate ?? task.fromDate;
        if (!date) continue;
        if (!entries.has(date)) entries.set(date, []);
        entries.get(date).push(task);
    }
    return entries;
}

function appendDay(body, tasks, events, context, compact) {
    const orderedTasks = context.focusOrder?.(tasks) ?? tasks;
    if (!events.length) {
        for (const task of orderedTasks) taskCard(body, task, context, compact);
        return;
    }
    const entries = [
        ...orderedTasks.map(task => ({ task, time: (task.dueDate ? task.dueTime : task.fromTime) ?? "" })),
        ...events.map(event => ({ event, time: event.allDay ? "" : formatTime(event.start) }))
    ];
    entries.sort((a, b) => a.time.localeCompare(b.time));
    for (const { task, event } of entries) {
        if (task) taskCard(body, task, context, compact);
        else renderCalendarEvent(body, event);
    }
}

function showSourceStatus(panel, source) {
    if (source.message) panel.createDiv({ cls: "hub-task-view-note", text: source.message, attr: { role: "status" } });
}


function renderTaskCalendar(host, tasks, context, state) {
    const panel = host.createDiv({ cls: "hub-task-calendar-panel" });
    state.calendarMode = state.scheduleView;
    renderScheduleToolbar(panel, context, state);
    const days = calendarRange(state.anchor, state.calendarMode);
    const format = date => formatDate(date);
    const scroll = panel.createDiv({ cls: "hub-task-local-scroll hub-scrollbar" });
    const grid = scroll.createDiv({ cls: "hub-task-calendar is-" + state.calendarMode });
    grid.style.setProperty("--hub-calendar-weeks", String(days.length / 7));
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) grid.createDiv({ cls: "hub-task-weekday", text: day });
    const byDate = calendarEntries(tasks);
    const source = context.events?.read(days) ?? { days: new Map() };
    showSourceStatus(panel, source);
    for (const day of days) {
        const iso = localISODate(day);
        const cell = grid.createEl("section", { cls: "hub-task-calendar-day", attr: { "aria-label": format(day) } });
        cell.classList.toggle("is-today", iso === localISODate(context.now));
        cell.classList.toggle("is-other-month", state.calendarMode === "month" && day.getMonth() !== state.anchor.getMonth());
        const heading = cell.createDiv({ cls: "hub-task-calendar-day-heading" });
        heading.createSpan({ text: String(day.getDate()) });
        iconButton(heading, "Add task on " + format(day), "plus", () => context.create({ dueDate: iso }));
        const body = cell.createDiv({ cls: "hub-task-calendar-day-body hub-scrollbar" });
        const scheduled = byDate.get(iso) ?? [];
        appendDay(body, scheduled, source.days.get(iso) ?? [], context, true);
    }
    appendUndated(panel, tasks, context);
}
function appendUndated(panel, tasks, context) {
    const count = tasks.filter(task => !task.dueDate && !task.fromDate).length;
    if (!count || !context.openTasks) return;
    const link = panel.createEl("button", { cls: "hub-panel-action hub-calendar-undated", text: count + " undated " + (count === 1 ? "task" : "tasks"),
        attr: { type: "button" } });
    link.onclick = context.openTasks;
}
function renderTaskSchedule(host, tasks, context, state) {
    if (state.scheduleView !== "upcoming") return renderTaskCalendar(host, tasks, context, state);
    const panel = host.createDiv({ cls: "hub-task-calendar-panel hub-schedule-upcoming" });
    renderScheduleToolbar(panel, context, state);
    const days = calendarRange(state.anchor, "week");
    const source = context.events?.read(days) ?? { days: new Map() };
    showSourceStatus(panel, source);
    const scroll = panel.createDiv({ cls: "hub-task-local-scroll hub-calendar-agenda hub-scrollbar" });
    const overdue = tasks.filter(task => taskIsOverdue(task, context.now));
    const overdueSet = new Set(overdue);
    const scheduled = calendarEntries(tasks.filter(task => !overdueSet.has(task)));
    if (overdue.length) {
        const group = scroll.createEl("section");
        group.createEl("h3", { text: "Past due" });
        appendDay(group, overdue, [], context, false);
    }
    for (const day of days) {
        const date = localISODate(day);
        const list = scheduled.get(date) ?? [], events = source.days.get(date) ?? [];
        if (!list.length && !events.length && date !== localISODate(state.anchor)) continue;
        const group = scroll.createEl("section");
        const header = group.createDiv({ cls: "hub-task-calendar-day-heading" });
        header.createEl("h3", { text: formatDate(day, "full") });
        iconButton(header, "Add task on " + formatDate(day), "plus", () => context.create({ dueDate: date }));
        appendDay(group, list, events, context, false);
        if (!list.length && !events.length) group.createDiv({ cls: "hub-task-view-empty", text: "Nothing scheduled." });
    }
    if (!scroll.firstElementChild) scroll.createDiv({ cls: "hub-task-view-empty", text: "Nothing scheduled in this range." });
    appendUndated(panel, tasks, context);
}
module.exports = { renderTaskCalendar, renderTaskSchedule };
