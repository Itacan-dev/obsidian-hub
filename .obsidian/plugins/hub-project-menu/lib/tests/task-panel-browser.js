"use strict";
window.onload = async () => { try {
    const input = await (await fetch("task-panel-input.json")).json(), sources = {}, cache = {};
    async function prepare(name) {
        if (["obsidian", "crypto"].includes(name) || sources[name]) return;
        const response = await fetch("../" + name + ".js"); if (!response.ok) throw Error("Missing " + name);
        const text = sources[name] = await response.text();
        for (const match of text.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) if (match[1].startsWith(".")) await prepare(resolve(name, match[1]));
    }
    function resolve(name, request) { const out = []; for (const part of (name.slice(0, name.lastIndexOf("/")) + "/" + request).split("/")) {
        if (part === "..") out.pop(); else if (part !== ".") out.push(part);
    } return out.join("/"); }
    const load = name => {
        if (name === "obsidian") return obsidian;
        if (name === "crypto") return { randomUUID: () => crypto.randomUUID() };
        if (cache[name]) return cache[name].exports;
        const module = cache[name] = { exports: {} };
        new Function("module", "require", sources[name])(module, request => load(request.startsWith(".") ? resolve(name, request) : request));
        return module.exports;
    };
    await prepare("ui/tasks"); await prepare("services/task-data"); await prepare("services/task-service-host"); await prepare("services/task-editor");
    await prepare("ui/task-editor"); await prepare("services/task-writes"); await prepare("domain/task-progress");
    if (!window.panelBaselineOnly) await prepare("services/task-panel-read");
    const original = await (await fetch("task-panel-original.cjs")).text();
    const dashboard = await (await fetch("../../../../../System/Dashboards/Project/view.js")).text();
    const start = dashboard.indexOf("// ---------- CURRENT TASKS ----------"), end = dashboard.indexOf("// ---------- PROGRESS ----------", start);
    const current = dashboard.slice(start, end);
    const { createTaskUi, createTaskRow } = load("ui/tasks"), { applyTaskEdit } = load("domain/tasks");
    const files = new Map(input.files), contents = new Map(input.contents), pages = new Map(input.pages), vault = new Emitter(), metadataCache = new Emitter();
    Object.assign(vault, { getAbstractFileByPath: path => files.get(path), read: async file => contents.get(file.path), getMarkdownFiles: () => [...files.values()].filter(file => file.extension === "md") });
    const wizard = { data: { taskMetadata: input.metadata }, getProjectById: id => input.workspaces.find(owner => owner.projectId === id),
        getResourceById: id => input.workspaces.find(owner => owner.resourceType === id), getContextForPath: path => input.workspaces.find(owner => path.startsWith(owner.root + "/")) };
    const cleanup = new Component();
    const plugin = { app: { vault, metadataCache, workspace: { getActiveFile: () => files.get("Projects/App/Tasks/Unscheduled.md") } }, projectWizard: wizard,
        register: fn => cleanup.register(fn), registerEvent() {}, dataStore: { save: async () => {} }, markProjectChangedByPath() {}, notifyCompletedTasksChanged() {},
        planning: { phaseFor: task => task.phaseId === "phase" ? { name: "Prototype" } : null, phases: () => [{ id: "phase", name: "Prototype" }] } };
    let checks = [], history = [], oathChanges = 0;
    wizard.recordTaskMutation = async (edit, owner, time) => { const next = load("domain/task-progress").taskProgressMutation(checks, history, edit, owner, time, () => crypto.randomUUID());
        checks = next.checks; history = next.history; return next.changed; };
    plugin.oath = { active: false, current: null, work: [], changed: () => { oathChanges++; }, onChange: () => () => {}, now: () => Date.now() };
    plugin.enqueueTaskMutation = work => { const result = (plugin.queue ?? Promise.resolve()).then(work); plugin.queue = result.catch(() => {}); return result; };
    const entry = await (await fetch("../../plugin.js")).text();
    const method = entry.slice(entry.indexOf("    mutateTask(request) {"), entry.indexOf("    clearCompletedTasks(taskRequests"));
    plugin.mutateTask = new Function("processTaskWrite", "toggleTaskStep", "randomUUID", "editTaskContent", "mutateTaskContent", "Notice", "return ({" + method + "}).mutateTask;")(
        load("services/task-writes").processTaskWrite, load("domain/task-planning").toggleTaskStep, () => crypto.randomUUID(),
        load("domain/tasks").editTaskContent, load("domain/tasks").mutateTaskContent, obsidian.Notice);
    plugin.toggleTask = (path, line, text, completed, hubTaskId) => plugin.mutateTask({ path, line, text, completed, hubTaskId });
    window.hubToggleTask = plugin.toggleTask;
    let importPaused = false;
    function index(file) {
        const tasks = [], lists = [], stack = [];
        for (const [line, value] of contents.get(file.path).split(/\r?\n/).entries()) {
            const details = load("domain/tasks").taskLineDetails(value); if (!details && !/^\s*[-*+]\s/.test(value)) continue;
            const indent = value.match(/^\s*/)[0].length;
            while (stack.length && indent <= stack.at(-1).indent) stack.pop();
            const item = { path: file.path, line, text: details?.text ?? value.trim().slice(2), completed: /^[xX]$/.test(details?.marker), task: !!details,
                parent: stack.at(-1)?.item.line ?? null, children: [] };
            stack.at(-1)?.item.children.push(item); lists.push(item); if (details) tasks.push(item); stack.push({ item, indent });
        }
        pages.set(file.path, { file: { path: file.path, tasks, lists } });
    }
    vault.process = async (file, transform) => { contents.set(file.path, transform(contents.get(file.path)));
        if (!importPaused) { index(file); metadataCache.emit("dataview:metadata-change", "update", file); } };
    plugin.taskEditor = new (load("services/task-editor").HubTaskEditor)(plugin);
    plugin.taskData = new (load("services/task-data").HubTaskDataService)(plugin.app, { metadata: id => plugin.taskEditor.metadata(id) });
    const dv = { pages: () => ({ array: () => [...pages.values()] }) };
    plugin.app.plugins = { plugins: { dataview: { api: dv } } };
    plugin.taskService = load("services/task-service-host").createLegacyTaskService(plugin);
    window.hubTaskData = plugin.taskData; window.hubSetIcon = obsidian.setIcon; window.hubApplyTaskEdit = applyTaskEdit; window.hubCreateTaskRow = createTaskRow;
    window.hubTaskGroups = load("domain/task-planning").taskGroups;
    window.hubCreateTaskPanelRead = options => load("services/task-panel-read").createTaskPanelRead({ plugin, ...options,
        editTask: (task, saved) => load("ui/task-editor").openTaskEditor(plugin.taskEditor, task, saved) });
    window.hubCreateTaskUi = (component, body, onEdit, actions = {}) => createTaskUi({ app: plugin.app, component, body, onEdit, oath: plugin.oath, phaseLabel: task => plugin.planning.phaseFor(task)?.name,
        mutate: actions.mutate ?? plugin.mutateTask, editTask: actions.editTask ?? ((task, saved) => load("ui/task-editor").openTaskEditor(plugin.taskEditor, task, saved)),
        createTask: options => load("ui/task-editor").openTaskCreator(plugin.taskEditor, options) });
    const deferred = [], instances = [];
    const screenshot = name => new Promise(resolve => { window.hubTestScreenshotDone = resolve; window.hubTestScreenshotRequest = name; });
    async function mount(section, owner) {
        const component = new Component(), root = document.getElementById("fixture").createDiv({ cls: "project-dashboard hub-button-scope" });
        root.style.width = "560px";
        const right = root.createDiv({ cls: "project-right-column" }), frame = { defer: callback => deferred.push(callback) };
        const env = { window, app: plugin.app, dv: { ...dv, component }, root, right, current: { ...owner, file: { path: owner.path, name: owner.name } },
            isResourceContext: owner.contextKind === "resource", projectRoot: owner.root, contextId: owner.projectId, frame, taskWorkspace: null,
            el: (parent, tag, cls, text) => parent.createEl(tag, { cls, text }), openProjectNote: () => {} };
        const panel = new Function("env", "with(env){" + section + ";return {renderCurrentTasks,renderTaskRows,get tasks(){return currentProjectTasks},body:tasksBody};}")(env);
        deferred.splice(0).forEach(callback => callback()); await settle();
        instances.push({ root, component, panel, env }); return { root, component, panel, env };
    }
    function snapshot(root) {
        const panel = root.querySelector(".project-tasks"), origin = panel.getBoundingClientRect();
        return [...panel.querySelectorAll("*")].map(el => ({ tag: el.tagName, cls: el.className?.baseVal ?? el.className,
            text: el.children.length ? null : el.textContent, title: el.getAttribute("title"), aria: el.getAttribute("aria-label"),
            expanded: el.getAttribute("aria-expanded"), checked: el.matches('input[type="checkbox"]') ? el.checked : null,
            rect: [el.getBoundingClientRect().x - origin.x, el.getBoundingClientRect().y - origin.y, el.getBoundingClientRect().width, el.getBoundingClientRect().height].map(value => +value.toFixed(2)) }));
    }
    const results = [];
    for (const owner of input.workspaces) {
        const old = await mount(original, owner);
        for (const button of old.root.querySelectorAll(".hub-task-group-toggle,.hub-task-steps-toggle")) button.click(); await settle();
        const before = snapshot(old.root);
        await screenshot("task-panel-original-" + owner.projectId.replace(":", "-"));
        old.component.unload(); old.root.remove();
        const next = await mount(window.panelBaselineOnly ? original : current, owner);
        for (const button of next.root.querySelectorAll(".hub-task-group-toggle,.hub-task-steps-toggle")) button.click(); await settle();
        assert(JSON.stringify(snapshot(next.root)) === JSON.stringify(before), owner.name + " original/current DOM and layout parity");
        await screenshot("task-panel-candidate-" + owner.projectId.replace(":", "-"));
        results.push({ owner: owner.projectId, dom: before }); next.component.unload(); next.root.remove();
    }
    if (!window.panelBaselineOnly) {
        const task = plugin.taskData.readPages(dv, input.workspaces[0].root).flatMap(page => page.file.tasks).find(task => task.hubTaskId === "unscheduled");
        plugin.oath.active = true; plugin.oath.current = { id: "test-oath", tasks: [{ id: "unscheduled", text: task.text }], durationMs: 600000, startedAt: 1793000000000 };
        plugin.oath.now = () => 1793000000000; plugin.oath.work = [{ task }];
        const old = await mount(original, input.workspaces[0]), before = snapshot(old.root);
        old.component.unload(); old.root.remove();
        const next = await mount(current, input.workspaces[0]); assert(JSON.stringify(snapshot(next.root)) === JSON.stringify(before), "Actual Oath partition DOM/layout parity");
        assert(next.root.querySelectorAll(".hub-oath-pinned .project-task-row").length === 1, "Committed task rendered once in pinned Oath");
        next.component.unload(); next.root.remove(); plugin.oath.active = false;
    }
    if (!window.panelBaselineOnly) await window.runPanelInteractions({ mount, current, plugin, load, settle, assert, Component, snapshot,
        input, files, contents, pages, metadataCache, index, setImportPaused: value => { importPaused = value; },
        facts: () => ({ checks, history, oathChanges }), notices, instances });
    await plugin.taskService.close(); plugin.taskData.destroy();
    window.panelBaselineResult = results;
    window.hubTaskOpeningFrames = { panels: results, interactions: window.panelInteractionEvidence ?? null };
    document.getElementById("result").textContent = "PASS: " + results.length + " actual dashboard Tasks panels; exact original DOM, text, attributes and layout";
} catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; } };
