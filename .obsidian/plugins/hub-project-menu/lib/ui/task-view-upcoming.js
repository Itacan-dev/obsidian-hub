"use strict";
const { BUCKETS, upcomingGroups, shiftDay } = require("../domain/task-views");
const { localISODate } = require("../domain/dates");
const { button, taskCard } = require("./task-view-primitives");

function renderUpcoming(host, tasks, context) {
    const scroll = host.createDiv({ cls: "hub-task-local-scroll" });
    const board = scroll.createDiv({ cls: "hub-task-board" });
    const groups = upcomingGroups(tasks, context.now);
    for (const [id, label] of BUCKETS) {
        const column = board.createEl("section", { cls: "hub-task-column is-" + id, attr: { "aria-label": label } });
        const heading = column.createDiv({ cls: "hub-task-column-heading" });
        heading.createEl("h3", { text: label });
        heading.createSpan({ cls: "hub-task-count", text: String(groups[id].length) });
        for (const task of groups[id]) taskCard(column, task, context);
        if (!groups[id].length) column.createDiv({ cls: "hub-task-column-empty", text: "No tasks" });
        const dueDate = id === "today" ? localISODate(context.now) : id === "tomorrow" ? localISODate(shiftDay(context.now, 1)) : null;
        button(column, "Add task", () => context.create({ dueDate }), "hub-task-column-add", "plus");
    }
}
module.exports = { renderUpcoming };
