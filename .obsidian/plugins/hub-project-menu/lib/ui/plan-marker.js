"use strict";

function paintPlanMarker(el, relevance, setIcon) {
    const level = relevance?.level ?? "";
    if (el.dataset.planLevel !== level) {
        el.dataset.planLevel = level;
        el.replaceChildren();
        if (level === "direct") setIcon(el, "target");
    }
    const description = relevance?.description ?? "";
    if (el.title !== description) el.title = description;
}

function describePlanMarker(el, relevance) {
    const description = relevance?.description ?? null;
    if (el.getAttribute("aria-description") === description) return;
    if (description) el.setAttribute("aria-description", description);
    else el.removeAttribute("aria-description");
}

module.exports = { paintPlanMarker, describePlanMarker };
