"use strict";
const { Modal, FuzzySuggestModal } = require("obsidian");
const { localISODate } = require("../domain/dates");

function openPlanningEditor(service, projectId, kind, value = null, dv) {
    const phase = kind === "phases", noun = phase ? "phase" : "milestone";
    class PlanningModal extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-task-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form", "hub-planning-form");
            const state = service.read(projectId), revision = state.revision;
            this.contentEl.createEl("h2", { cls: "hub-task-dialog-title", text: (value ? "Edit " : "Add ") + noun });
            const form = this.contentEl.createEl("form");
            function section(text) { const section = form.createEl("section", { cls: "hub-task-section" }); section.createEl("h3", { text }); return section; }
            function field(host, text, type, initial) {
                const label = host.createEl("label"); label.createSpan({ text });
                const input = label.createEl("input", { type, attr: { required: "", "aria-label": text } }); input.value = initial ?? ""; return input;
            }
            const name = field(section(phase ? "Phase" : "Milestone"), "Name", "text", value?.name);
            const dates = section(phase ? "Dates" : "Date").createDiv({ cls: "hub-task-date-fields" });
            const start = field(dates, phase ? "Start" : "Date", "date", (phase ? value?.start : value?.date) ?? localISODate());
            let end, description, achieved, tasks = [], selected = new Map();
            const key = task => task.hubTaskId ?? task.path + ":" + task.line;
            if (phase) {
                end = field(dates, "End", "date", value?.end ?? start.value);
                start.addEventListener("change", () => { end.min = start.value; }); end.min = start.value;
                const label = section("Description").createEl("label");
                label.createSpan({ text: "Description (optional)", cls: "hub-task-help" });
                description = label.createEl("textarea", { attr: { rows: "3", "aria-label": "Description (optional)" } }); description.value = value?.description ?? "";
                const taskSection = section("Tasks"), list = taskSection.createDiv({ cls: "hub-phase-task-list" });
                tasks = service.tasks(dv, projectId);
                selected = new Map(tasks.filter(task => value?.id && task.phaseId === value.id).map(task => [key(task), task]));
                const renderTasks = () => {
                    list.replaceChildren();
                    if (!selected.size) list.createDiv({ cls: "hub-task-help", text: "No associated tasks." });
                    for (const [id, task] of selected) {
                        const row = list.createDiv({ cls: "hub-phase-task-item" });
                        const info = row.createDiv(); info.createDiv({ text: task.text });
                        info.createDiv({ cls: "hub-task-help", text: task.path.replace(/\.md$/i, "").split("/").slice(2).join(" › ") });
                        const remove = row.createEl("button", { text: "Remove", attr: { type: "button", "aria-label": "Remove phase from " + task.text } });
                        remove.addEventListener("click", () => { selected.delete(id); renderTasks(); });
                    }
                };
                renderTasks();
                const add = taskSection.createEl("button", { text: "Add tasks", attr: { type: "button" } });
                add.addEventListener("click", () => {
                    class TaskPicker extends FuzzySuggestModal {
                        getItems() { return tasks.filter(task => !task.identityConflict && !selected.has(key(task))); }
                        getItemText(task) { const current = state.phases.find(item => item.id === task.phaseId); return task.text + " · " + task.path + (current ? " · " + current.name : ""); }
                        onChooseItem(task) { if (!add.isConnected) return; selected.set(key(task), task); renderTasks(); }
                    }
                    new TaskPicker(service.plugin.app).open();
                });
            } else {
                const label = section("Status").createEl("label", { cls: "hub-milestone-achieved-label" });
                achieved = label.createEl("input", { type: "checkbox" }); achieved.checked = !!value?.achieved;
                label.createSpan({ text: "Achieved" });
            }
            const error = form.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = form.createDiv({ cls: "hub-task-dialog-actions" });
            const remove = actions.createEl("button", { cls: "hub-task-remove", text: "Delete " + noun, attr: { type: "button" } }); remove.hidden = !value;
            const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } }); cancel.addEventListener("click", () => this.close());
            actions.createEl("button", { text: value ? "Save" : "Add " + noun, cls: "mod-cta", attr: { type: "submit" } });
            const commit = async deleting => {
                if (this.saving || !deleting && !form.reportValidity()) return;
                this.saving = true; error.textContent = "";
                const controls = [...form.querySelectorAll("input,textarea,button")]; controls.forEach(control => { control.disabled = true; });
                try {
                    if (deleting) await service.remove(projectId, kind, value.id, revision);
                    else if (phase) {
                        const assignments = tasks.filter(task => selected.has(key(task)) !== !!(value?.id && task.phaseId === value.id))
                            .map(task => ({ task, included: selected.has(key(task)) }));
                        await service.savePhase(projectId, { id: value?.id, name: name.value, start: start.value, end: end.value, description: description.value }, assignments, revision);
                    } else await service.saveMilestone(projectId, { id: value?.id, name: name.value, date: start.value, achieved: achieved.checked }, revision);
                    this.saving = false; this.close();
                } catch (reason) { error.textContent = reason.message; this.saving = false; controls.forEach(control => { control.disabled = false; }); }
            };
            form.addEventListener("submit", event => { event.preventDefault(); void commit(false); });
            let armed = false;
            remove.addEventListener("click", () => {
                if (!armed) { armed = true; remove.textContent = "Confirm delete"; error.textContent = phase ? "Delete this phase? Its tasks will be kept with no phase." : "Delete this milestone?"; }
                else void commit(true);
            });
            name.focus();
        }
        close() { if (!this.saving) super.close(); }
        onClose() { this.contentEl.empty(); }
    }
    const modal = new PlanningModal(service.plugin.app); modal.open(); return modal;
}
module.exports = { openPlanningEditor };
