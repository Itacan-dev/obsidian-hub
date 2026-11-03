"use strict";
const { parseLocalISODate, validLocalTime, localDateTime, taskDateLabel, taskDateRangeLabel } = require("./dates");
function taskCaptureSource(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    const source = {};
    for (const key of ["origin", "workspaceId", "workspaceName", "path", "title", "url"]) {
        const text = value[key] ?? (key === "title" ? value.pageTitle : key === "url" ? value.pageUrl : key === "workspaceName" ? value.name : null);
        if (typeof text === "string" && text.trim())
            source[key] = text.trim().slice(0, key === "url" || key === "path" ? 4096 : 512);
    }
    return Object.keys(source).length ? source : null;
}
function taskMetadata(value = {}) {
    const captureSource = taskCaptureSource(value?.captureSource);
    return {
        ...(typeof value?.description === "string" && value.description.length ? { description: value.description } : {}),
        ...(typeof value?.phaseId === "string" && value.phaseId.trim() ? { phaseId: value.phaseId.trim() } : {}),
        necessity: ["should", "must"].includes(value?.necessity) ? value.necessity : null,
        fromDate: parseLocalISODate(value?.fromDate) ? value.fromDate : null,
        dueDate: parseLocalISODate(value?.dueDate) ? value.dueDate : null,
        ...(parseLocalISODate(value?.fromDate) && validLocalTime(value?.fromTime) ? { fromTime: value.fromTime } : {}),
        ...(parseLocalISODate(value?.dueDate) && validLocalTime(value?.dueTime) ? { dueTime: value.dueTime } : {}),
        ...(captureSource ? { captureSource } : {})
    };
}
function validateTaskMetadata(value) {
    for (const key of ["fromDate", "dueDate"]) {
        if (value[key] && !parseLocalISODate(value[key]))
            throw Error("Choose a valid date.");
    }
    for (const prefix of ["from", "due"]) {
        if (value[prefix + "Time"] && (!validLocalTime(value[prefix + "Time"]) || !value[prefix + "Date"])) {
            throw Error("Choose a valid time and its date.");
        }
    }
    const metadata = taskMetadata(value);
    if (metadata.fromDate && metadata.dueDate && metadata.fromDate > metadata.dueDate) {
        throw Error("Due must be on or after Start (From).");
    }
    return metadata;
}
function taskIsOverdue(task, now = new Date()) {
    const due = localDateTime(task.dueDate, task.dueTime);
    return !!due && due < now;
}
// An untimed start is reached at local midnight; untimed due dates remain end-of-day.
function taskStartDate(task) {
    return localDateTime(task.fromDate, task.fromTime || "00:00");
}
function taskIsFuture(task, now = new Date()) {
    const start = taskStartDate(task);
    return !task.completed && !!start && start > now;
}
function taskDatePresentation(task, now = new Date()) {
    if (taskIsFuture(task, now)) {
        if (task.dueDate)
            return { label: taskDateRangeLabel(task.fromDate, task.fromTime, task.dueDate, task.dueTime, now) };
        return { label: "Starts " + taskDateLabel(task.fromDate, task.fromTime, false, now) };
    }
    if (!task.dueDate)
        return null;
    const prefix = !task.completed && taskIsOverdue(task, now) ? "Overdue " : "Due ";
    return { label: prefix + taskDateLabel(task.dueDate, task.dueTime, true, now),
        dateTime: task.dueDate + (validLocalTime(task.dueTime) ? "T" + task.dueTime : "") };
}
function taskGroups(items, now = new Date()) {
    // Preserve the date-string argument used by existing callers.
    if (typeof now === "string")
        now = parseLocalISODate(now);
    const taskOf = item => item.task && typeof item.task === "object" ? item.task : item;
    const rank = task => ({ must: 0, should: 1 }[task.necessity] ?? 2);
    const active = [], future = [], completed = [];
    for (const [order, item] of items.entries()) {
        const task = taskOf(item);
        const target = task.completed ? completed : taskIsFuture(task, now) ? future : active;
        target.push({ item, task, order });
    }
    const compare = (a, b) => {
        const category = task => task.dueDate ? (taskIsOverdue(task, now) ? 0 : 1) : 2;
        return category(a.task) - category(b.task) ||
            String(a.task.dueDate ?? "").localeCompare(String(b.task.dueDate ?? "")) ||
            String(a.task.dueTime ?? "24:00").localeCompare(String(b.task.dueTime ?? "24:00")) ||
            rank(a.task) - rank(b.task) || a.order - b.order;
    };
    active.sort(compare);
    future.sort((a, b) => a.task.fromDate.localeCompare(b.task.fromDate) || compare(a, b));
    return { active: active.map(x => x.item), future: future.map(x => x.item), completed: completed.map(x => x.item) };
}
module.exports = { taskCaptureSource, taskStartDate, taskIsFuture, taskDatePresentation, taskIsOverdue, taskMetadata, validateTaskMetadata, taskGroups };
