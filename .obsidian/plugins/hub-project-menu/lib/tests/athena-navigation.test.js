"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const filename = path.resolve(__dirname, "../../plugin.js"), compiled = new Module(filename, module), original = Module._load;
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
try {
    Module._load = function(name) { return name === "obsidian" ? { Plugin: class {}, Modal: class {}, FuzzySuggestModal: class {}, TFile: class {}, TFolder: class {}, Notice: class {} } : original.apply(this, arguments); };
    compiled._compile(fs.readFileSync(filename, "utf8") + "\nmodule.exports.Modes = HubWorkspaceModeService;", filename);
} finally { Module._load = original; }
test("Hub navigation preserves a visible Athena sidebar and retains ordinary collapse behavior", () => {
    for (const visible of [undefined, false, true]) {
        const calls = [], plugin = { app: { workspace: { leftSplit: { collapse: () => calls.push("left") }, rightSplit: { collapse: () => calls.push("right") } } } };
        if (visible !== undefined) plugin.athena = { preserveRightSidebar: () => visible };
        const modes = Object.assign(Object.create(compiled.exports.Modes.prototype), { plugin, app: plugin.app });
        modes.collapseNativeSidebars(); assert.deepEqual(calls, visible ? ["left"] : ["left", "right"]);
    }
});
