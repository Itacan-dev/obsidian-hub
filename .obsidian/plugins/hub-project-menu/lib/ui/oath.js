"use strict";
const { createTaskUi } = require("./tasks");
const { openTaskCreator } = require("./task-editor");
const { isCommitted, validateOath, oathTime, oathProgress, shortOathTime, fulfilmentLabel, oathDuration, validDuration } = require("../domain/oath");

const taskKey = task => task.hubTaskId ?? `${task.path}:${task.line}:${task.text}`;
const dateLabel = time => new Date(time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const OATH_COPY = Object.freeze({
    start: "When will you begin your Oath?",
    work: "What will you work on?",
    duration: "How long will you commit?",
    confirmation: "Confirm your Oath",
    pledge: "“I solemnly swear that I will do the work, the whole work, and nothing but the work.”"
});
const duringOathRows = [
    ["maximize", "Obsidian remains fullscreen"],
    ["shield", "Selected work stays pinned while you remain Oathbound"],
    ["bell-off", "Your current notification settings remain in effect"]
];
function endingOathRows(draft) {
    return [
        ["circle-check", draft.tasks.length
            ? `Fulfilled after ${oathDuration(draft.durationMs)} or when all selected tasks are complete, whichever comes first.`
            : `The Oath is fulfilled after ${oathDuration(draft.durationMs)}.`],
        ["circle-alert", "Ending before fulfillment will break the Oath."],
        ["maximize", "After fulfillment, you may remain Oathbound and continue working."],
        ["chart-no-axes-column-increasing", "The result is recorded in Oath History."]
    ];
}

function oathIcon(parent, name) {
    const icon = parent.createSpan({ cls: "hub-oath-row-icon", attr: { "aria-hidden": "true" } });
    require("obsidian").setIcon(icon, name);
    return icon;
}
function oathRow(group, icon, text, label = null) {
    const row = group.createDiv({ cls: `hub-oath-review-row${label ? " has-label" : ""}` });
    oathIcon(row, icon);
    if (label) row.createEl("strong", { text: label });
    const value = row.createDiv({ cls: "hub-oath-review-value" });
    // Separate text nodes preserve numeric, short, and multiline task titles.
    for (const title of Array.isArray(text) ? text : [text]) value.createDiv({ text: title });
    return row;
}
let choiceGroupId = 0;

function openOathPicker(service, selected, onSelect) {
    const { Modal, Component } = require("obsidian");
    class Picker extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-oath-dialog", "hub-oath-picker");
            this.contentEl.classList.add("hub-button-scope");
            this.contentEl.createEl("h2", { text: "Select tasks for your Oath" });
            const search = this.contentEl.createEl("input", { type: "search", cls: "hub-oath-search", attr: { placeholder: "Search tasks…", "aria-label": "Search tasks" } });
            const body = this.contentEl.createDiv({ cls: "hub-oath-picker-tasks project-tasks-body" });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            const create = actions.createEl("button", { text: "+ Add task", cls: "hub-oath-action-start" });
            const cancel = actions.createEl("button", { text: "Cancel" });
            const add = actions.createEl("button", { cls: "mod-cta" });
            this.owner = new Component(); this.owner.load();
            const chosen = new Map(selected.map(task => [taskKey(task), task]));
            const ui = createTaskUi({ app: service.app, component: this.owner, body });
            const update = () => { add.textContent = `Add selected (${chosen.size})`; add.disabled = !chosen.size; };
            const render = () => {
                ui.beginRender(render); body.empty();
                const groups = ui.groups(service.tasks().filter(task => !task.completed && !task.identityConflict));
                const query = search.value.toLocaleLowerCase();
                const tasks = [...groups.active, ...groups.future].filter(task => `${task.text} ${task.path}`.toLocaleLowerCase().includes(query));
                for (const task of tasks) {
                    const row = body.createEl("label", { cls: "project-task-row" });
                    const checkbox = row.createEl("input", { type: "checkbox", cls: "project-task-checkbox" });
                    checkbox.checked = chosen.has(taskKey(task));
                    const info = row.createDiv({ cls: "project-task-info" });
                    const title = info.createDiv({ cls: "project-task-text" });
                    info.createDiv({ cls: "project-task-location" });
                    ui.bind(row, title, task, () => task.path, { selection: true });
                    checkbox.setAttribute("aria-label", `Select task: ${task.text}`);
                    checkbox.addEventListener("change", () => { if (checkbox.checked) chosen.set(taskKey(task), task); else chosen.delete(taskKey(task)); update(); });
                }
                if (!tasks.length) body.createEl("p", { cls: "hub-oath-muted", text: service.ready() ? "No matching incomplete tasks." : "Loading tasks…" });
            };
            create.addEventListener("click", () => openTaskCreator(service.plugin.taskEditor));
            cancel.addEventListener("click", () => this.close());
            add.addEventListener("click", () => { onSelect([...chosen.values()]); this.close(); });
            search.addEventListener("input", render);
            service.plugin.taskData.subscribe(this.owner, render);
            update(); render(); search.focus();
        }
        onClose() { this.owner?.unload(); this.contentEl.empty(); }
    }
    const modal = new Picker(service.app); modal.open(); return modal;
}

