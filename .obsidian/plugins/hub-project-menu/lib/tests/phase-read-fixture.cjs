"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { createPanelFixture } = require("./task-panel-fixture.cjs");
const { taskFacts } = require("./task-read-fixture.cjs");
const { ProjectPlanningService } = require("../services/project-planning");
function originalPlanning() {
    const filename = path.resolve(__dirname, "../services/project-planning.js"), module = new Module(filename);
    module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
    module._compile(fs.readFileSync(path.join(__dirname, "phase-read-planning-original.cjs"), "utf8"), filename);
    return module.exports.ProjectPlanningService;
}
function createPhaseFixture(Constructor = ProjectPlanningService) {
    const f = createPanelFixture(), data = f.plugin.projectWizard.data;
    data.projectPlanning = {};
    for (const owner of f.projects) data.projectPlanning[owner.projectId] = { revision: 3, phases: [
        { id: owner.projectId === "app" ? "phase" : "phase-" + owner.projectId, name: "Research", start: "2026-10-01", end: "2026-11-01", description: "Existing description", order: 0 },
        { id: "other-" + owner.projectId, name: "Review", start: "2026-11-01", end: "2026-12-01", description: "", order: 1 }
    ], milestones: [{ id: "milestone-" + owner.projectId, name: "Launch", date: "2026-11-10", achieved: false }] };
    data.taskMetadata.timed.phaseId = "phase"; data.taskMetadata.rich.phaseId = "phase";
    data.taskMetadata.due.phaseId = "other-app";
    for (const owner of f.projects.slice(1)) (data.taskMetadata["owner-" + owner.projectId] ??= {}).phaseId = "phase-" + owner.projectId;
    f.plugin.planning = new Constructor(f.plugin);
    return f;
}
function candidateFacts(tasks, state, phaseId) {
    return { tasks: tasks.map(taskFacts), selected: tasks.filter(task => task.phaseId === phaseId).map(task => task.hubTaskId ?? task.path + ":" + task.line),
        picker: tasks.filter(task => !task.identityConflict && task.phaseId !== phaseId).map(task => ({ id: task.hubTaskId ?? task.path + ":" + task.line,
            label: task.text + " · " + task.path + (state.phases.find(phase => phase.id === task.phaseId) ? " · " + state.phases.find(phase => phase.id === task.phaseId).name : "") })) };
}
module.exports = { createPhaseFixture, originalPlanning, candidateFacts };
if (require.main === module) {
    if (process.argv[2] !== "--record-original") throw Error("Explicit original recording required");
    for (const [source, destination] of [["services/project-planning.js", "phase-read-planning-original.cjs"], ["ui/planning-editor.js", "phase-read-editor-original.cjs"]]) {
        const target = path.join(__dirname, destination), original = path.resolve(__dirname, "..", source);
        if (fs.existsSync(target)) { if (!fs.readFileSync(target).equals(fs.readFileSync(original))) throw Error("Refusing to replace captured source"); }
        else fs.copyFileSync(original, target);
    }
    const f = createPhaseFixture(originalPlanning()), before = f.state();
    const records = f.projects.map(owner => ({ id: owner.projectId, facts: candidateFacts(f.plugin.planning.tasks(f.dv, owner.projectId), f.plugin.planning.read(owner.projectId),
        f.plugin.planning.phases(owner.projectId)[0].id) }));
    if (before !== f.state() || f.counts.writes) throw Error("Read changed synthetic data");
    fs.writeFileSync(path.join(__dirname, "phase-read-baseline.json"), JSON.stringify(records, null, 2) + "\n");
    console.log("Captured original planning candidates, assignments, labels/order and writer source for four Projects"); f.close();
}
