import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { EligibilityPolicy, containsSecret, vaultPath } from "../src/knowledge/eligibility";
import { KnowledgeService } from "../src/knowledge/documents";
import { extract } from "../src/knowledge/extractors";
import { assemble } from "../src/knowledge/context";
import { PathGuard } from "../src/host/path-guard";
import { openVerifiedSource } from "../src/host/source-opener";
import type { App } from "obsidian";
import { MemoryHost, diskHost, temporary } from "./fixtures";
const signal = () => new AbortController().signal;

test("eligibility rejects protected configuration, secrets, traversal and URLs without using Git ignore rules", () => {
  const policy = new EligibilityPolicy("CustomConfig"); policy.setExcluded(["Private", "Notes/personal.md"]);
  for (const value of ["../outside.md", "Notes/../outside.md", "C:/secret.md", "\\\\server\\share\\x.md", "/etc/passwd", "https://host/file.md", "a//b.md", "a\u0000.md", "System/Backups./x.md", "Config /x.md", "Notes/NUL.md", "Notes/a.md:stream"]) assert.throws(() => vaultPath(value));
  for (const value of ["CustomConfig/data.json", ".obsidian/data.json", ".git/config", "Any/.env.local", "Any/secrets.json", "Any/private.key", "Private/file.md", "Notes/personal.md", "System/Backups/copy.md", "AtlasCore/readme.md", "Any/node_modules/file.js"]) assert.equal(policy.supports(value), false, value);
  for (const value of ["Arbitrary/notes.md", "Resources/Research/paper.pdf", "Code/analysis.py", "Notes/table.csv"]) assert.equal(policy.supports(value), true, value);
  assert.equal(containsSecret("-----BEGIN PRIVATE KEY-----"), true);
});

test("Markdown retrieval covers arbitrary folders, preserves source lines and never reads excluded files", async () => {
  const policy = new EligibilityPolicy(); policy.setExcluded(["Private"]);
  const host = new MemoryHost(policy);
  host.files.set("Unregistered/Lab.md", "---\ntoken: metadata must not be indexed\naliases: [Labradorite]\n---\n# Copper\nThe copper calibration wavelength is 520 nanometers.\n");
  host.files.set("Private/Other.md", "copper private answer"); host.files.set(".obsidian/config.md", "copper protected");
  const knowledge = new KnowledgeService(host, policy, {});
  const found = await knowledge.search("copper calibration", { kind: "vault" }, signal());
  assert.equal(found.length, 1); assert.equal(found[0].path, "Unregistered/Lab.md"); assert.equal(found[0].location.startLine, 5); assert(!found[0].text.includes("token:"));
  assert.equal((await knowledge.search("Labradorite", { kind: "vault" }, signal()))[0].path, "Unregistered/Lab.md");
  assert.deepEqual(host.reads, ["Unregistered/Lab.md"]);
  assert.equal(await knowledge.validate(found, signal()), true);
  assert.equal((await knowledge.search("copper", { kind: "folder", path: "Research" }, signal())).length, 0);
  knowledge.dispose();
});

test("source navigation uses a verified native file object and never opens executable formats", async () => {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), name = "Notes/Lab#results.md", native = { path: name, extension: "md" };
  host.files.set(name, "A safe note"); let opened: unknown;
  const app = { vault: { getAbstractFileByPath: () => native }, workspace: { getLeaf: () => ({ openFile: async (file: unknown) => { opened = file; } }) } } as unknown as App;
  await openVerifiedSource(host, app, name, { startLine: 2, endLine: 2 }, signal()); assert.equal(opened, native);
  opened = null; await assert.rejects(openVerifiedSource(host, app, "src/script.ps1", { startLine: 1, endLine: 1 }, signal()), /inert/); assert.equal(opened, null); assert(!host.reads.includes("src/script.ps1"));
  host.restricted.add(name); await assert.rejects(openVerifiedSource(host, app, name, { startLine: 1, endLine: 1 }, signal())); assert.equal(opened, null);
});

