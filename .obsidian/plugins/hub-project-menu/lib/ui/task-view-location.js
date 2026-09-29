"use strict";
const { locationTree } = require("../domain/task-views");
const { button, compactRow, empty } = require("./task-view-primitives");
const { setIcon } = require("obsidian");

function renderByLocation(host, tasks, context, state) {
    const tree = locationTree(tasks, context.workspace, context.folders);
    const content = host.createDiv({ cls: "hub-task-location-tree" });
    const firstPopulated = [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name)).find(node => node.count)?.path;
    const render = (node, parent, depth) => {
        const panel = parent.createEl("section", { cls: "hub-task-location-group" });
        const open = state.expanded.has(node.path) || (!state.collapsed.has(node.path) && (!!state.search || !!state.location || firstPopulated && (node.path === firstPopulated || node.path.startsWith(firstPopulated + "/"))));
        const heading = button(panel, "", () => {
            if (open) { state.expanded.delete(node.path); state.collapsed.add(node.path); }
            else { state.expanded.add(node.path); state.collapsed.delete(node.path); }
            context.render();
        }, "hub-button-plain hub-task-location-heading");
        heading.setAttribute("aria-expanded", String(open));
        setIcon(heading.createSpan({ attr: { "aria-hidden": "true" } }), open ? "chevron-down" : "chevron-right");
        setIcon(heading.createSpan({ attr: { "aria-hidden": "true" } }), "folder");
        heading.createSpan({ cls: "hub-task-folder-name", text: node.name, attr: { title: node.name } });
        heading.createSpan({ cls: "hub-task-count", text: node.count + (node.count === 1 ? " task" : " tasks") });
        if (!open) return;
        const inner = panel.createDiv({ cls: "hub-task-location-children" });
        node.tasks.forEach(task => compactRow(inner, task, context));
        for (const child of [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
            if (state.search && !child.count) continue;
            if (state.location && !child.count && !state.location.startsWith(child.path + "/") && child.path !== state.location) continue;
            render(child, inner, depth + 1);
        }
        if (!node.count && !node.children.size) {
            empty(inner, "No tasks in this location.");
            button(inner, "Add task", () => context.create({ location: node.path }), "hub-task-column-add", "plus");
        }
    };
    tree.tasks.forEach(task => compactRow(content, task, context));
    for (const child of [...tree.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
        if ((state.search || state.location) && !child.count && !(state.location === child.path || state.location?.startsWith(child.path + "/"))) continue;
        render(child, content, 0);
    }
    if (!content.childElementCount) {
        empty(content, tasks.length ? "No tasks match these filters." : "No tasks in this workspace.");
        button(content, "Add task", () => context.create({}), "hub-task-column-add", "plus");
    }
}
module.exports = { renderByLocation };
