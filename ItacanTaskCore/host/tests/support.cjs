"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../.."), J = require("../../src/json-repository"), V = require("../../src/value");
const held = new Map();
// Test-only interception delegates to the actual constructors, preserving their lease/queue.
for (const name of ["createJsonRepository", "openJsonRepository"]) { const original = J[name]; J[name] = async options => { const repo = await original(options); held.set(options.directory, repo); return repo; }; }
const API = require(".."), O = require("../../oath"), F2 = require("../../oath/completion-proof");
let sequence = 0;
const id = () => "20000000-0000-7000-8000-" + String(process.pid * 1000000 + ++sequence).padStart(12, "0");
const clone = V.clone, same = (a, b) => V.canonical(a) === V.canonical(b);
const owners = [
    ["project", "itacan", "Projects/Itacan", true], ["project", "hub", "Projects/Obsidian Hub", true], ["project", "private", "Projects/Private", false],
    ["resource", "study", "Resources/Knowledge", false], ["resource", "literature", "Resources/Research", false], ["resource", "references", "Resources/Explorations", false], ["resource", "inspiration", "Resources/Inspiration", false]
].map(([type, key, root, shared]) => ({ owner: { type, id: key }, partitionId: key, root, dashboard: root + "/Dashboard.md", shared, available: true, status: "active", shareApproval: null, locations: [], mounts: [] }));
const partitions = owners.map(o => ({ id: o.partitionId, owner: o.owner, kind: o.owner.type === "resource" ? "resource" : o.shared ? "git-project" : "private-project" }));
function registry() {
    const listeners = new Set(), settings = { before: null, unavailable: false };
    let value = { version: 1, registryId: "synthetic-registry", applicationContextId: "synthetic-app", revision: "1", owners: clone(owners) };
    function snapshot() { return { ...clone(value), digest: API.registryDigest(value) }; }
    return { settings, listeners, snapshot, change(fn, notify = true) { fn(value); value.revision = String(Number(value.revision) + 1); if (notify) for (const cb of [...listeners]) cb(); }, async read() { const saved = snapshot(); await settings.before?.(); if (settings.unavailable) throw Error("PRIVATE_REGISTRY_ERROR"); return saved; }, subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); } };
}
async function fixture(t, extra = {}) {
    const directory = extra.directory ?? await fs.mkdtemp(path.join(os.tmpdir(), "itacan-n2-store-")), authorityId = extra.authorityId ?? id(), reg = extra.registry ?? registry();
    const config = { version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId, directory, applicationContextId: "synthetic-app", registryId: "synthetic-registry" };
    const options = { registry: reg, ...(extra.identity ? { identity: extra.identity } : {}), repositoryOptions: { idFactory: id, clock: () => 1800000000000, ...extra.repositoryOptions } };
    const host = API.createNativeRepositoryHost(config, options);
    t?.after(() => host.dispose());
    if (!extra.unopened) await host.create({ version: 1, authorityId, partitions: extra.partitions ?? partitions, reason: "Closed synthetic N2 fixture", syntheticOnly: true });
    const v = { host, config, options, directory, authorityId, reg, get repo() { return held.get(directory); } };
    v.create = async (patch = {}) => (await v.repo.execute({ type: "task.create", operationId: id(), payload: { task: { owner: owners[2].owner, title: "Parent", ...patch } } })).task;
    v.mutate = async (taskId, type, payload, operationId = id()) => v.repo.execute({ type, operationId, taskId, expectedRevision: v.repo.getTask(taskId, { includeDeleted: true }).revision, payload });
    v.read = async (selection = "tasks", patch = {}) => { await host.refresh(); return host.read({ version: 1, authorityId, ownerContextPin: host.info().ownerContextPin, owners: owners.map(o => o.owner), selection, ...patch }); };
    v.target = task => { const i = v.repo.info(); return { version: 1, session: { deviceId: "synthetic-device", oathId: "synthetic-oath" }, original: { kind: "native-task", taskId: task.id, text: "Historical display" }, owner: clone(task.owner), authority: { kind: "native", authorityId, partitionId: task.partitionId, taskId: task.id, enrollment: { repositoryRevision: i.revision, revisionId: i.revisionId, taskRevision: task.revision }, aliasPin: null } }; };
    v.proof = async targets => { const port = API.createCompletionEvidencePort(host); t?.after(() => port.dispose()); await host.refresh(); return port.readCurrentCompletionProof({ version: 1, requestGeneration: 1, authorityId, ownerContextPin: host.info().ownerContextPin, targets, enrollmentCut: null }); };
    v.state = async () => { const m = JSON.parse(await fs.readFile(path.join(directory, "CURRENT.json"), "utf8")).payload; return require("../../src/private-storage-codec").decodePrivateGeneration(await fs.readFile(path.join(directory, m.current.file), "utf8"), authorityId).state; };
    return v;
}
const openArgs = v => ({ version: 1, expectedAuthorityId: v.authorityId, syntheticOnly: true });
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function settle(host) { for (let i = 0; i < 3; i++) { const info = await host.refresh(); if (info.readiness.state === "ready") return info; } return host.info(); }
function f1Evidence(state, reg) { return { format: "itacan-oath-evidence", version: 1, decisionRevision: "N1-F1-F01-F10-r1", privacy: "local-private", scope: "closed-synthetic", registry: reg.snapshot().owners.map(({ dashboard, locations, mounts, ...o }) => o), legacy: null, identity: null, native: { state, readiness: "ready", recovery: { state: "intact", taskIds: [], stepIds: [] } } }; }
module.exports = { fs, path, os, assert, root, J, V, API, O, F2, id, clone, same, owners, partitions, registry, fixture, openArgs, gate, settle, held, f1Evidence };
