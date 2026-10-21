"use strict";
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const root = path.resolve(__dirname, ".."), output = path.join(root, ".cache/benchmark.cjs");
fs.mkdirSync(path.dirname(output), { recursive: true });
require(path.join(root, "node_modules/esbuild")).buildSync({ absWorkingDir: root, tsconfig: path.join(root, "tsconfig.json"), entryPoints: [path.join(__dirname, "benchmark.ts")], outfile: output, bundle: true, platform: "node", format: "cjs", target: "es2022", external: ["obsidian"] });
const result = spawnSync(process.execPath, [output], { windowsHide: true, stdio: "inherit" }); process.exitCode = result.status ?? 1;
