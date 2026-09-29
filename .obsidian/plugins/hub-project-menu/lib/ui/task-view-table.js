"use strict";
const { sortTasks } = require("../domain/task-views");
const { button, date, source, stepsSummary, projectBadge, bindTask, empty } = require("./task-view-primitives");

function renderTaskTable(host, tasks, context, state) {
    const scroll = host.createDiv({ cls: "hub-task-local-scroll hub-task-table-panel" });
    const table = scroll.createEl("table", { cls: "hub-full-task-table" });
    const columns = [["task", "Task"], ["location", "Location"],
        ...(context.resource ? [["project", "Project"]] : []),
        ["necessity", "Necessity"], ["start", "Start"], ["due", "Due"], ["steps", "Steps"]];
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { cls: "hub-full-check-cell", attr: { "aria-label": "Complete" } });
    for (const [id, label] of columns) {
        const cell = header.createEl("th", { cls: "hub-full-col-" + id,
            attr: { scope: "col", "aria-sort": state.sort === id ? state.direction === 1 ? "ascending" : "descending" : "none" } });
        const sort = button(cell, label, () => {
            state.direction = state.sort === id ? -state.direction : 1; state.sort = id; context.render();
        }, "hub-button-plain hub-task-sort");
        if (state.sort === id) sort.createSpan({ text: state.direction === 1 ? " ↑" : " ↓", attr: { "aria-hidden": "true" } });
    }
    const body = table.createEl("tbody");
    for (const task of sortTasks(tasks, state.sort, state.direction, context.locationLabel, context.projectLabel)) {
        const row = body.createEl("tr");
        const check = row.createEl("td", { cls: "hub-full-check-cell" });
        const checkbox = check.createEl("input", { type: "checkbox" });
        const cell = row.createEl("td", { cls: "hub-full-col-task" });
        const title = cell.createDiv({ cls: "hub-full-task-title", text: task.text, attr: { title: task.text } });
        bindTask(row, title, checkbox, task, context);
        source(row.createEl("td", { cls: "hub-full-col-location" }), task, context);
        if (context.resource) projectBadge(row.createEl("td"), task, context);
        const necessity = row.createEl("td");
        if (task.necessity) necessity.createSpan({ cls: "hub-full-necessity is-" + task.necessity, text: task.necessity === "must" ? "Must do" : "Should do" });
        date(row.createEl("td"), task, "fromDate", context.now);
        date(row.createEl("td"), task, "dueDate", context.now);
        stepsSummary(row.createEl("td"), task, context.edit);
    }
    if (!tasks.length) empty(scroll);
}
module.exports = { renderTaskTable };
