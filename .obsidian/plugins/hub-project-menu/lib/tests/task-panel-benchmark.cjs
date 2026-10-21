"use strict";
const fs = require("node:fs"), path = require("node:path"), { createPanelFixture, originalRead } = require("./task-panel-fixture.cjs");
const { createTaskPanelRead, panelTaskFacts } = require("../services/task-panel-read");
const { taskGroups } = require("../domain/task-planning");
const original = fs.readFileSync(path.join(__dirname, "task-panel-original.cjs"), "utf8");
const measure = async work => { const start = performance.now(), value = await work(); return { ms: +(performance.now() - start).toFixed(3), value }; };
async function run(count, facade) {
    const f = createPanelFixture(), cleanups = [];
    for (const page of f.pages.values()) { page.file.tasks = []; page.file.lists = []; }
    for (let index = 0; index < count; index++) f.addTask(`Projects/App/Tasks/Batch ${Math.floor(index / 10)}.md`, `Task ${index}`, `bench-${index}`, {
        metadata: { dueDate: "2026-10-26", necessity: index % 2 ? "must" : "should" }, steps: [{ title: "Step", id: `step-${index}` }] });
    const reader = facade ? createTaskPanelRead({ plugin: f.plugin, component: { register: fn => cleanups.push(fn) }, workspace: { type: "project", id: "app" }, changed() {}, editTask() {} }) : null;
    const read = async () => facade ? (await reader.read()).tasks : originalRead(f, f.projects[0], original);
    try {
        const cold = await measure(read); reader?.accept(cold.value); const coldCounts = { ...f.counts };
        const warm = await measure(async () => { for (let index = 0; index < 20; index++) await read(); }); const warmCounts = { ...f.counts };
        f.plugin.taskData.invalidateAll(); f.flush(); if (!facade) f.plugin.taskData.invalidateAll();
        const invalidated = await measure(read), afterCounts = { ...f.counts };
        const preparation = await measure(() => { for (let index = 0; index < 3; index++) { taskGroups(cold.value, f.now()); cold.value.map(panelTaskFacts); } });
        const switching = await measure(async () => {
            for (const owner of [f.resources[0], f.projects[1], f.projects[0]]) {
                if (!facade) originalRead(f, owner, original);
                else {
                    const view = createTaskPanelRead({ plugin: f.plugin, component: { register() {} }, workspace: { type: owner.contextKind === "resource" ? "resource" : "project", id: owner.resourceType ?? owner.projectId }, changed() {}, editTask() {} });
                    await view.read(); view.close();
                }
            }
        });
        if (f.counts.writes) throw Error("Benchmark wrote task data");
        return { tasks: count, implementation: facade ? "facade panel" : "original dashboard reader", initialMs: cold.ms, cachedMeanMs: +(warm.ms / 20).toFixed(3),
            invalidationMs: invalidated.ms, threeWorkspaceSwitchesMs: switching.ms, threeRenderPreparationsMs: preparation.ms,
            coldCounts, cachedExtraIndexes: warmCounts.indexes - coldCounts.indexes, cachedExtraSources: warmCounts.sources - coldCounts.sources,
            invalidationExtraIndexes: afterCounts.indexes - warmCounts.indexes, switchExtraIndexes: f.counts.indexes - afterCounts.indexes,
            finalCounts: f.counts, globalIdentityPassesPerColdRead: facade ? 2 : 1 };
    } finally { reader?.close(); await f.close(); }
}
(async () => { const results = []; for (const count of [100, 1000, 5000]) results.push(await run(count, false), await run(count, true));
    console.log(JSON.stringify({ node: process.versions.node, timezone: process.env.TZ, results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
