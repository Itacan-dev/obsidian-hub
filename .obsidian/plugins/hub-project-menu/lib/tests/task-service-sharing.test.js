"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
const { fixture, restoreObsidianStub } = require("./task-service-fixture.cjs");
const { HubDataStore } = require("../services/data-store");
const { SHARED_PROJECT_ROOTS, SHARED_STATE_PATH, sharedOwnership } = require("../services/shared-projects");
after(restoreObsidianStub);

async function sharedFixture(t) {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-task-facade-"));
    const root = path.join(parent, "synthetic vault Å 日本語"); await fs.mkdir(root);
    const write = async (relative, text) => { const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text, "utf8"); };
    const dataPath = ".obsidian/plugins/hub-project-menu/data.json";
    const read = async relative => JSON.parse(await fs.readFile(path.join(root, relative), "utf8"));
    const f = fixture({ mirror: write });
    t.after(async () => {
        await f.close();
        // Recursive cleanup is confined to this test's verified mkdtemp root.
        const resolved = path.resolve(parent), temp = path.resolve(os.tmpdir());
        assert.equal(path.dirname(resolved).toLowerCase(), temp.toLowerCase());
        assert(path.basename(resolved).startsWith("itacan-task-facade-"));
        await fs.rm(resolved, { recursive: true, force: true });
    });
    for (const owner of f.owners) {
        const id = owner.contextKind === "resource" ? "resource-task" : owner.projectId + "-task";
        const note = owner.contextKind === "resource" ? owner.root + "/Mounted/Notes.md" : owner.path;
        const text = (owner.contextKind === "project" ? `---\nprojectId: ${owner.projectId}\ncategory: application\n---\n` : "") +
            `- [ ] ${owner.name} task <!-- hub-task:${id} -->\n`;
        f.add(note, text); await write(note, text);
    }
    const shared = { schemaVersion: 1, projects: { itacan: { root: "Projects/Itacan", categoryId: "application" }, hub: { root: "Projects/Obsidian Hub", categoryId: "application" } },
        categories: [{ id: "application", name: "Application" }], projectPlanning: {}, headerImagePlacements: {},
        taskMetadata: { "itacan-task": { necessity: "must", description: "Shared Itacan" }, "hub-task": { necessity: "should", dueDate: "2026-10-31" } } };
    await write(SHARED_STATE_PATH, JSON.stringify(shared, null, 2) + "\n");
    await write(dataPath, JSON.stringify({ taskMetadata: { "itacan-task": { description: "Stale local override" }, "private-task": { description: "Local private" }, "resource-task": { description: "Local Resource", necessity: "must" } } }));
    f.plugin.app.vault.configDir = ".obsidian";
    f.plugin.app.vault.adapter = { getBasePath: () => root };
    f.plugin.manifest = { id: "hub-project-menu" };
    f.plugin.loadData = async () => read(dataPath);
    const store = new HubDataStore(f.plugin);
    f.wizard.data = await store.load(); f.plugin.dataStore = store; f.wizard.store = store;
    return { ...f, root, write, read, dataPath };
}

test("actual local/shared store resolution and both allowlisted Projects remain authoritative", async t => {
    const f = await sharedFixture(t);
    assert.deepEqual(SHARED_PROJECT_ROOTS, ["Projects/Itacan", "Projects/Obsidian Hub"]);
    const expectations = [["private-task", "Local private", "private"], ["itacan-task", "Shared Itacan", "itacan"], ["hub-task", "", "hub"], ["resource-task", "Local Resource", "study"]];
    for (const [id, description, owner] of expectations) {
        const dto = await f.service.getTask(f.handle(id));
        assert.equal(dto.description, description); assert.equal(dto.owner.id, owner);
    }
    assert.equal((await f.service.getTask(f.handle("itacan-task"))).importance, "must");
    assert.deepEqual((await f.service.getTask(f.handle("hub-task"))).due, { date: "2026-10-31", time: null });
    const local = await f.read(f.dataPath);
    assert.equal(Object.hasOwn(local.taskMetadata, "itacan-task"), false);
    assert.equal(Object.hasOwn(local.taskMetadata, "hub-task"), false);
    assert.equal(local.taskMetadata["resource-task"].description, "Local Resource");
    const ownership = await sharedOwnership(f.root);
    assert(ownership.taskIds.has("itacan-task") && ownership.taskIds.has("hub-task"));
    assert(!ownership.taskIds.has("private-task") && !ownership.taskIds.has("resource-task"));
});

test("adapter metadata writes use the actual Git partition while mounted Resource writes remain private", async t => {
    const f = await sharedFixture(t);
    const sharedBefore = await fs.readFile(path.join(f.root, SHARED_STATE_PATH), "utf8");
    for (const id of ["resource-task", "private-task"]) {
        const edit = await f.service.readEditable(f.handle(id));
        await f.service.saveEditable(edit.token, { ...edit.draft, description: "Private edited " + id });
    }
    assert.equal(await fs.readFile(path.join(f.root, SHARED_STATE_PATH), "utf8"), sharedBefore);
    assert.deepEqual((await f.service.queryVisible({ type: "project", id: "itacan" })).map(task => task.existingId), ["itacan-task"]);
    const resource = await f.service.queryOwned({ type: "resource", id: "study" });
    assert.equal(resource[0].existingId, "resource-task"); assert.equal(resource[0].owner.type, "resource");
    for (const id of ["itacan-task", "hub-task"]) {
        const edit = await f.service.readEditable(f.handle(id));
        await f.service.saveEditable(edit.token, { ...edit.draft, description: "Shared edited " + id });
    }
    const local = await f.read(f.dataPath), shared = await f.read(SHARED_STATE_PATH);
    assert.deepEqual(Object.keys(shared.taskMetadata).sort(), ["hub-task", "itacan-task"]);
    for (const id of ["itacan-task", "hub-task"]) {
        assert.equal(shared.taskMetadata[id].description, "Shared edited " + id);
        assert.equal(Object.hasOwn(local.taskMetadata, id), false);
    }
    for (const id of ["private-task", "resource-task"]) assert.equal(local.taskMetadata[id].description, "Private edited " + id);
});

test("existing shared-state conflict remains a typed failure and rolls back the source write", async t => {
    const f = await sharedFixture(t), edit = await f.service.readEditable(f.handle("itacan-task"));
    const sourceBefore = f.contents.get(edit.task.source.locator.path), localBefore = await fs.readFile(path.join(f.root, f.dataPath), "utf8");
    const external = await f.read(SHARED_STATE_PATH); external.taskMetadata["itacan-task"].description = "External Git update";
    const externalText = JSON.stringify(external, null, 2) + "\n"; await f.write(SHARED_STATE_PATH, externalText);
    await assert.rejects(f.service.saveEditable(edit.token, { ...edit.draft, title: "Rejected" }), error => error.code === "STATE_CONFLICT" && error.cause.code === "HUB_STATE_CONFLICT");
    assert.equal(f.contents.get(edit.task.source.locator.path), sourceBefore);
    assert.equal(await fs.readFile(path.join(f.root, f.dataPath), "utf8"), localBefore);
    assert.equal(await fs.readFile(path.join(f.root, SHARED_STATE_PATH), "utf8"), externalText);
});
