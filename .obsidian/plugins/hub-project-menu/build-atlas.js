"use strict";
// Compile the same unchanged TypeScript source for Obsidian's CommonJS loader.
const path = require("path");
const fs = require("fs"), { createHash } = require("crypto");
const { execFileSync } = require("child_process");
const root = path.resolve(__dirname, "../../..");
const core = path.join(root, "AtlasCore/packages/core");
execFileSync(process.execPath, [path.join(core, "node_modules/typescript/bin/tsc"),
    "-p", path.join(core, "tsconfig.json"), "--module", "commonjs",
    "--moduleResolution", "node10", "--ignoreDeprecations", "6.0",
    "--verbatimModuleSyntax", "false", "--declaration", "true",
    "--outDir", path.join(__dirname, "lib/atlas/core")], { stdio: "inherit", windowsHide: true });
// Keep manifest verification stable across Git's LF/CRLF text checkouts.
const hash = file => createHash("sha256").update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")).digest("hex");
const output = path.join(__dirname, "lib/atlas/core");
const sources = fs.readdirSync(path.join(core, "src")).filter(name => name.endsWith(".ts")).sort();
const artifacts = fs.readdirSync(output).filter(name => /\.(?:js|d\.ts)$/.test(name)).sort();
fs.writeFileSync(path.join(output, "build-manifest.json"), JSON.stringify({
    schemaVersion: 1, compiler: "typescript-6.0.3", builder: hash(__filename), configuration: hash(path.join(core, "tsconfig.json")),
    sources: Object.fromEntries(sources.map(name => [name, hash(path.join(core, "src", name))])),
    artifacts: Object.fromEntries(artifacts.map(name => [name, hash(path.join(output, name))]))
}, null, 2) + "\n");
console.log("Compiled AtlasCore for Obsidian.");
