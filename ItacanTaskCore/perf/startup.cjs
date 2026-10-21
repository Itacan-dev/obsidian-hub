"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), inspector = require("node:inspector"), { performance } = require("node:perf_hooks");
async function worker(audit, baseFile, index) {
    const i = require("./instrument.cjs").install(), F = require("./fixtures.cjs"), base = JSON.parse(await fs.readFile(baseFile, "utf8"))[Number(index)], directory = await F.copyClosed(base.directory, audit), moduleReadyMs = performance.now(), session = base.count === 10000 ? new inspector.Session() : null;
    const post = (method, params = {}) => new Promise((r, j) => session.post(method, params, (e, value) => e ? j(e) : r(value)));
    if (session) { session.connect(); await post("Profiler.enable"); await post("Profiler.start"); }
    let cold, warm;
    try {
        cold = await i.measure("process-cold-open", () => F.R.openRuntime(directory));
        if (session) { const p = await post("Profiler.stop"); await fs.writeFile(path.join(audit, "startup-" + base.count + ".cpuprofile"), JSON.stringify(p.profile)); session.disconnect(); }
        await cold.value.close(); warm = await i.measure("warm-reopen", () => F.R.openRuntime(directory)); await warm.value.close();
    } finally { await cold?.value?.close().catch(() => {}); await warm?.value?.close().catch(() => {}); session?.disconnect(); }
    const result = { count: base.count, directory, baseline: base.description, instrumentationVersion: i.version, moduleReadyMs, cold: cold.record, warm: warm.record, after: await F.describe(directory), writerLockAbsent: !(await fs.stat(path.join(directory, "repository/WRITER.lock")).catch(() => null)) }; i.restore(); await fs.writeFile(path.join(audit, "startup-" + base.count + ".json"), JSON.stringify(result, null, 2)); process.stdout.write(JSON.stringify({ count: base.count, coldMs: cold.record.elapsedMs, warmMs: warm.record.elapsedMs }) + "\n");
}
async function main(audit) { await require("./fixtures.cjs").auditRoot(audit); const { child } = require("./run.cjs"), file = path.join(audit, "baselines.json"), bases = JSON.parse(await fs.readFile(file, "utf8")); for (let n = 0; n < bases.length; n++) await child([__filename, "worker", audit, file, String(n)], audit, "startup-" + bases[n].count); }
if (require.main === module) { if (process.argv[2] === "worker") worker(process.argv[3], process.argv[4], process.argv[5]).catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; });
else main(process.argv[2]).catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; }); }
module.exports = { worker, main };
