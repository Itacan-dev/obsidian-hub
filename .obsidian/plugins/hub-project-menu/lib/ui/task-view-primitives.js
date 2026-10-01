"use strict";
const { setIcon, Notice } = require("obsidian");
const { createTaskRow } = require("./tasks");
const { taskDateLabel } = require("../domain/dates");
const { taskIsOverdue } = require("../domain/task-planning");

function button(host, label, action, cls = "", icon = null) {
    const el = host.createEl("button", { cls, attr: { type: "button" } });
    if (icon) setIcon(el.createSpan({ attr: { "aria-hidden": "true" } }), icon);
    if (label) el.createSpan({ text: label });
    el.addEventListener("click", action); return el;
}
function iconButton(host, label, icon, action) {
    const el = button(host, "", action, "hub-task-icon-button", icon);
    el.setAttribute("aria-label", label); el.title = label; return el;
}
function empty(host, text = "No tasks match these filters.") {
    host.createDiv({ cls: "hub-task-view-empty", text });
}
function stepsSummary(host, task, edit) {
    if (!task.steps?.length) return;
    const completed = task.steps.filter(step => step.completed).length;
    const el = button(host, completed + " / " + task.steps.length + " steps", () => edit(task), "hub-button-plain hub-full-steps");
    el.title = "Edit task and Steps"; el.setAttribute("aria-label", task.text + ": " + completed + " of " + task.steps.length + " Steps complete");
    const progress = el.createEl("progress", { attr: { max: String(task.steps.length), value: String(completed), "aria-hidden": "true" } });
    return progress;
}
function projectBadge(host, task, context) {
    const label = context.projectLabel(task);
    if (context.resource && label) host.createSpan({ cls: "hub-task-project-link", text: label, attr: { title: label } });
}
function date(host, task, key = "dueDate", now = new Date()) {
    if (!task[key]) return;
    const time = key === "fromDate" ? task.fromTime : task.dueTime;
    const el = host.createEl("time", { cls: "hub-full-date", text: taskDateLabel(task[key], time, true, now),
        attr: { datetime: task[key] + (time ? "T" + time : ""), title: taskDateLabel(task[key], time, false, now, true) } });
    if (key === "dueDate" && !task.completed && taskIsOverdue(task, now)) el.classList.add("is-overdue");
}
function source(host, task, context) {
    const label = context.locationLabel(task);
    const el = button(host, label, async event => {
        event.stopPropagation();
        try { await context.openSource(task); }
        catch (error) { new Notice(error.message || "Could not open task location."); }
    }, "hub-button-plain hub-full-location");
    el.title = label; el.setAttribute("aria-label", "Open location: " + label);
}
function bindTask(row, title, checkbox, task, context, options = {}) {
    context.ui.bind(row, title, task, () => context.currentPath(task.path), { dates: false, steps: false, ...options });
    row.classList.toggle("is-completed", !!task.completed);
    const key = task.hubTaskId ?? task.path + ":" + task.line;
    checkbox.checked = !!task.completed; checkbox.disabled = context.pending.has(key);
    checkbox.addEventListener("click", event => event.stopPropagation());
    checkbox.addEventListener("change", async () => {
        if (context.pending.has(key)) return;
        const completed = checkbox.checked;
        context.pending.add(key); checkbox.disabled = true;
        try { context.apply(await context.toggle({ ...task, path: context.currentPath(task.path), completed })); }
        catch (error) { checkbox.checked = !!task.completed; new Notice(error.message || "Could not update task."); }
        finally { context.pending.delete(key); checkbox.disabled = false; context.render(); }
    });
}
function taskCard(host, task, context, compact = false) {
    const { row, checkbox, textEl, info } = createTaskRow(host, task);
    row.classList.add("hub-full-task-card");
    if (compact) row.classList.add("is-calendar-task");
    info.querySelector(".project-task-location").remove();
    bindTask(row, textEl, checkbox, task, context, { steps: !compact });
    textEl.title = task.text;
    if (!compact) {
        const metadata = info.createDiv({ cls: "hub-full-card-context" });
        source(metadata, task, context);
        projectBadge(metadata, task, context);
        const phase = context.phaseLabel?.(task);
        if (phase) metadata.createSpan({ cls: "hub-task-phase", text: phase, attr: { title: "Phase: " + phase } });
        const schedule = info.createDiv({ cls: "hub-full-card-date" }); date(schedule, task, "dueDate", context.now);
        if (!task.dueDate && task.fromDate) {
            schedule.createSpan({ text: "Starts " }); date(schedule, task, "fromDate", context.now);
        }
    } else if (task.dueTime || (!task.dueDate && task.fromTime)) {
        info.createSpan({ cls: "hub-full-task-time", text: task.dueTime ?? task.fromTime });
    }
    return row;
}
function compactRow(host, task, context) {
    const row = host.createDiv({ cls: "hub-location-task" });
    const checkbox = row.createEl("input", { type: "checkbox" });
    const title = row.createDiv({ cls: "hub-full-task-title", text: task.text, attr: { title: task.text } });
    bindTask(row, title, checkbox, task, context);
    const location = row.createDiv(); source(location, task, context);
    const due = row.createDiv(); date(due, task, "dueDate", context.now);
    const steps = row.createDiv(); stepsSummary(steps, task, context.edit);
    const project = row.createDiv(); projectBadge(project, task, context);
}
module.exports = { button, iconButton, empty, stepsSummary, projectBadge, date, source, bindTask, taskCard, compactRow };
