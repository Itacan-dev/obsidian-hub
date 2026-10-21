"use strict";
const fs = require("node:fs"), path = require("node:path"), { createPanelFixture } = require("./task-panel-fixture.cjs");
const target = path.join(__dirname, "task-panel-input.json");
if (fs.existsSync(target)) throw Error("Refusing to replace captured synthetic inputs");
const f = createPanelFixture();
fs.writeFileSync(target, JSON.stringify({ files: [...f.files], contents: [...f.contents], pages: [...f.pages],
    metadata: f.plugin.projectWizard.data.taskMetadata, workspaces: f.workspaces }, null, 2) + "\n");
f.close().catch(error => { throw error; });
