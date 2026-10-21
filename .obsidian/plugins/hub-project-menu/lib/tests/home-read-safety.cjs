"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../../.."), audit = process.argv[2], installed = process.argv.includes("--installed");
if (!audit) throw Error("Supply the recorded audit directory");
const readJson = name => JSON.parse(fs.readFileSync(path.join(audit, name), "utf8").replace(/^\uFEFF/, ""));
const baseline = readJson("baseline.json"), originals = new Map(baseline.files.map(item => [item.path, item.sha256.toUpperCase()]));
const recordedInstallation = process.argv.includes("--recorded-installation") ? readJson("installation.json").installed : null;
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
const plugin = ".obsidian/plugins/hub-project-menu/", allowed = new Set([
    "System/Dashboards/Home/view.js", plugin + "main.js", plugin + "plugin.js", plugin + "lib/services/TASK-SERVICE.md",
    plugin + "lib/services/task-service-legacy.js", plugin + "lib/services/task-service-contract.d.ts",
    plugin + "lib/tests/task-service-boundary.test.js", plugin + "lib/tests/task-data.test.js", plugin + "lib/tests/task-service-types.fixture.ts",
    plugin + "lib/tests/home-task-actions-browser.js", plugin + "lib/tests/workspace-task-actions-browser.js"
]);
const backupPaths = new Set([...allowed, plugin + "lib/services/task-service-legacy-read.js"]);
const changed = [], external = [], missing = [], backups = [];
for (const [name, before] of originals) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) { missing.push(name); continue; }
    if (hash(file) !== before) {
        if (allowed.has(name)) changed.push(name);
        else if (name === ".obsidian/workspace.json") external.push(name);
        else throw Error("Unexpected baseline change: " + name);
    }
    if (backupPaths.has(name)) {
        const backup = path.join(baseline.backup, "before", name);
        assert(fs.existsSync(backup), "Original backup exists: " + name); assert.equal(hash(backup), before, "Original backup hash: " + name); backups.push(name);
    }
}
assert.equal(missing.length, 0, "No baseline file disappeared");
const git = args => cp.execFileSync("git", args, { cwd: root, windowsHide: true, encoding: "utf8" }).trimEnd().split(/\r?\n/).filter(Boolean);
const status = git(["-c", "core.quotepath=false", "status", "--short"]), currentStatus = new Set(status);
assert(baseline.status.every(entry => currentStatus.has(entry)), "Every initial Git status entry remains");
const privateMd = cp.execFileSync("rg", ["--files", "--hidden", "--no-ignore", "-g", "*.md", "-g", "!System/Backups/**", "-g", "!**/.git/**", "-g", "!**/node_modules/**", "-g", "!**/.trash/**"],
    { cwd: root, windowsHide: true, encoding: "utf8" }).trim().split(/\r?\n/);
const currentFiles = [...new Set([...git(["-c", "core.quotepath=false", "ls-files", "--cached", "--others", "--exclude-standard"]), ...privateMd].map(name => name.replace(/\\/g, "/")))];
const added = currentFiles.filter(name => !originals.has(name) && !name.startsWith("System/Backups/"));
for (const name of added) assert(name.startsWith(plugin + "lib/tests/home-read") || name === plugin + "lib/services/home-task-read.js" ||
    name === plugin + "lib/services/TASK-SERVICE-PHASE-2B-2E-2F.md", "Only phase files were added: " + name);
const beforeBundle = originals.get(plugin + "main.js"), candidate = hash(path.join(audit, "candidate-build/main.js"));
assert.equal(hash(path.join(root, plugin + "main.js")), installed ? candidate : recordedInstallation ?? beforeBundle);
const allFiles = cp.execFileSync("rg", ["--files", "--hidden", "--no-ignore", "-g", "!System/Backups/**", "-g", "!**/.git/**", "-g", "!**/node_modules/**"],
    { cwd: root, windowsHide: true, encoding: "utf8" }).split(/\r?\n/).map(name => name.replace(/\\/g, "/"));
const nativeFiles = allFiles.filter(name => /\/(?:CURRENT(?:\.json)?|WRITER\.lock)$|\/generations\//i.test(name));
assert.equal(nativeFiles.length, 0, "No live native authority/lock/generation files");
const phaseFiles = [...new Set([...changed, ...added])];
const whitespace = path.join(audit, "whitespace"); fs.mkdirSync(whitespace, { recursive: true });
for (const [index, name] of phaseFiles.entries()) {
    let before = originals.has(name) ? fs.readFileSync(path.join(baseline.backup, "before", name), "utf8").replace(/\r\n/g, "\n") : "";
    const after = fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
    if (name.endsWith("/home-read-original.cjs")) {
        const original = fs.readFileSync(path.join(baseline.backup, "before/System/Dashboards/Home/view.js"), "utf8").replace(/\r\n/g, "\n");
        assert.equal(after, original, "Frozen original Home exactly matches verified original backup"); before = original;
    }
    const a = path.join(whitespace, index + ".before"), b = path.join(whitespace, index + ".after"); fs.writeFileSync(a, before); fs.writeFileSync(b, after);
    const result = cp.spawnSync("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "core.whitespace=trailing-space,space-before-tab", "diff", "--no-index", "--check", a, b],
        { windowsHide: true, encoding: "utf8" });
    assert([0, 1].includes(result.status) && !result.stdout.trim() && !result.stderr.trim(), "No introduced whitespace in " + name + ": " + result.stdout + result.stderr);
}
const result = { baselineHashRecords: baseline.files.length, uniqueBaselineFiles: originals.size, initialStatusEntries: baseline.status.length,
    preservedStatusEntries: baseline.status.length, changed, added, externalApplicationManagedChanges: external, verifiedOriginalBackups: backups,
    nativeFiles, beforeBundle, candidateBundle: candidate, installed, whitespace: "no introduced errors", phaseFiles: phaseFiles.map(name => ({ path: name, sha256: hash(path.join(root, name)) })) };
fs.writeFileSync(path.join(audit, installed ? "safety-final.json" : "safety-preinstall.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ baselineHashRecords: result.baselineHashRecords, uniqueBaselineFiles: result.uniqueBaselineFiles, initialStatusEntries: result.initialStatusEntries,
    changed: changed.length, added: added.length, external, verifiedBackups: backups.length, candidate, installed, nativeFiles, whitespace: result.whitespace }, null, 2));
