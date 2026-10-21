"use strict";
// Evidence-only composition. No proposed command dispatcher, codec or validator.
const assert = require("node:assert/strict"), fs = require("node:fs"), fsp = fs.promises, path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../.."), graph = require("./source-graph-v1.json"), vectors = require("./decision-vectors-v1.json");
const core = require("../../src"), J = require("../../src/json-repository"), C = require("../../src/private-storage-codec"), V = require("../../src/value"), content = require("../../src/source-content");
const base = require("../../tests/support.cjs"), imports = require("../../tests/history-import-support.cjs"), recurrence = require("../../tests/recurrence-generation-support.cjs");
const H = bytes => crypto.createHash("sha256").update(bytes).digest("hex"), clone = structuredClone;
const id = n => "10000000-0000-4000-8000-" + n.toString(16).padStart(12, "0"), NOW = 1792300000000;
function factory(start = 10000) { let n = start; return () => id(++n); }
async function fixture(t, extra = {}) { return base.fixture("memory", t, { storeId: id(1), idFactory: factory(), clock: () => NOW, ...extra }); }
async function create(f, patch = {}, operationId = "create") { return f.repo.execute({ type: "task.create", operationId, payload: { task: { owner: base.owners.a, title: "Parent", ...patch } } }); }
function mutation(task, type, payload, operationId = type) { return { type, operationId, taskId: task.id, expectedRevision: task.revision, payload }; }
function structure(task, patch = {}) {
 const c = content.contentOf(task), current = c?.revisions.at(-1).current;
 return { version: 1, draft: { version: 1, taskId: task.id, expectedRevision: task.revision, steps: task.steps.map(s => ({ state: "existing", id: s.id, parentStepId: s.parentStepId, order: s.order, title: s.title, body: current?.stepBodies.find(b => b.id === s.id)?.body ?? "", completed: s.completed })) }, deletions: [], taskPatch: {}, content: { version: 1, expectedRevision: c?.revisions.length ?? 0, appendOriginals: [], continuation: current?.continuation ?? "" }, ...patch };
}
function record(name, facts) {
 const value = { version: 1, phase: "N3-B2-A", evidenceClass: "executed-existing-implementation", name, proposedCommandsExecuted: false, ...facts };
 if (process.env.ITACAN_N3B2A_AUDIT) { const p = path.join(process.env.ITACAN_N3B2A_AUDIT, "observations"); fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, name + ".json"), JSON.stringify(value, null, 2)); }
 return value;
}
async function temporary(t) {
 const temp = await fsp.realpath(os.tmpdir()), directory = await fsp.mkdtemp(path.join(temp, "itacan-n3b2a-reader-"));
 t.after(async () => { const real = await fsp.realpath(directory); assert.equal(path.dirname(real), temp); assert(path.basename(real).startsWith("itacan-n3b2a-reader-")); await fsp.rm(real, { recursive: true, force: true }); }); return directory;
}
function checkedDestination(directory, relative) { const dest = path.resolve(directory, relative); assert(dest.startsWith(path.resolve(directory) + path.sep)); return dest; }
async function materializeReader(directory, name) {
 const selected = graph.readers[name]; assert(selected);
 if (name === "preB2Private") {
  const out = path.join(directory, "pre-b2");
  for (const f of graph.files.filter(f => f.path.startsWith(selected.closurePrefix))) { const dest = checkedDestination(out, f.path); const bytes = Buffer.from(f.base64, "base64"); assert.equal(H(bytes), f.sha256); await fsp.mkdir(path.dirname(dest), { recursive: true }); await fsp.writeFile(dest, bytes); }
  return path.join(out, selected.entry);
 }
 const item = graph.files.find(f => f.path === selected.fixture); assert(item); const bytes = Buffer.from(item.base64, "base64"); assert.equal(H(bytes), item.sha256); const fixture = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, "")), files = selected.graph === null ? fixture.files : fixture.graphs.find(g => g.name === selected.graph).files;
 const out = path.join(directory, name); await fsp.mkdir(out, { recursive: true });
 for (const f of files) { assert.equal(H(f.text).toLowerCase(), f.sha256.toLowerCase()); const dest = checkedDestination(out, f.path); await fsp.mkdir(path.dirname(dest), { recursive: true }); await fsp.writeFile(dest, f.text); }
 return path.join(out, "json-repository.js");
}
async function fileHashes(directory) { const result = {}; for (const n of (await fsp.readdir(directory)).sort()) { const p = path.join(directory, n); if ((await fsp.stat(p)).isFile()) result[n] = H(await fsp.readFile(p)); } return result; }
async function preserveGolden(name, directory) {
 if (!process.env.ITACAN_N3B2A_AUDIT) return;
 const destination = path.join(process.env.ITACAN_N3B2A_AUDIT, "reader-goldens", name); await fsp.mkdir(destination, { recursive: true }); const files = [];
 for (const n of (await fsp.readdir(directory)).sort()) { const file = path.join(directory, n); if (!(await fsp.stat(file)).isFile()) continue; const bytes = await fsp.readFile(file); await fsp.writeFile(path.join(destination, n), bytes); files.push({ path: n, byteLength: bytes.length, sha256: H(bytes) }); }
 await fsp.writeFile(path.join(destination, "golden-inventory.json"), JSON.stringify({ version: 1, evidenceClass: "proposed-golden-not-new-codec-output", files }, null, 2));
}
/** Proposed goldens only: derive valid old bytes with the actual old codec, then
 * set explicit proposed envelope discriminants. Never claim new codec output. */
