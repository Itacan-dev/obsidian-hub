"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto"), Module = require("node:module"), { spawnSync } = require("node:child_process");
const plugin = path.resolve(__dirname, "../../.."), directory = fs.mkdtempSync(path.join(os.tmpdir(), "athena-export-"));
try {
  const result = spawnSync(process.execPath, [path.join(plugin, "build.js"), "--output-dir", directory], { windowsHide: true, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(plugin, "lib/athena/build-manifest.json"), "utf8"));
  for (const [name, digest] of Object.entries(manifest.artifacts)) if (name !== "lib/athena/runtime.cjs") {
    const bytes = fs.readFileSync(path.join(directory, name), "utf8").replace(/\r\n/g, "\n"); assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), digest);
  }
  assert(!fs.existsSync(path.join(directory, "node_modules")));
  // Load the actual export with package lookup disabled. Obsidian supplies its
  // virtual API at runtime; everything else must be bundled or a Node built-in.
  const main = path.join(directory, "main.js"), compiled = new Module(main, module), original = Module._load;
  compiled.filename = main; compiled.paths = [];
  try {
    Module._load = function(name) {
      if (name === "obsidian") { class Native {} return { Plugin: Native, Menu: Native, Notice: Native, Modal: Native, FuzzySuggestModal: Native, TFile: Native, TFolder: Native, normalizePath: value => value, setIcon() {} }; }
      assert(Module.isBuiltin(name), "Unexpected production package lookup: " + name); return original.apply(this, arguments);
    };
    compiled._compile(fs.readFileSync(main, "utf8"), main); assert.equal(typeof compiled.exports, "function");
  } finally { Module._load = original; }
  console.log("PASS Athena production export: bundled runtime, worker, notices/licenses and no npm runtime dependencies.");
} finally {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("athena-export-")) throw Error("Unexpected export cleanup path");
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
