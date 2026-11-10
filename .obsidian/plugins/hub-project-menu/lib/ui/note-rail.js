"use strict";
const { ownColorRoot } = require("./color-system");
// Controls the existing structural workspace pane; never creates another leaf.
function mountNoteRail(pane, initialState = "full", onChange = () => {}, options = {}) {
    const { setIcon } = require("obsidian");
    const { setHubTooltip } = require("./tooltips");
    const doc = pane.ownerDocument, win = doc.defaultView, root = pane.parentElement;
    let closed = initialState === "closed", drag = null, destroyed = false;
    let preferred = Number.isFinite(options.width) && options.width >= 170 ? options.width : null;
    let full = 0, maximum = 0, minimum = 170, rootWidth = -1;
    const overlay = doc.createElement("div");
    overlay.className = "hub-rail-overlay hub-button-scope";
    const controls = overlay.appendChild(doc.createElement("div"));
    controls.className = "hub-rail-controls";
    const button = controls.appendChild(doc.createElement("button"));
    button.type = "button";
    button.className = "hub-rail-toggle clickable-icon";
    const edge = overlay.appendChild(doc.createElement("div"));
    edge.className = "hub-rail-resizer";
    edge.tabIndex = 0;
    edge.setAttribute("role", "separator");
    edge.setAttribute("aria-orientation", "vertical");
    edge.setAttribute("aria-label", "Folder bar width");
    edge.setAttribute("aria-valuemin", "0");
    const disposeColors = ownColorRoot(overlay);
    const events = new win.AbortController();
    const listen = (target, type, listener) => target.addEventListener(type, listener, { signal: events.signal });
    root.append(overlay);
    // The probe follows the existing CSS responsive width, independent of the pane override.
    const probe = overlay.appendChild(doc.createElement("div"));
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:var(--hub-project-rail-width)";
    const displayed = () => closed ? 0 : Math.min(maximum, Math.max(minimum, preferred));
    const snapshot = () => ({ state: closed ? "closed" : Math.min(maximum, preferred) <= full / 2 ? "half" : "full", width: preferred });
    function render() {
        const width = displayed(), value = snapshot();
        const left = pane.offsetLeft;
        pane.style.setProperty("--hub-rail-custom-width", width + "px");
        pane.dataset.hubRailState = value.state;
        // Controls follow layout immediately. Button changes intentionally use the same path.
        overlay.style.setProperty("--hub-rail-edge", (left + width) + "px");
        overlay.dataset.closed = String(closed);
        const label = closed ? "Expand folder bar" : "Close folder bar";
        if (button.getAttribute("aria-expanded") !== String(!closed)) {
            button.setAttribute("aria-expanded", String(!closed));
            setHubTooltip(button, label);
            setIcon(button, closed ? "panel-left-open" : "panel-left-close");
        }
        edge.setAttribute("aria-valuemax", String(Math.round(maximum)));
        edge.setAttribute("aria-valuenow", String(Math.round(width)));
        edge.setAttribute("aria-valuetext", closed ? "Closed" : Math.round(width) + " pixels");
        onChange(value.state, preferred);
    }
    function commit() { options.onCommit?.(snapshot()); }
    function end(event, persist = true) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        const id = drag.id;
        drag = null; // releasePointerCapture may synchronously dispatch lostpointercapture.
        if (edge.hasPointerCapture(id)) edge.releasePointerCapture(id);
        overlay.classList.remove("is-dragging");
        pane.classList.remove("is-hub-rail-dragging");
        if (persist) commit();
    }
    function measure(force = false) {
        if (destroyed) return;
        const available = root.clientWidth;
        if (!force && available === rootWidth) return;
        end();
        rootWidth = available;
        full = probe.getBoundingClientRect().width || 448;
        // Leave usable document space, including in very narrow windows.
        maximum = Math.max(0, Math.min(full, available - Math.min(170, available / 2)));
        minimum = Math.min(170, maximum);
        if (preferred === null) preferred = initialState === "half" ? Math.max(170, full / 2) : full;
        render();
    }
    function choose(width) {
        end(undefined, false);
        closed = width === 0;
        if (!closed) preferred = Math.max(170, width);
        render(); commit();
    }
    listen(button, "click", () => choose(closed ? preferred : 0));
    listen(edge, "keydown", event => {
        const width = displayed(), half = Math.min(maximum, Math.max(minimum, full / 2));
        const next = event.key === "ArrowLeft" ? (width > half + 1 ? half : 0) :
            event.key === "ArrowRight" ? (closed ? half : maximum) :
            event.key === "Home" ? 0 : event.key === "End" ? maximum : null;
        if (next === null) return;
        event.preventDefault(); event.stopPropagation(); choose(next);
    });
    listen(edge, "pointerdown", event => {
        if (event.button !== 0 || drag) return;
        event.preventDefault(); event.stopPropagation();
        measure();
        drag = { id: event.pointerId, x: event.clientX, width: pane.getBoundingClientRect().width };
        edge.setPointerCapture(event.pointerId);
        overlay.classList.add("is-dragging");
        pane.classList.add("is-hub-rail-dragging");
    });
    listen(edge, "pointermove", event => {
        if (!drag || event.pointerId !== drag.id) return;
        const raw = drag.width + event.clientX - drag.x;
        if (closed) {
            if (raw < Math.max(0, minimum - 10)) return;
            closed = false;
        } else if (raw <= Math.max(0, minimum - 30)) {
            closed = true; render(); return;
        }
        // Moving through a constrained window maximum must not erase a larger preference.
        if (raw >= minimum && raw <= maximum) preferred = Math.max(170, raw);
        else if (raw < minimum && maximum >= 170) preferred = 170;
        else if (raw > maximum) preferred = Math.max(preferred, maximum);
        render();
    });
    const finish = event => end(event);
    const lost = () => end();
    const resize = () => measure(true);
    listen(edge, "pointerup", finish);
    listen(edge, "pointercancel", finish);
    listen(edge, "lostpointercapture", lost);
    listen(win, "blur", lost);
    listen(win, "resize", resize);
    const observer = new win.ResizeObserver(() => measure());
    observer.observe(root);
    measure(true);
    return { pane, getSnapshot: snapshot, destroy() {
        end(); destroyed = true;
        observer.disconnect();
        events.abort();
        disposeColors?.();
        overlay.remove();
        pane.style.removeProperty("--hub-rail-custom-width");
        delete pane.dataset.hubRailState;
    } };
}
module.exports = { mountNoteRail };
