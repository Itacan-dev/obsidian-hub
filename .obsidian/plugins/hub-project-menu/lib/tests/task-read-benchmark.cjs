"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const original = Module._load;
Module._load = function(name) { return name === "obsidian" ? { Modal: class {}, Component: class {}, setIcon() {} } : original.apply(this, arguments); };
const { DailyBriefService } = require("../services/daily-brief");
const backup = process.argv[2]; if (!backup) throw Error("Supply the captured original Daily Brief source.");
const filename = path.resolve(__dirname, "../services/daily-brief.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(backup, "utf8"), filename); Module._load = original;
const OldBrief = compiled.exports.DailyBriefService;
const { createReadFixture } = require("./task-read-fixture.cjs");
const { TaskReadSession } = require("../services/task-read-session");
const { legacyReadTask } = require("../services/task-service-legacy-bridge");
const { filterTasks, upcomingGroups, calendarRange } = require("../domain/task-views");
const measure = async work => { const started = performance.now(); const result = await work(); return { ms: +(performance.now() - started).toFixed(3), result }; };
function seed(count) {
    const f = createReadFixture();
    for (const [name, page] of f.pages) { page.file.tasks = []; page.file.lists = []; f.contents.set(name, "# Synthetic\n"); }
    for (let i = 0; i < count; i++) f.addTask(`Projects/App/Tasks/Batch ${Math.floor(i / 10)}.md`, `Task ${i}`, `bench-${i}`, { metadata: { dueDate: "2026-10-26" } });
    return f;
}
async function brief(count, Constructor, name) {
    const f = seed(count), service = new Constructor(f.plugin, { now: f.now });
    try {
        const cold = await measure(() => service.context()), coldCounts = { ...f.counts };
        const warm = await measure(async () => { for (let i = 0; i < 3; i++) await service.context(); });
        const warmCounts = { ...f.counts }; f.plugin.taskData.invalidateAll(); f.flush();
        const rebuild = await measure(() => service.context());
        return { name, tasks: count, initialMs: cold.ms, cachedMeanMs: +(warm.ms / 3).toFixed(3), afterInvalidationMs: rebuild.ms,
            coldCounts, cachedExtraIndexScans: warmCounts.indexes - coldCounts.indexes, cachedExtraSourceReads: warmCounts.sources - coldCounts.sources, finalCounts: { ...f.counts } };
    } finally { service.destroy(); await f.close(); }
}
async function schedule(count, facade) {
    const f = seed(count), session = facade ? new TaskReadSession(f.plugin.taskService) : null;
    const options = { workspace: { type: "project", id: "app" }, policy: "workspace", validation: "indexed" };
    const read = async () => facade ? (await session.read(options)).rows.filter(row => row.view).map(row => legacyReadTask(row.view)) : f.plugin.taskData.readWorkspace(f.dv, f.projects[0]);
    try {
        const cold = await measure(read), coldCounts = { ...f.counts };
        const cached = await measure(async () => { for (let i = 0; i < 20; i++) { if (facade) await session.read(options); else void cold.result; } });
        const navigation = await measure(() => { for (const mode of ["month", "week", "month"]) {
            const tasks = filterTasks(cold.result, { status: "open" }, f.now()); upcomingGroups(tasks, f.now()); calendarRange(f.now(), mode);
        } });
        const warmCounts = { ...f.counts }; f.plugin.taskData.invalidateAll(); f.flush();
        const rebuilt = await measure(read);
        return { name: facade ? "facade Schedule" : "original Schedule", tasks: count, initialMs: cold.ms,
            cachedMeanMs: +(cached.ms / 20).toFixed(3), threeViewChangesMs: navigation.ms, afterInvalidationMs: rebuilt.ms,
            coldCounts, cachedExtraIndexScans: warmCounts.indexes - coldCounts.indexes, cachedExtraSourceReads: warmCounts.sources - coldCounts.sources, finalCounts: { ...f.counts } };
    } finally { session?.close(); await f.close(); }
}
(async () => { const results = [];
    for (const count of [100, 1000, 5000]) results.push(await brief(count, OldBrief, "original Daily Brief"), await brief(count, DailyBriefService, "facade Daily Brief"),
        await schedule(count, false), await schedule(count, true));
    process.stdout.write(JSON.stringify({ node: process.versions.node, timezone: process.env.TZ, results }, null, 2) + "\n");
})().catch(error => { console.error(error); process.exitCode = 1; });
