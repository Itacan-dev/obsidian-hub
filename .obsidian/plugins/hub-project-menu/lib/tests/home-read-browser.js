"use strict";
window.onload = async () => { try {
    const source = await (await fetch("task-panel-browser.js")).text();
    const setup = source.slice(source.indexOf("    const input ="), source.indexOf("    const deferred =")).replace('fetch("task-panel-input.json")', 'fetch("home-read-input.json")');
    const env = await new (Object.getPrototypeOf(async function() {}).constructor)(setup + ";return {plugin,load,prepare,sources,dv,input,files,contents,pages,metadataCache,index,cleanup,setImportPaused:value=>{importPaused=value},facts:()=>({history,checks,oathChanges})};")();
    const { plugin, load, prepare, dv, input } = env;
    const original = await (await fetch("home-read-original.cjs")).text();
    const current = await (await fetch("../../../../../System/Dashboards/Home/view.js")).text();
    const slice = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b, text.indexOf(a)));
    const checks = [], captures = [];
    const check = (ok, label) => { assert(ok, label); checks.push(label); };
    const screenshot = name => new Promise(resolve => { window.hubTestScreenshotDone = resolve; window.hubTestScreenshotRequest = name; });
    window.hubTaskOwner = path => plugin.projectWizard.getContextForPath(path);
    async function mount(home, wait = true) {
        const component = new Component(), root = document.getElementById("fixture").createDiv({ cls: "home-dashboard hub-button-scope" });
        const grid = root.createDiv({ cls: "home-main-grid" }); grid.style.gridTemplateColumns = "repeat(3,minmax(0,1fr))";
        const panel = (parent, title, cls) => { const el = parent.createDiv({ cls: "home-panel " + cls }); el.createDiv({ cls: "home-panel-title", text: title }); return el; };
        panel(grid, "Calendar", "home-calendar"); panel(grid, "Today's Focus", "home-glance");
        const context = { window, root, grid, panel, dv: { ...dv, component }, projects: input.projects, resourceTypes: input.resources,
            markDashboardRow: () => {}, currentPath: path => plugin.taskData.currentPath(path), openFileFromHome: async path => { context.opened = path; },
            el: (parent, tag, cls, text) => parent.createEl(tag, { cls, text }), updateHomeContext: () => {}, renderActiveProgressView: () => { context.progress = (context.progress ?? 0) + 1; } };
        const code = "let projectTasks=[],resourceTasks=[],homeTaskCount=0,completedTaskHistory=[];" +
            slice(home, "// ---------- Tasks to Do ----------", "// ---------- CALENDAR ----------") +
            slice(home, "function projectFromReference(", "// ---------- PROJECT TABS ----------") +
            slice(home, "function removeClearedTasksFromCache(", home.includes("async function loadTaskData") ? "async function loadTaskData" : "function loadTaskData()") +
            slice(home, home.includes("async function loadTaskData") ? "async function loadTaskData" : "function loadTaskData()",
                home.includes("async function loadSecondaryData") ? "async function loadSecondaryData" : "function loadSecondaryData()") +
            slice(home, "function renderTaskContext()", "\nframe.defer(") +
            ";return {load:loadTaskData,render:renderTaskContext,clear:clearVisibleCompletedTasks,body:upcomingBody,get projects(){return projectTasks},get resources(){return resourceTasks},get count(){return homeTaskCount}};";
        const controller = new Function("env", "with(env){" + code + "}")(context);
        const ready = controller.load(); if (wait) { await ready; controller.render(); await settle(); }
        return { component, root, controller, context, ready, dispose() { component.unload(); root.remove(); } };
    }
    function snapshot(root) { const origin = root.getBoundingClientRect(); return [...root.querySelectorAll("*")].map(el => ({ tag: el.tagName,
        cls: typeof el.className === "string" ? el.className : "svg", text: el.children.length ? null : el.textContent,
        label: el.getAttribute("aria-label"), checked: el.matches('input[type="checkbox"]') ? el.checked : null,
        rect: [el.getBoundingClientRect().x-origin.x, el.getBoundingClientRect().y-origin.y, el.getBoundingClientRect().width, el.getBoundingClientRect().height].map(value => +value.toFixed(2)) })); }
    async function expand(instance) { for (const button of instance.root.querySelectorAll(".hub-task-group-toggle,.hub-task-steps-toggle")) button.click(); await settle(); }
    const old = await mount(original); await expand(old); const before = snapshot(old.root), oldCount = old.controller.count;
    check(old.controller.projects.length > 10 && old.controller.resources.length >= 4 && old.root.querySelectorAll(".home-task-row").length >= 20, "Frozen original fixture renders real Project/Resource task cards");
    captures.push({ original: before, count: oldCount }); await screenshot("home-read-original"); old.dispose();
    if (!window.homeReadBaselineOnly) {
        await prepare("services/home-task-read");
        window.hubCreateHomeTaskRead = options => load("services/home-task-read").createHomeTaskRead({ plugin, ...options,
            editTask: (task, saved) => load("ui/task-editor").openTaskEditor(plugin.taskEditor, task, saved) });
    }
    const next = await mount(window.homeReadBaselineOnly ? original : current); await expand(next);
    check(JSON.stringify(snapshot(next.root)) === JSON.stringify(before), "Actual original/current Home Tasks DOM, order, labels, Steps and rectangles match");
    check(next.controller.count === oldCount, "Actual Home summary active count matches");
    await screenshot("home-read-candidate"); next.dispose();
    if (!window.homeReadBaselineOnly) {
        const raw = plugin.taskData.readPages(dv).flatMap(page => page.file.tasks);
        const active = raw.find(task => task.hubTaskId === "mounted"), completed = raw.find(task => task.hubTaskId === "completed");
        plugin.oath.active = true; plugin.oath.current = { id: "home-oath", tasks: [{ id: active.hubTaskId }, { id: completed.hubTaskId }, { id: "missing" }], durationMs: 600000, startedAt: 1793000000000 };
        plugin.oath.now = () => 1793000000000; plugin.oath.work = [{ task: active }, { task: completed }, { ref: { id: "missing", text: "Missing commitment" } }];
        const a = await mount(original), beforeOath = snapshot(a.root); a.dispose();
        const b = await mount(current); check(JSON.stringify(snapshot(b.root)) === JSON.stringify(beforeOath), "Actual Oath Resource, completed and missing commitments retain original DOM/geometry");
        check(b.root.querySelectorAll(".hub-oath-pinned .home-task-row").length === 2 && b.root.querySelector(".hub-oath-missing"), "Oath commitments appear once with missing source feedback");
        b.dispose(); plugin.oath.active = false;
    }
    if (!window.homeReadBaselineOnly && window.runHomeInteractions) await window.runHomeInteractions({ ...env, mount, current, original, snapshot, check, checks, settle, Component });
    env.cleanup.unload(); plugin.taskData.destroy();
    window.hubTaskOpeningFrames = { checks, captures };
    document.getElementById("result").textContent = "PASS: " + checks.length + " actual Home checks; original/current DOM and geometry captured; Obsidian host APIs mocked.";
} catch (error) { document.getElementById("result").textContent = "FAIL: " + error.stack; } };
