"use strict";
const { ownMenuColors, ownModalColors } = require("./color-system");

const { Modal, Menu } = require("obsidian");
const { preparePicker, listen } = require("./capture-pickers");
const { mountCaptureLocationTree } = require("./capture-tree");
const { setHubIcon } = require("./icons");
const { setHubTooltip } = require("./tooltips");
const { noteLocation, resolveNoteLocation } = require("../domain/note-insertion");

function openNotePositionPicker(service, { workspace, selectedLocation, onSelect, restoreFocus }) {
    class NotePositionPicker extends Modal {
        onOpen() { ownModalColors(this);
            preparePicker(this, "Choose note and position", ["hub-capture-location-picker", "hub-note-position-picker"]);
            this.contentEl.createEl("p", { cls: "hub-oath-muted", text: workspace.name });
            const searchBox = this.contentEl.createDiv({ cls: "hub-explorer-search" });
            setHubIcon(searchBox.createSpan({ cls: "hub-explorer-icon", attr: { "aria-hidden": "true" } }), "search");
            const search = searchBox.createEl("input", { type: "search", cls: "hub-explorer-search-input",
                attr: { placeholder: "Search notes and folders...", "aria-label": "Search notes and folders" } });
            const body = this.contentEl.createDiv({ cls: "hub-note-position-body" });
            const tree = body.createDiv({ cls: "hub-capture-location-tree", attr: { role: "tree", "aria-label": "Notes and folders" } });
            this.positions = body.createDiv({ cls: "hub-note-positions" });
            this.error = body.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-capture-actions hub-capture-picker-actions" });
            actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => this.close();
            this.use = actions.createEl("button", { text: "Use this position", cls: "mod-cta", attr: { type: "button" } });
            this.use.disabled = true;
            this.use.onclick = () => { void this.commit(); };
            this.selection = noteLocation(selectedLocation); this.path = this.selection?.path ?? null;
            this.request = 0; this.closed = false;
            this.positionLabelId = this.modalEl.getAttribute("aria-labelledby") + "-position";
            this.renderPositions();
            this.hierarchy = mountCaptureLocationTree({ tree, search, collapsible: true,
                getItems: () => service.taskLocations(workspace.id), selectedPath: () => this.path,
                onSelect: item => { if (!item.folder) void this.chooseNote(item.path); },
                onMissing: () => { this.error.textContent = "This note is no longer available."; }
            });
            this.owner.register(() => this.hierarchy.destroy());
            for (const event of ["create", "delete", "rename"]) listen(this.owner, service.app.vault, event, () => {
                this.hierarchy.render(); if (this.path) void this.readSelected(false);
            });
            listen(this.owner, service.app.vault, "modify", file => { if (file.path === this.path) void this.readSelected(false); });
            if (this.path) void this.readSelected(false);
            search.focus();
        }
        async chooseNote(path) {
            const changed = path !== this.path;
            this.path = path;
            if (changed) this.selection = { path, targetType: "note", position: "end" };
            this.hierarchy.render(); await this.readSelected(changed);
        }
        async readSelected(reset) {
            const request = ++this.request, path = this.path;
            this.use.disabled = true; this.parsed = null; this.renderPositions(); this.error.textContent = "";
            try {
                const parsed = await service.readNotePositions(workspace.id, path);
                if (this.closed || request !== this.request) return;
                this.parsed = parsed;
                if (reset) this.selection = { path, targetType: "note", position: "end" };
                if (!resolveNoteLocation(parsed, this.selection)) {
                    this.selection = null;
                    this.error.textContent = "The selected position changed. Choose a position again.";
                }
                this.renderPositions();
            } catch (error) {
                if (!this.closed && request === this.request) { this.selection = null; this.renderPositions(); this.error.textContent = error.message; }
            }
        }
        renderPositions() {
            this.positionMenu?.hide(); this.positions.empty();
            this.positions.createEl("h3", { text: "Place in note", cls: "hub-capture-section-heading", attr: { id: this.positionLabelId } });
            const modes = [
                { type: "note", position: "end", label: "At the end of the note" },
                { type: "note", position: "start", label: "At the start of the note", disabled: !!this.parsed?.unclosedFrontmatter },
                { type: "heading", position: "end", label: "Under heading", disabled: !this.parsed?.headings.length },
                { type: "list", position: "last", label: "In list", disabled: !this.parsed?.lists.length }
            ];
            const selected = modes.find(mode => this.selection?.targetType === mode.type && (mode.type !== "note" || this.selection.position === mode.position));
            this.selector(this.positions, "mode", !this.path ? "Select a note first" : selected?.label ?? "Choose a position...", modes, mode => {
                if (mode === selected) return;
                const target = mode.type === "heading" ? this.parsed.headings[0] : mode.type === "list" ? this.parsed.lists[0] : null;
                this.selection = { path: this.path, targetType: mode.type, position: mode.position,
                    ...(target ? { anchor: target.anchor, label: target.label } : {}) };
                this.error.textContent = ""; this.renderPositions();
            }, !this.parsed);
            const type = this.selection?.targetType;
            if (this.path && type && type !== "note") {
                const row = this.positions.createDiv({ cls: "hub-note-target-row" });
                const targets = (type === "heading" ? this.parsed?.headings : this.parsed?.lists) ?? [];
                const target = targets.find(item => item.anchor === this.selection.anchor);
                this.selector(row, "target", target?.label ?? this.selection.label ?? (type === "heading" ? "Choose heading..." : "Choose list..."), targets, target => {
                    this.selection.anchor = target.anchor; this.selection.label = target.label; this.renderPositions();
                }, !this.parsed);
                const positions = type === "heading" ? [
                    { position: "end", label: "End of section" }, { position: "top", label: "Top of section" }
                ] : [{ position: "last", label: "Last item" }, { position: "first", label: "First item" }];
                this.selector(row, "position", positions.find(item => item.position === this.selection.position)?.label ?? "Choose position...", positions, item => {
                    this.selection.position = item.position; this.renderPositions();
                }, !this.parsed);
            }
            this.use.disabled = this.committing || !resolveNoteLocation(this.parsed, this.selection);
        }
        selector(host, kind, value, options, onSelect, disabled = false) {
            const valueId = this.positionLabelId + "-" + kind;
            const button = host.createEl("button", { cls: "hub-note-position-select", attr: {
                type: "button", "data-note-selector": kind, "aria-haspopup": "menu", "aria-expanded": "false",
                "aria-labelledby": kind === "mode" ? this.positionLabelId + " " + valueId : valueId
            } });
            button.disabled = disabled;
            const text = button.createSpan({ text: value, attr: { id: valueId } });
            setHubIcon(button.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "chevron-down");
            if (kind === "target") button.addEventListener("pointerover", () => {
                setHubTooltip(text, text.scrollWidth > text.clientWidth ? value : null);
            });
            const open = () => { if (!button.disabled) this.showPositionMenu(button, kind, options, onSelect); };
            button.onclick = open;
            button.onkeydown = event => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } };
            return button;
        }
        showPositionMenu(button, kind, options, onSelect) {
            if (this.positionMenu) { this.positionMenu.hide(); return; }
            const menu = this.positionMenu = ownMenuColors(new Menu());
            options.forEach(option => menu.addItem(item => item.setTitle(option.label).setDisabled(!!option.disabled).setChecked(
                kind === "target" ? option.anchor === this.selection?.anchor : kind === "position" ? option.position === this.selection?.position :
                    option.type === this.selection?.targetType && (option.type !== "note" || option.position === this.selection.position)
            ).onClick(() => {
                if (this.closed) return;
                onSelect(option);
                this.positions.querySelector(`[data-note-selector="${kind}"]`)?.focus({ preventScroll: true });
            })));
            menu.onHide(() => { if (this.positionMenu === menu) this.positionMenu = null; button.setAttribute("aria-expanded", "false");
                if (!this.closed && button.isConnected) button.focus({ preventScroll: true }); });
            button.setAttribute("aria-expanded", "true");
            const rect = button.getBoundingClientRect(); menu.showAtPosition({ x: rect.left, y: rect.bottom });
        }
        async commit() {
            if (this.use.disabled || this.committing) return;
            this.committing = true; this.use.disabled = true;
            const selected = noteLocation(this.selection), request = this.request;
            try {
                // Selection is atomic only after checking the current note again.
                const parsed = await service.readNotePositions(workspace.id, selected.path);
                if (this.closed || request !== this.request) return;
                if (!resolveNoteLocation(parsed, selected)) throw Error("The selected position changed. Choose a position again.");
                onSelect(selected); this.close();
            } catch (error) {
                if (!this.closed) { this.selection = null; this.error.textContent = error.message; void this.readSelected(false); }
            } finally { this.committing = false; }
        }
        onClose() { this.closed = true; this.request++; this.positionMenu?.hide(); this.owner?.unload(); this.contentEl.empty(); restoreFocus?.(); }
    }
    const modal = new NotePositionPicker(service.app); modal.open(); return modal;
}
module.exports = { openNotePositionPicker };
