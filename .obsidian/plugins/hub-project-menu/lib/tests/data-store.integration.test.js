"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    HubDataStore
} = require("..");

async function run() {
    const root = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), "hub-data-store-")
    );
    const directory = path.join(
        root,
        ".obsidian",
        "plugins",
        "hub-project-menu"
    );
    const dataPath = path.join(directory, "data.json");

    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(
        dataPath,
        JSON.stringify({ value: 1 }),
        "utf8"
    );

    const plugin = {
        app: {
            vault: {
                configDir: ".obsidian",
                adapter: {
                    getBasePath: () => root
                }
            }
        },
        manifest: {
            id: "hub-project-menu",
            dir: ".obsidian/plugins/hub-project-menu"
        },
        async loadData() {
            return JSON.parse(
                await fs.promises.readFile(dataPath, "utf8")
            );
        },
        async saveData() {
            throw new Error(
                "Atomic filesystem save should be used."
            );
        }
    };

    try {
        const store = new HubDataStore(plugin);
        const migrated = await store.load();

        assert.strictEqual(migrated.hubState.schemaVersion, 1);
        assert.strictEqual(migrated.hubState.revision, 1);

        const saved = await store.save({ value: 2 });
        assert.strictEqual(saved.hubState.revision, 2);

        const diskData = JSON.parse(
            await fs.promises.readFile(dataPath, "utf8")
        );
        assert.strictEqual(diskData.value, 2);
        assert.strictEqual(diskData.hubState.revision, 2);

        const temporaryFiles = (
            await fs.promises.readdir(directory)
        ).filter(name => name.endsWith(".tmp"));
        assert.deepStrictEqual(temporaryFiles, []);

        const sameRevisionExternalData = {
            ...diskData,
            value: 22
        };
        await fs.promises.writeFile(
            dataPath,
            JSON.stringify(sameRevisionExternalData),
            "utf8"
        );

        await assert.rejects(
            store.save({ value: 23 }),
            error => error.code === "HUB_STATE_CONFLICT"
        );

        assert.deepStrictEqual(
            JSON.parse(
                await fs.promises.readFile(dataPath, "utf8")
            ),
            sameRevisionExternalData
        );

        const externalData = {
            value: 3,
            hubState: {
                schemaVersion: 1,
                revision: 3,
                updatedAt: "2026-09-05T08:00:00.000Z",
                deviceId: "other-device"
            }
        };
        await fs.promises.writeFile(
            dataPath,
            JSON.stringify(externalData),
            "utf8"
        );

        await assert.rejects(
            store.save({ value: 4 }),
            error => error.code === "HUB_STATE_CONFLICT"
        );

        assert.deepStrictEqual(
            JSON.parse(
                await fs.promises.readFile(dataPath, "utf8")
            ),
            externalData
        );

        await fs.promises.writeFile(
            path.join(directory, "data-OTHER-DEVICE.json"),
            JSON.stringify(externalData),
            "utf8"
        );

        const conflicts = await store.findConflictFiles();
        assert.strictEqual(conflicts.length, 1);
        assert.strictEqual(
            conflicts[0].name,
            "data-OTHER-DEVICE.json"
        );

        console.log("Hub atomic data-store tests passed.");
    } finally {
        await fs.promises.rm(root, {
            recursive: true,
            force: true
        });
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
