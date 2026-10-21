"use strict";
// Test only. Parent termination pauses around delegated existing storage operations.
const H = require("./support.cjs"), { NodeDirectory } = require("../../src/node-directory"), os = require("node:os");
const [directory, authorityId, mode, stage, signalFile] = process.argv.slice(2);
let armed = mode === "create" || mode === "recover", reached = false;
async function pause(label) {
    if (reached || label !== stage) return;
    reached = true;
    const raw = await H.fs.readFile(H.path.join(directory, "WRITER.lock"), "utf8").catch(() => null);
    await H.fs.writeFile(signalFile, JSON.stringify({ stage: label, pid: process.pid, host: os.hostname(), lock: raw, token: raw ? JSON.parse(raw).token : null }));
    await new Promise(() => { setInterval(() => {}, 1000); });
}
for (const method of ["acquire", "release"]) { const original = NodeDirectory.prototype[method]; NodeDirectory.prototype[method] = async function (...args) { if (method === "release") await pause("close-beforeRelease"); const result = await original.apply(this, args); if (method === "acquire") await pause("open-afterAcquire"); else await pause("close-afterRelease"); return result; }; }
(async () => {
    const registry = H.registry();
    if (mode === "recover") registry.change(value => { for (const o of value.owners) { o.partitionId = require("../../tests/history-import-support.cjs").partitions.find(p => H.same(p.owner, o.owner)).id; o.locations = [{ type: "folder", id: "folder-" + o.partitionId }]; } }, false);
    const host = H.API.createNativeRepositoryHost({ version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId, directory, applicationContextId: "synthetic-app", registryId: "synthetic-registry" }, { registry, repositoryOptions: { idFactory: H.id, clock: () => 1800000000000, fault: async label => { if (armed) await pause(label); } } });
    if (mode === "create") await host.create({ version: 1, authorityId, partitions: H.partitions, reason: "Parent terminated synthetic creation", syntheticOnly: true });
    else await host.open({ version: 1, expectedAuthorityId: authorityId, syntheticOnly: true });
    await pause("open-ready");
    if (mode === "complete") { armed = true; const repo = H.held.get(directory), task = repo.queryTasks()[0]; await repo.execute({ type: "task.complete", operationId: "child-completion", taskId: task.id, expectedRevision: task.revision, payload: { completed: true } }); }
    if (mode === "read") { armed = true; await host.refresh(); }
    await host.close(); throw Error("Requested interruption stage was not reached.");
})().catch(error => { process.stderr.write(String(error.stack) + "\n"); process.exitCode = 1; });
