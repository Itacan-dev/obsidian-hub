"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { spawnSync } = require("node:child_process");

test("legacy facade serves approved Search, Daily Brief, Schedule and workspace Tasks reads; native core remains unreachable", () => {
    const root = path.resolve(__dirname, "../.."), visited = new Set();
    const visit = file => {
        if (visited.has(file)) return;
        visited.add(file);
        const text = fs.readFileSync(file, "utf8");
        for (const match of text.matchAll(/require\(\s*["'](\.[^"']+)["']\s*\)/g)) {
            const target = path.resolve(path.dirname(file), match[1]);
            const resolved = [target, target + ".js", path.join(target, "index.js")].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
            assert(resolved, "Existing local import resolves: " + match[1]); visit(resolved);
        }
    };
    visit(path.join(root, "plugin.js"));
    assert(visited.size > 50, "Inspect the real production module graph");
    assert([...visited].some(file => path.basename(file) === "task-service-host.js"));
    assert(![...visited].some(file => file.includes("ItacanTaskCore")));
    const bundle = fs.readFileSync(path.join(root, "main.js"), "utf8");
    // The installed bundle is checked after the reviewed Search-only rebuild.
    assert(bundle.includes("class LegacyTaskAdapter")); assert(bundle.includes("TASK_SERVICE_OPERATIONS"));
    const search = fs.readFileSync(path.join(root, "lib/services/context-search.js"), "utf8");
    assert(search.includes("this.taskService.queryDisplay()") && search.includes("this.taskService.resolveReveal("));
    assert(!search.includes("taskData.readPages(") && !search.includes("taskData.subscribe("));
    const brief = fs.readFileSync(path.join(root, "lib/services/daily-brief.js"), "utf8");
    const schedule = fs.readFileSync(path.join(root, "lib/ui/task-workspace.js"), "utf8");
    assert(brief.includes("this.plugin.taskService") && !brief.includes("taskData.readPages(") && !brief.includes("oath.tasks("));
    assert(schedule.includes("new TaskReadSession(plugin.taskService") && !schedule.includes("taskData.readWorkspace(") && !schedule.includes("taskData.subscribe("));
    assert(schedule.includes("plugin.mutateTask(reference)") && schedule.includes("openTaskCreator(plugin.taskEditor"));
    const dashboard = fs.readFileSync(path.resolve(root, "../../../System/Dashboards/Project/view.js"), "utf8");
    const panel = dashboard.slice(dashboard.indexOf("// ---------- CURRENT TASKS ----------"), dashboard.indexOf("// ---------- PROGRESS ----------"));
    assert(panel.includes("hubCreateTaskPanelRead") && !panel.includes("readPages(") && !panel.includes(".pages(") && !panel.includes(".subscribe("));
    const planning = fs.readFileSync(path.join(root, "lib/services/project-planning.js"), "utf8");
    assert(planning.includes("this.plugin.taskService.queryStructured(options)") && !planning.includes("taskData.readWorkspace("));
    const home = fs.readFileSync(path.resolve(root, "../../../System/Dashboards/Home/view.js"), "utf8");
    assert(home.includes("hubCreateHomeTaskRead") && !home.includes("readPages(") && !home.includes("hubTaskData?.subscribe"));
    const homeRead = fs.readFileSync(path.join(root, "lib/services/home-task-read.js"), "utf8");
    assert(homeRead.includes("new TaskReadSession(plugin.taskService") && !homeRead.includes(".pages("));
    assert(!home.includes("hubGetCompletedTaskHistory") && !dashboard.includes("hubGetCompletedTaskHistory"));
    const history = fs.readFileSync(path.join(root, "lib/services/task-history-read.js"), "utf8");
    assert(history.includes('plugin.taskService.queryHistory({ projection: "recorded" })') && !history.includes("readPages(") && !history.includes(".subscribe("));
    for (const name of ["inbox"]) {
        assert(!/\btaskService\b/.test(fs.readFileSync(path.join(root, `lib/services/${name}.js`), "utf8")), `${name} stays on its current task implementation`);
    }
    const oath = fs.readFileSync(path.join(root, "lib/services/oath.js"), "utf8");
    const committed = oath.slice(oath.indexOf("    async resolveWork()"), oath.indexOf("    refresh(readTasks"));
    assert(committed.includes("this.plugin.taskService.resolveOathWork(") && !committed.includes("this.tasks()") && !committed.includes("vault.read("));
    require("./oath-committed-boundaries.cjs").unchangedOath(fs.readFileSync(path.join(root, "lib/tests/oath-committed-original.cjs"), "utf8"), oath);
});

test("application modules import without platform, vault, native storage or browser APIs", () => {
    const serviceFile = path.resolve(__dirname, "../services/task-service.js"), legacyFile = path.resolve(__dirname, "../services/task-service-legacy.js");
    const script = `const Module = require('node:module'); const original = Module._load;
        Module._load = function(name) {
            const plain = name.replace(/^node:/, '');
            if (['fs', 'fs/promises', 'crypto', 'electron', 'obsidian', 'dataview'].includes(plain) || name.includes('ItacanTaskCore')) throw Error('Unexpected platform import: '+name);
            return original.apply(this, arguments);
        };
        if (typeof document !== 'undefined' || typeof window !== 'undefined') throw Error('Browser globals unexpectedly present');
        const {TaskService} = require(${JSON.stringify(serviceFile)});
        const {LegacyTaskAdapter} = require(${JSON.stringify(legacyFile)});
        if (typeof TaskService !== 'function' || typeof LegacyTaskAdapter !== 'function') throw Error('Exports missing');`;
    const child = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", windowsHide: true, env: process.env });
    assert.equal(child.status, 0, child.stderr || child.error?.message);
});
