"use strict";
const { setHubIcon } = require("./icons");
let sequence = 0;

// Disclosure only: callers retain their existing controls and draft ownership.
function mountTaskAccordion(host) {
    const doc = host.ownerDocument, view = doc.defaultView;
    let active = null, pinned = false;
    const entries = [], modal = host.closest(".modal");
    const bodyRegion = () => host.closest(".hub-modal-body");
    const surface = host.previousElementSibling;
    const fitCard = () => {
        const region = bodyRegion(); if (!pinned || !modal || !region || !surface) return;
        const chrome = modal.getBoundingClientRect().height - region.getBoundingClientRect().height;
        const available = parseFloat(view.getComputedStyle(modal).maxHeight) - chrome;
        const heading = (active?.control.button ?? entries[0]?.control.button)?.getBoundingClientRect().height ?? 0;
        // A checklist taller than the body must retain its ordinary scrolling;
        // pinning it would make every configuration control unreachable.
        const inset = parseFloat(view.getComputedStyle(surface).top) || 0;
        surface.style.position = surface.getBoundingClientRect().height + heading + inset + 8 > available ? "static" : "";
    };
    const cardObserver = new view.ResizeObserver(fitCard);
    if (surface) cardObserver.observe(surface);
    const position = () => {
        if (!pinned || !modal) return;
        const chrome = modal.getBoundingClientRect().height - (bodyRegion()?.getBoundingClientRect().height ?? 0);
        const top = Math.min(initialTop, Math.max(16, view.innerHeight - chrome - 32));
        modal.style.top = top + "px";
        modal.style.left = Math.max(16, (view.innerWidth - modal.getBoundingClientRect().width) / 2) + "px";
        modal.style.maxHeight = Math.min(maxHeight, view.innerHeight - top - 16) + "px";
        fitCard();
        if (active && typeof active.options.width === "function") {
            active.section.style.setProperty("--hub-task-endpoint-width", active.options.width(active.section, active.section.clientWidth) + "px");
        }
    };
    let initialTop, maxHeight;
    const pin = () => {
        if (pinned || !modal) return;
        const box = modal.getBoundingClientRect(); initialTop = box.top;
        maxHeight = parseFloat(view.getComputedStyle(modal).maxHeight) || view.innerHeight - 32;
        pinned = true; Object.assign(modal.style, { position: "fixed", margin: "0", transform: "none" }); position();
        if (bodyRegion()) cardObserver.observe(bodyRegion());
    };
    const reveal = entry => {
        const region = bodyRegion(); if (!region) return;
        const bounds = region.getBoundingClientRect(), section = entry.section.getBoundingClientRect();
        // Scroll the modal body alone. Keep the heading visible when possible.
        const heading = entry.control.button.getBoundingClientRect();
        const card = host.previousElementSibling?.getBoundingClientRect();
        const inset = surface ? parseFloat(view.getComputedStyle(surface).top) || 0 : 0;
        const contentTop = bounds.top + (surface?.style.position === "static" ? 0 : (card?.height ?? 0) + inset) + 8;
        const delta = Math.min(section.bottom - bounds.bottom, heading.top - contentTop);
        if (delta > 0) region.scrollTop += delta;
    };
    const bind = (control, options) => {
        const id = "hub-task-configuration-" + ++sequence;
        const group = host.createDiv({ cls: "hub-task-config-group" });
        control.button.before(group); group.append(control.button);
        const section = group.createDiv({ cls: "hub-task-config-section hub-button-scope hub-capture-form-scope " + (options.className || ""),
            attr: { id, role: "region", "aria-label": options.title } });
        control.button.after(section); section.hidden = true;
        control.button.id ||= id + "-heading"; section.setAttribute("aria-labelledby", control.button.id);
        control.button.setAttribute("aria-controls", id); control.button.setAttribute("aria-expanded", "false");
        const chevron = control.button.createSpan({ cls: "hub-task-config-chevron", attr: { "aria-hidden": "true" } });
        setHubIcon(chevron, "chevron-right");
        const entry = { control, section, options, cleanups: [] };
        entries.push(entry);
        const finish = () => { section.hidden = true; section.replaceChildren(); };
        const close = (restore = true) => {
            if (active !== entry) return;
            active = null; section.hidden = true; group.classList.remove("is-expanded");
            control.button.setAttribute("aria-expanded", "false"); setHubIcon(chevron, "chevron-right"); section.inert = true;
            entry.cleanups.splice(0).forEach(fn => fn()); options.onClose?.();
            if (restore && control.button.isConnected && !control.button.disabled) control.button.focus({ preventScroll: true });
            finish();
        };
        entry.close = close;
        const open = () => {
            if (control.button.disabled || control.button.hidden) return;
            if (active === entry) { close(); return; }
            pin(); active?.close(false);
            active = entry; group.classList.add("is-expanded"); section.hidden = false; section.inert = false;
            control.button.setAttribute("aria-expanded", "true"); setHubIcon(chevron, "chevron-down");
            options.render({ body: section, element: section, close, register: fn => entry.cleanups.push(fn) });
            fitCard();
            if (typeof options.width === "function") {
                const width = options.width(section, section.clientWidth); section.style.setProperty("--hub-task-endpoint-width", width + "px");
            }
            const focus = section.querySelector('[aria-checked="true"]') ?? section.querySelector('input:not(:disabled),textarea,button:not(:disabled)');
            focus?.focus({ preventScroll: true }); reveal(entry);
        };
        const key = event => { if (event.key === "ArrowDown") { event.preventDefault(); open(); } };
        const beforeFocus = () => { if (!control.button.disabled && !control.button.hidden) pin(); };
        control.button.addEventListener("pointerdown", beforeFocus); control.button.addEventListener("click", open); control.button.addEventListener("keydown", key);
        return { close, destroy() { close(false); finish(); control.button.removeEventListener("pointerdown", beforeFocus); control.button.removeEventListener("click", open); control.button.removeEventListener("keydown", key); group.remove(); } };
    };
    const retainDateFocus = event => {
        if (event.button !== 0 || !active?.section.classList.contains("hub-task-date-endpoint")) return;
        const input = doc.activeElement;
        if (!active.section.contains(input) || !input.matches("input[type=date],input[type=time]") || input.matches(":open")) return;
        const target = event.target.closest?.(".hub-task-config-action, .hub-task-popover-actions > button, .hub-task-steps-toggle.is-empty-steps, .hub-task-add-step, .hub-task-dialog-actions > button:not(.hub-task-remove), .modal-close-button");
        // Native mousedown otherwise blurs the segmented field before click
        // dismisses it, leaving a paintable unfocused frame during the press.
        // Keep normal click/submit and canceled-drag behavior; close already
        // hides the section synchronously before cleanup and focus restoration.
        if (target && !target.disabled && target.closest(".modal") === modal) event.preventDefault();
    };
    const escape = event => {
        if (event.key !== "Escape" || event.isComposing || !active || doc.querySelector(".hub-task-description-tooltip") || host.querySelector("input:open")) return;
        event.preventDefault(); event.stopImmediatePropagation(); active.close();
    };
    // The native Modal listens on the document. Handle disclosure first.
    modal?.addEventListener("mousedown", retainDateFocus);
    view.addEventListener("keydown", escape, true); view.addEventListener("resize", position);
    return { bind, close: (restore = false) => active?.close(restore), destroy() { entries.forEach(entry => entry.close(false)); cardObserver.disconnect(); modal?.removeEventListener("mousedown", retainDateFocus); view.removeEventListener("keydown", escape, true); view.removeEventListener("resize", position); } };
}
module.exports = { mountTaskAccordion };
