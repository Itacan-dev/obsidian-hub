"use strict";
// Production Home Tasks/header code and task UI, with only Obsidian host APIs mocked.
HTMLElement.prototype.createEl = function(tag, options = {}) {
    const el = document.createElement(tag); el.className = options.cls || "";
    if (options.text != null) el.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
    if (options.type) el.type = options.type;
    this.append(el); return el;
};
HTMLElement.prototype.createDiv = function(o) { return this.createEl("div", o); };
HTMLElement.prototype.createSpan = function(o) { return this.createEl("span", o); };
HTMLElement.prototype.empty = function() { this.replaceChildren(); };
HTMLElement.prototype.addClass = function(c) { this.classList.add(c); };
class Component {
    constructor() { this.cleanups = []; this.children = new Set(); }
    register(fn) { this.cleanups.push(fn); }
    addChild(c) { this.children.add(c); }
    removeChild(c) { c.unload(); this.children.delete(c); }
    unload() { this.cleanups.splice(0).forEach(fn => fn()); this.children.forEach(c => c.unload()); }
}
class Modal {
    constructor(app) {
        this.app = app; this.containerEl = document.body.createDiv({ cls: "modal-container" });
        this.contentEl = this.containerEl.createDiv({ cls: "modal" });
        this.key = e => { if (e.key === "Escape") { e.stopPropagation(); this.close(); } };
    }
    open() { window.lastModal = this; document.addEventListener("keydown", this.key); this.onOpen(); }
    close() { document.removeEventListener("keydown", this.key); this.onClose(); this.containerEl.remove(); }
}
class Menu {
    constructor() { this.items = []; window.lastMenu = this; }
    addItem(build) {
        const item = { setTitle(v) { this.title = v; return this; }, setIcon(v) { this.icon = v; return this; },
            setWarning(v) { this.warning = v; return this; }, setDisabled(v) { this.disabled = v; return this; },
            onClick(fn) { this.action = fn; return this; } };
        build(item); this.items.push(item);
    }
    onHide(fn) { this.hidden = fn; }
    showAtMouseEvent(e) { this.mouse = true; this.showAtPosition({ x: e.clientX, y: e.clientY }); }
    showAtPosition(point) {
        this.point = point; this.el = document.body.createDiv({ cls: "menu", attr: { role: "menu" } });
        this.el.style.left = point.x + "px"; this.el.style.top = point.y + "px";
        for (const item of this.items) {
            const button = this.el.createEl("button", { text: item.title, attr: { role: "menuitem" } });
            button.disabled = item.disabled;
            button.onclick = () => { this.hide(); void item.action(); };
        }
        this.key = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.hide(); } };
        this.outside = e => { if (!this.el.contains(e.target)) this.hide(); };
        document.addEventListener("keydown", this.key); document.addEventListener("pointerdown", this.outside);
        this.el.querySelector("button:not(:disabled)")?.focus();
    }
    hide() {
        if (!this.el?.isConnected) return;
        this.el.remove(); document.removeEventListener("keydown", this.key);
        document.removeEventListener("pointerdown", this.outside); this.hidden?.();
    }
}
const assert = (ok, message) => { if (!ok) throw Error(message); };
const near = (a, b, message) => assert(Math.abs(a - b) < .06, `${message}: ${a} / ${b}`);
const rect = e => e.getBoundingClientRect();
const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const key = value => new Promise(resolve => { window.hubTestKeyDone = resolve; window.hubTestKeyRequest = value; });
const notices = [];
const obsidian = { Component, Modal, Menu, Notice: class { constructor(t) { notices.push(t); } },
    MarkdownRenderer: { render: async (_app, text, el) => el.createEl("p", { text }) },
    setIcon(el, name) {
        el.dataset.icon = name;
        el.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="' +
            (name === "plus" ? "M12 5v14M5 12h14" : "m9 5 7 7-7 7") + '"/></svg>';
    } };
