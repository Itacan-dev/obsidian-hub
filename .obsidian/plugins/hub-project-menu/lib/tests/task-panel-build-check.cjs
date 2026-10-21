"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
const [originalPath, candidatePath] = process.argv.slice(2);
if (!originalPath || !candidatePath) throw Error("Supply original and staged bundles");
function factories(filename) {
    const source = fs.readFileSync(filename, "utf8"); new Function(source);
    const end = source.indexOf("const __hubModuleCache"); assert(end > 0); const context = {};
    vm.runInNewContext(source.slice(0, end) + ";globalThis.factories=__hubModules;", context);
    return Object.fromEntries(Object.entries(context.factories).map(([key, value]) => [key, value.toString().replace(/\r\n/g, "\n")]));
}
const original = factories(originalPath), candidate = factories(candidatePath);
const changed = Object.keys(original).filter(key => candidate[key] !== original[key]).sort(), added = Object.keys(candidate).filter(key => !(key in original)).sort();
assert.deepEqual(changed, ["lib/services/task-service-legacy-bridge.js", "lib/services/task-service-legacy-read.js", "lib/services/task-service-legacy.js", "plugin.js"]);
assert.deepEqual(added, ["lib/services/task-panel-read.js"]); assert(Object.keys(original).every(key => key in candidate));
const strict = text => text.slice(text.indexOf("    #owner(path)"));
assert.equal(strict(candidate["lib/services/task-service-legacy.js"]), strict(original["lib/services/task-service-legacy.js"]));
const writers = text => text.slice(text.indexOf("    async toggleTask(path,"));
assert.equal(writers(candidate["plugin.js"]), writers(original["plugin.js"]), "Every plugin task mutation/history/clear writer remains byte identical");
let expectedEntry = original["plugin.js"];
expectedEntry = expectedEntry.replace("window.hubCreateTaskUi = (component, body, onEdit) =>", "window.hubCreateTaskUi = (component, body, onEdit, actions = {}) =>")
    .replace("mutate: request => this.mutateTask(request),", "mutate: actions.mutate ?? (request => this.mutateTask(request)),")
    .replace("editTask: (task, saved) => openTaskEditor(this.taskEditor, task, saved),", "editTask: actions.editTask ?? ((task, saved) => openTaskEditor(this.taskEditor, task, saved)),")
    .replace('        this.taskService = __hubRequire("lib/services/task-service-host.js").createLegacyTaskService(this);',
        '        this.taskService = __hubRequire("lib/services/task-service-host.js").createLegacyTaskService(this);\n        window.hubCreateTaskPanelRead = options => __hubRequire("lib/services/task-panel-read.js").createTaskPanelRead({\n            plugin: this, ...options, editTask: (task, saved) => openTaskEditor(this.taskEditor, task, saved)\n        });')
    .replace("        delete window.hubCreateTaskUi;", "        delete window.hubCreateTaskUi;\n        delete window.hubCreateTaskPanelRead;");
assert(candidate["plugin.js"] === expectedEntry, "Only explicit optional panel action injection, panel factory and cleanup change in plugin entry");
for (const name of ["atlas-native.cjs", "strict-oath-assets.json"]) assert.equal(fs.readFileSync(path.join(path.dirname(candidatePath), name), "utf8"), fs.readFileSync(path.join(path.dirname(originalPath), name), "utf8"));
assert(!Object.keys(candidate).some(name => name.includes("ItacanTaskCore")));
console.log(JSON.stringify({ originalModules: Object.keys(original).length, candidateModules: Object.keys(candidate).length,
    unchangedModules: Object.keys(original).length - changed.length, changed, added, strictLegacyAndPluginWriters: "identical", previousConsumers: "identical", otherAssets: "identical" }, null, 2));
