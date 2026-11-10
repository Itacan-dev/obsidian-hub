"use strict";
const { CaptureModal, action, attachments } = require("./capture-modal");
const { ownModalColors, ownNoticeColors } = require("./color-system");
const { Notice } = require("obsidian");
const { mountTaskText } = require("./task-form");
const { linkFromText } = require("../domain/inbox");
const { openCaptureAction, operationMode } = require("./capture-flow");

class QuickAddModal extends CaptureModal {
    constructor(app, service, options = {}) {
        super(app, service, options);
        this.draft = service.quickDraft(options.source ?? { origin: "Quick Add" });
        this.pendingImports = 0; this.importQueue = Promise.resolve();
    }
    onOpen() { ownModalColors(this);
        this.modalEl.classList.add("hub-quick-add-dialog");
        this.header("Quick Add", "Write down a thought, or add a file", "zap");
        this.body = this.contentEl.createDiv({ cls: "hub-capture-body" });
        this.textPath = this.body.createDiv({ cls: "hub-capture-text-editor" });
        this.input = mountTaskText(this.textPath, this.draft, patch => { this.checkpoint({ text: patch.text, actionDrafts: {}, lastAction: null }); this.sync(); },
            { multiline: true, required: false, placeholder: "Start typing...", attributes: { "aria-label": "Write something" } });
        this.input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault(); if (!this.send.disabled) void this.sendInbox();
            }
        });
        this.body.addEventListener("paste", event => {
            const files = [...(event.clipboardData?.files ?? [])]; if (!files.length) return;
            event.preventDefault();
            if (event.clipboardData.getData("text/plain").trim()) { this.error.textContent = "Paste text or files separately so nothing is discarded."; return; }
            void this.addAttachments(files);
        });
        this.body.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
        this.body.addEventListener("drop", event => {
            event.preventDefault(); event.stopPropagation();
            const files = [...(event.dataTransfer?.files ?? [])];
            const links = (event.dataTransfer?.getData("text/uri-list") ?? "").split(/\r?\n/).filter(line => line && !line.startsWith("#"));
            const text = links.length && !files.length ? links.filter(link => linkFromText(link)).join("\n") : event.dataTransfer?.getData("text/plain") ?? "";
            if (files.length) {
                if (text.trim() && !/^file:/i.test(text.trim())) { this.error.textContent = "Drop text or files separately so nothing is discarded."; return; }
                void this.addAttachments(files); return;
            }
            if (!text || this.busy || this.pendingImports) return;
            if (this.draft.attachments.length) { this.error.textContent = "Remove the files before writing something."; return; }
            const inside = event.target === this.input, start = inside ? this.input.selectionStart : this.input.value.length, end = inside ? this.input.selectionEnd : start;
            const prefix = !inside && this.input.value && !this.input.value.endsWith("\n") ? "\n" : "";
            this.input.setRangeText(prefix + text, start, end, "end");
            this.checkpoint({ text: this.input.value, actionDrafts: {}, lastAction: null }); this.sync(); this.input.focus();
        });
        this.attachmentList = this.body.createDiv({ cls: "hub-capture-attachments" });
        this.fileInput = this.body.createEl("input", { attr: { type: "file", multiple: "", hidden: "", tabindex: "-1", "aria-label": "Choose a file" } });
        this.fileInput.addEventListener("change", () => { void this.addAttachments([...this.fileInput.files]); this.fileInput.value = ""; });
        this.attach = action(this.body, "Add a file", "paperclip", () => this.fileInput.click(), "hub-capture-attach");
        this.chooser = this.body.createDiv({ cls: "hub-capture-specify", attr: { role: "group", "aria-label": "Specify destination" } }); this.chooser.hidden = true;
        const footer = this.contentEl.createDiv({ cls: "hub-capture-actions" });
        this.clear = action(footer, "Clear", null, () => { void this.clearDraft(); });
        this.more = action(footer, "Specify", null, () => { this.chooser.hidden = !this.chooser.hidden; this.more.setAttribute("aria-expanded", String(!this.chooser.hidden)); if (!this.chooser.hidden) this.chooser.querySelector("button:not(:disabled)")?.focus(); });
        this.more.setAttribute("aria-expanded", "false");
        this.send = action(footer, "Send to Inbox", null, () => { void this.sendInbox(); }, "mod-cta");
        this.feedback = this.contentEl.createDiv({ cls: "hub-capture-feedback", attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" } });
        if (operationMode(this.draft)) this.feedback.textContent = "Choose Specify to retry the saved action, or send it to Inbox.";
        this.renderAttachments(); this.sync(); if (!this.draft.attachments.length) this.input.focus();
    }
    checkpoint(patch) {
        this.feedback.textContent = "Saving draft?";
        const save = this.service.saveQuickDraft(patch, this.draft.id); this.draft = this.service.quickDraft();
        save.then(() => { if (!this.closed && this.feedback.textContent === "Saving draft?") this.feedback.textContent = ""; }, error => { if (!this.closed) this.error.textContent = "Draft not saved: " + error.message; });
        return save;
    }
    renderAttachments() {
        attachments(this.attachmentList, this.draft.attachments, this.service, { remove: ref => { void this.run(async () => {
            await this.service.removeQuickAttachment(this.draft.id, ref.id); this.draft = this.service.quickDraft(); this.renderAttachments();
        }); } });
        this.renderChoices();
    }
    renderChoices() {
        this.chooser.empty();
        const choices = this.draft.attachments.length ? [["file", "File location"]] : [["task", "Task"], ["note", "New note"], ["text", "Add to existing note"]];
        const pending = operationMode(this.draft);
        for (const [mode, label] of choices) { const button = action(this.chooser, label, null, () => { void this.specify(mode); }); button.disabled = !!pending && pending !== mode; }
    }
    sync() {
        if (this.closed || !this.send) return;
        const file = this.draft.attachments.length > 0, text = !!this.draft.text.trim(), waiting = this.busy || !!this.pendingImports || this.closing;
        const locked = !!this.draft.operation && this.draft.operation.state !== "done";
        this.textPath.hidden = file; this.input.disabled = !!waiting || locked;
        this.attach.hidden = file || text; this.attach.disabled = !!waiting; this.fileInput.disabled = !!waiting;
        this.clear.title = locked ? "Finish or review the saved action before clearing this draft." : "Discard this draft";
        this.clear.disabled = !!waiting || locked || !(file || this.draft.text.length || Object.keys(this.draft.actionDrafts ?? {}).length);
        this.more.disabled = !!waiting || !(file || text); this.send.disabled = !!waiting || !(file || text);
        this.chooser.querySelectorAll("button").forEach(button => { button.disabled = !!waiting || (!!operationMode(this.draft) && button.textContent !== ({ task: "Task", note: "New note", text: "Add to existing note", file: "File location" }[operationMode(this.draft)])); });
        this.attachmentList.querySelectorAll("button").forEach(button => button.disabled = !!waiting || locked);
    }
    addAttachments(files) {
        if (!files?.length) return Promise.resolve();
        if (this.draft.text.trim() || this.draft.operation) { this.error.textContent = "Clear the text before adding a file."; return Promise.resolve(); }
        if (this.busy && !this.pendingImports) return Promise.resolve();
        this.pendingImports++; this.sync();
        const operation = this.importQueue.then(() => this.run(async () => {
            try { await this.service.stageQuickFiles(files, this.draft.id); }
            finally { this.draft = this.service.quickDraft(); this.renderAttachments(); }
        })).finally(() => { this.pendingImports--; this.sync(); });
        this.importQueue = operation.catch(() => {}); return operation;
    }
    async sendInbox() {
        if (this.busy || this.pendingImports || this.send.disabled) return;
        return this.run(async () => {
            await this.service.flushQuickDraft(this.draft.id);
            await this.service.sendQuickDraft(this.draft.id);
            this.draft = this.service.quickDraft(this.options.source); this.input.value = "";
            this.chooser.hidden = true; this.more.setAttribute("aria-expanded", "false"); this.renderAttachments();
            this.feedback.textContent = "? Sent to Inbox.";
            // run() restores the disabled state before the focus gesture.
            setTimeout(() => { if (!this.closed) this.input.focus(); }, 0);
        });
    }
    async clearDraft() {
        if (this.busy || this.pendingImports) return;
        return this.run(async () => {
            await this.service.clearQuickDraft(this.draft.id); this.draft = this.service.quickDraft(); this.input.value = "";
            this.chooser.hidden = true; this.more.setAttribute("aria-expanded", "false"); this.renderAttachments(); this.feedback.textContent = "Draft cleared.";
            setTimeout(() => { if (!this.closed) this.input.focus(); }, 0);
        });
    }
    async specify(mode) {
        if (this.busy || this.pendingImports) return;
        this.busy = true; this.sync();
        try {
            await this.service.flushQuickDraft(this.draft.id);
            const id = this.draft.id;
            this.busy = false; this.handoff = true; super.close();
            const resume = result => Promise.resolve().then(() => {
                if (result.status === "failed") ownNoticeColors(new Notice(result.error));
                if (this.options.onResume) this.options.onResume(result);
                else new QuickAddModal(this.app, this.service, this.options).open();
            });
            try { this.child = openCaptureAction(this.service, { captureId: id, mode, onClose: resume }); }
            catch (error) { resume({ status: "failed", error: error.message }); }
        } catch (error) { this.error.textContent = error.message; this.busy = false; this.sync(); }
    }
    async close() {
        if (this.busy || this.pendingImports || this.closed || this.closing) return;
        this.closing = true; this.sync();
        try { await this.service.flushQuickDraft(this.draft.id); this.closing = false; super.close(); }
        catch (error) { this.closing = false; this.error.textContent = "Draft not saved: " + error.message; this.sync(); }
    }
    onClose() { super.onClose(); }
}
module.exports = { QuickAddModal };
