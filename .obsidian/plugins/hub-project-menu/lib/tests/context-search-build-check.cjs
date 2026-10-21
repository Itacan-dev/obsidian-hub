"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const [beforePath, candidatePath] = process.argv.slice(2);
if (!beforePath || !candidatePath) throw Error("Supply the captured baseline and disposable candidate bundle paths.");
function factories(file) {
    const text = fs.readFileSync(file, "utf8"); new Function(text);
    const end = text.indexOf("const __hubModuleCache"); assert(end > 0);
    const context = {};
    // Declare functions without running any module factory, plugin or onload.
    vm.runInNewContext(text.slice(0, end) + ";globalThis.factories = __hubModules;", context);
    return Object.fromEntries(Object.entries(context.factories).map(([id, factory]) => [id, factory.toString().replace(/\r\n/g, "\n")]));
}
const before = factories(beforePath), candidate = factories(candidatePath);
const removed = Object.keys(before).filter(id => !(id in candidate));
const added = Object.keys(candidate).filter(id => !(id in before)).sort();
const changed = Object.keys(before).filter(id => id in candidate && candidate[id] !== before[id]).sort();
assert.deepEqual(removed, []);
assert.deepEqual(changed, ["lib/services/context-search.js", "lib/services/task-data.js", "lib/ui/context-search.js", "plugin.js"]);
assert.deepEqual(added, ["lib/services/task-service-errors.js", "lib/services/task-service-host.js", "lib/services/task-service-legacy-display.js",
    "lib/services/task-service-legacy-values.js", "lib/services/task-service-legacy.js", "lib/services/task-service.js"]);
assert.equal(candidate["plugin.js"].replace('        this.taskService = __hubRequire("lib/services/task-service-host.js").createLegacyTaskService(this);\n', ""), before["plugin.js"],
    "Only the explicit legacy facade lifecycle insertion changed in the plugin entry; task writers stay identical");
for (const file of ["atlas-native.cjs", "strict-oath-assets.json"]) {
    assert.equal(fs.readFileSync(path.join(path.dirname(beforePath), file), "utf8"), fs.readFileSync(path.join(path.dirname(candidatePath), file), "utf8"));
}
process.stdout.write(JSON.stringify({ baselineModules: Object.keys(before).length, candidateModules: Object.keys(candidate).length,
    unchangedExistingModules: Object.keys(before).length - changed.length, changed, added, removed,
    pluginChange: "one legacy facade lifecycle insertion", otherGeneratedArtifacts: "unchanged" }, null, 2) + "\n");
