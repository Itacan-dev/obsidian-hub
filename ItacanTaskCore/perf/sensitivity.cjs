"use strict";
// Separate controlled History/receipt probes; never runs against the active demo.
const fs = require("node:fs/promises"), path = require("node:path"), { randomUUID } = require("node:crypto");
async function prepareKind(audit, kind) {
        if (!["metadata-receipts", "metadata-noop-receipts", "atomic-receipts"].includes(kind)) throw Error("Closed sensitivity kind required");
        const F = require("./fixtures.cjs"), baselines = JSON.parse(await fs.readFile(path.join(audit, "baselines.json"), "utf8")), base = baselines.find(b => b.count === 1000);
        const directory = await F.copyClosed(base.directory, audit), f = await F.direct(directory);
        try { for (let i = 0; i < 20; i++) { const e = (await f.editor.read({ version: 1, authorityId: f.profile.authorityId, owner: f.profile.registry.owners[0].owner, partitionId: "itacan", taskId: base.taskId })).editor, request = await F.intent(e, kind.startsWith("metadata-") ? "metadata-v1" : "save-noop"); if (kind === "metadata-receipts") request.action.title += " " + i; if (kind === "metadata-noop-receipts") request.action.title = e.draft.metadata.title; const out = await f.service.mutate(request); if (out.status !== "committed") throw Error(JSON.stringify(out)); } } finally { await f.close(); }
        const { state: s } = await F.state(directory), tasks = [...s.tasks, ...s.receipts.flatMap(r => [...r.result.tasks, ...(r.result.task ? [r.result.task] : [])])], description = { ...await F.describe(directory), receiptTaskSnapshots: tasks.length - s.tasks.length, storedContentRevisionOccurrences: tasks.reduce((n, t) => n + (require("../src/source-content").contentOf(t)?.revisions.length ?? 0), 0) };
        await fs.writeFile(path.join(audit, "prepared-" + kind + ".json"), JSON.stringify({ ...base, kind, directory, description }, null, 2));
}
async function prepare(audit) {
    const F = require("./fixtures.cjs"), made = [], { child } = require("./run.cjs");
    for (const kind of ["metadata-receipts", "metadata-noop-receipts", "atomic-receipts"]) {
        await child([__filename, "prepare-kind", audit, kind], audit, "prepare-" + kind);
        made.push(JSON.parse(await fs.readFile(path.join(audit, "prepared-" + kind + ".json"), "utf8")));
    }
    made.push(await prepareEvents(audit));
    await fs.writeFile(path.join(audit, "sensitivity-baselines.json"), JSON.stringify(made, null, 2));
}
async function prepareEvents(audit) {
    const F = require("./fixtures.cjs");
    // Match the baseline's tasks, Steps, content and two-receipt recipe.
    const directory = await fs.mkdtemp(path.join(audit, "event-dense-")); await F.R.initProfile(directory); const f = await F.direct(directory);
    try { const profile = f.profile, owner = profile.registry.owners[0].owner, info = f.session.host.info(), scope = { authorityId: profile.authorityId, ownerContextPin: info.ownerContextPin, identityPin: info.identityPin, inventoryPin: require("../writer/policy").hash(profile.policy.inventory), phasePin: require("../writer/policy").hash(profile.policy.phases), partitions: [{ id: "itacan", owner, expectedRevision: info.head.repositoryRevision }] }, tasks = F.F.bulk(999, owner).map(t => ({ ...t, completed: true, completedAt: null }));
        const result = await f.session.writer.task(f.capability, { version: 1, reason: "Explicit synthetic event-density probe", scope, command: { type: "task.createMany", operationId: randomUUID(), expectedRepositoryRevision: info.head.repositoryRevision, payload: { tasks } } }); if (result.status !== "committed") throw Error(JSON.stringify(result));
    } finally { await f.close(); }
    const r = await F.R.openRuntime(directory); let made;
    try { const c = await r.creationContext(r.info().workspaces[0].owner), draft = F.F.richDraft({ continuation: "Exact synthetic continuation.", steps: F.F.deepSteps() }); draft.metadata.title = "Known profiling target"; made = await r.mutate({ ...c, version: 2, operationId: randomUUID(), reason: "Prepare fixed synthetic profiling tree", action: { kind: "rich-create", draft } }); if (made.status !== "committed") throw Error(JSON.stringify(made)); } finally { await r.close(); }
    return { count: 1000, kind: "event-dense", directory, taskId: made.taskIds[0], description: await F.describe(directory) };
}
async function measure(audit, eventOnly = false) {
    const bases = JSON.parse(await fs.readFile(path.join(audit, "sensitivity-baselines.json"), "utf8")).filter(b => !eventOnly || b.kind === "event-dense"), { child } = require("./run.cjs");
    for (const baseline of bases) for (const scenario of ["list", "editor"]) for (let sample = 0; sample < 3; sample++) {
        const name = "sensitivity-" + baseline.kind + "-" + scenario + "-" + sample, input = { audit, baseline, scenario, mode: "full", instrument: true, output: path.join(audit, name + ".json") }, file = path.join(audit, name + ".input.json"); await fs.writeFile(file, JSON.stringify(input)); await child(["--expose-gc", path.join(__dirname, "worker.cjs"), file], audit, name);
    }
    if (!eventOnly) { const baseline = bases.find(b => b.kind === "metadata-receipts"), name = "profiles-history-list-0", file = path.join(audit, name + ".input.json"); await fs.writeFile(file, JSON.stringify({ audit, baseline, scenario: "list", mode: "full", instrument: true, profile: true, output: path.join(audit, name + ".json") })); await child(["--expose-gc", path.join(__dirname, "worker.cjs"), file], audit, name); }
}
async function measureWrites(audit) {
    const baseline = JSON.parse(await fs.readFile(path.join(audit, "sensitivity-baselines.json"), "utf8")).find(b => b.kind === "metadata-receipts"), { child } = require("./run.cjs");
    for (const scenario of ["complete", "save-title"]) { const name = "profiles-history-" + scenario + "-0", file = path.join(audit, name + ".input.json"); await fs.writeFile(file, JSON.stringify({ audit, baseline, scenario, mode: "full", instrument: true, profile: true, output: path.join(audit, name + ".json") })); await child(["--expose-gc", path.join(__dirname, "worker.cjs"), file], audit, name); }
}
async function main() { const [mode, audit, kind] = process.argv.slice(2); await require("./fixtures.cjs").auditRoot(audit); if (mode === "prepare") await prepare(audit); else if (mode === "prepare-kind") await prepareKind(audit, kind); else if (mode === "measure") await measure(audit); else if (mode === "measure-writes") await measureWrites(audit); else if (mode === "prepare-events") { const value = await prepareEvents(audit), values = JSON.parse(await fs.readFile(path.join(audit, "sensitivity-baselines.json"), "utf8")); await fs.writeFile(path.join(audit, "sensitivity-baselines.json"), JSON.stringify([...values.filter(b => b.kind !== "event-dense"), value], null, 2)); } else if (mode === "measure-events") await measure(audit, true); else throw Error("Explicit sensitivity mode required"); }
if (require.main === module) main().catch(e => { process.stderr.write((e.stack || String(e)) + "\n"); process.exitCode = 1; });
module.exports = { prepare, measure };
