"use strict";
const { timestampNoteTitle } = require("./inbox");

function bulkKind(capture) {
    if (!capture) return null;
    const files = capture.attachments?.length > 0, text = !!capture.text?.trim();
    return files ? text ? null : "files" : text ? "text" : null;
}
function remainingMembers(batch) { return batch?.members.filter(member => member.state !== "done") ?? []; }
function bulkEligibility(capture, batch) {
    const kind = bulkKind(capture);
    if (!kind) return { reason: "Organize mixed or empty items individually." };
    if (batch && batch.state !== "done") {
        if (remainingMembers(batch).some(member => member.id === capture.id)) return { kind, group: batch.id };
        return { reason: "Finish the retained batch before starting another selection." };
    }
    if (capture.operation) return { reason: "Review this item's saved operation individually before bulk organization." };
    return { kind, group: kind };
}
function distinctFileCount(captures) { return new Set(captures.flatMap(c => c.attachments ?? []).map(ref => ref.path)).size; }
function allocateBulkTitles(captures, folder, exists, date = new Date()) {
    const prefix = timestampNoteTitle("Inbox", date), reserved = new Set(); let number = 1;
    return captures.map(() => {
        let title, path;
        do { title = `${prefix} (${number++})`; path = folder + "/" + title + ".md"; } while (reserved.has(path) || exists(path));
        reserved.add(path); return title;
    });
}
function appendCapturedTexts(note, texts) {
    const eol = note.includes("\r\n") ? "\r\n" : "\n";
    const trailing = (note.match(/[\r\n]*$/)?.[0] ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").length;
    const boundary = !note || note === "\ufeff" ? "" : eol.repeat(Math.max(0, 2 - trailing));
    return note + boundary + texts.join(eol + eol);
}
function bulkMessage(batch) {
    const done = batch.members.filter(member => member.state === "done").length;
    const summary = `${done} of ${batch.members.length} items completed; ${batch.members.length - done} remain.`;
    return summary + (batch.action === "text" && batch.append?.state === "ready" && batch.state !== "done" ? " Text is already saved; retry will verify it and finish source cleanup." : "");
}
module.exports = { bulkKind, bulkEligibility, remainingMembers, distinctFileCount, allocateBulkTitles, appendCapturedTexts, bulkMessage };
