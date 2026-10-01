"use strict";
const { parseLocalISODate, localISODate } = require("./dates");
const { dayNumber } = require("./task-views");
const copy = value => JSON.parse(JSON.stringify(value));
function planningState(value) {
    return { version: 1, revision: value?.revision ?? 0,
        phases: copy(value?.phases ?? []).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.start.localeCompare(b.start)),
        milestones: copy(value?.milestones ?? []) };
}
function phaseValues(value) {
    const name = String(value.name ?? "").trim();
    if (!name) throw Error("Enter a phase name.");
    if (!parseLocalISODate(value.start) || !parseLocalISODate(value.end)) throw Error("Choose valid phase dates.");
    if (value.end < value.start) throw Error("End must be on or after Start.");
    return { name, start: value.start, end: value.end, description: String(value.description ?? "").trim() };
}
function milestoneValues(value) {
    const name = String(value.name ?? "").trim();
    if (!name) throw Error("Enter a milestone name.");
    if (!parseLocalISODate(value.date)) throw Error("Choose a valid milestone date.");
    return { name, date: value.date, achieved: !!value.achieved };
}
function roadmapRange(anchor, months) {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + months, 1);
    const first = dayNumber(localISODate(start)), total = dayNumber(localISODate(end)) - first;
    return { start, end, total, position: iso => (dayNumber(iso) - first) / total * 100 };
}
function phasePlacement(phase, range) {
    const start = range.position(phase.start), end = range.position(phase.end) + 100 / range.total;
    if (end <= 0 || start >= 100) return null;
    return { left: Math.max(0, start), width: Math.min(100, end) - Math.max(0, start) };
}
module.exports = { planningState, phaseValues, milestoneValues, roadmapRange, phasePlacement };
