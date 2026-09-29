"use strict";
const { createTaskUi, createTaskRow } = require("./tasks");
const { parseLocalISODate } = require("../domain/dates");
const { setHubTooltip } = require("./tooltips");
const { openTaskCreator } = require("./task-editor");
const { createWorkspaceCards } = require("./workspace-cards");
const { createCardImageRenderer } = require("./card-images");
const { workspaceRef, sameWorkspace, taskKey } = require("../domain/oath-workspace");
const { isCommitted, validateOath, oathTime, oathProgress, shortOathTime, fulfilmentLabel, oathDuration } = require("../domain/oath");

const dateLabel = time => new Date(time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const OATH_COPY = Object.freeze({
    start: "When will your Oath begin?",
    work: "What will you work on?",
    duration: "How long will you commit?",
    confirmation: "Review your Oath",
    pledge: "“I solemnly swear that I will do the work, the whole work, and nothing but the work.”"
});
// Obsidian aliases bare "fullscreen" to "maximize"; the Lucide ID bypasses that alias.
const duringOathRows = [
    ["lucide-fullscreen", "Itacan enters and remains in fullscreen"],
    ["shield-user", "Only whitelisted apps and websites are accessible"],
    ["bell-off", "Notifications from non-permitted apps and websites are silenced"]
];
function endingOathRows(draft) {
    return [
        ["circle-check", draft.tasks.length
            ? `Fulfilled after ${oathDuration(draft.durationMs)} or when all selected tasks are complete, whichever comes first`
            : `The Oath is fulfilled after ${oathDuration(draft.durationMs)}`],
        ["triangle-alert", "Ending before fulfillment will break the Oath"],
        ["timer-off", "After fulfillment, you may remain Oathbound and continue working"],
        ["clipboard-clock", "The result is recorded in Oath History"]
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
    if (Array.isArray(text)) {
        const list = value.createEl("ul", { cls: "hub-oath-review-tasks" });
        for (const title of text) list.createEl("li", { text: title });
    } else value.createDiv({ text });
    return row;
}
let choiceGroupId = 0;

function selectionRow(ui, body, task) {
    const parts = createTaskRow(body, task);
    parts.row.classList.add("hub-oath-task-row");
    parts.checkbox.disabled = true;
    parts.checkbox.tabIndex = -1;
    ui.bind(parts.row, parts.textEl, task, () => task.path, { selection: true, normalSource: true });
    parts.checkbox.removeAttribute("aria-label");
    parts.checkbox.removeAttribute("title");
    parts.checkbox.setAttribute("aria-hidden", "true");
    // Markdown links and the completion square are presentation only here.
    parts.row.addEventListener("click", event => {
        if (event.target.closest("a,input")) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    return parts.row;
}

function openOathWorkspacePicker(service, type, onSelect) {
    const { Modal, Component } = require("obsidian");
    class Picker extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-oath-dialog", "hub-oath-workspace-picker");
            this.contentEl.classList.add("hub-button-scope");
            this.contentEl.createEl("h2", { text: type === "project" ? "Select project" : "Select resource" });
            const search = type === "project" ? this.contentEl.createEl("input", { type: "search", cls: "hub-oath-search",
                attr: { placeholder: "Search projects...", "aria-label": "Search projects" } }) : null;
            const body = this.contentEl.createDiv({ cls: "hub-oath-workspace-grid is-" + type });
            this.owner = new Component(); this.owner.load();
            // Placement editing is intentionally unavailable in a selection modal.
            const paintImage = createCardImageRenderer(body, this.owner,
                key => ({ initial: service.plugin.projectWizard.data.headerImagePlacements?.[key] }), service.plugin.cardImageCache);
            const renderImage = (element, url, options) => paintImage(element, url, { ...options, readOnly: true });
            const cards = createWorkspaceCards({ app: service.app, root: body, component: this.owner, renderImage,
                categories: () => service.plugin.projectWizard.getCategories() });
            const render = () => {
                body.empty();
                const query = search?.value.toLocaleLowerCase().trim() ?? "";
                const positions = service.plugin.projectWizard.data.projectCardOrder?.active ?? [];
                const contexts = service.workspaces(type).filter(context => (context.name ?? context.label).toLocaleLowerCase().includes(query));
                if (type === "project") contexts.sort((a, b) =>
                    (positions.indexOf(a.projectId) < 0 ? Infinity : positions.indexOf(a.projectId)) -
                    (positions.indexOf(b.projectId) < 0 ? Infinity : positions.indexOf(b.projectId)));
                for (const context of contexts) cards.render(body, context, () => {
                    const ref = workspaceRef(context);
                    if (!service.resolveWorkspace(ref)) { render(); return; }
                    onSelect(ref); this.close();
                });
                if (!contexts.length) body.createEl("p", { cls: "hub-oath-muted", text: "No matching Active Projects." });
            };
            search?.addEventListener("input", render);
            service.plugin.taskData.subscribe(this.owner, render);
            this.contentEl.createDiv({ cls: "hub-oath-actions" }).createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
            render(); (search ?? body.querySelector('[tabindex="0"]'))?.focus();
        }
        onClose() { this.owner?.unload(); this.contentEl.empty(); }
    }
    const modal = new Picker(service.app); modal.open(); return modal;
}

function openOathPicker(service, workspace, selected, onSelect) {
    const { Modal, Component } = require("obsidian");
    class Picker extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-oath-dialog", "hub-oath-picker");
            this.contentEl.classList.add("hub-button-scope");
            this.contentEl.createEl("h2", { text: "Add tasks" });
            const search = this.contentEl.createEl("input", { type: "search", cls: "hub-oath-search", attr: { placeholder: "Search tasks...", "aria-label": "Search tasks" } });
            const body = this.contentEl.createDiv({ cls: "hub-oath-picker-tasks project-tasks-body" });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            const cancel = actions.createEl("button", { text: "Cancel" });
            const add = actions.createEl("button", { cls: "mod-cta", text: "Add tasks" });
            this.owner = new Component(); this.owner.load();
            const existing = new Set(selected.map(taskKey)), chosen = new Map();
            const ui = createTaskUi({ app: service.app, component: this.owner, body });
            const update = () => { add.disabled = !chosen.size; };
            const render = () => {
                ui.beginRender(render); body.empty();
                const available = service.workspaceTasks(workspace);
                const keys = new Set(available.map(taskKey));
                for (const key of chosen.keys()) if (!keys.has(key)) chosen.delete(key);
                const query = search.value.toLocaleLowerCase().trim();
                const groups = ui.groups(available);
                const tasks = [...groups.active, ...groups.future].filter(task => `${task.text} ${task.path}`.toLocaleLowerCase().includes(query));
                for (const task of tasks) {
                    const row = selectionRow(ui, body, task), key = taskKey(task), included = existing.has(key);
                    row.setAttribute("role", "button"); row.tabIndex = included ? -1 : 0;
                    row.setAttribute("aria-label", (included ? "Already selected: " : "Select task: ") + task.text);
                    row.setAttribute("aria-disabled", String(included));
                    const paint = () => {
                        row.classList.toggle("is-selected", included || chosen.has(key));
                        row.classList.toggle("is-already-selected", included);
                        row.setAttribute("aria-pressed", String(included || chosen.has(key)));
                    };
                    if (included) row.createSpan({ cls: "hub-oath-task-included", text: "Selected" });
                    const toggle = () => { if (included) return; if (chosen.has(key)) chosen.delete(key); else chosen.set(key, task); paint(); update(); };
                    row.addEventListener("click", toggle);
                    row.addEventListener("keydown", event => {
                        if (event.target === row && ["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(); }
                    });
                    paint();
                }
                if (!tasks.length) body.createEl("p", { cls: "hub-oath-muted", text: service.ready() ? "No matching open tasks." : "Loading tasks..." });
                update();
            };
            cancel.addEventListener("click", () => this.close());
            add.addEventListener("click", () => {
                const available = service.workspaceTasks(workspace);
                onSelect(available.filter(task => chosen.has(taskKey(task)) && !existing.has(taskKey(task))));
                this.close();
            });
            search.addEventListener("input", render);
            service.plugin.taskData.subscribe(this.owner, render);
            render(); search.focus();
        }
        onClose() { this.owner?.unload(); this.contentEl.empty(); }
    }
    const modal = new Picker(service.app); modal.open(); return modal;
}

function openOathSetup(service) {
    const { Modal, Component, Menu } = require("obsidian");
    class Setup extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-oath-dialog");
            this.contentEl.classList.add("hub-button-scope");
            this.draft = { start: "now", scheduledAt: null, durationMs: null, workspace: null, tasks: [] };
            this.selectWorkspace(workspaceRef(service.plugin.workspaceModes?.currentContext()));
            this.choiceGroupId = ++choiceGroupId;
            this.owner = new Component(); this.owner.load();
            service.plugin.taskData.subscribe(this.owner, () => {
                if (this.contentEl.classList.contains("hub-oath-setup")) this.renderSelected?.();
            });
            this.owner.register(service.onChange(() => this.updateNext?.(), true));
            this.setup();
        }
        selectWorkspace(ref) {
            if (!service.resolveWorkspace(ref) || sameWorkspace(this.draft.workspace, ref)) return;
            this.draft.workspace = ref;
            this.draft.tasks = service.workspaceTasks(ref).slice(0, 3);
            this.suggestWhenReady = !service.ready();
        }
        section(title) {
            const el = this.contentEl.createEl("section", { cls: "hub-oath-section" });
            el.createEl("h3", { text: title }); return el;
        }
        choices(parent, name, choices, value, changed) {
            const group = parent.createDiv({ cls: "hub-oath-choices", attr: { role: "radiogroup", "aria-label": parent.querySelector("h3").textContent } });
            if (name === "duration") group.classList.add("hub-oath-duration-choices");
            if (name === "start") group.classList.add("hub-oath-start-choices");
            if (name === "workspace") group.classList.add("hub-oath-workspace-choices");
            const radioName = `hub-oath-${this.choiceGroupId}-${name}`;
            for (const [key, label, help] of choices) {
                const card = group.createEl("label", { cls: "hub-oath-choice" });
                const radio = card.createEl("input", { type: "radio", attr: { name: radioName, value: key } });
                radio.checked = value === key;
                const copy = card.createSpan({ cls: "hub-oath-choice-copy" });
                const title = copy.createSpan({ text: label, cls: "hub-oath-choice-title", attr: { id: `${radioName}-${key}` } });
                radio.setAttribute("aria-labelledby", title.id);
                if (name === "workspace" && value === key) {
                    oathIcon(card, "chevrons-up-down").classList.add("hub-oath-workspace-change");
                    const tooltip = () => setHubTooltip(title, title.scrollWidth > title.clientWidth ? label : null);
                    card.addEventListener("pointerover", tooltip);
                    card.addEventListener("focusin", tooltip);
                }
                if (help) {
                    const hint = copy.createSpan({ text: help, cls: "hub-oath-choice-help", attr: { id: `${radioName}-${key}-help` } });
                    radio.setAttribute("aria-describedby", hint.id);
                }
                if (name === "workspace") radio.addEventListener("click", () => {
                    for (const input of group.querySelectorAll("input")) input.checked = input.value === this.draft.workspace?.type;
                    changed(key);
                });
                else radio.addEventListener("change", () => {
                    if (!radio.checked) return;
                    changed(key);
                    const selected = this.contentEl.querySelector(`input[name="${radioName}"]:checked`);
                    (selected?.closest(".hub-oath-choice").querySelector("[data-oath-autofocus]") ?? selected)?.focus();
                });
            }
            return group;
        }
        inlineEditor(group, key, className) {
            const radio = group.querySelector(`input[value="${key}"]`);
            const label = radio.closest(".hub-oath-choice");
            // Multiple interactive controls must not share a native label.
            const card = label.ownerDocument.createElement("div");
            card.className = label.className + " is-editor";
            card.append(...label.childNodes); label.replaceWith(card);
            card.querySelector(".hub-oath-choice-title").classList.add("hub-oath-editor-label");
            card.addEventListener("click", event => { if (event.target === card) radio.click(); });
            return card.querySelector(".hub-oath-choice-copy").createSpan({ cls: className });
        }
        customDuration() {
            const { value = "", unit = "minutes" } = this.customValue ?? {};
            return value.trim() ? Number(value) * (unit === "hours" ? 3600000 : 60000) : null;
        }
        setup() {
            const draft = this.draft; this.unitMenu?.hide(); this.taskOwner?.unload(); this.contentEl.empty();
            this.contentEl.classList.remove("hub-oath-review");
            this.contentEl.classList.add("hub-oath-setup");
            this.contentEl.createEl("h2", { text: "Make an Oath" });
            this.contentEl.createEl("p", { cls: "hub-oath-muted", text: "Set the terms of your commitment." });
            const start = this.section(OATH_COPY.start);
            const startChoices = this.choices(start, "start", [["now", "Now"], ["scheduled", "Select date and time"]], draft.start, value => { draft.start = value; this.setup(); if (value === "scheduled") this.openScheduledPicker?.(); });
            this.openScheduledPicker = null;
            if (draft.start === "scheduled") {
                const controls = this.inlineEditor(startChoices, "scheduled", "hub-oath-start");
                if (draft.scheduledAt) {
                    const date = new Date(draft.scheduledAt);
                    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
                    this.scheduledDate = local.slice(0, 10); this.scheduledTime = local.slice(11, 16);
                }
                const card = controls.closest(".hub-oath-choice");
                card.classList.add("hub-oath-scheduled-card");
                const radio = card.querySelector('input[type="radio"]');
                radio.tabIndex = -1;
                const display = controls.createSpan({ cls: "hub-oath-start-value", attr: { "aria-hidden": "true" } });
                // One native date-time picker replaces the two separate hit areas.
                // The draft still stores the same local timestamp as before.
                const input = card.createEl("input", { type: "datetime-local", cls: "hub-oath-start-input",
                    attr: { lang: "en", "aria-label": "Scheduled Oath start", "data-oath-autofocus": "" } });
                input.value = this.scheduledDate && this.scheduledTime ? `${this.scheduledDate}T${this.scheduledTime}` : "";
                const update = () => {
                    const [date = "", time = ""] = input.value.split("T");
                    this.scheduledDate = date; this.scheduledTime = time;
                    draft.scheduledAt = date && time && input.validity.valid ? new Date(input.value).getTime() : null;
                    const local = parseLocalISODate(date);
                    const label = local && time ? `${local.getDate()} ${local.toLocaleDateString("en-US", { month: "short" })} ${local.getFullYear()}, ${time}` : "Select date and time";
                    display.textContent = label;
                    input.setAttribute("aria-label", `Scheduled Oath start: ${label}`);
                    this.updateNext?.();
                };
                this.openScheduledPicker = () => {
                    card.classList.remove("is-typing"); input.focus();
                    try {
                        if (input.showPicker) input.showPicker();
                        else card.classList.add("is-typing");
                    } catch (_) { card.classList.add("is-typing"); }
                };
                input.addEventListener("click", this.openScheduledPicker);
                radio.addEventListener("click", this.openScheduledPicker);
                input.addEventListener("keydown", event => {
                    if (event.key === "Enter" || event.key === " " || (event.altKey && event.key === "ArrowDown")) {
                        event.preventDefault(); this.openScheduledPicker();
                    } else if (!["Tab", "Escape", "Shift", "Alt", "Control", "Meta"].includes(event.key)) card.classList.add("is-typing");
                });
                input.addEventListener("blur", () => card.classList.remove("is-typing"));
                input.addEventListener("input", update); input.addEventListener("change", update); update();
            }

            const work = this.section(OATH_COPY.work);
            const choose = type => {
                this.picker = openOathWorkspacePicker(service, type, ref => {
                    this.selectWorkspace(ref);
                    this.setup();
                });
            };
            const workspaceName = service.resolveWorkspace(draft.workspace)?.name ?? draft.workspace?.name;
            this.choices(work, "workspace", [
                ["project", draft.workspace?.type === "project" ? `Project: ${workspaceName}` : "Project"],
                ["resource", draft.workspace?.type === "resource" ? `Resource: ${workspaceName}` : "Resource"]
            ], draft.workspace?.type, choose);
            this.renderSelected = null;
            if (draft.workspace) {
                const heading = work.createDiv({ cls: "hub-oath-tasks-heading" });
                heading.createEl("h4", { cls: "hub-oath-suggestions-title", text: `Selected tasks from ${workspaceName}` });
                const taskAction = heading.createEl("button", { cls: "hub-panel-action hub-oath-add-tasks", attr: { type: "button" } });
                oathIcon(taskAction, "plus");
                const taskActionLabel = taskAction.createSpan();
                const body = work.createDiv({ cls: "hub-oath-selected-tasks project-tasks-body" });
                this.taskOwner = new Component(); this.taskOwner.load();
                const ui = createTaskUi({ app: service.app, component: this.taskOwner, body });
                let noOpenTasks = false;
                this.renderSelected = () => {
                    ui.beginRender(this.renderSelected); body.empty();
                    const ready = service.ready(), tasks = ready ? service.workspaceTasks(draft.workspace) : [];
                    noOpenTasks = ready && !tasks.length;
                    if (ready) {
                        if (this.suggestWhenReady) { draft.tasks = tasks.slice(0, 3); this.suggestWhenReady = false; }
                        const available = new Map(tasks.map(task => [taskKey(task), task]));
                        draft.tasks = draft.tasks.map(task => available.get(taskKey(task))).filter(Boolean);
                    }
                    for (const task of draft.tasks) {
                        const row = selectionRow(ui, body, task);
                        row.classList.add("is-selected");
                        const remove = row.createEl("button", { cls: "hub-oath-remove-task hub-button-plain",
                            attr: { type: "button", "aria-label": `Remove from Oath: ${task.text}`, title: "Remove from Oath" } });
                        oathIcon(remove, "x");
                        remove.addEventListener("click", () => {
                            draft.tasks = draft.tasks.filter(item => taskKey(item) !== taskKey(task));
                            this.renderSelected();
                            body.querySelector(".hub-oath-remove-task")?.focus();
                        });
                    }
                    if (!draft.tasks.length) body.createEl("p", { cls: "hub-oath-muted", text: !ready ? "Loading tasks..." :
                        noOpenTasks ? `${workspaceName} has no open tasks. Create a task before making an Oath, or choose another ${draft.workspace.type}.` :
                        "No tasks selected. Add at least one task to continue." });
                    taskActionLabel.textContent = noOpenTasks ? "Create task" : "Add tasks";
                    taskAction.disabled = !ready || !service.resolveWorkspace(draft.workspace);
                    this.updateNext?.();
                };
                this.renderSelected();
                taskAction.addEventListener("click", () => {
                    if (noOpenTasks) {
                        const context = service.resolveWorkspace(draft.workspace);
                        if (context) this.creator = openTaskCreator(service.plugin.taskEditor, { root: context.root });
                        return;
                    }
                    this.picker = openOathPicker(service, draft.workspace, draft.tasks, tasks => {
                        draft.tasks = [...new Map([...draft.tasks, ...tasks].map(task => [taskKey(task), task])).values()];
                        this.renderSelected();
                    });
                });
            }
            const duration = this.section(OATH_COPY.duration);
            const durationChoices = this.choices(duration, "duration", [["25", "25 minutes"], ["50", "50 minutes"], ["90", "90 minutes"], ["custom", "Custom"]],
                this.custom ? "custom" : draft.durationMs == null ? null : String(draft.durationMs / 60000), value => {
                    this.custom = value === "custom";
                    if (this.custom) {
                        this.customValue ??= { value: "", unit: "minutes" };
                        draft.durationMs = this.customDuration();
                    } else draft.durationMs = Number(value) * 60000;
                    this.setup();
                });
            if (this.custom) {
                const editor = this.inlineEditor(durationChoices, "custom", "hub-oath-custom");
                const input = editor.createEl("input", { type: "number", attr: {
                    min: "0", step: "any", "aria-label": "Custom duration", "data-oath-autofocus": ""
                } });
                input.value = this.customValue.value;
                const unit = editor.createEl("button", { cls: "hub-oath-duration-unit", attr: {
                    type: "button", "aria-haspopup": "menu", "aria-expanded": "false"
                } });
                const unitLabel = unit.createSpan(); oathIcon(unit, "chevron-down");
                const update = () => {
                    this.customValue.value = input.value;
                    draft.durationMs = this.customDuration();
                    const singular = Number(input.value) === 1;
                    unitLabel.textContent = this.customValue.unit === "hours" ? singular ? "hour" : "hours" : singular ? "minute" : "minutes";
                    unit.setAttribute("aria-label", `Duration unit: ${unitLabel.textContent}`);
                    this.updateNext?.();
                };
                const showUnits = () => {
                    this.unitMenu?.hide();
                    const menu = this.unitMenu = new Menu();
                    for (const value of ["minutes", "hours"]) menu.addItem(item => item.setTitle(value)
                        .setChecked(this.customValue.unit === value).onClick(() => {
                            this.customValue.unit = value; update();
                        }));
                    menu.onHide(() => {
                        if (this.unitMenu === menu) this.unitMenu = null;
                        unit.setAttribute("aria-expanded", "false");
                        if (unit.isConnected) unit.focus();
                    });
                    unit.setAttribute("aria-expanded", "true");
                    const rect = unit.getBoundingClientRect();
                    menu.showAtPosition({ x: rect.left, y: rect.bottom });
                };
                unit.addEventListener("click", showUnits);
                unit.addEventListener("keydown", event => {
                    if (event.key === "ArrowDown") { event.preventDefault(); showUnits(); }
                });
                input.addEventListener("input", update); update();
            }
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
            const next = actions.createEl("button", { text: "Review Oath", cls: "mod-cta" });
            this.updateNext = () => {
                try { validateOath(draft, service.now()); next.disabled = !service.ready() || !service.resolveWorkspace(draft.workspace); }
                catch (_) { next.disabled = true; }
            };
            this.updateNext();
            next.addEventListener("click", () => {
                try { this.review(); } catch (problem) { error.textContent = problem.message; }
            });
        }
        review() {
            const draft = this.draft;
            service.validateDraft(draft);
            this.taskOwner?.unload(); this.updateNext = null;
            this.contentEl.empty();
            this.contentEl.classList.remove("hub-oath-setup");
            this.contentEl.classList.add("hub-oath-review");
            this.contentEl.createEl("h2", { text: OATH_COPY.confirmation });
            this.contentEl.createEl("p", { text: "Review the terms of your commitment before taking the Oath.", cls: "hub-oath-muted" });
            const summary = this.section("Your Oath").createDiv({ cls: "hub-oath-row-group" });
            for (const [icon, label, value] of [
                ["clock", "Start time", draft.start === "now" ? "Now" : dateLabel(draft.scheduledAt)],
                [draft.workspace.type === "resource" ? "library" : "folder", draft.workspace.type === "resource" ? "Selected resource" : "Selected project",
                    service.resolveWorkspace(draft.workspace).name],
                ["list-todo", "Selected tasks", draft.tasks.map(task => task.text)],
                ["timer", "Duration", oathDuration(draft.durationMs)]
            ]) {
                oathRow(summary, icon, value, label);
            }
            for (const [heading, rows] of [["During the Oath", duringOathRows], ["Ending the Oath", endingOathRows(draft)]]) {
                const group = this.section(heading).createDiv({ cls: "hub-oath-row-group" });
                for (const [icon, text] of rows) oathRow(group, icon, text);
            }
            const pledge = this.contentEl.createEl("blockquote", { cls: "hub-oath-pledge" });
            oathIcon(pledge, "scroll-text");
            pledge.createEl("p", { text: OATH_COPY.pledge });
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-oath-actions" });
            const back = actions.createEl("button", { text: "Back" });
            const take = actions.createEl("button", { text: "Take the Oath", cls: "mod-cta" });
            back.addEventListener("click", () => this.setup());
            take.addEventListener("click", async () => {
                if (this.saving) return; this.saving = true; take.disabled = back.disabled = true;
                try { await service.take(draft); this.saving = false; this.close(); }
                catch (problem) { this.saving = false; take.disabled = back.disabled = false; error.textContent = problem.message; }
            });
        }
        close() { if (!this.saving) super.close(); }
        onClose() { this.unitMenu?.hide(); this.picker?.close(); this.creator?.close(); this.taskOwner?.unload(); this.owner?.unload(); this.contentEl.empty(); }
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
    return { item, open, destroy() { stop(); service.fullscreen.onExitRequest?.(() => {}); exitUi.get(service)?.warning?.close(); modal?.close(); item.remove(); bar.classList.remove("hub-oath-statusbar"); if (fallback) bar.remove(); } };
}
module.exports = { openOathPicker, openOathSetup, openOathStatus, mountOathControl, requestOathExit };
