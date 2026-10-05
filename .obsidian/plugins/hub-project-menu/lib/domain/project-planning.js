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
// Intrinsic dates are independent of both Today and the user's viewport.
function roadmapExtent(data) {
    const dates = [...(data.phases ?? []).flatMap(phase => [phase.start, phase.end]),
        ...(data.milestones ?? []).map(item => item.date)].filter(date => parseLocalISODate(date)).sort();
    return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
}
function addDays(date, amount) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
function dateRange(start, end) {
    const first = dayNumber(localISODate(start)), total = dayNumber(localISODate(end)) - first;
    return { start, end, total, position: iso => (dayNumber(iso) - first) / total * 100 };
}
function roadmapRange(anchor, months) {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return dateRange(start, new Date(start.getFullYear(), start.getMonth() + months, 1));
}
function roadmapViewport(data, state, today = new Date()) {
    const extent = roadmapExtent(data), zoom = state.roadmapZoom ?? "all";
    if (zoom !== "all") return roadmapRange(parseLocalISODate(state.roadmapViewport) ??
        (extent ? parseLocalISODate(extent.start) : today), Number(zoom));
    // Empty plans retain a sensible calendar viewport without inventing project bounds.
    if (!extent) return roadmapRange(parseLocalISODate(state.roadmapViewport) ?? today, 6);
    const first = parseLocalISODate(extent.start);
    const days = dayNumber(extent.end) - dayNumber(extent.start) + 1;
    const padding = Math.max(3, Math.min(14, Math.ceil(days * .04)));
    const start = parseLocalISODate(state.roadmapViewport) ?? addDays(first, -padding);
    return dateRange(start, addDays(start, days + padding * 2));
}
function roadmapZoom(data, state, zoom, today = new Date()) {
    if (zoom === "all") return { roadmapZoom: "all", roadmapViewport: null };
    const range = roadmapViewport(data, state, today), center = addDays(range.start, Math.floor(range.total / 2));
    const start = new Date(center.getFullYear(), center.getMonth() - Math.floor(Number(zoom) / 2), 1);
    return { roadmapZoom: zoom, roadmapViewport: localISODate(start) };
}
function panRoadmap(data, state, direction, today = new Date()) {
    const range = roadmapViewport(data, state, today);
    const start = (state.roadmapZoom ?? "all") === "all" ? addDays(range.start, direction * range.total) :
        new Date(range.start.getFullYear(), range.start.getMonth() + direction * Number(state.roadmapZoom), 1);
    return { roadmapViewport: localISODate(start) };
}
function roadmapToday(data, state, today = new Date()) {
    if ((state.roadmapZoom ?? "all") === "all") {
        const fit = roadmapViewport(data, { roadmapZoom: "all" }, today), position = fit.position(localISODate(today));
        if (position >= 0 && position < 100) return { roadmapViewport: null };
        return { roadmapViewport: localISODate(addDays(today, -Math.floor(fit.total / 2))) };
    }
    return { roadmapViewport: localISODate(new Date(today.getFullYear(), today.getMonth() - Math.floor(Number(state.roadmapZoom) / 2), 1)) };
}
function phasePlacement(phase, range) {
    const start = range.position(phase.start), end = range.position(phase.end) + 100 / range.total;
    if (end <= 0 || start >= 100) return null;
    return { left: Math.max(0, start), width: Math.min(100, end) - Math.max(0, start) };
}
module.exports = { planningState, phaseValues, milestoneValues, roadmapRange, roadmapExtent, roadmapViewport, roadmapZoom, panRoadmap, roadmapToday, phasePlacement };
