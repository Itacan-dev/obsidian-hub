"use strict";
const { bindCompletionSound, playTaskCompletionSound } = require("./completion-audio");
const { createHubMarkdown } = require("./markdown");
const { taskGroups, taskIsFuture, taskStartDate } = require("../domain/task-planning");
const { createTaskSteps } = require("./task-steps");
const { createOathTaskSection } = require("./oath-tasks");

const { createTaskRow, taskSourceLabel, mountTaskCardPresentation } = require("./task-card");

// Presentation only: no checkbox, edit bindings, menus or navigation.
function renderReadOnlyTask(parent, task, markdown, { unavailable = false } = {}) {
    const { setIcon } = require("obsidian");
    const row = parent.createDiv({ cls: "hub-oath-selected hub-readonly-task" });
    const status = unavailable ? "Source unavailable" : task.completed ? "Completed" : "Incomplete";
    const icon = row.createSpan({ cls: "hub-report-section-icon" + (!unavailable && task.completed ? " hub-report-check" : ""),
        attr: { role: "img", "aria-label": status } });
    setIcon(icon, unavailable ? "circle-help" : task.completed ? "square-check" : "square");
    icon.querySelector("svg")?.setAttribute("aria-hidden", "true");
    const text = row.createDiv({ cls: "project-task-info project-task-text", text: task.text });
    void markdown.render(text, task.text, task.path || "Home.md");
    if (unavailable) row.createSpan({ cls: "hub-oath-muted", text: "Source unavailable" });
    return row;
}

