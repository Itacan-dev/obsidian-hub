"use strict";
const assert = require("assert"), Module = require("module");
const originalLoad = Module._load;
Module._load = function(name) { return name === "obsidian" ? { Modal: class {}, Component: class {}, setIcon() {} } : originalLoad.apply(this, arguments); };
let DailyBriefService;
try { ({ DailyBriefService } = require("../services/daily-brief")); } finally { Module._load = originalLoad; }

async function run() {
    const oldDocument = global.document;
    global.document = { querySelector: () => null };
    try {
        const project = { projectId: "p", contextKind: "project", status: "active", root: "Projects/P", path: "Projects/P/P.md", name: "P" };
        const resource = { contextKind: "resource", resourceType: "study", root: "Resources/Knowledge", path: "Resources/Knowledge/Knowledge.md", label: "Knowledge" };
        const files = new Map([project.path, resource.path, "Projects/P/Task.md", "Resources/Knowledge/Shared/Task.md", "Home.md"].map(path => [path, { path, extension: "md" }]));
        const task = { path: "Projects/P/Task.md", line: 0, text: "Assignment", hubTaskId: "parent", completed: false };
        let content = "- [ ] Assignment <!-- hub-task:parent -->\n    - [ ] 2b <!-- hub-task:step -->\n", metadata = {}, calls = [], reads = 0;
        const oath = { active: false, current: null, workspace: project, ready: () => true, api: () => ({}), tasks: () => [task],
            canOpen: path => !oath.active || (typeof path === "object" ? path.path : path).startsWith(project.root) || String(path).startsWith("Resources/Knowledge/Shared/"),
            enterWorkspace: async () => { calls.push("oath"); }, onChange: () => () => {} };
        const plugin = { oath, app: { vault: { getAbstractFileByPath: path => files.get(path), read: async () => { reads++; return content; } },
            metadataCache: { getFirstLinkpathDest: () => null } },
            taskData: { currentPath: path => path, readPages: () => [{ file: { tasks: [task] } }] },
            taskEditor: { metadata: () => metadata },
            workspaceModes: { openProjectNote: async path => { calls.push(path); return true; }, openProjectFull: async workspace => { calls.push(workspace.path); return true; }, openHome: async () => { calls.push("home"); return true; } },
            projectWizard: { data: {}, getProjectById: id => id === "p" ? project : null, getResourceById: id => id === "study" ? resource : null,
                getContextForPath: path => path.startsWith(project.root) ? project : path.startsWith(resource.root) ? resource : null,
                getProjectRecords: () => [project], getResourceTypes: () => [resource], getProgressReports: () => [], completedTaskHistory: [], activityLog: [] },
            dataStore: { save: async () => {} } };
        require("./task-read-test-host.cjs").attachLegacyFacade(plugin);
        const service = new DailyBriefService(plugin, { now: () => new Date(2026, 8, 26, 10) }); service.started = true;
        const target = { kind: "file", workspaceId: "p", path: task.path, taskId: "parent", stepId: "step" };
        await service.navigate(target); assert.deepEqual(calls, [task.path]); assert.ok(reads);
        calls = []; content = content.replace("[ ] 2b", "[x] 2b"); await service.navigate(target); assert.deepEqual(calls, ["home"], "Completed Step cannot be offered as a continuation");
        content = content.replace("[x] 2b", "[ ] 2b");
        metadata = { fromDate: "2026-09-27" }; calls = []; await service.navigate(target); assert.deepEqual(calls, ["home"]); metadata = {};
        project.status = "shelved"; calls = []; await service.navigate(target); assert.deepEqual(calls, ["home"]); assert.equal(project.status, "shelved"); project.status = "active";
        files.delete(task.path); calls = []; await service.navigate(target); assert.deepEqual(calls, ["home"]);
        task.path = "Projects/P/Moved.md"; files.set(task.path, { path: task.path, extension: "md" });
        calls = []; await service.navigate(target); assert.deepEqual(calls, [task.path], "Stable identity follows moved task files");
        calls = []; await service.navigate({ kind: "workspace", workspaceId: "gone", path: "Gone.md" }); assert.deepEqual(calls, ["home"]);
        oath.active = true;
        calls = []; await service.navigate({ kind: "home" }); assert.deepEqual(calls, [project.path], "Oath scope overrides Home fallback");
        calls = []; await service.navigate({ kind: "file", workspaceId: "resource:study", path: "Resources/Knowledge/Shared/Task.md" });
        assert.deepEqual(calls, ["Resources/Knowledge/Shared/Task.md"], "Permitted shared-resource pointers use existing guarded navigation");
        calls = []; await service.navigate({ kind: "workspace", workspaceId: "resource:study", path: resource.path }); assert.deepEqual(calls, [project.path]);
        oath.active = false;
        plugin.workspaceModes.openProjectNote = async () => false;
        calls = []; await service.navigate(target); assert.deepEqual(calls, ["home"], "Native navigation refusal has a safe fallback");
        plugin.workspaceModes.openProjectNote = async () => { throw Error("Target disappeared during navigation"); };
        const previousWarn = console.warn; console.warn = () => {};
        try { calls = []; await service.navigate(target); assert.deepEqual(calls, ["home"], "Navigation races have a safe fallback"); }
        finally { console.warn = previousWarn; }
        plugin.projectWizard.data.reportFocusByDate = { "2026-09-25": { items: [{ projectId: "resource:study", text: "Read [[Task]]" }] } };
        plugin.app.metadataCache.getFirstLinkpathDest = () => ({ path: task.path });
        project.status = "shelved";
        assert.equal(service.provider.getRecommendation(await service.context()).reason, "no-clear-action", "Focus links into Shelved work are excluded before display");
        project.status = "active";
        assert.equal(service.provider.getRecommendation(await service.context()).reason, "recorded-focus");
        const before = JSON.stringify(plugin.projectWizard.data);
        plugin.dataStore.save = async () => { throw Error("disk"); };
        await assert.rejects(service.persistShown("2026-09-26"), /disk/);
        assert.equal(JSON.stringify(plugin.projectWizard.data), before);
        plugin.dataStore.save = async () => {};
        const replacement = new DailyBriefService(plugin, { provider: { getRecommendation: async context => ({ title: "Provider", target: context.fallbackTarget }) } });
        replacement.started = true;
        assert.equal((await replacement.load(new Date())).recommendation.title, "Provider", "Provider can be replaced without changing the modal/context contract");
        service.destroy(); replacement.destroy();
        console.log("PASS: Daily Brief navigation revalidates raw task state, start dates, project state, missing/moved targets, provider replacement, persistence rollback and active Oath/shared-resource scope.");
    } finally { global.document = oldDocument; }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
