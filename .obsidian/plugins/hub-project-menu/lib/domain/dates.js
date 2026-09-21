"use strict";

function localISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

function shortDateLabel(value) {
    const date = parseLocalISODate(value);

    if (!date) {
        return "";
    }

    return [
        String(date.getDate()).padStart(2, "0"),
        String(date.getMonth() + 1).padStart(2, "0"),
        date.getFullYear()
    ].join("/");
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

function taskDateLabel(date, time, relative = false, now = new Date()) {
    const value = parseLocalISODate(date);
    if (!value) return "";
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const label = relative && date === localISODate(now) ? "today" :
        relative && date === localISODate(tomorrow) ? "tomorrow" :
        value.toLocaleDateString("en-US", { month: "short", day: "numeric",
            ...(value.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
    return label + (validLocalTime(time) ? " \u00b7 " + localDateTime(date, time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
}

module.exports = {
    validLocalTime,
    localDateTime,
    taskDateLabel,
    localISODate,
    parseLocalISODate,
    shortDateLabel
};
