"use strict";
const { createWindowTitle, setWindowUndertext } = require("./window-title");
const { Modal, setIcon } = require("obsidian");
const { setHubTooltip } = require("./tooltips");
const { SETTINGS_PAGES, renderSettingsPage } = require("./settings-pages");
let instance = 0;

class SettingsModal extends Modal {
    constructor(app, onClose, plugin) { super(app); this.closed = onClose; this.plugin = plugin; this.prefix = `hub-settings-${++instance}`; }
    onOpen() {
        this.modalEl.classList.add("hub-settings-dialog");
        this.contentEl.classList.add("hub-settings-content", "hub-button-scope");
        const header = this.contentEl.createEl("header", { cls: "hub-settings-header" });
        const heading = createWindowTitle(header, "Settings", "settings", { attr: { id: `${this.prefix}-title` } });
        this.modalEl.setAttribute("aria-labelledby", `${this.prefix}-title`);
        setWindowUndertext(heading, header.createEl("p", { cls: "hub-settings-description", text: "Customize how Itacan looks and behaves." }));
        const body = this.contentEl.createDiv({ cls: "hub-settings-body" });
        const sidebar = body.createEl("aside", { cls: "hub-settings-sidebar" });
        const search = sidebar.createEl("input", { cls: "hub-settings-search", attr: {
            type: "search", placeholder: "Search settings", "aria-label": "Search settings (preview only)",
            title: "Search is not active in this preview."
        } });
        search.autocomplete = "off";
        this.tabs = sidebar.createDiv({ cls: "hub-settings-categories", attr: { role: "tablist", "aria-label": "Settings categories", "aria-orientation": "vertical" } });
        this.buttons = SETTINGS_PAGES.map(page => {
            const button = this.tabs.createEl("button", { text: page.title, cls: "hub-settings-category" + (page.id === "about" ? " hub-settings-about" : ""),
                attr: { type: "button", role: "tab", id: `${this.prefix}-${page.id}`, "aria-controls": `${this.prefix}-panel` } });
            button.addEventListener("click", () => this.select(page.id));
            return button;
        });
        this.tabs.addEventListener("keydown", event => {
            const index = this.buttons.indexOf(event.target);
            if (index < 0) return;
            const next = event.key === "ArrowDown" ? (index + 1) % this.buttons.length : event.key === "ArrowUp" ?
                (index + this.buttons.length - 1) % this.buttons.length : event.key === "Home" ? 0 : event.key === "End" ? this.buttons.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); this.select(SETTINGS_PAGES[next].id); this.buttons[next].focus();
        });
        this.panel = body.createDiv({ cls: "hub-settings-panel", attr: { role: "tabpanel", id: `${this.prefix}-panel`, tabindex: "0" } });
        this.select("appearance");
    }
    select(id) {
        const page = SETTINGS_PAGES.find(page => page.id === id);
        if (!page) return;
        this.buttons.forEach((button, index) => {
            const selected = SETTINGS_PAGES[index].id === id;
            button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1;
        });
        this.panel.setAttribute("aria-labelledby", `${this.prefix}-${id}`);
        this.disposePage?.(); this.panel.empty(); this.disposePage = renderSettingsPage(this.panel, page, this.plugin); this.panel.scrollTop = 0;
    }
    onClose() { this.disposePage?.(); this.contentEl.empty(); this.closed?.(); }
}

function mountSettingsControl(plugin, host) {
    const button = host.createEl("button", { cls: "hub-oath-button hub-settings-button",
        attr: { type: "button", "aria-label": "Settings", "aria-haspopup": "dialog" } });
    setIcon(button.createSpan({ cls: "hub-oath-icon", attr: { "aria-hidden": "true" } }), "settings");
    button.createSpan({ text: "Settings" }); setHubTooltip(button, "Settings", "top");
    let modal = null, destroyed = false;
    const open = () => {
        if (destroyed) return;
        if (modal) { modal.panel?.focus(); return; }
        // Keep existing modal/Oath interactions in charge while another window is open.
        if (button.ownerDocument.querySelector(".modal-container")) return;
        modal = new SettingsModal(plugin.app, () => { modal = null; if (!destroyed && button.isConnected) button.focus(); }, plugin);
        modal.open();
    };
    plugin.registerDomEvent(button, "click", open);
    return { button, open, destroy() { destroyed = true; modal?.close(); button.remove(); } };
}
module.exports = { SettingsModal, mountSettingsControl };
