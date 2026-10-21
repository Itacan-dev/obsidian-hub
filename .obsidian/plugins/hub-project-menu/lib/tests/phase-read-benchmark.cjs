"use strict";
const { createPhaseFixture, originalPlanning } = require("./phase-read-fixture.cjs");
const { ProjectPlanningService } = require("../services/project-planning");
const { PhaseTaskRead } = require("../services/phase-task-read");
const measure = async work => { const start = performance.now(), value = await work(); return { ms: +(performance.now() - start).toFixed(3), value }; };
async function run(count, facade) {
    const f = createPhaseFixture(facade ? ProjectPlanningService : originalPlanning());
    for (const [path, page] of f.pages) { page.file.tasks = []; page.file.lists = []; f.contents.set(path, "# Synthetic\n"); }
    for (const id of Object.keys(f.plugin.projectWizard.data.taskMetadata)) delete f.plugin.projectWizard.data.taskMetadata[id];
    for (let index = 0; index < count; index++) f.addTask(`Projects/App/Tasks/Batch ${Math.floor(index / 10)}.md`, `Task ${index}`, `bench-${index}`, {
        metadata: index % 4 ? {} : { phaseId: "phase" }, steps: [{ title: "Step", id: `step-${index}` }] });
    const service = f.plugin.planning, draft = facade ? new PhaseTaskRead(service, "app", "phase") : null;
    const read = async () => facade ? (await draft.refresh()).tasks : service.tasks(f.dv, "app");
    try {
        const initial = await measure(read), cold = { ...f.counts };
        const cached = await measure(async () => { for (let index = 0; index < 10; index++) await read(); }), warm = { ...f.counts };
        f.plugin.taskData.invalidateAll(); f.flush(); const invalidated = await measure(read);
        const filtering = await measure(() => { for (const query of ["Task 1", "Task 2", "Batch", "Task 49", "not found"]) {
            const items = facade ? draft.pickerItems() : initial.value.filter(task => !task.identityConflict && task.phaseId !== "phase");
            items.filter(task => (task.text + " · " + task.path).toLowerCase().includes(query.toLowerCase()));
        } });
        const preparation = await measure(() => initial.value.map(task => [task.hubTaskId, task.path, task.line, task.text, task.phaseId ?? null]));
        const beforeSwitch = f.counts.indexes;
        const switching = await measure(async () => { for (const id of ["other", "app", "itacan"]) {
            if (facade) { const other = new PhaseTaskRead(service, id, service.phases(id)[0].id); await other.refresh(); other.close(); }
            else service.tasks(f.dv, id);
        } });
        if (f.counts.writes || f.counts.sources) throw Error("Discovery unexpectedly wrote/read Markdown sources");
        return { tasks: count, implementation: facade ? "facade Phase session" : "original planning reader", initialMs: initial.ms,
            cachedMeanMs: +(cached.ms / 10).toFixed(3), invalidationMs: invalidated.ms, fiveFiltersMs: filtering.ms, preparationMs: preparation.ms,
            threeProjectSwitchesMs: switching.ms, cold, cachedExtraIndexes: warm.indexes - cold.indexes, switchExtraIndexes: f.counts.indexes - beforeSwitch,
            globalIdentityPassesPerRead: facade ? 2 : 1, finalCounts: f.counts };
    } finally { draft?.close(); await f.close(); }
}
(async () => { const results = []; for (const count of [100, 1000, 5000]) results.push(await run(count, false), await run(count, true)); console.log(JSON.stringify({ node: process.versions.node, timezone: process.env.TZ, results }, null, 2)); })()
    .catch(error => { console.error(error); process.exitCode = 1; });
