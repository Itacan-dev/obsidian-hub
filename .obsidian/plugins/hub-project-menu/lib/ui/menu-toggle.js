"use strict";

// Native menus close on pointer-down outside their surface, before a trigger's
// click. Remember a trigger press in capture phase so that click cannot reopen it.
function bindMenuToggle(trigger, { isOpen, close }) {
    const doc = trigger.ownerDocument;
    let closingPress = false;
    const pointer = event => {
        closingPress = trigger.contains(event.target) && isOpen();
        if (closingPress) close();
    };
    const click = event => {
        if (!closingPress) return;
        closingPress = false; event.preventDefault(); event.stopImmediatePropagation();
    };
    const cancel = () => { closingPress = false; };
    const release = event => { if (!trigger.contains(event.target)) cancel(); };
    doc.addEventListener("pointerdown", pointer, true);
    doc.addEventListener("pointerup", release, true);
    doc.addEventListener("pointercancel", cancel, true);
    trigger.addEventListener("click", click, true);
    return () => {
        doc.removeEventListener("pointerdown", pointer, true);
        doc.removeEventListener("pointerup", release, true);
        doc.removeEventListener("pointercancel", cancel, true);
        trigger.removeEventListener("click", click, true);
    };
}

function mountDisclosure({ trigger, panel, onOpen = () => {}, onClose = () => {} }) {
    const doc = trigger.ownerDocument;
    let opened = false;
    const sync = () => { panel.hidden = !opened; trigger.setAttribute("aria-expanded", String(opened)); };
    const close = () => { if (!opened) return; opened = false; sync(); onClose(); };
    const open = () => { if (opened) return; opened = true; sync(); onOpen(); };
    const toggle = event => { event?.preventDefault(); if (opened) close(); else open(); };
    const outside = event => { if (!trigger.contains(event.target) && !panel.contains(event.target)) close(); };
    const key = event => {
        if (!opened || event.key !== "Escape") return;
        event.preventDefault(); event.stopImmediatePropagation(); close();
        (trigger.querySelector("input[type=radio]") ?? trigger).focus({ preventScroll: true });
    };
    const stopToggle = bindMenuToggle(trigger, { isOpen: () => opened, close });
    trigger.addEventListener("click", toggle);
    doc.addEventListener("pointerdown", outside, true); doc.addEventListener("keydown", key, true);
    sync();
    return { open, close, toggle, get isOpen() { return opened; },
        destroy() { close(); stopToggle(); trigger.removeEventListener("click", toggle); doc.removeEventListener("pointerdown", outside, true); doc.removeEventListener("keydown", key, true); }
    };
}

module.exports = { bindMenuToggle, mountDisclosure };
