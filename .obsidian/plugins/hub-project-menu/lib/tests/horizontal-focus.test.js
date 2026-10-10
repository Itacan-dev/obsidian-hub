"use strict";

const assert = require("assert");
const { revealHorizontalKeyboardFocus } = require("../ui/focus-restoration");
const doc = { activeElement: null };
const control = {
    ownerDocument: doc, keyboard: true,
    matches() { return this.keyboard; },
    getBoundingClientRect() { return this.rect; }
};
const scroll = {
    isConnected: true, clientLeft: 1, clientWidth: 200, scrollLeft: 60, scrollTop: 12,
    contains: item => item === control,
    getBoundingClientRect: () => ({ left: 100, right: 317 })
};
doc.activeElement = control;
control.rect = { left: 220, right: 327 };
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 86, "Reveal the full right edge inside the client area, excluding borders/scrollbars");
control.rect = { left: 75, right: 145 };
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 60, "Reveal the left edge");
control.rect = { left: 110, right: 180 };
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 60, "Visible controls do not scroll");
assert.strictEqual(scroll.scrollTop, 12, "Vertical scrolling is untouched");
control.rect = { left: 220, right: 327 };
control.keyboard = false;
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 60, "Pointer focus does not scroll");
control.keyboard = true;
doc.activeElement = null;
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 60, "Deferred work ignores controls that lost focus");
doc.activeElement = control;
scroll.isConnected = false;
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 60, "Deferred work ignores unmounted regions");
scroll.isConnected = true;
scroll.contains = () => false;
revealHorizontalKeyboardFocus(control, scroll);
assert.strictEqual(scroll.scrollLeft, 60, "Other regions are untouched");
console.log("Horizontal keyboard focus tests passed.");
