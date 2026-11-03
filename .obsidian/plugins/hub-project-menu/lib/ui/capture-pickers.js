"use strict";
const { Modal, Component } = require("obsidian");
const { createWorkspaceCards } = require("./workspace-cards");
const { createCardImageRenderer } = require("./card-images");
const { setHubIcon } = require("./icons");
const { mountCaptureLocationTree } = require("./capture-tree");

let pickerId = 0;
function preparePicker(modal, title, classes) {
    const id = `hub-capture-picker-${++pickerId}`;
    modal.modalEl.classList.add("hub-oath-dialog", ...classes);
    modal.contentEl.classList.add("hub-button-scope", "hub-capture-form-scope");
    modal.contentEl.createEl("h2", { text: title, attr: { id } });
    modal.modalEl.setAttribute("aria-labelledby", id);
    const close = modal.modalEl.querySelector(".modal-close-button");
    close?.setAttribute("aria-label", "Close " + title); close?.setAttribute("title", "Close " + title);
    modal.owner = new Component(); modal.owner.load();
}
function cancelAction(modal) {
    const actions = modal.contentEl.createDiv({ cls: "hub-oath-actions hub-capture-picker-actions" });
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => modal.close());
}
function listen(owner, emitter, event, render) {
    if (!emitter?.on || !emitter.offref) return;
    const reference = emitter.on(event, render);
    owner.register(() => emitter.offref(reference));
}

// Reuse the same card markup, artwork crop, category subtitles, order, and Oath
// eligibility as Home and Select project/resource. Choosing never navigates.
function openCaptureWorkspacePicker(service, { selectedId, onSelect, restoreFocus } = {}) {
    class WorkspacePicker extends Modal {
        onOpen() {
            preparePicker(this, "Save to", ["hub-oath-workspace-picker", "hub-capture-workspace-picker"]);
            const search = this.contentEl.createEl("input", { type: "search", cls: "hub-oath-search",
                attr: { placeholder: "Search projects and resources…", "aria-label": "Search destinations" } });
            const body = this.contentEl.createDiv({ cls: "hub-capture-workspace-groups" });
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const paintImage = createCardImageRenderer(body, this.owner,
                key => ({ initial: service.plugin.projectWizard.data.headerImagePlacements?.[key] }), service.plugin.cardImageCache);
            const cards = createWorkspaceCards({ app: service.app, root: body, component: this.owner,
                renderImage: (element, url, options) => paintImage(element, url, { ...options, readOnly: true }),
                categories: () => service.plugin.projectWizard.getCategories?.() ?? [], oath: service.plugin.oath });
            const render = () => {
                body.empty();
                const query = search.value.toLocaleLowerCase().trim();
                const all = service.destinations().filter(context => [context.name, context.label].filter(Boolean).join(" ").toLocaleLowerCase().includes(query));
                const positions = service.plugin.projectWizard.data.projectCardOrder?.active ?? [];
                for (const [kind, label] of [["project", "Projects"], ["resource", "Resources"]]) {
                    const contexts = all.filter(context => context.contextKind === kind);
                    if (kind === "project") contexts.sort((a, b) =>
                        (positions.indexOf(a.projectId) < 0 ? Infinity : positions.indexOf(a.projectId)) -
                        (positions.indexOf(b.projectId) < 0 ? Infinity : positions.indexOf(b.projectId)));
                    if (!contexts.length) continue;
                    const group = body.createEl("section", { cls: "hub-capture-workspace-group" });
                    group.createEl("h3", { text: label, cls: "hub-capture-picker-heading" });
                    const grid = group.createDiv({ cls: "hub-oath-workspace-grid is-" + kind });
                    for (const context of contexts) {
                        const card = cards.render(grid, context, () => {
                            const current = service.destinations().find(item => item.id === context.id);
                            if (!current) { error.textContent = "This destination is no longer available."; render(); return; }
                            onSelect?.(current); this.close();
                        });
                        card.dataset.captureWorkspaceId = context.id;
                        card.title = context.name ?? context.label;
                        card.classList.toggle("is-selected", context.id === selectedId);
                        card.setAttribute("aria-pressed", String(context.id === selectedId));
                    }
                }
                if (!all.length) body.createEl("p", { cls: "hub-oath-muted", text: "No matching projects or resources." });
            };
            search.addEventListener("input", render);
            for (const event of ["create", "delete", "rename"]) listen(this.owner, service.app.vault, event, render);
            cancelAction(this); render(); search.focus();
        }
        onClose() { this.owner?.unload(); this.contentEl.empty(); restoreFocus?.(); }
    }
    const modal = new WorkspacePicker(service.app); modal.open(); return modal;
}

// The placement view is intentionally a picker, using the Files row/icon and
// nested group language without mounting the explorer's editing/navigation UI.
function openCaptureLocationPicker(service, { workspace, task = false, selectedPath, getItems, onSelect, restoreFocus } = {}) {
    class LocationPicker extends Modal {
        onOpen() {
            preparePicker(this, task ? "Choose task location" : "Choose a folder", ["hub-capture-location-picker"]);
            if (workspace?.name) this.contentEl.createEl("p", { cls: "hub-oath-muted", text: workspace.name });
            const searchBox = this.contentEl.createDiv({ cls: "hub-explorer-search" });
            setHubIcon(searchBox.createSpan({ cls: "hub-explorer-icon", attr: { "aria-hidden": "true" } }), "search");
            const search = searchBox.createEl("input", { type: "search", cls: "hub-explorer-search-input",
                attr: { placeholder: task ? "Search notes and folders…" : "Search folders…", "aria-label": task ? "Search task locations" : "Search folders" } });
            const tree = this.contentEl.createDiv({ cls: "hub-capture-location-tree", attr: { role: "tree", "aria-label": task ? "Task locations" : "Destination folders" } });
            const error = this.contentEl.createDiv({ cls: "hub-task-error", attr: { role: "alert" } });
            const hierarchy = mountCaptureLocationTree({ tree, search, getItems, foldersOnly: !task, showKind: task,
                selectedPath: () => selectedPath,
                onSelect: current => { onSelect?.(current); this.close(); },
                onMissing: () => { error.textContent = "This location is no longer available."; }
            });
            this.owner.register(() => hierarchy.destroy());
            for (const event of ["create", "delete", "rename"]) listen(this.owner, service.app.vault, event, hierarchy.render);
            cancelAction(this); search.focus();
        }
        onClose() { this.owner?.unload(); this.contentEl.empty(); restoreFocus?.(); }
    }
    const modal = new LocationPicker(service.app); modal.open(); return modal;
}
module.exports = { openCaptureWorkspacePicker, openCaptureLocationPicker, preparePicker, listen };
