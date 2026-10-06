"use strict";
// Portable Hub fixtures use the existing development browser engine.
const { spawn, execFileSync } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hub-electron-fixture-"));
const env = { ...process.env, ATLAS_BROWSER_TEST_ROOT: directory }; delete env.ELECTRON_RUN_AS_NODE;
if (env.HUB_TEST_BASELINE === "1") {
    const baseline = path.join(directory, "baseline-styles.css");
    fs.writeFileSync(baseline, execFileSync("git", ["show", "HEAD:.obsidian/plugins/hub-project-menu/styles.css"], { cwd: path.resolve(__dirname, "../../../../../../.."), windowsHide: true }));
    env.HUB_TEST_STYLES = baseline;
}
const child = spawn(require("electron"), [path.join(__dirname, "browser-runner.cjs"), ...process.argv.slice(2)], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let completed = false, output = "";
child.stdout.on("data", data => { process.stdout.write(data); output = (output + data.toString()).slice(-2000); completed ||= /Hub browser fixtures: \d+ passed, 0 failed/.test(output); });
child.stderr.on("data", data => process.stderr.write(data));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("close", code => {
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("hub-electron-fixture-")) throw Error("Unexpected fixture cleanup path");
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); process.exitCode = code === 0 && completed ? 0 : 1;
});
