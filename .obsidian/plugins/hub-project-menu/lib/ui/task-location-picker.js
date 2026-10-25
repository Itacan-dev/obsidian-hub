"use strict";
const { Modal } = require("obsidian");
const { createModalHeader, layoutModal } = require("./window-title");
const { setHubIcon } = require("./icons");
const { sameOwner, relativePath } = require("../domain/native-task-location");
function openTaskLocationPicker(app, { locations, owner, reference = null, allowOwnerChange = false, onChoose, onClose = () => {} }) {
    class LocationModal extends Modal {
        onOpen() {
            this.modalEl.classList.add("hub-task-location-dialog");
            this.modalEl.setAttribute("aria-label", "Task location");
            this.contentEl.classList.add("hub-button-scope");
            createModalHeader(this.contentEl, { title: "Location", icon: "folder-open" });
            const label = this.contentEl.createEl("label", { cls: "hub-task-location-workspace", text: "Workspace" });
            this.workspaceSelect = label.createEl("select", { attr: { "aria-label": "Owning workspace" } });
            const choices = locations.workspaces();
            for (const [type, name] of [["project", "Projects"], ["resource", "Resources"]]) {
                const group = this.workspaceSelect.createEl("optgroup", { attr: { label: name } });
                for (const choice of choices.filter(w => w.owner.type === type)) {
                    const option = group.createEl("option", { value: JSON.stringify(choice.owner), text: choice.name });
                    option.disabled = !choice.available && !sameOwner(owner, choice.owner);
                }
            }
            this.owner = { ...owner }; this.workspaceSelect.value = JSON.stringify({ type: owner.type, id: owner.id });
            this.workspaceSelect.disabled = !allowOwnerChange;
            if (!allowOwnerChange) this.workspaceSelect.title = "Existing task ownership cannot be changed.";
            this.breadcrumbs = this.contentEl.createEl("nav", { cls: "hub-task-location-breadcrumbs", attr: { "aria-label": "Folder breadcrumbs" } });
            const toolbar = this.contentEl.createDiv({ cls: "hub-task-location-toolbar" });
            this.chooseFolder = toolbar.createEl("button", { text: "Choose this folder", attr: { type: "button" } });
            this.chooseFolder.onclick = () => { try { this.proposed = locations.select(this.owner, this.path, "folder"); this.updateSelection(); } catch (error) { this.showError(error); } };
            this.list = this.contentEl.createDiv({ cls: "hub-task-location-entries", attr: { role: "group", "aria-label": "Folders and Markdown notes" } });
            this.selection = this.contentEl.createDiv({ cls: "hub-task-location-selection", attr: { role: "status", "aria-label": "Selected location" } });
            this.error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const actions = this.contentEl.createDiv({ cls: "hub-task-dialog-actions" });
            actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).onclick = () => this.close();
            this.confirm = actions.createEl("button", { text: "Use location", cls: "mod-cta", attr: { type: "button" } });
            this.confirm.onclick = () => {
                try {
                    const accepted = this.proposed && locations.resolve(this.proposed.owner, this.proposed.reference);
                    if (!accepted || accepted.path !== this.proposed.path || accepted.type !== this.proposed.type) throw Error("Location is no longer available. Choose a replacement.");
                    onChoose({ ...this.proposed, display: locations.describe(this.proposed.owner, this.proposed.reference) }); this.close();
                } catch (error) { this.showError(error); this.confirm.disabled = true; }
            };
            this.workspaceSelect.onchange = () => {
                this.owner = JSON.parse(this.workspaceSelect.value); this.proposed = null;
                this.path = locations.workspace(this.owner).root; this.renderFolder();
            };
            let initial;
            try { initial = locations.resolve(owner, reference); } catch (_) {}
            this.proposed = initial ? { owner: this.owner, reference, path: initial.path, type: initial.type } : null;
            const workspace = locations.workspace(owner);
            this.path = initial ? initial.type === "folder" ? initial.path : initial.path.slice(0, initial.path.lastIndexOf("/")) : workspace.root;
            this.renderFolder();
            if (!initial) this.showError(Error("Saved location is unavailable. Choose a replacement."));
            const body = layoutModal(this, { footer: actions }); body.classList.add("hub-task-location-body");
            this.list.addEventListener("keydown", event => {
                const buttons = [...this.list.querySelectorAll("button")], index = buttons.indexOf(event.target);
                if (index < 0 || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))); buttons[next]?.focus();
            });
            this.refs = ["create", "delete", "rename"].map(event => app.vault.on(event, (file, oldPath) => {
                const root = locations.workspace(this.owner).root;
                if ([file?.path, oldPath].some(path => path === root || path?.startsWith(root + "/"))) this.renderFolder();
            }));
        }
        showError(error) { this.error.textContent = error.message; }
        updateSelection() {
            let current;
            try { current = this.proposed && locations.resolve(this.proposed.owner, this.proposed.reference); } catch (_) {}
            this.confirm.disabled = !current;
            const name = this.proposed ? locations.workspace(this.proposed.owner).name : null;
            this.selection.textContent = current ? [name, ...relativePath(locations.workspace(this.proposed.owner).root, current.path).split("/")].filter(Boolean).join(" / ") : "No location selected";
            this.selection.title = this.selection.textContent;
            for (const row of this.list.querySelectorAll("[data-location-path]")) row.classList.toggle("is-selected", !!current && sameOwner(this.owner, this.proposed.owner) && row.dataset.locationPath === current.path);
        }
        renderFolder() {
            this.error.textContent = ""; this.breadcrumbs.empty(); this.list.empty();
            const w = locations.workspace(this.owner), route = relativePath(w.root, this.path).split("/").filter(Boolean);
            const paths = [w.root, ...route.map((_part, i) => w.root + "/" + route.slice(0, i + 1).join("/"))];
            for (let i = 0; i < paths.length; i++) {
                if (i) this.breadcrumbs.createSpan({ text: "/", attr: { "aria-hidden": "true" } });
                const button = this.breadcrumbs.createEl("button", { text: i ? route[i - 1] : w.name, attr: { type: "button", title: paths[i] } });
                if (i === paths.length - 1) button.setAttribute("aria-current", "location");
                button.onclick = () => { this.path = paths[i]; this.renderFolder(); this.chooseFolder.focus(); };
            }
            try {
                const folder = locations.browse(this.owner, this.path); this.chooseFolder.disabled = false;
                for (const item of folder.rows) {
                    const row = this.list.createEl("button", { cls: "hub-task-location-entry", attr: { type: "button", title: item.name } });
                    row.dataset.locationPath = item.path; row.dataset.locationType = item.type;
                    setHubIcon(row.createSpan({ cls: "hub-task-location-icon", attr: { "aria-hidden": "true" } }), item.type === "folder" ? "folder" : "file-text");
                    row.createSpan({ cls: "hub-task-location-name", text: item.name });
                    if (item.type === "folder") setHubIcon(row.createSpan({ cls: "hub-task-location-icon", attr: { "aria-hidden": "true" } }), "chevron-right");
                    row.onclick = () => {
                        try { if (item.type === "folder") { this.path = item.path; this.renderFolder(); this.chooseFolder.focus(); }
                            else { this.proposed = locations.select(this.owner, item.path, "note"); this.error.textContent = ""; this.updateSelection(); } }
                        catch (error) { this.showError(error); }
                    };
                }
                if (!folder.rows.length) this.list.createDiv({ cls: "hub-task-location-empty", text: "This folder is empty." });
            } catch (error) { this.chooseFolder.disabled = true; this.showError(error); }
            this.updateSelection();
        }
        onClose() { for (const ref of this.refs ?? []) app.vault.offref(ref); this.contentEl.empty(); onClose(); }
    }
    const modal = new LocationModal(app); modal.open(); return modal;
}
module.exports = { openTaskLocationPicker };
