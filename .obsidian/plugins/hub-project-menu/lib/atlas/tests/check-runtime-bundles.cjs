"use strict";
// Run before sharing plugin changes: Git pulls execute these bundles, not source.
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const plugin = path.resolve(__dirname, "../../..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-bundle-check-"));
try {
    execFileSync(process.execPath, [path.join(plugin, "build.js"), "--output-dir", temporary], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const normalize = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const stale = ["main.js", "atlas-native.cjs"].filter(name => normalize(path.join(plugin, name)) !== normalize(path.join(temporary, name)));
    if (stale.length) {
        console.error("Runnable plugin bundles are stale: " + stale.join(", ") + ". Rebuild both before sharing these changes.");
        process.exitCode = 1;
    } else console.log("Runnable plugin bundles match current source.");
} finally {
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("atlas-bundle-check-")) throw Error("Unexpected bundle-check cleanup path");
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
