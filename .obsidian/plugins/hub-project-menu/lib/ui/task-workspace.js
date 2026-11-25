"use strict";
const { hasKeyboardFocus, focusControl, revealHorizontalKeyboardFocus } = require("./focus-restoration");
const { createTaskUi } = require("./tasks");
const { openTaskEditor, openTaskCreator } = require("./task-editor");
const { filterTasks, locationLabel, validLocation } = require("../domain/task-views");
const { taskWorkspaces } = require("../services/task-locations");
const { button } = require("./task-view-primitives");
const { renderTaskSchedule } = require("./task-view-calendar");
const { createCalendarEventReader } = require("./calendar-events");
const { mountProjectRoadmap } = require("./project-roadmap");

// Weakly scoped to the owning Dataview container, including warm frame rebuilds.
const states = new WeakMap();
function mountTaskWorkspace({ plugin, component, dv, root, toolbar, filesGrid, filesPanel, roadmapParent, workspace, onFiles, onModeChange, showTasks, openSource, nativeTasks }) {
    let byWorkspace = states.get(dv.container);
    if (!byWorkspace) states.set(dv.container, byWorkspace = new Map());
    const resource = workspace.contextKind === "resource";
    const workspaceRef = { type: resource ? "resource" : "project", id: resource ? workspace.resourceType ?? workspace.id : workspace.projectId };
    const key = workspace.projectId ?? workspace.root;
    let state = byWorkspace.get(key);
    if (!state) byWorkspace.set(key, state = { mode: "work", scheduleView: "upcoming",
        search: "", location: "", status: "open", necessity: "", date: "", sort: "due", direction: 1,
        calendarMode: "month", anchor: new Date(), timelineAnchor: new Date(), months: 6,
        expanded: new Set(), collapsed: new Set() });
    if (!["work", "roadmap", "schedule"].includes(state.mode) || resource && state.mode === "roadmap") state.mode = "work";
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
    for (const [value, label] of [["work", "Work"], ["schedule", "Schedule"], ...(resource ? [] : [["roadmap", "Roadmap"]])]) {
        const control = button(modeGroup, label, () => mode(value), "hub-task-mode");
        control.dataset.workspaceMode = value;
        modeButtons.set(value, control);
        control.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const keys = [...modeButtons.keys()];
            const index = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : (keys.indexOf(value) + (event.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length;
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
    const revealFocusedControl = event => {
        const control = event.target;
        const scroll = control.closest(".hub-task-local-scroll");
        if (!scroll || !content.contains(scroll) || !hasKeyboardFocus(control)) return;
        // Let Chromium finish its normal focus scrolling before correcting the
        // remaining horizontal clipping. Pointer focus never requests this.
        content.ownerDocument.defaultView.requestAnimationFrame(() => revealHorizontalKeyboardFocus(control, scroll));
    };
    content.addEventListener("focusin", revealFocusedControl);
    component.register(() => content.removeEventListener("focusin", revealFocusedControl));
    let tasks = [], locations = [], workspaces = [], dirty = true, disposed = false, readGeneration = 0;
    let nativeLoading = true, nativeAvailable = false, nativeRefreshTimer = null, nativeReading = false, nativeRefreshPending = false;
    const native = nativeTasks.createPanelRead({ plugin, component, workspace: workspaceRef, changed: () => { nativeAvailable = native?.availability?.() === "current"; if (nativeReading) { nativeRefreshPending = true; return; } clearTimeout(nativeRefreshTimer); nativeRefreshTimer = setTimeout(() => { if (!disposed) void refresh(); }, 0); } });
    component.register(() => { readGeneration++; native.close(); clearTimeout(nativeRefreshTimer); });
    const pending = new Set();
    let scheduleFocusRequest;
    const inNoteRail = () => !!root.closest(".hub-project-rail");
    // Derive the mode boundary from the rendered Files grid, including its
    // responsive split and borders. Never change the explorer to fit the modes.
    const syncModeWidth = () => {
        if (disposed || inNoteRail() || filesGrid.hidden || filesGrid.classList.contains("hub-has-expanded-panel")) return;
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
    const syncHeaderHeight = () => {
        if (disposed || inNoteRail() || filesGrid.classList.contains("hub-has-expanded-panel")) return;
        const heading = filesPanel?.querySelector(".hub-explorer-heading");
        const height = heading?.getBoundingClientRect().height;
        if (height > 0) root.style.setProperty("--hub-project-header-height", height + "px");
    };
    const modeWidthObserver = new ResizeObserver(() => { syncModeWidth(); syncHeaderHeight(); });
    modeWidthObserver.observe(toolbar);
    if (filesPanel) modeWidthObserver.observe(filesPanel);
    component.register(() => modeWidthObserver.disconnect());
    const currentPath = path => path;
    
    const describe = task => require("../domain/native-task-location").locationBreadcrumb(task, workspaceRef)?.label ?? workspace.name ?? "Project";
    const belongs = task => validLocation(task.path, workspace);
    const apply = edit => { const next = native.reconcile(tasks, edit); nativeAvailable = native.availability() === "current"; tasks = nativeAvailable ? next : next.map(task => ({ ...task, nativeReadOnly: true })); dirty = true; render(); void refresh(); };
    const editTask = (task, saved = apply) => native.actions.editTask(task, saved);
    const edit = task => editTask(task);
    const mutate = request => { if (!nativeAvailable) throw Error("Schedule is unavailable."); return native.actions.mutate(request); };
    const ui = createTaskUi({ app: plugin.app, component, body: content, mutate,
        onEdit: apply, editTask, oath: plugin.oath, plan: plugin.globalPlan, planRelevance: plugin.planRelevance,
        createTask: options => create(options), phaseLabel: task => plugin.planning?.phaseFor(task)?.name });
    function create(options) { if (!nativeAvailable) throw Error("Schedule is unavailable."); return native.create({ ...options, onCreated: () => { dirty = true; void refresh(); } }); }
    async function refresh() {
        dirty = true;
        const generation = ++readGeneration;
        if (disposed || state.mode !== "schedule" || inNoteRail()) return;
        const projectId = workspace.projectId;
        const cancelled = () => disposed || !root.isConnected || generation !== readGeneration || state.mode !== "schedule" || inNoteRail() || workspace.projectId !== projectId;
        content.setAttribute("aria-busy", "true");
        try {
            if (native) {
                nativeReading = true;
                const result = await native.read(); if (cancelled()) return;
                if (!result) throw Error("Native Schedule capture was superseded.");
                nativeLoading = result.availability === "loading";
                if (nativeLoading) { nativeAvailable = false; tasks = tasks.map(task => ({ ...task, nativeReadOnly: true })); render(); return; }
                if (result.availability !== "current" || result.context.root !== workspace.root || result.context.dashboard !== workspace.path || (!resource && result.context.status !== workspace.status)) throw Error("Native Schedule owner unavailable.");
                tasks = result.tasks; locations = []; nativeAvailable = true; native.accept(tasks); dirty = false; render(); return;
            }
        } catch (error) {
            if (!cancelled()) { if (native) { nativeLoading = false; nativeAvailable = false; tasks = tasks.map(task => ({ ...task, nativeReadOnly: true })); render(); }
                console.error("Schedule task read failed", error);
                if (!native) new (require("obsidian").Notice)("Schedule tasks could not be loaded. Please try again."); }
        } finally { if (native) { nativeReading = false; if (nativeRefreshPending) { nativeRefreshPending = false; clearTimeout(nativeRefreshTimer); nativeRefreshTimer = setTimeout(() => { if (!disposed) void refresh(); }, 0); } } if (generation === readGeneration) content.removeAttribute("aria-busy"); }
    }
    const events = createCalendarEventReader(plugin.app, content.ownerDocument.defaultView, render);
    component.register(() => events.dispose());
    function render(event) {
        if (disposed || state.mode !== "schedule" || inNoteRail()) return;
        // Preserve navigation intent if the shared renderer defers this rebuild.
        if (event) scheduleFocusRequest = { control: event.currentTarget,
            key: hasKeyboardFocus(event.currentTarget, event) ? event.currentTarget.dataset.scheduleControl : null };
        if (!ui.beginRender(render)) return;
        // Schedules existing start-time boundaries without changing panel semantics.
        ui.groups(tasks);
        content.setAttribute("aria-label", "Schedule");
        const selection = { ...state, status: "open", necessity: "", date: "" };
        const now = new Date();
        const visible = filterTasks(tasks, selection, now, describe);
        const focused = content.ownerDocument.activeElement;
        const requestedFocus = scheduleFocusRequest?.control === focused ? scheduleFocusRequest.key : undefined;
        const focusKey = requestedFocus !== undefined ? requestedFocus :
            content.contains(focused) && hasKeyboardFocus(focused) ? focused.dataset.scheduleControl : null;
        scheduleFocusRequest = undefined;
        content.empty();
        if (native && !nativeAvailable) content.createDiv({ cls: "hub-task-view-empty", text: nativeLoading ? "Loading tasks..." : "Schedule unavailable. Retained tasks are not a complete current total.", attr: { role: "status" } });
        const context = { workspace, resource, locationScope: workspaceRef, events, openTasks: () => {
            mode("work");
            showTasks?.();
        }, folders: locations.filter(item => item.folder), now,
            ui, pending, currentPath, unavailable: native && !nativeAvailable, locationLabel: describe, phaseLabel: task => plugin.planning?.phaseFor(task)?.name, apply, edit, create, render,
            toggle: mutate,
            openSource: async task => {
                throw Error("Tasks use native workspace locations.");
            } };
        renderTaskSchedule(content, visible, context, state);
        if (native && !nativeAvailable) {
            content.querySelectorAll('.hub-full-add-task, [aria-label^="Add task on "]').forEach(control => { control.disabled = true; });
            content.querySelectorAll(".hub-task-count, .hub-task-column-empty").forEach(count => { count.textContent = "Unavailable"; });
        }
        if (focusKey) focusControl(content.querySelector(`[data-schedule-control="${focusKey}"]`));
    }
    function mode(value, initial = false) {
        syncHeaderHeight();
        readGeneration++; content.removeAttribute("aria-busy");
        scheduleFocusRequest = undefined;
        state.mode = value;
        const active = value === "schedule";
        root.classList.toggle("is-task-workspace", active);
        root.classList.toggle("is-roadmap-workspace", value === "roadmap");
        filesGrid.hidden = value !== "work"; host.hidden = !active;
        if (filesPanel) filesPanel.hidden = value === "roadmap";
        roadmapHost.hidden = value !== "roadmap";
        onModeChange?.(value);
        if (value === "roadmap") {
            roadmap ??= mountProjectRoadmap({ plugin, component, dv, host: roadmapHost, workspace, state });
            roadmap.render();
        }
        modeButtons.forEach((control, key) => {
            control.classList.toggle("is-active", value === key);
            control.setAttribute("aria-pressed", String(value === key));
        });
        if (active) { events.reset(); render(); if (dirty) void refresh(); }
        else if (!initial) onFiles?.();
        if (value === "work") syncModeWidth();
    }
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
        readGeneration++; content.removeAttribute("aria-busy");
        if (rail) onFiles?.();
        else if (state.mode === "schedule") { if (dirty) refresh(); else render(); }
    };
    const railObserver = new MutationObserver(layoutChanged);
    railObserver.observe(root.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
    if (plugin.app.workspace?.on) component.registerEvent(plugin.app.workspace.on("layout-change", () => queueMicrotask(layoutChanged)));
    component.register(() => { disposed = true; railObserver.disconnect(); });
    mode(state.mode, true);
    return { active: () => state.mode === "schedule" && !inNoteRail(), refresh, render, state,
        showFiles: () => mode("work"), focusPlanning: (kind, id) => { if (native) return false; mode("roadmap"); return roadmap.focus(kind, id); } };
}
module.exports = { mountTaskWorkspace };
