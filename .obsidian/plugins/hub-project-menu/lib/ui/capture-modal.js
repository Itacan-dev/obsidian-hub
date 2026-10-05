"use strict";
const { Modal } = require("obsidian");
const { setHubIcon } = require("./icons");

let instance = 0;
function action(host, text, icon, callback, cls = "") {
    const button = host.createEl("button", { cls, attr: { type: "button" } });
    if (icon) setHubIcon(button.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), icon);
    button.createSpan({ text });
    button.addEventListener("click", callback);
    return button;
}

// Native Modal owns focus trapping and Escape. Both capture surfaces share
// save blocking, native feedback, and restoration to the actual invoking input.
class CaptureModal extends Modal {
    constructor(app, service, options = {}) {
        super(app); this.service = service; this.options = options;
        this.returnFocus = options.returnFocus ?? app.workspace?.activeLeaf?.view?.containerEl?.ownerDocument?.activeElement ?? globalThis.document?.activeElement;
        this.prefix = `hub-capture-${++instance}`; this.busy = false; this.closed = false;
    }
    header(title, subtitle) {
        this.contentEl.classList.add("hub-button-scope", "hub-capture-content", "hub-capture-form-scope");
        const header = this.contentEl.createEl("header", { cls: "hub-capture-header" });
        header.createEl("h2", { text: title, attr: { id: this.prefix + "-title" } });
        header.createEl("p", { text: subtitle, cls: "hub-oath-muted", attr: { id: this.prefix + "-description" } });
        this.modalEl.setAttribute("aria-labelledby", this.prefix + "-title");
        this.modalEl.setAttribute("aria-describedby", this.prefix + "-description");
        const close = this.modalEl.querySelector(".modal-close-button");
        close?.setAttribute("aria-label", "Close " + title);
        close?.setAttribute("title", "Close " + title);
        this.error = this.contentEl.createDiv({ cls: "hub-task-error hub-capture-error", attr: { role: "alert" } });
    }
    async run(work) {
        if (this.busy || this.closed) return;
        this.busy = true; this.error.textContent = "";
        const controls = [...this.contentEl.querySelectorAll("button,input,textarea,select")];
        const disabled = controls.map(control => control.disabled);
        controls.forEach(control => control.disabled = true);
        this.modalEl.setAttribute("aria-busy", "true");
        try { return await work(); }
        catch (error) {
            this.onProblem?.(error);
            if (!this.closed) this.error.textContent = error.message || "Could not save. Please try again.";
        }
        finally {
            this.busy = false; this.modalEl.removeAttribute("aria-busy");
            controls.forEach((control, index) => { control.disabled = disabled[index]; });
            this.form?.refresh?.();
            this.sync?.();
        }
    }
    close() { if (!this.busy) super.close(); }
    finish() { this.busy = false; this.close(); }
    onClose() {
        this.closed = true; this.stop?.(); this.form?.destroy(); this.contentEl.empty();
        this.options.onClose?.();
        if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
    }
}

// Small native confirmations share capture typography, buttons and focus/Escape
// handling. Closing the dialog always means Cancel.
class CaptureConfirmation extends CaptureModal {
    ask() { return new Promise(resolve => { this.resolve = resolve; this.open(); }); }
    onOpen() {
        this.modalEl.classList.add("hub-capture-confirmation");
        this.header(this.options.title, this.options.message);
        const actions = this.contentEl.createDiv({ cls: "hub-capture-actions" });
        const cancel = action(actions, "Cancel", null, () => this.close());
        action(actions, this.options.confirmLabel, null, () => {
            this.resolve?.(true); this.resolve = null; this.close();
        }, this.options.destructive ? "mod-warning" : "mod-cta");
        cancel.focus();
    }
    onClose() { this.resolve?.(false); this.resolve = null; super.onClose(); }
}

function attachments(host, refs, service, { remove, open } = {}) {
    host.empty();
    for (const ref of refs) {
        const row = host.createDiv({ cls: "hub-capture-attachment" });
        const file = service.plugin.app.vault.getAbstractFileByPath(service.attachmentPath?.(ref) ?? ref.path);
        if (file && (ref.mime?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(ref.name))) {
            row.createEl("img", { cls: "hub-capture-thumbnail", attr: { src: service.plugin.app.vault.getResourcePath(file), alt: "" } });
        } else setHubIcon(row.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), ref.mime?.startsWith("image/") ? "image" : "file");
        const copy = row.createDiv({ cls: "hub-capture-attachment-copy" });
        copy.createDiv({ text: ref.name, cls: "hub-capture-filename", attr: { title: ref.name } });
        copy.createDiv({ cls: "hub-capture-muted", text: !file ? "Source file unavailable" : ref.size ? `${Math.max(1, Math.round(ref.size / 1024)).toLocaleString()} KB` : "File" });
        if (open && file) action(row, "Open", "external-link", () => open(ref), "hub-capture-small-action");
        if (remove) {
            const button = action(row, "", "x", () => remove(ref), "hub-capture-small-action");
            button.setAttribute("aria-label", "Remove " + ref.name);
            button.setAttribute("title", "Remove " + ref.name);
        }
    }
}

module.exports = { CaptureModal, CaptureConfirmation, action, attachments };
