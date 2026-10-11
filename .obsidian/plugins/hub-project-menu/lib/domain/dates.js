"use strict";

function localISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Itacan's local work day starts at 06:00; calendar arithmetic preserves DST.
function itacanDay(now = new Date()) {
    const date = new Date(now);
    if (date.getHours() < 6) date.setDate(date.getDate() - 1);
    return localISODate(date);
}

function parseLocalISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        String(value ?? "")
    );

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

// Presentation reads the caller's calendar fields, never converting zoned values
// to another timezone. ISO date-only strings retain their local calendar day.
const MONTHS = "January February March April May June July August September October November December".split(" ");
const WEEKDAYS = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ");
const pad = value => String(value).padStart(2, "0");
function presentationParts(value) {
    if (typeof value === "string") value = parseLocalISODate(value);
    if (typeof value === "number") value = new Date(value);
    if (!value || value.isValid === false || typeof value.isValid === "function" && !value.isValid()) return null;
    if (typeof value.getFullYear === "function") return Number.isFinite(value.getTime()) ? {
        year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate(),
        weekday: value.getDay(), hour: value.getHours(), minute: value.getMinutes()
    } : null;
    // Moment keeps its zone in these accessors; Luxon exposes equivalent fields.
    if (typeof value.year === "function") return { year: value.year(), month: value.month() + 1,
        day: value.date(), weekday: value.day(), hour: value.hour(), minute: value.minute() };
    if (Number.isInteger(value.year) && Number.isInteger(value.month) && Number.isInteger(value.day))
        return { year: value.year, month: value.month, day: value.day, weekday: value.weekday % 7,
            hour: value.hour, minute: value.minute };
    return null;
}

function formatDate(value, style = "compact", includeYear = true) {
    const date = presentationParts(value);
    if (!date) return "";
    const month = MONTHS[date.month - 1], year = includeYear ? " " + date.year : "";
    if (style === "numeric") return [pad(date.day), pad(date.month), date.year].join("/");
    if (style === "month" || style === "month-short") return (style === "month" ? month : month.slice(0, 3)) + year;
    if (style === "short") return date.day + " " + month.slice(0, 3);
    return date.day + " " + (style === "full" ? month : month.slice(0, 3)) + year;
}

function formatTime(value) {
    const date = presentationParts(value);
    return date ? pad(date.hour) + ":" + pad(date.minute) : "";
}

function formatDateTime(value) {
    const date = formatDate(value);
    return date ? date + ", " + formatTime(value) : "";
}

function formatWeekday(value, abbreviated = false) {
    const date = presentationParts(value), weekday = date && WEEKDAYS[date.weekday];
    return weekday ? abbreviated ? weekday.slice(0, 3) : weekday : "";
}

function formatDateRange(start, end, short = false, now = new Date()) {
    const first = presentationParts(start), last = presentationParts(end);
    if (!first || !last) return "";
    const style = short && first.year === last.year && first.year === now.getFullYear() ? "short" : "compact";
    return formatDate(start, style) + " \u2013 " + formatDate(end, style);
}

function historyDateLabel(value, now = new Date()) {
    const date = presentationParts(value);
    return date ? formatDate(value, date.year === now.getFullYear() ? "short" : "compact") : "";
}

function shortDateLabel(value) {
    const date = parseLocalISODate(value);

    if (!date) {
        return "";
    }

    return formatDate(date, "numeric");
}

function validLocalTime(value) {
    return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function localDateTime(date, time) {
    const value = parseLocalISODate(date);
    if (!value) return null;
    if (validLocalTime(time)) {
        const [hours, minutes] = time.split(":").map(Number);
        value.setHours(hours, minutes, 0, 0);
    } else value.setHours(23, 59, 59, 999);
    return value;
}

function taskDateLabel(date, time, relative = false, now = new Date(), includeYear = false) {
    const value = parseLocalISODate(date);
    if (!value) return "";
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const label = relative && date === localISODate(now) ? "Today" :
        relative && date === localISODate(tomorrow) ? "Tomorrow" :
        formatDate(value, includeYear || value.getFullYear() !== now.getFullYear() ? "compact" : "short");
    return label + (validLocalTime(time) ? ", " + formatTime(localDateTime(date, time)) : "");
}

function taskDateRangeLabel(fromDate, fromTime, dueDate, dueTime, now = new Date()) {
    if (fromDate === dueDate) {
        if (validLocalTime(fromTime) && validLocalTime(dueTime) && fromTime !== dueTime) {
            const start = formatTime(localDateTime(fromDate, fromTime));
            return taskDateLabel(fromDate, null, false, now) + ", " + start + " \u2192 " + formatTime(localDateTime(dueDate, dueTime));
        }
        return taskDateLabel(dueDate, dueTime || fromTime, false, now);
    }
    const crossYear = fromDate.slice(0, 4) !== dueDate.slice(0, 4);
    return taskDateLabel(fromDate, fromTime, false, now, crossYear) + " \u2192 " +
        taskDateLabel(dueDate, dueTime, false, now, crossYear);
}

module.exports = {
    formatDate,
    formatTime,
    formatDateTime,
    formatWeekday,
    formatDateRange,
    historyDateLabel,
    itacanDay,
    taskDateRangeLabel,
    validLocalTime,
    localDateTime,
    taskDateLabel,
    localISODate,
    parseLocalISODate,
    shortDateLabel
};
