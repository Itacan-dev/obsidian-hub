"use strict";
// Runs only inside popout-installed.cjs's owned temporary Obsidian vault.
module.exports = async function ({ app, phase, expected }) {
    const assert = require("node:assert/strict"), path = require("node:path");
    assert(path.basename(path.dirname(app.vault.adapter.getBasePath())).startsWith("hub-popout-installed-"));
    let p;
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const until = async (fn, label) => { for (let i = 0; i < 240; i++) { if (await fn()) return; await delay(50); } throw Error("Timed out: " + label); };
    await until(() => {
        p = app.plugins.plugins["hub-project-menu"];
        return p?.preparedNoteRails && app.metadataCache.initialized && app.plugins.plugins.dataview?.index?.initialized;
    }, "Hub startup");
    await delay(1000);
    const modes = p.workspaceModes, bridge = p.atlas, note = "Projects/Fixture/Notes/A.md";
    const files = () => { const values = []; app.workspace.iterateAllLeaves(l => { const file = l.getViewState().state?.file; if (file) values.push(file); }); return values; };
    const settle = async () => { await delay(350); await modes.enqueue(async () => {}); await p.workspaceState.pending; };
    if (phase === "after") {
        await until(() => bridge.view().status === "READY", "Atlas restart");
        assert.equal(bridge.view().snapshot.policyRevision, expected.policyRevision);
        assert.deepEqual(bridge.view().snapshot.policy, expected.policy);
        assert.equal(modes.resolveLastFile().file.path, note);
        assert.equal(app.workspace.getLeavesOfType("webviewer").filter(bridge.isUtilityLeaf).length, 0);
        assert(files().includes("Original.md"), "unrelated note pop-out survives restart");
        assert.equal(app.workspace.getLeavesOfType("webviewer").length, 1, "ordinary webviewer survives restart");
        assert(await modes.openLastFile(null)); await settle();
        assert(files().includes(note));
        assert.equal(app.workspace.getLeavesOfType("webviewer").length, 1, "startup Last File cannot spawn utilities");
        return { restart: true, lastFile: note, ordinaryWindowsPreserved: true, atlasReady: true };
    }
    await until(() => bridge.view().status !== "UNAVAILABLE", "Atlas startup");
    await bridge.command({ kind: "INITIALIZE", policy: { whitelist: ["chatgpt.com", "www.overleaf.com", "overleaf.com"], blacklist: ["blocked.test"] }, configuration: {
        accessTiming: { waitMs: 100, confirmationWindowMs: 10000, grantDurationMs: 60000 }, vaultTiming: { waitMs: 100, confirmationWindowMs: 10000 }, journeyLimits: { lifetimeMs: 60000, maxHops: 4 }
    } });
    assert.equal(bridge.view().status, "READY");
    await until(() => modes.contextForFile(note), "project metadata");
    assert(await modes.openProjectNote(note)); await settle();
    const checks = [], tracked = JSON.stringify(modes.state.lastFile);
    for (const id of ["chatgpt", "overleaf", "google"]) {
        const utility = await p.openAppShortcut(id); await settle();
        assert(bridge.isUtilityLeaf(utility)); assert.equal(modes.isMainLeaf(utility), false);
        // Ordinary updates to the same view do not surrender Hub ownership.
        const state = { ...utility.getViewState().state }; delete state.hubUtility;
        await utility.view.setState(state, {});
        assert(bridge.isUtilityLeaf(utility));
        assert.equal(JSON.stringify(modes.state.lastFile), tracked);
        assert.equal(modes.resolveLastFile().file.path, note);
        const windowCount = window.electron.remote.BrowserWindow.getAllWindows().length;
        assert(await modes.openLastFile(null)); await settle();
        assert(window.electron.remote.BrowserWindow.getAllWindows().length <= windowCount);
        assert.equal(modes.resolveLastFile().file.path, note);
        utility.detach(); await settle();
        assert.equal(JSON.stringify(modes.state.lastFile), tracked);
        checks.push(id + ": open/focus/Last File/close preserves the actual note");
    }
    // Matching URLs and ordinary pop-outs must never imply utility ownership.
    const other = app.workspace.getLeaf("window"); await other.openFile(app.vault.getAbstractFileByPath("Original.md"));
    const ordinary = app.workspace.getLeaf("window"); await ordinary.setViewState({ type: "webviewer", state: { url: "about:blank", atlasHome: true }, active: true });
    assert(!bridge.isUtilityLeaf(ordinary));
    await modes.openProjectNote("Projects/Fixture/Notes/B.md"); await settle();
    assert.equal(modes.resolveLastFile().file.path, "Projects/Fixture/Notes/B.md");
    await modes.openProjectNote(note); await settle();
    for (const id of ["chatgpt", "overleaf", "google"]) await p.openAppShortcut(id);
    await settle();
    const context = modes.contextForFile(note);
    // Force the saved-layout restoration used when returning from Home.
    modes.clearModeClasses(); modes.mode = null;
    assert(await modes.openLastFile(null)); await settle();
    assert(files().includes(note)); assert(files().includes("Original.md"));
    assert.equal(app.workspace.getLeavesOfType("webviewer").filter(bridge.isUtilityLeaf).length, 0);
    assert.equal(app.workspace.getLeavesOfType("webviewer").length, 1);
    checks.push("full Last File layout restoration excludes multiple utilities and retains unrelated windows");
    assert(modes.restorableNoteLayout(context));
    for (const id of ["chatgpt", "overleaf", "google"]) await p.openAppShortcut(id);
    await settle();
    const session = window.electron.remote.session.fromPartition(app.getWebviewPartition());
    const extensions = session.extensions.getAllExtensions().map(e => ({ id: e.id, name: e.name }));
    assert.equal(extensions.some(e => /lastpass/i.test(e.name)), false);
    app.workspace.requestSaveLayout(); await app.workspace.requestSaveLayout.run(); await p.workspaceState.pending;
    assert.equal(modes.resolveLastFile().file.path, note);
    return { checks, policy: bridge.view().snapshot.policy, policyRevision: bridge.view().snapshot.policyRevision,
        environment: { electron: process.versions.electron, partition: app.getWebviewPartition(), extensions }, lastFile: note };
};
