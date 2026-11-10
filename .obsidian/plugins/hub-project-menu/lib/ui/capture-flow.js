"use strict";
const N = require("../services/native-inbox-task");
const { captureDraft, noteTitle } = require("../domain/inbox");
const { createNativeTaskLocations, workspaceRef } = require("../services/native-task-locations");
const { openLocationPicker } = require("./task-location-picker");

// Reuse the physical browser, with capture eligibility independent of SQLite readiness.
function createCaptureLocations(service) {
    const base = createNativeTaskLocations(service.plugin);
    const rows = () => service.destinations().map(w => ({ ...w, owner: workspaceRef(w), available: service.plugin.oath?.canOpen(w) !== false }));
    const check = owner => { const w = rows().find(w => w.owner.type === owner?.type && w.owner.id === owner?.id); if (!w?.available) throw Error("Choose an available workspace."); return w; };
    return { ...base, workspaces: rows,
        resolve(owner, reference) { check(owner); return base.resolve(owner, reference); },
        browse(owner, path) { check(owner); return base.browse(owner, path); },
        select(owner, path, type) { check(owner); return base.select(owner, path, type); }
    };
}
function operationMode(capture) {
    const operation = capture.operation?.state !== "done" ? capture.operation : null;
    return operation ? ({ "native-task": "task", task: "task", "note-insertion": "text", files: "file", note: "note" }[operation.kind]) : null;
}
function openCaptureAction(service, { captureId, mode, onClose = () => {} }) {
    const capture = service.required(captureId), pending = operationMode(capture);
    if (pending && pending !== mode) throw Error("Retry the saved action before choosing another action.");
    if (capture.attachments.length && ["task", "text"].includes(mode)) throw Error("Native tasks and existing-note insertion cannot accept attachments.");
    const type = mode === "text" ? "note" : mode;
    const draft = { ...captureDraft(capture, type), ...(!pending ? capture.actionDrafts?.[mode] : {}), type };
    const quick = service.currentQuickDraft?.id === captureId;
    let modal, lastSave = Promise.resolve();
    const finished = result => {
        if (service.captureAction === modal) service.captureAction = null;
        if (!service.destroyed) onClose(result);
    };
    const track = value => { service.captureAction = value; value.ready?.then(() => { if (value.closed && service.captureAction === value) service.captureAction = null; }); return value; };
    const report = error => { const target = modal?.contentEl.querySelector(".hub-task-error"); if (target) target.textContent = error.message; };
    const persist = values => {
        if (!values || !service.get(captureId)) return Promise.resolve();
        lastSave = quick ? service.saveQuickAction(captureId, mode, values) : service.updateCapture(captureId, { ...values, actionMode: mode });
        lastSave.catch(report); return lastSave;
    };
    if (mode === "task") {
        const initial = N.draft(service, draft, capture);
        const toCapture = values => {
            const owner = values.nativeOwner, workspace = N.workspaces(service).find(w => { const o = N.ownerOf(w); return o.type === owner?.type && o.id === owner?.id; });
            const { location, operation, ...fields } = values;
            return { ...fields, text: capture.text, taskTitle: values.text, type: "task", workspaceId: workspace?.id ?? initial.workspaceId, attachments: capture.attachments };
        };
        const options = { text: initial.taskTitle, description: initial.description, steps: initial.steps ?? [],
            ...Object.fromEntries(["necessity", "fromDate", "fromTime", "dueDate", "dueTime", "phaseId", "pendingStep", "nativeLocation", "nativeLocationType", "completed", "recurrence", "recurrenceDraft"].filter(k => Object.hasOwn(draft,k)).map(k => [k,draft[k]])),
            onDraftChange: values => { void persist(toCapture(values)); },
            beforeClose: values => values ? persist(toCapture(values)) : lastSave,
            submit: async values => { const mapped = toCapture(values); await persist(mapped); return service.makeTask(mapped, captureId); },
            onDismiss: finished
        };
        const workspace = N.workspaces(service).find(w => w.id === initial.workspaceId);
        const savedOwner = draft.nativeOwner ?? (workspace ? N.ownerOf(workspace) : initial.workspaceId ?
            { type: initial.workspaceId.startsWith("resource:") ? "resource" : "project", id: initial.workspaceId.replace(/^resource:/, "") } : null);
        if (savedOwner && service.plugin.nativeTaskHost.matches(savedOwner)) options.owner = savedOwner;
        else if (savedOwner) {
            options.nativeOwner = savedOwner; options.nativeLocation ??= "";
            options.initialError = "Saved workspace is unavailable. Choose a replacement through Task location.";
        }
        modal = service.plugin.nativeTaskHost.create(options);
        return track(modal);
    }
    const locations = createCaptureLocations(service);
    const source = N.sourceDestination(service, capture.source);
    const workspace = service.workspace(draft.workspaceId ?? source.workspaceId);
    const owner = workspace ? workspaceRef(workspace) : null;
    const path = mode === "text" ? draft.noteLocation?.path ?? source.location ?? workspace?.root : draft.folder ?? (workspace?.id === source.workspaceId ? source.location : workspace?.root);
    let reference = null;
    if (owner && path) { try { reference = locations.select(owner, path, mode === "text" && /\.md$/i.test(path) ? "note" : "folder").reference; } catch (_) { reference = { type: mode === "text" ? "note" : "folder", id: "unavailable:" + path }; } }
    const valuesFor = (selected, committing = false) => {
        const w = service.destinations().find(w => { const o = workspaceRef(w); return o.type === selected.owner?.type && o.id === selected.owner?.id; });
        const values = { ...draft, text: capture.text, attachments: capture.attachments, workspaceId: w?.id ?? draft.workspaceId, type };
        if (mode === "text") Object.assign(values, { noteAction: "existing", noteLocation: pending ? capture.operation.noteLocation : !committing && (!selected.selected || (draft.noteLocation?.targetType !== "note" && draft.noteLocation?.path === selected.selected?.path)) ? draft.noteLocation ?? null : selected.selected?.type === "note" ? { path: selected.selected.path, targetType: "note", position: "end" } : null });
        else Object.assign(values, { folder: selected.selected?.path ?? draft.folder, title: selected.title, noteAction: "new" });
        return values;
    };
    const title = mode === "note" ? draft.title ?? noteTitle(capture) : "";
    modal = openLocationPicker(service.app, { locations, owner, reference, allowOwnerChange: true, mode, noteTitle: title,
        contextTitle: mode === "note" ? title : mode === "text" ? capture.text.trim().replace(/\s+/g," ") : capture.attachments.length === 1 ? capture.attachments[0].name : capture.attachments[0].name + " (+" + (capture.attachments.length-1) + (capture.attachments.length === 2 ? " file)" : " files)"),
        confirmLabel: mode === "file" && capture.attachments.length > 1 ? "Add files" : undefined,
        onDraftChange: value => { void persist(valuesFor(value)); },
        beforeClose: value => persist(valuesFor(value)),
        onChoose: async selected => {
            if (pending === "text" && selected.path !== capture.operation.noteLocation.path) throw Error("Retry the original note before choosing a different destination.");
            const values = valuesFor({ owner: selected.owner, selected, title: selected.title }, true);
            await persist(values);
            return mode === "file" ? service.addFiles({ ...values, filesOnly: !capture.text.trim() }, captureId) : service.createNote(values, captureId);
        },
        onClose: finished
    });
    return track(modal);
}
module.exports = { openCaptureAction, createCaptureLocations, operationMode };
