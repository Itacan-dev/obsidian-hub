"use strict";
const { performance } = require("node:perf_hooks");
const fs = require("node:fs/promises"), path = require("node:path");
const { fixture, owners, mutate, randomUUID } = require("./support.cjs");
const { decodeManifest } = require("../src/json-repository");
const { NodeDirectory } = require("../src/node-directory");
const rounded = value => Math.round(value * 1000) / 1000;
async function measure(kind, count) {
    const started = performance.now(), f = await fixture(kind, null); const initMs = performance.now() - started;
    try {
        let r = f.repo;
        const tasks = Array.from({ length: count }, (_, i) => ({ id: randomUUID(), owner: i % 2 ? owners.resource : owners.a, title: `Synthetic ${i} Å`, description: "Synthetic data only.", due: { date: `2026-10-${String(i % 28 + 1).padStart(2, "0")}`, time: null } }));
        let time = performance.now(); await r.execute({ type: "task.createMany", operationId: "synthetic-benchmark-seed", payload: { tasks } }); const seedBatchMs = performance.now() - time;
        time = performance.now(); for (let i = 0; i < 100; i++) r.getTask(tasks.at(-1).id); const getByIdMs = (performance.now() - time) / 100;
        time = performance.now(); const ownerCount = r.queryTasks({ owner: owners.a }).length; const queryOwnerMs = performance.now() - time;
        time = performance.now(); const dueCount = r.queryTasks({ due: { from: "2026-10-10", to: "2026-10-12" } }).length; const queryDueMs = performance.now() - time;
        const task = r.getTask(tasks[0].id); time = performance.now(); await r.execute(mutate(task, "task.update", { patch: { title: "Updated synthetic task" } })); const updateCommitMs = performance.now() - time;
        await r.close(); time = performance.now(); r = await f.reopen(); const reopenMs = performance.now() - time;
        if (r.queryTasks().length !== count) throw Error("Benchmark restart count mismatch");
        let generationBytes = null, directoryFsync = null;
        if (kind === "json") {
            const manifest = decodeManifest(await fs.readFile(path.join(f.directory, "CURRENT.json"), "utf8"));
            generationBytes = (await fs.stat(path.join(f.directory, manifest.current.file))).size;
            directoryFsync = await new NodeDirectory(f.directory).syncDirectory();
        }
        return { adapter: kind, tasks: count, initMs: rounded(initMs), seedBatchMs: rounded(seedBatchMs), getByIdMs: rounded(getByIdMs),
            queryOwnerMs: rounded(queryOwnerMs), queryDueMs: rounded(queryDueMs), updateCommitMs: rounded(updateCommitMs), reopenMs: rounded(reopenMs), ownerCount, dueCount, generationBytes, directoryFsync };
    } finally { await f.cleanup(); }
}
(async () => {
    process.stdout.write(JSON.stringify({ runtime: process.versions.node, platform: process.platform, note: "Single synthetic run; batch seeding is not 10,000 individual creates." }) + "\n");
    for (const count of [100, 1000, 10000]) for (const kind of ["memory", "json"]) process.stdout.write(JSON.stringify(await measure(kind, count)) + "\n");
})().catch(error => { process.stderr.write(error.stack + "\n"); process.exitCode = 1; });
