"use strict";
const { ownModalColors, ownNoticeColors } = require("./color-system");

const { createModalHeader, layoutModal } = require("./window-title");
const { taskFormValues } = require("../domain/task-form");
const { mountLiveTaskForm } = require("./task-live-form");
const { initialComposerTaskLocation, validateTaskDates } = require("../domain/task-compact-form");
const nativeEditors = new WeakMap();

function openTaskEditor(service, task, onEdit = () => {}, creation = null) {
    const { Modal, Notice } = require("obsidian");
    const key = task?.nativeReference ? JSON.stringify([task.nativeReference.authorityId, task.nativeReference.owner, task.nativeReference.taskId]) : null;
    let editors;
    if (key) { editors = nativeEditors.get(service.app); if (!editors) nativeEditors.set(service.app, editors = new Map()); const existing = editors.get(key); if (existing && !existing.closed) return existing; }
    class TaskModal extends Modal {
        constructor(app) {
            super(app); this.closed = false;
            // Modal.open runs its first-control focus pass after onOpen. Own
            // focus here so that pass cannot move Add's caret to the checkbox.
            this.hasInitialInputFocus = false;
        }
        onOpen() { ownModalColors(this);
            this.modalEl.classList.add("hub-task-dialog", "hub-task-compact-dialog");
            this.modalEl.classList.add("hub-task-live-dialog");
            this.modalEl.setAttribute("aria-label", creation ? "Add task" : "Edit task");
            this.contentEl.classList.add("hub-button-scope", "hub-task-form", "hub-capture-form-scope", "hub-capture-content");
            createModalHeader(this.contentEl, { title: creation ? "Add task" : "Edit task",
                icon: creation ? "square-plus" : "square-pen" });
            this.render();
        }
        render() {
            const snapshot = this.snapshot, formContext = this.formContext;
            const form = this.contentEl.createEl("form");
            let errorEl;
            const clearError = () => { if (errorEl) errorEl.textContent = ""; };
            const state = { ...snapshot, steps: snapshot.steps.map(step => ({ ...step })) };
            // Legacy source destinations and native workspace locations remain
            // separate; opening a picker only changes this editor's draft.
            const location = () => formContext ? formContext.sourcePath : snapshot.file?.path ?? snapshot.path;
            state.nativeOwner ??= formContext?.nativeOwner;
            state.nativeLocation ??= formContext?.nativeLocation ?? "";
            const openLocation = () => {
                if (this.saving || !service.nativeLocations) return;
                if (this.locationPicker) { this.locationPicker.modalEl.focus(); return; }
                this.taskFields.closePopovers();
                const owner = state.nativeOwner;
                const reference = state.nativeLocation ? { type: state.nativeLocationType ?? service.nativeLocations.resolveId?.(owner, state.nativeLocation)?.type, id: state.nativeLocation } : null;
                this.locationPicker = require("./task-location-picker").openTaskLocationPicker(service.app, {
                    locations: service.nativeLocations, owner, reference, allowOwnerChange: true, taskTitle: this.taskFields.input.value,
                    onChoose: selected => { state.nativeOwner = selected.owner; state.nativeLocation = selected.reference?.id ?? ""; state.nativeLocationType = selected.reference?.type; this.taskFields.phase.refresh(); this.taskFields.refresh(); clearError(); },
                    // Native Modal restores the opener after onClose, including
                    // keyboard focus. Only release our nested-dialog reference.
                    onClose: () => { this.locationPicker = null; }
                });
            };
            this.taskFields = mountLiveTaskForm({ host: form, state, service,
                initialStepsOpen: !creation && snapshot.steps.length > 0,
                // Temporarily hide the entry point; retain recurrence state and implementation.
                showRecurrenceAction: false,
                onChange: clearError,
                text: { placeholder: creation ? "What needs doing?" : "" },
                location, presentationContext: formContext, onLocation: service.nativeLocations ? openLocation : null });
            if (formContext?.resourceLocations && !service.nativeLocations) {
                const label = form.createEl("label", { text: "Location (optional)" });
                const select = label.createEl("select", { attr: { "aria-label": "Resource task location" } });
                select.createEl("option", { value: "", text: "Resource" });
                for (const location of formContext.resourceLocations) select.createEl("option", { value: location.id, text: location.label ?? location.id });
                select.value = state.nativeLocation ?? formContext.nativeLocation ?? "";
                select.onchange = () => { state.nativeLocation = select.value; clearError(); };
            }
            const { input, phase } = this.taskFields;
            errorEl = form.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = form.createDiv({ cls: "hub-task-dialog-actions" });
            const remove = actions.createEl("button", { text: "Delete task", cls: "hub-task-remove", attr: { type: "button" } });
            const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
            const save = actions.createEl("button", { text: creation ? "Add task" : "Save", cls: "mod-cta", attr: { type: "submit" } });
            if (creation) remove.hidden = true;
            cancel.addEventListener("click", () => this.close());
            const commit = async deleting => {
                if (this.saving) return;
                this.taskFields.closePopovers();
                if (!deleting && !this.taskFields.commitPending()) return;
                if (!deleting && !form.reportValidity()) return;
                this.saving = true; errorEl.textContent = "";
                // Disable every control while persistence is pending, including
                // Cancel/Escape, so closing cannot misleadingly cancel a save.
                const controls = [...new Set([...form.querySelectorAll("button,input,select,textarea"), input, ...(this.taskFields.steps?.controls ?? [])])];
                const previews = [...form.querySelectorAll('[role="button"]')].map(element => ({ element, tabIndex: element.tabIndex }));
                previews.forEach(({ element }) => { element.tabIndex = -1; element.setAttribute("aria-disabled", "true"); });
                const states = controls.map(control => control.disabled); controls.forEach(control => control.disabled = true);
                try {
                    const values = { ...state, ...phase.value(), text: input.value,
                        operation: deleting ? "delete" : "edit", location: location() };
                    if (!deleting) { validateTaskDates(values); Object.assign(values, taskFormValues(values)); }
                    if (creation) {
                        if (!formContext && !values.location) throw Error("Explorations is unavailable. Open Add task from a valid Project or Resource destination.");
                        await service.create(formContext ? formContext.destination : values.location, values.text, values);
                        creation.onCreated?.();
                    } else onEdit(await service.save(snapshot, values));
                    this.saving = false; this.close();
                } catch (error) {
                    this.saving = false; controls.forEach((control, i) => control.disabled = states[i]);
                    previews.forEach(({ element, tabIndex }) => { element.tabIndex = tabIndex; element.removeAttribute("aria-disabled"); });
                    errorEl.textContent = error.message;
                }
            };
            form.addEventListener("submit", event => { event.preventDefault(); void commit(false); });
            let deleteArmed = false;
            remove.addEventListener("click", () => {
                if (!deleteArmed) { deleteArmed = true; remove.textContent = "Confirm delete";
                    errorEl.textContent = formContext ? (snapshot.steps.length ? "Delete this task and its Steps?" : "Delete this task?") : snapshot.steps.length ? "Delete this task and its Steps from the note?" : "Delete this task from the note?"; return; }
                void commit(true);
            });
            const body = layoutModal(this, { container: form, footer: actions });
            // Reserve the real native scrollbar outside the original content
            // width, before title measurement. Inline expansion cannot rewrap
            // the card just because the body's scrollbar becomes necessary.
            body.style.overflowY = "scroll";
            const gutter = body.offsetWidth - body.clientWidth;
            body.style.marginRight = (-5 - gutter) + "px";
            body.style.scrollbarGutter = "stable"; body.style.overflowY = "auto";
            // Region ownership and scrollbar constraints are final now. Measure
            // the styled title synchronously before Modal.open can present it.
            this.taskFields.resizeTitle();
            if (creation) { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }
            else { this.modalEl.tabIndex = -1; this.modalEl.focus({ preventScroll: true }); }
        }
        close() { if (!this.saving) { this.closed = true; super.close(); } }
        onClose() { this.closed = true; if (key && editors.get(key) === this) editors.delete(key); this.locationPicker?.close(); this.taskFields?.destroy(); this.contentEl.empty(); }
    }
    const modal = new TaskModal(service.app);
    if (key) editors.set(key, modal);
    // Obsidian appends the modal before calling onOpen and does not await it.
    // Keep the native container detached until the snapshot is available; there
    // is no intermediate modal, backdrop, focus transfer or loading geometry.
    const present = () => { if (modal.closed) return null; modal.formContext = service.formContext?.(modal.snapshot) ?? null;
        const nativePath = creation?.location ?? creation?.path ?? creation?.root;
        if (service.nativeLocations && nativePath && !Object.hasOwn(modal.snapshot, "nativeLocation")) {
            const file = service.app.vault.getAbstractFileByPath(nativePath);
            const selected = service.nativeLocations.select(service.nativeOwner, nativePath, Array.isArray(file?.children) ? "folder" : "note");
            modal.snapshot.nativeLocation = selected.reference?.id ?? ""; modal.snapshot.nativeLocationType = selected.reference?.type;
        }
        modal.open(); return modal; };
    const failed = error => { if (modal.closed) return null; modal.close(); ownNoticeColors(new Notice(error.message)); return null; };
    if (creation) {
        modal.ready = (async () => {
            try {
                const nativePath = creation.location ?? creation.path ?? creation.root;
                // A workspace root supplies scope; a note/subfolder is explicit.
                const explicitPath = nativePath && (creation.location != null || creation.path != null || nativePath !== service.context?.()?.root);
                const defaults = service.defaultCreationLocation && !Object.hasOwn(creation, "nativeLocation") && !explicitPath
                    ? await service.defaultCreationLocation() : {};
                modal.snapshot = { text: "", steps: [], necessity: null, ...defaults, ...creation, completed: false, ...(service.formContext ? {} : { path: initialComposerTaskLocation(service, creation) }) };
                return present();
            } catch (error) { return failed(error); }
        })();
    } else modal.ready = (async () => {
        try { modal.snapshot = await service.read(task); return present(); }
        catch (error) { return failed(error); }
    })();
    return modal;
}

function openTaskCreator(service, options = {}) {
    return openTaskEditor(service, null, () => {}, options);
}

module.exports = { openTaskEditor, openTaskCreator };
