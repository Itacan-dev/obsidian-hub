"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), { performance } = require("node:perf_hooks"), inspector = require("node:inspector");
const optionsFile = process.argv[2];
let cleanup = async () => {}, activeInspector = null;
async function main() {
    const options = JSON.parse(await fs.readFile(optionsFile, "utf8")), startMemory = process.memoryUsage();
    const instrument = options.instrument ? require("./instrument.cjs").install() : null;
    const F = require("./fixtures.cjs"); await F.pinRoot(options.audit); const directory = await F.copyClosed(options.baseline.directory, options.audit);
    const faults = [], fault = stage => { faults.push({ stage, time: performance.now(), memory: process.memoryUsage() }); };
    const opening = performance.now(); let runtime = null, fixture = null;
    if (options.mode === "full" || options.mode === "http" || ["list", "editor"].includes(options.scenario)) runtime = await F.R.openRuntime(directory, { repositoryOptions: { fault } }); else fixture = await F.direct(directory, instrument, fault);
    cleanup = async () => { if (runtime) await runtime.close(); if (fixture) await fixture.close(); activeInspector?.disconnect(); };
    const openMs = performance.now() - opening, owner = runtime ? runtime.info().workspaces[0].owner : fixture.profile.registry.owners[0].owner;
    const read = () => runtime ? runtime.editor(options.baseline.taskId, owner) : fixture.editor.read({ version: 1, authorityId: fixture.profile.authorityId, owner, partitionId: fixture.profile.registry.owners[0].partitionId, taskId: options.baseline.taskId });
    let editor = (await read()).editor;
    if (options.scenario === "reopen") {
        const request = await F.intent(editor, "complete"); const out = runtime ? await runtime.mutate(request) : await fixture.service.mutate(request);
        if (out.status !== "committed") throw Error(JSON.stringify(out));
        if (fixture) { fixture.service.dispose(); fixture.session.revoke(fixture.capability); await fixture.session.dispose(); fixture = await F.direct(directory, instrument, fault); }
        editor = (await read()).editor;
    }
    // Warm capture without mutation; operation samples all start from these same counts.
    for (let i = 0; i < (options.warmups ?? 1); i++) await read();
    const before = await F.describe(directory), compiledIntent = await F.intent(editor, options.scenario), compiled = compiledIntent ? require("../application/intents").compile(compiledIntent) : null;
    const server = options.mode === "http" ? await require("../demo/server.cjs").createDemoServer({ ...runtime, editor: instrument ? instrument.wrap("boundary.HTTP.editor", (...args) => runtime.editor(...args)) : (...args) => runtime.editor(...args), mutate: instrument ? instrument.wrap("boundary.HTTP.mutate", (...args) => runtime.mutate(...args)) : (...args) => runtime.mutate(...args) }) : null;
    if (server) cleanup = () => server.close();
    async function rpc(route, body) { const response = await fetch(server.origin + "/api/" + route, { method: "POST", headers: { origin: server.origin, "x-itacan-demo": server.token, "content-type": "application/json" }, body: JSON.stringify(body) }); const text = await response.text(); if (!response.ok) throw Error(text); return JSON.parse(text); }
    const nativeWork = async () => { const r = await fixture.writer[compiled.family](fixture.capability, compiled.request); if (r.status !== "committed") throw Error(JSON.stringify(r)); return r; };
    const work = async () => {
        if (options.scenario === "list") return runtime.list(owner);
        if (options.scenario === "editor") return read();
        if (options.mode === "http") { const e = await rpc("editor", { owner, taskId: options.baseline.taskId }); return options.scenario === "http-editor" ? e : rpc("mutate", await F.intent(e.editor, "save-title")); }
        if (options.mode === "native") return nativeWork();
        if (options.mode === "application") return fixture.service.mutate(compiledIntent);
        const current = await read(), prepared = await F.intent(current.editor, options.scenario);
        return runtime.mutate(prepared);
    };
    const session = options.profile ? new inspector.Session() : null;
    const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (e, r) => e ? reject(e) : resolve(r)));
    if (session) { activeInspector = session; session.connect(); await post("Profiler.enable"); await post("Profiler.setSamplingInterval", { interval: 1000 }); await post("HeapProfiler.enable"); await post("HeapProfiler.startSampling", { samplingInterval: 65536, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); await post("Profiler.start"); }
    faults.length = 0; const measuredStart = performance.now(), processCpu = process.cpuUsage(), memoryBefore = process.memoryUsage();
    const measured = instrument ? await instrument.measure(options.scenario, work) : { value: await work() }; const elapsedMs = measured.record?.elapsedMs ?? performance.now() - measuredStart;
    const memoryAfter = process.memoryUsage(), cpuUsage = process.cpuUsage(processCpu);
    if (session) { const cpu = await post("Profiler.stop"), heap = await post("HeapProfiler.stopSampling"); await fs.writeFile(options.output + ".cpuprofile", JSON.stringify(cpu.profile)); await fs.writeFile(options.output + ".heapprofile", JSON.stringify(heap.profile)); session.disconnect(); }
    const value = measured.value;
    if (!["list", "editor", "http-editor"].includes(options.scenario) && !["committed", "replayed"].includes(value.status)) throw Error(JSON.stringify(value));
    const after = await F.describe(directory), result = { ...options, instrumentationVersion: instrument?.version ?? null, directory, openMs, elapsedMs, startMemory, memoryBefore, memoryAfter, cpuUsage, maxRssKiB: process.resourceUsage().maxRSS, before, after, outcome: value.status ?? "read", taskIds: value.taskIds ?? value.tasks?.map(t => t.id) ?? [], eventIds: value.eventIds ?? [], ...(measured.record ? { stages: measured.record } : {}), faults: faults.map(f => ({ ...f, time: f.time - measuredStart })) };
    if (server) await server.close(); else { if (runtime) await runtime.close(); if (fixture) await fixture.close(); }
    if (global.gc) { global.gc(); global.gc(); result.afterCloseAndExplicitGC = process.memoryUsage(); }
    instrument?.restore(); await fs.writeFile(options.output, JSON.stringify(result, null, 2)); process.stdout.write(JSON.stringify({ scenario: options.scenario, mode: options.mode, count: before.tasks, elapsedMs, outcome: result.outcome, output: options.output }) + "\n");
}
main().catch(async e => { process.stderr.write((e.stack || String(e)) + "\n"); try { await cleanup(); } catch (closeError) { process.stderr.write("Cleanup: " + (closeError.stack || closeError) + "\n"); } process.exitCode = 1; });
