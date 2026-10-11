"use strict";
// Match the installed Obsidian remote dependency in this disposable process only.
// No host webPreferences are relaxed, and this preload is never used by the dock.
const Module = require("module"), path = require("path"), original = Module._load;
const remotePath = path.join(__dirname, "../../atlas/tests/native/node_modules/@electron/remote");
Module._load = function (name, ...args) { return original.call(this, name === "@electron/remote" ? remotePath : name, ...args); };
