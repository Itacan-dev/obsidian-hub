"use strict";
const { createWindowTitle } = require("./window-title");
const { Modal, setIcon } = require("obsidian");
const { setHubTooltip } = require("./tooltips");
let instance = 0;

class MusicModal extends Modal {
    constructor(app, onClose) { super(app); this.closed = onClose; this.titleId = `hub-music-${++instance}-title`; }
    onOpen() {
        this.modalEl.classList.add("hub-oath-dialog", "hub-music-dialog");
        this.contentEl.classList.add("hub-button-scope");
        this.contentEl.tabIndex = -1;
        createWindowTitle(this.contentEl, "Music", "music", { attr: { id: this.titleId } });
        this.modalEl.setAttribute("aria-labelledby", this.titleId);
        this.contentEl.focus();
    }
    onClose() { this.contentEl.empty(); this.closed?.(); }
}

function mountMusicControl(plugin, host) {
    const button = host.createEl("button", { cls: "hub-oath-button hub-music-button",
        attr: { type: "button", "aria-label": "Music", "aria-haspopup": "dialog" } });
    setIcon(button.createSpan({ cls: "hub-oath-icon", attr: { "aria-hidden": "true" } }), "music");
    button.createSpan({ text: "Music" }); setHubTooltip(button, "Music", "top");
    let modal = null, destroyed = false;
    const open = () => {
        if (destroyed) return;
        if (modal) { modal.contentEl.focus(); return; }
        if (button.ownerDocument.querySelector(".modal-container")) return;
        modal = new MusicModal(plugin.app, () => { modal = null; if (!destroyed && button.isConnected) button.focus(); });
        modal.open();
    };
    plugin.registerDomEvent(button, "click", open);
    return { button, open, destroy() { destroyed = true; modal?.close(); button.remove(); } };
}
module.exports = { MusicModal, mountMusicControl };
