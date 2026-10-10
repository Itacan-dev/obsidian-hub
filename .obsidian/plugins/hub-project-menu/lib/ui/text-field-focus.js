"use strict";

const textFields = ":is(.hub-button-scope, .home-dashboard, .project-dashboard) :is(input:not([type]), input[type=text], input[type=search], input[type=email], input[type=url], input[type=tel], input[type=password], textarea)";

// Chromium also matches :focus-visible for pointer-focused text fields. Remember
// navigation intent so typing and modal autofocus retain their neutral styling.
function trackTextFieldFocus(doc) {
    let keyboardNavigation = false;
    let focused = null;
    const clear = () => {
        focused?.classList.remove("hub-keyboard-focus");
        focused = null;
    };
    const key = event => {
        if (event.key === "Tab") keyboardNavigation = true;
    };
    const pointer = () => { keyboardNavigation = false; clear(); };
    const focus = event => {
        clear();
        if (keyboardNavigation && event.target.matches?.(textFields)) {
            focused = event.target;
            focused.classList.add("hub-keyboard-focus");
        }
    };
    const listeners = [["keydown", key], ["pointerdown", pointer], ["focusin", focus], ["focusout", clear]];
    listeners.forEach(([type, fn]) => doc.addEventListener(type, fn, true));
    return () => {
        listeners.forEach(([type, fn]) => doc.removeEventListener(type, fn, true));
        clear();
    };
}

module.exports = { trackTextFieldFocus };
