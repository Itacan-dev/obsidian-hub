"use strict";

const fs = require("fs");
const path = require("path");
const {
    createHash,
    randomUUID
} = require("crypto");

// Explicit managed construction bypasses legacy device/vault/shared initialization.
const managedStores = new WeakMap();
function recognizedManaged(data) {
    return data?.format === "itacan-application-transactions" ||
        Array.isArray(data?.capabilities) && data.capabilities.includes("scoped-application-transactions-v1");
}
function refuseManaged(store, data) {
    if (managedStores.has(store) || recognizedManaged(data)) {
        const error = new Error("Managed application data requires scoped transactions.");
        error.code = "MANAGED_TRANSACTIONS_REQUIRED"; throw error;
    }
}
async function refuseManagedFile(store, filePath) {
    refuseManaged(store);
    if (!filePath) return;
    try { refuseManaged(store, JSON.parse(await fs.promises.readFile(filePath, "utf8"))); }
    catch (error) { if (error.code === "ENOENT" || error instanceof SyntaxError) return; throw error; }
}
function createTransactionalApplicationStore(config) {
    const managed = require("./application-storage/transactions").createManagedApplicationStore(config);
    const store = Object.create(HubDataStore.prototype);
    managedStores.set(store, managed); return store;
}
const HUB_STATE_SCHEMA_VERSION = 1;
const HUB_STATE_META_KEY = "hubState";
const DEVICE_STORAGE_KEY = "obsidian-hub::device-id";
const { SharedProjectStore } = require("./shared-projects");

function clonePluginData(data) {
    return JSON.parse(JSON.stringify(data ?? {}));
}

// Retire only the old task relationship, leaving Resource mounts, ownership,
// history and task identities intact. Cleanup rides normal load/save boundaries.
function removeRetiredTaskLinks(data) {
    for (const metadata of Object.values(data.taskMetadata ?? {})) {
        if (metadata && typeof metadata === "object") delete metadata.linkedProjectId;
    }
    for (const capture of Array.isArray(data.inbox?.captures) ? data.inbox.captures : []) {
        if (capture?.intent) delete capture.intent.linkedProjectId;
        if (capture?.operation?.values) delete capture.operation.values.linkedProjectId;
    }
    return data;
}

function stateMeta(data) {
    const value = data?.[HUB_STATE_META_KEY];

    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function stateSignature(data) {
    const meta = stateMeta(data);
    const contentHash = createHash("sha256")
        .update(JSON.stringify(data ?? {}))
        .digest("hex");

    return [
        Number(meta.revision) || 0,
        String(meta.updatedAt ?? ""),
        String(meta.deviceId ?? ""),
        contentHash
    ].join("|");
}

function localDeviceId() {
    try {
        const existing = globalThis.localStorage?.getItem(
            DEVICE_STORAGE_KEY
        );

        if (existing) {
            return existing;
        }

        const created = randomUUID();
        globalThis.localStorage?.setItem(
            DEVICE_STORAGE_KEY,
            created
        );
        return created;
    } catch (_) {
        return randomUUID();
    }
}

function delay(milliseconds) {
    return new Promise(resolve =>
        setTimeout(resolve, milliseconds)
    );
}

class HubStateConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = "HubStateConflictError";
        this.code = "HUB_STATE_CONFLICT";
    }
}

class HubDataStore {
    constructor(plugin) {
        this.plugin = plugin;
        this.writeQueue = Promise.resolve();
        this.deviceId = localDeviceId();
        this.lastRevision = 0;
        this.lastDiskSignature = null;
        this.sharedProjects = new SharedProjectStore(plugin.app?.vault?.adapter?.getBasePath?.());
    }

    create(...args) { const managed = managedStores.get(this); if (!managed) throw new Error("Transactional mode was not explicitly constructed."); return managed.create(...args); }
    open(...args) { const managed = managedStores.get(this); if (!managed) throw new Error("Transactional mode was not explicitly constructed."); return managed.open(...args); }
    readScopes(...args) { const managed = managedStores.get(this); if (!managed) throw new Error("Transactional mode was not explicitly constructed."); return managed.readScopes(...args); }
    transact(...args) { const managed = managedStores.get(this); if (!managed) throw new Error("Transactional mode was not explicitly constructed."); return managed.transact(...args); }
    reconcile(...args) { const managed = managedStores.get(this); if (!managed) throw new Error("Transactional mode was not explicitly constructed."); return managed.reconcile(...args); }
    close(...args) { const managed = managedStores.get(this); if (!managed) throw new Error("Transactional mode was not explicitly constructed."); return managed.close(...args); }

