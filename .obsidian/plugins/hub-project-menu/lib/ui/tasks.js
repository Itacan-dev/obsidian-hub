"use strict";
const { bindCompletionSound, playTaskCompletionSound } = require("./completion-audio");
const { createHubMarkdown } = require("./markdown");
const { taskGroups, taskIsOverdue, taskIsFuture, taskStartDate, taskDatePresentation } = require("../domain/task-planning");
const { createTaskSteps } = require("./task-steps");
const { createOathTaskSection } = require("./oath-tasks");

function taskSourceLabel(path) {
    const parts = String(path ?? "").replace(/\\/g, "/").split("/").filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : (parts[0]?.replace(/\.md$/i, "") || "Vault");
}

function createTaskRow(parent, task, completed = task.completed) {
    const row = parent.createDiv({ cls: "project-task-row" + (completed ? " is-completed" : "") });
    const checkbox = row.createEl("input", { type: "checkbox", cls: "project-task-checkbox" });
    checkbox.checked = !!completed;
    const info = row.createDiv({ cls: "project-task-info" });
    const textEl = info.createDiv({ cls: "project-task-text", text: task.text });
    info.createDiv({ cls: "project-task-location" });
    return { row, checkbox, info, textEl };
}

function createTaskUi({ app, component, body, mutate, onEdit, editTask, createTask, oath }) {
    const { Menu, Notice, setIcon } = require("obsidian");
    const document = body.ownerDocument;
    let active = null, deferred = null, lastRender = null, disposed = false;
    let renderNow = new Date(), refreshTimer = null, refreshAt = Infinity;
    const expanded = new Set();
    const markdown = createHubMarkdown({ app, component });
    const report = error => { console.error("Hub task action failed", error); new Notice(error.message || "Could not update task."); };
    const steps = createTaskSteps({ markdown, mutate, onEdit, report, setIcon });
    component.register(() => steps.clear());
    const oathSection = createOathTaskSection(oath, body, component);
    if (oath) component.register(oath.onChange(() => { if (!disposed && body.isConnected) lastRender?.(); }));

    function defer(render) {
        if (!active) return false;
        deferred = render;
        return true;
    }

    function beginRender(render) {
        if (defer(render)) return false;
        lastRender = render;
        renderNow = new Date();
        clearTimeout(refreshTimer); refreshAt = Infinity;
        const midnight = new Date(renderNow); midnight.setHours(24, 0, 0, 0);
        scheduleRefresh(midnight.getTime());
        markdown.clear();
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
            // Dataview tasks have a boolean `task` flag; dashboard wrappers hold an object.
            const task = item.task && typeof item.task === "object" ? item.task : item;
            scheduleRefresh(taskStartDate(task).getTime());
        }
        return grouped;
    }

    function finish(state) {
        if (active !== state) return;
        document.removeEventListener("pointerdown", outside, true);
        active = null;
        const render = deferred;
        deferred = null;
        if (!disposed) render?.();
    }

    async function commit() {
        const state = active;
        if (!state || state.saving) return;
        state.saving = true;
        // Snapshot text before any await or navigation can detach the editor.
        const value = state.input.value;
        state.input.disabled = true;
        try {
            await state.ready;
            const edit = await mutate({ ...state.request, operation: "edit", value });
            onEdit(edit);
            finish(state);
        } catch (error) {
            state.saving = false;
            state.input.disabled = false;
            if (!disposed) { report(error); state.input.focus(); }
        }
    }

    async function cancel() {
        const state = active;
        if (!state || state.saving) return;
        state.saving = true;
        try {
            await state.ready;
            if (state.created) onEdit(await mutate({ ...state.request, operation: "delete" }));
            finish(state);
        } catch (error) { state.saving = false; report(error); }
    }

    function outside(event) {
        if (active && !active.input.contains(event.target)) void commit();
    }

    async function start(row, textEl, task, path, add) {
        if (active || disposed) return;
        if (!row.isConnected) { new Notice("The task list changed. Open the task menu again."); return; }
        deferred = lastRender;
        let editorRow = row, host = textEl;
        if (add) {
            editorRow = document.createElement("div");
            editorRow.className = row.className;
            editorRow.classList.remove("is-completed");
            const checkbox = row.querySelector('input[type="checkbox"]').cloneNode();
            checkbox.checked = false;
            checkbox.disabled = true;
            editorRow.appendChild(checkbox);
            const info = document.createElement("div");
            info.className = textEl.parentElement.className;
            host = document.createElement("div");
            host.className = textEl.className;
            info.appendChild(host);
            editorRow.appendChild(info);
            if (add === "above") row.before(editorRow);
            else row.after(editorRow);
        }
        host.replaceChildren();
        editorRow.classList.add("is-task-editing");
        editorRow.querySelectorAll("button, input").forEach(control => { control.disabled = true; });
        const input = document.createElement("textarea");
        input.className = "hub-task-editor";
        input.rows = 1;
        input.value = add ? "" : task.text;
        input.placeholder = "Task text…";
        input.setAttribute("aria-label", add ? "New task text" : "Edit task text");
        host.appendChild(input);
        const resize = () => { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; };
        input.addEventListener("input", resize);
        // Preserve native links/checkbox behavior outside editing. Only the
        // inline editor consumes clicks so they cannot navigate to the note.
        input.addEventListener("click", event => event.stopPropagation());
        input.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.isComposing) return;
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void commit(); }
            else if (event.key === "Escape") { event.preventDefault(); void cancel(); }
        });
        input.addEventListener("blur", () => { if (active && !input.disabled) void commit(); });
        const state = active = { request: { ...task, path }, input, editorRow, saving: false, created: false };
        document.addEventListener("pointerdown", outside, true);
        if (add) {
            input.disabled = true;
            state.ready = mutate({ ...state.request, operation: "add", position: add, value: "" }).then(edit => {
                state.request = edit.tasks[0];
                state.created = true;
                onEdit(edit);
            });
        } else state.ready = Promise.resolve();
        try {
            await state.ready;
            if (active === state && !state.saving && !disposed) {
                input.disabled = false;
                resize(); input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        } catch (error) { report(error); finish(state); }
    }

    function bind(row, textEl, task, getPath, options = {}) {
        row.classList.add("hub-planned-task-row");
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox?.setAttribute("aria-label", `Complete task: ${task.text}`);
        if (checkbox && !options.selection) bindCompletionSound(checkbox, playTaskCompletionSound);
        if (task.necessity === "must" || task.necessity === "should") {
            const indicator = document.createElement("span");
            indicator.className = `hub-task-necessity-bar is-${task.necessity}`;
            indicator.setAttribute("role", "img");
            indicator.setAttribute("aria-label", task.necessity === "must" ? "Must do" : "Should do");
            checkbox?.before(indicator);
        }
        const info = textEl.parentElement;
        const future = taskIsFuture(task, renderNow);
        if (future) scheduleRefresh(taskStartDate(task).getTime());
        const presentation = taskDatePresentation(task, renderNow);
        if (options.dates !== false && presentation?.label) {
            const dates = document.createElement("div"); dates.className = "hub-task-dates";
            const overdue = taskIsOverdue(task, renderNow) && !task.completed && !future;
            const span = document.createElement("span"); span.className = overdue ? "is-overdue" : "";
            const value = document.createElement(presentation.dateTime ? "time" : "span");
            if (presentation.dateTime) value.dateTime = presentation.dateTime;
            value.textContent = presentation.label;
            span.appendChild(value);
            if (overdue) { span.title = "Overdue"; span.setAttribute("aria-label", presentation.label + " (overdue)"); }
            dates.appendChild(span); info.appendChild(dates);
        }
        const source = info.querySelector(".home-task-location, .project-task-location");
        if (source) source.textContent = options.sourceLabel ?? (options.selection && !options.normalSource ? getPath().replace(/\.md$/i, "").split("/").join(" › ") : taskSourceLabel(getPath()));
        if (!options.selection && options.steps !== false) steps.bind(info, task, getPath);
        if (editTask) {
            textEl.tabIndex = 0; textEl.setAttribute("role", "button"); textEl.setAttribute("aria-label", `Edit task: ${task.text}`);
            const open = event => {
                if (event.target.closest("a, input, textarea, button, .home-task-location, .project-task-location")) return;
                event.preventDefault(); event.stopImmediatePropagation();
                editTask({ ...task, path: getPath() }, onEdit);
            };
            // Checkbox, links, and buttons retain their own action.
            row.addEventListener("click", open);
            textEl.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") open(event);
            });
        }
        textEl.classList.add("hub-task-markdown");
        void markdown.render(textEl, task.text, getPath,
            () => !textEl.querySelector(".hub-task-editor"));
        if (options.selection) return;
        row.addEventListener("contextmenu", event => {
            if (event.target.closest("textarea, input:not([type=checkbox])")) return;
            event.preventDefault(); event.stopPropagation();
            if (active) return;
            const menu = new Menu();
            for (const position of ["above", "below"]) {
                menu.addItem(item => item.setTitle(`Add task ${position}`).setIcon("list-plus")
                    .onClick(() => start(row, textEl, task, getPath(), position)));
            }
            menu.addItem(item => item.setTitle("Edit").setIcon("pencil")
                .onClick(() => editTask ? editTask({ ...task, path: getPath() }, onEdit) : start(row, textEl, task, getPath(), false)));
            menu.addItem(item => item.setTitle("Delete").setIcon("trash-2").setWarning(true)
                .onClick(async () => {
                    try {
                        if (editTask) editTask({ ...task, path: getPath() }, onEdit);
                        else onEdit(await mutate({ ...task, path: getPath(), operation: "delete" }));
                    }
                    catch (error) { report(error); }
                }));
            menu.showAtMouseEvent(event);
        });
    }

    component.register(() => {
        // A view closing behaves like leaving the inline editor.
        if (active) void commit();
        disposed = true;
        clearTimeout(refreshTimer);
        document.removeEventListener("pointerdown", outside, true);
        deferred = null;
    });
    function group(kind, items, render) {
        if (!items.length) return;
        const button = body.createEl("button", { cls: "hub-task-group-toggle", attr: { type: "button" } });
        const open = expanded.has(kind);
        const chevron = button.createSpan({ cls: "hub-task-group-chevron", attr: { "aria-hidden": "true" } });
        setIcon(chevron, open ? "chevron-down" : "chevron-right");
        button.createSpan({ text: `${items.length} ${kind} ${items.length === 1 ? "task" : "tasks"}` });
        button.setAttribute("aria-expanded", String(open));
        button.addEventListener("click", () => { if (open) expanded.delete(kind); else expanded.add(kind); lastRender?.(); });
        if (open) items.forEach(render);
    }
    function addButton(header, options = {}) {
        if (!createTask) return;
        const button = header.createEl("button", { text: "+ Add task", cls: "hub-panel-action hub-task-add", attr: { type: "button" } });
        button.addEventListener("click", () => createTask(options));
    }
    return { bind, beginRender, defer, groups, group, addButton, partitionOath: oathSection.partition, renderOath: oathSection.render };
}

module.exports = { createTaskUi, createTaskRow, taskSourceLabel };
