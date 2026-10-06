"use strict";
const { projectItemPath } = require("./files");
const { noteLocation } = require("./note-insertion");

const INBOX_VERSION = 1;
const INBOX_ATTACHMENT_ROOT = "Inbox/Attachments";
const INBOX_SORTS = [
    ["most-complete", "Most complete"], ["least-complete", "Least complete"],
    ["newest", "Newest first"], ["oldest", "Oldest first"], ["type", "Item type"]
];
function inboxSort(value) { return INBOX_SORTS.some(([key]) => key === value) ? value : "most-complete"; }

function inboxCounts(captures) {
    const files = captures.filter(item => item.attachments?.length).length;
    return { all: captures.length, text: captures.length - files, files };
}

function inboxItemType(capture) {
    const type = captureDraft(capture).type;
    return capture.operation?.state === "done" && type === "task" ? null : type ?? null;
}

function linkFromText(text) {
    const match = String(text ?? "").trim().match(/^https?:\/\/[^\s]+$/i);
    if (!match) return null;
    try { return new URL(match[0]).href; } catch (_) { return null; }
}

function isInboxOwned(attachment) {
    return attachment?.ownership === "inbox" &&
        /^Inbox\/Attachments\/[0-9a-f-]{36}\/[^/]+$/i.test(attachment.path ?? "") &&
        !String(attachment.path).split("/").some(part => part === "." || part === "..");
}

function captureKind(text, attachments = []) {
    if (attachments.length) return attachments.every(item => /^image\//i.test(item.mime ?? "") ||
        /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i.test(item.name ?? "")) ? "image" : "file";
    return linkFromText(text) ? "link" : "text";
}

function capturePreview(capture) {
    return String(capture?.text ?? "").trim().split(/\r?\n/).find(Boolean) ||
        capture?.attachments?.map(item => item.name).join(", ") || "Capture";
}

function sourceMetadata(value = {}) {
    const result = {};
    for (const key of ["origin", "context", "workspaceId", "workspaceName", "path", "title", "url", "pageTitle", "pageUrl"]) {
        if (typeof value?.[key] === "string" && value[key].trim()) result[key] = value[key];
    }
    return result;
}

function attachmentReference(value) {
    if (!value || typeof value.path !== "string" || !value.path.trim() || !value.id) {
        throw Error("An attachment reference is missing its file path.");
    }
    const path = value.path.replace(/\\/g, "/");
    if (path.startsWith("/") || path.split("/").some(part => !part || part === "." || part === "..") || /^[a-z]:/i.test(path)) {
        throw Error("Choose a file inside Itacan or import a copy.");
    }
    const attachment = { id: String(value.id), path, name: String(value.name || path.split("/").at(-1)),
        ownership: value.ownership === "inbox" ? "inbox" : "reference",
        size: Math.max(0, Number(value.size) || 0), mime: String(value.mime ?? "") };
    if (typeof value.originalPath === "string") attachment.originalPath = value.originalPath;
    if (attachment.ownership === "inbox" && !isInboxOwned(attachment)) {
        throw Error("An Inbox attachment has an invalid staging path.");
    }
    return attachment;
}

function sortedCaptures(captures, { filter = "all", sort = "newest", completion } = {}) {
    const rows = captures.filter(capture => filter === "all" ||
        (filter === "files" ? capture.attachments?.length : !capture.attachments?.length));
    const byCompletion = sort === "most-complete" || sort === "least-complete";
    const ratios = byCompletion ? new Map(rows.map(item => [item.id, completion?.(item).ratio ?? 0])) : null;
    const types = sort === "type" ? new Map(rows.map(item => [item.id, ({ task: 1, note: 2, file: 3 }[inboxItemType(item)] ?? 0)])) : null;
    return rows.sort((a, b) => {
        const oldest = Number(a.createdAt) - Number(b.createdAt);
        const primary = byCompletion ? (sort === "most-complete" ? -1 : 1) * (ratios.get(a.id) - ratios.get(b.id)) :
            types ? types.get(a.id) - types.get(b.id) : sort === "newest" ? -oldest : oldest;
        return primary || oldest || a.id.localeCompare(b.id);
    });
}

