"use strict";
const { setHubIcon } = require("./icons");
const { projectItemPath } = require("../domain/files");
const { openCaptureWorkspacePicker, openCaptureLocationPicker } = require("./capture-pickers");
const { mountWorkspaceThumbnail } = require("./workspace-thumbnail");
const { createCapturePickerTrigger } = require("./capture-picker-trigger");
const { openNotePositionPicker } = require("./note-position-picker");
const { noteLocation, noteLocationSummary, resolveNoteLocation } = require("../domain/note-insertion");

const MODES = [["task", "Task", "square"], ["note", "Note", "notebook-text"]];
function mountCaptureTypeControl({ host, selectedType = null, disabledTypes = [], onSelect, file = false }) {
    return mountChoices({ host, label: "Type", options: file ? [["file", "File", "file"]] : MODES, selected: selectedType, disabled: disabledTypes, onSelect, cls: "hub-capture-types" });
}
function mountChoices({ host, label, options, selected, disabled = [], onSelect, cls }) {
    const field = host.createDiv({ cls: "hub-capture-field", attr: { "data-capture-field": label } });
    field.createSpan({ cls: "hub-capture-field-title", text: label });
    const types = field.createDiv({ cls: "hub-capture-choices hub-equal-selectors hub-option-group " + cls, attr: { role: "group", "aria-label": label } });
    for (const [type, title, icon] of options) {
        const button = types.createEl("button", { cls: "hub-capture-type" + (selected === type ? " is-active" : ""), attr: {
            type: "button", "aria-label": title, "aria-pressed": String(selected === type)
        } });
        button.disabled = disabled.includes(type);
        const graphic = button.createSpan({ attr: { "aria-hidden": "true" } });
        if (icon === "notebook-plus") {
            graphic.classList.add("hub-capture-notebook-plus");
            setHubIcon(graphic.createSpan(), "notebook");
            setHubIcon(graphic.createSpan({ cls: "hub-capture-notebook-plus-mark" }), "plus");
        } else setHubIcon(graphic, icon);
        button.createSpan({ text: title });
        button.addEventListener("click", () => onSelect(type));
    }
    return types;
}
const firstLine = text => String(text ?? "").split(/\r?\n/).find(line => line.trim())?.trim() ?? "";
function noteTitle(draft) {
    const proposed = firstLine(draft.text) || String(draft.attachments?.[0]?.name ?? "").replace(/\.[^./\\]+$/, "");
    const title = proposed.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120).replace(/[. ]+$/, "") || "Untitled";
    projectItemPath("", "note", title);
    return title;
}

