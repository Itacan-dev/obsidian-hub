"use strict";
const { CaptureModal, action, attachments } = require("./capture-modal");
const { ownModalColors, ownNoticeColors } = require("./color-system");
const { Notice } = require("obsidian");
const { mountTaskText } = require("./task-form");
const { linkFromText } = require("../domain/inbox");
const { openCaptureAction, operationMode } = require("./capture-flow");
const { captureActions, captureAction } = require("./capture-actions");

class QuickAddModal extends CaptureModal {
    constructor(app, service, options = {}) {
        super(app, service, options);
        this.draft = service.quickDraft(options.source ?? { origin: "Quick Add" });
        this.pendingImports = 0; this.importQueue = Promise.resolve();
    }
    onOpen() { ownModalColors(this);
        this.modalEl.classList.add("hub-quick-add-dialog");
        this.header("Quick Add", "Write down a thought, or choose files", "zap");
        this.body = this.contentEl.createDiv({ cls: "hub-capture-body" });
        this.captureRegion = this.body.createDiv({ cls: "hub-quick-capture-region" });
        this.textCapture = this.captureRegion.createDiv({ cls: "hub-quick-text-capture" });
        this.textPath = this.textCapture.createDiv({ cls: "hub-capture-text-editor" });
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
        this.destinations = this.textCapture.createDiv({ cls: "hub-quick-capture-actions", attr: { role: "group", "aria-label": "Capture actions" } });
        this.attachmentList = this.captureRegion.createDiv({ cls: "hub-capture-attachments" });
        this.attachmentList.hidden = true;
        this.fileInput = this.body.createEl("input", { attr: { type: "file", multiple: "", hidden: "", tabindex: "-1", "aria-label": "Choose files" } });
        this.fileInput.addEventListener("change", () => { void this.addAttachments([...this.fileInput.files]); this.fileInput.value = ""; });
        this.attach = action(this.body, "Choose files", "paperclip", () => { if (!this.attach.disabled) this.fileInput.click(); }, "hub-capture-attach");
        const footer = this.contentEl.createDiv({ cls: "hub-capture-actions" });
        this.clear = action(footer, "Clear", null, () => { void this.clearDraft(); });
        this.fileAction = action(footer, "Add files to...", "folder-input", () => { void this.launchAction("file"); });
        this.fileAction.dataset.captureAction = "file"; this.fileAction.hidden = true;
        this.send = action(footer, "Send to Inbox", null, () => { void this.sendInbox(); }, "mod-cta");
        this.renderActions();
        // Size once from the existing empty text layout, including current fonts.
        const height = this.captureRegion.getBoundingClientRect().height;
        if (height > 0) this.captureRegion.style.setProperty("--hub-quick-capture-height", height + "px");
        this.captureRegion.classList.add("is-sized");
        const dialogHeight = this.modalEl.getBoundingClientRect().height;
        if (dialogHeight > 0) this.modalEl.style.setProperty("--hub-quick-dialog-height", dialogHeight + "px");
        this.renderAttachments({ revealNewest: true }); this.sync(); if (!this.draft.attachments.length) this.input.focus();
    }
    checkpoint(patch) {
        const save = this.service.saveQuickDraft(patch, this.draft.id); this.draft = this.service.quickDraft();
        save.then(() => {
            if (!this.closed && this.error.textContent.startsWith("Draft not saved:")) this.error.textContent = "";
        }, error => { if (!this.closed) this.error.textContent = "Draft not saved: " + error.message; });
        return save;
    }
    renderAttachments({ revealNewest = false } = {}) {
        const scroll = this.attachmentList.scrollTop;
        attachments(this.attachmentList, [...this.draft.attachments].reverse(), this.service, { remove: ref => { void this.run(async () => {
            await this.service.removeQuickAttachment(this.draft.id, ref.id); this.draft = this.service.quickDraft(); this.renderAttachments();
        }); } });
        this.attachmentList.scrollTop = revealNewest ? 0 : scroll;
    }
    renderActions() {
        this.destinations.empty();
        this.actionButtons = captureActions({ attachments: [] }).map(choice =>
            captureAction(this.destinations, choice, mode => { void this.launchAction(mode); }));
    }
    sync() {
        if (this.closed || !this.send) return;
        const file = this.draft.attachments.length > 0, text = !!this.draft.text.trim(), waiting = this.busy || !!this.pendingImports || this.closing;
        const locked = !!this.draft.operation && this.draft.operation.state !== "done";
        this.textCapture.hidden = file; this.textPath.hidden = file; this.destinations.hidden = file;
        this.attachmentList.hidden = !file; this.input.disabled = !!waiting || locked;
        this.attach.querySelector("span:last-child").textContent = file ? "Choose more files" : "Choose files";
        this.attach.disabled = !!waiting || locked || text; this.fileInput.disabled = this.attach.disabled;
        this.clear.title = locked ? "Finish or review the saved action before clearing this draft." : "Discard this draft";
        this.clear.disabled = !!waiting || locked || !(file || this.draft.text.length || Object.keys(this.draft.actionDrafts ?? {}).length);
        const pendingBatch = file && this.draft.attachments.length > 1 && locked;
        this.send.disabled = !!waiting || !(file || text) || pendingBatch;
        this.send.title = pendingBatch ? "Retry the saved file placement before sending files separately to Inbox." : "";
        const pending = operationMode(this.draft);
        this.fileAction.hidden = !file;
        this.fileAction.disabled = !!waiting || !file || (!!pending && pending !== "file");
        this.actionButtons.forEach(button => {
            button.disabled = !!waiting || file || !text || (!!pending && button.dataset.captureAction !== pending);
        });
        this.attachmentList.querySelectorAll("button").forEach(button => button.disabled = !!waiting || locked);
    }
    addAttachments(files) {
        if (!files?.length) return Promise.resolve();
        if (this.draft.text.trim() || this.draft.operation) { this.error.textContent = "Clear the text before adding a file."; return Promise.resolve(); }
        if (this.busy && !this.pendingImports) return Promise.resolve();
        this.pendingImports++; this.sync();
        const operation = this.importQueue.then(() => this.run(async () => {
            try { await this.service.stageQuickFiles(files, this.draft.id); }
            finally { this.draft = this.service.quickDraft(); this.renderAttachments({ revealNewest: true }); }
        })).finally(() => { this.pendingImports--; this.sync(); });
        this.importQueue = operation.catch(() => {}); return operation;
    }
    async sendInbox() {
        if (this.busy || this.pendingImports || this.send.disabled) return;
        return this.run(async () => {
            await this.service.flushQuickDraft(this.draft.id);
            await this.service.sendQuickDraft(this.draft.id);
            this.draft = this.service.quickDraft(this.options.source); this.input.value = "";
            this.renderAttachments();
            ownNoticeColors(new Notice("Sent to Inbox."));
            // run() restores the disabled state before the focus gesture.
            setTimeout(() => { if (!this.closed) this.input.focus(); }, 0);
        });
    }
    async clearDraft() {
        if (this.busy || this.pendingImports) return;
        return this.run(async () => {
            await this.service.clearQuickDraft(this.draft.id); this.draft = this.service.quickDraft(); this.input.value = "";
            this.renderAttachments();
            setTimeout(() => { if (!this.closed) this.input.focus(); }, 0);
        });
    }
    async launchAction(mode) {
        const choice = mode === "file" ? this.fileAction : this.actionButtons.find(button => button.dataset.captureAction === mode);
        if (!choice || choice.hidden || choice.disabled || this.busy || this.pendingImports || this.closing) return;
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
