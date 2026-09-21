"use strict";

const assert = require("assert");
const {
    auditHubData,
    auditWorkspaceState,
    calculateHomeMomentum,
    completedTaskText,
    createFileDomain,
    findProjectForPath,
    findResourceByReference,
    HubDataStore,
    localISODate,
    normalizeFocusItems,
    normalizeShortcutOrder,
    parseLocalISODate,
    reduceActivityLog,
    slugify,
    validateFocusItems
} = require("..");

assert.strictEqual(localISODate(new Date(2026, 8, 4)), "2026-09-04");
assert.strictEqual(parseLocalISODate("2026-02-30"), null);
assert.strictEqual(slugify("Quantum Gravitational Phenomena"), "quantum-gravitational-phenomena");
assert.deepStrictEqual(normalizeShortcutOrder(["zotero", "zotero", "bad"]), ["zotero", "overleaf", "chatgpt", "google"]);
assert.deepStrictEqual(normalizeFocusItems(["  Read paper  "]), [{ text: "Read paper", projectId: null, projectName: null }]);
assert.throws(() => validateFocusItems([{ text: "Work", projectId: null }]));
assert.strictEqual(calculateHomeMomentum([]), 0);
assert.strictEqual(calculateHomeMomentum([3]), 3);
assert.strictEqual(calculateHomeMomentum([4, 1]), 4);
assert.ok(calculateHomeMomentum([2, 2]) > 2);
assert.strictEqual(completedTaskText("- [x] Finished\r"), "Finished");
assert.strictEqual(completedTaskText("- [ ] Pending"), null);

const fileDomain = createFileDomain({
    getByPath: path => path === "Projects/A/Note.md"
});

assert.strictEqual(
    fileDomain.availableExternalFilePath(
        "Projects/A",
        "Note.md"
    ),
    "Projects/A/Note 2.md"
);
assert.deepStrictEqual(
    fileDomain.selectedRootPaths([
        "Projects/A/Folder/Note.md",
        "Projects/A/Folder",
        "Projects/A/Other.md"
    ]),
    ["Projects/A/Folder", "Projects/A/Other.md"]
);
assert.strictEqual(
    findProjectForPath(
        [
            { projectId: "a", root: "Projects/A", path: "Projects/A/A.md" },
            { projectId: "b", root: "Projects/A/Nested", path: "Projects/A/Nested/Nested.md" }
        ],
        "Projects/A/Nested/Note.md"
    ).projectId,
    "b"
);
assert.strictEqual(
    findResourceByReference(
        [{ id: "study", root: "Resources/Knowledge", hubPath: "Resources/Knowledge/Knowledge.md" }],
        "resource:study"
    ).id,
    "study"
);

const foldedActivity = reduceActivityLog(
    [
        {
            action: "created",
            path: "Projects/A/Untitled.md",
            title: "Untitled",
            project: "A",
            timestamp: 1
        }
    ],
    {
        action: "renamed",
        oldPath: "Projects/A/Untitled.md",
        path: "Projects/A/Result.md",
        title: "Result"
    },
    { timestamp: 2 }
);

assert.strictEqual(foldedActivity.length, 1);
assert.strictEqual(foldedActivity[0].action, "created");
assert.strictEqual(foldedActivity[0].title, "Result");

const auditResult = auditHubData(
    {
        categories: [
            {
                id: "category-a",
                resourceFolders: ["folder-a", "missing-folder"]
            }
        ],
        resourceFolders: {
            "folder-a": {
                id: "wrong-id",
                resourceType: "study",
                path: "Resources/Knowledge/Physics"
            }
        },
        projectCardOrder: {
            active: ["project-a", "deleted-project"],
            future: ["project-a"],
            shelved: []
        },
        projectWorkRatings: {
            "project-a": { "2026-09-04": 2 },
            "deleted-project": { "2026-09-03": 1 }
        },
        projectWorkLogs: {
            "deleted-project": {
                "2026-09-03": { summary: "Old work" }
            }
        },
        dirtyContexts: {
            "2026-09-04": {
                projects: ["project-a", "deleted-project"],
                resources: ["study"],
                resolvedAt: 10
            }
        }
    },
    {
        projects: [
            { projectId: "project-a", status: "active" }
        ],
        resourceTypes: [
            { id: "study" }
        ],
        existingResourceFolderPaths: new Set([
            "Resources/Knowledge/Physics"
        ]),
        makeId: () => "replacement-id",
        now: "2026-09-05T00:00:00.000Z"
    }
);

