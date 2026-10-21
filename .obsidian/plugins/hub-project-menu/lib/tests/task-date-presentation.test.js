"use strict";
const assert = require("node:assert/strict");
const { taskDatePresentation, taskIsOverdue } = require("../domain/task-planning");
const now = new Date(2026, 9, 15, 12);
const cases = [
    [{}, null],
    [{ fromDate: "2026-10-01" }, null],
    [{ fromDate: "2026-10-20" }, "Starts 20 Oct"],
    [{ fromDate: "2027-01-02", fromTime: "09:00" }, "Starts 2 Jan 2027, 09:00"],
    [{ dueDate: "2026-10-23" }, "Due 23 Oct"],
    [{ fromDate: "2026-10-20", dueDate: "2026-10-23" }, "20 Oct → 23 Oct"],
    [{ fromDate: "2026-10-01", dueDate: "2026-10-23" }, "Due 23 Oct"],
    [{ fromDate: "2026-10-01", dueDate: "2026-10-13" }, "Overdue 13 Oct"],
    [{ completed: true, fromDate: "2026-10-01", dueDate: "2026-10-13" }, "Due 13 Oct"],
    [{ dueDate: "2026-10-15" }, "Due Today"],
    [{ dueDate: "2026-10-16" }, "Due Tomorrow"],
    [{ dueDate: "2026-10-15", dueTime: "17:00" }, "Due Today, 17:00"],
    [{ dueDate: "2026-10-15", dueTime: "11:00" }, "Overdue Today, 11:00"],
    [{ dueDate: "2027-01-02" }, "Due 2 Jan 2027"],
    [{ fromDate: "2026-12-30", dueDate: "2027-01-02" }, "30 Dec 2026 → 2 Jan 2027"],
    [{ fromDate: "2026-10-20", fromTime: "09:00", dueDate: "2026-10-20", dueTime: "17:00" }, "20 Oct, 09:00 → 17:00"],
    [{ fromDate: "2026-10-15", fromTime: "13:00", dueDate: "2026-10-15", dueTime: "17:00" }, "15 Oct, 13:00 → 17:00"]
];
for (const [task, label] of cases) {
    const original = JSON.stringify(task), presentation = taskDatePresentation(task, now);
    assert.equal(presentation?.label ?? null, label, original);
    assert.equal(JSON.stringify(task), original, "Presentation never changes task metadata");
    if (label?.startsWith("Due ") || label?.startsWith("Overdue ")) {
        assert.equal(presentation.dateTime, task.dueDate + (task.dueTime ? "T" + task.dueTime : ""));
    }
}
// Existing local semantics: starts at midnight, untimed deadlines at end of day,
// timed deadlines become overdue strictly after the exact deadline instant.
const untimed = { fromDate: "2026-10-15", dueDate: "2026-10-15" };
assert.equal(taskDatePresentation(untimed, new Date(2026, 9, 15)).label, "Due Today");
assert.equal(taskIsOverdue(untimed, new Date(2026, 9, 15, 23, 59, 59, 999)), false);
assert.equal(taskDatePresentation(untimed, new Date(2026, 9, 16)).label, "Overdue 15 Oct");
const timed = { fromDate: "2026-10-15", fromTime: "09:00", dueDate: "2026-10-15", dueTime: "17:00" };
assert.equal(taskDatePresentation(timed, new Date(2026, 9, 15, 9)).label, "Due Today, 17:00");
assert.equal(taskDatePresentation(timed, new Date(2026, 9, 15, 17)).label, "Due Today, 17:00");
assert.equal(taskDatePresentation(timed, new Date(2026, 9, 15, 17, 0, 0, 1)).label, "Overdue Today, 17:00");
timed.completed = true;
assert.equal(taskDatePresentation(timed, new Date(2026, 9, 15, 18)).label, "Due Today, 17:00");
timed.completed = false;
assert.equal(taskDatePresentation(timed, new Date(2026, 9, 15, 18)).label, "Overdue Today, 17:00");
console.log("PASS: deterministic task date presentation, local boundaries, precision, years and completion (" + Intl.DateTimeFormat().resolvedOptions().timeZone + ")");