test("revisions, observed renames, deletion and Oath access are revalidated", async () => {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy), identities = {};
  host.files.set("Research/A.md", "Copper answer is 520 nanometers.");
  const knowledge = new KnowledgeService(host, policy, identities);
  const [first] = await knowledge.search("copper", { kind: "vault" }, signal());
  host.files.set("Research/A.md", "Copper answer changed to 521 nanometers.");
  assert.equal(await knowledge.validate([first], signal()), false);
  const [second] = await knowledge.search("copper", { kind: "vault" }, signal());
  assert.equal(first.documentId, second.documentId); assert.notEqual(first.revision, second.revision);
  host.files.set("Research/B.md", host.files.get("Research/A.md")!); host.files.delete("Research/A.md"); knowledge.rename("Research/A.md", "Research/B.md");
  const [renamed] = await knowledge.search("copper", { kind: "vault" }, signal()); assert.equal(renamed.documentId, first.documentId);
  host.restricted.add("Research/B.md"); assert.equal(knowledge.permitted(renamed), false); assert.equal(await knowledge.validate([renamed], signal()), false);
  host.restricted.clear(); host.files.delete("Research/B.md"); assert.equal(await knowledge.validate([renamed], signal()), false);
  knowledge.dispose();
});

test("extractors preserve code and notebook cell sources without including active outputs", async () => {
  const code = await extract("src/test.py", Buffer.from("def calibration():\n    return 520\n"), signal()); assert.match(code.segments[0].text, /def calibration/);
  const notebook = await extract("paper.ipynb", Buffer.from(JSON.stringify({ cells: [{ cell_type: "code", id: "cell-a", source: ["print('copper')\n"], outputs: [{ text: "DO_NOT_INCLUDE_OUTPUT", data: { "text/html": "<script>globalThis.executed=true</script>" } }] }] })), signal());
  assert.match(notebook.segments[0].location.cell!, /cell-a/); assert(!JSON.stringify(notebook).includes("DO_NOT_INCLUDE_OUTPUT"));
  await assert.rejects(extract("bad.ipynb", Buffer.from("{"), signal()), /Invalid notebook/);
  await assert.rejects(extract("binary.txt", Uint8Array.of(0, 1, 2), signal()), /binary/);
  await assert.rejects(extract("credential.txt", Buffer.from("-----BEGIN PRIVATE KEY-----"), signal()), /sensitive/);
});

test("context contains only selected evidence and respects a bounded small-model budget", async () => {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy); host.files.set("Any/A.md", "Copper calibration is 520 nm.\n".repeat(100));
  const knowledge = new KnowledgeService(host, policy, {}), found = await knowledge.search("copper", { kind: "vault" }, signal());
  const request = assemble("What is copper calibration?", found, "mock", 4096);
  assert(request.evidence.length > 0); assert(request.evidence.length <= 6);
  assert(Buffer.byteLength(JSON.stringify(request)) < 4096);
  assert.throws(() => assemble("x".repeat(5000), found, "mock", 4096), /question exceeds/);
  knowledge.dispose();
});

test("trusted adapter discovers code absent from Vault catalog and rejects symlink/junction escapes", async () => {
  const temp = await temporary();
  try {
    const vault = path.join(temp.directory, "vault"), outside = path.join(temp.directory, "outside");
    await fs.mkdir(path.join(vault, "Code"), { recursive: true }); await fs.mkdir(outside);
    await fs.writeFile(path.join(vault, "Code", "analysis.py"), "def copper(): return 520"); await fs.writeFile(path.join(outside, "private.md"), "outside secret");
    await fs.symlink(outside, path.join(vault, "escape"), process.platform === "win32" ? "junction" : "dir");
    const policy = new EligibilityPolicy(), { host, reads } = diskHost(vault, policy), knowledge = new KnowledgeService(host, policy, {});
    const found = await knowledge.search("copper", { kind: "vault" }, signal()); assert.equal(found[0].path, "Code/analysis.py");
    await assert.rejects(new PathGuard(vault).check("escape/private.md"), /links|junction/);
    assert(!reads.some(value => value.startsWith("escape/"))); knowledge.dispose();
  } finally { await temp.cleanup(); }
});

