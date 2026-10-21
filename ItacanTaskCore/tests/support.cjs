"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { MemoryStorage, createMemoryRepository, openMemoryRepository } = require("../src");
const { createJsonRepository, openJsonRepository } = require("../src/json-repository");

const owners = { a: { type: "project", id: "shared-a" }, b: { type: "project", id: "shared-b" }, private: { type: "project", id: "private-a" }, resource: { type: "resource", id: "study" } };
const partitions = [
    { id: "git-a", kind: "git-project", owner: owners.a }, { id: "git-b", kind: "git-project", owner: owners.b },
    { id: "private-a", kind: "private-project", owner: owners.private }, { id: "resource-study", kind: "resource", owner: owners.resource }
];
const resolvers = {
    location: ref => ["folder-a", "note-a"].includes(ref.id) ? { ...ref, owner: owners.a } : ref.id === "resource-folder" ? { ...ref, owner: owners.resource } : null,
    phase: ref => ref.projectId === owners.a.id && ref.phaseId === "phase-a" ? ref : null
};
async function disposable() {
    const temporaryRoot = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(temporaryRoot, "itacan-task-test-"));
    const directory = path.join(root, "repository space Å 日本語"); await fs.mkdir(directory);
    return { root, directory, async cleanup() {
        const resolved = await fs.realpath(root);
        if (path.dirname(resolved) !== temporaryRoot || !path.basename(resolved).startsWith("itacan-task-test-")) throw Error("Unsafe test cleanup target.");
        await fs.rm(resolved, { recursive: true, force: true });
    } };
}
async function fixture(kind, t, extra = {}) {
    const disk = kind === "json" ? await disposable() : null, storage = new MemoryStorage(); let tick = 1700000000000;
    const options = { partitions, idFactory: randomUUID, clock: () => tick++, resolvers, ...extra, ...(disk ? { directory: disk.directory } : { storage }) };
    let repo = kind === "json" ? await createJsonRepository(options) : await createMemoryRepository(options);
    const value = { get repo() { return repo; }, directory: disk?.directory, storage, options,
        async close() { await repo.close(); },
        async reopen(overrides = {}) { await repo.close(); repo = kind === "json" ? await openJsonRepository({ ...options, ...overrides }) : await openMemoryRepository({ ...options, ...overrides }); return repo; },
        async cleanup() { try { await repo.close(); } finally { if (disk) await disk.cleanup(); } }
    };
    t?.after(() => value.cleanup()); return value;
}
function create(task = {}, operationId = randomUUID()) { return { operationId, type: "task.create", payload: { task: { owner: owners.a, title: "Task α", ...task } } }; }
function mutate(task, type, payload, operationId = randomUUID()) { return { operationId, type, taskId: task.id, expectedRevision: task.revision, payload }; }
const rejected = (assert, action, code) => assert.rejects(async () => action(), error => error.code === code);
module.exports = { fixture, disposable, owners, partitions, resolvers, create, mutate, rejected, randomUUID };
