"use strict";

function hasKeyboardFocus(control, event) {
    return !!control && control.ownerDocument.activeElement === control &&
        control.matches(":focus-visible") && (!event || event.detail === 0);
}

function focusControl(control) {
    if (!control?.isConnected || control.disabled || control.tabIndex < 0 || !control.getClientRects().length) return false;
    control.focus({ preventScroll: true });
    if (control.ownerDocument.activeElement !== control) return false;
    control.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
}

function focusAfterRowRemoval(controls, index, fallback) {
    for (const control of [...controls.slice(index), ...controls.slice(0, index).reverse(), fallback]) {
        if (focusControl(control)) return;
    }
}

function revealHorizontalKeyboardFocus(control, scroll) {
    if (!scroll?.isConnected || !scroll.contains(control) || !hasKeyboardFocus(control)) return;
    const bounds = scroll.getBoundingClientRect();
    const target = control.getBoundingClientRect();
    const left = bounds.left + scroll.clientLeft;
    const right = left + scroll.clientWidth;
    // Change only this region's horizontal offset; scrollIntoView can move
    // ancestor panes, and native Tab revealing may leave a wide control clipped.
    if (target.left < left) scroll.scrollLeft += target.left - left;
    else if (target.right > right) scroll.scrollLeft += target.right - right;
}

module.exports = { hasKeyboardFocus, focusControl, focusAfterRowRemoval, revealHorizontalKeyboardFocus };