function openOathSetup(service) {
    const { Modal } = require("obsidian");
    class Setup extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-oath-dialog");
            this.contentEl.classList.add("hub-button-scope");
            this.draft = { start: "now", scheduledAt: null, durationMs: 50 * 60000, tasks: [] };
            this.choiceGroupId = ++choiceGroupId;
            this.setup();
        }
        section(title) {
            const el = this.contentEl.createEl("section", { cls: "hub-oath-section" });
            el.createEl("h3", { text: title }); return el;
        }
        choices(parent, name, choices, value, changed) {
            const group = parent.createDiv({ cls: "hub-oath-choices", attr: { role: "radiogroup", "aria-label": parent.querySelector("h3").textContent } });
            if (name === "duration") group.classList.add("hub-oath-duration-choices");
            if (name === "start") group.classList.add("hub-oath-start-choices");
            const titles = new Map(), radioName = `hub-oath-${this.choiceGroupId}-${name}`;
            for (const [key, label, help] of choices) {
                const card = group.createEl("label", { cls: "hub-oath-choice" });
                const radio = card.createEl("input", { type: "radio", attr: { name: radioName, value: key } });
                radio.checked = value === key;
                const copy = card.createSpan({ cls: "hub-oath-choice-copy" });
                const title = copy.createSpan({ text: label, cls: "hub-oath-choice-title", attr: { id: `${radioName}-${key}` } });
                radio.setAttribute("aria-labelledby", title.id);
                titles.set(key, title);
                if (help) {
                    const hint = copy.createSpan({ text: help, cls: "hub-oath-choice-help", attr: { id: `${radioName}-${key}-help` } });
                    radio.setAttribute("aria-describedby", hint.id);
                }
                radio.addEventListener("change", () => {
                    if (!radio.checked) return;
                    changed(key);
                    this.contentEl.querySelector(`input[name="${radioName}"]:checked`)?.focus();
                });
            }
            return titles;
        }
        setup() {
            const draft = this.draft; this.contentEl.empty();
            this.contentEl.classList.remove("hub-oath-review");
            this.contentEl.classList.add("hub-oath-setup");
            this.contentEl.createEl("h2", { text: "Make an Oath" });
            this.contentEl.createEl("p", { cls: "hub-oath-muted", text: "Set the terms of your commitment." });
            const start = this.section(OATH_COPY.start);
            this.choices(start, "start", [["now", "Now"], ["scheduled", "Select date and time"]], draft.start, value => { draft.start = value; this.setup(); });
            if (draft.start === "scheduled") {
                const input = start.createEl("input", { type: "datetime-local", cls: "hub-oath-start", attr: { "aria-label": "Oath start date and time" } });
                if (draft.scheduledAt) { const date = new Date(draft.scheduledAt); input.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
                input.addEventListener("change", () => draft.scheduledAt = new Date(input.value).getTime());
            }
            const work = this.section(OATH_COPY.work);
            for (const [index, task] of draft.tasks.entries()) {
                const row = work.createDiv({ cls: "hub-oath-selected" });
                oathIcon(row, "square");
                row.createSpan({ text: task.text, cls: "hub-oath-selected-title" });
                const remove = row.createEl("button", { cls: "hub-oath-remove-task hub-button-plain", attr: { type: "button", "aria-label": `Remove task: ${task.text}`, title: "Remove task" } });
                oathIcon(remove, "x");
                remove.addEventListener("click", () => { draft.tasks.splice(index, 1); this.setup(); });
            }
            const selectTask = work.createEl("button", { cls: "hub-oath-select-task" });
            const selectIcon = selectTask.createSpan({ attr: { "aria-hidden": "true" } });
            require("obsidian").setIcon(selectIcon, "plus");
            selectTask.createSpan({ text: "Select task" });
            selectTask.addEventListener("click", () => {
                this.picker = openOathPicker(service, draft.tasks, tasks => { draft.tasks = tasks; this.setup(); });
            });
            const duration = this.section(OATH_COPY.duration);
            this.choices(duration, "duration", [["25", "25 minutes"], ["50", "50 minutes"], ["90", "90 minutes"], ["custom", "Custom"]],
                this.custom ? "custom" : String(draft.durationMs / 60000), value => {
                    this.custom = value === "custom";
                    if (!this.custom) draft.durationMs = Number(value) * 60000;
                    this.setup();
                });
            if (this.custom) {
                const label = duration.createEl("label", { text: "Minutes", cls: "hub-oath-custom" });
                const input = label.createEl("input", { type: "number", attr: { min: "1", step: "1", "aria-label": "Duration in minutes" } });
                input.value = draft.durationMs ? draft.durationMs / 60000 : "";
                input.addEventListener("input", () => {
                    draft.durationMs = Number(input.value) * 60000;
                    next.disabled = !validDuration(draft.durationMs);
                });
            }
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
            const next = actions.createEl("button", { text: "Continue", cls: "mod-cta" });
            next.disabled = !validDuration(draft.durationMs);
            next.addEventListener("click", () => {
                try { validateOath(draft, service.now()); this.review(); } catch (problem) { error.textContent = problem.message; }
            });
        }
        review() {
            const draft = this.draft; this.contentEl.empty();
            this.contentEl.classList.remove("hub-oath-setup");
            this.contentEl.classList.add("hub-oath-review");
            this.contentEl.createEl("h2", { text: OATH_COPY.confirmation });
            this.contentEl.createEl("p", { text: "Review your commitment before taking the Oath.", cls: "hub-oath-muted" });
            const summary = this.section("Your Oath").createDiv({ cls: "hub-oath-row-group" });
            for (const [icon, label, value] of [
                ["clock", "Starts", draft.start === "now" ? "Now" : dateLabel(draft.scheduledAt)],
                ["file-text", "Work", draft.tasks.length ? draft.tasks.map(task => task.text) : "General work"],
                ["timer", "Commitment", oathDuration(draft.durationMs)]
            ]) {
                oathRow(summary, icon, value, label);
            }
            for (const [heading, rows] of [["During the Oath", duringOathRows], ["Ending the Oath", endingOathRows(draft)]]) {
                const group = this.section(heading).createDiv({ cls: "hub-oath-row-group" });
                for (const [icon, text] of rows) oathRow(group, icon, text);
            }
            const pledge = this.contentEl.createEl("blockquote", { cls: "hub-oath-pledge" });
            oathIcon(pledge, "landmark");
            pledge.createEl("p", { text: OATH_COPY.pledge });
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            const back = actions.createEl("button", { text: "Back" });
            const take = actions.createEl("button", { text: "Take Oath", cls: "mod-cta" });
            back.addEventListener("click", () => this.setup());
            take.addEventListener("click", async () => {
                if (this.saving) return; this.saving = true; take.disabled = back.disabled = true;
                try { await service.take(draft); this.saving = false; this.close(); }
                catch (problem) { this.saving = false; take.disabled = back.disabled = false; error.textContent = problem.message; }
            });
        }
        close() { if (!this.saving) super.close(); }
        onClose() { this.picker?.close(); this.contentEl.empty(); }
    }
    const modal = new Setup(service.app); modal.open(); return modal;
}

