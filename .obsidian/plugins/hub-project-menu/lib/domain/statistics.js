"use strict";

const { localISODate } = require("./dates");
const { historyKind } = require("./history");

const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["3m", "3 months"], ["1y", "1 year"], ["all", "All time"]];
const DAY = 86400000;
const validTime = value => Number.isFinite(value) && value > 0 && value <= 8640000000000000;
const dayStart = value => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };
const nextDay = value => { const date = dayStart(value); date.setDate(date.getDate() + 1); return +date; };
const calendarDay = value => { const date = new Date(value); return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY; };
const list = value => Array.isArray(value) ? value.filter(Boolean) : [];

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "0 m";
    const minutes = Math.floor(ms / 60000);
    if (!minutes) return "<1 m";
    return minutes < 60 ? `${minutes} m` : `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
}

// Notes are Markdown content in Itacan workspaces, excluding dashboard and
// implementation metadata. Filesystem creation dates describe surviving notes;
// they cannot reconstruct deleted notes or historical vault totals.
function isStatisticsNote(path, { dashboardPaths = new Set(), frontmatter = {} } = {}) {
    if (typeof path !== "string" || !/^(Projects|Resources)\/.+\.md$/i.test(path)) return false;
    if (dashboardPaths.has(path) || ["project", "resource"].includes(frontmatter?.type)) return false;
    const parts = path.split("/");
    return !parts.some(part => part.startsWith(".") || part === "Meta") &&
        !/^(AGENTS|SKILL|README)\.md$/i.test(parts[parts.length - 1]);
}

function statisticsRange(key, now, earliest) {
    const today = dayStart(now), start = new Date(today);
    if (key === "7d" || key === "30d") start.setDate(start.getDate() - (key === "7d" ? 6 : 29));
    else if (key === "3m" || key === "1y") {
        // Clamp calendar subtraction at month ends (including leap years).
        const day = start.getDate(); start.setDate(1);
        start.setMonth(start.getMonth() - (key === "3m" ? 3 : 12));
        const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        start.setDate(Math.min(day, last)); start.setDate(start.getDate() + 1);
    } else if (key === "all" && validTime(earliest)) start.setTime(+dayStart(Math.min(earliest, now)));
    const days = Math.max(1, calendarDay(today) - calendarDay(start) + 1);
    // All charts share these bounded, local-calendar bins. DST days need not be 24h.
    const binDays = days <= 100 ? 1 : days <= 730 ? 7 : Math.ceil(days / 80);
    const bins = [];
    for (let cursor = +start; cursor < nextDay(today);) {
        const date = new Date(cursor); date.setDate(date.getDate() + binDays);
        const end = Math.min(+date, nextDay(today));
        bins.push({ start: cursor, end, date: localISODate(new Date(cursor)) }); cursor = end;
    }
    return { key, start: +start, end: nextDay(today), now, days, binDays, bins };
}

function uniqueRecords(records) {
    const seen = new Set();
    return records.filter(record => {
        if (!record.id) return true;
        if (seen.has(record.id)) return false;
        seen.add(record.id); return true;
    });
}

function prepareStatistics({ workspaces = [], activity = [], completions = [], oaths = [], notes = [] } = {}, now = Date.now()) {
    const registry = new Map();
    for (const workspace of list(workspaces)) {
        if (!workspace.projectId) continue;
        const kind = historyKind(workspace), key = `${kind}:${workspace.projectId}`;
        registry.set(key, { ...workspace, key, kind, name: workspace.name ?? workspace.label ?? "Unnamed workspace", deleted: false });
    }
    function identify(record) {
        const kind = historyKind(record), id = record.projectId;
        // Never associate a legacy record by display name/path with a newly
        // created workspace. Stable IDs survive renaming and shelving.
        const key = id ? `${kind}:${id}` : `${kind}:unassigned`;
        if (!registry.has(key)) registry.set(key, {
            key, kind, projectId: id ?? null, deleted: !!id,
            name: id ? record.projectName ?? record.project ?? "Deleted workspace" : "Unassigned",
            status: id ? "deleted" : "unassigned"
        });
        return key;
    }
    const completionRecords = uniqueRecords(list(completions)).filter(record => validTime(record.timestamp) && record.timestamp <= now)
        .map(record => ({ ...record, key: identify(record), kind: record.kind === "step" ? "step" : "task" }));
    const work = list(activity).filter(record => ["created", "edited"].includes(record.action) &&
        isStatisticsNote(record.path) && validTime(record.timestamp) && record.timestamp <= now)
        .map(record => ({ timestamp: record.timestamp, key: identify(record) }));
    work.push(...completionRecords.map(record => ({ timestamp: record.timestamp, key: record.key })));
    const sessions = uniqueRecords(list(oaths)).filter(record => ["fulfilled", "broken"].includes(record.state) &&
        validTime(record.startedAt) && validTime(record.completedAt) && record.completedAt >= record.startedAt && record.completedAt <= now)
        .map(record => {
            const workspace = record.workspace, kind = workspace?.type === "resource" ? "resource" : "project";
            const id = workspace?.id ? kind === "resource" ? `resource:${workspace.id.replace(/^resource:/, "")}` : workspace.id : record.projectId;
            return { ...record, key: identify({ projectId: id, projectName: workspace?.name ?? record.projectName, contextKind: kind }) };
        });
    const currentNotes = list(notes);
    const creations = currentNotes.filter(note => validTime(note.createdAt) && note.createdAt <= now);
    let earliest = now;
    for (const record of [...work, ...sessions, ...creations]) earliest = Math.min(earliest, record.timestamp ?? record.startedAt ?? record.createdAt);
    const lastActive = new Map();
    for (const record of work) lastActive.set(record.key, Math.max(lastActive.get(record.key) ?? 0, record.timestamp));
    for (const record of sessions) lastActive.set(record.key, Math.max(lastActive.get(record.key) ?? 0, record.completedAt));
    return { registry, work, completions: completionRecords, sessions, notes: creations, totalNotes: currentNotes.length, earliest, lastActive, now };
}

function aggregateStatistics(source, rangeKey = "3m") {
    const range = statisticsRange(rangeKey, source.now, source.earliest);
    const empty = () => range.bins.map(() => 0), inside = time => time >= range.start && time < range.end && time <= source.now;
    const index = time => Math.min(range.bins.length - 1, Math.floor((calendarDay(time) - calendarDay(range.start)) / range.binDays));
    const byWorkspace = new Map([...source.registry].map(([key, workspace]) => [key, {
        ...workspace, time: 0, activity: empty(), tasks: empty(), steps: empty(), lastActive: source.lastActive.get(key) ?? null
    }]));
    const oath = { values: empty(), total: 0, taken: 0, fulfilled: 0 };
    for (const record of source.work) if (inside(record.timestamp)) byWorkspace.get(record.key).activity[index(record.timestamp)]++;
    for (const record of source.completions) if (inside(record.timestamp)) {
        byWorkspace.get(record.key)[record.kind === "step" ? "steps" : "tasks"][index(record.timestamp)]++;
    }
    for (const session of source.sessions) {
        if (inside(session.startedAt)) { oath.taken++; if (session.state === "fulfilled") oath.fulfilled++; }
        const start = Math.max(session.startedAt, range.start), end = Math.min(session.completedAt, range.end, source.now);
        if (end <= start) continue;
        byWorkspace.get(session.key).time += end - start; oath.total += end - start;
        for (let bin = index(start); bin < range.bins.length && range.bins[bin].start < end; bin++) {
            oath.values[bin] += Math.max(0, Math.min(end, range.bins[bin].end) - Math.max(start, range.bins[bin].start));
        }
    }
    const note = { values: empty(), total: source.totalNotes, created: 0, largest: 0, largestDate: null }, dailyNotes = new Map();
    for (const item of source.notes) if (inside(item.createdAt)) {
        note.values[index(item.createdAt)]++; note.created++;
        const date = localISODate(new Date(item.createdAt)); dailyNotes.set(date, (dailyNotes.get(date) ?? 0) + 1);
    }
    for (const [date, count] of [...dailyNotes].sort(([a], [b]) => a.localeCompare(b))) if (count > note.largest) { note.largest = count; note.largestDate = date; }
    note.average = note.created / range.days;
    const rows = [...byWorkspace.values()];
    const projects = rows.filter(row => row.kind === "project").sort((a, b) =>
        (b.lastActive ?? 0) - (a.lastActive ?? 0) || b.time - a.time || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
    const projectTime = rows.filter(row => row.kind === "project").reduce((sum, row) => sum + row.time, 0);
    const resourceTime = rows.filter(row => row.kind === "resource").reduce((sum, row) => sum + row.time, 0);
    const total = projectTime + resourceTime;
    const projectPercent = total ? Math.round(projectTime / total * 100) : 0;
    return { range, rows, projects, oath, note, comparison: { total, projects: projectPercent, resources: total ? 100 - projectPercent : 0 } };
}

function seriesFor(model, metric, scope) {
    const values = model.range.bins.map(() => 0);
    for (const row of model.rows) if (scope === "all" || scope === row.kind || scope === row.key) {
        row[metric].forEach((value, index) => { values[index] += value; });
    }
    return values;
}

module.exports = { RANGES, formatDuration, isStatisticsNote, statisticsRange, prepareStatistics, aggregateStatistics, seriesFor };
