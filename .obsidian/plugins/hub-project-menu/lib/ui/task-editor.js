"use strict";
const { bindCompletionSound, playStepCompletionSound } = require("./completion-audio");

function openTaskEditor(service, task, onEdit = () => {}, creation = null) {
    const { Modal, Notice, setIcon } = require("obsidian");
    class TaskModal extends Modal {
        async onOpen() {
            this.closed = false;
            this.modalEl.classList.add("hub-task-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form");
            this.contentEl.createEl("h2", { cls: "hub-task-dialog-title", text: creation ? "Add task" : "Edit task" });
            if (creation) {
                const locations = availableLocations(service, creation.root);
                const activePath = service.app.workspace.getActiveFile()?.path;
                const location = locations.find(item => item.path === (creation.location ?? creation.path)) ??
                    locations.find(item => item.path === creation.root) ??
                    locations.find(item => item.path === activePath) ?? locations[0];
                this.snapshot = { text: "", steps: [], necessity: null, ...creation, path: location?.path ?? "" };
                this.render(); return;
            }
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
            const section = (title, help) => {
                const el = form.createEl("section", { cls: "hub-task-section" });
                el.createEl("h3", { text: title });
                if (help) el.createEl("p", { cls: "hub-task-help", text: help });
                return el;
            };
            const title = section("Task");
            const input = title.createEl("input", { type: "text", cls: "hub-task-title-input", attr: { "aria-label": "Task", required: "" } });
            input.value = snapshot.text;
            if (creation) input.placeholder = "What needs doing?";
            const necessity = section("Necessity");
            const necessityHeading = necessity.createDiv({ cls: "hub-task-necessity-heading" });
            necessityHeading.appendChild(necessity.querySelector("h3"));
            const choices = necessity.createDiv({ cls: "hub-task-necessity-choices", attr: { role: "group", "aria-label": "Necessity" } });
            let selected = snapshot.necessity;
            const buttons = ["should", "must"].map(value => {
                const button = choices.createEl("button", { text: value === "should" ? "Should do" : "Must do",
                    cls: `hub-task-necessity-choice is-${value}`, attr: { type: "button" } });
                button.addEventListener("click", () => { selected = selected === value ? null : value; sync(); });
                return { button, value };
            });
            const clear = necessityHeading.createEl("button", { text: "Clear", cls: "hub-button-plain hub-task-clear-necessity", attr: { type: "button" } });
            const sync = () => {
                for (const { button, value } of buttons) button.setAttribute("aria-pressed", String(selected === value));
                clear.disabled = selected === null;
            };
            clear.addEventListener("click", () => { selected = null; sync(); }); sync();
            const dates = section("Dates");
            const fields = dates.createDiv({ cls: "hub-task-date-fields" });
            const dateInput = (text, key) => {
                const label = fields.createEl("label"); label.createSpan({ text });
                const input = label.createEl("input", { type: "date" }); input.value = snapshot[key] ?? "";
                // Native local controls, as in Oath; a separate time permits date-only values.
                const timeKey = key.replace("Date", "Time");
                const timeRow = label.createDiv({ cls: "hub-task-time-field" });
                const time = timeRow.createEl("input", { type: "time", attr: { "aria-label": text + " time (optional)" } });
                time.value = snapshot[timeKey] ?? "";
                const clearTime = timeRow.createEl("button", { text: "Clear time", attr: { type: "button" } });
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
            const from = dateInput("Start", "fromDate");
            const due = dateInput("Due", "dueDate");
            from.addEventListener("change", () => { due.min = from.value; }); due.min = from.value;
            const steps = section("Steps", "Break the task into smaller actions (optional).");
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
                bindCompletionSound(checkbox, playStepCompletionSound);
                checkbox.addEventListener("change", () => { state.completedAt = checkbox.checked ? Date.now() : null; });
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
            const location = section("Location");
            const owner = service.context?.(snapshot.path);
            const fieldsLocation = locationFields(service, location, snapshot, creation?.root ?? owner?.root);
            const project = section("Project");
            project.querySelector("h3").append(" (optional)");
            const association = project.createEl("select", { attr: { "aria-label": "Project (optional)" } });
            association.createEl("option", { text: "No project", attr: { value: "" } });
            for (const item of service.projects?.() ?? []) association.createEl("option", { text: item.name, attr: { value: item.projectId } });
            if (snapshot.linkedProjectId && ![...association.options].some(option => option.value === snapshot.linkedProjectId)) {
                const previous = service.plugin?.projectWizard.getProjectById?.(snapshot.linkedProjectId);
                association.createEl("option", { text: previous ? previous.name + " (" + previous.status + ")" : "Unavailable project", attr: { value: snapshot.linkedProjectId } });
            }
            association.value = snapshot.linkedProjectId ?? "";
            const syncProject = () => { project.hidden = service.context?.(fieldsLocation.value())?.contextKind !== "resource"; };
            fieldsLocation.onChange(syncProject); syncProject();
            const errorEl = form.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = form.createDiv({ cls: "hub-task-dialog-actions" });
            const remove = actions.createEl("button", { text: "Delete task", cls: "hub-task-remove", attr: { type: "button" } });
            const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
            const save = actions.createEl("button", { text: creation ? "Add task" : "Save", cls: "mod-cta", attr: { type: "submit" } });
            if (creation) remove.hidden = true;
            cancel.addEventListener("click", () => this.close());
            const commit = async deleting => {
                if (this.saving) return;
                if (!deleting && !form.reportValidity()) return;
                this.saving = true; errorEl.textContent = "";
                // Disable every control while persistence is pending, including
                // Cancel/Escape, so closing cannot misleadingly cancel a save.
                const controls = [...form.querySelectorAll("button,input,select")];
                const states = controls.map(control => control.disabled); controls.forEach(control => control.disabled = true);
                try {
                    const values = { operation: deleting ? "delete" : "edit",
                        location: fieldsLocation.value(), linkedProjectId: project.hidden ? null : association.value,
                        text: input.value, necessity: selected, fromDate: from.value, dueDate: due.value,
                        fromTime: from.timeInput.value, dueTime: due.timeInput.value,
                        steps: stepRows.filter(step => !step.removed).map(step => ({ line: step.line, text: step.input.value, completed: step.checkbox.checked, completedAt: step.completedAt })) };
                    if (creation) {
                        if (!values.location) throw Error("Choose a Location.");
                        await service.create(values.location, values.text, values);
                        creation.onCreated?.();
                    } else onEdit(await service.save(snapshot, values));
                    this.saving = false; this.close();
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

function availableLocations(service, root) {
    if (service.locations) return service.locations(root);
    return service.app.vault.getMarkdownFiles().filter(file => !root || file.path.startsWith(root + "/"))
        .map(file => ({ path: file.path, file, label: file.path.replace(/\.md$/i, "").split("/").slice(-2).join(" › ") }));
}

function locationFields(service, host, snapshot, root) {
    const { FuzzySuggestModal } = require("obsidian");
    let path = snapshot.path, changed = () => {};
    const source = host.createDiv({ cls: "hub-task-source" });
    const sync = () => {
        const location = availableLocations(service, root).find(item => item.path === path);
        source.textContent = location ? location.label + (location.folder ? " · Folder" : "") : path ? path.split("/").pop().replace(/\.md$/i, "") : "Choose a Location";
    };
    sync();
    const choose = host.createEl("button", { text: "Choose location…", attr: { type: "button" } });
    choose.addEventListener("click", () => {
        class Picker extends FuzzySuggestModal {
            getItems() { return availableLocations(service, root); }
            getItemText(item) { return item.label + (item.folder ? " · Folder" : ""); }
            onChooseItem(item) { path = item.path; sync(); changed(); }
        }
        new Picker(service.app).open();
    });
    return { value: () => path, onChange: callback => { changed = callback; } };
}

function openTaskCreator(service, options = {}) {
    return openTaskEditor(service, null, () => {}, options);
}

module.exports = { openTaskEditor, openTaskCreator };
