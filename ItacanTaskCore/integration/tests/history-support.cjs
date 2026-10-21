"use strict";
const S = require("./support.cjs"), E = require("../../tests/history-import-support.cjs"), V = S.V;
const { createHistoryReadPort } = require("../../host/history-read"), { createCompletionFeed, account } = require("../completion-feed");
const lib = "../../../.obsidian/plugins/hub-project-menu/lib/", stats = require(lib + "domain/statistics"), { readStatistics } = require(lib + "services/statistics");
const delay = ms => new Promise(r => setTimeout(r, ms));
function legacyPort(records = []) { let value = V.clone(records), revision = 1; const listeners = new Set(); return { async read() { return { version: 1, revision: String(revision), records: V.clone(value) }; }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, change(next) { value = V.clone(next); revision++; listeners.forEach(fn => fn()); }, get records() { return V.clone(value); } }; }
async function fixture(t, extra = {}) {
    const f = await S.fixture(t, { historyUiV1: true, consumerUiV1: true, ...extra }), legacy = legacyPort(extra.records ?? []);
    const port = createHistoryReadPort(f.session.host, { authorityId: f.config.authorityId, owners: [f.owner] }), feed = createCompletionFeed({ native: port, legacy, navigate: target => ({ kind: "native-task", taskId: target.taskId, owner: target.owner }) });
    t.after(() => { feed.dispose(); port.dispose(); });
    return { ...f, get runtime() { return f.runtime; }, legacy, port, feed, async create(values = {}) { const i = await f.intent(values); S.assert.equal((await f.runtime.mutate(i)).status, "committed"); await delay(40); return (await f.runtime.list()).tasks.at(-1); },
        async complete(taskId, completed = true, stepId = null, at) { const i = S.B.complete(await f.runtime.editor(taskId), completed, stepId); if (at !== undefined) i.action.completedAt = at; const out = await f.runtime.mutate(i); S.assert.equal(out.status, "committed"); await delay(40); return { intent: i, out }; },
        async read() { for (let i = 0; i < 5; i++) { try { return await feed.read(); } catch (e) { if (i === 4) throw e; await delay(30); } } }
    };
}
async function imported(t, capture, extra = {}) {
    const v = await E.imported("json", null, capture, extra); const state = await E.stateOf(v.f); await v.f.close();
    const regBody = { version: 1, registryId: "history-import", applicationContextId: "history-import", revision: "1", owners: E.partitions.map(p => {
        const evidence = v.capture.registry.find(r => V.canonical(r.owner) === V.canonical(p.owner));
        return { owner: p.owner, partitionId: p.id, root: evidence.root, dashboard: evidence.root + "/Dashboard.md", status: "active", available: true, shared: p.kind === "git-project", shareApproval: null,
            locations: state.tasks.filter(t => V.canonical(t.owner) === V.canonical(p.owner) && t.location).map(t => t.location), mounts: [] };
    }) };
    const registry = { read: async () => ({ ...V.clone(regBody), digest: S.H.registryDigest(regBody) }), subscribe: () => () => {} };
    const host = S.H.createNativeRepositoryHost({ version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId: state.storeId, applicationContextId: "history-import", registryId: "history-import", directory: v.f.directory }, { registry, repositoryOptions: { externalReservations: v.inventory, historyImportEvidence: { version: 1, mode: "closed-synthetic", read: () => v.current }, resolvers: v.f.options.resolvers } });
    await host.open({ version: 1, expectedAuthorityId: state.storeId, syntheticOnly: true });
    const repo = S.repositories.at(-1), port = createHistoryReadPort(host, { authorityId: state.storeId, owners: E.partitions.map(p => p.owner) }), legacy = legacyPort(v.capture.history), feed = createCompletionFeed({ native: port, legacy });
    t.after(async () => { feed.dispose(); port.dispose(); await host.dispose(); await v.f.cleanup(); });
    return { ...v, host, repo, port, legacy, feed, async state() { return (await require("../../src/private-storage-codec").decodePrivateGeneration(await S.fs.readFile(S.path.join(v.f.directory, JSON.parse(await S.fs.readFile(S.path.join(v.f.directory, "CURRENT.json"), "utf8")).payload.current.file), "utf8"), state.storeId)).state; } };
}
module.exports = { ...S, E, V, lib, stats, readStatistics, delay, legacyPort, fixture, imported, account };
