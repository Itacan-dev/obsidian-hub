"use strict";
const { createTaskUi } = require("./tasks");
const { openTaskEditor, openTaskCreator } = require("./task-editor");
const { applyTaskEdit } = require("../domain/tasks");
const { PROJECT_VIEWS, RESOURCE_VIEWS, VIEW_LABELS, BUCKETS, filterTasks, locationLabel, validLocation } = require("../domain/task-views");
const { taskWorkspaces } = require("../services/task-locations");
const { button } = require("./task-view-primitives");
const { renderUpcoming } = require("./task-view-upcoming");
const { renderTaskTable } = require("./task-view-table");
const { renderByLocation } = require("./task-view-location");
const { renderTaskCalendar } = require("./task-view-calendar");
const { renderTaskTimeline } = require("./task-view-timeline");
const { setIcon } = require("obsidian");

// Weakly scoped to the owning Dataview container, including warm frame rebuilds.
const states = new WeakMap();
function mountTaskWorkspace({ plugin, component, dv, root, toolbar, filesGrid, workspace, onFiles, openSource }) {
    let byWorkspace = states.get(dv.container);
    if (!byWorkspace) states.set(dv.container, byWorkspace = new Map());
    const resource = workspace.contextKind === "resource";
    const key = workspace.projectId ?? workspace.root;
    let state = byWorkspace.get(key);
    if (!state) byWorkspace.set(key, state = { mode: "files", view: resource ? "location" : "upcoming",
        search: "", location: "", status: "open", necessity: "", date: "", sort: "due", direction: 1,
        calendarMode: "month", anchor: new Date(), timelineAnchor: new Date(), months: 6,
        expanded: new Set(), collapsed: new Set() });
    const views = resource ? RESOURCE_VIEWS : PROJECT_VIEWS;
    if (!views.includes(state.view)) state.view = views[0];
    toolbar.classList.add("hub-task-workspace-nav");
    const primary = toolbar.createDiv({ cls: "hub-task-primary-modes", attr: { role: "group", "aria-label": "Workspace mode" } });
    const filesButton = button(primary, "Files", () => mode("files"), "hub-task-mode", "folder");
    const tasksButton = button(primary, "Tasks", () => mode("tasks"), "hub-task-mode", "list-todo");
    const secondary = toolbar.createDiv({ cls: "hub-task-secondary-nav" });
    const separator = secondary.createDiv({ cls: "hub-task-nav-separator", attr: { "aria-hidden": "true" } });
    const tabs = secondary.createDiv({ cls: "hub-task-view-tabs", attr: { role: "tablist", "aria-label": "Task views" } });
    const tabButtons = new Map();
    for (const view of views) {
        const tab = button(tabs, VIEW_LABELS[view], () => { state.view = view; render(); }, "hub-button-plain hub-task-view-tab");
        tab.setAttribute("role", "tab"); tab.dataset.taskView = view; tabButtons.set(view, tab);
        tab.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const index = event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 :
                (views.indexOf(view) + (event.key === "ArrowRight" ? 1 : -1) + views.length) % views.length;
            state.view = views[index]; render(); tabButtons.get(state.view).focus();
        });
    }
    const actions = toolbar.createDiv({ cls: "hub-task-nav-actions" });
    const searchHost = actions.createEl("label", { cls: "hub-task-search" });
    setIcon(searchHost.createSpan({ attr: { "aria-hidden": "true" } }), "search");
    const search = searchHost.createEl("input", { type: "search", attr: { placeholder: "Search tasks…", "aria-label": "Search tasks" } });
    search.value = state.search;
    search.addEventListener("input", () => { state.search = search.value; render(); });
    button(actions, "Add task", () => create({}), "mod-cta hub-full-add-task", "plus");
    const host = root.createDiv({ cls: "hub-task-workspace hub-dashboard-enter-row" });
    toolbar.after(host);
    const filters = host.createDiv({ cls: "hub-task-filter-row" });
    const content = host.createDiv({ cls: "hub-task-view-content", attr: { role: "tabpanel" } });
    let tasks = [], locations = [], workspaces = [], dirty = true, disposed = false;
    const pending = new Set();
    const inNoteRail = () => !!root.closest(".hub-project-rail");
    const currentPath = path => plugin.taskData.currentPath(path);
    const owner = task => workspaces.find(item => validLocation(currentPath(task.path), item)) ?? workspace;
    const describe = task => locationLabel(currentPath(task.path), owner(task), owner(task).root !== workspace.root);
    const projectLabel = task => {
        if (!task.linkedProjectId) return "";
        const project = workspaces.find(item => item.contextKind !== "resource" && item.projectId === task.linkedProjectId);
        return project ? project.name + (project.status === "shelved" ? " (shelved)" : "") : "";
    };
    const belongs = task => validLocation(task.path, workspace) || (!resource && task.linkedProjectId === workspace.projectId &&
        workspaces.some(item => item.contextKind === "resource" && validLocation(task.path, item)));
    const apply = edit => { tasks = applyTaskEdit(tasks, edit).filter(belongs); render(); };
    const edit = task => openTaskEditor(plugin.taskEditor, { ...task, path: currentPath(task.path) }, apply);
    const ui = createTaskUi({ app: plugin.app, component, body: content, mutate: request => plugin.mutateTask(request),
        onEdit: apply, editTask: (task, saved) => openTaskEditor(plugin.taskEditor, task, saved),
        createTask: options => create(options) });
    function create(options) {
        openTaskCreator(plugin.taskEditor, { root: workspace.root, location: state.location || workspace.root, ...options });
    }
    function refresh() {
        dirty = true;
        if (disposed || state.mode !== "tasks" || inNoteRail()) return;
        workspace = { ...workspace, root: currentPath(workspace.root) };
        workspaces = taskWorkspaces(plugin).sort((a, b) => b.root.length - a.root.length);
        tasks = plugin.taskData.readWorkspace(dv, workspace, workspaces.filter(item => item.contextKind === "resource"));
        locations = plugin.taskEditor.locations(workspace.root);
        if (state.location) {
            state.location = currentPath(state.location);
            if (!locations.some(item => item.path === state.location)) state.location = "";
        }
        dirty = false; render();
    }
    function selectFilter(label, value, options, changed) {
        const select = filters.createEl("select", { attr: { "aria-label": label } });
        for (const [key, text] of options) select.createEl("option", { attr: { value: key }, text });
        select.value = value;
        select.addEventListener("change", () => { changed(select.value); render(); });
        return select;
    }
    function render() {
        if (disposed || state.mode !== "tasks" || inNoteRail()) return;
        if (!ui.beginRender(render)) return;
        // Schedules existing start-time boundaries without changing panel semantics.
        ui.groups(tasks);
        tabButtons.forEach((tab, view) => {
            tab.classList.toggle("is-active", view === state.view);
            tab.setAttribute("aria-selected", String(view === state.view)); tab.tabIndex = view === state.view ? 0 : -1;
        });
        content.setAttribute("aria-label", VIEW_LABELS[state.view]);
        filters.empty();
        selectFilter("Location", state.location, [["", "All locations"], ...locations.map(item => [item.path, item.label + (item.folder ? " · Folder" : "")])], value => { state.location = value; });
        if (state.view === "all") {
            selectFilter("Status", state.status, [["all", "All status"], ["open", "Incomplete"], ["active", "Current"], ["future", "Future"], ["completed", "Completed"]], value => { state.status = value; });
            selectFilter("Necessity", state.necessity, [["", "All necessity"], ["must", "Must do"], ["should", "Should do"], ["neutral", "Unassigned"]], value => { state.necessity = value; });
            selectFilter("Date", state.date, [["", "All dates"], ...BUCKETS], value => { state.date = value; });
        }
        const selection = { ...state, ...(state.view === "all" ? {} : { status: "open", necessity: "", date: "" }) };
        const now = new Date();
        const visible = filterTasks(tasks, selection, now, task => describe(task) + " " + projectLabel(task));
        content.empty();
        const context = { workspace, resource, folders: locations.filter(item => item.folder), now,
            ui, pending, currentPath, locationLabel: describe, projectLabel, apply, edit, create, render,
            toggle: request => plugin.mutateTask(request),
            openSource: task => openSource(currentPath(task.path)) };
        if (state.view === "upcoming") renderUpcoming(content, visible, context);
        else if (state.view === "calendar") renderTaskCalendar(content, visible, context, state);
        else if (state.view === "timeline") renderTaskTimeline(content, visible, context, state);
        else if (state.view === "location") renderByLocation(content, visible, context, state);
        else renderTaskTable(content, visible, context, state);
    }
    function mode(value, initial = false) {
        state.mode = value;
        const active = value === "tasks";
        root.classList.toggle("is-task-workspace", active);
        filesGrid.hidden = active; host.hidden = !active;
        for (const el of [secondary, actions]) el.hidden = !active;
        filesButton.classList.toggle("is-active", !active); tasksButton.classList.toggle("is-active", active);
        filesButton.setAttribute("aria-pressed", String(!active)); tasksButton.setAttribute("aria-pressed", String(active));
        if (active) { if (dirty) refresh(); else render(); }
        else if (!initial) onFiles?.();
    }
    plugin.taskData.subscribe(component, refresh);
    // Project state/name changes can alter association labels without a task edit.
    const update = () => refresh();
    if (plugin.app.metadataCache?.on) component.registerEvent(plugin.app.metadataCache.on("changed", file => {
        if (workspaces.some(item => item.path === file.path)) update();
    }));
    // Native note mode keeps this workspace mounted in a compact Files rail.
    // Follow the existing body/layout signals instead of resetting task view state.
    let wasRail = inNoteRail();
    const layoutChanged = () => {
        const rail = inNoteRail();
        if (disposed || wasRail === rail) return;
        wasRail = rail;
        if (rail) onFiles?.();
        else if (state.mode === "tasks") { if (dirty) refresh(); else render(); }
    };
    const railObserver = new MutationObserver(layoutChanged);
    railObserver.observe(root.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
    if (plugin.app.workspace?.on) component.registerEvent(plugin.app.workspace.on("layout-change", () => queueMicrotask(layoutChanged)));
    component.register(() => { disposed = true; railObserver.disconnect(); });
    mode(state.mode, true);
    return { active: () => state.mode === "tasks" && !inNoteRail(), refresh, render, state };
}
module.exports = { mountTaskWorkspace };
