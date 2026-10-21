"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawn } = require("node:child_process"), crypto = require("node:crypto");
const scenario = process.argv[2] ?? "project"; if (!["project", "home-schedule", "history", "startup"].includes(scenario)) throw Error("Unknown isolated rehearsal scenario");
const workspace = path.resolve(__dirname, "../../.."), plugin = path.join(workspace, ".obsidian/plugins/hub-project-menu"), root = fs.mkdtempSync(path.join(os.tmpdir(), "itacan-real-host-"));
const real = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir()), rel = path.relative(temp, real); if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || real.startsWith(fs.realpathSync(workspace) + path.sep)) throw Error("Isolation refused");
for (const cloud of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) if (real.startsWith(fs.realpathSync(cloud) + path.sep)) throw Error("Cloud isolation refused");
if (!fs.lstatSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw Error("Ordinary root required");
for (const n of ["obsidian-profile", "vault", "native", "evidence"]) { const child=path.join(root,n);fs.mkdirSync(child);if(fs.lstatSync(child).isSymbolicLink() || !fs.lstatSync(child).isDirectory() || path.relative(real,fs.realpathSync(child))!==n) throw Error("Ordinary owned directory required"); }
const profile = path.join(root, "obsidian-profile"), vault = path.join(root, "vault"), fixture = path.join(vault, ".obsidian/plugins/itacan-m1a-fixture"); fs.mkdirSync(fixture, { recursive: true });
// Only a tiny API bootstrap is loaded by Obsidian. No Itacan bundle is copied/installed.
fs.writeFileSync(path.join(fixture, "manifest.json"), JSON.stringify({ id: "itacan-m1a-fixture", name: "Isolated Itacan component rehearsal", version: "1.0.0", minAppVersion: "1.0.0", author: "Fixture", isDesktopOnly: true }));
fs.writeFileSync(path.join(fixture, "main.js"), 'const api=require("obsidian");module.exports=class extends api.Plugin{static api=api;onload(){window.__m1aBootstrap=this;}};');
fs.writeFileSync(path.join(vault, ".obsidian/community-plugins.json"), JSON.stringify(["itacan-m1a-fixture"])); fs.writeFileSync(path.join(vault, ".obsidian/app.json"), JSON.stringify({ safeMode: false }));
fs.writeFileSync(path.join(vault, ".obsidian/appearance.json"), JSON.stringify({ theme: "obsidian", cssTheme: "", baseFontSize: 17 }));
fs.writeFileSync(path.join(vault, "Home.md"), "# Synthetic component rehearsal\n");
fs.writeFileSync(path.join(profile, "obsidian.json"), JSON.stringify({ vaults: { m1afixture: { path: vault, ts: 1, open: true } }, cli: false, updateDisabled: true }));
fs.writeFileSync(path.join(profile, "m1afixture.json"), "{}");
const executable = path.join(plugin, "lib/atlas/tests/native/node_modules/electron/dist/electron.exe"), archive = process.env.ITACAN_OBSIDIAN_ARCHIVE || path.join(process.env.LOCALAPPDATA, "Programs/Obsidian/resources/obsidian.asar");
if (!fs.existsSync(executable) || !fs.existsSync(archive)) throw Error("Existing isolated Electron and installed Obsidian are required");
fs.writeFileSync(path.join(root, "evidence/launch.json"), JSON.stringify({ root, executable, archive, workspace, rehearsalId: crypto.randomUUID() }, null, 2));
const env = { ...process.env, ITACAN_REAL_HOST_SCENARIO: scenario, ITACAN_REAL_HOST_ROOT: root, ITACAN_REAL_HOST_WORKSPACE: workspace, ITACAN_OBSIDIAN_ARCHIVE: archive, ITACAN_REAL_HOST_GUARD: process.execArgv[process.execArgv.indexOf("--require") + 1] }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, [path.join(__dirname, "obsidian-host.cjs")], { env, cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = "", stderr = "";
child.stdout.on("data", b => { stdout += b; process.stdout.write(b); }); child.stderr.on("data", b => { stderr += b; process.stderr.write(b); }); child.on("error", e => { console.error(e); process.exitCode = 1; });
child.on("close", (exitCode, signal) => { fs.writeFileSync(path.join(root, "evidence/process.json"), JSON.stringify({ pid: child.pid, exitCode, signal, stdout, stderr }, null, 2)); console.log("M1A evidence: " + root); process.exitCode = exitCode === 0 && stdout.includes(scenario === "startup" ? "PASS actual Itacan startup" : scenario === "project" ? "PASS actual Obsidian M1A" : scenario === "history" ? "PASS actual Obsidian History/Statistics" : "PASS actual Obsidian Home/Schedule") ? 0 : 1; });
