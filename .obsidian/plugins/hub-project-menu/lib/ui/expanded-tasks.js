"use strict";

const { Component } = require("obsidian");
const { createTaskUi } = require("./tasks");
const { taskCard, button, empty } = require("./task-view-primitives");
const { sortTasks } = require("../domain/task-views");
const { locationBreadcrumb } = require("../domain/native-task-location");
const { taskKey } = require("../domain/oath-workspace");
const { workspaceRef } = require("../services/native-task-locations");

const { bindChoiceMenu } = require("./controls");

const viewStates = new WeakMap();
const sorts = [["suggested", "Suggested order"], ["due", "Due date"], ["necessity", "Importance"], ["task", "Name"]];
const controls = "button, input, select, [tabindex='0']";
function mountExpandedTasks({ plugin, panel, compactBody, signal, stateOwner, stateKey, workspace = null,
    readItems, availability, reader, onEdit }) {
    const app = plugin.app, doc = panel.ownerDocument;
    const component = new Component();
    component.load();
    let byScope = viewStates.get(stateOwner);
    if (!byScope) viewStates.set(stateOwner, byScope = new Map());
    if (!byScope.has(stateKey)) byScope.set(stateKey, {
        sort: "suggested", grouped: false
    });
    const state = byScope.get(stateKey);
    const locationScope = workspace ? workspaceRef(workspace) : null;
    const host = panel.createDiv({ cls: "hub-expanded-task-view", attr: { hidden: "" } });
    const bar = host.createDiv({ cls: "hub-expanded-task-controls" });
    if (!workspace) {
        const group = button(bar, "Group by workspace", () => {
            state.grouped = !state.grouped;
            group.setAttribute("aria-pressed", String(state.grouped));
            group.classList.toggle("is-active", state.grouped);
            render();
        }, "hub-panel-action");
        group.setAttribute("aria-pressed", String(state.grouped));
        group.classList.toggle("is-active", state.grouped);
    }
    const sort = bar.createEl("button", { cls: "hub-panel-action hub-task-sort", attr: {
        type: "button", "aria-label": "Sort tasks"
    } });
    const label = sort.createSpan({ text: sorts.find(([id]) => id === state.sort)[1] });
    component.register(bindChoiceMenu(sort, { options: sorts, selected: () => state.sort,
        choose: value => { state.sort = value; render(); }, label }));
    const status = host.createDiv({ cls: "hub-expanded-task-status", attr: { role: "status" } });
    const content = host.createDiv({ cls: "hub-expanded-task-content" });
    const pending = new Set();
    let active = false, disposed = false, scrollTop = 0;
    const ui = createTaskUi({ app, component, body: content, onEdit, oath: plugin.oath, plan: plugin.globalPlan,
        planRelevance: plugin.planRelevance,
        inlineOath: true, mutate: reader?.actions?.mutate, editTask: reader?.actions?.editTask,
        phaseLabel: task => plugin.planning?.phaseFor(task)?.name });

    function appendTasks(list, tasks, context) {
        const { prioritized, ordinary } = ui.partitionPlan(tasks);
        const groups = ui.groups(state.sort === "suggested" ? ordinary : tasks);
        if (state.sort === "suggested") {
            for (const task of prioritized) taskCard(list, task, context);
            for (const task of [...groups.active, ...groups.future]) taskCard(list, task, context);
        } else {
            for (const task of sortTasks([...groups.active, ...groups.future], state.sort)) taskCard(list, task, context);
        }
        for (const task of groups.completed) taskCard(list, task, context);
    }

    function render() {
        if (!active || disposed || !ui.beginRender(render)) return;
        const focused = doc.activeElement;
        const focusedRow = content.contains(focused) && focused.closest("[data-task-id]");
        const focusedIndex = focusedRow ? [...focusedRow.querySelectorAll(controls)].indexOf(focused) : -1;
        scrollTop = content.querySelector(".hub-expanded-task-list")?.scrollTop ?? scrollTop;
        const readState = availability();
        status.textContent = readState === "current" ? "" : readState === "loading" ? "Loading tasks…" : "Some tasks may be unavailable.";
        status.hidden = !status.textContent;
        const items = readItems(), owners = new Map(items.map(item => [taskKey(item.task), item.owner.name ?? item.owner.label]));
        const tasks = items.map(item => workspace && readState !== "current" ? { ...item.task, nativeReadOnly: true } : item.task);
        content.empty();
        const context = {
            ui, pending, locationScope, now: new Date(),
            render, apply: onEdit, toggleTask: (task, done) => reader.toggle(task, done),
            locationLabel: task => locationBreadcrumb(task, locationScope)?.label ?? owners.get(taskKey(task)) ?? "",
            phaseLabel: task => plugin.planning?.phaseFor(task)?.name
        };
        const list = content.createDiv({ cls: "hub-expanded-task-list hub-scrollbar" });
        if (state.grouped && !workspace) {
            const groups = new Map();
            for (const task of tasks) {
                const owner = task.nativeReference.owner;
                const key = JSON.stringify([owner.type, owner.id]);
                if (!groups.has(key)) groups.set(key, { label: owners.get(taskKey(task)) ?? owner.id, tasks: [] });
                groups.get(key).tasks.push(task);
            }
            for (const group of [...groups.values()].sort((a, b) => a.label.localeCompare(b.label))) {
                const section = list.createEl("section");
                section.createEl("h3", { text: group.label });
                appendTasks(section, group.tasks, context);
            }
        } else appendTasks(list, tasks, context);
        if (!tasks.length && readState === "current") empty(list, "No tasks.");
        list.scrollTop = scrollTop;
        if (focusedRow) {
            const replacement = [...content.querySelectorAll("[data-task-key]")].find(row => row.dataset.taskKey === focusedRow.dataset.taskKey);
            (replacement?.querySelectorAll(controls)[focusedIndex] ?? sort).focus({ preventScroll: true });
        }
    }
    function setExpanded(value) {
        if (disposed || active === value) return;
        active = value;
        compactBody.hidden = active;
        host.hidden = !active;
        if (active) render();
    }
    signal.addEventListener("abort", () => {
        disposed = true; compactBody.hidden = false; component.unload(); host.remove();
    }, { once: true });
    return { render, setExpanded, host };
}

module.exports = { mountExpandedTasks };
