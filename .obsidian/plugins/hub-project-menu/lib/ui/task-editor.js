"use strict";
const { createWindowTitle } = require("./window-title");
const { taskFormValues } = require("../domain/task-form");
const { taskSection, mountTaskText, mountTaskFields, mountTaskRelationshipFields } = require("./task-form");

function openTaskEditor(service, task, onEdit = () => {}, creation = null) {
    const { Modal, Notice } = require("obsidian");
    class TaskModal extends Modal {
        async onOpen() {
            this.closed = false;
            this.modalEl.classList.add("hub-task-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form");
            createWindowTitle(this.contentEl, creation ? "Add task" : "Edit task", creation ? "square-plus" : "square-pen", { cls: "hub-task-dialog-title" });
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
            const state = { ...snapshot, steps: snapshot.steps.map(step => ({ ...step })) };
            const section = (title, help) => taskSection(form, title, help);
            const input = mountTaskText(section("Task"), state, () => {}, { placeholder: creation ? "What needs doing?" : "" });
            this.taskFields = mountTaskFields({ app: service.app, host: form, state, section });
            const location = section("Location");
            const owner = service.context?.(snapshot.path);
            const fieldsLocation = locationFields(service, location, snapshot, creation?.root ?? owner?.root);
            const relationships = mountTaskRelationshipFields({ host: form, state, service, location: () => fieldsLocation.value(), section });
            fieldsLocation.onChange(() => relationships.refresh());
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
                    const values = { ...state, ...relationships.value(), text: input.value,
                        operation: deleting ? "delete" : "edit", location: fieldsLocation.value() };
                    if (!deleting) Object.assign(values, taskFormValues(values));
                    if (creation) {
                        if (!values.location) throw Error("Choose a Location.");
                        await service.create(values.location, values.text, values);
                        creation.onCreated?.();
                    } else onEdit(await service.save(snapshot, values));
                    this.saving = false; this.close();
                } catch (error) {
                    this.saving = false; controls.forEach((control, i) => control.disabled = states[i]);
                    errorEl.textContent = error.message;
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
        onClose() { this.closed = true; this.taskFields?.destroy(); this.contentEl.empty(); }
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
