"use strict";

const { createHash } = require("crypto");
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === "object" && !Array.isArray(value);
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function emptyWorkspaceState() {
    return { version: 3, currentMode: null, lastProjectId: null, lastResourceId: null,
        lastWorkspaceId: null, lastFile: null, projects: {}, presets: [] };
}

// Keep legacy input as a recovery snapshot. A shared import ledger prevents
// another machine's stale localStorage from resurrecting deleted presets.
function migrateWorkspaceState(data, storage, vaultName) {
    const result = copy(data);
    const hadWorkspace = object(result.workspaceMode);
    result.workspaceMode = { ...emptyWorkspaceState(), ...(hadWorkspace ? result.workspaceMode : {}) };
    result.folderUi = object(result.folderUi) ? result.folderUi : {};
    const legacy = { workspaceMode: null, folderUi: {}, lastProjectId: null };
    const read = key => {
        const raw = storage?.getItem(key);
        if (!raw) return null;
        try { const value = JSON.parse(raw); return object(value) ? value : null; }
        catch (_) { throw Error(`Cannot migrate malformed Hub state (${key}). The original has been preserved.`); }
    };
    legacy.workspaceMode = read(`obsidian-hub::workspace-mode::${vaultName}`);
    legacy.lastProjectId = storage?.getItem(`obsidian-hub::last-project::${vaultName}`) ?? null;
    const prefix = `obsidian-hub::folder-ui::${vaultName}::`;
    for (let index = 0; index < (storage?.length ?? 0); index++) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) legacy.folderUi[key.slice(prefix.length)] = read(key) ?? {};
    }
    if (!legacy.workspaceMode && !legacy.lastProjectId && !Object.keys(legacy.folderUi).length) return result;

    const ledger = result.workspaceMigration ??= { version: 1, sources: {}, presetIds: [] };
    const signature = hash(legacy);
    if (Object.hasOwn(ledger.sources, signature)) return result;
    const known = new Set(ledger.presetIds);
    if (!hadWorkspace && legacy.workspaceMode) {
        result.workspaceMode = { ...emptyWorkspaceState(), ...copy(legacy.workspaceMode), presets: [] };
    }
    const presets = result.workspaceMode.presets ??= [];
    const currentIds = new Set(presets.map(preset => preset.id));
    for (const preset of legacy.workspaceMode?.presets ?? []) {
        if (!object(preset)) continue;
        const id = typeof preset.id === "string" && preset.id ? preset.id : `legacy-${hash(preset)}`;
        if (!known.has(id) && !currentIds.has(id)) {
            presets.push({ ...copy(preset), id });
            currentIds.add(id);
        }
        known.add(id);
    }
    if (!hadWorkspace && !result.workspaceMode.lastProjectId && legacy.lastProjectId) {
        result.workspaceMode.lastProjectId = legacy.lastProjectId;
        result.workspaceMode.lastWorkspaceId ??= legacy.lastProjectId;
    }
    for (const [id, folders] of Object.entries(legacy.folderUi)) {
        if (!Object.hasOwn(result.folderUi, id)) result.folderUi[id] = copy(folders);
    }
    ledger.sources[signature] = legacy;
    ledger.presetIds = [...known];
    return result;
}

class HubWorkspaceState {
    constructor(plugin) { this.plugin = plugin; this.pending = Promise.resolve(); }
    get data() { return this.plugin.projectWizard.data; }
    async initialize(storage = globalThis.localStorage) {
        const next = migrateWorkspaceState(this.data, storage, this.plugin.app.vault.getName());
        if (JSON.stringify(next) === JSON.stringify(this.data)) return;
        // Commit migration before exposing it; failed writes leave legacy input intact.
        await this.plugin.dataStore.save(next);
        // Preserve references held by the other services sharing plugin data.
        for (const key of ["workspaceMode", "folderUi", "workspaceMigration"]) {
            if (Object.hasOwn(next, key)) this.data[key] = next[key];
        }
    }
    load() { return copy(this.data.workspaceMode ?? emptyWorkspaceState()); }
    folders(id) { return copy(this.data.folderUi?.[id] ?? {}); }
    save(state) { return this.write("workspaceMode", state); }
    saveFolders(id, folders) { return this.write("folderUi", { ...this.data.folderUi, [id]: copy(folders) }); }
    write(key, value) {
        const snapshot = copy(value);
        if (JSON.stringify(this.data[key]) === JSON.stringify(snapshot)) return this.pending;
        this.data[key] = snapshot;
        this.pending = this.plugin.dataStore.save(this.data);
        // Navigation and drag handlers are synchronous. Always surface errors,
        // while leaving the rejecting promise available to callers that await it.
        this.pending.catch(error => {
            console.error("Could not save Hub workspace state:", error);
            new (require("obsidian").Notice)(`Hub state was not saved. ${error.message}`, 12000);
        });
        return this.pending;
    }
}

module.exports = { HubWorkspaceState, emptyWorkspaceState, migrateWorkspaceState };
