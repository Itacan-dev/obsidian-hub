"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const [originalPath, candidatePath] = process.argv.slice(2);
if (!originalPath || !candidatePath) throw Error("Supply the recorded original and staged bundle paths.");
function factories(filename) {
    const source = fs.readFileSync(filename, "utf8"); new Function(source);
    const end = source.indexOf("const __hubModuleCache"); assert(end > 0);
    const context = {};
    vm.runInNewContext(source.slice(0, end) + ";globalThis.factories=__hubModules;", context);
    return Object.fromEntries(Object.entries(context.factories).map(([key, value]) => [key, value.toString().replace(/\r\n/g, "\n")]));
}
const original = factories(originalPath), candidate = factories(candidatePath);
const changed = Object.keys(original).filter(key => candidate[key] !== original[key]).sort();
const added = Object.keys(candidate).filter(key => !(key in original)).sort();
assert.deepEqual(changed, ["lib/services/daily-brief.js", "lib/services/task-service-legacy.js", "lib/services/task-service.js", "lib/ui/task-workspace.js"]);
assert.deepEqual(added, ["lib/services/task-read-session.js", "lib/services/task-service-legacy-bridge.js", "lib/services/task-service-legacy-read.js"]);
assert(Object.keys(original).every(key => key in candidate));
assert.equal(candidate["plugin.js"], original["plugin.js"], "Plugin lifecycle, development-only visibility, task writers and all other entry code remain byte-identical");
const legacySuffix = text => text.slice(text.indexOf("    #owner(path)"));
assert.equal(legacySuffix(candidate["lib/services/task-service-legacy.js"]), legacySuffix(original["lib/services/task-service-legacy.js"]),
    "All existing strict source/edit/history/reveal/write implementations remain identical");
const persistence = text => text.slice(text.indexOf("        const data = this.plugin.projectWizard.data, previous = data.dailyBriefSnapshot;"), text.indexOf("    start()"));
assert.equal(persistence(candidate["lib/services/daily-brief.js"]), persistence(original["lib/services/daily-brief.js"]), "Existing snapshot/shown-day persistence and rollback stay identical");
for (const name of ["atlas-native.cjs", "strict-oath-assets.json"]) assert.equal(fs.readFileSync(path.join(path.dirname(candidatePath), name), "utf8"), fs.readFileSync(path.join(path.dirname(originalPath), name), "utf8"));
assert(!Object.keys(candidate).some(name => name.includes("ItacanTaskCore")));
process.stdout.write(JSON.stringify({ originalModules: Object.keys(original).length, candidateModules: Object.keys(candidate).length,
    unchangedExistingModules: Object.keys(original).length - changed.length, changed, added,
    pluginAndWriters: "unchanged", strictLegacyMethods: "unchanged", savedDataPersistence: "unchanged apart from pre-save cancellation guard", otherGeneratedAssets: "unchanged" }, null, 2) + "\n");