    pluginDirectoryPath() {
        refuseManaged(this);
        const adapter = this.plugin.app?.vault?.adapter;
        const basePath = adapter?.getBasePath?.();

        if (!basePath) {
            return null;
        }

        const configuredDirectory =
            this.plugin.manifest?.dir;
        const pluginId =
            this.plugin.manifest?.id ??
            "hub-project-menu";
        const relativeDirectory =
            configuredDirectory &&
            (
                path.isAbsolute(configuredDirectory) ||
                /[\\/]/.test(configuredDirectory)
            )
                ? configuredDirectory
                : `${this.plugin.app.vault.configDir}/plugins/${configuredDirectory ?? pluginId}`;

        return path.isAbsolute(relativeDirectory)
            ? relativeDirectory
            : path.join(
                basePath,
                ...String(relativeDirectory).split(/[\\/]+/)
            );
    }

    dataFilePath() {
        refuseManaged(this);
        const directory = this.pluginDirectoryPath();
        return directory
            ? path.join(directory, "data.json")
            : null;
    }

    normalizeLoadedData(data) {
        refuseManaged(this, data);
        const normalized = clonePluginData(data);
        const meta = stateMeta(normalized);
        const schemaVersion = Number(meta.schemaVersion) || 0;

        if (schemaVersion > HUB_STATE_SCHEMA_VERSION) {
            throw new Error(
                `Hub data schema ${schemaVersion} is newer than this plugin supports.`
            );
        }

        normalized[HUB_STATE_META_KEY] = {
            schemaVersion: HUB_STATE_SCHEMA_VERSION,
            revision: Number(meta.revision) || 0,
            updatedAt: meta.updatedAt ?? null,
            deviceId: meta.deviceId ?? null
        };

        this.lastRevision =
            normalized[HUB_STATE_META_KEY].revision;
        this.lastDiskSignature = stateSignature(data);

        return normalized;
    }

    async load() {
        refuseManaged(this);
        const data = (await this.plugin.loadData()) ?? {};
        const originalMeta = stateMeta(data);
        const normalized = removeRetiredTaskLinks(await this.sharedProjects.load(this.normalizeLoadedData(data)));
        const requiresVersionStamp =
            Number(originalMeta.schemaVersion) !==
                HUB_STATE_SCHEMA_VERSION ||
            !Number.isInteger(
                Number(originalMeta.revision)
            ) ||
            !originalMeta.updatedAt ||
            !originalMeta.deviceId;

        if (!requiresVersionStamp) {
            return normalized;
        }

        try {
            return await this.save(normalized);
        } catch (error) {
            this.loadWarning = error;
            console.error(
                "Could not add version metadata to Hub data:",
                error
            );
            return normalized;
        }
    }

    async readDiskData() {
        refuseManaged(this);
        const filePath = this.dataFilePath();

        if (!filePath) {
            return null;
        }

        try {
            return JSON.parse(
                await fs.promises.readFile(filePath, "utf8")
            );
        } catch (error) {
            if (error.code === "ENOENT") {
                return {};
            }

            throw error;
        }
    }

    assertDiskRevisionUnchanged(diskData) {
        if (!diskData || this.lastDiskSignature === null) {
            return;
        }

        const diskSignature = stateSignature(diskData);

        if (diskSignature !== this.lastDiskSignature) {
            throw new HubStateConflictError(
                "Hub data changed on disk after it was loaded. Reload Obsidian and run “Audit Hub data” before saving again."
            );
        }
    }

    versionSnapshot(snapshot, diskData) {
        refuseManaged(this, snapshot);
        refuseManaged(this, diskData);
        const snapshotRevision =
            Number(stateMeta(snapshot).revision) || 0;
        const diskRevision =
            Number(stateMeta(diskData).revision) || 0;
        const revision = Math.max(
            snapshotRevision,
            diskRevision,
            this.lastRevision
        ) + 1;

        snapshot[HUB_STATE_META_KEY] = {
            schemaVersion: HUB_STATE_SCHEMA_VERSION,
            revision,
            updatedAt: new Date().toISOString(),
            deviceId: this.deviceId
        };

        return snapshot;
    }

