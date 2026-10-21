"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), { spawn } = require("node:child_process"), { performance } = require("node:perf_hooks");
const delay = ms => new Promise(r => setTimeout(r, ms));
async function connection(url) {
    const ws = new WebSocket(url); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); let id = 0; const waiting = new Map();
    ws.onmessage = event => { const m = JSON.parse(event.data), p = waiting.get(m.id); if (p) { waiting.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); } };
    ws.onclose = () => { for (const p of waiting.values()) p.reject(Error("Owned diagnostic browser connection closed")); waiting.clear(); };
    return { send(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; waiting.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); }); }, close: () => ws.close() };
}
async function serve(file) {
    const input = JSON.parse(await fs.readFile(file, "utf8")), F = require("./fixtures.cjs"), runtime = await F.R.openRuntime(input.directory), server = await require("../demo/server.cjs").createDemoServer(runtime);
    process.stdout.write(JSON.stringify({ pid: process.pid, url: server.url, directory: input.directory }) + "\n");
    process.on("SIGTERM", () => server.close().catch(() => { process.exitCode = 1; }));
}
async function main(audit, chrome) {
    const F = require("./fixtures.cjs"); await F.auditRoot(audit); if (!path.isAbsolute(chrome) || !(await fs.stat(chrome)).isFile()) throw Error("Explicit installed Chrome executable required");
    const userData = await fs.mkdtemp(path.join(audit, "chrome-")), args = ["--headless=new", "--user-data-dir=" + userData, "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "about:blank"];
    const browser = spawn(chrome, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] }); let errors = ""; browser.stderr.on("data", b => errors += b); const browserExit = new Promise(r => browser.once("exit", (code, signal) => r({ code, signal }))); let port;
    for (let i = 0; i < 400; i++) { const content = await fs.readFile(path.join(userData, "DevToolsActivePort"), "utf8").catch(() => null); if (content) { port = Number(content.split("\n")[0]); break; } await delay(25); }
    if (!port) throw Error("Chrome debug connection unavailable");
    const version = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json(), pages = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json(), page = await connection(pages.find(p => p.type === "page").webSocketDebuggerUrl);
    await page.send("Page.enable"); await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__itacanPerfInstalled=true;window.perfLongTasks=[];new PerformanceObserver(l=>window.perfLongTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});let ready=false;Object.defineProperty(window,'itacanDemoReady',{get:()=>ready,set:v=>{ready=v;if(v)window.perfReadyAt=performance.now();}});" });
    const records = [], bases = JSON.parse(await fs.readFile(path.join(audit, "baselines.json"), "utf8"));
    try {
        for (const baseline of bases) {
            const directory = await F.copyClosed(baseline.directory, audit), file = path.join(directory, "browser-server-input.json"); await fs.writeFile(file, JSON.stringify({ directory }));
            const started = performance.now(), args = [...process.execArgv, __filename, "serve", file], p = spawn(process.execPath, args, { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = "", stderr = ""; p.stdout.on("data", b => stdout += b); p.stderr.on("data", b => stderr += b); const ended = new Promise(r => p.once("exit", (code, signal) => r({ code, signal })));
            for (let i = 0; i < 1600 && !stdout.includes("\n"); i++) await delay(25); const serverLaunchMs = performance.now() - started, launch = JSON.parse(stdout.trim()), samples = [];
            try {
                for (let sample = 0; sample < 3; sample++) {
                    const navigation = await page.send("Page.navigate", { url: launch.url.replace("/#", "/?measurement=" + sample + "#") });
                    if (!navigation.loaderId) throw Error("A browser navigation sample must create a new document"); await delay(80);
                    const observed = await page.send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async()=>{const wait=async f=>{for(let i=0;i<2400;i++){if(f())return;await new Promise(r=>setTimeout(r,25));}throw Error('Browser wait expired');};await wait(()=>window.itacanDemoReady);const raf=()=>new Promise(r=>requestAnimationFrame(r));await raf();await raf();const initialPaint=performance.now(),list=performance.getEntriesByType('resource').find(r=>r.name.endsWith('/api/list')),rows=document.querySelectorAll('.task-row').length,task=document.querySelector('.task-row').dataset.taskId,start=performance.now();document.querySelector('.task-title').click();await wait(()=>document.querySelector('.editor'));await raf();await raf();const editorMs=performance.now()-start;window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));const filter=[];for(let i=0;i<10;i++){const input=document.querySelector('.search'),begin=performance.now();input.value=i%2?'Synthetic':'no-matching-task';input.dispatchEvent(new Event('input',{bubbles:true}));await raf();await raf();filter.push(performance.now()-begin);}return{readyMs:window.perfReadyAt,initialPaintMs:initialPaint,listResponseMs:list.duration,postResponseToReadyMs:window.perfReadyAt-list.responseEnd,encodedListBytes:list.encodedBodySize,renderedRows:rows,editorMs,taskId:task,filterMs:filter,longTasks:window.perfLongTasks,jsHeapBytes:performance.memory?.usedJSHeapSize};})()` });
                    if (observed.exceptionDetails) throw Error(JSON.stringify(observed.exceptionDetails));
                    if (!Number.isFinite(observed.result.value.readyMs) || !Array.isArray(observed.result.value.longTasks)) throw Error("Browser timing injection unavailable; no ready/long-task claim permitted");
                    samples.push({ ...observed.result.value, loaderId: navigation.loaderId });
                }
            } finally {
                const u = new URL(launch.url), token = new URLSearchParams(u.hash.slice(1)).get("token"), response = await fetch(u.origin + "/api/close", { method: "POST", headers: { origin: u.origin, "x-itacan-demo": token, "content-type": "application/json" }, body: "{}" }); if (!response.ok) throw Error("Owned server close failed");
            }
            const exit = await ended, record = { population: baseline.count, baseline: baseline.description, directory, executable: process.execPath, args, pid: p.pid, exit, serverLaunchMs, stdout, stderr, samples, writerLockAbsent: !(await fs.stat(path.join(directory, "repository/WRITER.lock")).catch(() => null)) }; records.push(record); await fs.writeFile(path.join(audit, "browser-results.json"), JSON.stringify(records, null, 2)); process.stdout.write(JSON.stringify({ population: baseline.count, samples: samples.length, writerLockAbsent: record.writerLockAbsent }) + "\n");
        }
    } finally { page.close(); const b = await connection(version.webSocketDebuggerUrl); await b.send("Browser.close").catch(() => {}); b.close(); await fs.writeFile(path.join(audit, "browser-process.json"), JSON.stringify({ executable: chrome, arguments: args, pid: browser.pid, version, exit: await browserExit, stderr: errors }, null, 2)); }
}
if (require.main === module) { if (process.argv[2] === "serve") serve(process.argv[3]).catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; });
else main(process.argv[2], process.argv[3]).catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; }); }
module.exports = { connection, main };
