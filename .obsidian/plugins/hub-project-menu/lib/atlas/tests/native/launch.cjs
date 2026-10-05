"use strict";
const { spawn } = require("child_process"), fs = require("fs"), path = require("path"), os = require("os");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-native-test-"));
const env = { ...process.env, ATLAS_NATIVE_TEST_ROOT: directory };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require("electron"), [path.join(__dirname, "runner.cjs")], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let output = "", completed = false;
child.stdout.on("data", data => { process.stdout.write(data); output = (output + data.toString()).slice(-1000); completed ||= /Native Atlas tests: 21 passed/.test(output); });
child.stderr.on("data", data => process.stderr.write(data));
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("close", code => {
    if (code !== 0) console.error(`Electron process exited with ${code}`);
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("atlas-native-test-")) throw new Error("Unexpected native test cleanup path");
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    process.exitCode = code === 0 && completed ? 0 : 1;
});
