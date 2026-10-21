"use strict";
const fs = require("node:fs/promises"), path = require("node:path");
function stats(values) { if (!values.length || values.some(v => !Number.isFinite(v))) throw Error("Finite nonempty samples required"); const a = [...values].sort((a, b) => a - b); return { samples: a.length, minMs: a[0], medianMs: a[Math.floor(a.length / 2)], maxMs: a.at(-1), ...(a.length >= 10 ? { p95Ms: a[Math.ceil(a.length * .95) - 1] } : {}) }; }
function cpuSummary(profile) {
    const nodes = new Map(profile.nodes.map(n => [n.id, n])), parents = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parents.set(c, n.id);
    const totals = new Map(), inclusive = new Map(); let totalUs = 0;
    for (let i = 0; i < (profile.samples ?? []).length; i++) {
        const id = profile.samples[i], dt = profile.timeDeltas?.[i] ?? 1000; totalUs += dt;
        const keyFor = n => [n.callFrame.url.replaceAll("\\", "/").replace(/^.*\/ItacanTaskCore\//, "ItacanTaskCore/"), n.callFrame.functionName || "(anonymous)", n.callFrame.lineNumber + 1].join(":");
        const key = keyFor(nodes.get(id)); totals.set(key, (totals.get(key) ?? 0) + dt); const seen = new Set();
        for (let current = id; current; current = parents.get(current)) { const k = keyFor(nodes.get(current)); if (!seen.has(k)) inclusive.set(k, (inclusive.get(k) ?? 0) + dt); seen.add(k); }
    }
    const sorted = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([source, us]) => ({ source, milliseconds: us / 1000, percent: us / totalUs * 100 }));
    return { sampledMs: totalUs / 1000, topSelf: sorted(totals), topInclusive: sorted(inclusive) };
}
function heapSummary(profile) { const map = new Map(); function visit(n) { const f = n.callFrame, key = [f.url.replaceAll("\\", "/").replace(/^.*\/ItacanTaskCore\//, "ItacanTaskCore/"), f.functionName || "(anonymous)", f.lineNumber + 1].join(":"); map.set(key, (map.get(key) ?? 0) + n.selfSize); for (const c of n.children ?? []) visit(c); } visit(profile.head); return [...map].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([source, sampledAllocatedBytes]) => ({ source, sampledAllocatedBytes })); }
function fit(points) { const n = points.length, mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n, slope = points.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / points.reduce((s, p) => s + (p[0] - mx) ** 2, 0), intercept = my - slope * mx, residual = points.reduce((s, p) => s + (p[1] - intercept - slope * p[0]) ** 2, 0), total = points.reduce((s, p) => s + (p[1] - my) ** 2, 0); return { points, interceptMs: intercept, msPerTask: slope, rSquared: 1 - residual / total, interpretation: "Descriptive fit to three populations; not a complexity proof or causal isolation." }; }
function stages(record) {
    const g = record.stages?.groups ?? [], sum = (predicate, field = "inclusiveMs") => g.filter(predicate).reduce((n, x) => n + x[field], 0), named = name => x => x.label === name;
    return {
        snapshots: sum(x => x.label.endsWith("TaskRepository.readSnapshot"), "calls"), validations: sum(named("src/domain.js.validateState"), "calls"), validationMs: sum(named("src/domain.js.validateState")),
        statusCaptureMs: sum(x => x.label.endsWith("TaskRepository.readSnapshot") && x.selection === "status"), dataCaptureMs: sum(x => x.label.endsWith("TaskRepository.readSnapshot") && x.selection !== "status"),
        executeMs: sum(x => x.label.endsWith("TaskRepository.execute")), commitMs: sum(x => x.label.endsWith("JsonGenerationStorage.commit")),
        generationEncodeMs: sum(named("src/private-storage-codec.js.encodePrivateGeneration")), generationDecodeMs: sum(named("src/private-storage-codec.js.decodePrivateGeneration")),
        largeCloneMs: sum(named("src/value.js.clone")), canonicalMs: sum(named("src/value.js.canonical")), jsonValueMs: sum(named("src/value.js.jsonValue")),
        projectionMs: sum(x => ["src/snapshot-read.js.projectSnapshot", "src/editor-read.js.projectEditor"].includes(x.label)),
        applyCommandMs: sum(named("src/commands.js.applyCommand")), atomicTransformMs: sum(named("src/atomic-task.js.applyAtomic")),
        completionFactoryMs: sum(named("src/completion-transition.js.completionTransition")), structuralMs: sum(named("src/structural-edit.js.applyStructuralEdit")),
        filesystemMs: sum(x => /^(fs\.|fileHandle\.)/.test(x.label), "selfMs"), syncMs: sum(named("fileHandle.sync")),
        writeBytes: sum(named("fileHandle.writeFile"), "bytes"), copiedBytes: sum(named("fs.copyFile"), "bytes"), readBytes: sum(named("fs.readFile"), "bytes"),
        writerMs: sum(x => x.label.startsWith("boundary.writer.")),
        gcEvents: record.stages?.gc.length ?? null, gcMs: record.stages?.gc.reduce((n, e) => n + e.duration, 0) ?? null,
    };
}
async function main(audit) {
    await require("./fixtures.cjs").auditRoot(audit); const names = await fs.readdir(audit), records = [], groups = new Map(), profiles = [], excludedProvisional = [];
    for (const name of names) {
        if (!/^(diagnose|boundaries|profiles|calibrate|http|sensitivity|plain-boundaries)-.*\.json$/.test(name) || /\.(input|run)\.json$/.test(name)) continue;
        const r = JSON.parse(await fs.readFile(path.join(audit, name), "utf8")); if (!r.before || !r.elapsedMs) continue;
        if (r.instrument && r.instrumentationVersion !== 2) { excludedProvisional.push(name); continue; }
        records.push({ file: name, ...r, breakdown: stages(r) });
        const key = [name.split("-")[0], r.baseline.count, r.baseline.kind, r.scenario, r.mode].filter(Boolean).join("/"); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r);
        if (r.profile) profiles.push({ file: name, cpu: cpuSummary(JSON.parse(await fs.readFile(path.join(audit, name + ".cpuprofile"), "utf8"))), allocations: heapSummary(JSON.parse(await fs.readFile(path.join(audit, name + ".heapprofile"), "utf8"))) });
    }
    const summary = [...groups].map(([key, rows]) => ({ key, ...stats(rows.map(r => r.elapsedMs)), before: rows[0].before, after: rows[0].after, breakdown: Object.fromEntries(Object.keys(stages(rows[0])).map(k => [k, stats(rows.map(r => stages(r)[k] ?? 0)).medianMs])), memory: { beforeHeapMedian: stats(rows.map(r => r.memoryBefore.heapUsed)).medianMs, afterHeapMedian: stats(rows.map(r => r.memoryAfter.heapUsed)).medianMs, maxRssKiB: Math.max(...rows.map(r => r.maxRssKiB)), afterCloseGcHeapMedian: stats(rows.map(r => r.afterCloseAndExplicitGC?.heapUsed ?? 0)).medianMs } }));
    const startup = [];
    for (const name of names.filter(n => /^startup-\d+\.json$/.test(n))) { const r = JSON.parse(await fs.readFile(path.join(audit, name), "utf8")); startup.push({ ...r, ...(names.includes(name.replace(".json", ".cpuprofile")) ? { cpu: cpuSummary(JSON.parse(await fs.readFile(path.join(audit, name.replace(".json", ".cpuprofile")), "utf8"))) } : {}) }); }
    let reproduced = []; for (const name of ["reproduced-baseline.out.log", "unchanged-baseline.out.log"]) if (names.includes(name)) { reproduced = (await fs.readFile(path.join(audit, name), "utf8")).split("\n").filter(l => l.startsWith("{")).map(JSON.parse).filter(r => r.count && r.list); break; }
    const scaling = reproduced.length === 3 ? Object.fromEntries(["list", "editor"].map(k => [k, fit(reproduced.map(r => [r.count, r[k].medianMs]))])) : {};
    await fs.writeFile(path.join(audit, "analysis.json"), JSON.stringify({ summary, profiles, startup, reproduced, scaling, excludedProvisional, notes: ["Inclusive stages overlap; do not sum percentages.", "Three/one expensive write samples use min/median/max, not p95.", "GC and allocation sampling are diagnostic estimates, not a heap leak proof."] }, null, 2));
    const lines = ["# Measured diagnostic summaries", "", "Times are milliseconds. Inclusive stages overlap.", "", "| Group | n | min | median | max | validations | status captures ms | command ms | commit ms |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
    for (const r of summary) lines.push(`| ${r.key} | ${r.samples} | ${r.minMs.toFixed(1)} | ${r.medianMs.toFixed(1)} | ${r.maxMs.toFixed(1)} | ${r.breakdown.validations} | ${r.breakdown.statusCaptureMs.toFixed(1)} | ${r.breakdown.executeMs.toFixed(1)} | ${r.breakdown.commitMs.toFixed(1)} |`);
    await fs.writeFile(path.join(audit, "summary.md"), lines.join("\n") + "\n"); process.stdout.write(JSON.stringify({ records: records.length, groups: summary.length, profiles: profiles.length }) + "\n");
}
if (require.main === module) main(process.argv[2]).catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; });
module.exports = { stats, cpuSummary, heapSummary, stages, fit, main };
