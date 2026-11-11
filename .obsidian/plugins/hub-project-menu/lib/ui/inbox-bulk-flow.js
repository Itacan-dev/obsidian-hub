"use strict";
const { randomUUID } = require("node:crypto");
const { createCaptureLocations } = require("./capture-flow");
const { createNativeTaskLocations, workspaceRef } = require("../services/native-task-locations");
const { openLocationPicker } = require("./task-location-picker");
const { remainingMembers, distinctFileCount, bulkMessage } = require("../domain/inbox-bulk");

function bulkLabel(mode, count, navigation = false) {
    const text = mode === "task" ? `Create ${count} task${count === 1 ? "" : "s"}` : mode === "note" ? `Create ${count} note${count === 1 ? "" : "s"}` :
        mode === "text" ? `Add ${count} text${count === 1 ? "" : "s"} to note` : `Add ${count} file${count === 1 ? "" : "s"}`;
    return text + (navigation ? mode === "file" ? " to..." : "..." : "");
}
function openBulkAction(service, { ids, mode, batchId, draft, onDraftChange = () => {}, onClose }) {
    let batch = batchId ? service.bulk : null, modal;
    const attemptId = batch?.id ?? randomUUID(), locations = mode === "task" ? createNativeTaskLocations(service.plugin) : createCaptureLocations(service);
    const first = service.required(ids[0]), saved = batch?.destination;
    const initialWorkspace = saved ? service.workspace(saved.workspaceId) : draft?.owner ? service.destinations().find(w => { const o = workspaceRef(w); return o.type === draft.owner.type && o.id === draft.owner.id; }) :
        service.workspace(first.source?.workspaceId) ?? (first.source?.path ? service.plugin.projectWizard.getContextForPath(first.source.path) : null) ?? service.destinations()[0];
    const owner = initialWorkspace ? workspaceRef(initialWorkspace) : saved ? { type: saved.workspaceId.startsWith('resource:') ? 'resource' : 'project', id: saved.workspaceId.replace(/^resource:/,'') } : null;
    let reference = draft?.selected?.reference ?? null;
    if (saved && owner) {
        try { reference = mode === "task" ? saved.nativeLocation ? locations.resolveId(owner, saved.nativeLocation).reference : null : locations.select(owner, mode === "text" ? saved.noteLocation.path : saved.folder, mode === "text" ? "note" : "folder").reference; }
        catch (_) { reference = { type: mode === "text" ? "note" : "folder", id: "unavailable" }; }
    }
    const count = () => mode === "file" ? distinctFileCount(batch ? remainingMembers(batch).map(m => m.input) : ids.map(id => service.required(id))) : batch ? remainingMembers(batch).length : ids.length;
    const progress = value => {
        batch = value;
        if (modal?.contextText) modal.contextText.textContent = bulkMessage(value);
        if (modal?.confirm) modal.confirm.textContent = bulkLabel(mode, count());
    };
    modal = openLocationPicker(service.app, { locations, owner, reference, mode, allowOwnerChange: !batch, editNoteTitle: false,
        noteTitle: "Inbox batch", contextTitle: batch ? bulkMessage(batch) : `${ids.length} selected item${ids.length === 1 ? "" : "s"}`,
        confirmLabel: bulkLabel(mode, count()), selectionLocked: () => !!service.activeBulk && service.activeBulk.id === attemptId,
        onDraftChange, beforeClose: value => { onDraftChange(value); },
        onChoose: async selected => {
            const workspace = service.destinations().find(w => { const o = workspaceRef(w); return o.type === selected.owner.type && o.id === selected.owner.id; });
            if (!workspace) throw Error("The selected workspace is unavailable.");
            const destination = mode === "task" ? { workspaceId: workspace.id, nativeLocation: selected.reference?.id ?? "" } : mode === "text" ?
                { workspaceId: workspace.id, noteLocation: { path: selected.path, targetType: "note", position: "end" } } : { workspaceId: workspace.id, folder: selected.path };
            batch = service.bulk?.id === attemptId ? service.bulk : batch;
            if (batch && JSON.stringify(destination) !== JSON.stringify(batch.destination)) throw Error("Retry the batch at its original destination.");
            if (!batch) batch = await service.prepareBulk(mode, ids, destination, attemptId);
            return service.runBulk(batch.id, progress);
        },
        onClose: result => { if (service.captureAction === modal) service.captureAction = null; onClose(result); }
    });
    service.captureAction = modal;
    return modal;
}
module.exports = { openBulkAction, bulkLabel };
