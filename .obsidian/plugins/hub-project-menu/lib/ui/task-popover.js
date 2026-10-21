"use strict";
const { setHubIcon } = require("./icons");
let sequence = 0;
const active = new WeakMap();

// Contextual controls remain inside the modal's focus scope. The native top
// layer avoids clipping by its scrolling body; no second Modal is opened.
function openTaskPopover(anchor, { title, heading = true, autofocus = true, exclusive = true, avoidFooter = false, maxHeight = Infinity, className = "", width = 300, render, onClose = () => {} }) {
    const doc = anchor.ownerDocument, win = doc.defaultView;
    if (exclusive) active.get(doc)?.close(false);
    const parent = anchor.closest(".modal") ?? doc.body;
    const element = parent.createDiv({ cls: "hub-task-popover hub-button-scope hub-capture-form-scope " + className,
        attr: { role: "dialog", "aria-label": title, id: "hub-task-popover-" + ++sequence, popover: "manual" } });
    const header = element.createDiv({ cls: "hub-task-popover-heading" });
    if (heading) header.createEl("strong", { text: title });
    else element.classList.add("is-titleless");
    const dismiss = header.createEl("button", { cls: "hub-button-plain", attr: { type: "button", "aria-label": "Close " + title } });
    setHubIcon(dismiss, "x");
    const body = element.createDiv({ cls: "hub-task-popover-body", attr: { "aria-label": title } });
    const cleanups = [];
    let closed = false;
    const listen = (target, name, callback, options) => {
        target.addEventListener(name, callback, options);
        cleanups.push(() => target.removeEventListener(name, callback, options));
    };
    const close = (restore = true) => {
        if (closed) return;
        closed = true; cleanups.splice(0).forEach(fn => fn());
        observer.disconnect(); element.remove();
        anchor.setAttribute("aria-expanded", "false"); anchor.removeAttribute("aria-controls");
        if (active.get(doc)?.element === element) active.delete(doc);
        onClose();
        if (restore && anchor.isConnected && !anchor.disabled) anchor.focus({ preventScroll: true });
    };
    function position() {
        if (closed) return;
        if (!anchor.isConnected) { close(false); return; }
        const viewport = win.visualViewport, left = (viewport?.offsetLeft ?? 0) + 8, top = (viewport?.offsetTop ?? 0) + 8;
        const right = left + (viewport?.width ?? win.innerWidth) - 16, bottom = top + (viewport?.height ?? win.innerHeight) - 16;
        element.style.width = Math.min(typeof width === "function" ? width(element, right - left) : width, right - left) + "px";
        element.style.maxHeight = Math.max(0, Math.min(maxHeight, bottom - top)) + "px";
        const rect = anchor.getBoundingClientRect(), naturalHeight = element.getBoundingClientRect().height;
        const belowRoom = Math.max(0, bottom - rect.bottom - 6), aboveRoom = Math.max(0, rect.top - top - 6);
        const footer = avoidFooter ? parent.querySelector('.hub-task-dialog-actions')?.getBoundingClientRect() : null;
        const overlapsFooter = footer && rect.bottom + 6 < footer.bottom && rect.bottom + 6 + naturalHeight > footer.top;
        const above = naturalHeight > belowRoom && aboveRoom > belowRoom || overlapsFooter && naturalHeight <= aboveRoom;
        // Long menus scroll in the available side, preserving the anchor gap
        // instead of growing across their trigger when neither side fits.
        element.style.maxHeight = Math.min(maxHeight, bottom - top, Math.max(64, above ? aboveRoom : belowRoom)) + "px";
        const height = element.getBoundingClientRect().height;
        element.style.left = Math.max(left, Math.min(rect.left, right - element.offsetWidth)) + "px";
        element.style.top = Math.max(top, Math.min(above ? rect.top - height - 6 : rect.bottom + 6, bottom - height)) + "px";
    }
    const observer = new win.ResizeObserver(position);
    const api = { element, body, close, position, register: cleanup => cleanups.push(cleanup) };
    dismiss.onclick = () => close();
    anchor.setAttribute("aria-expanded", "true"); anchor.setAttribute("aria-controls", element.id);
    render(api);
    if (typeof element.showPopover === "function") element.showPopover();
    else { element.removeAttribute("popover"); doc.body.append(element); }
    position(); observer.observe(element); if (exclusive) active.set(doc, api);
    // A checklist commit can move an action without scrolling or resizing the
    // viewport. Observe its containing layout as well as the popover itself.
    for (let ancestor = anchor.parentElement; ancestor && ancestor !== doc.body; ancestor = ancestor.parentElement) observer.observe(ancestor);
    listen(doc, "pointerdown", event => { if (!element.contains(event.target) && !anchor.contains(event.target)) close(false); }, true);
    listen(doc, "keydown", event => {
        if (event.key === "Escape") {
            const newest = [...doc.querySelectorAll(".hub-task-popover")].sort((a, b) => Number(a.id.split("-").at(-1)) - Number(b.id.split("-").at(-1))).at(-1);
            if (newest !== element) return;
            event.preventDefault(); event.stopImmediatePropagation(); close();
        }
        else if (event.key === "Tab") {
            if (!autofocus && !element.contains(doc.activeElement)) { close(false); return; }
            const controls = [...element.querySelectorAll("button,input,textarea,select,[tabindex]")]
                .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length && !control.closest("[hidden]"));
            const index = controls.indexOf(doc.activeElement);
            if (index < 0 || !event.shiftKey && index === controls.length - 1 || event.shiftKey && index === 0) close();
            // Keep the outer modal's focus trap from cycling out of this popover.
            else event.stopPropagation();
        }
    }, true);
    listen(win, "resize", position); listen(doc, "scroll", position, true);
    if (win.visualViewport) { listen(win.visualViewport, "resize", position); listen(win.visualViewport, "scroll", position); }
    if (autofocus) (body.querySelector('[aria-checked="true"]') ?? body.querySelector('input:not(:disabled)') ?? body.querySelector('textarea,button,select,[tabindex="0"]') ?? dismiss).focus({ preventScroll: true });
    return api;
}

module.exports = { openTaskPopover };
