"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), { spawn } = require("node:child_process"), { performance } = require("node:perf_hooks");
async function child(args, audit, name) {
    const p = spawn(process.execPath, [...process.execArgv, ...args], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = "", stderr = ""; const start = performance.now();
    p.stdout.on("data", b => stdout += b); p.stderr.on("data", b => stderr += b);
    const exit = await new Promise((resolve, reject) => { p.once("error", reject); p.once("exit", (code, signal) => resolve({ code, signal })); });
    const record = { executable: process.execPath, arguments: [...process.execArgv, ...args], pid: p.pid, ...exit, elapsedMs: performance.now() - start, stdout, stderr };
    await fs.writeFile(path.join(audit, name + ".run.json"), JSON.stringify(record, null, 2)); await fs.writeFile(path.join(audit, name + ".out.log"), stdout); await fs.writeFile(path.join(audit, name + ".err.log"), stderr);
    if (exit.code !== 0 || exit.signal) throw Error(name + " failed: " + stderr); return record;
}
async function main(args = process.argv.slice(2)) {
    const [mode, audit, ...selected] = args, F = require("./fixtures.cjs"); await F.auditRoot(audit);
    if (mode === "baseline") return child([path.join(__dirname, "../demo/benchmark.cjs"), "100", "1000", "10000"], audit, "unchanged-baseline");
    if (mode === "prepare") { const records = []; for (const count of selected.length ? selected.map(Number) : [100, 1000, 10000]) { records.push(await F.prepare(audit, count)); await fs.writeFile(path.join(audit, "baselines.json"), JSON.stringify(records, null, 2)); } return; }
    const baselines = JSON.parse(await fs.readFile(path.join(audit, "baselines.json"), "utf8"));
    const all = ["list", "editor", "save-noop", "save-necessity", "save-title", "save-description", "save-date", "save-content", "save-step-title", "save-step-add", "save-step-delete", "save-nested", "save-parent-complete", "complete", "reopen", "rich-simple", "rich-tree", "metadata-v1", "ordinary-create"];
    const jobs = [];
    if (mode === "pilot") { for (const scenario of ["list", "save-noop", "complete", "metadata-v1", "rich-tree"]) jobs.push({ baseline: baselines[0], scenario, mode: scenario === "metadata-v1" ? "application" : "full", instrument: true, sample: 0 }); }
    else if (mode === "diagnose") for (const baseline of baselines) for (const scenario of all) for (let sample = 0; sample < (baseline.count === 10000 ? 1 : 3); sample++) jobs.push({ baseline, scenario, mode: scenario === "metadata-v1" || scenario === "ordinary-create" ? "application" : "full", instrument: true, sample });
    else if (mode === "boundaries") for (const baseline of baselines) for (const scenario of ["complete", "save-title", "save-noop", "metadata-v1", "rich-simple"]) for (const boundary of ["native", "application"]) jobs.push({ baseline, scenario, mode: boundary, instrument: true, sample: 0 });
    else if (mode === "profiles") for (const baseline of baselines.filter(b => b.count >= 1000)) for (const scenario of ["list", "editor", "complete", "save-title"]) jobs.push({ baseline, scenario, mode: "full", instrument: true, profile: true, sample: 0 });
    else if (mode === "calibrate") for (const baseline of baselines.filter(b => b.count >= 1000)) for (const scenario of ["list", "complete", "save-title"]) for (let sample = 0; sample < (baseline.count === 1000 ? 3 : 1); sample++) jobs.push({ baseline, scenario, mode: "full", instrument: false, sample });
    else if (mode === "http") for (const baseline of baselines) for (const scenario of ["http-editor", "http-save"]) jobs.push({ baseline, scenario, mode: "http", instrument: true, sample: 0 });
    else if (mode === "plain-boundaries") for (const baseline of baselines) for (const scenario of ["complete", "save-title", "rich-simple"]) for (const boundary of ["native", "application"]) jobs.push({ baseline, scenario, mode: boundary, instrument: false, sample: 0 });
    else throw Error("Unknown profiling mode");
    for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i], name = mode + "-" + j.baseline.count + "-" + j.scenario + "-" + j.mode + "-" + j.sample, options = { ...j, audit, output: path.join(audit, name + ".json") }, file = path.join(audit, name + ".input.json");
        if (selected.includes("--resume")) { const prior = await fs.readFile(options.output, "utf8").then(JSON.parse, () => null); if (prior && (!j.instrument || prior.instrumentationVersion === 2)) { process.stdout.write(JSON.stringify({ reusedUnchangedSample: name }) + "\n"); continue; } }
        await fs.writeFile(file, JSON.stringify(options)); const result = await child(["--expose-gc", path.join(__dirname, "worker.cjs"), file], audit, name); process.stdout.write(JSON.stringify({ mode, progress: i + 1, total: jobs.length, ...JSON.parse(result.stdout) }) + "\n");
    }
}
if (require.main === module) main().catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; });
module.exports = { main, child };
