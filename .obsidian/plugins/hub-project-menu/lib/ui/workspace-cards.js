"use strict";
const { workspaceRef, sameWorkspace } = require("../domain/oath-workspace");

// Shared by Home and the Oath pickers: identical markup, artwork placement,
// category labels and CSS surfaces. The caller supplies the action.
function createWorkspaceCards({ app, root, component, renderImage, categories = () => [], oath }) {
    const { setIcon } = require("obsidian");
    const cards = new Map();
    const update = () => {
        for (const [card, context] of cards) {
            if (!root.contains(card)) { cards.delete(card); continue; }
            const locked = oath?.canOpen(context, false) === false;
            const bound = oath?.active && sameWorkspace(oath.current.workspace, workspaceRef(context));
            card.classList.toggle("is-oath-locked", locked);
            card.classList.toggle("is-oath-workspace", !!bound);
            card.setAttribute("aria-disabled", String(locked));
            card.tabIndex = locked ? -1 : 0;
            card.querySelector(".hub-workspace-oath-state")?.remove();
            if (locked || bound) {
                const badge = card.createDiv({ cls: "hub-workspace-oath-state", attr: { "aria-label": locked ? "Locked during this Oath" : "Oathbound" } });
                if (locked) setIcon(badge, "lock-keyhole");
                else badge.textContent = "Oathbound";
            }
        }
    };
    if (oath) component.register(oath.onChange(update));
    component.register(() => cards.clear());
    function render(parent, context, activate) {
        const resource = context.contextKind === "resource" || !!context.resourceType || !!context.hubPath;
        const card = parent.createDiv({ cls: resource ? "home-resource-card" : "home-project-card",
            attr: { role: "button", tabindex: "0", "aria-label": context.name ?? context.label } });
        let thumbnail, imagePath, key;
        if (resource) {
            const id = context.resourceType ?? context.id;
            card.dataset.resourceType = id; card.dataset.resourcePath = context.path;
            const face = card.createDiv({ cls: "home-resource-face" });
            thumbnail = face.createDiv({ cls: "home-resource-thumbnail" });
            face.createDiv({ cls: "home-resource-title", text: context.label ?? context.name });
            imagePath = context.image; key = "card:resource:" + id;
        } else {
            card.dataset.projectId = context.projectId || context.path;
            card.dataset.projectPath = context.path; card.dataset.projectStatus = context.status;
            card.draggable = false;
            const surface = card.createDiv({ cls: "home-project-surface" });
            const content = surface.createDiv({ cls: "home-project-content" });
            content.createDiv({ cls: "home-project-title", text: context.name.replace(/^(Book|MSc Thesis|Novel|Research|Poetry)\s*-\s*/i, "") });
            const category = categories().find(item => item.id === context.categoryId || item.name === context.categoryId);
            if (category) content.createDiv({ cls: "home-project-category", text: category.name });
            imagePath = category?.image; key = "card:project:" + (context.projectId || context.path);
            if (imagePath) thumbnail = surface.createDiv({ cls: "home-project-image" });
        }
        const file = imagePath && app.vault.getAbstractFileByPath(imagePath);
        if (file && thumbnail) renderImage(thumbnail, app.vault.getResourcePath(file), { card, sourcePath: file.path, key: key + "::" + file.path });
        else if (resource) {
            card.classList.add("has-icon-fallback");
            setIcon(thumbnail.createSpan({ cls: "home-resource-icon" }), context.icon ?? "library");
        }
        card.addEventListener("click", event => {
            if (oath?.canOpen(context) === false) { event.preventDefault(); event.stopImmediatePropagation(); return; }
            activate?.(event, card);
        });
        card.addEventListener("keydown", event => {
            if (event.target !== card || !["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            if (!card.classList.contains("is-oath-locked")) card.click();
        });
        card.addEventListener("pointerdown", event => {
            if (card.classList.contains("is-oath-locked")) event.stopPropagation();
        });
        cards.set(card, context); update();
        return card;
    }
    return { render, update };
}
module.exports = { createWorkspaceCards };
