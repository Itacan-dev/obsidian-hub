"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), { randomUUID } = require("node:crypto");
const { pathToFileURL } = require("node:url"), { pinRoot } = require("../host/authority");
const R = require("../demo/runtime.cjs"), F = require("../demo/fixtures.cjs"), P = require("../writer/policy"), V = require("../src/value");
async function auditRoot(directory) { await pinRoot(directory); const names = await fs.readdir(directory); if (names.some(name => ["profile.json", "CURRENT.json", "RECOVERY.json", "WRITER.lock", "RECURRENCE-FENCE.json"].includes(name) || /^gen-\d+-.*\.json$/.test(name))) throw Error("Profiling output must be separate from repository/profile roots"); }
async function state(directory) {
    const repository = path.join(directory, "repository"), pointer = JSON.parse(await fs.readFile(path.join(repository, "CURRENT.json"), "utf8"));
    const raw = await fs.readFile(path.join(repository, pointer.payload.current.file), "utf8");
    return { state: require("../src/private-storage-codec").decodePrivateGeneration(raw, pointer.payload.storeId).state, generationBytes: Buffer.byteLength(raw) };
}
async function describe(directory) {
    const { state: s, generationBytes } = await state(directory); let repositoryBytes = 0;
    for (const name of await fs.readdir(path.join(directory, "repository"))) repositoryBytes += (await fs.stat(path.join(directory, "repository", name))).size;
    return { tasks: s.tasks.length, steps: s.tasks.reduce((n, t) => n + t.steps.length, 0), events: s.history.length, bindings: s.bindings.length, receipts: s.receipts.length, contentRevisions: s.tasks.reduce((n, t) => n + (require("../src/source-content").contentOf(t)?.revisions.length ?? 0), 0), recurrence: s.recurrence?.version ?? null, import: s.historyImport?.version ?? null, generationBytes, repositoryBytes, revision: s.revision };
}
async function copyClosed(source, parent) {
    await pinRoot(source); await auditRoot(parent);
    if ((await fs.readdir(path.join(source, "repository"))).includes("WRITER.lock")) throw Error("Cannot clone a held synthetic authority");
    const directory = await fs.mkdtemp(path.join(parent, "sample-")); await pinRoot(directory); await fs.mkdir(path.join(directory, "repository"));
    await fs.copyFile(path.join(source, "profile.json"), path.join(directory, "profile.json"));
    for (const name of await fs.readdir(path.join(source, "repository"))) {
        const from = path.join(source, "repository", name), stat = await fs.lstat(from);
        if (!stat.isFile() || stat.isSymbolicLink() || name.endsWith(".lock") || name.endsWith(".tmp")) throw Error("Baseline has nonclosed evidence");
        await fs.copyFile(from, path.join(directory, "repository", name));
    }
    return directory;
}
async function prepare(audit, count) {
    await auditRoot(audit); const directory = await fs.mkdtemp(path.join(audit, "baseline-" + count + "-")); await R.initProfile(directory);
    // Explicit diagnostic-only policy, before seeding. No existing/active profile is used.
    const file = path.join(directory, "profile.json"), { digest: ignored, ...body } = JSON.parse(await fs.readFile(file, "utf8")); body.policy.commands.push("task.update");
    await fs.writeFile(file, JSON.stringify({ ...body, digest: P.hash(body) }, null, 2));
    const r = await R.openRuntime(directory); let made;
    try {
        const owner = r.info().workspaces[0].owner; await r.seedBulk(count - 1, owner); const c = await r.creationContext(owner);
        const draft = F.richDraft({ continuation: "Exact synthetic continuation.", steps: F.deepSteps() }); draft.metadata.title = "Known profiling target";
        made = await r.mutate({ ...c, version: 2, operationId: randomUUID(), reason: "Prepare fixed synthetic profiling tree", action: { kind: "rich-create", draft } });
        if (made.status !== "committed") throw Error(JSON.stringify(made));
    } finally { await r.close(); }
    return { count, directory, taskId: made.taskIds[0], description: await describe(directory) };
}
async function direct(directory, instrument, fault) {
    const p = await R.readProfile(directory), session = require("../writer").createNativeWriterSession({ version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId: p.authorityId, directory: path.join(directory, "repository"), applicationContextId: p.registry.applicationContextId, registryId: p.registry.registryId }, { registry: { read: async () => V.clone(p.registry), subscribe: () => () => {} }, writerPolicy: p.policy, repositoryOptions: { idFactory: randomUUID, clock: Date.now, fault } });
    await session.host.open({ version: 1, expectedAuthorityId: p.authorityId, syntheticOnly: true });
    const capability = await session.authorize({ version: 1, owners: p.policy.owners, commands: p.policy.commands });
    const writer = Object.fromEntries(["task", "step", "recurrence"].map(k => [k, instrument ? instrument.wrap("boundary.writer." + k, (...args) => session.writer[k](...args)) : (...args) => session.writer[k](...args)]));
    const app = require("../application"), service = app.createApplicationMutationService({ taskService: { capabilities: () => ({ backend: "native" }) }, adapter: app.createNativeApplicationAdapter({ authority: { backend: "native", authorityId: p.authorityId, applicationContextId: p.registry.applicationContextId }, host: session.host, writer, capability }) });
    const editor = require("../host/editor-read").createNativeEditorReadPort(session.host, { writerPolicy: p.policy });
    return { session, capability, writer, service, profile: p, editor, async close() { service.dispose(); session.revoke(capability); await session.dispose(); } };
}
async function intent(editor, scenario) {
    if (["list", "editor", "http-editor"].includes(scenario)) return null;
    if (!["save-noop", "save-necessity", "save-title", "save-description", "save-date", "save-content", "save-step-title", "save-step-add", "save-step-delete", "save-nested", "save-parent-complete", "complete", "reopen", "rich-simple", "rich-tree", "metadata-v1", "ordinary-create", "http-save"].includes(scenario)) throw Error("Unknown diagnostic scenario");
    const M = await import(pathToFileURL(path.join(__dirname, "../demo/public/model.mjs")).href), m = M.editModel(editor);
    if (scenario.startsWith("rich-")) { const model = M.newModel({ authority: editor.authority, owner: editor.owner, guard: editor.guard }); model.metadata.title = "Profile rich creation"; if (scenario === "rich-tree") { model.continuation = "New synthetic content"; for (const s of F.deepSteps()) model.steps.push({ ...s, completed: s.initial.completed }); model.completed = true; } return M.buildIntent(model, randomUUID()); }
    const v1 = action => ({ version: 1, operationId: randomUUID(), reason: "Fixed diagnostic " + scenario, authority: editor.authority, owner: editor.owner, guard: editor.guard, action });
    const target = { taskId: editor.taskId, expectedTaskRevision: editor.taskRevision };
    if (scenario === "complete" || scenario === "reopen") return v1({ kind: "set-completion", target, completed: scenario === "complete" });
    if (scenario === "metadata-v1") return v1({ kind: "edit-title", target, title: "One title changed" });
    if (scenario === "ordinary-create") return v1({ kind: "create", draft: { title: "Ordinary profile creation", description: "", necessity: null, start: null, due: null, location: null, phase: null, steps: [], completed: false } });
    if (scenario === "save-necessity") m.metadata.importance = "must";
    if (scenario === "save-title") m.metadata.title = "One title changed";
    if (scenario === "save-description") m.metadata.description = "Changed description";
    if (scenario === "save-date") m.metadata.due = { date: "2026-12-20", time: null };
    if (scenario === "save-content") m.continuation = "Changed continuation";
    if (scenario === "save-step-title") m.steps[0].title = "Changed Step";
    if (scenario === "save-step-add") { const id = M.addStep(m); m.steps.find(s => s.id === id).title = "One new Step"; }
    if (scenario === "save-step-delete") M.removeStep(m, m.steps.at(-1).id);
    if (scenario === "save-nested") { m.steps[0].title = "Changed first Step"; m.steps[1].body = "Changed inner body"; const id = M.addStep(m, m.steps[1].id); m.steps.find(s => s.id === id).title = "New nested Step"; }
    if (scenario === "save-parent-complete") { m.metadata.title = "Complete with metadata"; m.completed = true; }
    return M.buildIntent(m, randomUUID());
}
module.exports = { R, F, V, state, describe, copyClosed, prepare, direct, intent, pinRoot, auditRoot };