function createTaskUi({ app, component, body, mutate, onEdit, editTask, createTask, oath, phaseLabel }) {
    const { Menu, Notice, setIcon, Component } = require("obsidian");
    const document = body.ownerDocument;
    let lastRender = null, disposed = false, groupMenu = null;
    let renderNow = new Date(), refreshTimer = null, refreshAt = Infinity;
    const expanded = new Set();
    const report = error => { console.error("Hub task action failed", error); new Notice(error.message || "Could not update task."); };
    const stepStates = new Map(); component.register(() => stepStates.clear());
    const rows = require("./task-row-cache").createTaskRowCache(component, task => JSON.stringify([task, phaseLabel?.(task), Math.floor(renderNow.getTime() / 60000)]));
    const oathSection = createOathTaskSection(oath, body, component);
    if (oath) component.register(oath.onChange(() => { if (!disposed && body.isConnected) lastRender?.(); }));

    const defer = () => false;

    function beginRender(render) {
        groupMenu?.hide();
        lastRender = render;
        renderNow = new Date();
        clearTimeout(refreshTimer); refreshAt = Infinity;
        const midnight = new Date(renderNow); midnight.setHours(24, 0, 0, 0);
        scheduleRefresh(midnight.getTime());
        rows.begin();
        return true;
    }

    function scheduleRefresh(at) {
        if (at >= refreshAt) return;
        refreshAt = at;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            if (disposed || !body.isConnected) return;
            const scrollTop = body.scrollTop;
            lastRender?.();
            body.scrollTop = scrollTop;
        }, Math.max(1, at - renderNow.getTime()));
    }

    function groups(items) {
        const grouped = taskGroups(items, renderNow);
        for (const item of grouped.future) {
            const task = item.task && typeof item.task === "object" ? item.task : item;
            scheduleRefresh(taskStartDate(task).getTime());
        }
        return grouped;
    }

    function bind(row, textEl, task, getPath, options = {}) {
        const rowComponent = component.addChild(new Component());
        const markdown = createHubMarkdown({ app, component: rowComponent });
        const steps = createTaskSteps({ markdown, mutate, onEdit, report, setIcon, states: stepStates });
        row.dataset.taskId = task.id;
        row.dataset.taskRevision = String(task.nativeReference?.taskRevision ?? task.revision ?? 0);
        rows.store(task, row, rowComponent);
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && !options.selection) bindCompletionSound(checkbox, playTaskCompletionSound);
        if (taskIsFuture(task, renderNow)) scheduleRefresh(taskStartDate(task).getTime());
        const presentation = mountTaskCardPresentation(row, textEl, task, getPath, { ...options,
            description: options.description ?? options.dates !== false, now: renderNow, phaseLabel });
        rowComponent.register(() => presentation.destroy());
        const info = textEl.parentElement;
        if (!options.selection && options.steps !== false) steps.bind(info, task, getPath, rowComponent);
        if (editTask && !task.nativeReadOnly) {
            textEl.tabIndex = 0; textEl.setAttribute("role", "button"); textEl.setAttribute("aria-label", `Edit task: ${task.text}`);
            const open = event => {
                if (event.target.closest("a, input, textarea, button, .home-task-location, .project-task-location")) return;
                event.preventDefault(); event.stopImmediatePropagation();
                if (row.dataset.taskOpening) return;
                let modal;
                try { modal = editTask(task, onEdit); }
                catch (error) { report(error); return; }
                if (modal?.ready) {
                    row.dataset.taskOpening = "true"; row.setAttribute("aria-busy", "true");
                    const status = row.createSpan({ cls: "hub-task-operation-status", text: "Opening…", attr: { role: "status" } });
                    Promise.resolve(modal.ready).finally(() => { delete row.dataset.taskOpening; row.removeAttribute("aria-busy"); status.remove(); }).catch(report);
                    component.register(() => { if (!modal.saving) modal.close(); });
                }
            };
            // Checkbox, links, and buttons retain their own action.
            row.addEventListener("click", open);
            textEl.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") open(event);
            });
        }
        textEl.classList.add("hub-task-markdown");
        void markdown.render(textEl, task.text, getPath,
            () => !disposed);
        if (task.nativeReadOnly && checkbox) checkbox.disabled = true;
        if (options.selection || task.nativeReadOnly) return;
        row.addEventListener("contextmenu", event => {
            if (event.target.closest("textarea, input:not([type=checkbox])")) return;
            event.preventDefault(); event.stopPropagation();
            const menu = new Menu();
            menu.addItem(item => item.setTitle("Edit").setIcon("pencil")
                .onClick(() => editTask(task, onEdit)));
            menu.addItem(item => item.setTitle("Delete").setIcon("trash-2").setWarning(true)
                .onClick(async () => {
                    try {
                        editTask(task,onEdit);
                    }
                    catch (error) { report(error); }
                }));
            menu.showAtMouseEvent(event);
        });
    }

    component.register(() => {
        disposed = true;
        groupMenu?.hide();
        clearTimeout(refreshTimer);
    });
    function group(kind, items, render, options = {}) {
        if (!items.length) return;
        const button = body.createEl("button", { cls: "hub-task-group-toggle", attr: { type: "button" } });
        const open = expanded.has(kind);
        const chevron = button.createSpan({ cls: "hub-task-group-chevron", attr: { "aria-hidden": "true" } });
        setIcon(chevron, open ? "chevron-down" : "chevron-right");
        button.createSpan({ text: `${items.length} ${kind} ${items.length === 1 ? "task" : "tasks"}` });
        button.setAttribute("aria-expanded", String(open));
        button.addEventListener("click", () => { if (open) expanded.delete(kind); else expanded.add(kind); lastRender?.(); });
        if (kind === "completed" && options.clear) {
            button.setAttribute("aria-haspopup", "menu");
            button.setAttribute("aria-keyshortcuts", "Shift+F10");
            button.setAttribute("aria-description", "Right-click or press Shift+F10 for completed task actions.");
            const showMenu = (event, keyboard = false) => {
                event.preventDefault(); event.stopPropagation();
                if (disposed) return;
                groupMenu?.hide();
                const menu = groupMenu = new Menu();
                menu.addItem(item => item.setTitle("Clear completed tasks").setIcon("trash-2").setWarning(true)
                    .setDisabled(options.canClear?.() === false)
                    .onClick(async () => {
                        try { await options.clear(); }
                        catch (error) { report(error); }
                    }));
                menu.onHide(() => {
                    if (groupMenu === menu) groupMenu = null;
                    if (keyboard && !disposed && button.isConnected) button.focus({ preventScroll: true });
                });
                if (keyboard || (!event.clientX && !event.clientY)) {
                    const rect = button.getBoundingClientRect();
                    menu.showAtPosition({ x: rect.left, y: rect.bottom });
                } else menu.showAtMouseEvent(event);
            };
            button.addEventListener("contextmenu", showMenu);
            button.addEventListener("keydown", event => {
                if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) showMenu(event, true);
            });
        }
        if (open) items.forEach(render);
    }
    function addButton(header, options = {}) {
        if (!createTask) return;
        const button = header.createEl("button", { cls: "hub-panel-action hub-panel-add hub-task-add",
            attr: { type: "button", "aria-label": "Add task", title: "Add task" } });
        setIcon(button.createSpan({ cls: "hub-task-add-icon", attr: { "aria-hidden": "true" } }), "plus");
        button.createSpan({ text: "Task" });
        button.addEventListener("click", () => createTask(options));
        return button;
    }
    return { bind, reuseRow: rows.reuse, beginRender, defer, groups, group, addButton, partitionOath: oathSection.partition, renderOath: oathSection.render };
}

module.exports = { createTaskUi, createTaskRow, renderReadOnlyTask, taskSourceLabel };
