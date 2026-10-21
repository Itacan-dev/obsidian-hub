"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const W = require("../../writer"), J = require("../../src/json-repository"), V = require("../../src/value"), P = require("../../writer/policy"), H = require("../../host"), B = require("../../product-ui/bridge.cjs");
const sessions = [], repositories = [];
const Module = require("node:module"), originalLoad = Module._load, writerFile = require.resolve("../../writer");
Module._load = function(request, parent, main) { const value = originalLoad.apply(this, arguments); if (request !== "obsidian" && Module._resolveFilename(request, parent) === writerFile) return { ...value, createNativeWriterSession(...args) { const s = value.createNativeWriterSession(...args); sessions.push(s); return s; } }; return value; };
for (const n of ["createJsonRepository", "openJsonRepository"]) { const fn = J[n]; J[n] = async (...args) => { const r = await fn(...args); repositories.push(r); return r; }; }
const { openProjectRuntime } = require("../project-runtime");
const owner = { type: "project", id: "rehearsal-private" }, commands = ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"];
const audit = process.env.ITACAN_M1A_AUDIT || path.join(os.tmpdir(), "itacan-m1a-tests");
function configuration(directory) {
 const authorityId = crypto.randomUUID(), rehearsalId = crypto.randomUUID();
 let value = { version: 1, registryId: "rehearsal-registry", applicationContextId: "rehearsal-" + authorityId, revision: "1", owners: [{ owner, partitionId: "private", root: "Projects/Native", dashboard: "Projects/Native/Dashboard.md", shared: false, shareApproval: null, available: true, status: "active", locations: [], mounts: [] }] };
 const listeners = new Set(), registry = { async read() { return { ...V.clone(value), digest: H.registryDigest(value) }; }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, change(fn) { fn(value); value.revision = String(+value.revision + 1); listeners.forEach(fn => fn()); } };
 const config = { version: 1, scope: "inactive-disposable", storageFormat: "private-v4", authorityId, directory, applicationContextId: value.applicationContextId, registryId: value.registryId };
 const writerPolicy = P.policy({ version: 1, owners: [{ owner, partitionId: "private" }], commands, inventory: { version: 1, revision: "external-empty", ids: [] }, phases: { version: 1, revision: "no-phases", values: [] } });
 return { config, registry, owner, rehearsalId, writerPolicy };
}
async function fixture(t, extra = {}) {
 await fs.mkdir(audit, { recursive: true }); const directory = await fs.mkdtemp(path.join(audit, "native-")), c = configuration(directory);
 let runtime = await openProjectRuntime(c.config, { ...c, ...extra, creating: true }); const session = sessions.at(-1), repository = repositories.at(-1);
 t.after(() => runtime.close());
 return { ...c, directory, session, repository, get runtime() { return runtime; }, async reopen() { await runtime.close(); runtime = await openProjectRuntime(c.config, { ...c, ...extra, creating: false }); return runtime; },
  async intent(values = {}) { const i = B.create(await runtime.creationContext(), { text: "Task", steps: [{ text: "Same", completed: false }, { text: "Same", completed: false }], ...values }); i.action.draft.id = crypto.randomUUID(); return i; },
  component() { const stops = []; t.after(() => stops.splice(0).forEach(fn => fn())); return { register: fn => stops.push(fn) }; },
  async disk() { const m = JSON.parse(await fs.readFile(path.join(directory, "CURRENT.json"), "utf8")); return m; }
 };
}
module.exports = { assert, fs, path, os, crypto, V, P, H, B, W, J, owner, audit, configuration, fixture, sessions, repositories, openProjectRuntime };
