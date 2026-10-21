"use strict";
const fs = require("node:fs"), path = require("node:path");
const { createHomeFixture } = require("./home-read-fixture.cjs");
const f = createHomeFixture();
fs.writeFileSync(path.join(__dirname, "home-read-input.json"), JSON.stringify({ workspaces: f.workspaces, projects: f.projects, resources: f.resources,
    files: [...f.files], contents: [...f.contents], pages: [...f.pages], metadata: f.plugin.projectWizard.data.taskMetadata }, null, 2) + "\n");
console.log("Recorded " + f.files.size + " synthetic file entries");
f.close().catch(error => { throw error; });