window.onload = async () => { try {
    const names = ["ui/tasks", "ui/markdown", "ui/completion-audio", "ui/task-card","ui/task-steps", "ui/oath-tasks", "domain/task-planning", "domain/tasks", "domain/dates", "domain/oath", "domain/oath-workspace"];
    const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await (await fetch("../" + name + ".js")).text()])));
    const cache = {}, load = name => {
        if (name === "obsidian") return obsidian;
        if (cache[name]) return cache[name].exports;
        const module = cache[name] = { exports: {} };
        assert(sources[name], "Missing module " + name);
        new Function("module", "require", sources[name])(module, request => {
            if (request === "obsidian") return obsidian;
            const parts = (name.slice(0, name.lastIndexOf("/")) + "/" + request).split("/"), out = [];
            for (const part of parts) { if (part === "..") out.pop(); else if (part !== ".") out.push(part); }
            return load(out.join("/"));
        }); return module.exports;
    };
    const home = await (await fetch(new URLSearchParams(location.search).get("home-source") || "../../../../../System/Dashboards/Home/view.js")).text();
    const plugin = await (await fetch("../../plugin.js")).text();
    const ConfirmModal = new Function("Modal", plugin.slice(plugin.indexOf("class ConfirmModal extends"), plugin.indexOf("class FocusListEditor")) + ";return ConfirmModal;")(Modal);
    const confirmAction = new Function("ConfirmModal", plugin.slice(plugin.indexOf("function confirmAction("), plugin.indexOf("class ProjectCategoryModal")) + ";return confirmAction;")(ConfirmModal);
    let created = 0, edited = 0, toggled = 0, cleared = 0, requested;
    const component = new Component(), domain = load("domain/tasks"), root = fixture.createDiv({ cls: "home-dashboard hub-button-scope" });
    const grid = root.createDiv({ cls: "home-main-grid" });
    const panel = (parent, text, cls) => { const p = parent.createDiv({ cls: "home-panel " + cls }); p.createDiv({ cls: "home-panel-title", text }); return p; };
    const focusHeader = panel(grid, "Today's Focus", "home-glance").firstElementChild;
    const focusButtonCode = home.slice(home.indexOf("const editFocusButton ="), home.indexOf("const focusBody ="));
    window.hubOpenDailyFocusEditor = () => edited++;
    const editFocusButton = new Function("focusHeader", "todayISO", focusButtonCode + ";return editFocusButton;")(focusHeader, "2026-10-12");
    const owner = { name: "A", root: "Projects/A", path: "Projects/A/A.md", projectId: "a" };
    const tasks = [{ text: "Open", completed: false }, { text: "Done", completed: true }, { text: "Resource done", completed: true }]
        .map((t, line) => ({ task: { ...t, line, path: line === 2 ? "Resources/Knowledge/Tasks.md" : "Projects/A/Tasks.md" },
            owner: line === 2 ? { name: "Knowledge", root: "Resources/Knowledge", path: "Resources/Knowledge/Knowledge.md", contextKind: "resource", resourceType: "study" } : owner }));
    window.hubApplyTaskEdit = domain.applyTaskEdit;
    window.hubCreateTaskRow = load("ui/tasks").createTaskRow;
    window.hubCreateTaskUi = (_c, body, onEdit) => load("ui/tasks").createTaskUi({ app: {}, component, body, onEdit,
        mutate: async () => {}, createTask: () => created++, editTask: () => edited++ });
    window.hubClearCompletedTasks = async (requests, confirm) => {
        requested = requests; assert(confirm === true, "Group clear requests destructive confirmation");
        if (!await confirmAction({}, "Clear completed tasks?", "Remove these completed tasks from their notes? They will remain available in Tasks history.")) return { cancelled: true };
        cleared++; return { deleted: requests };
    };
    window.hubToggleTask = async (path, line, text, completed) => { toggled++; return { path, line, requestLine: line, oldText: text, lineDelta: 0, tasks: [{ line, text, completed }] }; };
    // This existing fixture exercises native controls/menus. Full facade and
    // actual writer integration is verified independently by home-read.html.
    window.hubCreateHomeTaskRead = () => ({ actions: {},
        reconcile: (items, edit) => domain.applyTaskEdit(items, edit),
        toggle: (task, completed) => window.hubToggleTask(task.path, task.line, task.text, completed, task.hubTaskId),
        clear: (items, confirm) => window.hubClearCompletedTasks(items, confirm), reveal: async task => ({ path: task.path }) });
    const taskCode = home.slice(home.indexOf("// ---------- Tasks to Do ----------"), home.indexOf("// ---------- CALENDAR ----------"));
    const controller = new Function("grid", "root", "panel", "markDashboardRow", "dv", "items", `
        let projectTasks=items.slice(0,2),resourceTasks=items.slice(2);
        const currentPath=p=>p,homeTaskLocation=()=>"Tasks",openFileFromHome=async()=>{},el=(p,t,c,text)=>p.createEl(t,{cls:c,text});
        function renderTaskContext(){renderTasksToDo(projectTasks,resourceTasks)}const renderActiveContext=renderTaskContext;
        ${taskCode};return {render:renderTaskContext,addTaskButton,body:upcomingBody,clear:clearVisibleCompletedTasks};
    `)(grid, root, panel, () => {}, { component }, tasks);
    controller.render(); await settle();
    const calendar = panel(grid, "Calendar", "home-calendar"); grid.prepend(calendar);
    const calendarHeader = calendar.firstElementChild;
    const calendarCode = home.slice(home.indexOf("const calendarTodayButton ="), home.indexOf("calendarTodayButton.setAttribute("));
    const calendarTodayButton = new Function("calendarHeader", "editFocusButton", "addTaskButton", calendarCode + ";return calendarTodayButton;")(calendarHeader, editFocusButton, controller.addTaskButton);
    let todayClicks = 0; calendarTodayButton.onclick = () => todayClicks++;
    assert(!root.querySelector(".home-task-clear-completed"), "Home header Clear removed");
    assert(controller.addTaskButton.querySelector('.hub-compact-panel-action-label [data-icon="plus"]') && controller.addTaskButton.getAttribute("aria-label") === "Add task", "Lucide plus Task label");
    controller.addTaskButton.click(); editFocusButton.click(); calendarTodayButton.click();
    assert(created === 1 && edited === 1 && todayClicks === 1, "Header actions retain callbacks");
    const accessibility = await new Promise(resolve => { window.hubTestAccessibilityDone = resolve; window.hubTestAccessibilityRequest = true; });
    for (const name of ["Today", "Edit", "Add task"]) assert(accessibility.some(n => n.role === "button" && n.name === name), "Sizing copies are absent from accessible name " + name);
    const completed = () => [...controller.body.querySelectorAll(".hub-task-group-toggle")].find(b => b.textContent.includes("completed"));
    let group = completed(); assert(group.getAttribute("aria-expanded") === "false", "Completed starts collapsed");
    const context = () => { const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 60, clientY: 90 }); group.dispatchEvent(e); assert(e.defaultPrevented, "Native browser menu suppressed"); };
    context(); assert(lastMenu.mouse && lastMenu.items.length === 1 && lastMenu.items[0].title === "Clear completed tasks" && lastMenu.items[0].warning, "Native Obsidian Menu configuration");
    assert(group.getAttribute("aria-expanded") === "false", "Right-click preserves disclosure");
    lastMenu.hide(); controller.addTaskButton.focus();
    await key("Tab"); assert(document.activeElement === controller.body.querySelector("input"), "Tab preserves checkbox access");
    await key("Tab"); assert(document.activeElement === controller.body.querySelector(".home-task-text"), "Tab preserves task editor access");
    await key("Tab"); assert(document.activeElement === group, "Completed group reachable by Tab");
    await key({ key: "F10", modifiers: 8 });
    near(lastMenu.point.x, rect(group).left, "Keyboard menu anchor x"); near(lastMenu.point.y, rect(group).bottom, "Keyboard menu anchor y");
    await key("Escape"); assert(document.activeElement === group && !document.querySelector(".menu"), "Escape dismisses and restores group focus");
    await key("ContextMenu"); assert(document.activeElement.getAttribute("role") === "menuitem", "Menu key enters menu");
    await key("Enter"); await settle(); assert(lastModal.containerEl.isConnected && cleared === 0, "Enter opens confirmation before any clear");
    assert(requested.length === 2 && requested.every(r => r.text !== "Open") && requested[0].projectId === "a" && requested[1].projectId === null && requested[1].contextKind === "resource" && requested[1].path === "Resources/Knowledge/Tasks.md", "Exact former visible completed scope and project/resource owner metadata");
    await key("Escape"); await settle(); assert(cleared === 0, "Confirmation cancellation clears nothing");
    group.focus(); await key("ContextMenu"); await key("Enter"); await settle();
    context(); assert(lastMenu.items[0].disabled, "Pending confirmation disables repeated group clear"); lastMenu.hide();
    const beforeRequests = requested; await controller.clear(); assert(requested === beforeRequests, "Concurrent clear ignored");
    lastModal.contentEl.querySelector(".mod-warning").click(); await settle(); assert(cleared === 1, "Confirmed group action runs once");
    const clearBridge = window.hubClearCompletedTasks;
    window.hubClearCompletedTasks = async () => { throw Error("Could not write source note"); };
    context(); lastMenu.el.querySelector("button").click(); await settle();
    assert(notices.includes("Could not write source note"), "Clear errors are visible");
    window.hubClearCompletedTasks = clearBridge;
    context(); assert(!lastMenu.items[0].disabled, "Failed clear releases pending guard for retry"); lastMenu.hide();
    group.click(); await settle(); group = completed(); assert(group.getAttribute("aria-expanded") === "true" && controller.body.querySelectorAll(".is-completed").length === 2, "Click disclosure preserves completed rows");
    const text = controller.body.querySelector(".home-task-text"); text.click(); assert(edited === 2, "Task editing preserved");
    const checkbox = controller.body.querySelector("input"); checkbox.click(); await settle(); assert(toggled === 1, "Task checkbox preserved"); group = completed();
    context(); const oldMenu = lastMenu; controller.render(); assert(!oldMenu.el.isConnected, "Rerender closes stale menu"); group = completed();
    context(); component.unload(); assert(!lastMenu.el.isConnected, "View teardown closes menu");
    for (const variant of ["Project", "Resource", "Project note", "Resource note"]) {
        const host = document.body.createDiv({ cls: "project-dashboard hub-button-scope" }), header = host.createDiv({ cls: "project-tasks-title" });
        const c = new Component(), options = { root: variant };
        let received;
        const ui = load("ui/tasks").createTaskUi({ app: {}, component: c, body: host.createDiv(), createTask: value => { received = value; } });
        const add = ui.addButton(header, options);
        assert(add.textContent === "Task" && add.querySelector('[data-icon="plus"]'), variant + " labelled Task");
        near(rect(add).height, 23, variant + " retains compact height");
        add.click(); assert(received === options, variant + " forwards original creation options");
        ui.group("completed", [], () => {}, { clear: () => { throw Error("Empty group cannot clear"); } });
        assert(!host.querySelector(".hub-task-group-toggle"), "Empty completed group has no destructive target");
        c.unload(); host.remove();
    }
    const workspaceLayouts = await window.checkWorkspaceTaskActions({ load, domain, confirmAction });
    // Same production sizing rule at every responsive track count, font and zoom.
    const actions = [calendarTodayButton, editFocusButton, controller.addTaskButton]; let cases = 0;
    for (const width of [360, 600, 900, 1040, 1366, 1800]) for (const zoom of [.8, 1, 1.25, 1.5]) for (const font of [17, 21]) {
        fixture.style.width = width + "px"; document.body.style.zoom = zoom; document.documentElement.style.fontSize = font + "px";
        const panels = [...grid.children], geometry = panels.map(p => [rect(p).width, rect(p).height, rect(p).top]);
        const sharedWidth = rect(actions[0]).width;
        const probes = actions.map(button => { const clone = button.cloneNode(true); clone.classList.remove("hub-compact-panel-action"); clone.querySelectorAll(".hub-compact-panel-action-sizer").forEach(e => e.remove()); clone.style.cssText = "position:absolute;visibility:hidden;margin:0"; button.parentElement.append(clone); return clone; });
        const widest = Math.max(...probes.map(b => rect(b).width)); probes.forEach(b => b.remove());
        for (const action of actions) {
            near(rect(action).width, sharedWidth, "Shared widths"); near(rect(action).width, widest, "Widest intrinsic icon/text/padding");
            near(rect(action).height, 23 * zoom, "Unchanged compact height");
            const header = rect(action.parentElement), style = getComputedStyle(action.parentElement);
            assert(rect(action).left >= header.left && rect(action).right <= header.right + .05, "Action stays inside header");
            near((rect(action).top + rect(action).bottom) / 2, (header.top + parseFloat(style.paddingTop)*zoom + header.bottom - parseFloat(style.paddingBottom)*zoom) / 2, "Header content centerline");
            near(rect(action).right, header.right - parseFloat(style.paddingRight)*zoom, "Right alignment");
        }
        panels.forEach((p, i) => { near(rect(p).width, geometry[i][0], "Panel width preserved"); near(rect(p).height, geometry[i][1], "Panel height preserved"); near(rect(p).top, geometry[i][2], "Panel top preserved"); near(rect(p).width, rect(panels[0]).width, "Equal panel grid"); });
        cases++;
    }
    document.body.style.zoom = 1; document.documentElement.style.fontSize = "17px"; fixture.style.width = "min(1560px, 100%)";
    result.textContent = `PASS: ${cases} Home and ${workspaceLayouts} workspace/Note layouts at DPR ${devicePixelRatio}; intrinsic equal Home widths; all four workspace contexts use shared native Menu, keyboard entry/Enter/Escape, confirmation/cancel, duplicate guard, scoped requests, disclosure/edit/checkbox and menu cleanup. Obsidian Menu/Modal host APIs mocked.`;
} catch (error) { result.textContent = "FAIL: " + error.stack; } };
