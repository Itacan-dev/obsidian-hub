"use strict";
const { Notice } = require("obsidian");
const { CaptureModal, action, attachments } = require("./capture-modal");
const { mountCaptureForm } = require("./capture-form");
const { mountCaptureGuidance } = require("./inbox-guidance");
const { linkFromText } = require("../domain/inbox");

class QuickAddModal extends CaptureModal {
    constructor(app, service, options = {}) {
        super(app, service, options);
        this.draft = { text: "", attachments: [], inputPath: "text", type: null, source: options.source ?? { origin: "Quick Add" } };
        this.saved = false;
        this.pendingImports = 0; this.importQueue = Promise.resolve();
    }
    onOpen() {
        this.modalEl.classList.add("hub-quick-add-dialog");
        this.header("Quick Add", "Write down a thought, or add a file.", "zap");
        this.body = this.contentEl.createDiv({ cls: "hub-capture-body" });
        this.textPath = this.body.createDiv({ cls: "hub-capture-input-path", attr: { "data-capture-field": "Content" } });
        this.label = this.textPath.createEl("label", { cls: "hub-capture-label", attr: { for: this.prefix + "-input" } }); this.label.hidden = true;
        this.textEditor = this.textPath.createDiv({ cls: "hub-capture-text-editor" });
        this.input = this.textEditor.createEl("textarea", { cls: "hub-quick-add-input", attr: { id: this.prefix + "-input", "aria-label": "Write something", rows: "3", placeholder: "Start typing..." } });
        this.clear = action(this.textEditor, "", "x", () => {
            this.input.value = ""; this.draft.text = ""; this.form?.update({ text: "" }); this.sync(); this.input.focus();
        }, "hub-capture-clear");
        this.clear.setAttribute("aria-label", "Clear"); this.clear.title = "Clear";
        this.input.addEventListener("input", () => {
            if (this.draft.attachments.length || this.pendingImports) return;
            this.draft.text = this.input.value; this.form?.update({ text: this.input.value }); this.sync();
        });
        this.input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                if (!this.add.hidden && !this.add.disabled && this.add.getAttribute("aria-disabled") !== "true") void this.addDirect();
                else if (!this.send.disabled) void this.sendInbox();
            }
        });
        this.input.addEventListener("paste", event => {
            const files = [...(event.clipboardData?.files ?? [])];
            if (!files.length) return;
            event.preventDefault();
            void this.addAttachments(files);
        });
        this.body.addEventListener("dragover", event => {
            if ([...(event.dataTransfer?.types ?? [])].some(type => ["Files", "text/uri-list", "text/plain"].includes(type))) {
                event.preventDefault(); event.dataTransfer.dropEffect = "copy";
            }
        });
        this.body.addEventListener("drop", event => {
            const files = [...(event.dataTransfer?.files ?? [])];
            if (files.length) {
                event.preventDefault(); event.stopPropagation(); void this.addAttachments(files); return;
            }
            const links = (event.dataTransfer?.getData("text/uri-list") ?? "").split(/\r?\n/).filter(line => line && !line.startsWith("#"));
            const text = links.length ? links.filter(link => linkFromText(link)).join("\n") : event.dataTransfer?.getData("text/plain") ?? "";
            if (!text) return;
            event.preventDefault(); event.stopPropagation();
            if (this.busy || this.pendingImports) { this.error.textContent = "Wait for the current save before adding more content."; return; }
            if (this.draft.attachments.length) { this.error.textContent = "Remove the file before writing something."; return; }
            const start = event.target === this.input ? this.input.selectionStart : this.input.value.length;
            const end = event.target === this.input ? this.input.selectionEnd : start;
            const prefix = event.target !== this.input && this.input.value && !this.input.value.endsWith("\n") ? "\n" : "";
            this.input.setRangeText(prefix + text, start, end, "end");
            this.draft.text = this.input.value; this.form?.update({ text: this.input.value }); this.sync(); this.input.focus();
        });
        this.attachmentList = this.body.createDiv({ cls: "hub-capture-attachments", attr: { "data-capture-field": "File" } });
        this.fileInput = this.body.createEl("input", { attr: { type: "file", multiple: "", hidden: "", tabindex: "-1", "aria-label": "Choose a file" } });
        this.fileInput.addEventListener("change", () => { void this.addAttachments([...this.fileInput.files]); this.fileInput.value = ""; });
        this.attach = action(this.body, "Add a file", "paperclip", () => this.fileInput.click(), "hub-capture-attach");
        this.expanded = this.body.createDiv({ cls: "hub-capture-expanded" }); this.expanded.hidden = true;
        const footer = this.contentEl.createDiv({ cls: "hub-capture-actions" });
        this.cancel = action(footer, "Cancel", null, () => this.close());
        this.more = action(footer, "More options", null, () => this.expand());
        this.send = action(footer, "Send to Inbox", null, () => { void this.sendInbox(); }, "mod-cta");
        this.add = action(footer, "Add to Itacan", null, () => { void this.addDirect(); }, "mod-cta hub-guided-submit"); this.add.hidden = true;
        this.guidance = mountCaptureGuidance({ body: this.body,
            completion: () => this.service.completion(this.form?.value() ?? this.draft, this.captureId) });
        this.sync(); this.input.focus();
    }
    expand() {
        if (this.form || this.busy || this.pendingImports || (!this.draft.text.trim() && !this.draft.attachments.length)) return;
        this.more.hidden = true; this.add.hidden = false;
        this.expanded.hidden = false; this.modalEl.classList.add("is-expanded");
        if (this.draft.attachments.length) this.draft.type = "file";
        this.form = mountCaptureForm({ host: this.expanded, service: this.service, draft: this.draft,
            captureId: () => this.captureId,
            onChange: value => { this.draft = value; this.sync(); } });
        this.sync(); this.form.focus?.();
    }
    sync() {
        if (this.closed || !this.send) return;
        const file = !!this.draft.attachments.length, waiting = this.busy || !!this.pendingImports;
        const text = !!this.draft.text.trim(), content = file || text;
        if (!content && !waiting && this.form) {
            this.form.destroy(); this.form = null; this.more.hidden = false; this.add.hidden = true;
            this.expanded.hidden = true; this.modalEl.classList.remove("is-expanded");
        }
        const complete = !!this.form?.valid();
        this.textPath.hidden = file;
        const pendingNote = this.service.get(this.captureId)?.operation?.kind === "note-insertion";
        this.input.disabled = waiting || file || pendingNote;
        this.label.hidden = true;
        this.input.setAttribute("aria-label", this.draft.type === "task" ? "Task" : this.draft.type === "note" ? "Note content" : "Write something");
        this.clear.hidden = !this.draft.text.length || file; this.clear.disabled = waiting || pendingNote;
        this.textEditor.classList.toggle("has-text", !!this.draft.text.length);
        this.attach.hidden = file || text;
        this.attach.disabled = waiting || text;
        this.fileInput.disabled = this.attach.disabled;
        this.more.disabled = waiting || !content;
        this.send.disabled = waiting || complete || !content;
        this.send.classList.toggle("mod-cta", !this.form);
        this.add.disabled = waiting;
        this.add.setAttribute("aria-disabled", String(waiting || !complete));
        if (pendingNote) this.expanded.querySelectorAll("button,input,select,textarea").forEach(control => control.disabled = true);
        this.guidance?.update();
    }
    renderAttachments() {
        attachments(this.attachmentList, this.draft.attachments, this.service, { remove: ref => {
            void this.run(async () => {
                await this.service.releaseAttachments([ref]);
                this.draft.attachments = this.draft.attachments.filter(item => item.id !== ref.id);
                if (!this.draft.attachments.length) { this.draft.inputPath = "text"; this.draft.type = null; }
                this.form?.update({ attachments: this.draft.attachments, inputPath: this.draft.inputPath, type: this.draft.type }); this.renderAttachments();
            });
        } });
        this.form?.update({ attachments: this.draft.attachments }); this.sync();
    }
    addAttachments(files) {
        if (!files?.length) return Promise.resolve();
        if (this.draft.text.trim()) {
            this.error.textContent = "Clear the text before adding a file.";
            return Promise.resolve();
        }
        if (this.busy && !this.pendingImports) {
            this.error.textContent = "Wait for the current save before adding more files.";
            return Promise.resolve();
        }
        this.pendingImports++; this.sync();
        const operation = this.importQueue.then(() => this.run(async () => {
            const refs = await this.service.stageFiles(files);
            if (refs.length) {
                this.draft.attachments.push(...refs); this.draft.inputPath = "file"; this.draft.type = "file";
                this.form?.update({ inputPath: "file", type: "file", attachments: this.draft.attachments }); this.renderAttachments();
            }
        })).finally(() => { this.pendingImports--; this.sync(); });
        this.importQueue = operation.catch(() => {});
        return operation;
    }
    sendInbox() {
        if (this.busy || this.pendingImports) return;
        if (!this.draft.text.trim() && !this.draft.attachments.length) return;
        if (this.form?.valid()) return;
        return this.run(async () => {
            if (this.captureId) await this.service.updateCapture(this.captureId, this.draft);
            else await this.service.capture(this.draft);
            this.saved = true;
            new Notice("Sent to Inbox."); this.finish();
        });
    }
    addDirect() {
        if (this.busy || this.pendingImports) return;
        if (!this.form?.valid()) {
            // Use the same required-field ordering as Inbox. Optional invalid
            // edits retain meaningful errors without becoming amber targets.
            if (!this.guidance?.guide()) this.error.textContent = this.service.completion(this.form?.value() ?? this.draft, this.captureId).error ?? "";
            return;
        }
        return this.run(async () => {
            const draft = this.form.value();
            const result = draft.type === "task" ? await this.service.makeTask(draft, this.captureId) : draft.type === "note" ?
                await this.service.createNote(draft, this.captureId) : await this.service.addFiles(draft, this.captureId);
            this.saved = true; new Notice(result?.message ?? `Added ${draft.type}.`); this.finish();
        });
    }
    onProblem(error) {
        if (error.captureId) this.captureId = error.captureId;
        if (error.noteLocationInvalid) this.form?.update({ noteLocation: null });
    }
    close() { if (!this.pendingImports) super.close(); }
    onClose() {
        this.guidance?.destroy();
        if (!this.saved && this.draft.attachments.length) void this.service.releaseAttachments(this.draft.attachments)
            .catch(error => new Notice(`Could not remove temporary attachment: ${error.message}`));
        super.onClose();
    }
}
module.exports = { QuickAddModal };
