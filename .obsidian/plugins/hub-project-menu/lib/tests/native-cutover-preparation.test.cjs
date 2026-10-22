"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const P = require("../services/native-cutover-preparation");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
async function fixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-cutover-test-")), vaultRoot = path.join(root, "vault"), localDataRoot = path.join(root, "local");
    await fs.mkdir(vaultRoot); await fs.mkdir(localDataRoot);
    const write = async (name, bytes) => { const file = path.join(vaultRoot, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes); };
    await write("Projects/A/A.md", "---\ntype: project\nprojectId: alpha\nstatus: active\nresource_folders: [mounted]\n---\n# Alpha\n");
    await write("Projects/B/B.md", "---\ntype: project\nprojectId: beta\nstatus: active\n---\n# Beta\n");
    await write("Projects/A/Work.md", Buffer.from("\uFEFF# Heading\r\nUnrelated prose and formula $x^2$.\r\n\r\n- [ ] Same <!-- hub-task:parent -->\r\n  continuation α\r\n  - [x] Same <!-- hub-task:step -->\r\n    - [ ] Four-level Step\r\n\r\n## Other heading\r\nTail untouched.\r\n"));
    await write("Projects/B/Work.md", "- [x] Beta\n");
    await write("Resources/Knowledge/Mounted/Work.md", "- [ ] Resource physically owned\n");
    await write(".obsidian/plugins/hub-project-menu/data.json", JSON.stringify({ taskMetadata: { parent: { necessity: "must", fromDate: "2026-10-21", fromTime: "00:00", dueDate: "2026-10-22", description: "Description" } }, completedTaskHistory: [{ id: 17, timestamp: 1, text: "Recorded history" }] }));
    const options = { vaultRoot, localDataRoot, archivesRoot: path.join(localDataRoot, "Itacan/Archives"), vaultId: "stable-vault" };
    return { ...options, write, owner: { type: "project", id: "alpha" }, archive: async () => P.captureArchive(options) };
}
test("actual legacy parser, flat/nested Steps, metadata and byte-exact original backups", async () => {
    const f = await fixture(), result = await f.archive(), manifest = await P.verifyArchive(result.archive);
    const alpha = manifest.candidates.find(c => c.projectId === "alpha"); assert.equal(alpha.tasks, 1); assert.equal(alpha.steps, 2); assert.equal(alpha.files, 1);
    assert.equal(manifest.sources.find(s => s.path.startsWith("Resources/")).owner.type, "resource");
    const text = await fs.readFile(path.join(result.archive, "TASKS.txt"), "utf8"); for (const needle of ["Description", "Necessity: must", "2026-10-21 00:00", "continuation α", "Four-level Step"]) assert(text.includes(needle));
    for (const source of manifest.sources) { assert(source.sourceUnchangedDuringCapture); const original = await fs.readFile(path.join(f.vaultRoot, source.path)), backup = await fs.readFile(path.join(result.archive, source.backup)); assert(original.equals(backup)); assert.equal(hash(original), source.sourceHash); }
});
test("retirement preview converts only selected-owner checkbox markers and preserves all other bytes", async () => {
    const f = await fixture(), { archive } = await f.archive(), before = await fs.readFile(path.join(f.vaultRoot, "Projects/A/Work.md"));
    const preview = await P.previewRetirement({ archive, owner: f.owner }); assert(preview.previewSafe); assert.equal(preview.files.length, 1); const file = preview.files[0]; assert.equal(file.edits.length, 3);
    assert(file.proposedBytes.equals(Buffer.from(before.toString("utf8").replace(/\[[ xX]\] /g, "")))); assert.equal(preview.sourceWrites, 0); assert(before.equals(await fs.readFile(path.join(f.vaultRoot, file.path))));
    assert(!preview.files.some(s => s.path.startsWith("Resources/") || s.path.startsWith("Projects/B"))); await assert.rejects(P.previewRetirement({ archive }), /ONE_EXPLICIT_PROJECT/);
});
test("custom statuses, blockquotes and indented-code ambiguity are backed up raw and block retirement", async () => {
    const f = await fixture(); await f.write("Projects/A/Unsupported.md", "# Keep\n- [>] Custom status\n> - [ ] Quoted\n"); const { archive, manifest } = await f.archive();
    const s = manifest.sources.find(s => s.path.endsWith("Unsupported.md")); assert(!s.retirementSafe); assert(s.issues.includes("UNSUPPORTED_TASK_SYNTAX")); assert((await fs.readFile(path.join(archive, "TASKS.txt"), "utf8")).includes("> - [ ] Quoted")); assert(!(await P.previewRetirement({ archive, owner: f.owner })).previewSafe);
    assert(!P.analyzeSource(Buffer.from("    - [ ] Code or task\n"), "Code.md").safe);
    assert(!P.analyzeSource(Buffer.from("- Ordinary item\n\nProse\n\n    - [ ] Indented literal\n"), "Code.md").safe);
    assert(!P.analyzeSource(Buffer.from("- [ ] Parent\n\n        - [ ] Code or Step\n"), "Code.md").safe);
    assert(!P.analyzeSource(Buffer.from("<div>\n- [ ] Unproven HTML task\n</div>\n"), "Html.md").safe);
    assert(!P.analyzeSource(Buffer.from("- [ ] [x] Would remain a checkbox\n"), "Double.md").safe);
    assert(!P.analyzeSource(Buffer.from("- [ ] - [ ] Nested literal\n"), "Double.md").safe);
});
test("fenced examples remain literal, duplicate titles/IDs never resolve by title, unknown encodings preserve bytes", async () => {
    const f = await fixture(); await f.write("Projects/A/Examples.md", "```md\n- [ ] Literal\n```\n- [ ] Same <!-- hub-task:copy -->\n- [x] Same <!-- hub-task:copy -->\n"); await f.write("Projects/A/Unknown.md", Buffer.from([0xff, 0xfe, 0x2d, 0x00]));
    const { archive, manifest } = await f.archive(), example = manifest.sources.find(s => s.path.endsWith("Examples.md")), unknown = manifest.sources.find(s => s.path.endsWith("Unknown.md")); assert.equal(example.tasks, 2); assert(example.issues.includes("DUPLICATE_LEGACY_ID")); assert(!unknown.retirementSafe); assert.equal(unknown.tasks, 0);
    assert((await fs.readFile(path.join(archive, unknown.backup))).equals(Buffer.from([0xff, 0xfe, 0x2d, 0x00])));
});
test("hash or write-stamp changes, new task files and registry changes revoke a prior snapshot", async () => {
    const f = await fixture(), { archive } = await f.archive(); await f.write("Projects/A/Work.md", "- [ ] Changed\n"); let preview = await P.previewRetirement({ archive, owner: f.owner }); assert(!preview.previewSafe); assert(preview.files.some(f => f.issues?.includes("SOURCE_HASH_OR_WRITE_STAMP_CHANGED")));
    await f.write("Projects/A/New.md", "- [ ] New source\n"); preview = await P.previewRetirement({ archive, owner: f.owner }); assert(preview.problems.includes("TASK_SOURCE_SET_CHANGED"));
    await f.write("Projects/A/A.md", "---\ntype: project\nprojectId: changed\nstatus: active\n---\n"); assert(!(await P.previewRetirement({ archive, owner: f.owner })).previewSafe);
});
test("source changes during capture preserve captured originals and block approval", async () => {
    const f = await fixture(), target = await fs.realpath(path.join(f.vaultRoot, "Projects/A/Work.md")), read = fs.readFile; let seen = 0;
    fs.readFile = async function (file, ...args) { if (path.resolve(String(file)) === target && ++seen === 2) await fs.writeFile(target, "- [ ] Concurrent change\n"); return read.call(this, file, ...args); };
    let result; try { result = await f.archive(); } finally { fs.readFile = read; }
    assert(seen >= 2); const s = result.manifest.sources.find(s => s.path === "Projects/A/Work.md"); assert.equal(s.sourceUnchangedDuringCapture, false); assert.equal(s.retirementSafe, false); assert.equal(hash(await fs.readFile(path.join(result.archive, s.backup))), s.sourceHash);
});
test("archives never overwrite and verification rejects altered backup bytes", async () => {
    const f = await fixture(), a = await f.archive(), b = await f.archive(); assert.notEqual(a.archive, b.archive); await P.verifyArchive(a.archive); await P.verifyArchive(b.archive);
    await fs.appendFile(path.join(a.archive, a.manifest.sources[0].backup), "corrupt"); await assert.rejects(P.verifyArchive(a.archive), /BACKUP_VERIFICATION_FAILED/);
});
test("private location planning rejects vault, cloud, Git, links and conflicting authorities without creating a repository", async () => {
    const f = await fixture(), options = { vaultRoot: f.vaultRoot, localDataRoot: f.localDataRoot, vaultId: f.vaultId, projectId: "alpha", deviceId: "device" };
    const a = await P.prepareAuthority(options), b = await P.prepareAuthority(options); assert.equal(a.directory, b.directory); assert.equal(a.enabled, false); assert.equal(a.admitted, false); assert.equal(await fs.stat(a.directory).catch(() => null), null);
    await assert.rejects(P.validatePrivateLocation(path.join(f.vaultRoot, "native"), options)); await assert.rejects(P.validatePrivateLocation(path.join(f.localDataRoot, "cloud/native"), { ...options, cloudRoots: [path.join(f.localDataRoot, "cloud")] }));
    const git = path.join(f.localDataRoot, "git"); await fs.mkdir(git); await fs.writeFile(path.join(git, ".git"), "gitdir: elsewhere"); await assert.rejects(P.validatePrivateLocation(path.join(git, "native"), options), /GIT/);
    await fs.mkdir(a.directory, { recursive: true }); await fs.writeFile(path.join(a.directory, "WRITER.lock"), "existing"); await assert.rejects(P.prepareAuthority(options), /EXISTING_AUTHORITY/);
    const authority = require("../../../../../ItacanTaskCore/host/authority"); assert.throws(() => authority.validateConfig({ ...a, scope: "device-private" }));
});
test("preflight requires an explicit private owner and never authorizes a cutover or claims exclusive writes", async () => {
    const f = await fixture(), { archive } = await f.archive(), absent = await P.cutoverPreflight({ archive }); assert(absent.blockers.includes("PROJECT_NOT_SELECTED"));
    const authority = await P.prepareAuthority({ ...f, projectId: "alpha", deviceId: "device" }); const good = await P.cutoverPreflight({ archive, owner: f.owner, authority }); assert(good.preparationReady); assert.equal(good.activationReady, false); assert(good.blockers.includes("EXCLUSIVE_SOURCE_WRITE_QUIESCENCE_REQUIRED"));
    const data = path.join(f.vaultRoot, ".obsidian/plugins/hub-project-menu/data.json"), value = JSON.parse(await fs.readFile(data, "utf8")); value.completedTaskHistory.push({ id: "later" }); await fs.writeFile(data, JSON.stringify(value)); assert(!(await P.cutoverPreflight({ archive, owner: f.owner, authority })).preparationReady);
});
test("junctions and unresolved selected-owner sources block preparation without following the target", async () => {
    const f = await fixture(), outside = path.join(f.localDataRoot, "outside"); await fs.mkdir(outside);
    const link = path.join(f.localDataRoot, "link"); await fs.symlink(outside, link, "junction");
    await assert.rejects(P.validatePrivateLocation(path.join(link, "archive"), f), /ORDINARY_DIRECTORY/);
    const sourceLink = path.join(f.vaultRoot, "Projects/A/Linked"); await fs.symlink(outside, sourceLink, "junction");
    const { archive } = await f.archive(); const preview = await P.previewRetirement({ archive, owner: f.owner }); assert(!preview.previewSafe); assert(preview.problems.includes("UNRESOLVED_OWNER_SOURCE"));
});
test("same-byte rewrites still invalidate source write stamps; preflight rechecks authority conflicts", async () => {
    const f = await fixture(), { archive } = await f.archive(), source = path.join(f.vaultRoot, "Projects/A/Work.md"), bytes = await fs.readFile(source);
    await fs.writeFile(source, bytes); assert(!(await P.previewRetirement({ archive, owner: f.owner })).previewSafe);
    const fresh = await f.archive(), authority = await P.prepareAuthority({ ...f, projectId: "alpha", deviceId: "device" }); await fs.mkdir(authority.directory, { recursive: true }); await fs.writeFile(path.join(authority.directory, "CURRENT.json"), "not-opened");
    const preflight = await P.cutoverPreflight({ archive: fresh.archive, owner: f.owner, authority }); assert(!preflight.preparationReady); assert(preflight.blockers.includes("EXISTING_AUTHORITY_REQUIRES_SEPARATE_REVIEW"));
});
test("copied IDs do not claim metadata attribution; shared owners remain ineligible and raw references survive", async () => {
    const f = await fixture(); await f.write("Projects/B/Copy.md", "- [ ] Copied <!-- hub-task:parent -->\n"); await f.write("Projects/Itacan/Itacan.md", "---\ntype: project\nprojectId: shared\nstatus: active\n---\n- [ ] Shared task\n");
    const { archive, manifest } = await f.archive(); assert(!manifest.candidates.some(p => p.projectId === "shared"));
    await assert.rejects(P.previewRetirement({ archive, owner: { type: "project", id: "shared" } }), /ELIGIBLE_PRIVATE/);
    const text = await fs.readFile(path.join(archive, "TASKS.txt"), "utf8"); assert(text.includes("Metadata attribution unavailable")); const metadata = JSON.parse(await fs.readFile(path.join(archive, "TASK-METADATA.json"), "utf8")); assert.equal(metadata.parent.description, "Description");
});
test("readable-archive corruption and injected backup mismatch cannot be accepted", async () => {
    const f = await fixture(), first = await f.archive(); await fs.appendFile(path.join(first.archive, "TASKS.txt"), "altered"); await assert.rejects(P.verifyArchive(first.archive), /READABLE_ARCHIVE_HASH/);
    const read = fs.readFile; let injected = false; fs.readFile = async function (file, ...args) { const bytes = await read.call(this, file, ...args); if (!injected && String(file).includes(path.sep + "originals" + path.sep)) { injected = true; return Buffer.from("mismatch"); } return bytes; };
    try { await assert.rejects(f.archive(), /BACKUP_VERIFICATION_FAILED/); assert(injected); } finally { fs.readFile = read; }
});
