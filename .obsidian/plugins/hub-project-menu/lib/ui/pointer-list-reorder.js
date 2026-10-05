"use strict";
// Extracted from Presets: floating row, frozen slot centers, dashed placeholder,
// horizontal confinement, cancellation, pointer capture and edge auto-scroll.
function createPointerListReorder({ container, scroller = container, canStart = () => true,
    commit: save, onError = () => {}, placeholderClass = "hub-preset-placeholder",
    sortingClass = "is-sorting-presets", focusTarget = row => row, animate = false }) {
    const doc = container.ownerDocument, win = doc.defaultView;
    let drag = null, suppressClick = false, settling = null, settledSave = null;
    const duration = 140;
    function animateRow(row, previousTop) {
        if (!animate || previousTop == null || win.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const delta = previousTop - row.getBoundingClientRect().top;
        if (delta) row.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
            { duration, easing: "ease-out" });
    }
    function beginDrag(event, item, list) {
        if (event.button !== 0 || event.isPrimary === false || !canStart(event) || drag) return;
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
            d.containerWidth = container.style.width;
            container.style.width = `${container.getBoundingClientRect().width}px`;
            const rect = d.item.getBoundingClientRect(), listRect = d.list.getBoundingClientRect();
            d.offsetY = d.startY - rect.top; d.height = rect.height;
            // Frozen slot centers avoid feedback from rows moving around the placeholder.
            d.centers = d.rows.map(row => { const r = row.getBoundingClientRect(); return r.top - listRect.top + r.height / 2; });
            d.placeholder = doc.createElement("div"); d.placeholder.className = placeholderClass;
            d.placeholder.style.height = `${rect.height}px`; d.placeholder.setAttribute("aria-hidden", "true");
            d.item.before(d.placeholder);
            d.item.classList.add("is-dragging", "is-pointer-dragging");
            d.item.style.width = `${rect.width}px`; d.item.style.left = `${rect.left - listRect.left}px`;
            container.classList.add(sortingClass);
            if (event.isTrusted) container.setPointerCapture?.(d.pointerId);
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
            const positions = animate ? others.map(row => row.getBoundingClientRect().top) : [];
            d.list.insertBefore(d.placeholder, others[index] ?? null);
            others.forEach((row, i) => animateRow(row, positions[i]));
        }
    }
    function scrollDrag() {
        const d = drag;
        if (!d?.active) return;
        const rect = scroller.getBoundingClientRect(), edge = 28;
        const speed = d.y < rect.top + edge ? -8 : d.y > rect.bottom - edge ? 8 : 0;
        if (speed) { scroller.scrollTop += speed; positionDrag(); }
        d.frame = doc.defaultView.requestAnimationFrame(scrollDrag);
    }
    function dropDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const rect = scroller.getBoundingClientRect(), listRect = drag.list.getBoundingClientRect();
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
        if (container.hasPointerCapture?.(d.pointerId)) container.releasePointerCapture(d.pointerId);
        const ordered = d.rows.filter(row => row !== d.item); ordered.splice(d.index, 0, d.item);
        const lastTop = d.item.getBoundingClientRect().top;
        if (commit && !animate) {
            try { save(ordered, d.item); }
            catch (error) { commit = false; onError(error); }
        }
        d.placeholder.remove(); d.item.classList.remove("is-dragging", "is-pointer-dragging");
        for (const property of ["width", "left", "top"]) d.item.style.removeProperty(property);
        d.list.append(...(commit ? ordered : d.rows));
        container.style.width = d.containerWidth;
        container.classList.remove(sortingClass);
        suppressClick = true;
        doc.defaultView.setTimeout(() => { suppressClick = false; }, 0);
        (focusTarget(d.item) ?? d.item).focus({ preventScroll: true });
        if (animate) {
            animateRow(d.item, lastTop);
            if (commit) {
                settledSave = () => { const saveOrder = settledSave; settledSave = null; settling = null;
                    if (saveOrder) save(ordered, d.item); };
                settling = win.setTimeout(settledSave, duration);
            }
        }
    }
    container.addEventListener("click", event => {
        if (suppressClick || drag?.active) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    container.addEventListener("dragstart", event => event.preventDefault());
    container.addEventListener("lostpointercapture", event => {
        if (drag?.pointerId === event.pointerId) finishDrag(false);
    });
    return { begin: beginDrag, get busy() { return !!drag || settling != null; },
        get active() { return !!drag?.active; }, cancel() {
            // A completed drop must still save if its view closes during settling.
            if (settling != null) { win.clearTimeout(settling); settledSave?.(); }
            finishDrag(false);
        } };
}
module.exports = { createPointerListReorder };
