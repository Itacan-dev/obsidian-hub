"use strict";
const { action } = require("./capture-modal");

const CAPTURE_ACTIONS = Object.freeze({
    task: { mode: "task", label: "Create task...", icon: "square-plus" },
    note: { mode: "note", label: "Create note...", icon: "notebook-plus" },
    text: { mode: "text", label: "Add to note...", icon: "notebook-pen" },
    file: { mode: "file", label: "File location", icon: "folder-input" }
});
function captureActions(capture, inbox = false) {
    if (!capture.attachments?.length) return ["task", "note", "text"].map(key => CAPTURE_ACTIONS[key]);
    // Retain older mixed/file-note routes, including interrupted note creation.
    const legacyNote = inbox && (capture.text?.trim() || capture.intent?.type === "note" || capture.operation?.kind === "note");
    return (legacyNote ? ["file", "note"] : ["file"]).map(key => key === "file"
        ? { ...CAPTURE_ACTIONS.file, label: capture.attachments.length === 1 ? "Add file to..." : "Add files to..." }
        : CAPTURE_ACTIONS[key]);
}
function captureAction(host, choice, onChoose) {
    const button = action(host, choice.label, choice.icon, () => {
        if (!button.disabled) onChoose(choice.mode);
    }, "hub-capture-destination");
    button.dataset.captureAction = choice.mode;
    button.querySelector(".hub-capture-icon")?.setAttribute("aria-hidden", "true");
    return button;
}
module.exports = { CAPTURE_ACTIONS, captureActions, captureAction };
