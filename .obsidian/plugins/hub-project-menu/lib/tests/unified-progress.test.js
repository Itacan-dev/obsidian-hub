"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { calculateHomeMomentum } = require("../domain/progress");
const { reportDay } = require("../domain/report-context");
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const original = Module._load;
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile: class {}, TFolder: class {}
} : original.apply(this, arguments); };
try { compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Wizard=ProjectWizardService;", filename); }
finally { Module._load = original; }
const day = "2026-09-14", resourceDay = "2026-09-13", summaryDay = "2026-09-12";
let projects = [{ projectId: "p", name: "Same name" }, { projectId: "q", name: "Second project" }];
const wizard = Object.assign(Object.create(compiled.exports.Wizard.prototype), {
    projectWorkRatings: { p: { [day]: 2 }, q: { [day]: 1 } },
    resourceWorkRatings: { study: { [day]: 2, [resourceDay]: 3 } },
    projectWorkLogs: { p: { [day]: { projectName: "Same name", summary: "Project", timestamp: 200 } },
        q: { [day]: { summary: "Undated" } },
        deleted: { [day]: { projectName: "Deleted project", summary: "Retained", timestamp: 300 } } },
    resourceWorkLogs: { study: { [day]: { resourceName: "Same name", summary: "Resource", timestamp: 400 },
        [summaryDay]: { summary: "Summary only", timestamp: 900 } } },
    getProjectRecords: () => projects,
    getResourceTypes: () => [{ resourceType: "study", label: "Same name" }],
    getResourceById: id => ({ resourceType: id, label: "Same name" }),
    data: {}, dailyFocus: {}, activityLog: []
});
const before = JSON.stringify(wizard);
const combined = wizard.getHomeMomentumProgress("all");
assert.equal(combined.ratings[day], calculateHomeMomentum([2, 1, 2]));
assert.equal(combined.ratings[resourceDay], 3);
assert.equal(combined.ratings[summaryDay], undefined, "Summary-only reports do not invent heatmap intensity");
assert.deepEqual(new Set(combined.contributors[day].map(c => c.projectId)), new Set(["p", "q", "resource:study"]));
assert.equal(combined.contributors[day].length, 3, "Identical names remain separate workspace contributors");
assert.deepEqual(wizard.getHomeMomentumProgress(), wizard.getHomeMomentumProgress("projects"));
assert.equal(wizard.getHomeMomentumProgress("resources").ratings[day], 2);
assert.equal(wizard.getHomeMomentumProgress("unexpected").ratings[day], wizard.getHomeMomentumProgress().ratings[day]);
const reports = wizard.getProgressReports({ kind: "all" });
assert.deepEqual(reports.slice(0, 4).map(r => r.projectId), ["resource:study", "deleted", "p", "q"]);
assert.equal(reports.at(-1).date, summaryDay, "Report date takes priority over save timestamp");
assert.equal(reports.at(-1).score, null);
assert.equal(wizard.getProgressReports().length, 3, "Default remains Projects only");
assert.equal(wizard.getProgressReports({ kind: "resource" }).length, 3);
assert.equal(wizard.getProgressReports("p").length, 1);
assert.equal(wizard.getProgressReports({ kind: "resource", id: "study" }).length, 3);
assert.equal(reportDay(wizard, day, { kind: "all" }).reports.length, 4);
assert.equal(reportDay(wizard, resourceDay, { kind: "all" }).reports[0].targetKind, "resource");
assert.equal(reportDay(wizard, summaryDay, { kind: "all" }).reports[0].summary, "Summary only");
assert.equal(reportDay(wizard, "2026-09-11", { kind: "all" }).reports.length, 0);
assert.equal(JSON.stringify(wizard), before, "Combined reads do not mutate stored data");
projects = [];
assert.equal(wizard.getProgressReports({ kind: "all" }).length, 6, "Historical reports survive missing live Projects");
wizard.projectWorkLogs.p[day].timestamp = 400;
assert.deepEqual(wizard.getProgressReports({ kind: "all" }).slice(0, 2).map(r => r.targetKind), ["project", "resource"], "Equal names and times have stable kind/identity ties");

// Exercise the Home refresh callback and getters, not an alternate test implementation.
const source = fs.readFileSync(path.resolve(__dirname, "../../../../../System/Dashboards/Home/view.js"), "utf8");
const getters = source.slice(source.indexOf("function getCombinedProgressReports("), source.indexOf("const currentProgressYear"));
const listeners = new Map(), calls = [], window = {
    hubGetWorkProgress(scope) { assert.equal(scope, "all"); return wizard.getHomeMomentumProgress(scope); },
    hubGetProgressReports(scope) { assert.deepEqual(scope, { kind: "all" }); return wizard.getProgressReports(scope); }
};
const refresh = source.slice(source.indexOf('root.addEventListener(\n    "hub-progress-changed"'), source.indexOf("const progressTabs ="));
const state = new Function("window", "root", "refreshProgressYears", "renderProgressYear", "renderActiveProgressView", `
    let workRatings={},workContributors={},progressReports=[],progressView='reports';
    ${getters}\n${refresh}
    return {snapshot:()=>({workRatings,workContributors,progressReports}),tab:value=>progressView=value};
`)(window, { addEventListener: (name, callback) => listeners.set(name, callback) },
    () => calls.push("years"), () => calls.push("heatmap"), () => calls.push("history"));
wizard.resourceWorkRatings.study[day] = 4;
listeners.get("hub-progress-changed")();
assert.equal(state.snapshot().workRatings[day], 4);
assert.equal(state.snapshot().progressReports[0].score, 2);
assert.deepEqual(calls, ["years", "heatmap", "history"]);
state.tab("tasks"); calls.length = 0; listeners.get("hub-progress-changed")();
assert.deepEqual(calls, ["years", "heatmap"], "Progress refresh does not reset Tasks History");
assert.doesNotMatch(source, /progressScope|home-progress-scope|getScopedProgressReports/);
const activityRefresh = source.slice(source.indexOf('root.addEventListener(\n    "hub-activity-changed"'), source.indexOf("async function loadTaskData("));
new Function("window", "root", "renderActiveProgressView", `
    let recentItems=[],progressView='activity';${activityRefresh}
` )({ hubGetActivityLog: () => [{ projectId: "p" }, { projectId: "resource:study" }] },
    { addEventListener: (name, callback) => listeners.set(name, callback) }, () => calls.push("activity"));
listeners.get("hub-activity-changed")();
assert.equal(calls.at(-1), "activity", "Activity change notification still refreshes the active tab");

async function taskRefresh() {
    const { createTaskHistoryRead } = require("../services/task-history-read");
    let reads = 0, notifications = 0, notify;
    let records = [{ projectId: "p" }, { projectId: "resource:study" }];
    const cleanup = [], reader = createTaskHistoryRead({ plugin: { register() {} },
        component: { register: fn => cleanup.push(fn) }, changed: () => notifications++,
        completionFeed: { subscribe(fn) { notify = fn; return () => {}; },
            async read() { reads++; return { records, diagnostics: [] }; } } });
    const first = await reader.read(); reader.accept(first);
    assert.equal(first.records.length, 2);
    assert.equal((await reader.read()).changed, false);
    assert.equal(reads, 1, "Switching History views reuses the completion cache");
    records = [...records, { projectId: "resource:study", id: "new-completion" }]; notify();
    const refreshed = await reader.read();
    assert.equal(notifications, 1); assert.equal(reads, 2);
    assert.equal(refreshed.changed, true); assert.equal(refreshed.records.length, 3);
    cleanup.forEach(fn => fn()); assert.equal(await reader.read(), null);
    console.log("PASS: combined raw-rating Momentum, contributor identities, unchanged defaults, summary-only/Resource-only/mixed dates, chronological/tie ordering, deleted workspaces, read-only queries, Home report/activity live refresh and task-cache invalidation/cleanup.");
}
taskRefresh().catch(error => { console.error(error); process.exitCode = 1; });
