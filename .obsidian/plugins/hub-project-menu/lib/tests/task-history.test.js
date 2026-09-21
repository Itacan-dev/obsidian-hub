"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), Module = require("module");
const load = Module._load;
class FakeFile { constructor(path) { this.path = path; } }
Module._load = function(name) {
    if (name === "obsidian") {
        class Base {}
        return { Plugin: Base, Modal: Base, Menu: Base, Notice: Base, FuzzySuggestModal: Base, TFile: FakeFile, TFolder: Base, normalizePath: p => p };
    }
    return load.apply(this, arguments);
};
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Wizard = ProjectWizardService;", filename);
Module._load = load;
const Plugin = compiled.exports;
async function run() {
 for (const kind of ["project", "resource"]) {
    const plugin = new Plugin(), wizard = Object.create(Plugin.Wizard.prototype);
    plugin.projectWizard = wizard;
    wizard.completedTaskHistory = []; wizard.completedTaskChecks = []; wizard.data = {};
    let persisted;
    wizard.store = { save: async data => { persisted = JSON.parse(JSON.stringify(data)); } };
    const root = kind === "project" ? "Projects/A" : "Resources/Knowledge";
    const context = { projectId: kind === "project" ? "a" : "resource:study", name: "A", root, path: root + "/A.md", contextKind: kind, resourceType: kind === "resource" ? "study" : null };
    wizard.getContextForPath = () => context;
    const file = new FakeFile(root + "/Tasks.md");
    let content = "- [ ] First\n- [ ] Second\n", notifications = 0;
    plugin.app = {
        vault: {
            getAbstractFileByPath: p => p === file.path ? file : null,
            process: async (_file, callback) => { content = callback(content); },
            read: async () => content
        },
        plugins: { plugins: { "obsidian-tasks-plugin": { apiV1: { executeToggleTaskDoneCommand: line =>
            line.includes("[ ]") ? line.replace("[ ]", "[x]") : line.replace("[x]", "[ ]") } } } }
    };
    plugin.notifyCompletedTasksChanged = () => notifications++;
    plugin.markProjectChangedByPath = () => {};
    await Promise.all([plugin.toggleTask(file.path, 0, "First", true), plugin.toggleTask(file.path, 0, "First", true)]);
    assert.equal(wizard.completedTaskHistory.length, 1, "Concurrent/idempotent completion logs exactly once");
    assert.equal(notifications, 1, "History panels notified immediately");
    assert.equal(wizard.completedTaskHistory[0].projectId, context.projectId);
    const completionId = wizard.completedTaskHistory[0].id;
    await plugin.mutateTask({ path: file.path, line: 0, text: "First", operation: "edit", value: "Edited done" });
    assert.equal(wizard.getCompletedTaskHistoryId(file.path, 0, "Edited done"), completionId);
    assert.equal(wizard.completedTaskHistory.length, 1, "Editing completed text does not log again");
    for (const position of ["above", "below"]) {
        const added = await plugin.mutateTask({ path: file.path, line: 0, text: "Edited done", operation: "add", position, value: "New" });
        assert.equal(wizard.completedTaskHistory.length, 1, "Insertion does not create History");
        assert.equal(wizard.getCompletedTaskHistoryId(file.path, position === "above" ? 1 : 0, "Edited done"), completionId);
        await plugin.mutateTask({ ...added.tasks[0], operation: "delete" });
    }
    assert.equal(wizard.completedTaskHistory.length, 1, "Deleting unchecked task does not create History");
    await plugin.clearCompletedTasks([{ path: file.path, line: 0, text: "Edited done", projectId: context.projectId }]);
    assert.equal(wizard.completedTaskHistory.length, 1, "Clear does not duplicate completion History");
    assert.equal(wizard.completedTaskChecks.length, 0);
    assert.ok(!content.includes("Edited done"));
    await plugin.toggleTask(file.path, 0, "Second", true);
    await plugin.toggleTask(file.path, 0, "Second", false);
    await plugin.toggleTask(file.path, 0, "Second", true);
    assert.equal(wizard.completedTaskHistory.length, 3, "Each real unchecked-to-completed transition logs once");
    wizard.completedTaskHistory = persisted.completedTaskHistory;
    wizard.completedTaskChecks = persisted.completedTaskChecks;
    await plugin.toggleTask(file.path, 0, "Second", true);
    assert.equal(wizard.completedTaskHistory.length, 3, "Reloaded persisted state and repeated checked requests do not duplicate");
    await plugin.mutateTask({ path: file.path, line: 0, text: "Second", operation: "delete" });
    assert.equal(wizard.completedTaskHistory.length, 3, "Deleting a completed source task retains its History");
    plugin.app.plugins.plugins = {};
    content = "- [ ] Parent <!-- hub-task:clear-test -->\n    - [x] First step\n    - [ ] Second step\n- [ ] Following task\n";
    wizard.data.taskMetadata = { "clear-test": { necessity: "must", fromDate: null, dueDate: null } };
    plugin.dataStore = wizard.store;
    plugin.taskEditor = new (require("../services/task-editor").HubTaskEditor)(plugin);
    const historyBeforeSteps = wizard.completedTaskHistory.length;
    await plugin.mutateTask({ path: file.path, line: 0, text: "Parent", hubTaskId: "clear-test", operation: "step",
        step: { line: 2, text: "Second step" }, stepCompleted: true });
    assert.ok(content.startsWith("- [ ] Parent") && content.includes("    - [x] Second step"), "Step mutation writes only the nested source checkbox");
    assert.equal(wizard.completedTaskHistory.length, historyBeforeSteps, "Steps never produce independent completion history");
    await plugin.mutateTask({ path: file.path, line: 0, text: "Parent", hubTaskId: "clear-test", operation: "step",
        step: { line: 2, text: "Second step" }, stepCompleted: false });
    await plugin.toggleTask(file.path, 0, "Parent", true, "clear-test");
    assert.ok(content.startsWith("- [x] Parent <!-- hub-task:clear-test -->"), "Native fallback works without Tasks plugin");
    assert.ok(content.includes("    - [ ] Second step"), "Parent completion does not force Steps complete");
    await plugin.toggleTask(file.path, 3, "Following task", true);
    await plugin.clearCompletedTasks([{ path: file.path, line: 0, text: "Parent", projectId: context.projectId }]);
    assert.equal(content, "- [x] Following task\n", "Clear removes parent and its Steps, not following task");
    assert.equal(wizard.data.taskMetadata["clear-test"], undefined, "Clear removes the optional metadata record");
    assert.equal(wizard.completedTaskChecks[0].line, 0, "Completion history source offsets account for all removed Step lines");
 }
 console.log("Task History tests passed: actual plugin mutation/clear paths, exactly-once transitions, immediate notifications, edit/delete/clear behavior, resource ownership and persisted reload state.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
