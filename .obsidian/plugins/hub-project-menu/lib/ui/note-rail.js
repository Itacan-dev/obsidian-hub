"use strict";

// Controls the existing structural workspace pane; never creates another leaf.
function mountNoteRail(pane, initialState = "full", onChange = () => {}) {
    const { setIcon } = require("obsidian");
    const { setHubTooltip } = require("./tooltips");
    const states = ["closed", "half", "full"];
    const doc = pane.ownerDocument;
    let state = states.includes(initialState) ? initialState : "full", drag = null;
    const controls = doc.createElement("div");
    controls.className = "hub-rail-controls hub-button-scope";
    const button = controls.appendChild(doc.createElement("button"));
    button.type = "button";
    button.className = "hub-rail-toggle clickable-icon";
    const edge = doc.createElement("div");
    edge.className = "hub-rail-resizer";
    edge.tabIndex = 0;
    edge.setAttribute("role", "separator");
    edge.setAttribute("aria-orientation", "vertical");
    edge.setAttribute("aria-label", "Folder bar width");
    edge.setAttribute("aria-valuemin", "0");
    edge.setAttribute("aria-valuemax", "2");
    pane.append(controls, edge);

    function select(next) {
        state = next;
        pane.dataset.hubRailState = state;
        const label = state === "full" ? "Collapse folder bar to half width" :
            state === "half" ? "Close folder bar" : "Expand folder bar";
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-expanded", String(state !== "closed"));
        setHubTooltip(button, label);
        setIcon(button, state === "closed" ? "panel-left-open" : "panel-left-close");
        edge.setAttribute("aria-valuenow", String(states.indexOf(state)));
        edge.setAttribute("aria-valuetext", state);
        onChange(state);
    }
    button.addEventListener("click", () => select(state === "full" ? "half" : state === "half" ? "closed" : "full"));
    edge.addEventListener("keydown", event => {
        const index = states.indexOf(state);
        const next = event.key === "ArrowLeft" ? Math.max(0, index - 1) :
            event.key === "ArrowRight" ? Math.min(2, index + 1) :
            event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
        if (next === null) return;
        event.preventDefault(); event.stopPropagation(); select(states[next]);
    });
    function end(event) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        if (edge.hasPointerCapture(drag.id)) edge.releasePointerCapture(drag.id);
        drag = null;
        edge.classList.remove("is-dragging");
    }
    edge.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        // Measure the responsive Full width without changing the live pane.
        const probe = doc.createElement("div");
        probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:var(--hub-project-rail-width)";
        pane.append(probe);
        const full = probe.getBoundingClientRect().width;
        probe.remove();
        const widths = [32, full / 2, full];
        drag = { id: event.pointerId, x: event.clientX, width: widths[states.indexOf(state)], widths };
        edge.setPointerCapture(event.pointerId);
        edge.classList.add("is-dragging");
    });
    edge.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.id) return;
        const width = drag.width + event.clientX - drag.x;
        const nearest = drag.widths.reduce((best, value, i) =>
            Math.abs(value - width) < Math.abs(drag.widths[best] - width) ? i : best, 0);
        if (states[nearest] !== state) select(states[nearest]);
    });
    edge.addEventListener("pointerup", end);
    edge.addEventListener("pointercancel", end);
    edge.addEventListener("lostpointercapture", () => { drag = null; edge.classList.remove("is-dragging"); });
    select(state);
    return { pane, destroy() { end(); controls.remove(); edge.remove(); delete pane.dataset.hubRailState; } };
}

module.exports = { mountNoteRail };
