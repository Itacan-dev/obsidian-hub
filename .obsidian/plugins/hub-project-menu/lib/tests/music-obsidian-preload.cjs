"use strict";
// Match Obsidian's installer-provided remote bridge using the already installed
// development-only dependency. No host Node APIs are added to media guests.
const Module = require("module"), path = require("path"), originalLoad = Module._load;
const remotePath = path.join(__dirname, "../atlas/tests/native/node_modules/@electron/remote");
Module._load = function (name) { return originalLoad.call(this, name === "@electron/remote" ? remotePath : name, ...Array.prototype.slice.call(arguments, 1)); };