function taskTitle(text) { return String(text ?? "").trim().split(/\r?\n/).find(line => line.trim())?.trim() ?? ""; }

function captureNoteTitle(value) {
    const raw = String(value ?? ""), title = raw.trim();
    if (!title) throw Error("Enter a note title.");
    if (/[\r\n\u0000-\u001f]/.test(raw) || /^\.{1,2}(?:\.md)?$/i.test(title)) {
        throw Error("Enter a valid note title.");
    }
    projectItemPath("", "note", title);
    return title;
}

// The content and file references remain canonical Capture fields. Intent only
// keeps the decisions that can be resumed in the existing creation forms.
function captureIntent(values = {}, attachments = []) {
    const input = { ...(values.intent ?? {}), ...values };
    const type = attachments.length ? (["task", "note", "file"].includes(input.type) || input.workspaceId || input.folder ? "file" : null) : ["task", "note"].includes(input.type) ? input.type : null;
    if (!type) return null;
    const intent = { inputPath: attachments.length ? "file" : "text", type };
    const keys = type === "task" ? ["workspaceId", "location", "necessity", "fromDate", "dueDate", "fromTime", "dueTime", "phaseId", "linkedProjectId"] :
        type === "note" ? ["workspaceId", "folder", "title"] : ["workspaceId", "folder"];
    for (const key of keys) {
        if (typeof input[key] === "string" || input[key] === null) intent[key] = input[key];
    }
    if (type === "note") {
        intent.noteAction = input.noteAction === "existing" ? "existing" : "new";
        const location = noteLocation(input.noteLocation);
        if (location || input.noteLocation === null) intent.noteLocation = location;
    }
    if (type === "task" && Array.isArray(input.steps)) {
        intent.steps = input.steps.map(step => {
            const result = {};
            for (const key of ["text", "completed", "completedAt", "hubTaskId", "line", "path", "status", "indent", "end"]) {
                if (["string", "number", "boolean"].includes(typeof step?.[key]) || step?.[key] === null) result[key] = step[key];
            }
            return result;
        });
    }
    return intent;
}

function captureDraft(capture = {}) {
    const operation = capture.operation?.state !== "done" ? capture.operation : null;
    const draft = { text: String(capture.text ?? capture.taskTitle ?? ""), attachments: (capture.attachments ?? []).map(ref => ({ ...ref })),
        source: sourceMetadata(capture.source), ...(capture.intent ?? {}) };
    if (operation) {
        const insertion = operation.kind === "note-insertion";
        Object.assign(draft, operation.kind === "task" ? operation.values : insertion ? {} : { folder: operation.folder, title: operation.title },
            { type: operation.kind === "files" ? "file" : insertion ? "note" : operation.kind, workspaceId: operation.workspaceId },
            insertion ? { noteAction: "existing", noteLocation: noteLocation(operation.noteLocation) } : {});
        if (operation.kind === "task") Object.assign(draft, { text: operation.input?.text ?? operation.text, location: operation.location });
        else if (operation.input?.text !== undefined) draft.text = operation.input.text;
        // A rolled-back file/note attempt may retain an edited destination.
        // Ready receipts always retain their already-created destination.
        if (operation.state === "prepared" && operation.kind !== "task" && !insertion && capture.intent) Object.assign(draft, capture.intent);
    }
    draft.inputPath = draft.attachments.length ? "file" : "text";
    if (Array.isArray(draft.steps)) draft.steps = draft.steps.map(step => ({ ...step }));
    delete draft.taskTitle;
    return draft;
}

module.exports = { INBOX_VERSION, INBOX_ATTACHMENT_ROOT, linkFromText, isInboxOwned, captureKind,
    capturePreview, sourceMetadata, attachmentReference, sortedCaptures, taskTitle, captureIntent, captureDraft, captureNoteTitle,
    INBOX_SORTS, inboxSort, inboxCounts, inboxItemType };
