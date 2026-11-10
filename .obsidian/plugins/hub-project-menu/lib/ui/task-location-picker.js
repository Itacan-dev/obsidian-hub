"use strict";
const { inheritColorOwner } = require("./color-system");
const { ownModalColors } = require("./color-system");

const { Modal } = require("obsidian");
const { createModalHeader, layoutModal } = require("./window-title");
const { setHubIcon } = require("./icons");
const { openTaskPopover } = require("./task-popover");
const { sameOwner, relativePath } = require("../domain/native-task-location");
let pickerSequence = 0;
function focusRow(event, container) {
    const buttons = [...container.querySelectorAll("button:not(:disabled)")], index = buttons.indexOf(event.target);
    if (index < 0 || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
    buttons[next]?.focus();
}
const LOCATION_MODES = {
    task: { title: "Task location", subtitle: "Choose where this task belongs.", action: "Select location" },
    note: { title: "Note location", subtitle: "Choose where this note belongs.", action: "Create note" },
    text: { title: "Text location", subtitle: "Choose where this text belongs.", action: "Add to note" },
    file: { title: "File location", subtitle: "Choose where this file belongs.", action: "Add file" }
};
function openLocationPicker(app, { locations, owner, reference = null, allowOwnerChange = false, taskTitle = "", contextTitle = taskTitle,
    mode = "task", noteTitle = "", confirmLabel, onDraftChange = () => {}, beforeClose, onChoose, onClose = () => {} }) {
    const config = LOCATION_MODES[mode];
    if (!config) throw Error("Unknown location mode.");
    const accepts = type => mode === "text" ? type === "note" : mode === "task" ? ["folder", "note"].includes(type) : type === "folder";
    class LocationModal extends Modal {
        onOpen() { ownModalColors(this);
            this.modalEl.classList.add("hub-task-location-dialog");
            this.modalEl.setAttribute("aria-label", config.title);
            this.contentEl.classList.add("hub-button-scope");
            const { heading } = createModalHeader(this.contentEl, { title: config.title, icon: "map-pin",
                subtitle: config.subtitle });
            this.renderTaskName(heading, contextTitle);
            this.owner = owner ? { ...owner } : null;
            try { if (this.owner) locations.workspace(this.owner); } catch (_) { this.owner = null; }
            this.titleValue = noteTitle;
            if (mode === "note") {
                const label = this.contentEl.createEl("label", { cls: "hub-capture-field hub-location-note-title", text: "Title" });
                this.titleInput = label.createEl("input", { type: "text", attr: { "aria-label": "Note title", required: "" } });
                this.titleInput.value = noteTitle;
                this.titleInput.oninput = () => { this.titleValue = this.titleInput.value; if (this.contextText) this.contextText.textContent = this.titleValue; this.changed(); this.updateSelection(); };
            }
            const workspaceField = this.contentEl.createEl("section", { cls: "hub-oath-section hub-task-location-section hub-task-location-workspace" });
            workspaceField.createEl("h3", { text: "Workspace" });
            this.workspaceButton = workspaceField.createEl("button", { cls: "hub-task-location-workspace-row", attr: { type: "button", "aria-label": "Owning workspace", "aria-haspopup": "dialog", "aria-expanded": "false" } });
            this.workspaceButton.disabled = !allowOwnerChange;
            if (!allowOwnerChange) this.workspaceButton.title = "Existing task ownership cannot be changed.";
            this.workspaceButton.onclick = () => this.openWorkspaces();
            this.workspaceButton.onkeydown = event => {
                if (["ArrowDown", "ArrowUp"].includes(event.key) && !this.workspaceButton.disabled) { event.preventDefault(); this.openWorkspaces(); }
            };
            this.renderWorkspace();
            const locationSection = this.contentEl.createEl("section", { cls: "hub-oath-section hub-task-location-section" });
            const locationHeading = locationSection.createEl("h3", { text: "Location", attr: { id: "hub-task-location-heading-" + ++pickerSequence } });
            this.breadcrumbs = locationSection.createEl("nav", { cls: "hub-task-location-breadcrumbs", attr: { "aria-labelledby": locationHeading.id } });
            this.list = locationSection.createDiv({ cls: "hub-task-location-entries", attr: { role: "group", "aria-label": "Folders and Markdown notes" } });
            this.error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-task-dialog-actions" });
            actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => this.close();
            this.confirm = actions.createEl("button", { text: confirmLabel ?? config.action, cls: "mod-cta", attr: { type: "button" } });
            this.getDraft = () => ({ owner: this.owner, selected: this.proposed, title: this.titleValue });
            this.changed = () => onDraftChange(this.getDraft());
            this.confirm.onclick = async () => {
                if (this.saving || this.closing) return;
                const controls = [...this.contentEl.querySelectorAll("button,input")], disabled = controls.map(control => control.disabled);
                try {
                    const accepted = this.proposed && locations.resolve(this.proposed.owner, this.proposed.reference);
                    if (!accepted || !accepts(accepted.type) || accepted.path !== this.proposed.path || accepted.type !== this.proposed.type) throw Error("Location is no longer available. Choose a replacement.");
                    if (this.titleInput && !this.titleInput.reportValidity()) return;
                    this.saving = true; this.modalEl.setAttribute("aria-busy", "true"); controls.forEach(control => control.disabled = true);
                    const result = await onChoose({ ...this.proposed, title: this.titleValue, display: locations.describe(this.proposed.owner, this.proposed.reference) });
                    this.outcome = { status: "completed", result }; this.saving = false; this.close();
                } catch (error) { this.showError(error); }
                finally { this.saving = false; this.modalEl.removeAttribute("aria-busy"); controls.forEach((control, i) => control.disabled = disabled[i]); if (!this.closed) this.updateSelection(); }
            };
            let initial;
            try { if (this.owner) initial = locations.resolve(this.owner, reference); } catch (_) {}
            this.proposed = initial ? { owner: this.owner, reference, path: initial.path, type: initial.type } : null;
            const workspace = this.owner ? locations.workspace(this.owner) : null;
            this.path = initial ? initial.type === "folder" ? initial.path : initial.path.slice(0, initial.path.lastIndexOf("/")) : workspace?.root;
            this.renderFolder();
            if (owner && !initial) this.showError(Error("Saved location is unavailable. Choose a replacement."));
            const body = layoutModal(this, { footer: actions }); body.classList.add("hub-task-location-body");
            // The modal layout establishes the initial breadcrumb viewport.
            this.breadcrumbs.scrollLeft = this.breadcrumbs.scrollWidth;
            this.list.addEventListener("keydown", event => focusRow(event, this.list));
            this.refs = ["create", "delete", "rename"].map(event => app.vault.on(event, (file, oldPath) => {
                try {
                    const root = locations.workspace(this.owner).root;
                    if ([file?.path, oldPath].some(path => path === root || path?.startsWith(root + "/"))) this.renderFolder();
                } catch (error) { this.confirm.disabled = true; this.showError(error); }
            }));
        }
        renderTaskName(heading, title) {
            const text = String(title ?? "");
            if (!text.trim()) return;
            const doc = this.contentEl.ownerDocument, win = doc.defaultView, copy = heading.parentElement;
            // Capture headings reserve a right margin as well as the shared row padding.
            // Contextual headers use the same single right inset as Progress report.
            copy.parentElement.style.marginRight = "0";
            const row = copy.createDiv({ cls: "hub-window-title-row hub-task-location-title-row" });
            copy.insertBefore(row, heading); row.append(heading);
            // Join the tab order only after a new Tab gesture in this dialog,
            // so the informational title never becomes Modal's autofocus target.
            const name = row.createSpan({ cls: "hub-window-header-date hub-task-location-task-name", attr: { tabindex: "-1", "aria-label": '"' + text + '"' } });
            name.style.font = win.getComputedStyle(heading).font;
            name.style.setProperty("--no-tooltip", "true");
            name.createSpan({ cls: "hub-task-location-task-quote", text: '"', attr: { "aria-hidden": "true" } });
            const taskText = name.createSpan({ cls: "hub-task-location-task-text", text }); this.contextText = taskText;
            name.createSpan({ cls: "hub-task-location-task-quote", text: '"', attr: { "aria-hidden": "true" } });
            let tooltip = null, hovered = false, focused = false, truncated = false, keyboardNavigation = false, tabNavigation = false;
            const hide = () => { tooltip?.remove(); tooltip = null; name.removeAttribute("aria-describedby"); };
            const measure = () => {
                truncated = !!taskText.textContent.trim() && taskText.clientWidth > 0 && taskText.scrollWidth > taskText.clientWidth;
                name.tabIndex = truncated && tabNavigation ? 0 : -1;
                if (!truncated) { hovered = focused = false; hide(); }
                return truncated;
            };
            const show = () => {
                if (!name.isConnected || !measure()) return;
                if (tooltip) hide();
                tooltip = doc.createElement("div");
                tooltip.className = "tooltip hub-detail-tooltip hub-task-location-title-tooltip";
                tooltip.id = "hub-task-location-title-tooltip-" + ++pickerSequence;
                tooltip.setAttribute("role", "tooltip"); tooltip.setAttribute("popover", "manual");
                tooltip.textContent = taskText.textContent;
                const viewport = win.visualViewport;
                tooltip.style.maxWidth = Math.min(300, (viewport?.width ?? win.innerWidth) - 16) + "px";
                tooltip.style.maxHeight = Math.min(280, (viewport?.height ?? win.innerHeight) - 16) + "px";
                inheritColorOwner(tooltip, name);
                this.modalEl.append(tooltip); tooltip.showPopover?.();
                name.setAttribute("aria-describedby", tooltip.id);
                const rect = name.getBoundingClientRect(), size = tooltip.getBoundingClientRect();
                const left = (viewport?.offsetLeft ?? 0) + 8, top = (viewport?.offsetTop ?? 0) + 8;
                const right = left + (viewport?.width ?? win.innerWidth) - 16, bottom = top + (viewport?.height ?? win.innerHeight) - 16;
                tooltip.style.left = Math.max(left, Math.min(rect.right - size.width, right - size.width)) + "px";
                tooltip.style.top = Math.max(top, Math.min(rect.bottom + 6 + size.height <= bottom ? rect.bottom + 6 : rect.top - size.height - 6, bottom - size.height)) + "px";
                tooltip.onpointerleave = event => { if (!name.contains(event.relatedTarget)) { hovered = false; if (!focused) hide(); } };
            };
            // Use actual pointer movement, as the existing immediate Itacan previews do.
            // Focus is informational only: there is no click handler or editor control.
            name.onpointermove = event => { if (event.pointerType !== "touch" && !tooltip && truncated) { hovered = true; show(); } };
            name.onpointerleave = event => { if (!tooltip?.contains(event.relatedTarget)) { hovered = false; if (!focused) hide(); } };
            name.onfocus = () => { focused = keyboardNavigation && name.matches(":focus-visible"); if (focused) show(); };
            name.onblur = () => { focused = false; if (!hovered) hide(); };
            const keydown = event => {
                keyboardNavigation = event.key === "Tab" && this.modalEl.contains(event.target);
                if (keyboardNavigation) { tabNavigation = true; measure(); }
                if (event.key === "Escape" && tooltip) { hovered = focused = false; hide(); event.preventDefault(); event.stopImmediatePropagation(); }
            };
            const keyup = () => { keyboardNavigation = false; };
            const pointerdown = () => { keyboardNavigation = hovered = focused = false; hide(); };
            const resize = () => { hovered = focused = false; hide(); measure(); };
            const scroll = event => { if (!tooltip?.contains(event.target)) { hovered = focused = false; hide(); } };
            const observer = new win.ResizeObserver(() => { if (measure() && tooltip) show(); });
            observer.observe(taskText);
            const titleObserver = new win.MutationObserver(() => {
                name.setAttribute("aria-label", '"' + taskText.textContent + '"');
                if (measure() && tooltip) show();
            });
            titleObserver.observe(taskText, { childList: true, characterData: true, subtree: true });
            doc.addEventListener("keydown", keydown, true); doc.addEventListener("keyup", keyup, true); doc.addEventListener("pointerdown", pointerdown, true);
            win.addEventListener("resize", resize); doc.addEventListener("scroll", scroll, true);
            this.disposeTaskName = () => {
                hide(); observer.disconnect(); titleObserver.disconnect();
                doc.removeEventListener("keydown", keydown, true); doc.removeEventListener("keyup", keyup, true); doc.removeEventListener("pointerdown", pointerdown, true);
                win.removeEventListener("resize", resize); doc.removeEventListener("scroll", scroll, true);
                name.onpointermove = name.onpointerleave = name.onfocus = name.onblur = null;
            };
        }
        renderWorkspace() {
            const w = this.owner ? locations.workspace(this.owner) : null, button = this.workspaceButton;
            button.empty();
            if (w) locations.mountThumbnail(button, this.owner);
            const copy = button.createSpan({ cls: "hub-capture-picker-copy" });
            copy.createEl("strong", { text: w?.name ?? w?.label ?? "Choose workspace" });
            copy.createSpan({ cls: "hub-task-location-workspace-type", text: !this.owner ? "" : this.owner.type === "project" ? "Project" : "Resource" });
            this.workspaceChevron = null;
            if (!button.disabled) {
                button.title = w?.name ?? w?.label ?? "Choose workspace";
                this.workspaceChevron = button.createSpan({ cls: "hub-task-location-icon", attr: { "aria-hidden": "true" } });
                this.updateWorkspaceChevron();
            }
        }
        updateWorkspaceChevron() {
            if (this.workspaceChevron) setHubIcon(this.workspaceChevron, this.workspaceButton.getAttribute("aria-expanded") === "true" ? "chevron-down" : "chevron-right");
        }
        openWorkspaces() {
            if (this.workspaceMenu) { this.workspaceMenu.close(); return; }
            this.workspaceMenu = openTaskPopover(this.workspaceButton, { title: "Choose workspace", heading: false, autofocus: false, className: "hub-task-location-workspaces", maxHeight: 320,
                width: () => this.workspaceButton.getBoundingClientRect().width,
                onClose: () => { this.workspaceMenu = null; this.updateWorkspaceChevron(); },
                render: menu => {
                    // Reuse the shared top-layer positioning and dismissal without editor chrome.
                    menu.element.querySelector(".hub-task-popover-heading").remove();
                    for (const [type, name] of [["resource", "Resources"], ["project", "Projects"]]) {
                        const group = menu.body.createDiv({ cls: "hub-task-location-workspace-group", attr: { role: "group", "aria-label": name } });
                        group.createEl("h3", { text: name });
                        for (const w of locations.workspaces().filter(w => w.owner.type === type)) {
                            const selected = sameOwner(this.owner, w.owner);
                            const row = group.createEl("button", { text: w.name, cls: "hub-button-plain hub-task-location-entry" + (selected ? " is-selected" : ""),
                                attr: { type: "button", role: "menuitemradio", "aria-checked": String(selected), title: w.name } });
                            row.disabled = !w.available && !selected;
                            row.onclick = () => {
                                try {
                                    const root = locations.workspace(w.owner).root, proposed = locations.select(w.owner, root, "folder");
                                    this.owner = { ...w.owner }; this.path = root; this.proposed = proposed;
                                    this.renderWorkspace(); this.renderFolder(); this.changed(); menu.close();
                                } catch (error) { this.showError(error); menu.close(); }
                            };
                        }
                    }
                    menu.body.setAttribute("role", "menu");
                    menu.body.addEventListener("keydown", event => focusRow(event, menu.body));
                }
            });
            this.updateWorkspaceChevron();
            // Start at Resources, even when the selected Project is farther down.
            this.workspaceMenu.element.scrollTop = 0;
            this.workspaceMenu.body.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
        }
        showError(error) { this.error.textContent = error.message; }
        navigate(path) {
            try {
                this.proposed = locations.select(this.owner, path, "folder"); this.path = path;
                this.renderFolder(); this.changed(); this.breadcrumbs.querySelector("[aria-current]")?.focus({ preventScroll: true });
            } catch (error) { this.showError(error); }
        }
        updateSelection() {
            let current;
            try { current = this.proposed && locations.resolve(this.proposed.owner, this.proposed.reference); } catch (_) {}
            this.confirm.disabled = !!this.saving || !current || !accepts(current.type) || (mode === "note" && !this.titleValue.trim()) || current.path !== this.proposed.path || current.type !== this.proposed.type;
            for (const row of this.list.querySelectorAll("[data-location-path]")) {
                const selected = !!current && row.dataset.locationType === "note" && row.dataset.locationPath === current.path;
                row.classList.toggle("is-selected", selected);
                if (row.dataset.locationType === "note") row.setAttribute("aria-pressed", String(selected));
            }
            if (this.owner) this.renderBreadcrumbs(); else this.breadcrumbs.empty();
        }
        renderBreadcrumbs() {
            const w = locations.workspace(this.owner), route = relativePath(w.root, this.path).split("/").filter(Boolean);
            const segments = [{ label: w.name, path: w.root }, ...route.map((label, i) => ({
                label, path: w.root + "/" + route.slice(0, i + 1).join("/") }))];
            const note = this.proposed?.type === "note" ? this.proposed.path.split("/").at(-1) : null;
            if (note) segments.push({ label: note, path: this.proposed.path, note: true });
            const selection = JSON.stringify([this.owner.type, this.owner.id, this.path, note]);
            const changed = this.breadcrumbSelection !== selection, scrollLeft = this.breadcrumbs.scrollLeft;
            this.breadcrumbSelection = selection;
            const focused = this.contentEl.ownerDocument.activeElement;
            const focusedPath = this.breadcrumbs.contains(focused) ? focused.dataset.locationPath : null;
            this.breadcrumbs.empty();
            this.breadcrumbs.setAttribute("aria-description", segments.map(segment => segment.label).join(" / "));
            for (let i = 0; i < segments.length; i++) {
                if (i) this.breadcrumbs.createSpan({ text: "/", cls: "hub-task-location-separator", attr: { "aria-hidden": "true" } });
                const segment = segments[i], current = i === segments.length - 1;
                const element = this.breadcrumbs.createEl(segment.note ? "span" : "button", {
                    cls: segment.note ? "hub-task-location-note" : "hub-button-plain", text: segment.label,
                    attr: { ...(segment.note ? {} : { type: "button" }), title: segment.path, ...(current ? { "aria-current": "location" } : {}) } });
                element.dataset.locationPath = segment.path;
                if (current) element.removeAttribute("title");
                if (!segment.note) {
                    element.onclick = () => this.navigate(segment.path);
                    if (focusedPath === segment.path) element.focus({ preventScroll: true });
                }
            }
            // Only a new location reveals the endpoint; background refreshes
            // preserve the user's horizontal navigation through the ancestors.
            this.breadcrumbs.scrollLeft = changed ? this.breadcrumbs.scrollWidth : scrollLeft;
        }
        renderFolder() {
            if (this.saving) return;
            this.error.textContent = "";
            const focusedPath = this.list.contains(this.contentEl.ownerDocument.activeElement) ? this.contentEl.ownerDocument.activeElement.dataset.locationPath : null;
            this.list.empty();
            if (!this.owner) { this.list.createDiv({ cls: "hub-task-location-empty", text: "Choose a workspace." }); this.updateSelection(); return; }
            try {
                const folder = locations.browse(this.owner, this.path);
                const visibleRows = folder.rows.filter(item => mode === "task" || mode === "text" || item.type === "folder");
                for (const item of visibleRows) {
                    const row = this.list.createEl("button", { cls: "hub-button-plain hub-task-location-entry", attr: { type: "button", title: item.name } });
                    row.dataset.locationPath = item.path; row.dataset.locationType = item.type;
                    setHubIcon(row.createSpan({ cls: "hub-task-location-icon", attr: { "aria-hidden": "true" } }), item.type === "folder" ? "folder" : "file-text");
                    row.createSpan({ cls: "hub-task-location-name", text: item.name });
                    if (item.type === "folder") setHubIcon(row.createSpan({ cls: "hub-task-location-icon", attr: { "aria-hidden": "true" } }), "chevron-right");
                    row.onclick = () => {
                        try {
                            if (item.type === "folder") this.navigate(item.path);
                            else {
                                const deselect = this.proposed?.type === "note" && this.proposed.path === item.path;
                                this.proposed = locations.select(this.owner, deselect ? this.path : item.path, deselect ? "folder" : "note");
                                this.error.textContent = ""; this.updateSelection(); this.changed();
                            }
                        } catch (error) { this.showError(error); }
                    };
                    if (focusedPath === item.path) row.focus({ preventScroll: true });
                }
                if (!visibleRows.length) this.list.createDiv({ cls: "hub-task-location-empty", text: mode === "note" || mode === "file" ? "No subfolders in this folder." : "This folder is empty." });
            } catch (error) { this.showError(error); }
            this.updateSelection();
            if (focusedPath && !this.list.contains(this.contentEl.ownerDocument.activeElement)) this.breadcrumbs.querySelector("button:last-of-type")?.focus({ preventScroll: true });
        }
        close() {
            if (this.saving || this.closing || this.closed) return;
            if (beforeClose && !this.outcome) {
                this.closing = true;
                const controls = [...this.contentEl.querySelectorAll("button,input")], disabled = controls.map(c => c.disabled);
                controls.forEach(c => c.disabled = true);
                Promise.resolve().then(() => beforeClose(this.getDraft())).then(() => { this.closing = false; this.closed = true; super.close(); }, error => { this.closing = false; controls.forEach((c, i) => c.disabled = disabled[i]); this.showError(error); });
            } else { this.closed = true; super.close(); }
        }
        onClose() { this.closed = true; this.disposeTaskName?.(); this.workspaceMenu?.close(false); for (const ref of this.refs ?? []) app.vault.offref(ref); this.contentEl.empty(); onClose(this.outcome ?? { status: "cancelled" }); }
    }
    const modal = new LocationModal(app); modal.open(); return modal;
}
function openTaskLocationPicker(app, options) { return openLocationPicker(app, { ...options, mode: "task" }); }
module.exports = { openTaskLocationPicker, openLocationPicker, LOCATION_MODES };