// Both overlays retain their content and attachment controls. A fixed Inbox
// form owns one type at a time; Inbox can confirm and remount a different type.
function mountCaptureForm({ host, service, draft = {}, onChange = () => {}, onSubmit = () => {}, fixedType = null, captureId = () => null }) {
    const element = host.createDiv({ cls: "hub-capture-form hub-task-form" });
    const lockedType = ["task", "note", "file"].includes(fixedType) ? fixedType : null;
    let state = { ...draft, ...(lockedType ? { type: lockedType } : {}), steps: (draft.steps ?? []).map(step => ({ ...step })) };
    let disposed = false, picker = null, checkingNote = null, taskFields = null;
    const disposers = [];
    const destinations = () => service.destinations();
    const workspace = () => destinations().find(item => item.id === state.workspaceId);
    const locations = () => {
        const current = workspace(); if (!current) return [];
        return state.type === "note" ? (service.noteLocations?.(state.workspaceId) ?? service.taskLocations(state.workspaceId)) : service.taskLocations(state.workspaceId);
    };
    const folders = () => {
        const current = workspace(); if (!current) return [];
        return service.folders(state.workspaceId);
    };
    const notify = () => { if (!disposed) onChange(value()); };
    const initializeTitle = () => {
        if (state.type === "note") {
            state.noteAction = state.noteAction === "existing" ? "existing" : "new";
            if (state.title == null) state.title = noteTitle(state);
        }
    };
    // Preserve unavailable saved choices; submission validates them and the
    // existing pickers let the user explicitly choose a replacement.
    const clearInvalidDestinations = () => {};

    const group = title => {
        const section = element.createEl("section", { cls: "hub-capture-form-group" });
        if (title) section.createEl("h3", { cls: "hub-capture-section-heading", text: title });
        return section;
    };
    const fieldHost = (parent, label) => {
        const wrap = parent.createDiv({ cls: "hub-capture-field", attr: { "data-capture-field": label === "Save to" ? "Workspace" : label } });
        wrap.createSpan({ cls: "hub-capture-field-title", text: label }); return wrap;
    };
    const field = (parent, label, type, key, required = false) => {
        const wrap = parent.createEl("label", { cls: "hub-capture-field", attr: { "data-capture-field": label } });
        wrap.createSpan({ cls: "hub-capture-field-title", text: label });
        const input = wrap.createEl("input", { type, attr: { "aria-label": label, ...(required ? { required: "" } : {}) } });
        input.value = state[key] ?? "";
        input.addEventListener("input", () => { state[key] = input.value; notify(); }); return input;
    };
    const pickerTrigger = (parent, label, title, subtitle, icon, open, disabled = false, imageWorkspace = null) => {
        return createCapturePickerTrigger(fieldHost(parent, label), {
            label, title, subtitle, icon, disabled,
            renderIcon: imageWorkspace ? button => mountWorkspaceThumbnail(button, service.plugin, imageWorkspace) : null,
            onOpen: () => { if (!picker && !disposed) open(); }
        }).button;
    };
    const restorePickerFocus = label => {
        picker = null;
        if (!disposed) [...element.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === label)?.focus({ preventScroll: true });
    };
    function workspaceControl() {
        const current = workspace();
        const category = current?.contextKind === "project" ? service.plugin.projectWizard.getCategories?.().find(item => item.id === current.categoryId || item.name === current.categoryId) : null;
        return { title: current?.name ?? "Choose project or resource…",
            subtitle: current ? (current.contextKind === "resource" ? "Resource" : category?.name ? "Project · " + category.name : "Project") : null,
            icon: current?.contextKind === "resource" ? current.icon ?? "library" : "folder",
            renderIcon: current ? button => mountWorkspaceThumbnail(button, service.plugin, current) : null,
            onOpen: () => {
                if (picker || disposed) return;
                picker = openCaptureWorkspacePicker(service, {
                    selectedId: state.workspaceId,
                    onSelect: selected => {
                        if (disposed) return;
                        if (selected.id !== state.workspaceId) { state.folder = selected.root; state.location = ""; state.noteLocation = null; }
                        state.workspaceId = selected.id; render(); notify();
                    },
                    restoreFocus: () => restorePickerFocus("Save to")
                });
            } };
    }
    function workspaceField(parent) {
        createCapturePickerTrigger(fieldHost(parent, "Save to"), { ...workspaceControl(), label: "Save to" });
    }
    function locationControl(task) {
        const label = task ? "Location" : "Destination folder", current = workspace();
        const items = task ? locations() : folders(), path = state[task ? "location" : "folder"];
        const selected = items.find(item => item.path === path);
        return { label, title: selected?.label ?? selected?.name ?? (task ? "Choose a note or folder…" : "Choose a folder…"),
            subtitle: !selected && path ? "Saved destination unavailable: " + path : selected && task ? selected.folder ? "Folder · Tasks note" : "Markdown note · " + selected.path.split("/").pop() : null,
            icon: selected && task && !selected.folder ? "notebook-text" : "folder", disabled: !current,
            onOpen: () => {
                if (picker || disposed) return;
                picker = openCaptureLocationPicker(service, {
                    workspace: current, task, selectedPath: path, getItems: task ? locations : folders,
                    onSelect: selected => { if (!disposed) { state[task ? "location" : "folder"] = selected.path; render(); notify(); } },
                    restoreFocus: () => restorePickerFocus(label)
                });
            } };
    }
    function locationField(parent, task) {
        createCapturePickerTrigger(fieldHost(parent, task ? "Location" : "Folder"), locationControl(task));
    }
    function renderTask() {
        taskFields=require("./native-capture-task").mountNativeCaptureTask({host:element,service,draft:state,captureId,details:true,onSubmit,onChange:value=>{state=value;notify()}});
    }
    function existingNoteField(parent) {
        const current = workspace();
        pickerTrigger(parent, "Location", noteLocationSummary(state.noteLocation), null, "notebook-text", () => {
            picker = openNotePositionPicker(service, { workspace: current, selectedLocation: state.noteLocation,
                onSelect: selected => { if (!disposed) { state.noteLocation = selected; render(); notify(); } },
                restoreFocus: () => restorePickerFocus("Location") });
        }, !current);
    }
    function checkNoteLocation() {
        const location = noteLocation(state.noteLocation);
        if (!location || state.noteAction !== "existing" || checkingNote || service.noteCache.has(location.path) ||
            service.get(captureId())?.operation?.kind === "note-insertion" || element.closest("[aria-busy=true]")) return;
        const id = state.workspaceId;
        checkingNote = service.readNotePositions(id, location.path).then(parsed => {
            if (disposed || element.closest("[aria-busy=true]") || service.get(captureId())?.operation?.kind === "note-insertion" ||
                id !== state.workspaceId || JSON.stringify(location) !== JSON.stringify(state.noteLocation)) return;
            if (!resolveNoteLocation(parsed, location)) state.noteLocationUnavailable = true;
        }).catch(() => {
            if (!disposed && !element.closest("[aria-busy=true]") && service.get(captureId())?.operation?.kind !== "note-insertion" &&
                id === state.workspaceId && JSON.stringify(location) === JSON.stringify(state.noteLocation)) state.noteLocationUnavailable = true;
        }).finally(() => {
            checkingNote = null;
            if (!disposed && !element.closest("[aria-busy=true]")) refresh();
        });
    }
    function render() {
        taskFields?.destroy(); taskFields = null;
        initializeTitle(); if(state.type!=="task" && state.workspaceId && !state.folder) state.folder=workspace()?.root??""; clearInvalidDestinations(); element.replaceChildren();
        const placement = group();
        if (!lockedType && state.inputPath !== "file" && !state.attachments?.length) {
            mountCaptureTypeControl({ host: placement, selectedType: state.type, onSelect: type => {
                state.type = type; render(); notify(); element.querySelector("button[aria-pressed=true]")?.focus();
            } });
        }
        if (!state.type) return;
        if (state.type === "note") mountChoices({ host: placement, label: "Action", cls: "hub-capture-note-actions", selected: state.noteAction,
            disabled: state.attachments?.length ? ["existing"] : [],
            options: [["new", "New note", "notebook-plus"], ["existing", "Add text to existing note", "notebook-pen"]],
            onSelect: action => { state.noteAction = action; render(); notify();
                element.querySelector(".hub-capture-note-actions button[aria-pressed=true]")?.focus(); } });
        if (state.type === "task") renderTask();
        else {
            workspaceField(placement);
            if (state.type === "note" && state.noteAction === "existing") { existingNoteField(placement); checkNoteLocation(); }
            else {
                locationField(placement, false);
                if (state.type === "note") {
                    const title = field(placement, "Title", "text", "title", true); title.classList.add("hub-task-title-input");
                    title.setAttribute("aria-label", "Note title");
                }
            }
        }
    }
    function value() { if(state.type === "task" && taskFields?.value) return taskFields.value(); return { ...state, attachments: [...(state.attachments ?? [])], steps: state.steps.map(step => ({ ...step })) }; }
    function valid() {
        return service.completion(value(), captureId()).complete;
    }
    const refresh = () => {
        if (disposed) return;
        if (!element.closest("[aria-busy=true]")) {
            const active = element.ownerDocument.activeElement, label = element.contains(active) ? active.getAttribute("aria-label") : null;
            const index = label ? [...element.querySelectorAll("button,input,select")].filter(input => input.getAttribute("aria-label") === label).indexOf(active) : -1;
            const selection = active && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
            render();
            const target = index >= 0 ? [...element.querySelectorAll("button,input,select")].filter(input => input.getAttribute("aria-label") === label)[index] : null;
            target?.focus({ preventScroll: true }); if (target && selection && target.type === "text") target.setSelectionRange(...selection);
        }
        notify();
    };
    const listen = (emitter, event) => {
        if (!emitter?.on || !emitter.offref) return;
        const reference = emitter.on(event, refresh); disposers.push(() => emitter.offref(reference));
    };
    render();
    for (const event of ["create", "delete", "rename"]) listen(service.plugin.app.vault, event);
    if (service.plugin.app.vault.on && service.plugin.app.vault.offref) {
        const reference = service.plugin.app.vault.on("modify", file => { if (file.path === state.noteLocation?.path) refresh(); });
        disposers.push(() => service.plugin.app.vault.offref(reference));
    }
    listen(service.plugin.app.metadataCache, "changed");
    service.plugin.planning?.subscribe?.({ register: dispose => disposers.push(dispose) }, refresh);
    return {
        value, valid, refresh, prepare: () => taskFields?.prepare?.() !== false,
        update(patch) {
            const layoutChanged = (!lockedType && patch.type !== undefined && patch.type !== state.type) ||
                (patch.workspaceId !== undefined && patch.workspaceId !== state.workspaceId) ||
                (patch.noteAction !== undefined && patch.noteAction !== state.noteAction) || patch.noteLocation !== undefined ||
                (patch.location !== undefined && patch.location !== state.location) || patch.phaseId !== undefined ||
                (patch.inputPath !== undefined && patch.inputPath !== state.inputPath);
            if (patch.workspaceId !== undefined && patch.workspaceId !== state.workspaceId) {
                state.folder = destinations().find(w=>w.id===patch.workspaceId)?.root ?? ""; state.location = ""; state.noteLocation = null;
            }
            Object.assign(state, patch, lockedType ? { type: lockedType } : {});
            if (patch.steps) state.steps = patch.steps.map(step => ({ ...step }));
            initializeTitle(); clearInvalidDestinations();
            if (layoutChanged) render();
            else if(state.type === "task") taskFields?.update?.(patch);
            notify();
        },
        focus() { element.querySelector("button.is-active,button,input,select")?.focus(); },
        destroy() { disposed = true; picker?.close(); taskFields?.destroy(); for (const dispose of disposers) dispose(); element.remove(); }
    };
}
module.exports = { mountCaptureForm, mountCaptureTypeControl, noteTitle };