function openOathStatus(service) {
    const { Modal } = require("obsidian");
    class Status extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-oath-dialog", "hub-oath-status"); this.contentEl.classList.add("hub-button-scope");
            this.id = service.current.id; this.render();
            this.dispose = service.onChange(() => {
                if (!service.committed || service.current.id !== this.id) this.close(); else this.render();
            });
            this.clockDispose = service.onChange(() => this.updateClock(), true);
        }
        updateClock() {
            if (!this.clock) return;
            const oath = service.current; if (!oath || oath.id !== this.id) return;
            const time = oathTime(oath, service.now());
            this.clock.textContent = oath.state === "scheduled" ? `Starts ${dateLabel(oath.scheduledAt)}` : service.fulfilled ? `Fulfilled · ${shortOathTime(time.elapsedMs)} Oathbound` : `${shortOathTime(time.remainingMs)} remaining`;
        }
        render() {
            const oath = service.current; this.contentEl.empty();
            this.contentEl.createEl("h2", { text: oath.state === "scheduled" ? "Scheduled Oath" : "Oathbound" });
            this.clock = this.contentEl.createEl("p", { cls: "hub-oath-status-time" }); this.updateClock();
            this.contentEl.createEl("p", { text: fulfilmentLabel(oath), cls: "hub-oath-muted" });
            const work = this.contentEl.createDiv({ cls: "hub-oath-status-work" });
            for (const ref of oath.tasks) {
                const task = service.work.find(item => item.ref.id === ref.id)?.task;
                const row = work.createDiv({ cls: "hub-oath-selected" });
                row.createSpan({ text: task ? (task.completed ? "✓ " : "○ ") + task.text : ref.text + " — source unavailable" });
            }
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            const run = async fn => {
                if (this.saving) return; this.saving = true;
                try { await fn(); this.saving = false; if (!service.committed) this.close(); }
                catch (problem) { this.saving = false; error.textContent = problem.message; }
            };
            if (oath.state === "scheduled" && service.now() < oath.scheduledAt) {
                actions.createEl("button", { text: "Cancel Oath" }).addEventListener("click", () => run(() => service.end(this.id, "cancel")));
                actions.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close()); return;
            }
            actions.createEl("button", { text: "End Oath" }).addEventListener("click", () => {
                this.close(); void requestOathExit(service);
            });
            actions.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
        }
        onClose() { this.dispose?.(); this.clockDispose?.(); this.contentEl.empty(); }
    }
    const modal = new Status(service.app); modal.open(); return modal;
}

