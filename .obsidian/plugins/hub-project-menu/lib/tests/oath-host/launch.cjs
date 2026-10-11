"use strict";
// Explicit development entrypoint. Does not build, install, reload or write to the real vault/profile.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { spawn, execFileSync } = require("node:child_process"), { createHash, randomUUID } = require("node:crypto");
if (process.type === "browser") {
    console.error("Run this launcher with Node or ELECTRON_RUN_AS_NODE=1; refusing GUI-mode startup before creating any fixture.");
    process.exit(1);
}
const plugin = path.resolve(__dirname, "../../.."), token = randomUUID();
const binary = path.join(plugin, "lib/atlas/tests/native/node_modules/electron/dist/electron.exe");
const archive = "C:\\Program Files\\Obsidian\\resources\\obsidian.asar";
if (process.platform !== "win32" || !fs.existsSync(binary) || !fs.existsSync(archive)) throw Error("Requires Windows and the existing Obsidian / native-test Electron installations; nothing will be installed");
const allowedArgs = new Set(["--alt-tab", "--safety-only", "--windows-adapter", "--strict-lifecycle", "--strict-ui", "--strict-release", "--strict-preview", "--preview-smoke"]);
for (const arg of process.argv.slice(2)) if (!allowedArgs.has(arg)) throw Error("Unknown argument: " + arg);
if (process.argv.includes("--windows-adapter") && process.argv.includes("--alt-tab")) throw Error("Phase 2 does not inject global keyboard input");
if (process.argv.some(arg => ["--strict-lifecycle", "--strict-ui", "--strict-release", "--strict-preview", "--preview-smoke"].includes(arg)) && process.argv.slice(2).length !== 1) throw Error("Use each Strict experiment alone");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "itacan-oath-phase1-"));
const vault = path.join(scratch, "vault"), profile = path.join(scratch, "profile");
const output = path.join(os.tmpdir(), "itacan-oath-phase1-report-" + token + ".json");
const marker = { token, scratch, vault, profile, archive, altTab: process.argv.includes("--alt-tab"), safetyOnly: process.argv.includes("--safety-only"), windowsAdapter: process.argv.includes("--windows-adapter") };
marker.strictLifecycle = process.argv.includes("--strict-lifecycle");
marker.strictUI = process.argv.includes("--strict-ui");
marker.strictRelease = process.argv.includes("--strict-release");
marker.preview = process.argv.includes("--strict-preview") || process.argv.includes("--preview-smoke");
marker.previewSmoke = process.argv.includes("--preview-smoke");
const fingerprints = new Map();
function remember(file) { fingerprints.set(file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")); }
let child, finished = false, watchdog, killTimer, log = "", report = null, restarting = false;
function cleanScratch() {
    const resolved = fs.realpathSync(scratch), temp = fs.realpathSync(os.tmpdir());
    if (path.dirname(resolved).toLowerCase() !== temp.toLowerCase() || !path.basename(resolved).startsWith("itacan-oath-phase1-") ||
        JSON.parse(fs.readFileSync(path.join(resolved, "fixture.json"), "utf8")).token !== token) throw Error("Unsafe experiment cleanup path");
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
function finish(code) {
    if (finished) return; finished = true; clearTimeout(watchdog); clearTimeout(killTimer);
    const unchanged = [...fingerprints].every(([file, hash]) => createHash("sha256").update(fs.readFileSync(file)).digest("hex") === hash);
    let cleanup = false, cleanupError;
    try { cleanScratch(); cleanup = true; } catch (error) { cleanupError = error.message; }
    const final = { ...(report ?? { checks: [], fatal: "Host did not return a report" }), launcher: {
        exitCode: code, copiedSourceUnchanged: unchanged, temporaryProfileRemoved: cleanup, cleanupError,
        source: "Installed Obsidian archive in existing test Electron; not the installed launcher runtime" }, log };
    fs.writeFileSync(output, JSON.stringify(final, null, 2));
    console.log("PHASE1_REPORT " + output);
    process.exitCode = code === 0 && unchanged && cleanup && report && !report.fatal ? 0 : 1;
}
function abort() {
    if (finished) return;
    if (child?.connected) child.send({ type: "abort", token });
    // Last resort targets the exact disposable child process, never Obsidian by name.
    killTimer ??= setTimeout(() => { child?.kill(); }, 8000);
}
try {
    fs.mkdirSync(profile); fs.mkdirSync(vault); fs.writeFileSync(path.join(scratch, "fixture.json"), JSON.stringify(marker));
    const copied = path.join(vault, ".obsidian/plugins/hub-project-menu"); fs.mkdirSync(copied, { recursive: true });
    for (const name of ["main.js", "manifest.json", "styles.css", "atlas-native.cjs"]) {
        const source = path.join(plugin, name); remember(source); fs.copyFileSync(source, path.join(copied, name));
    }
    // Copy source modules only. In particular, never copy user data, cookies, Atlas authority or credentials.
    fs.cpSync(path.join(plugin, "lib"), path.join(copied, "lib"), { recursive: true,
        filter: source => { const parts = path.relative(path.join(plugin, "lib"), source).split(path.sep);
            if (parts.includes("tests") || parts.includes("node_modules")) return false;
            if (fs.statSync(source).isFile()) remember(source); return true; } });
    if (marker.strictLifecycle || marker.strictUI || marker.strictRelease || marker.preview) {
        remember(path.join(plugin, "plugin.js")); remember(path.join(plugin, "build.js"));
        execFileSync(binary, [path.join(plugin, "build.js"), "--output-dir", copied],
            { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, windowsHide: true, timeout: 30000, stdio: "pipe" });
    }
    fs.writeFileSync(path.join(vault, "Home.md"), "# Isolated Itacan Oath experiment\nSynthetic content only. No Oath is taken or scheduled.\n");
    fs.writeFileSync(path.join(vault, ".obsidian/community-plugins.json"), JSON.stringify(["hub-project-menu"]));
    fs.writeFileSync(path.join(vault, ".obsidian/app.json"), JSON.stringify({ safeMode: false }));
    fs.writeFileSync(path.join(profile, "obsidian.json"), JSON.stringify({ vaults: { oathphase1: { path: vault, ts: 1, open: true } }, cli: false, updateDisabled: true }));
    const env = { ...process.env, ITACAN_OATH_FIXTURE: scratch, ITACAN_OATH_TOKEN: token }; delete env.ELECTRON_RUN_AS_NODE;
    // These GUI windows must be visible for desktop stacking evidence. Only the launcher is hidden.
    const startHost = () => {
    child = spawn(binary, [path.join(__dirname, "host.cjs")], { env, windowsHide: false, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    for (const stream of [child.stdout, child.stderr]) stream.on("data", data => { const text = data.toString(); log = (log + text).slice(-30000); process.stdout.write(text); });
    child.on("message", message => {
        if (message?.token !== token) return;
        if (message.type === "report") report = message.report;
        if (message.type === "restart" && marker.strictRelease && !marker.restartStage) {
            restarting = true; marker.restartStage = true; fs.writeFileSync(path.join(scratch, "fixture.json"), JSON.stringify(marker));
        }
    });
    child.on("error", error => { log += error.stack; finish(1); });
    child.on("close", code => {
        if (restarting && code === 0) { restarting = false; setTimeout(startHost, 1000); return; }
        // Companions also exit on IPC disconnect, with their own 4-second lease.
        setTimeout(() => finish(code), 5000);
    });
    };
    startHost();
    watchdog = setTimeout(abort, marker.preview && !marker.previewSmoke ? 21 * 60000 : 180000);
    process.on("SIGINT", abort); process.on("SIGTERM", abort);
} catch (error) { log += error.stack; finish(1); }
