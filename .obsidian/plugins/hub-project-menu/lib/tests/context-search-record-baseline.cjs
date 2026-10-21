"use strict";
// Explicit one-time capture, run before the Phase 2B-2A production edits.
// Regular tests only read the committed JSON; they never update expectations.
const fs = require("node:fs"), path = require("node:path");
const { createSearchFixture, summarize, parityCases } = require("./context-search-fixture.cjs");
const { ContextSearchService } = require("../services/context-search");
async function run() {
    if (process.argv[2] !== "--record-baseline") throw Error("Explicit baseline capture flag required");
    const output = path.join(__dirname, "context-search-parity.json");
    if (fs.existsSync(output)) throw Error("Refusing to overwrite captured pre-integration evidence");
    const f = createSearchFixture(), search = new ContextSearchService(f.plugin), result = [];
    try {
        for (const [query, workspace] of parityCases) result.push({ query, workspace, groups: summarize(await search.search(query, f.workspaces.find(item => item.projectId === workspace) ?? null, f.dv)) });
        const task = (await search.search("zephyr", f.projects[0], f.dv)).flatMap(group => group.items).find(item => item.kind === "tasks");
        await search.open(task, null);
        fs.writeFileSync(output, JSON.stringify({ cases: result, taskReveal: f.calls.at(-1), counts: f.counts }, null, 2) + "\n", { flag: "wx" });
        process.stdout.write(`Captured ${result.length} actual pre-integration Search result sets; task reveal ${f.calls.at(-1)[1]}\n`);
    } finally { await f.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
