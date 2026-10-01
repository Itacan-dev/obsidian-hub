"use strict";
const assert = require("assert");
const { ProjectPlanningService } = require("../services/project-planning");
const { HubTaskEditor } = require("../services/task-editor");
const { HubTaskDataService } = require("../services/task-data");
const { readTaskSnapshot } = require("../domain/task-planning");
const { taskLineDetails } = require("../domain/tasks");
const { roadmapRange, phasePlacement, phaseValues, milestoneValues } = require("../domain/project-planning");

(async () => {
    const project = { root: "Projects/App", projectId: "p1", contextKind: "project" };
    const resource = { root: "Resources/Knowledge", projectId: "r1", contextKind: "resource" };
    const other = { root: "Projects/Other", projectId: "p2", contextKind: "project" };
    const files = new Map(), contents = new Map();
    for (const owner of [project, resource, other]) {
        files.set(owner.root, { path: owner.root, children: [] });
        const path = owner.root + "/Tasks.md";
        files.set(path, { path, extension: "md" });
        contents.set(path, "- [ ] First task\r\n    - [x] Existing step\r\n- [ ] Second task\r\n");
    }
    let disk, fail = false, records = 0, activity = 0, oath = 0, invalidations = 0;
    const wizard = { data: { taskMetadata: {}, history: [{ preserved: true }] },
        getProjectById: id => [project, other].find(item => item.projectId === id),
        getProjectRecords: () => [project, other], getResourceTypes: () => [resource],
        getContextForPath: path => [project, resource, other].find(item => path === item.root || path.startsWith(item.root + "/")),
        recordTaskMutation: async () => { records++; } };
    const plugin = { projectWizard: wizard, app: { vault: {
        getAbstractFileByPath: path => files.get(path), getMarkdownFiles: () => [...files.values()].filter(f => f.extension),
        read: async file => contents.get(file.path), process: async (file, fn) => contents.set(file.path, fn(contents.get(file.path)))
    } }, register() {}, enqueueTaskMutation(fn) { const work = (this.queue ?? Promise.resolve()).then(fn); this.queue = work.catch(() => {}); return work; },
        dataStore: { save: async data => { if (fail) throw Error("Disk conflict"); disk = JSON.parse(JSON.stringify(data)); } },
        markProjectChangedByPath() { activity++; }, oath: { changed() { oath++; } } };
    const editor = plugin.taskEditor = new HubTaskEditor(plugin);
    const data = plugin.taskData = new HubTaskDataService(plugin.app, { metadata: id => editor.metadata(id) });
    data.invalidate = () => { invalidations++; };
    const service = plugin.planning = new ProjectPlanningService(plugin);
    const pages = () => [...contents].map(([path, text]) => {
        const tasks = [];
        text.split(/\r?\n/).forEach((line, index) => {
            const details = taskLineDetails(line); if (!details || /^\s/.test(line)) return;
            const snapshot = readTaskSnapshot(text, { path, line: index, text: details.text });
            const children = snapshot.steps.map(step => ({ ...step, path, task: true, parent: index, children: [] }));
            tasks.push({ ...snapshot, text: details.text, children }, ...children);
        }); return { file: { path, tasks } };
    });
    const dv = { pages: () => ({ array: pages }) };
    const task = (index = 0) => service.tasks(dv, "p1")[index];
    const values = { name: "Research", start: "2026-09-01", end: "2026-10-15", description: "Explore options" };
    assert.throws(() => phaseValues({ ...values, name: " " }), /name/);
    assert.throws(() => phaseValues({ ...values, end: "2026-08-01" }), /End/);
    assert.throws(() => milestoneValues({ name: "Launch", date: "not-a-date" }), /date/);
    const phase = await service.savePhase("p1", values, [{ task: task(), included: true }], 0);
    assert(phase.id); assert.equal(task().phaseId, phase.id);
    assert.equal(service.tasks(dv, "p1").filter(task => task.phaseId === phase.id).length, 1);
    assert(task().hubTaskId); assert(contents.get(project.root + "/Tasks.md").includes("\r\n"));
    assert.equal(task().steps[0].completed, true); assert.equal(task().completed, false);
    assert.equal(records + activity + oath, 0, "Phase assignment produces no task completion/activity/Oath events");
    assert.equal(service.phaseFor(task()).name, "Research");
    assert.equal(service.read("p2").phases.length, 0, "Planning is Project-scoped");
    assert(!Object.hasOwn(disk.projectPlanning.p1.phases[0], "tasks"), "No duplicated task list");
    wizard.data = JSON.parse(JSON.stringify(disk));
    assert.equal(new ProjectPlanningService(plugin).read("p1").phases[0].id, phase.id, "Stable planning identities survive reload");
    const overlap = await service.savePhase("p1", { ...values, name: "Architecture", start: "2026-09-10" });
    await service.reorder("p1", overlap.id, -1);
    assert.deepEqual(service.read("p1").phases.map(p => p.id), [overlap.id, phase.id]);
    assert.equal(service.read("p1").phases[0].start, "2026-09-10", "Reordering preserves dates and overlaps");
    const milestone = await service.saveMilestone("p1", { name: "Release", date: "2026-10-20", achieved: false });
    await service.saveMilestone("p1", { ...milestone, achieved: true });
    assert.equal(service.read("p1").milestones[0].achieved, true);
    assert.equal(records + activity + oath, 0, "Achieving a milestone has no task progress semantics");
    await assert.rejects(service.savePhase("p1", { ...phase, name: "Stale" }, [], 0), /changed/);
    const before = JSON.stringify(wizard.data), markdown = contents.get(project.root + "/Tasks.md");
    fail = true;
    await assert.rejects(service.savePhase("p1", { ...values, name: "Rollback" }, [{ task: task(1), included: true }]), /Disk conflict/);
    assert.equal(JSON.stringify(wizard.data), before); assert.equal(contents.get(project.root + "/Tasks.md"), markdown, "Failed save rolls back identity-only Markdown writes");
    fail = false;
    const draft = await editor.read(task());
    await editor.save(draft, { ...draft, phaseId: overlap.id });
    assert.equal(task().phaseId, overlap.id); assert.equal(records + activity + oath, 0, "Phase-only task edits do not create events");
    await assert.rejects(editor.save(draft, { ...draft, phaseId: null }), /metadata changed/);
    await assert.rejects(editor.save(await editor.read(task()), { ...task(), phaseId: "missing" }), /phase is no longer/);
    const resourceTask = data.readWorkspace(dv, resource)[0];
    await assert.rejects(service.savePhase("p1", phase, [{ task: resourceTask, included: true }]), /inside this Project/);
    assert.deepEqual(editor.phases(resource.root), []);
    const snapshot = await editor.read(task());
    await service.remove("p1", "phases", overlap.id);
    assert.equal(task().phaseId, undefined); assert.equal(service.tasks(dv, "p1").length, 2);
    assert.equal(contents.get(project.root + "/Tasks.md"), markdown, "Deleting a phase does not change its tasks");
    await assert.rejects(editor.save(snapshot, { ...snapshot }), /phase is no longer/);
    await service.remove("p1", "milestones", milestone.id);
    assert.equal(service.read("p1").milestones.length, 0);
    assert.equal(records + activity + oath, 0); assert(invalidations > 0);
    assert.deepEqual(wizard.data.history, [{ preserved: true }]);
    const range = roadmapRange(new Date(2026, 8, 30), 6);
    assert.equal(range.total, 181); assert.equal(range.position("2026-09-01"), 0); assert.equal(range.position("2027-03-01"), 100);
    assert.deepEqual(phasePlacement({ start: "2026-08-01", end: "2026-09-01" }, range), { left: 0, width: 100 / range.total });
    assert.equal(phasePlacement({ start: "2027-03-01", end: "2027-03-10" }, range), null);
    data.destroy();
    console.log("PASS: Project planning CRUD/reload/validation/overlaps/manual order, canonical phase links, no task events, stale guards, unlink deletion and rollback.");
})().catch(error => { console.error(error); process.exitCode = 1; });
