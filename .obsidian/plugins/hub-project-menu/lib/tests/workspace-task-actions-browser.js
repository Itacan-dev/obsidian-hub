"use strict";
// Called by the Home fixture to share its Obsidian mocks and production UI loader.
window.checkWorkspaceTaskActions = async ({ load, domain, confirmAction }) => {
    const source = await (await fetch("../../../../../System/Dashboards/Project/view.js")).text();
    const taskCode = source.slice(source.indexOf("const tasksPanel ="), source.indexOf("frame.defer(() => renderCurrentTasks());"));
    const railSource = await (await fetch("../ui/prepared-note-rail.js")).text();
    assert(railSource.includes('const VIEW_PATH = "System/Dashboards/Project/view"'), "Contextual Note rails load the same renderer");
    assert(!taskCode.includes("clearCompletedTasksButton"), "Shared workspace source has no header Clear");
    assert((await (await fetch("../ui/task-form.js")).text()).includes('text: "Clear"'), "Unrelated task classification Clear remains");
    let layouts = 0;
    window.hubSetIcon = obsidian.setIcon;
    window.hubCreateTaskRow = load("ui/tasks").createTaskRow;
    for (const variant of ["Project Full-view", "Resource Full-view", "Project Note-view", "Resource Note-view"]) {
        const resource = variant.startsWith("Resource"), note = variant.includes("Note-view");
        const host = document.body.createDiv({ cls: note ? "hub-project-rail-pane" : "workspace-task-fixture" });
        const rail = note ? host.createDiv({ cls: "hub-project-rail" }) : host;
        const root = rail.createDiv({ cls: "project-dashboard hub-button-scope" + (resource ? " resource-dashboard" : " has-project-modes") + (!note ? " hub-full-view" : "") });
        const grid = root.createDiv({ cls: "project-main-grid" }); grid.createDiv({ cls: "project-left-column" });
        const rightCol = grid.createDiv({ cls: "project-right-column" });
        const component = new Component(), projectRoot = resource ? "Resources/Knowledge" : "Projects/A";
        const current = { projectId: "a", status: "active", resourceType: "study", file: { name: resource ? "Knowledge" : "A", path: projectRoot + "/Hub.md" } };
        let items = [
            { text: "Open task", completed: false },
            { text: "Completed root task", completed: true },
            { text: "Completed contextual task", completed: true },
            { text: "Future task", completed: false, fromDate: "2099-01-01" }
        ].map((t, line) => ({ ...t, line, path: projectRoot + (line === 2 ? "/Nested/Context.md" : "/Tasks.md") }));
        let requested, created, edits = 0, toggles = 0, clears = 0;
        const dv = { component }, app = { vault: { getAbstractFileByPath: path => ({ path }) } };
        window.hubTaskData = { currentPath: path => path, readPages: (_dv, scope) => {
            assert(scope === projectRoot, variant + " retains whole current-workspace scope");
            return [{ file: { tasks: items } }];
        } };
        window.hubCreateTaskUi = (_c, body, onEdit) => load("ui/tasks").createTaskUi({ app, component, body, onEdit,
            createTask: options => { created = options; }, editTask: () => edits++, mutate: async () => {} });
        window.hubClearCompletedTasks = async (requests, confirm) => {
            requested = requests;
            assert(confirm === true, variant + " group clear requests existing confirmation");
            if (!await confirmAction(app, "Clear completed tasks?", "Remove completed tasks from their notes? They will remain available in Tasks history.")) return { cancelled: true };
            clears++; return { deleted: requests };
        };
        window.hubToggleTask = async (path, line, text, completed) => {
            toggles++; return { path, line, requestLine: line, oldText: text, lineDelta: 0, tasks: [{ path, line, text, completed }] };
        };
        const controller = new Function("rightCol", "root", "dv", "app", "current", "projectRoot", "isResourceContext", `
            const right=rightCol,taskWorkspace={active:()=>false},openProjectNote=async()=>{};
            ${taskCode};return {render:renderCurrentTasks,body:tasksBody,panel:tasksPanel,header:tasksTitle,clear:clearVisibleCompletedTasks};
        `)(rightCol, root, dv, app, current, projectRoot, resource);
        controller.render(); await settle();
        const add = controller.header.querySelector(".hub-task-add");
        assert(controller.header.querySelectorAll("button").length === 1 && !controller.header.textContent.includes("Clear"), variant + " only + Task remains in header");
        assert(add.textContent === "Task" && add.querySelector('[data-icon="plus"]'), variant + " preserves + Task");
        add.click(); assert(created.root === projectRoot, variant + " creation stays in current root");
        const completed = () => [...controller.body.querySelectorAll(".hub-task-group-toggle")].find(b => b.textContent.includes("completed"));
        let group = completed();
        const context = () => { const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }); group.dispatchEvent(e); assert(e.defaultPrevented, variant + " handles right-click"); };
        context(); assert(lastMenu.items.length === 1 && lastMenu.items[0].title === "Clear completed tasks" && lastMenu.items[0].warning, variant + " reuses shared native menu");
        assert(group.getAttribute("aria-expanded") === "false", variant + " right-click preserves collapsed state");
        lastMenu.hide(); group.focus(); await key({ key: "F10", modifiers: 8 });
        await key("Escape"); assert(document.activeElement === group, variant + " keyboard menu returns focus");
        await key("ContextMenu"); await key("Enter"); await settle();
        assert(lastModal.containerEl.isConnected && clears === 0, variant + " confirms before clearing");
        assert(requested.length === 2 && requested.map(r => r.text).join("|") === "Completed root task|Completed contextual task", variant + " includes contextual completed task and excludes open/future tasks");
        requested.forEach(r => {
            assert(r.path.startsWith(projectRoot + "/") && r.projectRoot === projectRoot && r.projectPath === current.file.path, variant + " retains request paths");
            assert(r.contextKind === (resource ? "resource" : "project") && r.projectId === (resource ? null : "a") && r.resourceType === (resource ? "study" : null), variant + " retains owner metadata");
        });
        context(); assert(lastMenu.items[0].disabled, variant + " blocks duplicate pending clear"); lastMenu.hide();
        await key("Escape"); await settle(); assert(clears === 0, variant + " cancelled clear does nothing");
        group.focus(); await key("ContextMenu"); await key("Enter"); await settle();
        lastModal.contentEl.querySelector(".mod-warning").click(); await settle(); assert(clears === 1, variant + " confirmed clear runs once");
        const bridge = window.hubClearCompletedTasks;
        window.hubClearCompletedTasks = async () => { throw Error(variant + " write failed"); };
        context(); lastMenu.el.querySelector("button").click(); await settle();
        assert(notices.includes(variant + " write failed"), variant + " reports errors"); window.hubClearCompletedTasks = bridge;
        context(); assert(!lastMenu.items[0].disabled, variant + " allows retry after failure"); lastMenu.hide();
        group.click(); await settle(); group = completed(); assert(group.getAttribute("aria-expanded") === "true", variant + " disclosure preserved");
        controller.body.querySelector(".project-task-text").click(); assert(edits === 1, variant + " editing preserved");
        controller.body.querySelector("input").click(); await settle(); assert(toggles === 1, variant + " checkbox preserved"); group = completed();
        for (const width of note ? [280, 320, 460] : [900, 1040, 1560]) for (const zoom of [1, 1.25]) for (const state of note ? ["open", "half"] : ["open"]) {
            host.style.width = width + "px"; host.dataset.hubRailState = state; document.body.style.zoom = zoom;
            const box = rect(controller.panel), header = rect(controller.header), padding = getComputedStyle(controller.header);
            near(rect(add).height, 23 * zoom, variant + " button height");
            near(rect(add).right, header.right - parseFloat(padding.paddingRight) * zoom, variant + " right alignment");
            assert(rect(add).left >= header.left && rect(add).bottom <= header.bottom + .05, variant + " no header overflow");
            if (!note) near(box.height, 245 * zoom, variant + " fixed panel height");
            assert(getComputedStyle(controller.body).overflowY === "auto", variant + " task scrolling preserved");
            layouts++;
        }
        document.body.style.zoom = 1;
        context(); const oldMenu = lastMenu; controller.render(); assert(!oldMenu.el.isConnected, variant + " closes stale menu on refresh");
        items = items.filter(t => !t.completed); controller.render(); assert(!completed(), variant + " no completed-group action when empty");
        await controller.clear(); assert(clears === 1, variant + " empty scope cannot clear");
        component.unload(); host.remove();
    }
    delete window.hubTaskData;
    return layouts;
};
