"use strict";
// Actual Home Tasks source sections and actual Project Schedule, hosted by genuine Obsidian APIs.
// The rest of Home (Oath/Inbox/History/Statistics) is deliberately not mounted.
module.exports = async function ({ app, api }, root) {
    const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict"), Module = require("node:module");
    const workspace = path.resolve(__dirname, "../../.."), lib = path.join(workspace, ".obsidian/plugins/hub-project-menu/lib"), originalLoad = Module._load;
    Module._load = function (name, parent) {
        if (name === "obsidian" && parent?.filename?.startsWith(workspace + path.sep)) return api;
        if (/services[\\/](?:oath|inbox|statistics)(?:[.-]|$)/.test(name)) throw Error("Unapproved domain service denied");
        return originalLoad.apply(this, arguments);
    };
    await new Promise(resolve => setTimeout(resolve, 500));
    [...document.querySelectorAll(".modal button")].find(button => button.textContent === "Trust author and enable plugins")?.click();
    app.setting?.close();
    const S = require("./support.cjs"), F = require(lib + "/tests/home-read-fixture.cjs"), { createHomeTaskRead } = require(lib + "/services/home-task-read");
    const { createTaskUi, createTaskRow } = require(lib + "/ui/tasks"), { mountTaskWorkspace } = require(lib + "/ui/task-workspace");
    const { taskGroups } = require(lib + "/domain/task-planning"), { localISODate } = require(lib + "/domain/dates");
    const component = new api.Component(); component.load(); const checks = [], timings = {};
    const style = document.createElement("style"); style.textContent = await fs.readFile(lib + "/../styles.css", "utf8"); document.head.append(style); document.body.classList.add("theme-dark");
    document.body.style.setProperty("--interactive-accent", "#9b79e8");
    class RehearsalView extends api.ItemView { getViewType() { return "itacan-home-schedule"; } getDisplayText() { return "Isolated Home and Schedule"; } }
    window.__m1aBootstrap.registerView("itacan-home-schedule", leaf => new RehearsalView(leaf));
    const leaf = app.workspace.getLeaf(true); await leaf.setViewState({ type: "itacan-home-schedule", active: true }); const container = leaf.view.containerEl.createDiv({ cls: "hub-button-scope" }); container.style.padding = "20px";
    container.createEl("h2", { text: "Home and Schedule - isolated actual Obsidian" });
    const excluded = container.createDiv({ text: "History and Statistics unavailable. Oath, Inbox and Roadmap are not integrated.", attr: { role: "status" } });
    let failRefreshAfterCommit = false; const trace = []; const config = S.configuration(path.join(root, "native")); config.repositoryOptions = { fault(stage) { trace.push([stage, Date.now()]); if (failRefreshAfterCommit && stage === "beforeAcknowledgement") { failRefreshAfterCommit = false; config.registry.change(v => { v.owners[0].available = false; }); } } }; let runtime = await S.openProjectRuntime(config.config, { ...config, creating: true, consumerUiV1: true });
    const repository = S.repositories.at(-1), originalRead = repository.readSnapshot; repository.readSnapshot = async function (request) { trace.push(["read-start", request.selection, Date.now()]); try { return await originalRead.call(this, request); } finally { trace.push(["read-end", request.selection, Date.now()]); } };
    const legacy = F.createHomeFixture(), project = { projectId: config.owner.id, contextKind: "project", name: "Native rehearsal", root: "Projects/Native", path: "Projects/Native/Dashboard.md", status: "active", deleted: false };
    legacy.projects.push(project); legacy.workspaces.push(project); legacy.add(project.path); legacy.addTask(project.root + "/Tasks.md", "Excluded native-owner Markdown", "excluded-native");
    const plugin = { ...legacy.plugin, app }, legacyCalls = []; plugin.toggleTask = async (...args) => { legacyCalls.push(args); return { path: args[0], line: args[1], tasks: [] }; };
    const today = localISODate(new Date()), service = runtime.formService(app), values = { text: "Native actual Home", description: "Description retained", necessity: "must", dueDate: today, steps: [{ text: "Independent Step", completed: false }] };
    await service.create({ authorityId: config.config.authorityId, owner: config.owner }, values.text, values);
    const taskId = (await runtime.list()).tasks[0].id, stepId = (await runtime.list()).tasks[0].steps[0].id;
    window.hubTaskData = plugin.taskData; window.hubTaskGroups = taskGroups; window.hubCreateTaskRow = createTaskRow; window.hubSetIcon = api.setIcon;
    let home, legacyCreates = 0;
    window.hubCreateHomeTaskRead = options => createHomeTaskRead({ plugin, ...options, nativeTasks: runtime.nativeTasks,
        editTask: (task, saved) => require(lib + "/ui/task-editor").openTaskEditor(plugin.taskEditor, task, saved) });
    window.hubCreateTaskUi = (component, body, onEdit, actions) => createTaskUi({ app, component, body, onEdit, ...actions, createTask: () => { legacyCreates++; } });
    window.hubToggleTask = () => { throw Error("Native toggle entered global Markdown routing"); }; window.hubClearCompletedTasks = () => { throw Error("Native clear entered legacy routing"); };
    const source = await fs.readFile(path.join(workspace, "System/Dashboards/Home/view.js"), "utf8");
    const slice = (a, b) => { const start = source.indexOf(a), end = source.indexOf(b, start); assert(start >= 0 && end > start); return source.slice(start, end); };
    const homeRoot = container.createDiv({ cls: "home-dashboard" }), grid = homeRoot.createDiv({ cls: "home-main-grid" }); homeRoot.id = "m1ba-home";
    const panel = (parent, title, cls) => { const el = parent.createDiv({ cls: "home-panel " + cls }); el.createDiv({ cls: "home-panel-title", text: title }); return el; };
    const env = { window, root: homeRoot, grid, panel, dv: { ...legacy.dv, component }, projects: legacy.projects, resourceTypes: legacy.resources,
        homeContext: homeRoot.createDiv({ text: "Loading today..." }), markDashboardRow() {}, currentPath: p => { assert.equal(typeof p, "string", "Native task used currentPath"); return plugin.taskData.currentPath(p); }, openFileFromHome: async () => { throw Error("Unexpected native source navigation"); },
        el: (parent, tag, cls, text) => parent.createEl(tag, { cls, text }), updateHomeContext() {}, renderActiveProgressView() {} };
    const code = "let projectTasks=[],resourceTasks=[],homeTaskCount=null,completedTaskHistory=[],completedHistoryRead=null;" +
        slice("// ---------- Tasks to Do ----------", "// ---------- CALENDAR ----------") +
        slice("function projectFromReference(", "// ---------- PROJECT TABS ----------") +
        slice("function removeClearedTasksFromCache(", "async function loadTaskData") +
        slice("async function loadTaskData", "async function loadSecondaryData") +
        slice("function renderTaskContext()", "\nframe.defer(") +
        ";return {load:loadTaskData,render:renderTaskContext,clear:clearVisibleCompletedTasks,body:upcomingBody,get count(){return homeTaskCount},get items(){return [...projectTasks,...resourceTasks]}};";
    home = new Function("env", "with(env){" + code + "}")(env);
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function wait(fn, label) { for (let i = 0; i < 900; i++) { if (await fn()) return; await delay(30); } await fs.writeFile(path.join(root, "evidence/failure-ui.json"), JSON.stringify({ label, trace, modals: [...document.querySelectorAll(".modal-container")].map(e => e.outerHTML), retained: await runtime.retained(), body: container.innerHTML })); await require("electron").ipcRenderer.invoke("m1a-capture", "edit"); throw Error("Timed out " + label + " / " + [...document.querySelectorAll(".hub-task-error")].map(e => e.textContent).join(" / ")); }
    const find = selector => { const el = document.querySelector(selector); assert(el, "Missing " + selector); return el; };
    const click = selector => find(selector).click();
    const fill = (selector, value) => { const el = find(selector); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    const rowFor = text => [...homeRoot.querySelectorAll(".home-task-row")].find(row => row.querySelector(".home-task-text")?.textContent === text);
    const homeLoad = async () => { await delay(100); await home.load(); home.render(); };
    await homeLoad(); await wait(() => rowFor(values.text), "mixed Home");
    assert.equal(home.items.filter(i => i.task.nativeReference).length, 1); assert(!home.items.some(i => i.task.hubTaskId === "excluded-native")); assert(home.items.some(i => i.task.hubTaskId === "mounted")); assert.equal(typeof home.count, "number"); checks.push("actual Home sections: mixed feed, physical ownership, no duplicate native-owner Markdown, complete count");
    click("#m1ba-home .hub-task-add"); assert.equal(legacyCreates, 1); checks.push("Home Add retains its existing legacy destination");
    rowFor(values.text).querySelector(".hub-task-steps-toggle").click(); rowFor(values.text).querySelector(".hub-task-step-item input").click();
    await wait(async () => (await runtime.list()).tasks[0].steps[0].completed, "Home Step completion"); await homeLoad(); assert(!(await runtime.list()).tasks[0].completed); checks.push("Home independent Step completion through native retained request");
    rowFor(values.text).querySelector(".home-task-checkbox").click(); await wait(async () => (await runtime.list()).tasks[0].completed, "Home parent completion"); await homeLoad();
    [...homeRoot.querySelectorAll(".hub-task-group-toggle")].find(b => /completed/.test(b.textContent)).click(); await wait(() => rowFor(values.text), "completed disclosure");
    assert(rowFor(values.text).querySelector(".home-task-delete").disabled); rowFor(values.text).querySelector(".home-task-checkbox").click(); await wait(async () => !(await runtime.list()).tasks[0].completed, "Home reopen"); await homeLoad(); checks.push("Home parent complete/reopen and native clear disabled");
    app.setting?.close(); document.querySelector(".modal.mod-settings .modal-close-button")?.click(); await delay(300);
    rowFor(values.text).querySelector(".home-task-text").click(); await wait(() => document.querySelector('.modal[aria-label="Edit task"] form'), "Home Edit"); fill('textarea[aria-label="Task"]', "Edited through Home"); await delay(500); await require("electron").ipcRenderer.invoke("m1a-capture", "edit"); click('.hub-task-dialog-actions .mod-cta');
    await wait(() => !document.querySelector('.modal[aria-label="Edit task"] form'), "Home Save"); await homeLoad(); assert(rowFor("Edited through Home")); assert.equal((await runtime.list()).tasks[0].description, values.description); checks.push("actual Home Edit modal, Description, Necessity and civil date preserved");
    const legacyRow = rowFor("Unscheduled"); legacyRow.querySelector(".home-task-checkbox").click(); await wait(() => legacyCalls.length === 1, "legacy Home action"); assert.equal(typeof legacyCalls[0][0], "string"); checks.push("legacy Home action remains on its own authority");
    await require("electron").ipcRenderer.invoke("m1a-capture", "list"); homeRoot.hidden = true; app.setting?.close(); document.querySelector(".modal.mod-settings .modal-close-button")?.click();
    const scheduleRoot = container.createDiv({ cls: "project-dashboard" }); scheduleRoot.id = "m1ba-schedule"; const toolbar = scheduleRoot.createDiv(), filesGrid = scheduleRoot.createDiv(), filesPanel = filesGrid.createDiv();
    const start = performance.now(); const schedule = mountTaskWorkspace({ plugin, component, dv: { container: scheduleRoot }, root: scheduleRoot, toolbar, filesGrid, filesPanel, workspace: project, nativeTasks: runtime.nativeTasks, onFiles() {}, openSource: () => { throw Error("Native Schedule source opened Markdown"); } });
    click('#m1ba-schedule [data-workspace-mode="schedule"]'); await wait(() => scheduleRoot.querySelector(".hub-task-board .project-task-row"), "Overview"); timings.overviewReadyMs = performance.now() - start;
    assert([...scheduleRoot.querySelectorAll(".project-task-text")].some(el => el.textContent === "Edited through Home")); assert(scheduleRoot.querySelector('.hub-full-location').disabled); assert(scheduleRoot.querySelector('[data-workspace-mode="roadmap"]').disabled); checks.push("actual Schedule Overview, native editor identity and disabled source/Roadmap");
    click('#m1ba-schedule [data-schedule-control="view-week"]'); assert.equal(scheduleRoot.querySelectorAll(".hub-task-calendar-day").length, 7); checks.push("existing Week calendar and civil-day cells");
    click('#m1ba-schedule [data-schedule-control="view-month"]'); assert(scheduleRoot.querySelectorAll(".hub-task-calendar-day").length >= 28); checks.push("existing Month calendar and navigation");
    const selectedDay = localISODate(require(lib + "/domain/task-views").calendarRange(schedule.state.anchor, "month")[0]);
    const add = scheduleRoot.querySelector('[aria-label^="Add task on "]'); add.click(); await wait(() => document.querySelector('.modal[aria-label="Add task"] form'), "calendar Add"); fill('textarea[aria-label="Task"]', "Calendar native task");
    await delay(500); assert(find('.modal[aria-label="Add task"] form').getBoundingClientRect().width > 0); await require("electron").ipcRenderer.invoke("m1a-capture", "add"); const calendarStart = performance.now(); click('.hub-task-dialog-actions .mod-cta'); await wait(() => !document.querySelector('.modal[aria-label="Add task"] form'), "calendar create");
    timings.calendarCreateToClosedMs = performance.now() - calendarStart;
    const calendar = (await runtime.list()).tasks.find(t => t.text === "Calendar native task"); assert(calendar && calendar.dueDate === selectedDay && calendar.dueTime === null); checks.push("calendar Add uses existing compact form and exact date-only Due");
    const retained = await runtime.retained(), record = await runtime.getRetained(retained.at(-1).operationId), original = S.V.clone(record); assert.equal((await runtime.replay(record.operationId)).status, "replayed"); assert.deepEqual(await runtime.getRetained(record.operationId), original); assert.equal((await runtime.list()).tasks.length, 2); checks.push("calendar original operation and explicit task/Step identities retained for exact replay");
    click('#m1ba-schedule [data-schedule-control="view-upcoming"]'); await schedule.refresh(); await wait(() => scheduleRoot.querySelector(".hub-task-board"), "Overview refresh");
    const scheduleTask = [...scheduleRoot.querySelectorAll(".project-task-row")].find(r => r.textContent.includes("Edited through Home")); const previousOperation = runtime.info().lastOutcome.operationId; failRefreshAfterCommit = true; scheduleTask.querySelector(".project-task-checkbox").click(); await wait(() => runtime.info().lastOutcome?.status === "committed" && runtime.info().lastOutcome.operationId !== previousOperation && runtime.info().lastOutcome?.taskIds.includes(taskId) && S.repositories.at(-1).queryTasks().find(t => t.id === taskId).completed, "Schedule known commitment"); await homeLoad(); checks.push("Schedule known commitment survives refresh failure and is never resubmitted");
    await require("electron").ipcRenderer.invoke("m1a-capture", "list");
    await home.load(); home.render(); await schedule.refresh();
    await wait(async () => { await home.load(); return home.count === null; }, "Home unavailable count");
    assert.equal(home.count, null); assert(homeRoot.querySelector('[role="status"]')); assert(env.homeContext.textContent.includes("unavailable")); assert(scheduleRoot.querySelector('[role="status"]')); assert([...scheduleRoot.querySelectorAll(".project-task-row")].some(row => row.textContent.includes("Edited through Home"))); assert(![...scheduleRoot.querySelectorAll(".hub-task-count")].some(el => /^\d+$/.test(el.textContent)));
    assert([...homeRoot.querySelectorAll(".home-task-row")].filter(row => row.textContent.includes("Calendar native task")).every(row => row.querySelector(".home-task-checkbox").disabled)); checks.push("authority outage retains presentation, disables actions and exposes no complete native/mixed count");
    assert.equal(runtime.info().history, "unavailable"); assert.equal(runtime.info().statistics, "unavailable"); assert(excluded.textContent.includes("unavailable")); checks.push("History/Statistics explicitly unavailable without legacy-only totals");
    component.unload(); await runtime.close(); config.registry.change(v => { v.owners[0].available = true; });
    runtime = await S.openProjectRuntime(config.config, { ...config, creating: false, consumerUiV1: true }); const final = await runtime.list(); assert.equal(final.tasks.length, 2); assert.equal(final.tasks.find(t => t.id === taskId).steps[0].id, stepId); assert(final.tasks.find(t => t.id === taskId).steps[0].completed); await runtime.close(); await legacy.close();
    checks.push("clean reconstruction preserves native UUIDs, independent Step state and all calendar changes"); Module._load = originalLoad;
    await fs.writeFile(path.join(root, "evidence/read-trace.json"), JSON.stringify(trace));
    return { checks, timings, taskId, stepId, genuineApis: true, normalItacanOnloadInvoked: false, installedBundleLoaded: false, statistics: "unavailable", history: "unavailable" };
};
