"use strict";
if (process.env.ITACAN_REAL_HOST_GUARD) require(process.env.ITACAN_REAL_HOST_GUARD);
const Module = require("module"), path = require("path"), original = Module._load;
const workspace = process.env.ITACAN_REAL_HOST_WORKSPACE;
if (!workspace || !process.env.ITACAN_REAL_HOST_ROOT) throw Error("Rehearsal context missing");
Module._load = function(name) { return original.call(this, name === "@electron/remote" ? path.join(workspace, ".obsidian/plugins/hub-project-menu/lib/atlas/tests/native/node_modules/@electron/remote") : name, ...Array.prototype.slice.call(arguments, 1)); };
