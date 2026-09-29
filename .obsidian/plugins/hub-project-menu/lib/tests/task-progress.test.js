"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), Module = require("module");
const { readTaskSnapshot } = require("../domain/task-planning");
const { captureReportContext, savedReportContext } = require("../domain/report-context");
const { oathProgress } = require("../domain/oath");
const { localISODate } = require("../domain/dates");
const { HubTaskEditor } = require("../services/task-editor");
const { tasksForPage } = require("../services/task-data");
const load = Module._load;
class File { constructor(path) { this.path = path; this.extension = "md"; } }
Module._load = function(name) { return name === "obsidian" ? {
    Plugin: class {}, Modal: class {}, Menu: class {}, Notice: class {}, FuzzySuggestModal: class {},
    TFile: File, TFolder: class {}, normalizePath: p => p
} : load.apply(this, arguments); };
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
try { compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Wizard=ProjectWizardService;", filename); }
finally { Module._load = load; }
const Plugin = compiled.exports, clone = value => JSON.parse(JSON.stringify(value));
async function run() {
 const realNow = Date.now;
 try {
  for (const kind of ["project", "resource"]) {
   let clock = new Date(2026, 8, 24, 23, 40).getTime(), persisted, notifications = 0;
   Date.now = () => clock;
   const day = localISODate(new Date(clock));
   const root = kind === "project" ? "Projects/A" : "Resources/Knowledge";
   const context = { projectId: kind === "project" ? "a" : "resource:study", name: "Knowledge", root,
    path: root + "/Home.md", contextKind: kind, resourceType: kind === "resource" ? "study" : null };
   const file = new File(root + "/Tasks.md");
   let content = "- [ ] Assignment 5\n    - [ ] 1a\n    - [ ] 2b\n    - [x] Previously checked\n- [ ] Review lecture 7\n";
   const wizard = Object.assign(Object.create(Plugin.Wizard.prototype), {
    completedTaskHistory: [], completedTaskChecks: [], data: {}, getContextForPath: () => context,
    store: { save: async data => { persisted = clone(data); } }
   });
   const plugin = Object.assign(new Plugin(), { projectWizard: wizard, dataStore: wizard.store,
    app: { vault: { getAbstractFileByPath: p => p === file.path ? file : null,
     read: async () => content, process: async (_file, update) => { content = update(content); } }, plugins: { plugins: {} } },
    notifyCompletedTasksChanged: () => notifications++, markProjectChangedByPath() {} });
   plugin.taskEditor = new HubTaskEditor(plugin);
   const parent = () => readTaskSnapshot(content, { path: file.path, line: 0, text: content.split("\n")[0].replace(/^- \[[^\]]\] /, "") });
   const step = (index, completed) => { const task = parent(); return plugin.mutateTask({ ...task,
    operation: "step", step: task.steps[index], stepCompleted: completed }); };
   const evidence = date => captureReportContext(wizard, date, context.projectId).tasks;

   // Timestamp is captured at invocation, even if a prior queued write takes time.
   let release; plugin.taskMutationQueue = new Promise(resolve => { release = resolve; });
   const actionTime = clock, pending = step(1, true); clock += 90000; release(); await pending;
   assert.equal(wizard.completedTaskHistory.length, 1);
   assert.equal(wizard.completedTaskHistory[0].timestamp, actionTime);
   assert.equal(notifications, 1);
   assert.equal(evidence(day)[0].kind, "step");
   assert.equal(evidence(day)[0].parentText, "Assignment 5");
   assert.equal(evidence(day)[0].text, "2b");
   assert.ok(parent().hubTaskId && parent().steps[1].hubTaskId);
   assert.equal(parent().completed, false, "Step cannot fulfill an Oathbound parent");
   assert.equal(oathProgress([{ task: parent() }]).allComplete, false, "Oath completion still requires the parent");
   assert.equal(evidence(day).length, 1, "Existing checked Steps are not inferred as progress");
   await step(1, false);
   assert.equal(evidence(day).length, 0);
   assert.equal(wizard.completedTaskChecks.length, 0);
   assert.equal(notifications, 2, "Uncheck refreshes History/report consumers");
   clock += 90000; const latest = clock; await step(1, true);
   assert.equal(evidence(day).length, 1);
   assert.equal(evidence(day)[0].timestamp, latest);
   const recorded = clone(wizard.completedTaskHistory[0]);

   // Reload, reread and repeated checked requests cannot log new events.
   wizard.completedTaskHistory = clone(persisted.completedTaskHistory);
   wizard.completedTaskChecks = clone(persisted.completedTaskChecks);
   for (let repeat = 0; repeat < 3; repeat++) {
    const snapshot = parent();
    tasksForPage({ file: { path: file.path, tasks: [{ ...snapshot, children: snapshot.steps }] } });
   }
   await step(1, true);
   assert.deepEqual(wizard.completedTaskHistory, [recorded]);

   clock += 60000; await plugin.toggleTask(file.path, 4, "Review lecture 7", true);
   clock += 60000; await step(0, true);
   assert.deepEqual(evidence(day).map(item => item.text), ["2b", "Review lecture 7", "1a"]);
   assert.deepEqual(wizard.getCompletedTaskHistory(context.projectId).map(item => item.text), ["1a", "Review lecture 7", "2b"]);

   // Real editor rename, source move and line movement preserve immutable labels.
   let draft = await plugin.taskEditor.read(parent());
   await plugin.taskEditor.save(draft, { ...draft, text: "Assignment renamed",
    steps: draft.steps.map(item => ({ ...item, text: item.text + " renamed" })) });
   assert.deepEqual(wizard.completedTaskHistory.find(item => item.id === recorded.id), recorded);
   file.path = root + "/Moved.md";
   const frozen = savedReportContext(wizard, day, context.projectId);
   clock = new Date(2026, 8, 25, 0, 5).getTime();
   await step(1, false);
   assert.ok(!wizard.completedTaskHistory.some(item => item.id === recorded.id), "Uncheck after midnight removes the original day's event by stable ID");
   assert.equal(evidence(localISODate(new Date(clock))).length, 0);
   assert.equal(savedReportContext(wizard, day, context.projectId, frozen).tasks.length, 3, "Finalized past evidence remains a snapshot");
   await step(1, true);
   const beforeParent = clone(wizard.completedTaskHistory.filter(item => item.kind === "step"));
   clock += 60000; await plugin.toggleTask(file.path, 0, parent().text, true, parent().hubTaskId);
   assert.deepEqual(wizard.completedTaskHistory.filter(item => item.kind === "step"), beforeParent);
   assert.equal(wizard.completedTaskHistory.filter(item => item.kind === "task").length, 2);
   await plugin.toggleTask(file.path, 0, parent().text, false, parent().hubTaskId);
   assert.deepEqual(wizard.completedTaskHistory.filter(item => item.kind === "step"), beforeParent);
   clock += 60000; await plugin.toggleTask(file.path, 0, parent().text, true, parent().hubTaskId);
   const beforeClear = clone(wizard.completedTaskHistory);
   clock += 86400000;
   await plugin.clearCompletedTasks([{ ...parent(), projectId: context.projectId }]);
   assert.deepEqual(wizard.completedTaskHistory, beforeClear, "Clearing after midnight never timestamps or duplicates Step events");
   assert.equal(wizard.completedTaskChecks.filter(item => item.kind === "step").length, 0);

   content = "- [ ] Delete me\n    - [ ] Step\n";
   await step(0, true);
   const beforeDelete = clone(wizard.completedTaskHistory);
   draft = await plugin.taskEditor.read(parent());
   await plugin.taskEditor.save(draft, { operation: "delete" });
   assert.deepEqual(wizard.completedTaskHistory, beforeDelete, "Deleting incomplete parent retains completed Step snapshot");
   assert.equal(content, "");

   // Editor check/save timestamps, and subsequent unchecking in that same editor.
   content = "- [ ] Editor parent\n    - [ ] Editor step\n";
   draft = await plugin.taskEditor.read(parent());
   const checkedAt = clock - 10000;
   await plugin.taskEditor.save(draft, { ...draft, steps: [{ ...draft.steps[0], completed: true, completedAt: checkedAt }] });
   assert.equal(wizard.completedTaskHistory[0].timestamp, checkedAt);
   const editorRecord = wizard.completedTaskHistory[0].id;
   draft = await plugin.taskEditor.read(parent());
   await plugin.taskEditor.save(draft, { ...draft, steps: [{ ...draft.steps[0], completed: false }] });
   assert.ok(!wizard.completedTaskHistory.some(item => item.id === editorRecord));

   // An old record/check pair has no kind or stable ID; its uncheck still reverses it.
   content = "- [x] Legacy\n";
   wizard.completedTaskHistory.push({ id: "legacy", text: "Legacy", path: file.path, projectId: context.projectId, timestamp: clock });
   wizard.completedTaskChecks.push({ historyId: "legacy", text: "Legacy", path: file.path, line: 0, timestamp: clock });
   assert.equal(evidence(localISODate(new Date(clock))).at(-1).text, "Legacy");
   await plugin.toggleTask(file.path, 0, "Legacy", false);
   assert.ok(!wizard.completedTaskHistory.some(item => item.id === "legacy"));
   assert.deepEqual(captureReportContext(wizard, "2000-01-01", context.projectId).tasks, []);

   // A checked parent that gains an ID through its Step can move before clearing.
   content = "- [ ] Movable parent\n    - [ ] Child\n";
   await plugin.toggleTask(file.path, 0, "Movable parent", true);
   await step(0, true);
   const beforeMoveClear = clone(wizard.completedTaskHistory);
   file.path = root + "/MovedAgain.md";
   await plugin.clearCompletedTasks([{ ...parent(), projectId: context.projectId }]);
   assert.deepEqual(wizard.completedTaskHistory, beforeMoveClear);

   const historyBeforeFailure = clone(wizard.completedTaskHistory), checksBeforeFailure = clone(wizard.completedTaskChecks);
   const save = wizard.store.save;
   wizard.store.save = async () => { throw Error("History disk failure"); };
   await assert.rejects(wizard.recordTaskMutation({ changed: true, operation: "step", path: file.path, tasks: [],
    progressTransitions: [{ kind: "step", hubTaskId: "failure-step", parentTaskId: "failure-parent", parentText: "Parent", text: "Step", line: 1, completed: true }]
   }, context, clock), /History disk failure/);
   assert.deepEqual(wizard.completedTaskHistory, historyBeforeFailure);
   assert.deepEqual(wizard.completedTaskChecks, checksBeforeFailure);
   wizard.store.save = save;

   // A Tasks-plugin recurrence can insert an unchecked successor before the checked row.
   content = "- [ ] Recurring\n";
   plugin.app.plugins.plugins["obsidian-tasks-plugin"] = { apiV1: { executeToggleTaskDoneCommand: () => "- [ ] Next recurrence\n- [x] Recurring" } };
   await plugin.toggleTask(file.path, 0, "Recurring", true);
   const recurring = wizard.completedTaskHistory[0];
   assert.equal(recurring.line, 1);
   assert.equal(wizard.getCompletedTaskHistoryId(file.path, 1, "Recurring"), recurring.id);
   const beforeRecurrenceClear = clone(wizard.completedTaskHistory);
   await plugin.clearCompletedTasks([{ path: file.path, line: 1, text: "Recurring", projectId: context.projectId }]);
   assert.deepEqual(wizard.completedTaskHistory, beforeRecurrenceClear);
   assert.equal(content, "- [ ] Next recurrence\n");
  }
 } finally { Date.now = realNow; }
 console.log("PASS: shared Task progress lifecycle, exact queued action timestamps, uncheck/recheck, mixed chronology, reload, rename/move, midnight, snapshot compatibility, editor, clear/delete, and parent isolation.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
