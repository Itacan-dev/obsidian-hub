"use strict";
const { createWindowTitle } = require("./window-title");
const { lockModalControls } = require("./modal-save");

function showPresetsMenu(anchor, presets) {
    const { Menu, Modal, Notice, setIcon } = require("obsidian");
    const doc = anchor.ownerDocument;
    const menu = doc.createElement("div");
    menu.className = "menu hub-presets-menu hub-button-scope";
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;
    let closed = false;
    let nameModal = null;
    let contextMenu = null;
    const reorder = require("./pointer-list-reorder").createPointerListReorder({
        container: menu, canStart: event => !event.target.closest("button") && !contextMenu,
        commit: rows => presets.reorder(rows.map(row => row.dataset.presetId)),
        onError: error => new Notice(error.message || "Could not reorder presets.")
    });
    const run = action => Promise.resolve().then(action).catch(error => new Notice(error.message || "Could not update preset."));
    function close() {
        if (closed) return;
        reorder.cancel();
        closed = true; menu.remove(); anchor.setAttribute("aria-expanded", "false");
        contextMenu?.hide();
        doc.removeEventListener("pointerdown", outside, true);
        doc.defaultView.removeEventListener("resize", position);
        doc.defaultView.visualViewport?.removeEventListener("resize", position);
        doc.defaultView.visualViewport?.removeEventListener("scroll", position);
    }
    function outside(event) {
        if (reorder.busy) return;
        // Native menus/modals are portalled to body, but still belong to this
        // dropdown. Only a genuinely external click dismisses the parent menu.
        if (contextMenu?.dom?.contains(event.target) ||
            (nameModal?.containerEl ?? nameModal?.modalEl ?? nameModal?.contentEl)?.contains(event.target)) return;
        if (!menu.contains(event.target) && !anchor.contains(event.target)) close();
    }
    function focusMenu() {
        if (!closed) menu.focus({ preventScroll: true });
    }
    function manage(action) {
        return run(async () => { await action(); render(); focusMenu(); });
    }
    function move(preset, direction, restoreFocus) {
        return run(async () => {
            const ids = presets.items.map(item => item.id), index = ids.indexOf(preset.id), next = index + direction;
            if (index < 0 || next < 0 || next >= ids.length) return;
            [ids[index], ids[next]] = [ids[next], ids[index]];
            await presets.reorder(ids); render();
            if (restoreFocus && !closed) {
                const row = [...menu.querySelectorAll('[data-preset-id]')].find(row => row.dataset.presetId === preset.id);
                row?.focus({ preventScroll: true }); row?.scrollIntoView({ block: "nearest" });
            }
        });
    }
    function namePrompt(title, value, save) {
        class NameModal extends Modal {
            onOpen() {
                this.contentEl.addClass("hub-button-scope");
                createWindowTitle(this.contentEl, title, "panels-top-left");
                const input = this.contentEl.createEl("input", { type: "text", cls: "hub-preset-name" });
                input.value = value; input.placeholder = presets.defaultName(); input.setAttribute("aria-label", "Preset name");
                const actions = this.contentEl.createDiv({ cls: "hub-project-wizard-actions" });
                const cancel = actions.createEl("button", { text: "Cancel" });
                const done = actions.createEl("button", { text: "Save", cls: "mod-cta" });
                cancel.type = done.type = "button";
                this.saving = false;
                const commit = async () => {
                    if (this.saving) return;
                    this.saving = true;
                    const restoreControls = lockModalControls(this);
                    try {
                        await save(input.value); render();
                        this.saving = false; restoreControls(); this.close();
                    } catch (error) {
                        this.saving = false; restoreControls(); new Notice(error.message);
                    }
                };
                cancel.addEventListener("click", () => this.close());
                done.addEventListener("click", commit);
                input.addEventListener("keydown", event => {
                    if (event.key === "Enter" && !event.isComposing && !event.repeat) { event.preventDefault(); void commit(); }
                });
                input.focus(); input.select();
            }
            close() { if (!this.saving) super.close(); }
            onClose() { this.contentEl.empty(); if (nameModal === this) nameModal = null; focusMenu(); }
        }
        nameModal = new NameModal(presets.modes.app);
        nameModal.open();
    }
    function row(text, action, parent = menu, iconName) {
        const item = parent.appendChild(doc.createElement("div"));
        item.className = "menu-item"; item.setAttribute("role", "menuitem"); item.tabIndex = -1;
        if (iconName) {
            const icon = item.appendChild(doc.createElement("span"));
            icon.className = "hub-preset-icon"; icon.setAttribute("aria-hidden", "true"); setIcon(icon, iconName);
        }
        const title = item.appendChild(doc.createElement("div")); title.className = "menu-item-title"; title.textContent = text;
        item.addEventListener("click", action); return item;
    }
    function separator() {
        const divider = menu.appendChild(doc.createElement("div"));
        divider.className = "menu-separator";
        divider.setAttribute("role", "separator");
    }
    function render() {
    if (closed) return;
    reorder.cancel();
    menu.replaceChildren();
    if (presets.canSave) {
        const action = row("Save as new preset", () => namePrompt("Save preset", "", name => presets.create(name)));
        action.classList.add("hub-preset-create");
        const icon = doc.createElement("span");
        icon.className = "hub-preset-create-icon";
        icon.setAttribute("aria-hidden", "true");
        setIcon(icon, "plus");
        action.prepend(icon);
    }
    if (presets.items.length && presets.canSave) separator();
    const list = menu.appendChild(doc.createElement("div"));
    list.className = "hub-preset-list"; list.setAttribute("role", "group"); list.setAttribute("aria-label", "Saved presets");
    for (const preset of presets.items) {
        const item = row(preset.name, () => { close(); void run(() => presets.open(preset.id, anchor)); }, list, "panels-top-left");
        item.dataset.presetId = preset.id;
        item.addEventListener("pointerdown", event => reorder.begin(event, item, list));
        const showContextMenu = event => {
            event.preventDefault(); event.stopPropagation();
            if (reorder.active) return;
            reorder.cancel();
            contextMenu?.hide();
            let restoreFocus = event.type === "keydown" || (event.type === "click" && event.detail === 0);
            const context = new Menu();
            contextMenu = context;
            const keyboard = () => { restoreFocus = true; }, pointer = () => { restoreFocus = false; };
            doc.addEventListener("keydown", keyboard, true); doc.addEventListener("pointerdown", pointer, true);
            context.onHide(() => {
                doc.removeEventListener("keydown", keyboard, true); doc.removeEventListener("pointerdown", pointer, true);
                if (contextMenu === context) contextMenu = null;
                const focused = doc.activeElement;
                if (restoreFocus && !closed && !nameModal && (focused === doc.body || context.dom?.contains(focused))) item.focus({ preventScroll: true });
            });
            context.addItem(item => item.setTitle("Rename").setIcon("pencil").onClick(() =>
                namePrompt("Rename preset", preset.name, name => presets.rename(preset.id, name))));
            context.addItem(item => item.setTitle("Update preset").setIcon("save").setDisabled(!presets.canSave)
                .onClick(() => { void manage(() => presets.update(preset.id)); }));
            const index = presets.items.findIndex(item => item.id === preset.id);
            context.addItem(item => item.setTitle("Move up").setIcon("arrow-up").setDisabled(index <= 0)
                .onClick(() => { void move(preset, -1, restoreFocus); }));
            context.addItem(item => item.setTitle("Move down").setIcon("arrow-down").setDisabled(index < 0 || index === presets.items.length - 1)
                .onClick(() => { void move(preset, 1, restoreFocus); }));
            context.addSeparator();
            context.addItem(item => item.setTitle("Delete").setIcon("trash-2").setWarning(true)
                .onClick(() => { void manage(() => presets.delete(preset.id)); }));
            if (event.type === "contextmenu") context.showAtMouseEvent(event);
            else { const rect = item.getBoundingClientRect(); context.showAtPosition({ x: rect.left, y: rect.bottom }); }
        };
        item.addEventListener("contextmenu", showContextMenu);
        const more = item.appendChild(doc.createElement("button"));
        more.type = "button"; more.className = "hub-preset-more hub-button-plain"; more.tabIndex = -1;
        more.setAttribute("aria-label", `Manage ${preset.name}`); more.setAttribute("aria-haspopup", "menu");
        setIcon(more, "ellipsis");
        more.addEventListener("click", showContextMenu);
        item.addEventListener("keydown", event => {
            if (event.key === "ArrowRight") showContextMenu(event);
            if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) showContextMenu(event);
        });
    }
    if (!presets.items.length && !presets.canSave) {
        const empty = row("No presets", () => {}); empty.setAttribute("aria-disabled", "true"); empty.classList.add("is-disabled");
    }
    position();
    }
    menu.addEventListener("keydown", event => {
        const items = [...menu.querySelectorAll('[role="menuitem"]:not([aria-disabled=true])')];
        const index = items.indexOf(doc.activeElement?.closest('[role="menuitem"]'));
        if (event.key === "Escape" || event.key === "Tab") { close(); if (event.key === "Escape") { event.preventDefault(); anchor.focus(); } return; }
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); doc.activeElement?.click(); }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && items.length) {
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
                index < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1) :
                (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next].focus();
        }
    });
    doc.body.append(menu);
    function position() {
    if (closed) return;
    const win = doc.defaultView, viewport = win.visualViewport;
    const left = (viewport?.offsetLeft ?? 0) + 8, top = (viewport?.offsetTop ?? 0) + 8;
    const right = left + (viewport?.width ?? win.innerWidth) - 16;
    const bottom = top + (viewport?.height ?? win.innerHeight) - 16;
    const rect = anchor.getBoundingClientRect();
    menu.style.maxWidth = `${Math.min(320, Math.max(0, right - left))}px`;
    menu.style.minWidth = `${Math.min(200, Math.max(0, right - left))}px`;
    menu.style.maxHeight = "";
    const below = Math.max(0, bottom - Math.max(top, rect.bottom + 6)), above = Math.max(0, Math.min(bottom, rect.top - 6) - top);
    const placeAbove = menu.offsetHeight > below && above > below;
    menu.style.maxHeight = `${placeAbove ? above : below}px`;
    menu.style.left = `${Math.max(left, Math.min(rect.left, right - menu.offsetWidth))}px`;
    menu.style.top = `${Math.max(top, Math.min(placeAbove ? rect.top - 6 - menu.offsetHeight : rect.bottom + 6, bottom - menu.offsetHeight))}px`;
    }
    render();
    anchor.setAttribute("aria-expanded", "true");
    doc.addEventListener("pointerdown", outside, true);
    doc.defaultView.addEventListener("resize", position);
    doc.defaultView.visualViewport?.addEventListener("resize", position);
    doc.defaultView.visualViewport?.addEventListener("scroll", position);
    focusMenu();
    return { close, destroy() { close(); nameModal?.close(); } };
}

module.exports = { showPresetsMenu };
