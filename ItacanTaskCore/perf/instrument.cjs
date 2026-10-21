"use strict";
// Test-process-only wrappers. No native file is rewritten; all original checks run.
const Module = require("node:module"), path = require("node:path");
const { AsyncLocalStorage } = require("node:async_hooks");
const { performance, PerformanceObserver } = require("node:perf_hooks");
const root = path.resolve(__dirname, "..");
const exportsToTime = {
    "src/domain.js": ["validateState"], "src/indexes.js": ["buildIndexes"],
    "src/value.js": ["clone", "canonical", "jsonValue"],
    "src/commands.js": ["validateCommand", "applyCommand", "newTask"],
    "src/atomic-task.js": ["validateCommand", "applyAtomic", "recurrenceGuard"],
    "src/completion-transition.js": ["completionTransition"],
    "src/structural-edit.js": ["applyStructuralEdit"],
    "src/source-content.js": ["sha256", "validateContentContinuity", "setContentIntent", "finishContentRevision"],
    "src/completion-effects.js": ["validateState", "hash", "finish"],
    "src/private-storage-codec.js": ["encodePrivateGeneration", "decodePrivateGeneration", "encodePrivateManifest", "decodePrivateManifest"],
    "src/snapshot-read.js": ["projectSnapshot"], "src/editor-read.js": ["projectEditor"],
    "src/command-admission.js": ["begin", "fresh", "candidate", "publication"],
    "host/registry.js": ["validateRegistry", "identityPin"],
    "writer/policy.js": ["request", "candidate", "hash"], "writer/admission.js": ["compile", "partitions"],
    "application/intents.js": ["compile", "validate"],
};
const prototypes = {
    "src/repository.js": { TaskRepository: ["readSnapshot", "execute", "publish"] },
    "src/json-repository.js": { JsonGenerationStorage: ["load", "verify", "commit", "assertAllWritable", "beginReadObservation", "assertReadObservation", "mirrorRecoveryBarrier", "atomicManifest", "prune"] },
    "src/node-directory.js": { NodeDirectory: ["read", "list", "writeNew", "publish", "replace", "remove", "syncDirectory", "assertWriter"] },
    "host/authority.js": { PinnedDirectory: ["assertRoot"] },
};
function countState(s) { try { if (!["tasks", "receipts", "history", "bindings"].every(k => Array.isArray(s?.[k])) || !s.tasks.every(t => Array.isArray(t?.steps))) return null; return { tasks: s.tasks.length, steps: s.tasks.reduce((n, t) => n + t.steps.length, 0), events: s.history.length, bindings: s.bindings.length, receipts: s.receipts.length }; } catch (_) { return null; } }
function union(intervals) { const sorted = intervals.sort((a, b) => a[0] - b[0]); let total = 0, end = -Infinity; for (const [a, b] of sorted) { total += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); } return total; }
function substantial(v) { return v && typeof v === "object" && (Array.isArray(v) ? v.length > 32 : v.tasks || v.steps || v.schemaVersion || v.payload?.tasks || v.result?.tasks?.length > 32); }
function install() {
    for (const file of Object.keys(require.cache)) { const rel = path.relative(root, file).split(path.sep).join("/"); if (exportsToTime[rel] || prototypes[rel]) throw Error("Install diagnostics before loading native runtime modules: " + rel); }
    const als = new AsyncLocalStorage(), originalLoad = Module._load, altered = [], seen = new WeakMap(), handles = new WeakSet();
    let recording = null; const gc = [], sizes = new Map(), handleFiles = new WeakMap();
    const observer = new PerformanceObserver(list => { for (const e of list.getEntries()) gc.push({ start: e.startTime, duration: e.duration, kind: e.detail?.kind ?? null }); }); observer.observe({ entryTypes: ["gc"] });
    function wrap(label, fn, { selective = false, after = null } = {}) {
        return function (...args) {
            if (selective && !substantial(args[0]) || !recording) { const r = Reflect.apply(fn, this, args); return after ? r?.then ? r.then(v => { after(v, args); return v; }) : (after(r, args), r) : r; }
            const operation = recording, parent = als.getStore(), start = performance.now(), currentParent = parent?.operation === operation ? parent : null;
            const frame = { label, start, children: [], operation, insideDomain: !!currentParent && (currentParent.insideDomain || currentParent.label === "src/domain.js.validateState"), selection: label.endsWith("TaskRepository.readSnapshot") ? args[0].selection : currentParent?.selection ?? null, command: label.endsWith("TaskRepository.execute") ? args[0].type : currentParent?.command ?? null }, receiver = this;
            const shape = label.endsWith("validateState") ? countState(args[0]) : null;
            const heap = label === "src/value.js.clone" && args[0]?.tasks ? process.memoryUsage().heapUsed : null;
            function finish(value, error) {
                const end = performance.now(), duration = end - start, self = Math.max(0, duration - union(frame.children));
                if (parent?.operation === operation) parent.children.push([start, end]);
                const context = { selection: frame.selection, command: frame.command, insideDomain: frame.insideDomain };
                const key = label + " <- " + (currentParent?.label ?? "operation") + JSON.stringify(context), g = operation.groups[key] ??= { label, parent: currentParent?.label ?? "operation", ...context, calls: 0, inclusiveMs: 0, selfMs: 0, bytes: 0 };
                g.calls++; g.inclusiveMs += duration; g.selfMs += self;
                if (shape) g.stateVisits = (g.stateVisits ?? []).concat([shape]);
                if (heap !== null) operation.cloneHeap.push({ before: heap, after: process.memoryUsage().heapUsed, ...countState(args[0]) });
                if (label.endsWith(".read") || label === "fs.readFile") { const size = typeof value === "string" ? Buffer.byteLength(value) : Buffer.isBuffer(value) ? value.length : 0; g.bytes += size; }
                if (label.endsWith(".writeNew") || label === "fileHandle.writeFile") g.bytes += typeof args[label.endsWith(".writeNew") ? 1 : 0] === "string" ? Buffer.byteLength(args[label.endsWith(".writeNew") ? 1 : 0]) : args[0]?.byteLength ?? 0;
                if (label.endsWith("NodeDirectory.writeNew")) sizes.set(receiver.file(args[0]), Buffer.byteLength(args[1]));
                if (label === "fs.copyFile") { const bytes = sizes.get(args[0]) ?? null; if (bytes !== null) { g.bytes += bytes; sizes.set(args[1], bytes); } }
                if (["fs.readFile", "fileHandle.writeFile", "fs.copyFile"].includes(label)) { const name = label === "fileHandle.writeFile" ? handleFiles.get(receiver) : args[0], base = path.basename(String(name)), kind = /^(gen-|candidate-)/.test(base) ? "generation" : base.startsWith("manifest-") ? "manifest-temporary" : base; const item = operation.ioFiles[label + ":" + kind] ??= { calls: 0, bytes: 0 }; item.calls++; item.bytes += label === "fs.readFile" ? typeof value === "string" ? Buffer.byteLength(value) : value?.byteLength ?? 0 : label === "fs.copyFile" ? sizes.get(args[0]) ?? 0 : typeof args[0] === "string" ? Buffer.byteLength(args[0]) : args[0]?.byteLength ?? 0; }
                if (duration > 1 || shape) operation.trace.push({ label, parent: parent?.label ?? "operation", start: start - operation.start, duration, selfMs: self, ...(shape ? { shape } : {}), ...(error ? { error: error.code ?? error.name } : {}) });
                return value;
            }
            try {
                const result = als.run(frame, () => Reflect.apply(fn, this, args));
                if (result?.then) return result.then(v => { if (after) after(v, args); return finish(v); }, e => { finish(null, e); throw e; });
                if (after) after(result, args); return finish(result);
            } catch (e) { finish(null, e); throw e; }
        };
    }
    function replace(object, key, label, options) { const descriptor = Object.getOwnPropertyDescriptor(object, key); if (!descriptor || typeof descriptor.value !== "function" || !descriptor.configurable) return; altered.push([object, key, descriptor]); Object.defineProperty(object, key, { ...descriptor, value: wrap(label, descriptor.value, options) }); }
    function fileHandle(handle, args) { handleFiles.set(handle, args[0]); const proto = Object.getPrototypeOf(handle); if (handles.has(proto)) return; handles.add(proto); for (const name of ["writeFile", "sync", "close"]) replace(proto, name, "fileHandle." + name); }
    Module._load = function (request, parent, isMain) {
        const result = Reflect.apply(originalLoad, this, arguments);
        if (request === "node:fs/promises") {
            if (!seen.has(result)) { seen.set(result, result); for (const name of ["readFile", "copyFile", "rename", "unlink", "lstat", "realpath", "readdir"]) replace(result, name, "fs." + name); replace(result, "open", "fs.open", { after: fileHandle }); }
            return result;
        }
        // Native validators use cached require calls in task loops. Resolve only
        // on first observation, so diagnostics do not defeat Node's load cache.
        if (result && (typeof result === "object" || typeof result === "function") && seen.has(result)) return seen.get(result);
        let resolved; try { resolved = Module._resolveFilename(request, parent); } catch (_) { return result; }
        const rel = path.relative(root, resolved).split(path.sep).join("/");
        if (!exportsToTime[rel] && !prototypes[rel]) return result;
        if (seen.has(result)) return seen.get(result);
        for (const [name, methods] of Object.entries(prototypes[rel] ?? {})) if (result[name]) for (const method of methods) replace(result[name].prototype, method, rel + "." + name + "." + method);
        const copy = Object.create(Object.getPrototypeOf(result));
        for (const key of Reflect.ownKeys(result)) { const d = Object.getOwnPropertyDescriptor(result, key); if (exportsToTime[rel]?.includes(key) && typeof d.value === "function") d.value = wrap(rel + "." + key, d.value, { selective: rel === "src/value.js", ...(rel === "src/completion-transition.js" && key === "completionTransition" ? { after: value => { for (const method of ["transition", "addEvent"]) value[method] = wrap("completion." + method, value[method]); } } : {}) }); Object.defineProperty(copy, key, d); }
        if (Object.isFrozen(result)) Object.freeze(copy); seen.set(result, copy); seen.set(copy, copy); return copy;
    };
    return {
        version: 2,
        wrap,
        async measure(label, work) {
            if (recording) throw Error("Nested diagnostic demands are forbidden");
            const r = { label, start: performance.now(), groups: {}, trace: [], cloneHeap: [], ioFiles: {} }, before = process.memoryUsage(), cpu = process.cpuUsage(); recording = r;
            let value; try { value = await work(); } finally { r.elapsedMs = performance.now() - r.start; recording = null; r.memoryBefore = before; r.memoryAfter = process.memoryUsage(); r.cpuUsage = process.cpuUsage(cpu); r.maxRssKiB = process.resourceUsage().maxRSS; await new Promise(resolve => setImmediate(resolve)); r.gc = gc.filter(e => e.start >= r.start && e.start < r.start + r.elapsedMs); r.groups = Object.values(r.groups); }
            return { value, record: r };
        },
        restore() { recording = null; Module._load = originalLoad; for (const [o, k, d] of altered.reverse()) Object.defineProperty(o, k, d); observer.disconnect(); },
    };
}
module.exports = { install, union, countState };
