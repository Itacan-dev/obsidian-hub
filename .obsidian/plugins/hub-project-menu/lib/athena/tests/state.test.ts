import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DeviceStore } from "../src/host/device-store";
import { restoreState } from "../src/conversation-store";
import { AthenaController } from "../src/controller";
import { EligibilityPolicy } from "../src/knowledge/eligibility";
import { KnowledgeService } from "../src/knowledge/documents";
import { MockProvider } from "../src/providers/mock";
import { MemoryHost, temporary } from "./fixtures";

test("device state is isolated from same-name and copied vaults; stale writers fail without overwriting", async () => {
  const temp = await temporary();
  try {
    const a = path.join(temp.directory, "a", "Vault"), b = path.join(temp.directory, "b", "Vault"), data = path.join(temp.directory, "local-data");
    await fs.mkdir(a, { recursive: true }); await fs.mkdir(b, { recursive: true });
    const first = await DeviceStore.open(a, data), copied = await DeviceStore.open(b, data);
    assert.notEqual(first.directory, copied.directory); assert.equal(await first.load(), null); assert.equal(await copied.load(), null);
    await first.save({ version: 1 });
    const stale = await DeviceStore.open(a, data); await stale.load();
    await first.save({ version: 2 }); await assert.rejects(stale.save({ version: 3 }), /another process/);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(first.directory, "state.json"), "utf8")), { version: 2 });
    await assert.rejects(DeviceStore.open(a, path.join(a, "state")), /outside the vault/);
    const redirect = path.join(temp.directory, "redirect"); await fs.symlink(a, redirect, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(DeviceStore.open(a, path.join(redirect, "new-state")), /outside the vault/); assert.deepEqual(await fs.readdir(a), []);
    const nested = path.join(temp.directory, "nested-data"); await fs.mkdir(nested); await fs.symlink(a, path.join(nested, "vaults"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(DeviceStore.open(a, nested), /outside the vault/); assert.deepEqual(await fs.readdir(a), []);
    await fs.writeFile(path.join(first.directory, "state.json"), "{"); await assert.rejects(first.load(), /malformed/); assert.equal(await fs.readFile(path.join(first.directory, "state.json"), "utf8"), "{");
  } finally { await temp.cleanup(); }
});

test("controller records exactly the selected evidence; exclusions purge derived history", async () => {
  const state = restoreState(null); state.settings.enabled = true; state.settings.provider = "mock";
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), mock = new MockProvider(); host.files.set("Notes/A.md", "Copper calibration is 520 nanometers."); host.files.set("Private/B.md", "Different private information.");
  const knowledge = new KnowledgeService(host, policy, state.identities); let saved = "";
  const controller = new AthenaController(state, knowledge, { save: async value => { saved = JSON.stringify(value); } }, () => mock);
  await controller.connect(); const conversation = controller.conversation();
  await controller.send(conversation.id, "What is copper calibration?", { kind: "vault" }, false);
  assert.equal(conversation.turns[0].state, "complete"); assert.equal(mock.requests.length, 1);
  assert.deepEqual(mock.requests[0].evidence, conversation.turns[0].evidence); assert(mock.requests[0].evidence.every(item => item.path === "Notes/A.md"));
  const indexed = [...knowledge.documents.keys()]; await controller.updateSettings({ port: 11435 }); assert.deepEqual([...knowledge.documents.keys()], indexed, "Provider configuration must preserve the independent knowledge index");
  await controller.updateSettings({ excluded: ["Notes"] });
  assert.equal(mock.requests.length, 0);
  assert.equal(conversation.turns[0].answer, ""); assert.equal(conversation.turns[0].evidence.length, 0); assert(!saved.includes("Copper calibration is 520"));
  await controller.dispose();
});

test("derived history retains transitive permissions and endpoint changes reset local consent", async () => {
  const state = restoreState(null); state.settings.enabled = true; state.settings.provider = "mock"; state.settings.localOnlyConfirmed = true;
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), mock = new MockProvider();
  host.files.set("Notes/Calibration.md", "Copper calibration is 520."); host.files.set("Research/Planet.md", "Planet radius is 9000.");
  const controller = new AthenaController(state, new KnowledgeService(host, policy, state.identities), { save: async () => {} }, () => mock);
  await controller.connect(); const conversation = controller.conversation();
  await controller.send(conversation.id, "copper calibration?", { kind: "vault" }, false);
  await controller.send(conversation.id, "planet radius?", { kind: "vault" }, false);
  assert(mock.requests[1].history.length > 0); assert(conversation.turns[1].dependencies?.some(item => item.path === "Notes/Calibration.md"));
  host.restricted.add("Notes/Calibration.md"); controller.contextChanged(); assert(!controller.allowed(conversation.turns[1])); assert.equal(mock.requests.length, 0);
  host.restricted.clear(); await controller.updateSettings({ excluded: ["Notes"] });
  assert.equal(conversation.turns[1].answer, ""); assert.equal(conversation.turns[1].dependencies?.length, 0);
  await controller.updateSettings({ port: 11435 }); assert.equal(state.settings.localOnlyConfirmed, false);
  await controller.dispose();
});

test("permission changes during provider preparation block transmission", async () => {
  const state = restoreState(null); state.settings.enabled = true; state.settings.provider = "mock";
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), mock = new MockProvider(); host.files.set("Notes/A.md", "Copper calibration is 520.");
  const provider = Object.assign(mock, { async prepare() { host.restricted.add("Notes/A.md"); } });
  const controller = new AthenaController(state, new KnowledgeService(host, policy, state.identities), { save: async () => {} }, () => provider);
  await controller.connect(); const conversation = controller.conversation(); await controller.send(conversation.id, "copper", { kind: "vault" }, false);
  assert.equal(mock.requests.length, 0); assert.equal(conversation.turns[0].state, "error"); assert.match(conversation.turns[0].error!, /Context changed/); await controller.dispose();
});

test("changing configuration during connection cannot publish stale ready state", async () => {
  const state = restoreState(null); state.settings.enabled = true; state.settings.provider = "mock";
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), mock = new MockProvider(); let release!: () => void;
  const provider = Object.assign(mock, { async connect() { await new Promise<void>(resolve => { release = resolve; }); return { state: "ready" as const, message: "Synthetic delayed connection" }; } });
  const controller = new AthenaController(state, new KnowledgeService(host, policy, state.identities), { save: async () => {} }, () => provider);
  const connecting = controller.connect(); assert.equal(controller.status.state, "connecting"); await controller.updateSettings({ contextLength: 8192 }); release(); await connecting;
  assert.equal(controller.status.state, "disconnected"); assert.equal(controller.models.length, 0); await controller.dispose();
});

test("restoration marks incomplete turns interrupted and rejects unsupported state", () => {
  const state = restoreState(null); state.conversations.push({ id: "c", title: "Synthetic", turns: [{ id: "t", question: "q", answer: "partial", evidence: [], state: "streaming", provider: "mock", model: "mock", createdAt: 1 }] });
  const result = restoreState(JSON.parse(JSON.stringify(state))); assert.equal(result.conversations[0].turns[0].state, "interrupted");
  assert.throws(() => restoreState({ ...state, version: 99 }), /Unsupported/);
  assert.throws(() => restoreState({ ...state, settings: { ...state.settings, excluded: ["../secret"] } }), /Invalid vault path/);
  assert.throws(() => restoreState({ ...state, settings: { ...state.settings, contextLength: -1 } }), /Invalid Athena settings/);
  state.conversations[0].turns[0].state = "unknown" as any; assert.throws(() => restoreState(state), /Invalid Athena turn/);
});
