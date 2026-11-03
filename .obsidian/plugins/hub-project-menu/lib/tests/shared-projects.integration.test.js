"use strict";
const assert = require("assert/strict"), fs = require("fs"), os = require("os"), path = require("path");
const { HubDataStore } = require("../services/data-store");
const { SHARED_STATE_PATH, selectShared, sharedOwnership, portablePath } = require("../services/shared-projects");
const encode = value => JSON.stringify(value, null, 2) + "\n";

async function run() {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "itacan-shared-"));
    const dataFile = path.join(root, ".obsidian/plugins/hub-project-menu/data.json");
    const sharedFile = path.join(root, SHARED_STATE_PATH);
    const write = async (file, value) => {
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await fs.promises.writeFile(file, typeof value === "string" ? value : encode(value));
    };
    const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
    const plugin = {
        app: { vault: { configDir: ".obsidian", adapter: { getBasePath: () => root } } },
        manifest: { id: "hub-project-menu" },
        loadData: async () => fs.existsSync(dataFile) ? read(dataFile) : null
    };
    try {
        const note = path.join(root, "Projects/Itacan/Itacan.md");
        await write(note, "---\ntype: project\nprojectId: itacan\ncategory: application\n---\n- [ ] Ordinary note checkbox\n");
        await write(path.join(root, "Projects/Personal/Personal.md"), "---\nprojectId: private-project\ncategory: private-category\n---\n# Private note\n");
        const shared = {
            schemaVersion: 1, projects: { itacan: { root: "Projects/Itacan", categoryId: "application" } },
            categories: [{ id: "application", image: "Assets/ProjectCards/wip.jpg" }],
            projectPlanning: { itacan: { version: 1, revision: 1, phases: [{ id: "phase", name: "Phase", start: "2026-10-01", end: "2026-10-31" }], milestones: [{ id: "release", date: "2026-10-31" }] } },
            headerImagePlacements: { "card:project:itacan::Assets/ProjectCards/wip.jpg": { x: 50, y: 40, zoom: 2 } }
        };
        await write(sharedFile, shared);
        // A fresh clone has no personal plugin data at all.
        const store = new HubDataStore(plugin);
        const loaded = await store.load();
        assert.deepEqual(loaded.projectPlanning, shared.projectPlanning);
        assert(loaded.categories.some(category => category.id === "physics-research"), "Built-in categories remain available");

        loaded.workspaceMode = { privatePreset: "keep local" };
        loaded.oathsByDevice = { privateDevice: { current: "keep local" } };
        loaded.inbox = { text: "private capture" };
        loaded.projectPlanning["private-project"] = { private: true };
        loaded.categories.push({ id: "private-category", image: "private/path.jpg" });
        loaded.headerImagePlacements["home::Assets/Covers/day.jpeg"] = { y: 30 };
        loaded.projectPlanning.itacan.phases[0].name = "Changed phase";
        await store.save(loaded);
        const local = read(dataFile), published = read(sharedFile);
        assert.deepEqual(local.workspaceMode, loaded.workspaceMode);
        assert.deepEqual(local.oathsByDevice, loaded.oathsByDevice);
        assert.deepEqual(local.projectPlanning, { "private-project": { private: true } });
        assert.equal(published.projectPlanning.itacan.phases[0].name, "Changed phase");
        assert(!JSON.stringify(published).includes("private"), "No private state is exported");
        const before = fs.readFileSync(sharedFile, "utf8");
        loaded.workspaceMode.privatePreset = "local edit";
        await store.save(loaded);
        assert.equal(fs.readFileSync(sharedFile, "utf8"), before, "Personal edits do not churn the shared file");

        // Checkboxes remain note content and never alter shared task state.
        await fs.promises.appendFile(note, "- [ ] Ordinary checkbox\n");
        await store.save(loaded);
        assert.equal(fs.readFileSync(sharedFile, "utf8"), before);

        const external = read(sharedFile);
        external.projectPlanning.itacan.phases[0].name = "External phase";
        await write(sharedFile, external);
        const localBeforeConflict = fs.readFileSync(dataFile, "utf8");
        await assert.rejects(store.save(loaded), error => error.code === "HUB_STATE_CONFLICT");
        assert.equal(fs.readFileSync(dataFile, "utf8"), localBeforeConflict);
        const reloaded = await new HubDataStore(plugin).load();
        assert.equal(reloaded.workspaceMode.privatePreset, "local edit");
        assert.equal(reloaded.projectPlanning.itacan.phases[0].name,"External phase");

        const retryStore = new HubDataStore(plugin), retryData = await retryStore.load();
        retryData.projectPlanning.itacan.phases[0].name = "Retry phase";
        const atomic = retryStore.atomicWrite.bind(retryStore);
        retryStore.atomicWrite = async (data, file) => {
            if (file === sharedFile) throw Error("Simulated shared disk failure");
            return atomic(data, file);
        };
        await assert.rejects(retryStore.save(retryData), /Simulated shared disk failure/);
        assert.equal(fs.readFileSync(dataFile, "utf8"), localBeforeConflict, "Local write rolls back if shared persistence fails");
        retryStore.atomicWrite = atomic;
        await retryStore.save(retryData);

        assert.equal(read(sharedFile).projectPlanning.itacan.phases[0].name,"Retry phase");

        // Publishing a newly assigned private category selects its image/template only.
        await write(path.join(root, "Assets/ProjectCards/Categories/application.jpg"), "image bytes");
        await write(path.join(root, "System/Project Templates/Application/Project.md"), "template");
        await write(path.join(root, "System/Project Templates/Application/.env"), "secret");
        const category = retryData.categories.find(category => category.id === "application");
        category.image = "Assets/ProjectCards/Categories/application.jpg";
        category.templateFolder = "System/Project Templates/Application";
        await retryStore.save(retryData);
        const exportedCategory = read(sharedFile).categories[0];
        assert.equal(exportedCategory.image, "Assets/ProjectCards/Shared/application.jpg");
        assert.equal(exportedCategory.templateFolder, "System/Project Templates/Shared/application");
        assert(!fs.existsSync(path.join(root, exportedCategory.templateFolder, ".env")));

        for (const invalid of ["C:/Users/user/image.jpg", "file:///tmp/image.jpg", "/tmp/image.jpg", "../private.jpg", "Assets\\image.jpg"]) assert(!portablePath(invalid));
        const ownership = await sharedOwnership(root);
        category.image = "C:/Users/user/image.jpg";
        assert.throws(() => selectShared(retryData, ownership), /non-portable/);
        await write(sharedFile, "{broken");
        await assert.rejects(new HubDataStore(plugin).load(), SyntaxError);
        console.log("PASS: fresh clone, live shared edits, ordinary checkbox isolation and shared planning, private isolation, Git conflicts, failed-write rollback/retry, selected image/template publication, path validation and malformed-state protection.");
    } finally {
        const target=path.resolve(root),temp=path.resolve(os.tmpdir());
        assert(target.startsWith(temp+path.sep)&&path.basename(target).startsWith("itacan-shared-"));
        await fs.promises.rm(target, { recursive: true, force: true });
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
