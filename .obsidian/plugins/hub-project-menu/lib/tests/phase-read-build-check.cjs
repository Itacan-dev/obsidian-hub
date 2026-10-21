"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const [beforePath, afterPath] = process.argv.slice(2); if (!beforePath || !afterPath) throw Error("Supply original and candidate bundles");
function factories(file) {
    const source = fs.readFileSync(file, "utf8"); new Function(source); const end = source.indexOf("const __hubModuleCache"); assert(end > 0);
    const context = {}; vm.runInNewContext(source.slice(0, end) + ";globalThis.modules=__hubModules;", context);
    return Object.fromEntries(Object.entries(context.modules).map(([name, value]) => [name, value.toString().replace(/\r\n/g, "\n")]));
}
const before = factories(beforePath), after = factories(afterPath), changed = Object.keys(before).filter(name => before[name] !== after[name]).sort(), added = Object.keys(after).filter(name => !(name in before)).sort();
assert.deepEqual(changed, ["lib/services/project-planning.js", "lib/ui/planning-editor.js"]); assert.deepEqual(added, ["lib/services/phase-task-read.js"]);
assert(Object.keys(before).every(name => name in after));
const writers = source => source.slice(source.indexOf("    subscribe(component"));
assert(writers(before["lib/services/project-planning.js"]) === writers(after["lib/services/project-planning.js"]), "All planning subscription/transaction/link/save/remove/reorder methods are identical");
for (const name of ["plugin.js", "lib/ui/project-roadmap.js", "lib/services/task-editor.js", "lib/services/oath.js", "lib/services/task-service-legacy.js", "lib/services/context-search.js", "lib/services/daily-brief.js", "lib/ui/task-workspace.js", "lib/services/task-panel-read.js"]) assert(before[name] === after[name], name + " remains identical");
for (const name of ["atlas-native.cjs", "strict-oath-assets.json"]) assert(fs.readFileSync(path.join(path.dirname(beforePath), name)).equals(fs.readFileSync(path.join(path.dirname(afterPath), name))));
assert(!Object.keys(after).some(name => name.includes("ItacanTaskCore")));
console.log(JSON.stringify({ originalModules: Object.keys(before).length, candidateModules: Object.keys(after).length, unchangedExistingModules: Object.keys(before).length - changed.length,
    changed, added, planningWriters: "byte-identical", roadmap: "byte-identical", previousConsumersAndWriters: "byte-identical", otherAssets: "identical" }, null, 2));
