"use strict";
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const original = Module._load;
Module._load = function(name) { return name === "obsidian" ? { Modal: class {}, Component: class {}, setIcon() {} } : original.apply(this, arguments); };
let DailyBriefService;
if (process.argv[3]) {
    const filename = path.resolve(__dirname, "../services/daily-brief.js"), compiled = new Module(filename, module);
    compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename));
    compiled._compile(fs.readFileSync(process.argv[3], "utf8"), filename); DailyBriefService = compiled.exports.DailyBriefService;
} else throw Error("Supply the explicitly captured original Daily Brief source; never capture the integrated implementation as its own baseline.");
Module._load = original;
const { createReadFixture, briefFacts, scheduleFacts } = require("./task-read-fixture.cjs");
(async () => {
    if (process.argv[2] !== "--record-original") throw Error("Explicit original capture required.");
    const destination = path.join(__dirname, "task-read-parity.json");
    if (fs.existsSync(destination)) throw Error("Refusing to overwrite original evidence.");
    const f = createReadFixture();
    try {
        const service = new DailyBriefService(f.plugin, { now: f.now });
        const dates = [f.now(), new Date(2026, 9, 26, 5, 59), new Date(2026, 9, 26, 6), new Date(2026, 2, 29, 6), new Date(2026, 9, 25, 6)];
        const brief = dates.map(now => ({ now: now.toISOString(), facts: briefFacts(service.context(now)) }));
        const schedule = scheduleFacts(f.plugin.taskData.readWorkspace(f.dv, f.projects[0]));
        fs.writeFileSync(destination, JSON.stringify({ timezone: process.env.TZ, brief, schedule }, null, 2) + "\n", { flag: "wx" });
        process.stdout.write("Captured original Daily Brief evidence/recommendations at five local day/DST boundaries and Schedule task/group/calendar inputs.\n");
    } finally { await f.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
