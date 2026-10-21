"use strict";

const path = require("path");
const { AtlasFileRepository } = require("./persistence");
const { createClock } = require("./clock");
const { createViewJSON } = require("./presentation");
const { createAtlasRuntime, DEVELOPMENT_CONFIGURATION } = require("./runtime");
const { createWebviewerEnforcement } = require("./webviewer");
const { createManagedService, readBundle } = require("../managed/service");

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
    const clients = new Map();
    let nextClient = 0;
    const notify = message => {
        for (const [id, callback] of clients) { try { callback(message); } catch (_) { clients.delete(id); } }
    };
    let runtime;
    const managed = createManagedService({ repository, bundle: () => readBundle(path.join(directory, "lib/atlas/managed/data")),
        fetch: electron.net.fetch.bind(electron.net), publish: work => runtime.updateManaged(work),
        changed: () => notify({ type: "STATE_CHANGED" }) });
    runtime = createAtlasRuntime({ repository, clock: createClock(), managedBlacklist: managed.getBlacklist });
    const enforcement = createWebviewerEnforcement({ electron, runtime, partition, onOpenHome: message => notify({ type: "OPEN_HOME", ...message }) });
    runtime.subscribe(() => notify({ type: "STATE_CHANGED" }));
    let observing = false;
    const timer = setInterval(() => {
        if (observing) return;
        observing = true;
        runtime.observe().finally(() => { observing = false; });
    }, 1000);
    timer.unref?.();
    const refreshTimer = setInterval(() => { void managed.refresh(); }, 3_600_000); refreshTimer.unref?.();
    const api = Object.freeze({
        apiVersion: 4,
        // Remote object proxies make every nested property read synchronous IPC.
        // Strings cross once; UI descriptions/results are ordinary local data.
        viewJSON: createViewJSON(() => api.view()),
        commandJSON: async encoded => {
            let input;
            try { if (typeof encoded !== "string" || encoded.length > 1_000_000) throw new Error(); input = JSON.parse(encoded); }
            catch (_) { return JSON.stringify({ type: "REJECTED", reason: "INVALID_OPERATION" }); }
            return JSON.stringify(await api.command(input));
        },
        view: () => { const view = runtime.view(); return { ...view, managed: managed.view(view.snapshot?.policy.whitelist) }; },
        command: input => {
            if (input?.kind === "REFRESH_MANAGED" && Object.keys(input).length === 1) return managed.refresh({ force: true }).then(() => ({ type: "MANAGED_STATUS", status: managed.view().status }));
            if (input?.kind === "LOOKUP_MANAGED" && Object.keys(input).length === 2 && typeof input.hostname === "string") {
                const target = require("../core/index").normalizeTarget({ hostname: input.hostname });
                return Promise.resolve(target ? { type: "MANAGED_LOOKUP", hostname: target.hostname, blocked: managed.lookup(target.hostname) } : { type: "REJECTED", reason: "INVALID_TARGET" });
            }
            return runtime.command(input);
        },
        open: async () => { await managed.ready; return runtime.open(); },
        subscribe(callback) { if (typeof callback !== "function") throw new TypeError("Invalid client"); const id = ++nextClient; clients.set(id, callback); return id; },
        unsubscribe(id) { clients.delete(id); if (clients.size === 0) enforcement.suspend(); },
        forget: runtime.forget
    });
    const owner = { partition, api, resume: () => enforcement.resume() };
    owners.set(key, owner);
    electron.app.once("will-quit", () => {
        clearInterval(timer); clearInterval(refreshTimer); enforcement.shutdown(); repository.close(); owners.delete(key);
    });
    // Installing enforcement is synchronous. Loading state may be asynchronous;
    // every guest remains guarded while the controller is unavailable.
    void managed.ready.then(async () => { await runtime.open(); void managed.refresh(); });
    return api;
}

module.exports = { getAtlasHost };
