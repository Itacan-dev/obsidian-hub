"use strict";
const copy = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => a?.type === b?.type && a?.id === b?.id;
// Obsidian's renderer beforeunload Tasks hook is still used. The owning
// Electron window must also hold its close event: ordinary app.quit can finish
// before renderer asynchronous work, even after beforeunload was prevented.
function registerNativeQuit(plugin, host, bridge) {
    let stopWindow = () => {};
    let drainWork = null;
    const closeNative = () => drainWork ?? (drainWork = Promise.resolve().then(() => host.close()));
    const drain = done => { closeNative().then(() => done(true), error => {
        console.error("Native shutdown did not complete; quit cancelled", error);
        try { new (require("obsidian").Notice)("Native task shutdown did not complete. Quit cancelled; review native recovery.", 10000); } catch (_) {}
        done(false);
    }); };
    if (bridge === undefined) {
        try {
            const remote = require("@electron/remote"), path = require("node:path");
            const installed = path.join(plugin.app.vault.adapter.getBasePath(), plugin.manifest.dir, "main.js");
            bridge = remote.require(installed);
            stopWindow = bridge.installNativeQuit(remote.getCurrentWindow().id, drain);
        } catch (error) {
            // Ordinary Node tests have no Electron window. A desktop runtime
            // must never claim reliable ownership if its close gate is absent.
            if (typeof process !== "undefined" && process.type === "renderer") throw error;
        }
    } else if (bridge) stopWindow = bridge.installNativeQuit(drain);
    const workspace = plugin.app.workspace;
    let stopTasks = () => {};
    if (workspace?.on && workspace.offref) { const ref = workspace.on("quit", tasks => { tasks.add(() => host.close()); }); stopTasks = () => workspace.offref(ref); }
    let releasePending = null;
    const stop = () => {
        stopTasks();
        // Component unload does not await async shutdown. Retain the main
        // close gate until every accepted operation and lease has drained.
        if (!releasePending) releasePending = closeNative().then(() => stopWindow(), error => {
            console.error("Native close gate retained after failed shutdown", error);
        });
    };
    stop.stopTasks = () => stopTasks();
    plugin.register(stop);
    return stop;
}
function composeNativeHosts(plugin, hosts) {
    const select = owner => { const h = hosts.find(h => same(h.owner, owner)); if (!h) throw Error("Native owner unavailable."); return h; };
    const legacy = { async read() { const records = copy(plugin.projectWizard.completedTaskHistory ?? plugin.projectWizard.data.completedTaskHistory ?? []); return { version: 1, revision: require("../../../../../ItacanTaskCore/writer/policy").hash(records), records }; },
        subscribe(fn) { document.addEventListener("hub-completed-tasks-changed", fn); return () => document.removeEventListener("hub-completed-tasks-changed", fn); } };
    const evidence = { read: () => Promise.all(hosts.map(h => h.historyEvidence.read())), subscribe(fn) { const stops = hosts.map(h => h.historyEvidence.subscribe(fn)); return () => stops.forEach(stop => stop()); } };
    const completionFeed = require("../../../../../ItacanTaskCore/integration/completion-feed").createCompletionFeed({ native: evidence, legacy,
        navigate: ref => select(ref.owner).completionFeed.reveal({ nativeHistory: ref }) });
    const consumers = require("../../../../../ItacanTaskCore/integration/home-schedule");
    let closing = null, quitStop = () => {};
    const host = Object.freeze({
        ready: Promise.allSettled(hosts.map(h => h.ready)), completionFeed,
        matches: owner => hosts.some(h => h.matches(owner)),
        nativeTasks: Object.freeze({ consumerUiV1: true, owners: hosts.map(h => h.owner), matches: owner => hosts.some(h => h.matches(owner)), mergeHome: consumers.mergeHome, taskKey: consumers.taskKey,
            createPanelRead: args => select(args.workspace).nativeTasks.createPanelRead(args) }),
        status: () => ({ mode: "native-owners", owners: hosts.map(h => h.status()) }),
        ownerHosts: () => hosts.slice(), runtime: owner => select(owner).runtime(),
        rejectLegacy(value) { for (const h of hosts) h.rejectLegacy(value); },
        guardUnsupported() { for (const h of hosts) h.guardUnsupported(); },
        create(options = {}) { const context = options.location ? plugin.taskEditor.context(options.location) : plugin.taskEditor.currentContext(); const owner = options.owner ?? require("./task-service-legacy-values").workspaceRef(context); return select(owner).create(options); },
        close() { if (!closing) { completionFeed.dispose(); quitStop.stopTasks?.(); const drains = hosts.map(h => h.close()); closing = (async () => { const results = await Promise.allSettled(drains); for (const h of hosts.slice().reverse()) h.release(); const failures = results.filter(r => r.status === "rejected").map(r => r.reason); if (failures.length) throw new AggregateError(failures, "Native shutdown failed."); })(); } return closing; }
    });
    plugin.register(() => { void host.close().catch(e => console.error("Native owner shutdown failed", e)); });
    try { quitStop = registerNativeQuit(plugin, host); }
    catch (error) { void host.close().catch(e => console.error("Native owner shutdown failed", e)); throw error; }
    return host;
}
module.exports = { composeNativeHosts, registerNativeQuit };
