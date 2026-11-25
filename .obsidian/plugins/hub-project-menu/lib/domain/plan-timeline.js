"use strict";

const { localISODate, parseLocalISODate, formatDateTime, formatTime } = require("./dates");

function planDay(record) {
    return record.status === "scheduled" && record.scheduledAt
        ? localISODate(new Date(record.scheduledAt)) : record.calendarDate;
}

function shiftDay(day, delta) {
    const date = parseLocalISODate(day);
    date.setHours(12);
    date.setDate(date.getDate() + delta);
    return localISODate(date);
}

function planStart(record) {
    const stamp = ["scheduled", "draft"].includes(record.status) || record.archiveReason === "never-activated"
        ? record.scheduledAt : record.startedAt ?? record.createdAt;
    return stamp ? new Date(stamp) : null;
}

function orderPlans(records) {
    return records.map(record => ({
        record, day: planDay(record) ?? "", start: +(planStart(record) ?? Infinity)
    })).sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start ||
        a.record.createdAt.localeCompare(b.record.createdAt) || a.record.id.localeCompare(b.record.id))
        .map(({ record }) => record);
}

function planLabel(record) {
    if (record.status === "active") return "Active Plan";
    if (record.status === "scheduled") return "Scheduled Plan";
    if (record.status === "draft") return "Draft Plan";
    if (record.status === "finished") return "Finished Plan";
    if (record.archiveReason === "never-activated") return "Never activated";
    return "Time ran out";
}

function planTime(record) {
    const start = planStart(record);
    return start ? formatDateTime(start) : "Start time unset";
}

function planClockTime(record) {
    const stamp = ["scheduled", "draft"].includes(record.status) || record.archiveReason === "never-activated"
        ? record.scheduledAt : record.startedAt;
    if (!stamp || record.creationProvenance === "migration-original-start-unknown") return "";
    return formatTime(new Date(stamp));
}

module.exports = { planDay, shiftDay, orderPlans, planLabel, planTime, planClockTime };
