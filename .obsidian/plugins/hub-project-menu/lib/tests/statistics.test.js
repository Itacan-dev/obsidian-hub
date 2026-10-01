"use strict";
const assert = require("assert");
const { RANGES, prepareStatistics, aggregateStatistics, statisticsRange, seriesFor, formatDuration, isStatisticsNote } = require("../domain/statistics");
const { readStatistics } = require("../services/statistics");
const { taskProgressMutation } = require("../domain/task-progress");
const { localISODate } = require("../domain/dates");
const at = (day, hour = 12) => +new Date(2026, 8, day, hour), now = at(27), HOUR = 3600000;
const project = { projectId: "p", name: "Renamed project", root: "Projects/New", path: "Projects/New/New.md", status: "active" };
const resource = { projectId: "resource:study", name: "Knowledge", contextKind: "resource" };
const session = (id, start, end, state = "fulfilled", workspace = { type: "project", id: "p", name: "Old name" }) =>
    ({ id, startedAt: start, completedAt: end, state, workspace });
const sum = values => values.reduce((a, b) => a + b, 0);
const input = {
    workspaces: [project, resource, { projectId: "future", name: "Future", status: "future" }, { projectId: "shelved", name: "Shelved", status: "shelved" }],
    activity: [{ action: "edited", projectId: "p", path: "Projects/Old/Note.md", timestamp: at(22) },
        { action: "created", projectId: "resource:study", path: "Resources/Knowledge/Note.md", timestamp: at(23) },
        { action: "renamed", projectId: "p", path: "Projects/Old/Note.md", timestamp: at(25) },
        { action: "project-created", projectId: "future", path: "Projects/Future/Future.md", timestamp: at(26) },
        { action: "edited", projectId: "p", path: "Projects/Old/Meta/Tasks.md", timestamp: at(26) },
        { action: "edited", projectId: "p", path: "Projects/Old/image.png", timestamp: at(26) }],
    completions: [{ id: "task", projectId: "p", timestamp: at(23) }, { id: "step", kind: "step", projectId: "p", timestamp: at(24) },
        { id: "gone", projectId: "deleted", projectName: "Deleted project", timestamp: at(25) },
        { id: "legacy", projectName: "Old name", timestamp: at(25) },
        { id: "invalid", projectId: "p", timestamp: Infinity }, { id: "future", timestamp: at(28) }],
    oaths: [session("cross", at(20, 23), at(21, 2)), session("broken", at(24), at(24, 13), "broken"),
        session("resource", at(24), at(24, 14), "fulfilled", { type: "resource", id: "study", name: "Study" }),
        session("multi-day", at(25, 0), at(26, 4)),
        { id: "scheduled", state: "fulfilled", startedAt: null, completedAt: at(25), durationMs: HOUR },
        session("bad", at(25), at(24)), session("pending", at(27), at(28)), null],
    reports: [
        ...[4, 3, 2, 4].map((score, i) => ({ projectId: "p", projectName: "Old name", date: `2026-09-${21 + i}`, score })),
        ...[2, 1, 1].map((score, i) => ({ projectId: "future", date: `2026-09-${21 + i}`, score })),
        { projectId: "resource:study", date: "2026-09-22", score: 4 },
        { projectId: "resource:study", date: "2026-09-23", score: 1 },
        { projectId: "shelved", date: "2026-09-21", score: 2 },
        { projectId: "deleted-report", projectName: "Former project", date: "2026-09-22", score: 3 },
        { projectName: "Renamed project", date: "2026-09-22", score: 1 },
        { projectId: "p", date: "2026-09-20", score: 4, timestamp: at(26) },
        { projectId: "p", date: "2025-01-01", score: 2 },
        { projectId: "p", date: "2026-09-27", score: 0 },
        { projectId: "p", date: "2026-09-28", score: 4 },
        ...[null, undefined, NaN, Infinity, -1, 5, 1.5, "4"].map(score => ({ projectId: "p", date: "2026-09-22", score })),
        { projectId: "p", date: "2026-02-30", score: 4 }
    ],
    notes: [{ createdAt: at(25) }, { createdAt: at(25) }, { createdAt: at(26) }, { createdAt: at(1) }, { createdAt: NaN }]
};
input.oaths.push(input.oaths[0]); // Synced duplicate, counted once.
input.completions.push(input.completions[0]);
const source = prepareStatistics(input, now), model = aggregateStatistics(source, "7d");
assert.equal(model.range.days, 7);
const points = (data, id) => data.rows.find(row => row.projectId === id)?.progressPoints ?? 0;
assert.equal(points(model, "p"), 13, "Sum raw evaluations, not averages, duration or Home Momentum");
assert.equal(points(model, "future"), 4);
assert.equal(points(model, "shelved"), 2);
assert.equal(points(model, "resource:study"), 5);
assert.equal(points(model, "deleted-report"), 3);
assert.equal(model.rows.find(row => row.projectId === "deleted-report").name, "Former project");
assert.equal(model.rows.find(row => row.projectId === "deleted-report").deleted, true);
assert.equal(model.rows.find(row => row.key === "project:unassigned").progressPoints, 1, "No legacy name reassignment");
assert.equal(points(aggregateStatistics(source, "30d"), "p"), 17, "Use report date, not edited timestamp");
assert.equal(points(aggregateStatistics(source, "all"), "p"), 19, "All-time includes report-only early history");
assert.equal(model.comparison.total, 28);
assert.equal(model.comparison.projects, 82);
assert.equal(model.comparison.resources, 18);
const noReports = aggregateStatistics(prepareStatistics({ ...input, reports: [] }, now), "7d");
assert.equal(noReports.comparison.total, 0, "Oaths alone never create point shares");
assert.deepEqual(model.projects.map(({ progressPoints, ...row }) => row), noReports.projects.map(({ progressPoints, ...row }) => row), "Project activity metrics and cohort stay unchanged");
assert.deepEqual(model.oath, noReports.oath);
assert.deepEqual(model.note, noReports.note);
for (const metric of ["activity", "tasks", "steps"]) assert.deepEqual(seriesFor(model, metric, "all"), seriesFor(noReports, metric, "all"));
const zeroPoints = aggregateStatistics(prepareStatistics({ reports: [{ date: "2026-09-27", score: 0 }] }, now), "7d");
assert.deepEqual(zeroPoints.comparison, { total: 0, projects: 0, resources: 0 });
assert.equal(localISODate(new Date(model.range.start)), "2026-09-21");
assert.equal(model.oath.total, 33 * HOUR, "Clip the pre-period portion of a crossing session");
assert.equal(sum(model.oath.values), model.oath.total);
assert.equal(model.oath.values[0], 2 * HOUR);
assert.equal(model.oath.values[4], 24 * HOUR);
assert.equal(model.oath.values[5], 4 * HOUR);
assert.equal(model.oath.taken, 3, "Only sessions actually started in this period");
assert.equal(model.oath.fulfilled, 2);
assert.equal(model.comparison.projects + model.comparison.resources, 100);
assert.equal(model.rows.find(row => row.projectId === "p").time, 31 * HOUR);
assert.equal(model.rows.find(row => row.projectId === "p").name, "Renamed project");
assert.equal(model.rows.find(row => row.projectId === "deleted").deleted, true);
assert.equal(model.rows.find(row => row.key === "project:unassigned").name, "Unassigned");
assert.equal(sum(seriesFor(model, "tasks", "project")), 3);
assert.equal(sum(seriesFor(model, "steps", "project:p")), 1);
assert.equal(sum(seriesFor(model, "activity", "project")), 5, "No lifecycle, attachment, or metadata events");
assert.equal(sum(seriesFor(model, "activity", "resource")), 1);
assert.equal(model.note.total, 5);
assert.equal(model.note.created, 3);
assert.equal(model.note.average, 3 / 7);
assert.equal(model.note.largest, 2);
assert.equal(model.note.largestDate, "2026-09-25");
assert.equal(model.projects.find(row => row.projectId === "future").lastActive, null);
assert.equal(model.projects.find(row => row.projectId === "shelved").time, 0);
for (const [key] of RANGES) {
    const data = aggregateStatistics(source, key);
    assert.ok(data.range.bins.length <= 105);
    assert.equal(sum(data.oath.values), data.oath.total);
    assert.equal(data.note.total, 5);
    assert.ok(!JSON.stringify(data).includes("NaN"));
}
assert.equal(aggregateStatistics(source, "30d").oath.total, 34 * HOUR);
assert.equal(statisticsRange("3m", +new Date(2026, 4, 31), now).start, +new Date(2026, 2, 1));
assert.equal(statisticsRange("1y", +new Date(2024, 1, 29), now).start, +new Date(2023, 2, 1));
for (const value of [0, -1, Infinity, NaN]) assert.equal(formatDuration(value), "0 m");
assert.equal(formatDuration(28 * HOUR + 360000), "28 h 6 m");
assert.equal(formatDuration(1), "<1 m");

