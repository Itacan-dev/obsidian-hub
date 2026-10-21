"use strict";
const assert = require("assert").strict;
const { initialComposerTaskLocation } = require("../domain/task-compact-form");
const owners = [
    { root: "Projects/P", contextKind: "project" },
    { root: "Resources/Knowledge", contextKind: "resource" },
    { root: "Resources/Explorations", contextKind: "resource" }
];
let active = "Projects/P/Tasks.md", current = null;
const entries = owners.flatMap(workspace => [{ path: workspace.root, workspace, folder: true }, { path: workspace.root + "/Tasks.md", workspace }]);
const service = {
    app: { workspace: { getActiveFile: () => ({ path: active }) } },
    currentContext: () => current,
    context: path => owners.find(owner => path === owner.root || path?.startsWith(owner.root + "/")),
    locations: root => entries.filter(entry => !root || entry.workspace.root === root)
};
assert.equal(initialComposerTaskLocation(service), "Resources/Explorations", "Home ignores a stale active Project note and resolves the conventional Explorations folder");
current = owners[0];
assert.equal(initialComposerTaskLocation(service), active, "Known Project preserves its active task note");
active = "Resources/Knowledge/Tasks.md"; current = owners[1];
assert.equal(initialComposerTaskLocation(service), active, "Known Resource note context is preserved");
assert.equal(initialComposerTaskLocation(service, { root: owners[0].root }), owners[0].root, "Explicit Project root overrides an unrelated active Resource note");
assert.equal(initialComposerTaskLocation(service, { location: owners[0].root + "/Tasks.md" }), owners[0].root + "/Tasks.md");
assert.equal(initialComposerTaskLocation(service, { path: owners[1].root }), owners[1].root);
assert.equal(initialComposerTaskLocation(service, { location: "missing/note.md" }), "missing/note.md", "Invalid explicit destinations never silently relocate");
assert.equal(initialComposerTaskLocation(service, { root: "missing/root" }), "", "Missing explicit contexts never silently substitute another workspace");
current = null;
assert.equal(initialComposerTaskLocation({ ...service, locations: () => [] }), "", "Unavailable Explorations does not invent a note or choose an unrelated project");
console.log("Composer destination routing checks passed.");