test("warm retrieval avoids re-reading the corpus; failed replacements remove old results", async () => {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy); host.files.set("Any/A.md", "Copper calibration is 520.");
  const knowledge = new KnowledgeService(host, policy, {});
  await knowledge.search("copper", { kind: "vault" }, signal());
  await knowledge.search("copper", { kind: "vault" }, signal()); assert.equal(host.reads.length, 1);
  host.files.set("Any/A.md", "-----BEGIN PRIVATE KEY-----\nnew sensitive revision");
  await knowledge.refresh(signal(), true);
  assert.equal((await knowledge.search("copper", { kind: "vault" }, signal())).length, 0);
  assert.equal(knowledge.statuses.get("Any/A.md")?.status, "excluded");
  host.files.set("Any/TooBig.md", "x".repeat(2 * 1024 * 1024 + 1)); await knowledge.refresh(signal(), true);
  assert.equal(knowledge.statuses.get("Any/TooBig.md")?.status, "oversized"); assert(!host.reads.includes("Any/TooBig.md")); knowledge.dispose();
});

test("long physical lines remain searchable and canceled indexing can restart", async () => {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy); host.files.set("Any/Long.txt", "x".repeat(2500) + " distantneedle calibration");
  const knowledge = new KnowledgeService(host, policy, {});
  const found = await knowledge.search("distantneedle", { kind: "vault" }, signal());
  assert.equal(found[0].location.startLine, 1); assert.equal(found[0].location.endLine, 1); assert.equal(found[0].location.startColumn, 2200);
  knowledge.clear(); const pending = knowledge.refresh(); knowledge.cancelRefresh();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(knowledge.coverage.indexing, false); assert.equal((await knowledge.search("distantneedle", { kind: "vault" }, signal())).length, 1);
  const request = assemble("calibration?", [{ ...found[0], text: '\\"\t'.repeat(2000) }], "mock", 4096);
  const serializedContext = request.evidence.map(item => JSON.stringify({ source: item.sourceId, path: item.path, location: item.location, excerpt: item.text })).join("\n");
  assert(Buffer.byteLength(request.instructions + request.question + serializedContext) + request.outputTokens < request.contextLength);
  knowledge.dispose();
});

test("failed background discovery marks coverage incomplete and retries on the next search", async () => {
  const policy = new EligibilityPolicy(), host = new MemoryHost(policy); host.files.set("Notes/A.md", "Copper calibration is 520.");
  const knowledge = new KnowledgeService(host, policy, {}), list = host.list.bind(host); await knowledge.refresh(); assert(knowledge.coverage.complete);
  host.list = async () => { throw Error("Synthetic unavailable folder"); }; await assert.rejects(knowledge.refresh(signal(), true)); assert.equal(knowledge.coverage.complete, false);
  host.list = list; assert.equal((await knowledge.search("copper", { kind: "vault" }, signal())).length, 1); assert(knowledge.coverage.complete); knowledge.dispose();
});

test("trusted host checks permission again after containment inspection and before native reading", async () => {
  const temp = await temporary();
  try {
    const vault = path.join(temp.directory, "vault"); await fs.mkdir(path.join(vault, "Notes"), { recursive: true }); await fs.writeFile(path.join(vault, "Notes/A.md"), "Copper calibration is 520.");
    const policy = new EligibilityPolicy(), { host, reads } = diskHost(vault, policy), check = host.guard.check.bind(host.guard);
    host.guard.check = async (...args) => { const result = await check(...args); policy.setExcluded(["Notes"]); return result; };
    await assert.rejects(host.read({ path: "Notes/A.md", size: 0, mtime: 0 }, signal()), /excluded/); assert.deepEqual(reads, []);
  } finally { await temp.cleanup(); }
});

test("canceling a pending native read promptly releases its caller and discards the later result", async () => {
  const temp = await temporary();
  try {
    const vault = path.join(temp.directory, "vault"); await fs.mkdir(vault); await fs.writeFile(path.join(vault, "Note.md"), "Copper");
    const { host } = diskHost(vault, new EligibilityPolicy()); let began!: () => void, finish!: (value: ArrayBuffer) => void;
    const started = new Promise<void>(resolve => { began = resolve; });
    (host as any).app.vault.adapter.readBinary = () => new Promise<ArrayBuffer>(resolve => { finish = resolve; began(); });
    const abort = new AbortController(), pending = host.read({ path: "Note.md", size: 6, mtime: 1 }, abort.signal); await started; abort.abort();
    await assert.rejects(pending, { name: "AbortError" }); finish(new ArrayBuffer(6));
  } finally { await temp.cleanup(); }
});