const empty = aggregateStatistics(prepareStatistics({}, now), "all");
assert.equal(empty.range.days, 1);
assert.deepEqual(empty.comparison, { total: 0, projects: 0, resources: 0 });
assert.equal(empty.note.average, 0);
assert.ok(empty.oath.values.every(value => value === 0));

// Test the actual History reducer: check, uncheck, recheck, then delete.
let history = [], checks = [], sequence = 0;
const mutate = edit => {
    const next = taskProgressMutation(checks, history, { path: "Projects/New/Tasks.md", line: 0, oldText: "Task", lineDelta: 0,
        hubTaskId: "t", tasks: [{ hubTaskId: "t", text: "Task", line: 0, completed: edit.completed }], ...edit }, project, at(26), () => `id${sequence++}`);
    ({ history, checks } = next);
    return aggregateStatistics(prepareStatistics({ workspaces: [project], completions: history }, now), "7d");
};
assert.equal(sum(seriesFor(mutate({ wasCompleted: false, completed: true }), "tasks", "project")), 1);
assert.equal(sum(seriesFor(mutate({ wasCompleted: true, completed: false }), "tasks", "project")), 0);
assert.equal(sum(seriesFor(mutate({ wasCompleted: false, completed: true }), "tasks", "project")), 1);
assert.equal(sum(seriesFor(mutate({ operation: "delete", tasks: [], removedLines: 1, lineDelta: -1 }), "tasks", "project")), 1);
assert.equal(sum(seriesFor(mutate({ operation: "step", progressTransitions: [{ kind: "step", hubTaskId: "s", text: "Step", line: 1, completed: true }] }), "steps", "project")), 1);
assert.equal(sum(seriesFor(mutate({ operation: "step", progressTransitions: [{ kind: "step", hubTaskId: "s", text: "Step", line: 1, completed: false }] }), "steps", "project")), 0);

