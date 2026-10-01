"use strict";
const { createTaskUi } = require("./tasks");
const { openTaskEditor, openTaskCreator } = require("./task-editor");
const { applyTaskEdit } = require("../domain/tasks");
const { filterTasks, locationLabel, validLocation } = require("../domain/task-views");
const { taskWorkspaces } = require("../services/task-locations");
const { button } = require("./task-view-primitives");
const { renderTaskCalendar } = require("./task-view-calendar");
const { renderUpcoming } = require("./task-view-upcoming");
const { renderScheduleToolbar } = require("./schedule-toolbar");
const { mountProjectRoadmap } = require("./project-roadmap");

// Weakly scoped to the owning Dataview container, including warm frame rebuilds.
const states = new WeakMap();
function mountTaskWorkspace({ plugin, component, dv, root, toolbar, filesGrid, filesPanel, roadmapParent, workspace, onFiles, openSource }) {
    if (workspace.contextKind === "resource") return { active: () => false, showFiles: () => onFiles?.() };
    let byWorkspace = states.get(dv.container);
    if (!byWorkspace) states.set(dv.container, byWorkspace = new Map());
    const resource = workspace.contextKind === "resource";
    const key = workspace.projectId ?? workspace.root;
    let state = byWorkspace.get(key);
    if (!state) byWorkspace.set(key, state = { mode: "work", scheduleView: "upcoming",
        search: "", location: "", status: "open", necessity: "", date: "", sort: "due", direction: 1,
        calendarMode: "month", anchor: new Date(), timelineAnchor: new Date(), months: 6,
        expanded: new Set(), collapsed: new Set() });
    if (!["work", "roadmap", "schedule"].includes(state.mode)) state.mode = "work";
    state.scheduleView ??= "upcoming";
    state.location = "";
    state.search = "";
    root.classList.add("has-project-modes");
    toolbar.classList.add("hub-task-workspace-nav");
    const primary = toolbar.createDiv({ cls: "hub-task-primary-modes", attr: { role: "group", "aria-label": "Workspace mode" } });
    if (state.modeWidth) primary.style.setProperty("--hub-project-mode-width", state.modeWidth);
    toolbar.prepend(primary);
    const modeGroup = primary.createDiv({ cls: "hub-equal-selectors hub-task-mode-buttons" });
    const modeButtons = new Map();
    for (const [value, label] of [["work", "Work"], ["schedule", "Schedule"], ["roadmap", "Roadmap"]]) {
        const control = button(modeGroup, label, () => mode(value), "hub-task-mode");
        control.dataset.workspaceMode = value;
        modeButtons.set(value, control);
        control.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const keys = [...modeButtons.keys()];
            const index = event.key === "Home" ? 0 : event.key === "End" ? 2 : (keys.indexOf(value) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
            mode(keys[index]); modeButtons.get(keys[index]).focus();
        });
    }
    const host = root.createDiv({ cls: "hub-task-workspace hub-dashboard-enter-row" });
    toolbar.after(host);
    roadmapParent ??= filesGrid.querySelector(".project-left-column") ?? filesGrid;
    filesPanel ??= roadmapParent.querySelector(".project-folder-stack");
    filesPanel?.classList.add("hub-work-files");
    // Planning surfaces are siblings of Work, so neither inherits its sidebar.
    const roadmapHost = root.createDiv({ cls: "hub-roadmap-host hub-dashboard-enter-row" });
    host.after(roadmapHost);
    let roadmap;
    const content = host.createDiv({ cls: "hub-task-view-content", attr: { role: "region" } });
    let tasks = [], locations = [], workspaces = [], dirty = true, disposed = false;
    const pending = new Set();
    const inNoteRail = () => !!root.closest(".hub-project-rail");
    // Derive the mode boundary from the rendered Files grid, including its
    // responsive split and borders. Never change the explorer to fit the modes.
    const syncModeWidth = () => {
        if (disposed || inNoteRail() || filesGrid.hidden) return;
        const details = filesPanel?.querySelector(".hub-explorer-details");
        if (!details?.getClientRects().length) return;
        const divider = details.getBoundingClientRect().left;
        const width = divider - primary.getBoundingClientRect().left + parseFloat(getComputedStyle(primary).borderRightWidth);
        const barStyle = getComputedStyle(toolbar);
        const available = toolbar.getBoundingClientRect().width - ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"]
            .reduce((sum, key) => sum + parseFloat(barStyle[key]), 0);
        if (width > 0 && available > 0) {
            // Retain the proportion across warm frame rebuilds and resizing in
            // planning modes; Work always refreshes it from the actual split.
            state.modeWidth = `${width / available * 100}%`;
            primary.style.setProperty("--hub-project-mode-width", state.modeWidth);
        }
    };
    const modeWidthObserver = new ResizeObserver(syncModeWidth);
    modeWidthObserver.observe(toolbar);
    if (filesPanel) modeWidthObserver.observe(filesPanel);
    component.register(() => modeWidthObserver.disconnect());
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
        createTask: options => create(options), phaseLabel: task => plugin.planning?.phaseFor(task)?.name });
    function create(options) {
        openTaskCreator(plugin.taskEditor, { root: workspace.root, location: state.location || workspace.root, ...options });
    }
    function refresh() {
        dirty = true;
        if (disposed || state.mode !== "schedule" || inNoteRail()) return;
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
    function render() {
        if (disposed || state.mode !== "schedule" || inNoteRail()) return;
        if (!ui.beginRender(render)) return;
        // Schedules existing start-time boundaries without changing panel semantics.
        ui.groups(tasks);
        content.setAttribute("aria-label", "Schedule");
        const selection = { ...state, status: "open", necessity: "", date: "" };
        const now = new Date();
        const visible = filterTasks(tasks, selection, now, task => describe(task) + " " + projectLabel(task));
        content.empty();
        const context = { workspace, resource, folders: locations.filter(item => item.folder), now,
            ui, pending, currentPath, locationLabel: describe, projectLabel, phaseLabel: task => plugin.planning?.phaseFor(task)?.name, apply, edit, create, render,
            toggle: request => plugin.mutateTask(request),
            openSource: task => openSource(currentPath(task.path)) };
        if (state.scheduleView !== "upcoming") renderTaskCalendar(content, visible, context, state);
        else {
            const panel = content.createDiv({ cls: "hub-task-calendar-panel hub-schedule-upcoming" });
            renderScheduleToolbar(panel, context, state);
            renderUpcoming(panel, visible, context);
        }
    }
    function mode(value, initial = false) {
        state.mode = value;
        const active = value === "schedule";
        root.classList.toggle("is-task-workspace", active);
        root.classList.toggle("is-roadmap-workspace", value === "roadmap");
        filesGrid.hidden = value !== "work"; host.hidden = !active;
        if (filesPanel) filesPanel.hidden = value === "roadmap";
        roadmapHost.hidden = value !== "roadmap";
        if (value === "roadmap") {
            roadmap ??= mountProjectRoadmap({ plugin, component, dv, host: roadmapHost, workspace, state });
            roadmap.render();
        }
        modeButtons.forEach((control, key) => {
            control.classList.toggle("is-active", value === key);
            control.setAttribute("aria-pressed", String(value === key));
        });
        if (active) { if (dirty) refresh(); else render(); }
        else if (!initial) onFiles?.();
        if (value === "work") syncModeWidth();
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
        else if (state.mode === "schedule") { if (dirty) refresh(); else render(); }
    };
    const railObserver = new MutationObserver(layoutChanged);
    railObserver.observe(root.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
    if (plugin.app.workspace?.on) component.registerEvent(plugin.app.workspace.on("layout-change", () => queueMicrotask(layoutChanged)));
    component.register(() => { disposed = true; railObserver.disconnect(); });
    mode(state.mode, true);
    return { active: () => state.mode === "schedule" && !inNoteRail(), refresh, render, state,
        showFiles: () => mode("work"), focusPlanning: (kind, id) => { mode("roadmap"); return roadmap.focus(kind, id); } };
}
module.exports = { mountTaskWorkspace };
