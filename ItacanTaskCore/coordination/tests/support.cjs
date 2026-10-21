"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), sync = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."), plugin = path.join(root, ".obsidian/plugins/hub-project-menu"), { HubDataStore } = require(path.join(plugin, "lib/services/data-store"));
const clone = structuredClone, sha = value => crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
const gate = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function record(id, result) { const file = path.join(__dirname, "observations-v1.json"); if (sync.existsSync(file)) { const frozen = JSON.parse(sync.readFileSync(file, "utf8")); const row = frozen.rows.find(r => r.id === id); assert(row, "Unaccounted executed observation: " + id); assert.deepEqual(result, row.result, "Frozen executed observation drift: " + id); } const parent = process.env.ITACAN_N3C0_AUDIT; if (!parent) return; const dir = path.join(parent, "observations"); sync.mkdirSync(dir, { recursive: true }); sync.writeFileSync(path.join(dir, id + ".json"), JSON.stringify({ id, evidenceClass: "executed-existing-implementation", result }, null, 2)); }
async function guarded(directory) { const real = await fs.realpath(directory), temp = await fs.realpath(os.tmpdir()), rel = path.relative(temp, real); assert(rel && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel)); return real; }
async function application(t, { shared = false, directory = null, initial = null } = {}) {
    directory ??= await fs.mkdtemp(path.join(os.tmpdir(), "itacan-c0-app-")); await guarded(directory);
    const dataDirectory = path.join(directory, "plugin"), file = path.join(dataDirectory, "data.json"), sharedFile = path.join(directory, "System/Hub-shared-projects.json");
    await fs.mkdir(dataDirectory, { recursive: true });
    if (shared) {
        for (const [folder, id] of [["Itacan", "itacan"], ["Obsidian Hub", "hub"]]) { const dir = path.join(directory, "Projects", folder); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, folder + ".md"), `---\nprojectId: ${id}\nstatus: shelved\n---\n- [ ] Same <!-- hub-task:${id}-task -->\n`); }
        await fs.mkdir(path.dirname(sharedFile), { recursive: true });
        await fs.writeFile(sharedFile, JSON.stringify({ schemaVersion: 1, projects: { itacan: { root: "Projects/Itacan", categoryId: null }, hub: { root: "Projects/Obsidian Hub", categoryId: null } }, categories: [], projectPlanning: {}, taskMetadata: {}, headerImagePlacements: {} }));
    }
    const host = { app: { vault: { configDir: ".obsidian", adapter: { getBasePath: () => directory } } }, manifest: { dir: dataDirectory }, loadData: async () => JSON.parse(await fs.readFile(file, "utf8")), saveData: async () => { throw Error("Fallback forbidden in disk evidence"); } };
    const store = new HubDataStore(host); store.deviceId = "synthetic-device";
    if (initial !== null) await fs.writeFile(file, JSON.stringify(initial)); else await store.save({ unrelated: { sentinel: "keep" }, categories: [], projectPlanning: {}, taskMetadata: {}, inbox: { version: 1, captures: [] } });
    const data = await store.load();
    const result = { directory, file, sharedFile, store, host, data, read: async () => JSON.parse(await fs.readFile(file, "utf8")), reload: () => new HubDataStore(host).load(), async cleanup() { await store.writeQueue.catch(() => {}); await guarded(directory); await fs.rm(directory, { recursive: true }); } };
    t?.after(() => result.cleanup()); return result;
}
function participant(role = "native", state = "confirmed", patch = {}) { const operationId = role + "-operation", intentDigest = "b".repeat(64); return { authorityId: role + "-authority", operationId, intentDigest, state, basis: role === "native" ? "native-receipt" : "filesystem-readback", receipt: state === "confirmed" ? { operationId, intentDigest, revision: 2, headDigest: "c".repeat(64) } : null, ...patch }; }
function observation(patch = {}) { return { version: 1, privacy: "local-private", id: "case", kind: "inbox-task", sourceIdentity: "capture-id", preparationDigest: "a".repeat(64), preparation: "confirmed", originalIntent: "retained", authority: "matched", recovery: "intact", source: "unchanged", proof: "not-required", protocol: "observed-existing", native: [participant()], application: [participant("application")], ...patch }; }
module.exports = { assert, fs, sync, path, os, crypto, root, plugin, HubDataStore, clone, sha, gate, record, guarded, application, participant, observation };
