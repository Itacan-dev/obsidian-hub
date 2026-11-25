"use strict";
const { mountModalSeparators } = require("./window-title");

const { Modal, TFile } = require("obsidian");
const { ownModalColors } = require("./color-system");
const { createIconAction } = require("./controls");
const { setHubTooltip } = require("./tooltips");

const images = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"]);
const textLimit = 512 * 1024;
const imageLimit = 24 * 1024 * 1024;

function createPreviewRenderer(vault, host, canPreview) {
    let generation = 0;
    const message = text => host.createDiv({ cls: "hub-file-preview-message", text, attr: { role: "status" } });
    function clear() { generation++; host.replaceChildren(); host.scrollTop = 0; }
    async function render(path) {
        clear();
        const ticket = generation;
        if (!path) { message("Select a file to preview."); return; }
        if (!canPreview(path)) { message("This file is unavailable during the Oath."); return; }
        const file = vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) { message("File unavailable."); return; }
        host.createEl("h3", { cls: "hub-file-preview-title", text: file.name });
        const type = file.extension.toLowerCase();
        if (images.has(type)) {
            if (file.stat.size > imageLimit) { message("This image is too large to preview."); return; }
            const image = host.createEl("img", { attr: { alt: file.basename } });
            image.addEventListener("error", () => {
                if (generation !== ticket) return;
                image.remove(); message("Could not preview this image.");
            }, { once: true });
            image.src = vault.getResourcePath(file);
            return;
        }
        if (type !== "md" && type !== "txt") { message("Preview is unavailable for this file type."); return; }
        if (file.stat.size > textLimit) { message("This file is too large to preview."); return; }
        const loading = message("Loading preview…");
        try {
            const source = await vault.cachedRead(file);
            if (generation !== ticket) return;
            loading.remove();
            // Showing the source keeps note embeds, plugin code and interactive
            // checkboxes out of this read-only surface.
            host.createEl("pre", { cls: "hub-file-preview-text", text: source });
        } catch {
            if (generation !== ticket) return;
            loading.textContent = "Could not read this file.";
        }
    }
    return { clear, render };
}

class FilePreviewModal extends Modal {
    constructor(app, path, canPreview, onDone) {
        super(app);
        this.path = path;
        this.canPreview = canPreview;
        this.onDone = onDone;
    }
    onOpen() {
        ownModalColors(this);
        this.titleEl.setText("File preview");
        mountModalSeparators(this);
        this.modalEl.classList.add("hub-file-preview-window");
        const preview = this.contentEl.createDiv({ cls: "hub-file-preview hub-scrollbar", attr: { tabindex: "0", "aria-label": "File preview" } });
        preview.addEventListener("keydown", event => {
            if (event.key !== "Escape") return;
            event.preventDefault(); event.stopPropagation();
            this.close();
        });
        queueMicrotask(() => { if (preview.isConnected) preview.focus({ preventScroll: true }); });
        this.renderer = createPreviewRenderer(this.app.vault, preview, this.canPreview);
        void this.renderer.render(this.path);
    }
    onClose() { this.renderer?.clear(); this.onDone(); }
}

function mountFilePreview({ app, oath, panel, signal, workspaceId, getSelection, updateWidth }) {
    const doc = panel.ownerDocument;
    const body = panel.querySelector(".hub-explorer-body");
    const button = createIconAction(body.querySelector(".hub-explorer-toolbar"), "Preview selected file", "eye");
    const host = body.createEl("aside", { cls: "hub-file-preview hub-scrollbar", attr: {
        "aria-label": "File preview", tabindex: "0"
    } });
    host.id = "hub-file-preview-" + doc.defaultView.crypto.randomUUID();
    button.setAttribute("aria-controls", host.id);
    const canPreview = path => oath?.canOpen(path, false) !== false;
    const renderer = createPreviewRenderer(app.vault, host, canPreview);
    const events = new doc.defaultView.AbortController();
    const storage = doc.defaultView.sessionStorage;
    const key = "obsidian-hub::file-preview::" + workspaceId;
    let expanded = false, path = null, rendered = null, modal = null;
    let enabled = storage.getItem(key) !== "false";

    function sync() {
        const visible = expanded && enabled;
        button.disabled = !expanded && !path;
        const label = expanded ? (visible ? "Hide file preview" : "Show file preview") : "Preview selected file";
        button.setAttribute("aria-label", label);
        setHubTooltip(button, label);
        if (expanded) {
            button.removeAttribute("aria-haspopup");
            button.setAttribute("aria-pressed", String(visible));
            button.setAttribute("aria-controls", host.id);
        } else {
            button.setAttribute("aria-haspopup", "dialog");
            button.removeAttribute("aria-pressed");
            button.removeAttribute("aria-controls");
        }
        const layoutChanged = host.hidden === visible;
        host.hidden = !visible;
        body.classList.toggle("is-previewing", visible);
        if (layoutChanged) updateWidth();
        if (visible) {
            if (rendered !== path) { rendered = path; void renderer.render(path); }
        } else { rendered = undefined; renderer.clear(); }
    }
    function selectionChanged(event) { path = event.detail.path; sync(); }
    function show(filePath) {
        if (expanded && enabled) { path = filePath; sync(); return; }
        modal?.close();
        const selected = [...panel.querySelectorAll(".hub-explorer-contents [data-path]")].find(row => row.dataset.path === filePath);
        const focus = panel.contains(doc.activeElement) ? doc.activeElement : selected;
        modal = new FilePreviewModal(app, filePath, canPreview, () => {
            modal = null;
            if (!events.signal.aborted && focus?.isConnected) focus.focus({ preventScroll: true });
        });
        modal.open();
    }
    panel.addEventListener("hub-explorer-file-selection", selectionChanged, { signal: events.signal });
    button.addEventListener("click", () => {
        if (!expanded) { if (path) show(path); return; }
        enabled = !enabled;
        storage.setItem(key, String(enabled));
        path = getSelection();
        sync();
    }, { signal: events.signal });
    const update = file => {
        if (expanded && enabled && file.path === path) void renderer.render(path);
        if (modal?.path === file.path) void modal.renderer?.render(modal.path);
    };
    const refs = ["modify", "delete"].map(name => app.vault.on(name, update));
    refs.push(app.vault.on("rename", (file, oldPath) => {
        if (path === oldPath) { path = file.path; sync(); }
        if (modal?.path === oldPath) { modal.path = file.path; void modal.renderer?.render(file.path); }
    }));
    const stopOath = oath?.onChange(() => {
        if (expanded && enabled) void renderer.render(path);
        if (modal) void modal.renderer?.render(modal.path);
    });
    function dispose() {
        if (events.signal.aborted) return;
        signal.removeEventListener("abort", dispose);
        events.abort(); refs.forEach(ref => app.vault.offref(ref)); stopOath?.();
        modal?.close(); renderer.clear();
        body.classList.remove("is-previewing");
        host.remove(); button.remove(); updateWidth();
    }
    signal.addEventListener("abort", dispose, { once: true });
    path = getSelection();
    sync();
    return { show, dispose, setExpanded(active) {
        if (events.signal.aborted) return;
        expanded = active; path = getSelection(); sync();
    } };
}

module.exports = { mountFilePreview };
