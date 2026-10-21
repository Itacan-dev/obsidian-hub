"use strict";
const { hasKeyboardFocus, focusAfterRowRemoval } = require("./focus-restoration");
const { createWindowTitle, setWindowUndertext, layoutModal } = require("./window-title");
const { Modal, FuzzySuggestModal, Component } = require("obsidian");
const { PhaseTaskRead, taskKey } = require("../services/phase-task-read");
const { localISODate } = require("../domain/dates");

function openPlanningEditor(service, projectId, kind, value = null, dv, defaults = {}) {
    const phase = kind === "phases", noun = phase ? "phase" : "milestone";
    class PlanningModal extends Modal {
        onOpen() {
            this.closed = false;
            this.modalEl.classList.add("hub-task-dialog");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form", "hub-planning-form");
            const state = service.read(projectId), revision = state.revision;
            const heading = createWindowTitle(this.contentEl, (value ? "Edit " : "Add ") + noun, phase ? "layers" : "flag", { cls: "hub-task-dialog-title" });
            setWindowUndertext(heading, this.contentEl.createEl("p", { cls: "hub-oath-muted",
                text: phase ? "Organise a stage of your project's roadmap" : "Set a key date in your project's roadmap" }));
            const form = this.contentEl.createEl("form");
            function section(text) { const section = form.createEl("section", { cls: "hub-task-section" }); section.createEl("h3", { text }); return section; }
            function field(host, text, type, initial) {
                const label = host.createEl("label"); label.createSpan({ text });
                const input = label.createEl("input", { type, attr: { required: "", "aria-label": text } }); input.value = initial ?? ""; return input;
            }
            const name = field(section(phase ? "Phase" : "Milestone"), "Title", "text", value?.name);
            const dates = section(phase ? "Dates" : "Date").createDiv({ cls: "hub-task-date-fields" });
            const start = field(dates, phase ? "Start" : "Date", "date", (phase ? value?.start ?? defaults.start : value?.date ?? defaults.date) ?? localISODate());
            let end, description, achieved, draft;
            if (phase) {
                end = field(dates, "End", "date", value?.end ?? start.value);
                start.addEventListener("change", () => { end.min = start.value; }); end.min = start.value;
                const label = section("Description").createEl("label");
                label.createSpan({ text: "Description (optional)", cls: "hub-capture-label" });
                description = label.createEl("textarea", { attr: { rows: "3", "aria-label": "Description (optional)" } }); description.value = value?.description ?? "";
                const taskSection = section("Tasks"), list = taskSection.createDiv({ cls: "hub-phase-task-list" });
                this.readComponent = new Component();
                let picker = null, pickerFrame = null, pickerState = state, pickerSnapshot = null;
                const rows = new Map();
                const renderTasks = () => {
                    for (const [id, row] of rows) if (!draft.selected.has(id)) { row.remove(); rows.delete(id); }
                    list.querySelector("[data-phase-empty]")?.remove();
                    if (!draft.selected.size) list.createDiv({ cls: "hub-task-help", text: "No associated tasks.", attr: { "data-phase-empty": "" } });
                    for (const [id, task] of draft.selected) {
                        let existing = rows.get(id);
                        if (existing) {
                            existing.firstChild.firstChild.textContent = task.text;
                            existing.firstChild.children[1].textContent = task.path ? task.path.replace(/\.md$/i, "").split("/").slice(2).join(" › ") : "Source unavailable";
                            existing.querySelector("button").setAttribute("aria-label", "Remove phase from " + task.text);
                            existing.querySelector("[data-phase-unavailable]")?.remove();
                            if (!draft.usable(task)) existing.firstChild.createDiv({ cls: "hub-task-help", text: "Source changed or unavailable", attr: { "data-phase-unavailable": "" } });
                            continue;
                        }
                        const row = list.createDiv({ cls: "hub-phase-task-item" });
                        rows.set(id, row);
                        const info = row.createDiv(); info.createDiv({ text: task.text });
                        info.createDiv({ cls: "hub-task-help", text: task.path ? task.path.replace(/\.md$/i, "").split("/").slice(2).join(" › ") : "Source unavailable" });
                        if (!draft.usable(task)) info.createDiv({ cls: "hub-task-help", text: "Source changed or unavailable", attr: { "data-phase-unavailable": "" } });
                        const remove = row.createEl("button", { text: "Remove", attr: { type: "button", "aria-label": "Remove phase from " + task.text } });
                        remove.addEventListener("click", event => {
                            const restoreFocus = hasKeyboardFocus(remove, event), index = [...draft.selected.keys()].indexOf(id);
                            draft.remove(id); renderTasks();
                            if (restoreFocus) focusAfterRowRemoval([...list.querySelectorAll(".hub-phase-task-item button")], index, add);
                        });
                    }
                    const order = [...draft.selected.keys()].map(id => rows.get(id));
                    if (order.some((row, index) => list.children[index] !== row)) {
                        const focused = list.ownerDocument.activeElement;
                        for (const row of order) list.appendChild(row);
                        if (list.contains(focused)) focused.focus({ preventScroll: true });
                    }
                };
                const add = taskSection.createEl("button", { text: "Add tasks", attr: { type: "button" } });
                const refresh = async () => {
                    if (this.closed || this.saving) return;
                    try {
                        const result = await draft.refresh();
                        if (!result || this.closed || this.saving) return;
                        pickerState = service.read(projectId); readStatus.remove(); add.disabled = false; renderTasks();
                        if (picker?.inputEl?.isConnected) {
                            const currentPicker = picker;
                            const saved = pickerSnapshot?.picker === picker ? pickerSnapshot : null;
                            currentPicker.inputEl.dispatchEvent(new currentPicker.inputEl.ownerDocument.defaultView.Event("input", { bubbles: true }));
                            if (pickerFrame !== null) cancelAnimationFrame(pickerFrame);
                            pickerFrame = requestAnimationFrame(() => {
                                pickerFrame = null; if (this.closed || picker !== currentPicker) return;
                                const index = saved?.query === currentPicker.inputEl.value ? currentPicker.getSuggestions(currentPicker.inputEl.value).findIndex(item => taskKey(item.item) === saved.id) : -1;
                                if (index >= 0) currentPicker.chooser?.setSelectedItem?.(index, false);
                                if (currentPicker.resultContainerEl && saved) currentPicker.resultContainerEl.scrollTop = saved.scroll;
                            });
                        }
                    } catch (_) {
                        if (this.closed || this.saving) return;
                        readStatus.textContent = "Tasks are temporarily unavailable. Your selection has been kept.";
                        if (!readStatus.isConnected) taskSection.insertBefore(readStatus, add);
                        renderTasks();
                    }
                };
                draft = this.phaseRead = new PhaseTaskRead(service, projectId, value?.id ?? null, () => { void refresh(); });
                draft.onPluginClose = () => this.close();
                draft.beforePublish = () => {
                    pickerSnapshot = null;
                    if (!picker?.inputEl?.isConnected) return;
                    const items = picker.getSuggestions(picker.inputEl.value), index = picker.chooser?.selectedItem;
                    pickerSnapshot = { picker, query: picker.inputEl.value, id: items[index]?.item && taskKey(items[index].item), scroll: picker.resultContainerEl?.scrollTop ?? 0 };
                };
                const readStatus = taskSection.createDiv({ cls: "hub-task-help", text: "Loading tasks…", attr: { role: "status" } });
                taskSection.insertBefore(readStatus, add); add.disabled = true; renderTasks();
                service.subscribe(this.readComponent, id => { if (id === projectId && !this.saving) { pickerState = service.read(projectId); void refresh(); } });
                this.readComponent.register(() => { picker?.close(); if (pickerFrame !== null) cancelAnimationFrame(pickerFrame); });
                this.ready = refresh();
                this.refreshPhaseTasks = refresh;
                add.addEventListener("click", () => {
                    class TaskPicker extends FuzzySuggestModal {
                        getItems() { return draft.pickerItems(); }
                        getItemText(task) { const current = pickerState.phases.find(item => item.id === task.phaseId); return task.text + " · " + task.path + (current ? " · " + current.name : ""); }
                        onChooseItem(task) {
                            if (!add.isConnected) return;
                            if (draft.add(task)) renderTasks();
                            else { readStatus.textContent = "This task changed. Open the picker and select it again."; if (!readStatus.isConnected) taskSection.insertBefore(readStatus, add); }
                        }
                        onClose() { if (picker === this) picker = null; super.onClose?.(); }
                    }
                    picker = new TaskPicker(service.plugin.app); picker.open();
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
                draft?.freeze();
                const controls = [...form.querySelectorAll("input,textarea,button")], disabled = controls.map(control => control.disabled); controls.forEach(control => { control.disabled = true; });
                try {
                    if (deleting) await service.remove(projectId, kind, value.id, revision);
                    else if (phase) {
                        const assignments = await draft.assignments();
                        await service.savePhase(projectId, { id: value?.id, name: name.value, start: start.value, end: end.value, description: description.value }, assignments, revision);
                    } else await service.saveMilestone(projectId, { id: value?.id, name: name.value, date: start.value, achieved: achieved.checked }, revision);
                    this.saving = false; this.close();
                } catch (reason) { error.textContent = reason.message; this.saving = false; controls.forEach((control, index) => { control.disabled = disabled[index]; }); draft?.resume(); void this.refreshPhaseTasks?.(); }
            };
            form.addEventListener("submit", event => { event.preventDefault(); void commit(false); });
            let armed = false;
            remove.addEventListener("click", () => {
                if (!armed) { armed = true; remove.textContent = "Confirm delete"; error.textContent = phase ? "Delete this phase? Its tasks will be kept with no phase." : "Delete this milestone?"; }
                else void commit(true);
            });
            layoutModal(this, { container: form, footer: actions });
            name.focus();
        }
        close() { if (!this.saving) super.close(); }
        onClose() { this.closed = true; this.phaseRead?.close(); this.readComponent?.unload(); this.contentEl.empty(); }
    }
    const modal = new PlanningModal(service.plugin.app); modal.open(); return modal;
}
module.exports = { openPlanningEditor };
