"use strict";

const path = require("path");
const { AtlasFileRepository } = require("./persistence");
const { createClock } = require("./clock");
const { createAtlasRuntime, DEVELOPMENT_CONFIGURATION } = require("./runtime");
const { createWebviewerEnforcement } = require("./webviewer");

// Cached in Electron's MAIN PROCESS, not each Obsidian/popout renderer. Retain
// the same controller on plugin reload, including uncertain commits/time guards.
const owners = new Map();
function getAtlasHost({ directory, partition }) {
    if (!path.isAbsolute(directory) || typeof partition !== "string" || !/^persist:vault-[A-Za-z0-9_-]+$/.test(partition)) {
        throw new TypeError("Invalid Atlas host binding");
    }
    const resolved = path.resolve(directory), key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    const existing = owners.get(key);
    if (existing) {
        if (existing.partition !== partition) throw new Error("Conflicting Atlas session");
        existing.resume(); return existing.api;
    }
    const electron = require("electron");
    const repository = new AtlasFileRepository(path.join(directory, "atlas-state"), { configuration: DEVELOPMENT_CONFIGURATION });
    const runtime = createAtlasRuntime({ repository, clock: createClock() });
    const clients = new Map();
    let nextClient = 0;
    const notify = message => {
        for (const [id, callback] of clients) { try { callback(message); } catch (_) { clients.delete(id); } }
    };
    const enforcement = createWebviewerEnforcement({ electron, runtime, partition, onOpenHome: message => notify({ type: "OPEN_HOME", ...message }) });
    runtime.subscribe(() => notify({ type: "STATE_CHANGED" }));
    let observing = false;
    const timer = setInterval(() => {
        if (observing) return;
        observing = true;
        runtime.observe().finally(() => { observing = false; });
    }, 1000);
    timer.unref?.();
    const api = Object.freeze({
        view: runtime.view, command: runtime.command, open: runtime.open,
        subscribe(callback) { if (typeof callback !== "function") throw new TypeError("Invalid client"); const id = ++nextClient; clients.set(id, callback); return id; },
        unsubscribe(id) { clients.delete(id); if (clients.size === 0) enforcement.suspend(); },
        forget: runtime.forget
    });
    const owner = { partition, api, resume: () => enforcement.resume() };
    owners.set(key, owner);
    electron.app.once("will-quit", () => {
        clearInterval(timer); enforcement.shutdown(); repository.close(); owners.delete(key);
    });
    // Installing enforcement is synchronous. Loading state may be asynchronous;
    // every guest remains guarded while the controller is unavailable.
    void runtime.open();
    return api;
}

module.exports = { getAtlasHost };
