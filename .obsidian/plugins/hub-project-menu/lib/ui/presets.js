"use strict";

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
    let drag = null;
    let suppressClick = false;
    const run = action => Promise.resolve().then(action).catch(error => new Notice(error.message || "Could not update preset."));
    function close() {
        if (closed) return;
        finishDrag(false);
        closed = true; menu.remove(); anchor.setAttribute("aria-expanded", "false");
        contextMenu?.hide();
        doc.removeEventListener("pointerdown", outside, true);
        doc.defaultView.removeEventListener("resize", close);
    }
    function outside(event) {
        if (drag) return;
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
    function namePrompt(title, value, save) {
        class NameModal extends Modal {
            onOpen() {
                this.contentEl.addClass("hub-button-scope");
                this.contentEl.createEl("h2", { text: title });
                const input = this.contentEl.createEl("input", { type: "text", cls: "hub-preset-name" });
                input.value = value; input.placeholder = presets.defaultName(); input.setAttribute("aria-label", "Preset name");
                const actions = this.contentEl.createDiv({ cls: "hub-project-wizard-actions" });
                const cancel = actions.createEl("button", { text: "Cancel" });
                const done = actions.createEl("button", { text: "Save", cls: "mod-cta" });
                cancel.type = done.type = "button";
                let saving = false;
                const commit = async () => {
                    if (saving) return;
                    saving = true; done.disabled = true;
                    try { await save(input.value); render(); this.close(); }
                    catch (error) { new Notice(error.message); saving = false; done.disabled = false; }
                };
                cancel.addEventListener("click", () => this.close());
                done.addEventListener("click", commit);
                input.addEventListener("keydown", event => {
                    if (event.key === "Enter" && !event.isComposing && !event.repeat) { event.preventDefault(); void commit(); }
                });
                input.focus(); input.select();
            }
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
    finishDrag(false);
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
        item.addEventListener("pointerdown", event => beginDrag(event, item, list));
        const showContextMenu = event => {
            event.preventDefault(); event.stopPropagation();
            if (drag?.active) return;
            finishDrag(false);
            contextMenu?.hide();
            const context = new Menu();
            contextMenu = context;
            context.onHide(() => { if (contextMenu === context) contextMenu = null; });
            context.addItem(item => item.setTitle("Rename").setIcon("pencil").onClick(() =>
                namePrompt("Rename preset", preset.name, name => presets.rename(preset.id, name))));
            context.addItem(item => item.setTitle("Update preset").setIcon("save").setDisabled(!presets.canSave)
                .onClick(() => { void manage(() => presets.update(preset.id)); }));
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
    function beginDrag(event, item, list) {
        if (event.button !== 0 || event.isPrimary === false || event.target.closest("button") || contextMenu || drag) return;
        const rows = [...list.children];
        if (rows.length < 2) return;
        drag = { item, list, rows, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            x: event.clientX, y: event.clientY, index: rows.indexOf(item), active: false };
        doc.addEventListener("pointermove", moveDrag, { passive: false });
        doc.addEventListener("pointerup", dropDrag);
        doc.addEventListener("pointercancel", cancelDrag);
        doc.addEventListener("keydown", dragKey, true);
        doc.defaultView.addEventListener("blur", cancelDrag);
    }
    function moveDrag(event) {
        const d = drag;
        if (!d || event.pointerId !== d.pointerId) return;
        d.x = event.clientX; d.y = event.clientY;
        if (!d.active) {
            if (Math.hypot(d.x - d.startX, d.y - d.startY) < 6) return;
            d.active = true;
            d.menuWidth = menu.style.width;
            menu.style.width = `${menu.getBoundingClientRect().width}px`;
            const rect = d.item.getBoundingClientRect(), listRect = d.list.getBoundingClientRect();
            d.offsetY = d.startY - rect.top; d.height = rect.height;
            // Frozen slot centers avoid feedback from rows moving around the placeholder.
            d.centers = d.rows.map(row => { const r = row.getBoundingClientRect(); return r.top - listRect.top + r.height / 2; });
            d.placeholder = doc.createElement("div"); d.placeholder.className = "hub-preset-placeholder";
            d.placeholder.style.height = `${rect.height}px`; d.placeholder.setAttribute("aria-hidden", "true");
            d.item.before(d.placeholder);
            d.item.classList.add("is-dragging");
            d.item.style.width = `${rect.width}px`; d.item.style.left = `${rect.left - listRect.left}px`;
            menu.classList.add("is-sorting-presets");
            if (event.isTrusted) menu.setPointerCapture?.(d.pointerId);
            d.frame = doc.defaultView.requestAnimationFrame(scrollDrag);
        }
        event.preventDefault(); positionDrag();
    }
    function positionDrag() {
        const d = drag;
        if (!d?.active) return;
        const rect = d.list.getBoundingClientRect();
        const top = Math.max(0, Math.min(rect.height - d.height, d.y - rect.top - d.offsetY));
        d.item.style.top = `${top}px`;
        const center = top + d.height / 2;
        let index = d.index;
        // A small dead band keeps a pointer near a boundary from toggling slots.
        while (index < d.rows.length - 1 && center > (d.centers[index] + d.centers[index + 1]) / 2 + 3) index++;
        while (index > 0 && center < (d.centers[index - 1] + d.centers[index]) / 2 - 3) index--;
        if (index !== d.index) {
            d.index = index;
            const others = d.rows.filter(row => row !== d.item);
            d.list.insertBefore(d.placeholder, others[index] ?? null);
        }
    }
    function scrollDrag() {
        const d = drag;
        if (!d?.active) return;
        const rect = menu.getBoundingClientRect(), edge = 28;
        const speed = d.y < rect.top + edge ? -8 : d.y > rect.bottom - edge ? 8 : 0;
        if (speed) { menu.scrollTop += speed; positionDrag(); }
        d.frame = doc.defaultView.requestAnimationFrame(scrollDrag);
    }
    function dropDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const rect = menu.getBoundingClientRect(), listRect = drag.list.getBoundingClientRect();
        finishDrag(event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= Math.max(rect.top, listRect.top) && event.clientY <= Math.min(rect.bottom, listRect.bottom));
    }
    function cancelDrag() { finishDrag(false); }
    function dragKey(event) {
        if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finishDrag(false); }
    }
    function finishDrag(commit) {
        const d = drag;
        if (!d) return;
        drag = null;
        doc.removeEventListener("pointermove", moveDrag);
        doc.removeEventListener("pointerup", dropDrag);
        doc.removeEventListener("pointercancel", cancelDrag);
        doc.removeEventListener("keydown", dragKey, true);
        doc.defaultView.removeEventListener("blur", cancelDrag);
        if (!d.active) return;
        doc.defaultView.cancelAnimationFrame(d.frame);
        if (menu.hasPointerCapture?.(d.pointerId)) menu.releasePointerCapture(d.pointerId);
        const ordered = d.rows.filter(row => row !== d.item); ordered.splice(d.index, 0, d.item);
        if (commit) {
            try { presets.reorder(ordered.map(row => row.dataset.presetId)); }
            catch (error) { commit = false; new Notice(error.message || "Could not reorder presets."); }
        }
        d.placeholder.remove(); d.item.classList.remove("is-dragging");
        for (const property of ["width", "left", "top"]) d.item.style.removeProperty(property);
        d.list.append(...(commit ? ordered : d.rows));
        menu.style.width = d.menuWidth;
        menu.classList.remove("is-sorting-presets");
        suppressClick = true;
        doc.defaultView.setTimeout(() => { suppressClick = false; }, 0);
        d.item.focus({ preventScroll: true });
    }
    menu.addEventListener("click", event => {
        if (suppressClick || drag?.active) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    menu.addEventListener("dragstart", event => event.preventDefault());
    menu.addEventListener("lostpointercapture", event => {
        if (drag?.pointerId === event.pointerId) finishDrag(false);
    });
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
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.left, doc.defaultView.innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.maxHeight = `${Math.max(80, doc.defaultView.innerHeight - rect.bottom - 14)}px`;
    }
    render();
    anchor.setAttribute("aria-expanded", "true");
    doc.addEventListener("pointerdown", outside, true);
    doc.defaultView.addEventListener("resize", close);
    focusMenu();
    return { close, destroy() { close(); nameModal?.close(); } };
}

module.exports = { showPresetsMenu };