// One warning per service; incidental dismissal never calls end().
const exitUi = new WeakMap();
async function requestOathExit(service) {
    const state = exitUi.get(service) ?? { warning: null, pending: false };
    exitUi.set(service, state);
    if (state.warning) { state.warning.close(); return; }
    if (state.pending || !service.active) return;
    state.pending = true;
    const id = service.current.id;
    try {
        const decision = await service.end(id);
        if (decision !== "confirmation-required") return;
        const { Modal } = require("obsidian");
        class BreakWarning extends Modal {
            onOpen() {
                this.modalEl.classList.add("hub-oath-dialog", "hub-oath-status");
                this.contentEl.classList.add("hub-button-scope");
                this.contentEl.createEl("h2", { text: "Break your Oath?" });
                this.contentEl.createEl("p", { text: "Your Oath has not been fulfilled yet. Ending it now will break the Oath." });
                const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
                const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
                const breakOath = actions.createEl("button", { text: "Break Oath", cls: "hub-oath-break" });
                const keep = actions.createEl("button", { text: "Keep Oath", cls: "mod-cta" });
                keep.addEventListener("click", () => this.close());
                breakOath.addEventListener("click", async () => {
                    if (this.saving) return; this.saving = true; breakOath.disabled = true;
                    try { await service.end(id, "broken"); this.close(); }
                    catch (problem) { this.saving = false; breakOath.disabled = false; error.textContent = problem.message; }
                });
                this.dispose = service.onChange(() => { if (!service.active || service.fulfilled) this.close(); });
                keep.focus();
            }
            onClose() { this.dispose?.(); if (state.warning === this) state.warning = null; this.contentEl.empty(); }
        }
        state.warning = new BreakWarning(service.app); state.warning.open();
    } catch (error) { service.error(error); }
    finally { state.pending = false; }
}

function mountOathControl(plugin, service) {
    const { setIcon } = require("obsidian");
    // Reuse Obsidian's status bar, turning it into a reserved full-width footer.
    // It is outside individual leaves and survives Home/Workspace/note changes.
    const item = plugin.addStatusBarItem(); item.classList.add("hub-oath-control", "hub-button-scope");
    let bar = item.parentElement, fallback = false;
    if (!bar) { fallback = true; bar = document.createElement("div"); document.querySelector(".app-container").appendChild(bar); bar.appendChild(item); }
    bar.classList.add("hub-oath-statusbar");
    const button = item.createEl("button", { cls: "hub-oath-button", attr: { type: "button" } });
    setIcon(button.createSpan({ cls: "hub-oath-icon" }), "shield");
    const label = button.createSpan();
    let modal = null;
    const open = () => { modal?.close(); modal = service.committed ? openOathStatus(service) : openOathSetup(service); };
    button.addEventListener("click", open);
    service.fullscreen.onExitRequest?.(() => { void requestOathExit(service); });
    const update = () => {
        const oath = service.current;
        button.classList.toggle("is-active", service.active);
        button.classList.toggle("is-scheduled", oath?.state === "scheduled");
        label.textContent = !isCommitted(oath) ? "The Oath" : oath.state === "scheduled" ? "The Oath · Scheduled" : service.fulfilled ?
            `The Oath · Fulfilled · ${shortOathTime(oathTime(oath, service.now()).elapsedMs)} Oathbound` :
            `The Oath · ${shortOathTime(oathTime(oath, service.now()).remainingMs)}${oath.tasks.length ? ` · ${oathProgress(service.work).completed} / ${oath.tasks.length}` : ""}`;
    };
    const stop = service.onChange(update, true); update();
    return { open, destroy() { stop(); service.fullscreen.onExitRequest?.(() => {}); exitUi.get(service)?.warning?.close(); modal?.close(); item.remove(); bar.classList.remove("hub-oath-statusbar"); if (fallback) bar.remove(); } };
}
module.exports = { openOathPicker, openOathSetup, openOathStatus, mountOathControl, requestOathExit };
