"use strict";
// Offline preparation only. No repository constructor, source writer or activation port.
const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto");
const { taskLineDetails, taskIdentity } = require("../domain/tasks");
const { readTaskSnapshot, taskMetadata } = require("../domain/task-planning");
const { findProjectForPath, findResourceForPath } = require("../domain/contexts");
const { RESOURCE_TYPES } = require("../config");
const { SHARED_PROJECT_ROOTS } = require("./shared-projects");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const inside = (root, child) => { const r = path.relative(root, child); return !!r && r !== ".." && !r.startsWith(".." + path.sep) && !path.isAbsolute(r); };
const equal = (a, b) => path.relative(a, b) === "";
const check = (ok, code) => { if (!ok) { const e = Error(code); e.code = code; throw e; } };
const ref = p => ({ type: p.contextKind === "resource" ? "resource" : "project", id: p.projectId ?? p.id });
const same = (a, b) => a?.type === b?.type && a?.id === b?.id;
function relative(value) { check(typeof value === "string" && value && !/[\\:\0]/.test(value) && !value.startsWith("/") && value.split("/").every(p => p && p !== "." && p !== ".."), "INVALID_RELATIVE_PATH"); return value; }
async function exists(file) { try { return await fs.lstat(file); } catch (e) { if (e.code === "ENOENT") return null; throw e; } }
async function pin(file) { const s = await fs.stat(file, { bigint: true }); return { dev: String(s.dev), ino: String(s.ino), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) }; }
const stampEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function futurePath(directory) {
    let ancestor = path.resolve(directory);
    while (!(await exists(ancestor))) { const next = path.dirname(ancestor); check(next !== ancestor, "PATH_ANCESTOR_UNAVAILABLE"); ancestor = next; }
    return path.resolve(await fs.realpath(ancestor), path.relative(ancestor, path.resolve(directory)));
}
async function safeFile(root, name) {
    const file = path.join(root, relative(name));
    for (let p = file; !equal(p, root); p = path.dirname(p)) { const s = await fs.lstat(p); check(!s.isSymbolicLink(), "SOURCE_LINK_UNAVAILABLE"); }
    check(inside(root, await fs.realpath(file)), "SOURCE_ESCAPE"); return file;
}
async function walk(root) {
    const files = [], unresolved = [];
    async function visit(dir, prefix) {
        for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
            const name = prefix ? prefix + "/" + e.name : e.name;
            if ([".git", ".obsidian", ".codex", ".agents", ".aws", "node_modules"].includes(e.name) || name === "System/Backups") continue;
            if (e.isSymbolicLink()) { unresolved.push({ path: name, code: "SOURCE_LINK_UNAVAILABLE" }); continue; }
            if (e.isDirectory()) await visit(path.join(dir, e.name), name);
            else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) files.push(name);
        }
    }
    await visit(root, ""); return { files, unresolved };
}
// Strict identity scalars only, not a second YAML implementation. Unsupported
// identity syntax is unavailable rather than guessed. Unrelated YAML is ignored.
function projectHeader(text, name) {
    const source = text.replace(/^\uFEFF/, ""), lines = source.split(/\r?\n/);
    if (lines[0] !== "---") return null;
    const end = lines.findIndex((line, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(line));
    if (end < 0) return { path: name, ambiguous: true };
    const header = lines.slice(1, end), values = {}, problems = [];
    for (const key of ["type", "projectId", "status"]) {
        const hits = header.filter(l => new RegExp("^" + key + "\\s*:").test(l));
        if (hits.length !== 1) { problems.push(key); continue; }
        const raw = hits[0].slice(hits[0].indexOf(":") + 1).trim();
        if (/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(raw) && !/^(true|false|null|yes|no|on|off)$/i.test(raw) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw)) values[key] = raw;
        else if (/^"(?:[^"\\]|\\.)*"$/.test(raw)) { try { values[key] = JSON.parse(raw); } catch (_) { problems.push(key); } }
        else if (/^'(?:[^']|'')*'$/.test(raw)) values[key] = raw.slice(1, -1).replace(/''/g, "'");
        else problems.push(key);
    }
    if (values.type !== "project" && !header.some(l => /^type\s*:.*project/.test(l) || /^projectId\s*:/.test(l))) return null;
    if (header.some(l => /^<<\s*:/.test(l)) || values.type !== "project" || typeof values.projectId !== "string" || !values.projectId.trim() || !["active", "future", "shelved", "archived"].includes(values.status)) problems.push("identity");
    if (problems.length) return { path: name, root: path.posix.dirname(name), ambiguous: true };
    return { projectId: values.projectId, root: path.posix.dirname(name), path: name, name: path.posix.basename(name, ".md"), contextKind: "project", status: values.status, shared: SHARED_PROJECT_ROOTS.includes(path.posix.dirname(name)) };
}
function analyzeSource(bytes, name, metadata = {}) {
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch (_) { return { tasks: [], steps: 0, edits: [], issues: ["NON_UTF8_SOURCE"], safe: false, raw: null, candidate: true }; }
    const rows = [], lines = []; let offset = 0;
    for (const m of text.matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)) { if (!m[0]) continue; rows.push({ start: offset, raw: m[0] }); lines.push(m[0].replace(/[\r\n]+$/, "")); offset += m[0].length; }
    const issues = [], active = [], literals = []; let fence = null, frontmatter = lines[0]?.replace(/^\uFEFF/, "") === "---", math = false, comment = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i], trimmed = line.trim();
        if (frontmatter) { if (i && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false; continue; }
        const token = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
        if (token) { if (!fence) fence = { char: token[1][0], length: token[1].length }; else if (fence.char === token[1][0] && token[1].length >= fence.length && !token[2].trim()) fence = null; continue; }
        if (fence) { if (taskLineDetails(line)) literals.push(i); continue; }
        if (trimmed === "$$" || /^\\\[\s*$/.test(trimmed) || /^\\\]\s*$/.test(trimmed)) { math = !math; continue; }
        if (math || comment) { if (taskLineDetails(line)) issues.push("CHECKBOX_IN_AMBIGUOUS_CONTEXT"); if (comment && line.includes("-->")) comment = false; continue; }
        if (/^<\/?[A-Za-z][A-Za-z0-9-]*(?:[ \t>])/.test(trimmed)) issues.push("HTML_CONTEXT_UNPROVEN");
        if (line.includes("<!--") && !line.slice(line.indexOf("<!--") + 4).includes("-->")) { comment = true; issues.push("MULTILINE_COMMENT"); }
        const details = taskLineDetails(line);
        if (details) { active.push(i); if (!/^[ xX]$/.test(details.marker)) issues.push("UNSUPPORTED_CHECKBOX_STATUS"); if (!details.text.trim()) issues.push("EMPTY_TASK_TITLE"); if (/^(?:(?:[-*+]|\d+[.)])\s+)*\[[^\]]\](?:\s|$)/.test(details.text)) issues.push("CHECKBOX_LIKE_TITLE"); }
        else if (/^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[[^\]]\](?:\s|$)/.test(line)) issues.push("UNSUPPORTED_TASK_SYNTAX");
    }
    if (fence || frontmatter || math || comment) issues.push("UNCLOSED_CONTEXT");
    const tasks = [], covered = new Set(), ids = new Set(), edits = [], ancestry = [];
    for (const line of active) {
        const details = taskLineDetails(lines[line]), id = taskIdentity(details.text);
        const level = (lines[line].match(/^[ \t]*/)[0]).replace(/\t/g, "    ").length;
        while (ancestry.length && ancestry.at(-1) >= level) ancestry.pop();
        if (!ancestry.length && level >= 4 || ancestry.length && level - ancestry.at(-1) > 4) issues.push("INDENTED_CODE_OR_TASK");
        ancestry.push(level);
        if (id && ids.has(id)) issues.push("DUPLICATE_LEGACY_ID"); if (id) ids.add(id);
        if (!covered.has(line)) {
            try {
                const task = readTaskSnapshot(text, { path: name, line, text: details.text });
                for (const step of task.steps) { if (!active.includes(step.line)) issues.push("PARSER_CONTEXT_DISAGREEMENT"); covered.add(step.line); }
                const raw = text.slice(rows[line].start, rows[task.end]?.start ?? text.length);
                tasks.push({ line: line + 1, legacyId: task.hubTaskId, text: task.text, completed: task.completed, status: task.status, steps: task.steps.map(s => ({ line: s.line + 1, text: s.text, completed: s.completed, status: s.status })), metadata: taskMetadata(metadata[task.hubTaskId] ?? {}), raw });
            } catch (_) { issues.push("TASK_BOUNDARY_UNAVAILABLE"); }
        }
        const token = lines[line].match(/^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)(\[[ xX]\][ \t]?)/);
        if (token) { const start = Buffer.byteLength(text.slice(0, rows[line].start) + token[1]); edits.push({ line: line + 1, start, end: start + Buffer.byteLength(token[2]), before: token[2] }); }
    }
    if (active.length !== tasks.length + tasks.reduce((n, t) => n + t.steps.length, 0)) issues.push("UNACCOUNTED_CHECKBOX");
    // Duplicate IDs are archival warnings; marker conversion uses exact source
    // bytes/line offsets, never those IDs or title matching.
    return { tasks, literalCheckboxes: literals.length, identities: active.map(i => taskIdentity(lines[i])).filter(Boolean), steps: tasks.reduce((n, t) => n + t.steps.length, 0), edits, issues: [...new Set(issues)], safe: issues.every(x => x === "DUPLICATE_LEGACY_ID"), candidate: !!active.length || !!literals.length || /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[[^\]]\](?:\s|$)/m.test(text), raw: text };
}
async function applicationObservation(root) {
    const file = path.join(root, ".obsidian/plugins/hub-project-menu/data.json"), stat = await exists(file);
    if (!stat) return { metadata: {}, historyDigest: hash("absent"), metadataDigest: hash("{}"), present: false };
    await safeFile(root, ".obsidian/plugins/hub-project-menu/data.json");
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    return { metadata: data.taskMetadata ?? {}, historyDigest: hash(JSON.stringify(data.completedTaskHistory ?? [])), metadataDigest: hash(JSON.stringify(data.taskMetadata ?? {})), present: true };
}
async function inspectVault(vaultRoot) {
    const root = await fs.realpath(vaultRoot); check(!(await fs.lstat(vaultRoot)).isSymbolicLink(), "VAULT_LINK_UNAVAILABLE");
    const listing = await walk(root), app = await applicationObservation(root), captures = [], projects = [], registryFiles = [];
    for (const name of listing.files) {
        const file = await safeFile(root, name), stamp = await pin(file), bytes = await fs.readFile(file), header = projectHeader(bytes.toString("utf8"), name);
        if (header) { projects.push(header); registryFiles.push({ path: name, hash: hash(bytes), stamp }); }
        captures.push({ path: name, bytes, stamp });
    }
    const ambiguous = projects.filter(p => p.ambiguous), good = projects.filter(p => !p.ambiguous);
    const duplicates = new Set(good.filter(p => good.filter(q => q.projectId === p.projectId).length !== 1).map(p => p.projectId));
    const idCounts = new Map(); for (const c of captures) for (const id of analyzeSource(c.bytes, c.path).identities ?? []) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const attributedMetadata = Object.fromEntries(Object.entries(app.metadata).filter(([id]) => idCounts.get(id) === 1));
    const archivedMetadata = Object.fromEntries(Object.entries(app.metadata).filter(([id]) => idCounts.has(id)));
    const sources = captures.flatMap(c => {
        const parsed = analyzeSource(c.bytes, c.path, attributedMetadata); if (!parsed.candidate) return [];
        if (parsed.identities?.some(id => idCounts.get(id) > 1) && !parsed.issues.includes("DUPLICATE_LEGACY_ID")) parsed.issues.push("DUPLICATE_LEGACY_ID");
        for (const task of parsed.tasks) task.metadataConflict = idCounts.get(task.legacyId) > 1;
        const resource = findResourceForPath(RESOURCE_TYPES, c.path), project = findProjectForPath(good, c.path);
        const blocked = !resource && (ambiguous.some(p => c.path.startsWith(p.root + "/")) || duplicates.has(project?.projectId));
        const owner = resource ? { type: "resource", id: resource.id } : project && !blocked ? ref(project) : null;
        return [{ ...c, hash: hash(c.bytes), owner, shared: !!project?.shared, parsed, issues: [...parsed.issues, ...(!owner ? ["PHYSICAL_OWNER_UNAVAILABLE"] : [])] }];
    });
    const candidates = good.filter(p => !p.shared).map(p => { const owned = sources.filter(s => same(s.owner, ref(p))); return { ...p, eligible: ["active", "future", "shelved"].includes(p.status) && !duplicates.has(p.projectId), files: owned.length, tasks: owned.reduce((n, s) => n + s.parsed.tasks.length, 0), steps: owned.reduce((n, s) => n + s.parsed.steps, 0), reviewFiles: owned.filter(s => !s.parsed.safe).length }; });
    return { root, app, archivedMetadata, sources, projects, candidates, registryFiles, unresolved: [...listing.unresolved, ...ambiguous.map(p => ({ path: p.path, code: "PROJECT_IDENTITY_UNAVAILABLE" }))] };
}
async function validatePrivateLocation(directory, { vaultRoot, localDataRoot, cloudRoots = [], kind = "archive" }) {
    check(["archive", "authority"].includes(kind), "LOCATION_KIND_UNSUPPORTED");
    check(path.isAbsolute(directory) && path.isAbsolute(localDataRoot) && !directory.startsWith("\\\\"), "LOCAL_ABSOLUTE_PATH_REQUIRED");
    const target = await futurePath(directory), local = await fs.realpath(localDataRoot), vault = await fs.realpath(vaultRoot);
    check(inside(local, target) && !inside(vault, target) && !equal(vault, target) && !inside(target, vault), "PRIVATE_LOCATION_REQUIRED");
    for (const cloud of [...cloudRoots, process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) { const canonical = await futurePath(cloud); check(!equal(canonical, target) && !inside(canonical, target), "CLOUD_LOCATION_REJECTED"); }
    check(!target.split(path.sep).some(p => /^(OneDrive(?: - .*)?|Dropbox|Google Drive|iCloudDrive)$/i.test(p)), "CLOUD_LOCATION_REJECTED");
    for (let p = path.resolve(directory);; p = path.dirname(p)) {
        const s = await exists(p); if (s) check(s.isDirectory() && !s.isSymbolicLink(), "ORDINARY_DIRECTORY_REQUIRED");
        check(!(await exists(path.join(p, ".git"))), "GIT_LOCATION_REJECTED");
        if (equal(p, path.dirname(p))) break;
    }
    if (kind === "authority" && await exists(target)) {
        const names = await fs.readdir(target); check(!names.some(n => /^(WRITER\.lock|CURRENT\.json|RECOVERY\.json|REQUEST-)/.test(n)), "EXISTING_AUTHORITY_REQUIRES_SEPARATE_REVIEW"); check(!names.length, "AUTHORITY_PATH_NOT_EMPTY");
    }
    return { directory: target, privateLocationObserved: true, writerOwnership: "not-acquired", observationOnly: true };
}
async function prepareAuthority({ vaultRoot, localDataRoot, vaultId, projectId, deviceId }) {
    for (const value of [vaultId, projectId, deviceId]) check(typeof value === "string" && value.trim(), "STABLE_IDENTITY_REQUIRED");
    const directory = path.join(localDataRoot, "Itacan/NativeTasks/v1", hash(vaultId).slice(0, 24), hash(deviceId).slice(0, 24), hash(projectId).slice(0, 24), "repository");
    const location = await validatePrivateLocation(directory, { vaultRoot, localDataRoot, kind: "authority" });
    return { version: 1, purpose: "device-private-authority-preparation", executable: false, enabled: false, admitted: false, vaultId, localDataRoot: await fs.realpath(localDataRoot), owner: { type: "project", id: projectId }, deviceId, ...location };
}
async function writeNew(file, bytes) { const h = await fs.open(file, "wx", 0o600); try { await h.writeFile(bytes); await h.sync(); } finally { await h.close(); } }
async function captureArchive({ vaultRoot, localDataRoot, archivesRoot, vaultId }) {
    check(typeof vaultId === "string" && vaultId.trim(), "STABLE_VAULT_ID_REQUIRED");
    await validatePrivateLocation(archivesRoot, { vaultRoot, localDataRoot });
    const inventory = await inspectVault(vaultRoot);
    await fs.mkdir(archivesRoot, { recursive: true, mode: 0o700 }); await validatePrivateLocation(archivesRoot, { vaultRoot, localDataRoot });
    const archive = path.join(archivesRoot, "capture-" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID());
    await fs.mkdir(archive, { mode: 0o700 }); await fs.mkdir(path.join(archive, "originals"), { mode: 0o700 });
    const sources = [], text = ["ITACAN — READ-ONLY LEGACY TASK ARCHIVE", "Consultation and manual recreation only. No conversion, retirement or native activation.", "Vault identity: " + vaultId, ""];
    for (const s of inventory.sources) {
        const backup = "originals/" + hash(s.path) + ".md"; await writeNew(path.join(archive, backup), s.bytes);
        const backupHash = hash(await fs.readFile(path.join(archive, backup))); check(backupHash === s.hash, "BACKUP_VERIFICATION_FAILED");
        let unchanged = false;
        try { const file = await safeFile(inventory.root, s.path), after = await fs.readFile(file); unchanged = hash(after) === s.hash && stampEqual(s.stamp, await pin(file)); } catch (_) { /* Preserve captured bytes and mark the changed/missing source. */ }
        const safe = s.parsed.safe && !!s.owner && unchanged;
        sources.push({ path: s.path, owner: s.owner, shared: s.shared, backup, sourceHash: s.hash, backupHash, stamp: s.stamp, sourceUnchangedDuringCapture: unchanged, tasks: s.parsed.tasks.length, steps: s.parsed.steps, taskCountReliable: !s.parsed.issues.some(x => ["NON_UTF8_SOURCE", "TASK_BOUNDARY_UNAVAILABLE", "UNACCOUNTED_CHECKBOX"].includes(x)), retirementSafe: safe, issues: [...s.issues, ...(!unchanged ? ["SOURCE_CHANGED_DURING_CAPTURE"] : [])] });
        text.push("=".repeat(72), "Source: " + s.path, "Physical owner: " + (s.owner ? s.owner.type + ":" + s.owner.id : "Unresolved — review required"), "Backup: " + backup, "");
        for (const t of s.parsed.tasks) {
            const m = t.metadata; text.push("[" + t.status + "] " + t.text, "Line " + t.line + "; Necessity: " + (m.necessity ?? "unassigned"), "Start: " + (m.fromDate ?? "absent") + (m.fromTime ? " " + m.fromTime : "") + "; Due: " + (m.dueDate ?? "absent") + (m.dueTime ? " " + m.dueTime : ""));
            if (t.metadataConflict) text.push("Metadata attribution unavailable: copied legacy ID. Consult TASK-METADATA.json as unproven reference only.");
            if (m.description) text.push("Description: " + m.description);
            for (const step of t.steps) text.push("  [" + step.status + "] " + step.text + " (line " + step.line + ")");
            text.push("Original task block (verbatim):", t.raw, "");
        }
        if (!s.parsed.safe || !s.parsed.tasks.length || s.parsed.literalCheckboxes) text.push("Unsupported/literal source preserved for review:", s.parsed.raw ?? "Non-UTF-8 bytes: consult verified original backup.", "");
    }
    const registryFiles = [];
    for (const source of sources) {
        try {
            const file = await safeFile(inventory.root, source.path);
            if (hash(await fs.readFile(file)) !== source.sourceHash || !stampEqual(await pin(file), source.stamp)) source.sourceUnchangedDuringCapture = false;
        } catch (_) { source.sourceUnchangedDuringCapture = false; }
        if (!source.sourceUnchangedDuringCapture) { source.retirementSafe = false; if (!source.issues.includes("SOURCE_CHANGED_DURING_CAPTURE")) source.issues.push("SOURCE_CHANGED_DURING_CAPTURE"); }
    }
    for (const item of inventory.registryFiles) { const file = await safeFile(inventory.root, item.path); registryFiles.push({ ...item, unchanged: hash(await fs.readFile(file)) === item.hash && stampEqual(await pin(file), item.stamp) }); }
    const appAfter = await applicationObservation(inventory.root);
    const readable = text.join("\n"), metadataReference = JSON.stringify(inventory.archivedMetadata, null, 2) + "\n";
    const manifest = { version: 1, purpose: "read-only-task-archive", activationAuthorized: false, createdAt: new Date().toISOString(), vaultId, vaultRoot: inventory.root, readableHash: hash(readable), metadataReferenceHash: hash(metadataReference), sources, registryFiles, candidates: inventory.candidates, unresolved: inventory.unresolved, application: { historyDigest: inventory.app.historyDigest, metadataDigest: inventory.app.metadataDigest, unchanged: inventory.app.historyDigest === appAfter.historyDigest && inventory.app.metadataDigest === appAfter.metadataDigest } };
    await writeNew(path.join(archive, "TASK-METADATA.json"), metadataReference);
    await writeNew(path.join(archive, "TASKS.txt"), readable); await writeNew(path.join(archive, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
    await writeNew(path.join(archive, "MANIFEST.sha256"), hash(await fs.readFile(path.join(archive, "MANIFEST.json"))) + "\n");
    await verifyArchive(archive); return { archive, manifest };
}
async function verifyArchive(archive) {
    check(!(await fs.lstat(archive)).isSymbolicLink(), "ARCHIVE_LINK_REJECTED"); const root = await fs.realpath(archive), raw = await fs.readFile(await safeFile(root, "MANIFEST.json"));
    check(hash(raw) === (await fs.readFile(await safeFile(root, "MANIFEST.sha256"), "utf8")).trim(), "MANIFEST_HASH_MISMATCH");
    const manifest = JSON.parse(raw); check(manifest.version === 1 && manifest.purpose === "read-only-task-archive" && manifest.activationAuthorized === false, "ARCHIVE_FORMAT_UNSUPPORTED");
    const paths = new Set(); for (const s of manifest.sources) { relative(s.path); check(!paths.has(s.path), "DUPLICATE_SOURCE_PATH"); paths.add(s.path); check(/^originals\/[a-f0-9]{64}\.md$/.test(s.backup), "INVALID_BACKUP_PATH"); check(hash(await fs.readFile(await safeFile(root, s.backup))) === s.backupHash && s.backupHash === s.sourceHash, "BACKUP_VERIFICATION_FAILED"); }
    check(hash(await fs.readFile(await safeFile(root, "TASKS.txt"))) === manifest.readableHash, "READABLE_ARCHIVE_HASH_MISMATCH");
    check(hash(await fs.readFile(await safeFile(root, "TASK-METADATA.json"))) === manifest.metadataReferenceHash, "METADATA_REFERENCE_HASH_MISMATCH"); return manifest;
}
async function previewRetirement({ archive, owner }) {
    check(["project", "resource"].includes(owner?.type) && typeof owner.id === "string", "ONE_EXPLICIT_PROJECT_OR_RESOURCE_REQUIRED");
    const manifest = await verifyArchive(archive), candidate = owner.type === "resource" ? RESOURCE_TYPES.filter(r => r.id === owner.id).map(r => ({ root: r.root, path: r.hubPath, eligible: true, shared: false }))[0] : manifest.candidates.find(p => p.projectId === owner.id);
    check(candidate?.eligible && !candidate.shared, "ELIGIBLE_PRIVATE_PROJECT_REQUIRED");
    const fresh = await inspectVault(manifest.vaultRoot), current = fresh.sources.filter(s => same(s.owner, owner)), saved = manifest.sources.filter(s => same(s.owner, owner));
    const problems = [];
    if ([...manifest.unresolved, ...fresh.unresolved].some(item => item.path === candidate.root || item.path.startsWith(candidate.root + "/"))) problems.push("UNRESOLVED_OWNER_SOURCE");
    if ((owner.type === "project" && !fresh.candidates.find(p => p.projectId === owner.id)?.eligible) || JSON.stringify(fresh.registryFiles.map(r => r.path).sort()) !== JSON.stringify(manifest.registryFiles.map(r => r.path).sort())) problems.push("OWNER_REGISTRY_CHANGED");
    if (JSON.stringify(current.map(s => s.path).sort()) !== JSON.stringify(saved.map(s => s.path).sort())) problems.push("TASK_SOURCE_SET_CHANGED");
    for (const r of manifest.registryFiles) { const file = await safeFile(manifest.vaultRoot, r.path); if (!r.unchanged || hash(await fs.readFile(file)) !== r.hash || !stampEqual(await pin(file), r.stamp)) problems.push("OWNER_REGISTRY_CHANGED"); }
    if (fresh.app.historyDigest !== manifest.application.historyDigest) problems.push("LEGACY_HISTORY_CHANGED");
    if (fresh.app.metadataDigest !== manifest.application.metadataDigest || !manifest.application.unchanged) problems.push("TASK_METADATA_CHANGED");
    const files = [];
    for (const s of saved) {
        const now = current.find(c => c.path === s.path), issues = [...s.issues];
        if (!now || now.hash !== s.sourceHash || !stampEqual(now.stamp, s.stamp)) issues.push("SOURCE_HASH_OR_WRITE_STAMP_CHANGED");
        if (!s.retirementSafe || !now?.parsed.safe) issues.push("AMBIGUOUS_RETIREMENT");
        if (issues.some(i => i !== "DUPLICATE_LEGACY_ID")) { files.push({ path: s.path, safe: false, issues }); continue; }
        const chunks = []; let offset = 0;
        for (const edit of now.parsed.edits) { check(now.bytes.subarray(edit.start, edit.end).equals(Buffer.from(edit.before)), "SPAN_PREREQUISITE_FAILED"); chunks.push(now.bytes.subarray(offset, edit.start)); offset = edit.end; }
        chunks.push(now.bytes.subarray(offset)); const proposedBytes = Buffer.concat(chunks);
        check(!analyzeSource(proposedBytes, s.path).tasks.length, "ACTIVE_CHECKBOX_REMAINS");
        files.push({ path: s.path, safe: true, sourceHash: s.sourceHash, proposedHash: hash(proposedBytes), edits: now.parsed.edits, unrelatedBytesPreserved: true, proposedBytes });
    }
    return { version: 1, executable: false, owner, files, problems: [...new Set(problems)], previewSafe: !problems.length && files.every(f => f.safe), sourceWrites: 0 };
}
async function cutoverPreflight({ archive, owner, authority }) {
    const manifest = await verifyArchive(archive), blockers = [];
    if (!owner) blockers.push("PROJECT_NOT_SELECTED");
    let preview = null; if (owner) { try { preview = await previewRetirement({ archive, owner }); if (!preview.previewSafe) blockers.push("RETIREMENT_PREVIEW_BLOCKED", ...preview.problems); } catch (e) { blockers.push(e.code ?? "PREVIEW_UNAVAILABLE"); } }
    if (!authority || authority.enabled !== false || authority.admitted !== false || authority.purpose !== "device-private-authority-preparation" || authority.vaultId !== manifest.vaultId || !same(authority.owner, owner)) blockers.push("AUTHORITY_PREPARATION_REQUIRED");
    else {
        try {
            const validated = await prepareAuthority({ vaultRoot: manifest.vaultRoot, localDataRoot: authority.localDataRoot, vaultId: manifest.vaultId, projectId: owner.id, deviceId: authority.deviceId });
            check(equal(validated.directory, authority.directory), "AUTHORITY_PATH_CHANGED");
        } catch (e) { blockers.push(e.code ?? "AUTHORITY_PATH_UNAVAILABLE"); }
    }
    // File checks cannot prove a future exclusive write window or rule out ABA
    // writes by an uncooperative process. These are mandatory cutover gates.
    return { version: 1, executable: false, preparationReady: !blockers.length, activationReady: false, blockers: [...new Set([...blockers, "EXCLUSIVE_SOURCE_WRITE_QUIESCENCE_REQUIRED", "PERMANENT_NATIVE_ADMISSION_NOT_APPROVED", "EXPLICIT_CUTOVER_AUTHORIZATION_REQUIRED"])], preview };
}
module.exports = { projectHeader, inspectVault, analyzeSource, validatePrivateLocation, prepareAuthority, captureArchive, verifyArchive, previewRetirement, cutoverPreflight };
