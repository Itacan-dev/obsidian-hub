"use strict";
// Supplement the immutable 18-case capture using the exact source backed up
// before this phase. This program refuses to overwrite the recorded evidence.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const { createSearchFixture, enrichSearchFixture, extraParityCases, summarize } = require("./context-search-fixture.cjs");
const backup = process.argv[2];
if (!backup) throw Error("Supply the explicitly captured pre-integration Search source backup.");
const filename = path.resolve(__dirname, "../services/context-search.js"), compiled = new Module(filename, module);
compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(fs.readFileSync(backup, "utf8"), filename);
(async () => {
    const f = enrichSearchFixture(createSearchFixture()), service = new compiled.exports.ContextSearchService(f.plugin), cases = [];
    try {
        for (const [query, workspace] of extraParityCases) cases.push({ query, workspace,
            groups: summarize(await service.search(query, f.workspaces.find(item => item.projectId === workspace) ?? null, f.dv)) });
        fs.writeFileSync(path.join(__dirname, "context-search-extra-parity.json"), JSON.stringify({ cases }, null, 2) + "\n", { flag: "wx" });
        console.log(`Captured ${cases.length} supplemental result sets from the actual backed-up original Search source.`);
    } finally { await f.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
