"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), { randomUUID } = require("node:crypto");
const V = require("../src/value"), { check } = require("../src/errors"), { freeze } = require("../src/snapshot-read"), P = require("../writer/policy");
const { pinRoot } = require("../host/authority"), { validateRegistry } = require("../host/registry"), { createNativeWriterSession } = require("../writer"), { createNativeReadAdapter } = require("../host"), { createNativeEditorReadPort } = require("../host/editor-read");
const App = require("../application"), I = require("../application/intents"), { TaskService } = require("../../.obsidian/plugins/hub-project-menu/lib/services/task-service"), F = require("./fixtures.cjs");
async function readProfile(directory) {
    check(typeof directory === "string" && path.isAbsolute(directory) && !directory.startsWith("\\\\"), "Explicit absolute local Temp profile required.");
    await pinRoot(directory); const file = path.join(directory, "profile.json"), stat = await fs.lstat(file); check(stat.isFile() && !stat.isSymbolicLink(), "Ordinary profile descriptor required.");
    const p = JSON.parse(await fs.readFile(file, "utf8")); V.jsonValue(p); V.fields(p, ["version", "scope", "authorityId", "repository", "registry", "policy", "labels", "digest"], ["version", "scope", "authorityId", "repository", "registry", "policy", "labels", "digest"]);
    check(p.version === 1 && p.scope === "disposable-native-demo" && p.repository === "repository", "Unsupported demo profile."); V.uuid(p.authorityId);
    const { digest, ...body } = p; check(digest === P.hash(body), "Profile configuration changed."); P.policy(p.policy);
    validateRegistry(p.registry, { registryId: p.registry.registryId, applicationContextId: p.registry.applicationContextId });
    check(p.labels.length === p.registry.owners.length && p.labels.every(l => typeof l.label === "string" && p.registry.owners.some(o => P.same(o.owner, l.owner) && o.partitionId === l.partitionId)), "Invalid workspace labels.");
    await pinRoot(path.join(directory, "repository")); return freeze(V.clone(p));
}
async function initProfile(directory) {
    if (!directory) directory = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-demo-"));
    check(typeof directory === "string" && path.isAbsolute(directory) && !directory.startsWith("\\\\"), "Explicit absolute local Temp profile required.");
    await pinRoot(directory); check((await fs.readdir(directory)).length === 0, "Explicit initialization requires an empty Temp directory.");
    const authorityId = randomUUID(), c = F.configuration(authorityId), body = { version: 1, scope: "disposable-native-demo", authorityId, repository: "repository", ...c };
    const profile = { ...body, digest: P.hash(body) }; await fs.mkdir(path.join(directory, "repository"));
    await fs.writeFile(path.join(directory, "profile.json"), JSON.stringify(profile, null, 2) + "\n", { flag: "wx" });
    const r = await openRuntime(directory, { creating: true }); await r.close(); return directory;
}
async function openRuntime(directory, options = {}) {
    const profile = await readProfile(directory), policy = profile.policy, config = { version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId: profile.authorityId, directory: path.join(directory, "repository"), applicationContextId: profile.registry.applicationContextId, registryId: profile.registry.registryId };
    const registry = { read: async () => V.clone(profile.registry), subscribe: () => () => {} };
    const session = createNativeWriterSession(config, { registry, writerPolicy: policy, repositoryOptions: { idFactory: randomUUID, clock: Date.now, ...options.repositoryOptions } });
    try {
        if (options.creating) await session.host.create({ version: 2, authorityId: profile.authorityId, partitions: profile.registry.owners.map(o => ({ id: o.partitionId, owner: o.owner, kind: o.owner.type === "resource" ? "resource" : "private-project" })), reason: "Explicit isolated native demo initialization", syntheticOnly: true, taskMutationVersion: 1 });
        else await session.host.open({ version: 1, expectedAuthorityId: profile.authorityId, syntheticOnly: true });
    } catch (e) { await session.dispose().catch(() => {}); throw e; }
    const taskService = new TaskService(createNativeReadAdapter(session.host)), editorPort = createNativeEditorReadPort(session.host, { writerPolicy: policy });
    const authority = freeze({ backend: "native", authorityId: profile.authorityId, applicationContextId: profile.registry.applicationContextId }), operations = new Map(); let closed = false;
    const workspace = owner => { const o = profile.registry.owners.find(x => P.same(x.owner, owner)); check(o, "Unknown synthetic workspace."); return o; };
    async function capture(owner) {
        check(!closed, "Demo is closed."); workspace(owner);
        const r = await session.host.readScoped({ version: 2, authorityId: profile.authorityId, owners: [owner], selection: "tasks" });
        check(r.status === "ok" && r.snapshot.readiness.state === "ready", "Coherent read unavailable."); return r;
    }
    const guard = (r, owner) => ({ expectedRepositoryRevision: r.stamp.head.repositoryRevision, ownerContextPin: r.stamp.ownerContextPin, identityPin: r.stamp.identityPin, inventoryPin: P.hash(policy.inventory), phasePin: P.hash(policy.phases), partitions: r.snapshot.partitions.filter(p => P.same(p.owner, owner)).map(p => ({ id: p.id, owner: p.owner, expectedRevision: p.revision })) });
    async function dispatch(intent) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const capability = await session.authorize({ version: 1, owners: policy.owners, commands: policy.commands });
            const service = App.createApplicationMutationService({ taskService, adapter: App.createNativeApplicationAdapter({ authority, host: session.host, writer: session.writer, capability }) });
            let out; try { out = await service.mutate(intent); } finally { service.dispose(); session.revoke(capability); }
            if (out.status === "rejected" && out.code === "WRITER_CAPABILITY_REVOKED" && attempt === 0) continue;
            return out;
        }
    }
    async function mutate(input) {
        check(!closed, "Demo is closed."); const compiled = I.compile(input), intent = compiled.intent;
        check(P.same(intent.authority, authority) && policy.owners.some(o => P.same(o.owner, intent.owner)), "Wrong demo authority.");
        check(intent.version === 2 && ["rich-create", "full-save"].includes(intent.action.kind) || intent.version === 1 && ["set-completion", "delete-tree"].includes(intent.action.kind), "Demo action unavailable.");
        const digest = P.hash(intent), old = operations.get(intent.operationId);
        if (old && old.digest !== digest) return freeze({ version: 1, status: "conflict", code: "OPERATION_CONFLICT", operationId: intent.operationId });
        const uncertain = [...operations.values()].find(e => e.result?.status === "uncertain" && e.intent.operationId !== intent.operationId);
        if (uncertain) return freeze({ version: 1, status: "uncertain", code: "OUTCOME_RECONCILIATION_REQUIRED", operationId: uncertain.intent.operationId, retry: "identical-operation-after-authoritative-reconciliation" });
        if (old?.promise) return old.promise;
        // In-memory request retention only. No new journal or restart promise.
        const entry = old ?? { digest, intent }; operations.set(intent.operationId, entry);
        entry.promise = dispatch(entry.intent).catch(() => ({ version: 1, status: "uncertain", code: "OUTCOME_RECONCILIATION_REQUIRED", operationId: intent.operationId, retry: "identical-operation-after-authoritative-reconciliation" })).then(result => { entry.result = freeze(result); entry.promise = null; return entry.result; });
        return entry.promise;
    }
    const api = {
        info() { return freeze({ version: 1, scope: "disposable-native-demo", authority, workspaces: profile.labels, readiness: session.host.info().readiness, pending: [...operations.values()].filter(o => o.promise || o.result?.status === "uncertain").map(o => ({ operationId: o.intent.operationId, state: o.promise ? "pending" : "uncertain" })) }); },
        async list(owner) { const r = await capture(owner); return freeze({ version: 1, stamp: r.stamp, tasks: r.snapshot.tasks }); },
        async creationContext(owner) { const r = await capture(owner); return freeze({ version: 1, authority, owner: V.clone(owner), guard: guard(r, owner) }); },
        editor(taskId, owner) { const o = workspace(owner); return editorPort.read({ version: 1, authorityId: profile.authorityId, owner: o.owner, partitionId: o.partitionId, taskId }); },
        mutate,
        async reconcile(operationId) { const e = operations.get(operationId); if (!e) return freeze({ version: 1, status: "uncertain", operationId, code: "ORIGINAL_REQUEST_UNAVAILABLE", retry: "review" }); return mutate(e.intent); },
        async seedBulk(count, owner) {
            check(Number.isInteger(count) && count >= 0 && count <= 10000, "Bounded synthetic population required."); if (!count) return;
            const r = await capture(owner), g = guard(r, owner), capability = await session.authorize({ version: 1, owners: policy.owners, commands: ["task.createMany"] });
            try { const { expectedRepositoryRevision, ...scope } = g; const result = await session.writer.task(capability, { version: 1, reason: "Explicit bounded synthetic benchmark seed", scope: { authorityId: profile.authorityId, ...scope }, command: { type: "task.createMany", operationId: randomUUID(), expectedRepositoryRevision, payload: { tasks: F.bulk(count, owner) } } }); check(result.status === "committed", "Synthetic population did not commit."); } finally { session.revoke(capability); }
        },
        async close() { if (closed) return; closed = true; await Promise.allSettled([...operations.values()].map(o => o.promise).filter(Boolean)); await taskService.close(); await session.dispose(); operations.clear(); }
    };
    return Object.freeze(api);
}
async function seedExamples(runtime) {
    const workspaces = runtime.info().workspaces;
    for (let i = 0; i < workspaces.length; i++) {
        const c = await runtime.creationContext(workspaces[i].owner), draft = F.richDraft();
        draft.metadata.title = i === 0 ? "Make room for a small next step" : "Explore " + workspaces[i].label;
        draft.metadata.description = "Synthetic task · no Markdown note or real vault data.";
        draft.metadata.importance = i % 3 === 0 ? "must" : i % 3 === 1 ? "should" : null;
        draft.metadata.due = { date: "2026-11-01", time: i % 2 ? null : "09:00" };
        if (i === 0) { draft.continuation = "A native task can have content without a source note."; draft.steps = F.deepSteps(); }
        if (i === 1) draft.initial = { completed: true, completedAt: null };
        const out = await runtime.mutate({ ...c, version: 2, operationId: randomUUID(), reason: "Synthetic demo example", action: { kind: "rich-create", draft } });
        check(out.status === "committed", "Example creation requires review.");
    }
}
module.exports = { readProfile, initProfile, openRuntime, seedExamples };