for (const path of ["Home.md", "System/Notes.md", "Assets/Image.md", "Projects/X/image.png", "Projects/X/Meta/Design.md", "Projects/X/.state/file.md", "Projects/X/README.md"]) assert.equal(isStatisticsNote(path), false, path);
assert.equal(isStatisticsNote("Projects/New/New.md", { dashboardPaths: new Set(["Projects/New/New.md"]) }), false);
assert.equal(isStatisticsNote("Resources/Knowledge/Knowledge.md", { frontmatter: { type: "resource" } }), false);
assert.equal(isStatisticsNote("Projects/X/Tasks/Tasks.md"), true);
assert.equal(isStatisticsNote("Resources/Knowledge/Algebra.md"), true);

let metadataReads = 0; const reportScopes = [];
const files = ["Projects/New/New.md", "Projects/New/Note.md", "System/state.md"].map(path => ({ path, stat: { ctime: at(26) } }));
const plugin = { projectWizard: { getProjectRecords: () => [project], getResourceTypes: () => [resource],
    getProgressReports: scope => { reportScopes.push(scope); return input.reports.filter(report => String(report.projectId).startsWith("resource:") === (scope?.kind === "resource")); },
    data: { oathsByDevice: { desktop: { history: input.oaths }, laptop: { history: [input.oaths[0]] } } }, activityLog: input.activity, completedTaskHistory: input.completions },
    app: { vault: { getMarkdownFiles: () => files }, metadataCache: { getFileCache: () => { metadataReads++; return {}; } } } };
const snapshot = readStatistics(plugin, now);
assert.equal(snapshot.totalNotes, 1);
assert.equal(points(aggregateStatistics(snapshot, "7d"), "p"), 13);
assert.equal(points(aggregateStatistics(snapshot, "7d"), "resource:study"), 5);
assert.deepEqual(reportScopes, [undefined, { kind: "resource" }], "Read canonical project and resource reports once");
for (const [range] of RANGES) aggregateStatistics(snapshot, range);
assert.equal(metadataReads, files.length, "No vault access on range changes");

// A realistic large event history still produces a bounded chart dataset.
const large = prepareStatistics({ workspaces: Array.from({ length: 250 }, (_, i) => ({ projectId: `p${i}`, name: `Project ${i}` })),
    completions: Array.from({ length: 100000 }, (_, i) => ({ id: `e${i}`, projectId: `p${i % 250}`, timestamp: +new Date(2000 + i % 26, i % 12, i % 28 + 1) })) }, now);
const all = aggregateStatistics(large, "all");
assert.equal(all.rows.length, 250);
assert.ok(all.range.bins.length <= 80);
assert.equal(sum(seriesFor(all, "tasks", "project")), 100000);

// Local-calendar/DST boundary regression, run in Stockholm as well as host TZ.
const spring = +new Date(2026, 2, 29), springEnd = +new Date(2026, 2, 30);
const dst = aggregateStatistics(prepareStatistics({ oaths: [session("dst", spring, springEnd)] }, springEnd + HOUR), "7d");
assert.equal(dst.oath.total, springEnd - spring);
assert.equal(sum(dst.oath.values), springEnd - spring);
console.log("Statistics checks passed: ranges, DST, real completion semantics, clipped Oaths, stable identities, notes, filters, empty and 100k-event data.");
