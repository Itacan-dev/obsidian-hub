"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), Module = require("module");
const { localISODate } = require("../domain/dates");
const { captureReportContext, reportDay, activitySummary } = require("../domain/report-context");
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const load = Module._load;
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile: class {}, TFolder: class {}
} : load.apply(this, arguments); };
try { compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Wizard=ProjectWizardService;", filename); }
finally { Module._load = load; }
const today = localISODate(), date = "2026-09-14", timestamp = new Date(2026, 8, 14, 10, 23).getTime();
const clone = value => JSON.parse(JSON.stringify(value));
let projects = [{ projectId: "p", name: "Project A" }, { projectId: "q", name: "Project B" }];
const wizard = Object.assign(Object.create(compiled.exports.Wizard.prototype), {
    data: {}, projectWorkRatings: {}, projectWorkLogs: {}, resourceWorkRatings: {}, resourceWorkLogs: {},
    completedTaskHistory: [{ id: "task", projectId: "p", text: "Original task", timestamp, dueDate: "2020-01-01" },
        { projectId: "resource:study", text: "Read paper", timestamp },
        { projectId: "p", text: "Other date", timestamp: timestamp - 86400000 }],
    activityLog: [{ projectId: "p", action: "created", title: "Original file", timestamp },
        { projectId: "p", action: "edited", title: "Original file", timestamp: timestamp + 1000 }],
    dailyFocus: { [date]: [{ projectId: "p", projectName: "Project A", text: "Daily intention" }] }, pendingFocus: null,
    getProjectRecords: () => projects, getProjectById: id => projects.find(project => project.projectId === id),
    getResourceById: id => ({ resourceType: id, label: "Knowledge" })
});
let persisted;
wizard.store = { save: async data => { persisted = clone(data); } };
async function run() {
    await wizard.replaceCombinedProgress(date, ["p", "q"], ["study"], { p: 3, q: 2, "resource:study": 4 },
        { p: "Reflection", q: "No tasks", "resource:study": "Read" }, { sourceDate: date, items: [
            { projectId: "p", projectName: "Project A", text: "Next action" },
            { projectId: "resource:study", projectName: "Knowledge", text: "Keep reading" },
            { projectId: "other", projectName: "Another workspace", text: "Plan" }
        ] });
    let day = reportDay(wizard, date, { kind: "project" });
    assert.equal(day.reports.length, 2);
    assert.deepEqual(day.reports[0].context.tasks, [{ id: "task", text: "Original task", timestamp }]);
    assert.equal(day.reports[1].context.tasks.length, 0);
    assert.deepEqual(day.reports[0].context.focus, ["Daily intention"]);
    assert.deepEqual(day.reports[1].context.focus, []);
    assert.equal(day.nextFocus.length, 3, "Shared next focus retains targets without a report");
    assert.equal(activitySummary(day.reports[0].context.activity), "1 edited · 1 created");
    assert.equal(day.reports[1].context.activity.length, 0);
    assert.equal(reportDay(wizard, date, { kind: "resource" }).reports[0].context.tasks[0].text, "Read paper");
    assert.equal(reportDay(wizard, "2026-09-13").reports.length, 0);

    // Source mutations and pending-focus consumption cannot rewrite saved evidence.
    projects = [{ projectId: "p", name: "Renamed workspace" }];
    wizard.completedTaskHistory[0].text = "Renamed task";
    wizard.activityLog[0].title = "Renamed file";
    wizard.dailyFocus[date] = [];
    wizard.pendingFocus = null;
    Object.assign(wizard, clone(persisted));
    wizard.data = clone(persisted);
    wizard.completedTaskHistory = []; wizard.activityLog = []; wizard.dailyFocus = {};
    day = reportDay(wizard, date);
    assert.equal(day.reports[0].projectName, "Project A");
    assert.equal(day.reports[0].context.tasks[0].text, "Original task");
    assert.equal(day.reports[0].context.activity[1].title, "Original file");
    await wizard.replaceProjectProgress(date, ["p"], { p: 4 }, { p: "Edited reflection" });
    assert.equal(reportDay(wizard, date).reports[0].context.tasks[0].text, "Original task");
    assert.equal(reportDay(wizard, date).nextFocus[0].text, "Next action");
    assert.equal(reportDay(wizard, date).reports[0].summary, "Edited reflection");

    const before = JSON.stringify(wizard.data);
    wizard.store.save = async () => { throw Error("disk failure"); };
    await assert.rejects(wizard.replaceProjectProgress(date, ["p"], { p: 1 }, { p: "failed" }), /disk failure/);
    assert.equal(JSON.stringify(wizard.data), before, "Failed saves do not commit evidence or reflection");
    wizard.store.save = async data => { persisted = clone(data); };

    // Legacy entries resolve only from existing historical records, with no migration on read.
    delete wizard.projectWorkLogs.p[date].context;
    wizard.completedTaskHistory = [{ projectId: "p", text: "Legacy evidence", timestamp }];
    delete wizard.data.reportFocusByDate;
    wizard.pendingFocus = { sourceDate: "2026-09-15", items: [{ projectId: "p", text: "Wrong day" }] };
    const oldData = JSON.stringify(wizard.data);
    assert.equal(reportDay(wizard, date).reports[0].context.tasks[0].text, "Legacy evidence");
    assert.equal(reportDay(wizard, date).nextFocus.length, 0);
    assert.equal(JSON.stringify(wizard.data), oldData);
    wizard.completedTaskHistory = [];
    assert.deepEqual(reportDay(wizard, date).reports[0].context.tasks, []);

    // Today's save refreshes context and preserves the existing rating/removal semantics.
    wizard.completedTaskHistory = [{ projectId: "p", text: "Today's completed task", timestamp: Date.now() }];
    await wizard.replaceCombinedProgress(today, ["p", "q"], [], { p: 2, q: 1 }, { p: "Today" }, { sourceDate: today, items: [] });
    assert.equal(reportDay(wizard, today).reports[0].context.tasks.length, 1);
    assert.deepEqual(reportDay(wizard, today).nextFocus, []);
    await wizard.replaceProjectProgress(today, ["p"], {}, { p: "" });
    assert.equal(reportDay(wizard, today, "p").reports.length, 0, "Zero removes report as before");
    assert.equal(reportDay(wizard, today, "q").reports.length, 1, "Rating-only report retained");
    const midnight = new Date(2026, 8, 14, 0, 0).getTime();
    assert.equal(captureReportContext({ completedTaskHistory: [{ projectId: "p", text: "Midnight", timestamp: midnight }] }, date, "p").tasks.length, 1);
    console.log("PASS: report save/edit, project/resource scope, actual timestamps, empty states, focus association, source mutation/deletion, reload, legacy fallback, failed saves, zero/rating-only semantics and local dates.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
