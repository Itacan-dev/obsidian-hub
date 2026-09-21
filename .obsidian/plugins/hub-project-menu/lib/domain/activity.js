"use strict";

const {
    isProvisionalNoteTitle
} = require("./naming");

const DEFAULT_ACTIVITY_LIMIT = Infinity;
const EDIT_MERGE_WINDOW_MS = 10 * 60 * 1000;

function reduceActivityLog(
    activityLog,
    entry,
    {
        timestamp = Date.now(),
        limit = DEFAULT_ACTIVITY_LIMIT
    } = {}
) {
    let nextLog = Array.isArray(activityLog)
        ? [...activityLog]
        : [];

    // Deletion is another historical event, not a request to erase earlier events.

    if (entry.action === "renamed" && entry.oldPath) {
        const previous = nextLog[0];

        if (
            previous?.action === "created" &&
            previous.path === entry.oldPath &&
            isProvisionalNoteTitle(previous.title)
        ) {
            nextLog[0] = {
                ...previous,
                path: entry.path,
                title: entry.title,
                project: entry.project ?? previous.project,
                timestamp
            };

            return nextLog.slice(0, limit);
        }
    }

    if (entry.action === "edited") {
        const existingIndex = nextLog.findIndex(
            item =>
                item.action === "edited" &&
                item.path === entry.path &&
                timestamp - item.timestamp <
                    EDIT_MERGE_WINDOW_MS
        );

        if (existingIndex !== -1) {
            const existing = nextLog.splice(
                existingIndex,
                1
            )[0];

            nextLog.unshift({
                ...existing,
                ...entry,
                timestamp
            });
        } else {
            nextLog.unshift({
                ...entry,
                timestamp
            });
        }
    } else {
        nextLog.unshift({
            ...entry,
            timestamp
        });
    }

    return nextLog.slice(0, limit);
}

module.exports = {
    DEFAULT_ACTIVITY_LIMIT,
    EDIT_MERGE_WINDOW_MS,
    reduceActivityLog
};
