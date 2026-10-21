"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { createSearchFixture } = require("./context-search-fixture.cjs");
const { ContextSearchService } = require("../services/context-search");
const source = path.resolve(__dirname, "../services/context-search.js");
const backup = process.argv[2];
if (!backup) throw Error("Supply the explicitly captured pre-integration Search source backup.");
const compiled = new Module(source, module); compiled.filename = source; compiled.paths = Module._nodeModulePaths(path.dirname(source));
compiled._compile(fs.readFileSync(backup, "utf8"), source);
const LegacySearch = compiled.exports.ContextSearchService;
const time = async work => { const start = performance.now(); const result = await work(); return { ms: +(performance.now() - start).toFixed(3), result }; };
function seed(count) {
    const f = createSearchFixture();
    for (const [name, page] of f.pages) { page.file.tasks = []; page.file.lists = []; f.contents.set(name, "# Synthetic\n"); }
    f.plugin.projectWizard.data.taskMetadata = {};
    for (let i = 0; i < count; i++) f.addTask(`Projects/App/Meta/Bench ${String(Math.floor(i / 10)).padStart(4, "0")}.md`, `Synthetic task ${String(i).padStart(5, "0")}`, `bench-${i}`);
    return f;
}
async function scenario(count, name, Search) {
    const f = seed(count), service = new Search(f.plugin, { onTaskDiagnostics() {} });
    try {
        const cold = await time(() => service.snapshot(f.dv));
        const coldCounts = { ...f.counts };
        const warm = await time(async () => { for (let i = 0; i < 20; i++) await service.snapshot(f.dv); });
        f.plugin.taskData.invalidateAll(); f.flush();
        const rebuild = await time(() => service.snapshot(f.dv));
        const search = await time(() => service.search("synthetic task", null, f.dv));
        const beforeWarmSearch = { ...f.counts };
        const warmSearch = await time(async () => { for (const term of ["synthetic", "task", "task 00001"]) await service.search(term, null, f.dv); });
        return { adapter: name, tasks: count, coldSnapshotMs: cold.ms, warmSnapshotMeanMs: +(warm.ms / 20).toFixed(3), rebuildMs: rebuild.ms,
            coldSearchMs: search.ms, threeWarmSearchesMs: warmSearch.ms, coldCounts, finalCounts: { ...f.counts },
            extraWarmIndexScans: f.counts.indexes - beforeWarmSearch.indexes, extraWarmNoteReads: f.counts.notes - beforeWarmSearch.notes };
    } finally { await f.close(); }
}
async function strict(count) {
    const f = seed(count);
    try { const measured = await time(() => f.plugin.taskService.queryOwned({ type: "project", id: "app" }));
        return { adapter: "Phase 2B-1 strict source query", tasks: count, queryMs: measured.ms, rows: measured.result.length, counts: f.counts };
    } finally { await f.close(); }
}
(async () => {
    const results = [];
    for (const count of [100, 1000, 5000]) {
        results.push(await scenario(count, "pre-integration Search", LegacySearch));
        results.push(await scenario(count, "facade display Search", ContextSearchService));
        if (count <= 1000) results.push(await strict(count));
    }
    process.stdout.write(JSON.stringify({ node: process.versions.node, results }, null, 2) + "\n");
})().catch(error => { console.error(error); process.exitCode = 1; });
