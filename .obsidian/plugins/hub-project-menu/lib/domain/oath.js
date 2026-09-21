"use strict";

const isCommitted = oath => ["scheduled", "active"].includes(oath?.state);
const DEFAULT_DURATION_MS = 50 * 60000;
const validDuration = ms => Number.isSafeInteger(ms) && ms >= 60000 && ms % 60000 === 0;
function normalizeOath(oath) {
    if (!isCommitted(oath)) return oath;
    const { fulfilment, autoExit, scope, ...current } = oath;
    return { ...current, durationMs: validDuration(oath.durationMs) ? oath.durationMs : DEFAULT_DURATION_MS,
        tasks: Array.isArray(oath.tasks) ? oath.tasks : [], fulfilledAt: Number.isFinite(oath.fulfilledAt) ? oath.fulfilledAt : null };
}
function validateOath(draft, now = Date.now()) {
    if (!["now", "scheduled"].includes(draft.start)) throw Error("Choose when the Oath should begin.");
    if (draft.start === "scheduled" && (!Number.isFinite(draft.scheduledAt) || draft.scheduledAt <= now)) {
        throw Error("Choose a start date and time in the future.");
    }
    if (!validDuration(draft.durationMs)) {
        throw Error("Choose a duration in whole minutes, at least one minute.");
    }
}
function oathTime(oath, now = Date.now()) {
    const elapsedMs = oath?.startedAt == null ? 0 : Math.max(0, (oath.completedAt ?? now) - oath.startedAt);
    return { elapsedMs, remainingMs: Math.max(0, (oath?.durationMs ?? DEFAULT_DURATION_MS) - elapsedMs) };
}
// Fulfillment is a timestamp, independent of actual session end.
function fulfilmentTime(oath, work, now = Date.now()) {
    if (oath?.fulfilledAt != null) return oath.fulfilledAt;
    if (oath?.state !== "active" || oath.startedAt == null) return null;
    const deadline = oath.startedAt + oath.durationMs;
    if (now >= deadline) return deadline;
    return oath.tasks.length > 0 && work.length === oath.tasks.length && oathProgress(work).allComplete ? now : null;
}
function oathProgress(work) {
    return { total: work.length, completed: work.filter(item => item.task?.completed).length,
        missing: work.filter(item => !item.task).length,
        allComplete: work.length > 0 && work.every(item => item.task?.completed) };
}
function shortOathTime(ms) {
    const minutes = Math.ceil(Math.max(0, ms) / 60000);
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}
function fulfilmentLabel(oath) {
    if (oath.fulfilledAt != null) return "Fulfilled · Still Oathbound";
    return `After ${oathDuration(oath.durationMs)}${oath.tasks?.length ? " or when all selected tasks are complete" : ""}`;
}
function oathDuration(ms) {
    if (!Number.isFinite(ms) || ms < 60000) return "a selected duration";
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 120) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
    const hours = Math.floor(minutes / 60), remainder = minutes % 60;
    return `${hours} hours${remainder ? ` ${remainder} ${remainder === 1 ? "minute" : "minutes"}` : ""}`;
}
module.exports = { isCommitted, validateOath, oathTime, oathProgress, shortOathTime, fulfilmentLabel, oathDuration, DEFAULT_DURATION_MS, validDuration, normalizeOath, fulfilmentTime };
