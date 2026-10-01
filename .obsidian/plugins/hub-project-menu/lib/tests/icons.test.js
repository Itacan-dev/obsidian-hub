"use strict";
const assert = require("assert/strict");
const Module = require("module");
const { fileIcon } = require("../ui/file-icons");
const canonical = new Set(["folder", "folder-open", "folder-symlink", "presentation", "monitor", "file", "file-type", "file-text", "notebook-text"]);
const aliases = { folder: "folder-open", presentation: "monitor" };
const lookups = [], rendered = [];
const nativeGetIcon = name => {
    lookups.push(name);
    const resolved = name.startsWith("lucide-") ? name.slice(7) : aliases[name] ?? name;
    return canonical.has(resolved) || (!name.startsWith("lucide-") && ["custom-hub-icon", "legacy-only"].includes(resolved)) ? resolved : null;
};
const originalLoad = Module._load;
Module._load = function(name) {
    if (name === "obsidian") return { getIcon: nativeGetIcon, setIcon: (element, icon) => rendered.push(nativeGetIcon(icon)) };
    return originalLoad.apply(this, arguments);
};
let setHubIcon;
try { ({ setHubIcon } = require("../ui/icons")); } finally { Module._load = originalLoad; }
assert.equal(nativeGetIcon("folder"), "folder-open", "Fixture reproduces the native legacy alias collision");
for (const name of ["folder", "folder-open", "folder-symlink", fileIcon("slides.pptx"), fileIcon("notes.md"), fileIcon("book.pdf")]) {
    setHubIcon({}, name);
    assert.equal(rendered.at(-1), name, "Canonical semantic icon survives Obsidian alias lookup: " + name);
}
setHubIcon({}, "lucide-folder");
assert.equal(rendered.at(-1), "folder", "Already-prefixed canonical names stay valid");
for (const name of ["custom-hub-icon", "legacy-only"]) {
    setHubIcon({}, name);
    assert.equal(rendered.at(-1), name, "Custom/legacy-only names still render");
}
setHubIcon({}, "missing-icon");
assert.equal(rendered.at(-1), null, "Unknown names are not disguised as a different semantic icon");
console.log("Hub icon resolution passed: canonical Lucide names, folder/presentation legacy collisions, custom and legacy fallback.");
