"use strict";
const { workspaceRef, sameWorkspace } = require("../domain/oath-workspace");
const { paintPlanMarker, describePlanMarker } = require("./plan-marker");

// Shared workspace card markup, artwork placement and category labels.
function createWorkspaceCards({ app, root, component, renderImage, categories = () => [], oath, planRelevance }) {
    const { setIcon } = require("obsidian");
    const cards = new Map();
    const updateOath = (card, context) => {
        const locked = oath?.canOpen(context, false) === false;
        const bound = oath?.active && (oath.focusWorkspaces ?? [oath.current.workspace])
            .some(ref => sameWorkspace(ref, workspaceRef(context)));
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
    };
    const updatePlan = (card, context, marker) => {
        if (!marker) return;
        const relevance = planRelevance.snapshot.workspace(workspaceRef(context));
        card.classList.toggle("is-directly-planned", relevance?.level === "direct");
        paintPlanMarker(marker, relevance, setIcon);
        describePlanMarker(card, relevance);
    };
    const visit = callback => {
        for (const [card, { context, marker }] of cards) {
            if (!root.contains(card)) { cards.delete(card); continue; }
            callback(card, context, marker);
        }
    };
    const update = () => visit(updateOath);
    let pruning = false;
    function pruneAfterRender() {
        if (pruning) return;
        pruning = true;
        queueMicrotask(() => {
            pruning = false;
            for (const card of cards.keys()) if (!root.contains(card)) cards.delete(card);
        });
    }
    if (oath) component.register(oath.onChange(update));
    planRelevance?.subscribe(component, () => visit(updatePlan));
    component.register(() => cards.clear());
    function render(parent, context, activate) {
        const resource = context.contextKind === "resource" || !!context.resourceType || !!context.hubPath;
        const card = parent.createDiv({ cls: resource ? "home-resource-card" : "home-project-card",
            attr: { role: "button", tabindex: "0", "aria-label": context.name ?? context.label } });
        let thumbnail, imagePath, key, face;
        if (resource) {
            const id = context.resourceType ?? context.id;
            card.dataset.resourceType = id; card.dataset.resourcePath = context.path;
            face = card.createDiv({ cls: "home-resource-face" });
            thumbnail = face.createDiv({ cls: "home-resource-thumbnail" });
            const label = context.label ?? context.name;
            const title = face.createDiv({ cls: "home-resource-title", text: label });
            if (parent.classList.contains("home-resource-grid")) title.setAttribute("title", label);
            imagePath = context.image; key = "card:resource:" + id;
        } else {
            card.dataset.projectId = context.projectId || context.path;
            card.dataset.projectPath = context.path; card.dataset.projectStatus = context.status;
            card.draggable = false;
            const surface = face = card.createDiv({ cls: "home-project-surface" });
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
        if (resource) card.addEventListener("contextmenu", event => {
            if (!window.hubPlan) return;
            event.preventDefault(); event.stopPropagation();
            const menu=require("./color-system").ownMenuColors(new (require("obsidian").Menu)());
            menu.addItem(item=>item.setTitle("Add to plan").setIcon("list-plus").onClick(()=>void window.hubPlan.workspace(context)));
            menu.showAtMouseEvent(event);
        });
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
        const marker = planRelevance && face.createSpan({
            cls: "hub-card-plan-marker", attr: { "aria-hidden": "true" }
        });
        cards.set(card, { context, marker });
        pruneAfterRender();
        updateOath(card, context);
        updatePlan(card, context, marker);
        return card;
    }
    return { render, update };
}
module.exports = { createWorkspaceCards };
