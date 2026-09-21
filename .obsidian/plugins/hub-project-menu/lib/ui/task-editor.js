"use strict";

function openTaskEditor(service, task, onEdit = () => {}) {
    const { Modal, Notice, setIcon } = require("obsidian");
    class TaskModal extends Modal {
        async onOpen() {
            this.closed = false;
            this.modalEl.classList.add("hub-task-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form");
            const heading = this.contentEl.createEl("h2", { cls: "hub-task-dialog-title" });
            setIcon(heading.createSpan(), "square-check"); heading.createSpan({ text: "Edit task" });
            const loading = this.contentEl.createEl("p", { text: "Loading task…" });
            try {
                this.snapshot = await service.read(task);
                if (this.closed) return;
                loading.remove(); this.render();
            } catch (error) { new Notice(error.message); this.close(); }
        }
        render() {
            const snapshot = this.snapshot;
            const form = this.contentEl.createEl("form");
            const section = (title, icon, help) => {
                const el = form.createEl("section", { cls: "hub-task-section" });
                const heading = el.createEl("h3");
                if (icon) setIcon(heading.createSpan(), icon);
                heading.createSpan({ text: title });
                if (help) el.createEl("p", { cls: "hub-task-help", text: help });
                return el;
            };
            const title = section("Task");
            const input = title.createEl("input", { type: "text", cls: "hub-task-title-input", attr: { "aria-label": "Task", required: "" } });
            input.value = snapshot.text;
            const necessity = section("Necessity", null, "Highlight this task if it is especially important. Optional.");
            const choices = necessity.createDiv({ cls: "hub-task-necessity-choices", attr: { role: "group", "aria-label": "Necessity" } });
            let selected = snapshot.necessity;
            const buttons = ["should", "must"].map(value => {
                const button = choices.createEl("button", { text: value === "should" ? "Should" : "Must",
                    cls: `hub-task-necessity-choice is-${value}`, attr: { type: "button" } });
                button.addEventListener("click", () => { selected = selected === value ? null : value; sync(); });
                return { button, value };
            });
            const clear = choices.createEl("button", { text: "Clear", cls: "hub-button-plain hub-task-clear-necessity", attr: { type: "button" } });
            const hint = necessity.createEl("p", { cls: "hub-task-help", attr: { "aria-live": "polite" } });
            const sync = () => {
                for (const { button, value } of buttons) button.setAttribute("aria-pressed", String(selected === value));
                clear.disabled = selected === null;
                hint.textContent = selected ? "Clear the classification to display this task as TO DO." : "No necessity set. This task appears as TO DO.";
            };
            clear.addEventListener("click", () => { selected = null; sync(); }); sync();
            const dates = section("Dates", "calendar-days", "Add dates if relevant. All are optional.");
            const fields = dates.createDiv({ cls: "hub-task-date-fields" });
            const dateInput = (text, key, help) => {
                const label = fields.createEl("label"); label.createSpan({ text });
                const input = label.createEl("input", { type: "date" }); input.value = snapshot[key] ?? "";
                label.createSpan({ cls: "hub-task-help", text: help });
                // Native local controls, as in Oath; a separate time permits date-only values.
                const timeKey = key.replace("Date", "Time");
                const time = label.createEl("input", { type: "time", attr: { "aria-label": text + " time (optional)" } });
                time.value = snapshot[timeKey] ?? "";
                const clearTime = label.createEl("button", { text: "Clear time", attr: { type: "button" } });
                const syncTime = () => {
                    time.disabled = !input.value;
                    if (!input.value) time.value = "";
                    clearTime.disabled = !time.value;
                };
                input.addEventListener("change", syncTime);
                time.addEventListener("input", syncTime);
                clearTime.addEventListener("click", () => { time.value = ""; syncTime(); });
                syncTime();
                input.timeInput = time;
                return input;
            };
            const from = dateInput("Start (From)", "fromDate", "Earliest date to start");
            const due = dateInput("Due", "dueDate", "Deadline for completion");
            from.addEventListener("change", () => { due.min = from.value; }); due.min = from.value;
            const steps = section("Steps", "list-checks", "Break the task into smaller actions (optional).");
            const list = steps.createDiv({ cls: "hub-task-step-list" });
            const stepRows = [];
            const addStep = step => {
                const row = list.createDiv({ cls: "hub-task-step" });
                const checkbox = row.createEl("input", { type: "checkbox", attr: { "aria-label": "Step complete" } });
                checkbox.checked = !!step.completed;
                const text = row.createEl("input", { type: "text", attr: { "aria-label": "Step text", required: "" } });
                text.value = step.text ?? "";
                const remove = row.createEl("button", { attr: { type: "button", "aria-label": "Remove step" } }); setIcon(remove, "x");
                const state = { ...step, row, checkbox, input: text, removed: false }; stepRows.push(state);
                remove.addEventListener("click", () => {
                    for (const child of stepRows) {
                        if (child === state || (state.line != null && child.line > state.line && child.line < state.end)) {
                            child.removed = true; child.row.remove();
                        }
                    }
                });
                return text;
            };
            snapshot.steps.forEach(addStep);
            const add = steps.createEl("button", { cls: "hub-task-add-step", attr: { type: "button" } });
            setIcon(add.createSpan(), "plus"); add.createSpan({ text: "Add step" });
            add.addEventListener("click", () => addStep({}).focus());
            const location = section("Location", "folder", "This task is saved in:");
            location.createDiv({ cls: "hub-task-source", text: snapshot.path.replace(/\.md$/i, "").split("/").join(" › ") });
            const errorEl = form.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = form.createDiv({ cls: "hub-task-dialog-actions" });
            const remove = actions.createEl("button", { text: "Delete task", cls: "hub-task-remove", attr: { type: "button" } });
            const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
            const save = actions.createEl("button", { text: "Save", cls: "mod-cta", attr: { type: "submit" } });
            cancel.addEventListener("click", () => this.close());
            const commit = async deleting => {
                if (this.saving) return;
                if (!deleting && !form.reportValidity()) return;
                this.saving = true; errorEl.textContent = "";
                // Disable every control while persistence is pending, including
                // Cancel/Escape, so closing cannot misleadingly cancel a save.
                const controls = [...form.querySelectorAll("button,input")];
                const states = controls.map(control => control.disabled); controls.forEach(control => control.disabled = true);
                try {
                    const edit = await service.save(snapshot, { operation: deleting ? "delete" : "edit",
                        text: input.value, necessity: selected, fromDate: from.value, dueDate: due.value,
                        fromTime: from.timeInput.value, dueTime: due.timeInput.value,
                        steps: stepRows.filter(step => !step.removed).map(step => ({ line: step.line, text: step.input.value, completed: step.checkbox.checked })) });
                    this.saving = false; onEdit(edit); this.close();
                } catch (error) {
                    this.saving = false; controls.forEach((control, i) => control.disabled = states[i]);
                    errorEl.textContent = error.message; sync();
                }
            };
            form.addEventListener("submit", event => { event.preventDefault(); void commit(false); });
            let deleteArmed = false;
            remove.addEventListener("click", () => {
                if (!deleteArmed) { deleteArmed = true; remove.textContent = "Confirm delete";
                    errorEl.textContent = snapshot.steps.length ? "Delete this task and its Steps from the note?" : "Delete this task from the note?"; return; }
                void commit(true);
            });
            input.focus(); input.setSelectionRange(input.value.length, input.value.length);
        }
        close() { if (!this.saving) super.close(); }
        onClose() { this.closed = true; this.contentEl.empty(); }
    }
    const modal = new TaskModal(service.app); modal.open(); return modal;
}

