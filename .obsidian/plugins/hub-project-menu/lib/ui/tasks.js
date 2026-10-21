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
    const { Menu, Notice, setIcon } = require("obsidian");
    const document = body.ownerDocument;
    let active = null, deferred = null, lastRender = null, disposed = false, groupMenu = null;
    let renderNow = new Date(), refreshTimer = null, refreshAt = Infinity;
    const expanded = new Set();
    const markdown = createHubMarkdown({ app, component });
    const report = error => { console.error("Hub task action failed", error); new Notice(error.message || "Could not update task."); };
    const steps = createTaskSteps({ markdown, mutate, onEdit, report, setIcon });
    component.register(() => steps.clear());
    const presentations = new Set();
    const clearPresentations = () => { for (const item of presentations) item.destroy(); presentations.clear(); };
    component.register(clearPresentations);
    const oathSection = createOathTaskSection(oath, body, component);
    if (oath) component.register(oath.onChange(() => { if (!disposed && body.isConnected) lastRender?.(); }));

    function defer(render) {
        if (!active) return false;
        deferred = render;
        return true;
    }

    function beginRender(render) {
        if (defer(render)) return false;
        groupMenu?.hide();
        lastRender = render;
        renderNow = new Date();
        clearTimeout(refreshTimer); refreshAt = Infinity;
        const midnight = new Date(renderNow); midnight.setHours(24, 0, 0, 0);
        scheduleRefresh(midnight.getTime());
        clearPresentations();
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
        if (task.nativeReference) throw Error("Native source-position actions are unavailable.");
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
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox && !options.selection) bindCompletionSound(checkbox, playTaskCompletionSound);
        if (taskIsFuture(task, renderNow)) scheduleRefresh(taskStartDate(task).getTime());
        const presentation = mountTaskCardPresentation(row, textEl, task, getPath, { ...options,
            description: options.description ?? options.dates !== false, now: renderNow, phaseLabel });
        presentations.add(presentation);
        const info = textEl.parentElement;
        if (!options.selection && options.steps !== false) steps.bind(info, task, getPath);
        if (editTask && !(task.nativeReference && task.nativeReadOnly)) {
            textEl.tabIndex = 0; textEl.setAttribute("role", "button"); textEl.setAttribute("aria-label", `Edit task: ${task.text}`);
            const open = event => {
                if (event.target.closest("a, input, textarea, button, .home-task-location, .project-task-location")) return;
                event.preventDefault(); event.stopImmediatePropagation();
                editTask((task.nativeReference ? task : { ...task, path: getPath() }), onEdit);
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
        if (task.nativeReference && task.nativeReadOnly && checkbox) checkbox.disabled = true;
        if (options.selection || task.nativeReference && task.nativeReadOnly) return;
        row.addEventListener("contextmenu", event => {
            if (event.target.closest("textarea, input:not([type=checkbox])")) return;
            event.preventDefault(); event.stopPropagation();
            if (active) return;
            const menu = new Menu();
            for (const position of task.nativeReference ? [] : ["above", "below"]) {
                menu.addItem(item => item.setTitle(`Add task ${position}`).setIcon("list-plus")
                    .onClick(() => start(row, textEl, task, getPath(), position)));
            }
            menu.addItem(item => item.setTitle("Edit").setIcon("pencil")
                .onClick(() => editTask ? editTask((task.nativeReference ? task : { ...task, path: getPath() }), onEdit) : start(row, textEl, task, getPath(), false)));
            menu.addItem(item => item.setTitle("Delete").setIcon("trash-2").setWarning(true)
                .onClick(async () => {
                    try {
                        if (editTask) editTask((task.nativeReference ? task : { ...task, path: getPath() }), onEdit);
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
        groupMenu?.hide();
        clearTimeout(refreshTimer);
        document.removeEventListener("pointerdown", outside, true);
        deferred = null;
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
                if (active || disposed) return;
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
    return { bind, beginRender, defer, groups, group, addButton, partitionOath: oathSection.partition, renderOath: oathSection.render };
}

module.exports = { createTaskUi, createTaskRow, renderReadOnlyTask, taskSourceLabel };