    async atomicWrite(snapshot, filePath = this.dataFilePath()) {
        refuseManaged(this, snapshot);
        await refuseManagedFile(this, filePath);

        if (!filePath) {
            await this.plugin.saveData(snapshot);
            return;
        }

        const directory = path.dirname(filePath);
        const temporaryPath = path.join(
            directory,
            `.data.${process.pid}.${randomUUID()}.tmp`
        );
        const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
        let handle = null;

        try {
            await fs.promises.mkdir(directory, { recursive: true });
            handle = await fs.promises.open(
                temporaryPath,
                "wx"
            );
            await handle.writeFile(serialized, "utf8");
            await handle.sync();
            await handle.close();
            handle = null;

            const retryDelays = [0, 40, 120, 240];
            let lastError;

            for (const wait of retryDelays) {
                if (wait) {
                    await delay(wait);
                }

                try {
                    await refuseManagedFile(this, filePath);
                    await fs.promises.rename(
                        temporaryPath,
                        filePath
                    );
                    return;
                } catch (error) {
                    lastError = error;
                }
            }

            throw lastError;
        } finally {
            await handle?.close().catch(() => {});
            await fs.promises.unlink(temporaryPath)
                .catch(error => {
                    if (error.code !== "ENOENT") {
                        console.warn(
                            "Could not remove temporary Hub data file:",
                            error
                        );
                    }
                });
        }
    }

    save(data) {
        refuseManaged(this, data);
        const snapshot = removeRetiredTaskLinks(clonePluginData(data));

        const operation = this.writeQueue
            .catch(() => {})
            .then(async () => {
                const diskData = await this.readDiskData();
                refuseManaged(this, diskData);
                this.assertDiskRevisionUnchanged(diskData);

                const versioned = this.versionSnapshot(
                    snapshot,
                    diskData
                );

                const prepared = await this.sharedProjects.prepare(versioned);
                const local = prepared?.local ?? versioned;
                await this.atomicWrite(local);
                try {
                    if (prepared && prepared.text !== this.sharedProjects.lastText.replace(/\r\n/g, "\n")) {
                        await this.atomicWrite(prepared.shared, this.sharedProjects.filePath);
                        this.sharedProjects.lastText = prepared.text;
                    }
                } catch (error) {
                    // A failed shared write must not report success or advance the local revision.
                    await this.atomicWrite(diskData ?? {});
                    throw error;
                }

                this.lastRevision =
                    versioned[HUB_STATE_META_KEY].revision;
                this.lastDiskSignature = stateSignature(local);

                return clonePluginData(versioned);
            });

        this.writeQueue = operation;
        return operation;
    }

    async findConflictFiles() {
        refuseManaged(this);
        const directory = this.pluginDirectoryPath();

        if (!directory) {
            return [];
        }

        const entries = await fs.promises.readdir(
            directory,
            { withFileTypes: true }
        );
        const conflicts = [];

        for (const entry of entries) {
            if (
                !entry.isFile() ||
                entry.name === "data.json" ||
                !/^data.+\.json$/i.test(entry.name)
            ) {
                continue;
            }

            const filePath = path.join(directory, entry.name);
            const stats = await fs.promises.stat(filePath);
            let data = null;
            let parseError = null;

            try {
                data = JSON.parse(
                    await fs.promises.readFile(filePath, "utf8")
                );
            } catch (error) {
                parseError = error.message;
            }

            const meta = stateMeta(data);

            conflicts.push({
                name: entry.name,
                modifiedAt: stats.mtime.toISOString(),
                size: stats.size,
                schemaVersion: Number(meta.schemaVersion) || null,
                revision: Number(meta.revision) || null,
                updatedAt: meta.updatedAt ?? null,
                deviceId: meta.deviceId ?? null,
                parseError
            });
        }

        return conflicts.sort((left, right) =>
            right.modifiedAt.localeCompare(left.modifiedAt)
        );
    }
}

module.exports = {
    createTransactionalApplicationStore,
    DEVICE_STORAGE_KEY,
    HUB_STATE_META_KEY,
    HUB_STATE_SCHEMA_VERSION,
    HubDataStore,
    HubStateConflictError,
    clonePluginData,
    stateMeta,
    stateSignature
};
