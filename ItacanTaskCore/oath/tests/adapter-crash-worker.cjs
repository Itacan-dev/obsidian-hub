"use strict";
// Actual existing save/native implementations, paused only inside this disposable child.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), S = require("./adapter-support.cjs"), J = require("../../src/json-repository");
const [root, mode, stage] = process.argv.slice(2), real = fs.realpathSync.native(root), temp = fs.realpathSync.native(os.tmpdir());
if (path.dirname(real) !== temp || !path.basename(real).startsWith("itacan-task-test-")) throw Error("Unsafe child root");
const pause = async at => { process.send({ stage: at, mode, pid: process.pid }); await new Promise(() => {}); };
(async () => {
 let draw = 800000, armed = false; const authority = S.H.S.id(800000);
 const directory = path.join(root, "native"); fs.mkdirSync(directory);
 const options = { directory, storageFormat: "private-v4", storeId: authority, partitions: S.H.registry.map(r => ({ id: r.partitionId, owner: r.owner, kind: r.owner.type === "resource" ? "resource" : r.shared ? "git-project" : "private-project" })), idFactory: () => S.H.S.id(++draw), clock: () => 1792224000000,
 fault: async at => { if (armed && mode === "native-ack" && at === "beforeAcknowledgement") await pause(stage); } };
 const repo = await J.createJsonRepository(options); const created = await repo.execute({ type: "task.create", operationId: "create", payload: { task: { id: S.H.S.id(50000), owner: { type: "project", id: "private" }, title: "Synthetic parent" } } });
 const f = { repo, directory, options }, v = { f, task: created.task, target: S.H.nativeTarget(repo, created.task) };
 globalThis.localStorage = { getItem: () => "candidate-device", setItem() { throw Error("No device write"); } };
 const { HubDataStore } = require(S.H.root + "/" + S.H.lib + "/services/data-store.js");
 let store;
 const host = await S.actualHost({ after() {} }, v, mode === "terminal" ? "strict" : "standard", "active", async fixture => {
  const plugin = { ...fixture.plugin, app: { vault: { adapter: { getBasePath: () => root }, configDir: ".obsidian" } }, manifest: { dir: path.join(root, "plugin") } };
  store = new HubDataStore(plugin); store.sharedProjects.prepare = async () => null; // No sharing boundary is exercised.
  const seed = S.H.clone(fixture.wizard.data); seed.oathsByDevice[fixture.oath.deviceId].current = null; await store.save(seed); fixture.plugin.dataStore = store;
  const dataPath = store.dataFilePath(), open = fs.promises.open, rename = fs.promises.rename;
  fs.promises.open = async function (filename, ...args) { const handle = await open.call(this, filename, ...args); if (String(filename).startsWith(path.dirname(dataPath) + path.sep) && String(filename).endsWith(".tmp")) { const sync = handle.sync.bind(handle); handle.sync = async () => { await sync(); if (armed && stage === "file-flushed") await pause(stage); }; } return handle; };
  fs.promises.rename = async function (from, to) { if (armed && path.resolve(to) === dataPath && stage === "before-publication") await pause(stage); const result = await rename.call(this, from, to); if (armed && path.resolve(to) === dataPath && stage === "after-publication") await pause(stage); return result; };
  if (mode === "enrollment") armed = true;
  return { saved: async () => JSON.parse(await fs.promises.readFile(dataPath, "utf8")) };
 });
 if (mode === "enrollment") throw Error("Enrollment stage not reached");
 const command = { type: "task.complete", operationId: "genuine", taskId: v.task.id, expectedRevision: repo.getTask(v.task.id).revision, payload: { completed: true, completedAt: null } };
 if (mode === "native-ack") armed = true;
 await repo.execute(command); await host.refresh();
 if (mode === "native-ack") throw Error("Native stage not reached");
 if (mode === "unsaved-latch") {
  const save = store.save.bind(store); store.save = async () => { throw Error("Injected save failure before publication"); };
  await S.assert.rejects(host.f.oath.markFulfilled()); store.save = save; S.assert(host.f.oath.pendingFulfilment);
  await repo.execute({ type: "task.complete", operationId: "open", taskId: v.task.id, expectedRevision: repo.getTask(v.task.id).revision, payload: { completed: false } }); await pause(stage);
 }
 if (mode === "terminal") {
  await host.f.oath.markFulfilled(); host.f.oath.strict.release = async () => pause(stage); await host.f.oath.end(host.f.oath.current.id, "fulfilled");
 } else { armed = true; await host.f.oath.markFulfilled(); }
 throw Error("Requested pause not reached");
})().catch(e => { process.stderr.write(e.stack + "\n"); process.exitCode = 1; });
