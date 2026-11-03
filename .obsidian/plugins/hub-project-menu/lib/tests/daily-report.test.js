"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), Module = require("module");
const { localISODate } = require("../domain/dates");
const { captureReportContext, reportDay, activitySummary } = require("../domain/report-context");
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
let openedReport;
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const load = Module._load;
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: class {}, Modal: class { open() { openedReport = this; } }, FuzzySuggestModal: class {}, TFile: class {}, TFolder: class {}
} : load.apply(this, arguments); };
try { compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Wizard=ProjectWizardService;", filename); }
finally { Module._load = load; }
const today = localISODate(), date = "2026-09-14", timestamp = new Date(2026, 8, 14, 10, 23).getTime();
const clone = value => JSON.parse(JSON.stringify(value));
let projects = [{ projectId: "p", name: "Project A" }, { projectId: "q", name: "Project B" }];
const wizard = Object.assign(Object.create(compiled.exports.Wizard.prototype), {
    taskProgressEvidence(){return {availability:"current",records:this.nativeRecords}}, data: {}, projectWorkRatings: {}, projectWorkLogs: {}, resourceWorkRatings: {}, resourceWorkLogs: {},
    nativeRecords: [{ id: "task", projectId: "p", text: "Original task", timestamp, dueDate: "2020-01-01" },
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
    wizard.nativeRecords[0].text = "Renamed task";
    wizard.activityLog[0].title = "Renamed file";
    wizard.dailyFocus[date] = [];
    wizard.pendingFocus = null;
    Object.assign(wizard, clone(persisted));
    wizard.data = clone(persisted);
    wizard.nativeRecords = []; wizard.activityLog = []; wizard.dailyFocus = {};
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
    wizard.nativeRecords = [{ projectId: "p", text: "Legacy evidence", timestamp }];
    delete wizard.data.reportFocusByDate;
    wizard.pendingFocus = { sourceDate: "2026-09-15", items: [{ projectId: "p", text: "Wrong day" }] };
    const oldData = JSON.stringify(wizard.data);
    assert.equal(reportDay(wizard, date).reports[0].context.tasks[0].text, "Legacy evidence");
    assert.equal(reportDay(wizard, date).nextFocus.length, 0);
    assert.equal(JSON.stringify(wizard.data), oldData);
    wizard.nativeRecords = [];
    assert.deepEqual(reportDay(wizard, date).reports[0].context.tasks, []);

    // Today's save refreshes context and preserves the existing rating/removal semantics.
    wizard.nativeRecords = [{ projectId: "p", text: "Today's completed task", timestamp: Date.now() }];
    await wizard.replaceCombinedProgress(today, ["p", "q"], [], { p: 2, q: 1 }, { p: "Today" }, { sourceDate: today, items: [] });
    assert.equal(reportDay(wizard, today).reports[0].context.tasks.length, 1);
    assert.deepEqual(reportDay(wizard, today).nextFocus, []);
    await wizard.replaceProjectProgress(today, ["p"], {}, { p: "" });
    assert.equal(reportDay(wizard, today, "p").reports.length, 0, "Zero removes report as before");
    assert.equal(reportDay(wizard, today, "q").reports.length, 1, "Rating-only report retained");
    const midnight = new Date(2026, 8, 14, 0, 0).getTime();
    assert.equal(captureReportContext({ taskProgressEvidence:()=>({availability:"current",records:[{ projectId: "p", text: "Midnight", timestamp: midnight }]}) }, date, "p").tasks.length, 1);
    const progressDay = "2026-09-20", at = new Date(2026, 8, 20, 14).getTime();
    wizard.nativeRecords = [
        { id: "s2", kind: "step", parentTaskId: "parent", parentText: "Assignment 5", text: "2b", projectId: "p", timestamp: at + 1200000 },
        { id: "t", kind: "task", text: "Review lecture 7", projectId: "p", timestamp: at + 600000 },
        { id: "s1", kind: "step", parentTaskId: "parent", parentText: "Assignment 5", text: "2a", projectId: "p", timestamp: at }
    ];
    await wizard.replaceProjectProgress(progressDay, ["p"], { p: 3 }, { p: "Mixed progress" });
    const snapshot = clone(reportDay(wizard, progressDay).reports[0].context);
    assert.deepEqual(snapshot.tasks.map(item => item.id), ["s1", "t", "s2"]);
    assert.equal(snapshot.tasks[0].parentText, "Assignment 5");
    assert.equal(snapshot.tasks[0].id, "s1");
    wizard.nativeRecords = [];
    await wizard.replaceProjectProgress(progressDay, ["p"], { p: 4 }, { p: "Edited later" });
    assert.deepEqual(reportDay(wizard, progressDay).reports[0].context, snapshot, "Finalized mixed evidence survives source deletion and reflection edits");
    // Exercise the real exit entry point. Presentation reads the established
    // completion marker and saved project/resource reports without writing state.
    projects = [{ projectId: "p", name: "Project A" }];
    wizard.projectWorkRatings = {}; wizard.projectWorkLogs = {};
    wizard.resourceWorkRatings = {}; wizard.resourceWorkLogs = {};
    wizard.dirtyContexts = {};
    wizard.getPendingFocus = () => null;
    wizard.getFocusContexts = () => [];
    const host = Object.assign(Object.create(compiled.exports.prototype), {
        app: {}, projectWizard: wizard,
        getChangedProjects: () => projects, getChangedResources: () => [],
        finishWindowClose: () => { host.finished = true; }
    });
    const prompt = () => {
        host.hubAdvancementPromptOpen = false;
        const before = JSON.stringify(wizard);
        host.openProjectAdvancementPrompt({});
        assert.equal(JSON.stringify(wizard), before, "Header selection cannot mutate report state");
        assert.equal(openedReport.reportDate, today);
        assert.equal(openedReport.requireExplicitRatings, true);
        assert.equal(openedReport.saveLabel, "Save & close");
        return openedReport;
    };
    assert.equal(prompt().title, "Complete progress report");
    assert.equal(openedReport.reportMode, "complete");
    wizard.projectWorkRatings.p = { [today]: 3 };
    assert.equal(prompt().title, "Edit progress report", "Legacy rating alone cannot prove new activity");
    assert.equal(openedReport.selectedScores.get("p"), 3, "Existing ratings still load");
    wizard.projectWorkRatings = {};
    wizard.resourceWorkLogs.study = { [today]: { summary: "Saved resource reflection" } };
    assert.equal(prompt().title, "Edit progress report", "Resource-only legacy report counts without claiming new activity");
    const savedAt = Date.now() - 2000;
    wizard.resourceWorkLogs.study[today].timestamp = savedAt;
    wizard.activityLog = [{ projectId: "p", action: "edited", title: "Additional work", timestamp: savedAt + 1000 }];
    assert.equal(prompt().title, "Update progress report", "Existing activity query confirms additional activity after a manual save");
    wizard.activityLog[0].timestamp = savedAt - 1000;
    assert.equal(prompt().title, "Edit progress report", "Activity before the manual save does not count as new");
    wizard.resourceWorkLogs = {};
    wizard.dirtyContexts[today] = { projects: ["p"], resolvedAt: Date.now() - 1000 };
    assert.equal(prompt().title, "Update progress report", "Completed all-unrated exit uses existing resolution marker");
    assert.equal(openedReport.selectedScores.size, 0, "No invented rating defaults");
    wizard.projectWorkLogs.p = { [today]: { summary: "Manual edit after exit", timestamp: Date.now() } };
    assert.equal(prompt().title, "Edit progress report", "A newer manual save invalidates the older exit marker as evidence of new activity");
    wizard.projectWorkLogs = {};
    wizard.dirtyContexts = {};
    wizard.projectWorkRatings.p = { [date]: 3 };
    assert.equal(prompt().title, "Complete progress report", "Other dates do not count as today's report");
    host.getChangedProjects = () => [];
    host.hubAdvancementPromptOpen = false;
    host.openProjectAdvancementPrompt({});
    assert.equal(host.finished, true, "No activity retains the established no-report exit");
    console.log("PASS: report save/edit, project/resource scope, actual timestamps, empty states, focus association, source mutation/deletion, reload, legacy fallback, failed saves, zero/rating-only semantics, local dates; real exit header lifecycle, saved/legacy/manual reports, confirmed new activity and all-unrated completion markers without state writes or rating changes.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
