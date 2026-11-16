"use strict";
// Native code loads ONLY in this disposable utility process. No renderer access.
const fs = require("node:fs"), path = require("node:path"), { Inventory } = require("./oath-foreground-identity.cjs");
if (!process.parentPort || process.env.ITACAN_OATH_ADAPTER !== "prototype-reminder") throw Error("Use the prototype foreground supervisor");
let addon, loadError;
try {
 const binary = path.join(__dirname, '../native/oath-foreground/get-windows.node');
 const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../native/oath-foreground/manifest.json'), 'utf8'));
 if (require('node:crypto').createHash('sha256').update(fs.readFileSync(binary)).digest('hex') !== manifest.sha256) throw Error('Foreground binary integrity check failed');
 addon = require(binary);
} catch (error) { loadError = error.message; }
const inventory = new Inventory();
const capabilities = { observation: !!addon, focus: false, minimize: false, restore: false, launch: false,
    enumerationComplete: false, handleGeneration: false, minimizedState: false,
    loadError, provider: "get-windows 9.3.0 upstream N-API addon (pinned prototype loader)" };
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
        } else throw Error("Unknown adapter request");
        process.parentPort.postMessage({ id, result });
    } catch (error) { process.parentPort.postMessage({ id, error: error.message }); }
});
