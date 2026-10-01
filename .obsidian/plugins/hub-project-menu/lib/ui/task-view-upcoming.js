"use strict";
const { BUCKETS, upcomingGroups } = require("../domain/task-views");
const { taskCard } = require("./task-view-primitives");

function renderUpcoming(host, tasks, context) {
    const scroll = host.createDiv({ cls: "hub-task-local-scroll" });
    const board = scroll.createDiv({ cls: "hub-task-board" });
    const groups = upcomingGroups(tasks, context.now);
    for (const [id, label] of BUCKETS) {
        const column = board.createEl("section", { cls: "hub-task-column is-" + id, attr: { "aria-label": label } });
        const heading = column.createDiv({ cls: "hub-task-column-heading" });
        heading.createEl("h3", { text: label });
        heading.createSpan({ cls: "hub-task-count", text: String(groups[id].length) });
        const body = column.createDiv({ cls: "hub-task-column-body" });
        for (const task of groups[id]) taskCard(body, task, context);
        if (!groups[id].length) body.createDiv({ cls: "hub-task-column-empty", text: "No tasks" });
    }
}
module.exports = { renderUpcoming };