async function goldenRoot(t, mode = "manifest", schema = 1) {
 const directory = await temporary(t); let state, oldState;
 if (schema === 4) { const v = await imports.fixture("memory", t, undefined, { idFactory: factory(30000) }); oldState = clone(v.f.storage.state); await v.f.repo.execute(imports.prepare(v)); state = await imports.stateOf(v.f); }
 else { const f = await fixture(t); oldState = clone(f.storage.state); await create(f); state = clone(f.storage.state); }
 const oldBarrier = C.makeBarrier(oldState.storeId, 1, null), currentBarrier = C.makeBarrier(state.storeId, schema, state.historyImport ? imports.I.scopeOf(state) : null);
 const oldWire = C.encodePrivateGeneration(oldState, oldBarrier), currentWire = C.encodePrivateGeneration(state, currentBarrier), oldDescriptor = { file: `gen-${oldState.revision}-${oldState.revisionId}.json`, sha256: J.digest(oldWire), revision: oldState.revision, revisionId: oldState.revisionId, parentRevisionId: oldState.parentRevisionId };
 const oldManifest = { format: "itacan-task-manifest", schemaVersion: 4, storeId: state.storeId, retention: 4, current: oldDescriptor, ancestry: [] };
 const oldRaw = C.encodePrivateManifest(oldManifest, oldBarrier), proposedBarrier = { ...currentBarrier, version: 2, requiredCapabilities: [...currentBarrier.requiredCapabilities, "atomic-task-mutations-v1"] };
 let wire = JSON.parse(currentWire), m = JSON.parse(oldRaw).payload;
 wire.receipts.version = 2; wire.receipts.barrier = proposedBarrier;
 const proposedGeneration = V.canonical(wire) + "\n", descriptor = { file: `gen-${state.revision}-${state.revisionId}.json`, sha256: J.digest(proposedGeneration), revision: state.revision, revisionId: state.revisionId, parentRevisionId: state.parentRevisionId };
 m.current = descriptor; m.ancestry.entries = [oldDescriptor];
 if (mode !== "generation") { m.ancestry.version = 2; m.ancestry.barrier = proposedBarrier; }
 if (mode === "unknown-capability") { m.ancestry.version = 1; m.ancestry.barrier = { ...currentBarrier, requiredCapabilities: [...currentBarrier.requiredCapabilities, "atomic-task-mutations-v1"] }; }
 await fsp.writeFile(path.join(directory, oldDescriptor.file), oldWire); await fsp.writeFile(path.join(directory, descriptor.file), proposedGeneration); await fsp.writeFile(path.join(directory, "CURRENT.json"), J.encodeManifest(m));
 // A valid older pointer is deliberately present. Unsupported newer semantics
 // must be terminal rather than authorize selecting that older pointer.
 await fsp.writeFile(path.join(directory, "RECOVERY.json"), oldRaw);
 return { directory, state, oldRaw, descriptor, proposedBarrier, proposedGeneration, oldManifest };
}
function executeReader(entry, directory, authorityId, privateFormat) {
 const guardIndex = process.execArgv.indexOf("--require"), guard = guardIndex < 0 ? [] : ["--require", process.execArgv[guardIndex + 1]];
 const source = `const J=require(${JSON.stringify(entry)});J.openJsonRepository(${JSON.stringify({ directory, ...(privateFormat ? { storageFormat: "private-v4", expectedAuthorityId: authorityId } : {}) })}).then(async r=>{await r.close();process.stdout.write('UNEXPECTED_OPEN');process.exitCode=2;}).catch(e=>{process.stdout.write(e.code||'NO_CODE');process.exitCode=e.code==='UNSUPPORTED_SCHEMA'?0:3;});`;
 const child = spawnSync(process.execPath, [...guard, "-e", source], { encoding: "utf8", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, timeout: 30000 });
 assert.ifError(child.error); return { executable: process.execPath, arguments: [...guard, "-e", source], pid: child.pid, status: child.status, signal: child.signal, stdout: child.stdout, stderr: child.stderr };
}
module.exports = { assert, fs, fsp, path, root, graph, vectors, core, J, C, V, content, base, imports, recurrence, H, clone, id, factory, NOW, fixture, create, mutation, structure, record, temporary, materializeReader, fileHashes, preserveGolden, goldenRoot, executeReader };
