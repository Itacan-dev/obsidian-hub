"use strict";
// Keep a native webview connected while Obsidian moves its owning leaf.
// This layer handles presentation only; the native Atlas guard still owns
// requests, authority, deadlines and browser lifetime.
const installed = new WeakMap();
function installGuestSurfaces(document, { partition }) {
    if (installed.has(document)) {
        const prior = installed.get(document);
        if (prior.partition !== partition) throw new Error("Conflicting Atlas guest surface partition");
        return prior.api;
    }
    const win = document.defaultView, prototype = win.Node.prototype;
    const append = prototype.appendChild, insert = prototype.insertBefore;
    const records = new Map(), listeners = [];
    let stopped = false, frame = null, hostPointer = false, hostDrag = false;
    const style = (node, values) => {
        for (const [key, value] of Object.entries(values)) if (node.style[key] !== value) node.style[key] = value;
    };
    function hide(record) { if (!record.surface.hidden) record.surface.hidden = true; }
    const presentation = guest => JSON.stringify([guest.style.display, guest.style.visibility, guest.hidden, guest.className]);
    const insideSurface = node => [...records.values()].some(record => record.surface === node || record.surface.contains(node));
    const suppressPointer = () => {
        for (const record of records.values()) {
            const suppressed = hostPointer || hostDrag || record.contentPointerDisabled;
            style(record.surface, { pointerEvents: suppressed ? "none" : "auto" });
            style(record.guest, { pointerEvents: suppressed ? "none" : record.originalPointer || "auto" });
        }
    };
    function release(contentEl) {
        const record = records.get(contentEl);
        if (!record) return;
        records.delete(contentEl);
        resize?.unobserve(record.slot); resize?.unobserve(contentEl);
        hide(record); record.surface.remove(); record.slot.remove();
    }
    function visible(record) {
        const { contentEl, slot, guest, surface } = record;
        if (contentEl.ownerDocument !== document || slot.ownerDocument !== document) { release(contentEl); return null; }
        if (!contentEl.isConnected || !slot.isConnected || guest.parentNode !== surface ||
            contentEl.classList.contains("hub-atlas-blocked") || contentEl.classList.contains("hub-atlas-internal-home")) return null;
        const guestStyle = win.getComputedStyle(guest), contentStyle = win.getComputedStyle(contentEl);
        const hidden = guest.hidden || guestStyle.display === "none" || guestStyle.visibility === "hidden" ||
            contentStyle.display === "none" || contentStyle.visibility === "hidden";
        style(slot, { display: hidden ? "none" : "" });
        if (hidden) return null;
        const slotStyle = win.getComputedStyle(slot);
        if (slotStyle.display === "none" || slotStyle.visibility === "hidden") return null;
        const rect = slot.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(rect.left + rect.top + rect.width + rect.height)) return null;
        let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
        let right = Math.min(win.innerWidth, rect.right), bottom = Math.min(win.innerHeight, rect.bottom), opacity = 1;
        for (let ancestor = contentEl; ancestor && ancestor !== document.body && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
            const computed = win.getComputedStyle(ancestor);
            if (ancestor.hidden || computed.display === "none" || computed.visibility === "hidden") return null;
            opacity *= Number(computed.opacity);
            const bounds = ancestor.getBoundingClientRect();
            if (/^(hidden|clip|auto|scroll)$/.test(computed.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
            if (/^(hidden|clip|auto|scroll)$/.test(computed.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
        }
        if (!Number.isFinite(opacity) || opacity <= 0) return null;
        // The normal flex slot excludes the status bar. Also respect an
        // overlapping custom-theme status bar so pending actions remain usable.
        const status = contentEl.querySelector(".hub-atlas-navigation-status");
        if (status && !status.hidden && win.getComputedStyle(status).display !== "none") {
            const bounds = status.getBoundingClientRect();
            if (bounds.height > 0 && bounds.top >= rect.top && bounds.top < bottom && bounds.right > left && bounds.left < right) bottom = bounds.top;
        }
        if (right <= left || bottom <= top) return null;
        record.contentPointerDisabled = contentStyle.pointerEvents === "none";
        return { rect, left, top, right, bottom, opacity };
    }
    function sync() {
        if (stopped) return;
        for (const record of [...records.values()]) {
            let geometry;
            try { geometry = visible(record); } catch (_) { geometry = null; }
            if (!geometry) { hide(record); continue; }
            const { rect, left, top, right, bottom, opacity } = geometry;
            style(record.surface, { left: left + "px", top: top + "px", width: (right - left) + "px", height: (bottom - top) + "px", opacity: String(opacity) });
            style(record.guest, { left: (rect.left - left) + "px", top: (rect.top - top) + "px", width: rect.width + "px", height: rect.height + "px" });
            record.surface.hidden = false;
        }
        suppressPointer();
    }
    function schedule() {
        if (stopped || frame !== null || !records.size) return;
        frame = win.requestAnimationFrame(() => { frame = null; sync(); });
    }
    const resize = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(schedule) : null;
    function redirect(parent, guest, before) {
        const old = records.get(parent);
        if (old?.guest === guest) {
            // Repeated mount calls must not reconnect an already-live guest.
            if (before !== old.slot && before !== guest && old.slot.parentNode === parent) insert.call(parent, old.slot, before);
            schedule(); return guest;
        }
        if (old) release(parent);
        const slot = document.createElement("div"), surface = document.createElement("div");
        slot.className = "hub-atlas-guest-slot"; slot.setAttribute("aria-hidden", "true");
        style(slot, { flex: "1 1 0px", width: "100%", height: "100%", minWidth: "0px", minHeight: "0px", pointerEvents: "none" });
        surface.className = "hub-atlas-guest-surface"; surface.dataset.atlasGuestSurface = ""; surface.hidden = true;
        style(surface, { position: "fixed", zIndex: "0", margin: "0px", padding: "0px", border: "0px", overflow: "hidden", pointerEvents: "auto" });
        const originalPointer = guest.style.pointerEvents;
        style(guest, { position: "absolute", margin: "0px", border: "0px", minWidth: "0px", minHeight: "0px", maxWidth: "none", maxHeight: "none" });
        // Use original DOM methods: these placements must never route recursively.
        insert.call(parent, slot, before);
        append.call(document.body || document.documentElement, surface);
        const record = { contentEl: parent, slot, surface, guest, originalPointer, contentPointerDisabled: false, presentation: presentation(guest) };
        records.set(parent, record); resize?.observe(parent); resize?.observe(slot);
        append.call(surface, guest);
        sync(); schedule(); return guest;
    }
    const shouldRedirect = (parent, child) => !stopped && parent?.ownerDocument === document && child?.ownerDocument === document &&
        child.nodeType === 1 && child.localName === "webview" && parent.nodeType === 1 &&
        parent.classList?.contains("webviewer-content") && !Object.hasOwn(parent.dataset, "atlasGuestSurface") &&
        (child.getAttribute("partition") || child.partition) === partition;
    const appendWrapper = function (child) { return shouldRedirect(this, child) ? redirect(this, child, null) : append.call(this, child); };
    const insertWrapper = function (child, before) { return shouldRedirect(this, child) ? redirect(this, child, before) : insert.call(this, child, before); };
    prototype.appendChild = appendWrapper; prototype.insertBefore = insertWrapper;
    const mutations = new win.MutationObserver(changes => {
        if (!records.size) return;
        for (const change of changes) {
            if (insideSurface(change.target)) {
                const record = [...records.values()].find(item => item.guest === change.target);
                if (record) {
                    const next = presentation(record.guest);
                    if (next !== record.presentation) {
                        record.presentation = next;
                        // Background windows may throttle RAF. Hiding a reader
                        // or blocked browser cannot wait for a geometry frame.
                        const computed = win.getComputedStyle(record.guest);
                        if (record.guest.hidden || computed.display === "none" || computed.visibility === "hidden") {
                            hide(record); style(record.slot, { display: "none" });
                        }
                        schedule();
                    }
                }
                continue;
            }
            for (const record of records.values()) {
                if (change.target === record.slot) continue;
                const related = change.target === record.contentEl || change.target.contains?.(record.contentEl) ||
                    [...change.addedNodes, ...change.removedNodes].some(node => node === record.contentEl || node.contains?.(record.contentEl));
                if (related) {
                    try { if (!visible(record)) hide(record); } catch (_) { hide(record); }
                    schedule();
                }
            }
        }
    });
    mutations.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    function on(target, event, callback, capture = false) { target.addEventListener(event, callback, capture); listeners.push(() => target.removeEventListener(event, callback, capture)); }
    on(document, "scroll", schedule, true); on(win, "resize", schedule);
    on(document, "pointerdown", event => { if (!insideSurface(event.target)) { hostPointer = true; suppressPointer(); } }, true);
    on(document, "pointerup", () => { hostPointer = false; suppressPointer(); schedule(); }, true);
    on(document, "pointercancel", () => { hostPointer = false; suppressPointer(); schedule(); }, true);
    on(document, "pointermove", event => { if (hostPointer && !hostDrag && event.buttons === 0) { hostPointer = false; suppressPointer(); } }, true);
    on(document, "dragstart", () => { hostDrag = true; suppressPointer(); }, true);
    const endDrag = () => { hostDrag = false; hostPointer = false; suppressPointer(); schedule(); };
    on(document, "dragend", endDrag, true); on(document, "drop", endDrag, true); on(win, "blur", endDrag);
    on(document, "keydown", event => { if (event.key === "Escape") endDrag(); }, true);
    const api = {
        sync, release, get: contentEl => records.get(contentEl) || null,
        destroy() {
            if (stopped) return;
            stopped = true;
            if (frame !== null) { win.cancelAnimationFrame(frame); frame = null; }
            resize?.disconnect(); mutations.disconnect(); for (const remove of listeners) remove();
            for (const contentEl of [...records.keys()]) release(contentEl);
            if (prototype.appendChild === appendWrapper) prototype.appendChild = append;
            if (prototype.insertBefore === insertWrapper) prototype.insertBefore = insert;
            installed.delete(document);
        }
    };
    installed.set(document, { partition, api }); return api;
}
module.exports = { installGuestSurfaces };
