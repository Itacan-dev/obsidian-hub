"use strict";
// Explicit, development-only acquisition. No lifecycle scripts, global installs or source patches.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const pins = require("./dependencies.json");
if (process.type === "browser" || process.platform !== "win32" || process.arch !== "x64") throw Error("Use Windows x64 Node mode");
const root = path.join(__dirname, "node_modules", "phase2-upstream");
async function download(url, name, algorithm, expected) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`${response.status}: ${url}`);
    const data = Buffer.from(await response.arrayBuffer());
    const digest = crypto.createHash(algorithm).update(data).digest(algorithm === "sha512" ? "base64" : "hex");
    if (digest !== expected) throw Error("Upstream artifact digest mismatch: " + name);
    const file = path.join(root, name); fs.writeFileSync(file, data); return file;
}
(async () => {
    fs.mkdirSync(root, { recursive: true });
    for (const [name, url, algorithm, digest, subdir] of [
        ["package.tgz", pins.getWindows.packageUrl, "sha512", pins.getWindows.packageSha512, "source"],
        ["binary.tgz", pins.getWindows.binaryUrl, "sha256", pins.getWindows.binarySha256, "binary"]
    ]) {
        const file = await download(url, name, algorithm, digest), target = path.join(root, subdir);
        fs.mkdirSync(target, { recursive: true });
        const entries = execFileSync("tar.exe", ["-tzf", file], { encoding: "utf8", windowsHide: true }).trim().split(/\r?\n/);
        if (entries.some(entry => path.isAbsolute(entry) || entry.split(/[\\/]/).includes("..") || entry.includes(":"))) throw Error("Unsafe archive entry");
        execFileSync("tar.exe", ["-xzf", file, "-C", target], { windowsHide: true });
    }
    const base = `https://raw.githubusercontent.com/nut-tree/nut.js/${pins.nutJs.commit}/`;
    for (const file of [pins.nutJs.provider, "providers/libnut/package.json", "core/nut.js/package.json"]) {
        const response = await fetch(base + file, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw Error(`${response.status}: ${file}`);
        fs.writeFileSync(path.join(root, "nut-" + file.replaceAll("/", "-")), await response.text());
    }
    fs.writeFileSync(path.join(root, "provenance.json"), JSON.stringify(pins, null, 2));
    console.log("Verified upstream diagnostic artifacts: " + root);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
