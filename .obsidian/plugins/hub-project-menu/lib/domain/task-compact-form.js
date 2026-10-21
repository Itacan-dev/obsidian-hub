"use strict";
const { parseLocalISODate, validLocalTime, taskDateLabel } = require("./dates");
const { validateTaskMetadata } = require("./task-planning");

// A form always shows both endpoints, even after the start date has passed.
function taskDatesButtonLabel(state, now = new Date()) {
    const from = parseLocalISODate(state.fromDate), due = parseLocalISODate(state.dueDate);
    if (!from && !due) return "Dates";
    if (!from) return "Due " + taskDateLabel(state.dueDate, state.dueTime, false, now);
    if (!due) return "Start " + taskDateLabel(state.fromDate, state.fromTime, false, now);
    const crossYear = from.getFullYear() !== due.getFullYear();
    if (!validLocalTime(state.fromTime) && !validLocalTime(state.dueTime) && !crossYear && from.getMonth() === due.getMonth()) {
        return from.getDate() + "\u2013" + taskDateLabel(state.dueDate, null, false, now);
    }
    return taskDateLabel(state.fromDate, state.fromTime, false, now, crossYear) + " \u2013 " +
        taskDateLabel(state.dueDate, state.dueTime, false, now, crossYear);
}

function validateTaskDates(state) {
    validateTaskMetadata(state);
    // Missing times keep their existing start-of-day/end-of-day semantics.
    if (state.fromDate && state.fromDate === state.dueDate &&
        (state.fromTime || "00:00") > (state.dueTime || "23:59")) {
        throw Error("Due time must be on or after Start time.");
    }
}

function initialTaskLocation(service, creation = {}) {
    const explicit = creation.location ?? creation.path;
    if (explicit != null) return explicit; // Never silently replace an explicit destination.
    const activePath = service.app.workspace.getActiveFile?.()?.path;
    const context = creation.root ? service.context?.(creation.root) :
        service.currentContext ? service.currentContext() : service.context?.(activePath);
    const root = creation.root ?? context?.root;
    if (!root) return ""; // Home has no inferred workspace.
    const locations = service.locations?.(root) ?? [];
    return locations.find(item => item.path === activePath)?.path ?? locations.find(item => item.path === root)?.path ?? "";
}

function initialComposerTaskLocation(service, creation = {}) {
    const location = initialTaskLocation(service, creation);
    // Explicit destinations (including invalid ones) never silently move.
    if (location || creation.location != null || creation.path != null || creation.root != null) return location;
    const resource = require("../config").RESOURCE_TYPES.find(item => item.id === "references");
    return resource ? initialTaskLocation(service, { root: resource.root }) : "";
}

module.exports = { taskDatesButtonLabel, validateTaskDates, initialTaskLocation, initialComposerTaskLocation };
