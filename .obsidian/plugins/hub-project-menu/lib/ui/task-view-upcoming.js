"use strict";
const { BUCKETS, upcomingGroups } = require("../domain/task-views");
const { setHubIcon } = require("./icons");
const headingIcons = { past: "clock-alert", today: "sun", tomorrow: "clock-arrow-right", later: "calendar-clock", unscheduled: "calendar-off" };
const { taskCard } = require("./task-view-primitives");

function renderUpcoming(host, tasks, context) {
    const scroll = host.createDiv({ cls: "hub-task-local-scroll" });
    const board = scroll.createDiv({ cls: "hub-task-board" });
    const groups = upcomingGroups(tasks, context.now);
    for (const [id, label] of BUCKETS) {
        const column = board.createEl("section", { cls: "hub-task-column is-" + id, attr: { "aria-label": label } });
        const heading = column.createDiv({ cls: "hub-task-column-heading" });
        const title = heading.createEl("h3", { cls: context.resource ? "" : "hub-history-heading" });
        if (!context.resource) {
            const icon = title.createSpan({ cls: "hub-history-icon hub-overview-heading-icon", attr: { "aria-hidden": "true" } });
            setHubIcon(icon, headingIcons[id]);
        }
        title.createSpan({ text: label });
        heading.createSpan({ cls: "hub-task-count", text: String(groups[id].length) });
        const body = column.createDiv({ cls: "hub-task-column-body" });
        for (const task of groups[id]) taskCard(body, task, context);
        if (!groups[id].length) body.createDiv({ cls: "hub-task-column-empty", text: "No tasks" });
    }
}
module.exports = { renderUpcoming };
