"use strict";
// Native code loads ONLY in this disposable utility process. No renderer access.
const fs = require("node:fs"), path = require("node:path"), { Inventory } = require("./identity.cjs");
if (!process.parentPort || process.env.ITACAN_OATH_ADAPTER !== "phase2") throw Error("Use the Phase 2 utility supervisor");
const root = path.join(__dirname, "node_modules/phase2-upstream/binary");
function findAddon(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? findAddon(path.join(dir, item.name)) : item.name.endsWith(".node") ? [path.join(dir, item.name)] : []);
}
let addon, loadError;
try {
    const files = findAddon(root); if (files.length !== 1) throw Error("Expected exactly one pinned N-API addon");
    addon = require(files[0]);
} catch (error) { loadError = error.message; }
const inventory = new Inventory();
const capabilities = { observation: !!addon, focus: false, minimize: false, restore: false, launch: false,
    enumerationComplete: false, handleGeneration: false, minimizedState: false,
    loadError, provider: "get-windows 9.3.0 upstream N-API addon (direct diagnostic loader)" };
let lease = Date.now();
setInterval(() => { if (Date.now() - lease > 5000) process.exit(2); }, 500).unref();
setTimeout(() => process.exit(2), 125000).unref();
process.parentPort.on("message", ({ data }) => {
    const { id, action } = data ?? {}; lease = Date.now();
    if (action === "heartbeat") return;
    try {
        let result;
        if (action === "capabilities") result = { ...capabilities, pid: process.pid, runtime: process.versions };
        else if (action === "foreground") {
            if (!addon) throw Error(loadError);
            const start = performance.now();
            process.parentPort.postMessage({ stage: "foreground-native-start" });
            const raw = addon.getActiveWindow();
            process.parentPort.postMessage({ stage: "foreground-native-complete", durationMs: performance.now() - start });
            result = { foreground: raw ? inventory.record(raw) : null, durationMs: performance.now() - start };
        } else if (action === "sample") {
            if (!addon) throw Error(loadError);
            const start = performance.now();
            process.parentPort.postMessage({ stage: "inventory-native-start" });
            const raw = addon.getOpenWindows();
            process.parentPort.postMessage({ stage: "inventory-native-complete", durationMs: performance.now() - start });
            const windows = inventory.update(raw);
            process.parentPort.postMessage({ stage: "inventory-identity-complete", durationMs: performance.now() - start });
            const foreground = addon.getActiveWindow();
            result = { windows, foreground: foreground ? inventory.record(foreground) : null,
                coverage: "partial: upstream silently filters some windows and metadata failures", durationMs: performance.now() - start };
        } else if (action === "resolve") {
            inventory.update(addon.getOpenWindows()); result = inventory.resolve(data.token);
        } else if (["focus", "minimize", "restore", "launch"].includes(action)) throw Error("Unsupported control capability; no fallback");
        else if (action === "test-exit") process.exit(17);
        else if (action === "test-stall") { const until = Date.now() + 10000; while (Date.now() < until) {} }
        else throw Error("Unknown adapter request");
        process.parentPort.postMessage({ id, result });
    } catch (error) { process.parentPort.postMessage({ id, error: error.message }); }
});
