"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const [beforePath, afterPath] = process.argv.slice(2);
function factories(file) {
    const source = fs.readFileSync(file, "utf8"); new Function(source); const end = source.indexOf("const __hubModuleCache"); assert(end > 0);
    const context = {}; vm.runInNewContext(source.slice(0, end) + ";globalThis.modules=__hubModules;", context);
    return Object.fromEntries(Object.entries(context.modules).map(([name, value]) => [name, value.toString().replace(/\r\n/g, "\n")]));
}
const before = factories(beforePath), after = factories(afterPath);
const changed = Object.keys(before).filter(name => before[name] !== after[name]).sort(), added = Object.keys(after).filter(name => !(name in before)).sort();
assert.deepEqual(changed, ["lib/services/task-service-legacy.js", "plugin.js"]); assert.deepEqual(added, ["lib/services/home-task-read.js"]);
assert(Object.keys(before).every(name => name in after));
const bridge = '        window.hubCreateHomeTaskRead = options => __hubRequire("lib/services/home-task-read.js").createHomeTaskRead({\n            plugin: this, ...options, editTask: (task, saved) => openTaskEditor(this.taskEditor, task, saved)\n        });\n';
assert(after["plugin.js"].replace(bridge, "").replace('        delete window.hubCreateHomeTaskRead;\n', "") === before["plugin.js"], "Only Home host factory/cleanup changed; every writer and lifecycle method stays identical");
assert.equal(after["lib/services/task-service-legacy.js"].slice(after["lib/services/task-service-legacy.js"].indexOf("    async resolveLegacyAction(")),
    before["lib/services/task-service-legacy.js"].slice(before["lib/services/task-service-legacy.js"].indexOf("    async resolveLegacyAction(")), "All strict action resolution, source validation, facade mutations and subscriptions identical");
for (const name of ["atlas-native.cjs", "strict-oath-assets.json"]) assert(fs.readFileSync(path.join(path.dirname(beforePath), name)).equals(fs.readFileSync(path.join(path.dirname(afterPath), name))));
assert(!Object.keys(after).some(name => name.includes("ItacanTaskCore")));
const root = path.resolve(__dirname, "../../../../.."), original = fs.readFileSync(path.join(__dirname, "home-read-original.cjs"), "utf8").replace(/\r\n/g, "\n"), home = fs.readFileSync(path.join(root, "System/Dashboards/Home/view.js"), "utf8").replace(/\r\n/g, "\n");
assert.equal(home.slice(0, home.indexOf("// ---------- Tasks to Do ----------")), original.slice(0, original.indexOf("// ---------- Tasks to Do ----------")));
const between = text => text.slice(text.indexOf("// ---------- CALENDAR ----------"), text.indexOf("function removeClearedTasksFromCache("));
assert.equal(between(home), between(original), "Calendar/Focus/Projects/Resources/Progress/History rendering and independent subscriptions remain identical");
const section = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b, text.indexOf(a)));
assert.equal(section(home, "function completedTaskRequest(", "async function clearCompletedTaskItems("), section(original, "function completedTaskRequest(", "async function clearCompletedTaskItems("), "Original clear-record presentation attribution unchanged");
assert.equal(section(home, "function renderTaskContext()", "\nframe.defer(").trim(), section(original, "function renderTaskContext()", "window.hubTaskData?.subscribe").trim(), "Task grouping, count and active context rendering unchanged");
console.log(JSON.stringify({ originalModules: Object.keys(before).length, candidateModules: Object.keys(after).length, unchangedExistingModules: Object.keys(before).length-changed.length,
    changed, added, writersAndPreviousConsumers: "identical", nativeAssets: "identical", homeIndependentPanels: "identical" }, null, 2));