function openTaskCreator(service, options = {}) {
    const { Modal, FuzzySuggestModal, Notice } = require("obsidian");
    class Creator extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-task-dialog", "hub-task-create-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form");
            this.contentEl.createEl("h2", { text: "Add task" });
            const form = this.contentEl.createEl("form");
            const label = form.createEl("label", { cls: "hub-task-create-label", text: "Task" });
            const input = label.createEl("input", { type: "text", attr: { required: "", placeholder: "What needs doing?" } });
            const destination = form.createDiv({ cls: "hub-task-section" });
            destination.createEl("h3", { text: "Source note" });
            const files = service.app.vault.getMarkdownFiles().filter(file => !options.root || file.path.startsWith(options.root + "/"));
            const eligible = files.filter(file => {
                if (options.root) return true;
                const context = service.plugin?.projectWizard.getContextForPath(file.path);
                return context && (context.contextKind === "resource" || context.status === "active");
            });
            let file = files.find(file => file.path === options.path) ?? files.find(file => file.path === service.app.workspace.getActiveFile()?.path) ?? eligible.find(file => /\/Tasks\.md$/i.test(file.path)) ?? eligible[0] ?? files[0];
            const source = destination.createDiv({ cls: "hub-task-source" });
            const sync = () => { source.textContent = file?.path ?? "Choose a Markdown note"; };
            sync();
            const choose = destination.createEl("button", { text: "Choose note…", attr: { type: "button" } });
            choose.addEventListener("click", () => {
                class Picker extends FuzzySuggestModal {
                    getItems() { return files; }
                    getItemText(item) { return item.path; }
                    onChooseItem(item) { file = item; sync(); }
                }
                new Picker(service.app).open();
            });
            const actions = form.createDiv({ cls: "hub-task-dialog-actions" });
            const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
            const add = actions.createEl("button", { text: "Add task", cls: "mod-cta", attr: { type: "submit" } });
            cancel.addEventListener("click", () => this.close());
            form.addEventListener("submit", async event => {
                event.preventDefault(); if (this.saving || !form.reportValidity()) return;
                if (!file) { new Notice("Choose an existing Markdown note."); return; }
                this.saving = true; add.disabled = true; cancel.disabled = true;
                try { await service.create(file.path, input.value); this.saving = false; this.close(); }
                catch (error) { new Notice(error.message); this.saving = false; add.disabled = false; cancel.disabled = false; }
            });
            input.focus();
        }
        close() { if (!this.saving) super.close(); }
        onClose() { this.contentEl.empty(); }
    }
    const modal = new Creator(service.app); modal.open(); return modal;
}

module.exports = { openTaskEditor, openTaskCreator };
