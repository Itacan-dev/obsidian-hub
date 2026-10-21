"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { performance } = require("perf_hooks");
const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
let plannerCalls = 0, validations = 0;
const planner = require(path.join(root, "core/atlas-planner")), stateModule = require(path.join(root, "core/atlas-state"));
const originalPlan = planner.planAtlasOperation, originalValidate = stateModule.validateAtlasSnapshot;
planner.planAtlasOperation = (...args) => { plannerCalls++; return originalPlan(...args); };
stateModule.validateAtlasSnapshot = (...args) => { validations++; return originalValidate(...args); };
let createViewJSON; try { createViewJSON = require(path.join(root, "obsidian/presentation")).createViewJSON; } catch (_) { /* preserved baseline has no cache */ }
const { AtlasFileRepository } = require(path.join(root, "obsidian/persistence"));
const { createAtlasRuntime } = require(path.join(root, "obsidian/runtime"));
const configuration = { accessTiming: { waitMs: 1000, confirmationWindowMs: 2000, grantDurationMs: 2000 }, vaultTiming: { waitMs: 1000, confirmationWindowMs: 2000 }, journeyLimits: { lifetimeMs: 300000, maxHops: 12 } };
const mean = values => +(values.reduce((a,b) => a+b, 0) / values.length).toFixed(3);
async function fixture(size) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-perf-authority-"));
    let now = 1000; const counts = { reads: 0, writes: 0, fsyncs: 0, renames: 0 };
    const io = Object.create(fs);
    for (const [method,key] of [["readFileSync","reads"],["writeFileSync","writes"],["fsyncSync","fsyncs"],["renameSync","renames"]]) io[method] = (...args) => { counts[key]++; return fs[method](...args); };
    const repository = new AtlasFileRepository(directory, { io, configuration });
    const runtime = createAtlasRuntime({ repository, clock: { now: () => now }, configuration });
    await runtime.open(); await runtime.command({ kind: "INITIALIZE", configuration, policy: { whitelist: Array.from({length:size}, (_,i) => "site" + i + ".bench.test"), blacklist: [] } });
    return { runtime, counts, advance: () => { now += 1000; }, clear: () => { for (const k of Object.keys(counts)) counts[k] = 0; }, close: () => { repository.close(); if(path.dirname(directory)!==path.resolve(os.tmpdir())||!path.basename(directory).startsWith("atlas-perf-authority-")) throw Error("Unsafe cleanup"); fs.rmSync(directory,{recursive:true,force:true}); } };
}
async function main() {
    const result = { node: process.version, platform: process.platform, samples: 7, descriptions: [], observation: [] };
    for (const size of [32,64,128,256]) {
        const f = await fixture(size);
        try {
            const start = performance.now(); const first = f.runtime.view(); const cold = performance.now()-start;
            for(let i=0;i<2;i++) f.runtime.view();
            const times=[], serialize=[]; plannerCalls = 0; validations = 0;
            for(let i=0;i<7;i++){let t=performance.now(); f.runtime.view();times.push(performance.now()-t);t=performance.now();JSON.stringify(first);serialize.push(performance.now()-t);}
            const plannerCallsPerView = plannerCalls / 7, validationsPerView = validations / 7;
            let encodings = 0; const encode = value => { encodings++; return JSON.stringify(value); };
            const transport = createViewJSON ? createViewJSON(() => f.runtime.view(), encode) : () => encode(f.runtime.view());
            transport(); encodings = 0; const transportTimes = [];
            for (let i = 0; i < 7; i++) { const started = performance.now(); transport(); transportTimes.push(performance.now() - started); }
            const turn = performance.now(), nextTurn = new Promise(resolve => setImmediate(() => resolve(performance.now()-turn)));
            f.runtime.view(); const eventLoopTurnMs = await nextTurn;
            result.descriptions.push({destinations:size,coldMs:+cold.toFixed(3),meanMs:mean(times),serializationMeanMs:mean(serialize),eventLoopTurnMs:+eventLoopTurnMs.toFixed(3),bytes:Buffer.byteLength(JSON.stringify(first)), plannerCallsPerView, validationsPerView, transportMeanMs:mean(transportTimes), repeatedTransportEncodings:encodings});
        } finally { f.close(); }
    }
    for (const [name,tabs] of [["idle",0],["one-tab",1],["four-tabs",4],["vault-countdown",0],["access-countdown",1]]) {
        const f = await fixture(32);
        try {
            const contexts = [];
            for(let i=0;i<tabs;i++) {
                const context=f.runtime.attach(i+1,{block(){},lease(){},openHome(){}}); contexts.push(context);
                const url = name==="access-countdown" ? "https://grey.bench.test/" : "https://site"+i+".bench.test/";
                await f.runtime.navigate(context,{url,requestId:"b"+i,loaderId:"l"+i,method:"GET"},()=>{},()=>{});
                if(context.flight) await f.runtime.arrive(context,{url,loaderId:"l"+i});
            }
            if(name==="vault-countdown") await f.runtime.command({kind:"PROPOSE_POLICY",candidatePolicy:{whitelist:[...f.runtime.view().snapshot.policy.whitelist,"new.bench.test"],blacklist:[]}});
            if(name==="access-countdown") await f.runtime.command({kind:"START_ACCESS",contextId:contexts[0].id,generation:contexts[0].generation});
            let publications=0, transportMs=0;
            const unsubscribe=f.runtime.subscribe(()=>{publications++;const start=performance.now();JSON.stringify(f.runtime.view());transportMs+=performance.now()-start;});
            f.clear();const start=performance.now();
            for(let i=0;i<3;i++){f.advance();await f.runtime.observe();}
            const elapsedMs=performance.now()-start;unsubscribe();
            result.observation.push({name,tabs,ticks:3,elapsedMs:+elapsedMs.toFixed(3),publications,transportMs:+transportMs.toFixed(3),...f.counts});
        } finally { f.close(); }
    }
    const output = JSON.stringify(result,null,2); if (process.env.ATLAS_PERF_OUTPUT) fs.writeFileSync(process.env.ATLAS_PERF_OUTPUT, output); console.log(output);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