assert.ok(auditResult.changed);
assert.deepStrictEqual(
    auditResult.repairedData.categories[0].resourceFolders,
    ["folder-a"]
);
assert.strictEqual(
    auditResult.repairedData.resourceFolders["folder-a"].id,
    "folder-a"
);
assert.deepStrictEqual(
    auditResult.repairedData.projectCardOrder,
    {
        active: ["project-a"],
        future: [],
        shelved: []
    }
);
assert.ok(
    auditResult.repairedData
        .hubAuditArchive
        .orphanedProjectProgress["deleted-project"]
);
assert.deepStrictEqual(
    auditResult.repairedData.dirtyContexts["2026-09-04"],
    {
        projects: ["project-a"],
        resources: ["study"],
        resolvedAt: 10,
        updatedAt: null
    }
);

const workspaceAudit = auditWorkspaceState(
    {
        currentMode: "broken",
        lastProjectId: "deleted-project",
        lastResourceId: "study",
        lastFile: {
            path: "Projects/A/Missing.md",
            contextKind: "project",
            contextId: "project-a"
        },
        projects: {
            "project-a": {
                lastNotePath: "Projects/A/Missing.md"
            },
            "deleted-project": {}
        }
    },
    {
        validProjectIds: new Set(["project-a"]),
        validResourceIds: new Set(["study"]),
        pathExists: () => false
    }
);

assert.ok(workspaceAudit.changed);
assert.strictEqual(workspaceAudit.repairedState.currentMode, null);
assert.strictEqual(workspaceAudit.repairedState.lastProjectId, null);
assert.strictEqual(workspaceAudit.repairedState.lastFile, null);
assert.deepStrictEqual(
    workspaceAudit.repairedState.projects,
    { "project-a": {} }
);

async function testSerializedDataStore() {
    const writes = [];
    let finishFirstWrite;

    const store = new HubDataStore({
        async loadData() {
            return {
                loaded: true,
                hubState: {
                    schemaVersion: 1,
                    revision: 7,
                    updatedAt: "2026-09-04T12:00:00.000Z",
                    deviceId: "test-device"
                }
            };
        },
        async saveData(data) {
            writes.push(data);

            if (writes.length === 1) {
                await new Promise(resolve => {
                    finishFirstWrite = resolve;
                });
            }
        }
    });

    assert.deepStrictEqual(
        await store.load(),
        {
            loaded: true,
            hubState: {
                schemaVersion: 1,
                revision: 7,
                updatedAt: "2026-09-04T12:00:00.000Z",
                deviceId: "test-device"
            }
        }
    );

    const firstData = { nested: { value: 1 } };
    const firstSave = store.save(firstData);
    firstData.nested.value = 99;
    const secondSave = store.save({ nested: { value: 2 } });

    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(writes.length, 1);
    assert.deepStrictEqual(
        writes[0].nested,
        { value: 1 }
    );
    assert.strictEqual(writes[0].hubState.revision, 8);

    finishFirstWrite();
    await Promise.all([firstSave, secondSave]);

    assert.deepStrictEqual(
        writes.map(write => write.nested),
        [
            { value: 1 },
            { value: 2 }
        ]
    );
    assert.deepStrictEqual(
        writes.map(write => write.hubState.revision),
        [8, 9]
    );

    const migratedWrites = [];
    const migrationStore = new HubDataStore({
        async loadData() {
            return { legacy: true };
        },
        async saveData(data) {
            migratedWrites.push(data);
        }
    });
    const migrated = await migrationStore.load();

    assert.strictEqual(migrated.hubState.schemaVersion, 1);
    assert.strictEqual(migrated.hubState.revision, 1);
    assert.strictEqual(migratedWrites.length, 1);
}

testSerializedDataStore()
    .then(() => {
        console.log("Hub domain tests passed.");
    })
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
