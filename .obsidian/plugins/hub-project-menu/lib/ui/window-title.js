"use strict";
const { setIcon } = require("obsidian");

const headers = new WeakMap();
// Keep native heading/undertext styles while moving their outer margins to the
// shared grid. Reading the existing styles also preserves the user's theme.
function createWindowTitle(parent, text, icon, options = {}) {
    const title = parent.createEl("h2", { ...options, text });
    const style = parent.ownerDocument.defaultView.getComputedStyle(title);
    const margins = [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft];
    const color = style.color;
    const header = parent.createEl("div", { cls: "hub-window-header" });
    parent.insertBefore(header, title);
    header.style.margin = margins.join(" ");
    const graphic = header.createEl("span", { cls: "hub-window-title-icon", attr: { "aria-hidden": "true", "data-icon": icon } });
    graphic.style.color = color;
    setIcon(graphic, icon);
    const copy = header.createEl("div", { cls: "hub-window-header-copy" });
    copy.append(title);
    title.classList.add("hub-window-title");
    title.style.margin = "0";
    headers.set(title, { header, copy, bottomMargin: margins[2], tightenedBy: 0 });
    return title;
}

function setWindowUndertext(title, undertext) {
    const state = headers.get(title);
    const { header, copy, bottomMargin } = state;
    const style = undertext.ownerDocument.defaultView.getComputedStyle(undertext);
    // These previously adjacent block elements collapsed their vertical margins.
    const gap = Math.max(parseFloat(bottomMargin), parseFloat(style.marginTop));
    state.bottomMargin = style.marginBottom;
    header.style.marginBottom = style.marginBottom;
    undertext.style.margin = "0";
    undertext.style.marginTop = gap + "px";
    undertext.classList.add("hub-window-undertext");
    copy.append(undertext);
    // Keep the existing header footprint, so tightening the text group does not
    // pull separators or modal content upward. Only the first undertext gap changes.
    header.style.minHeight = Math.max(32, copy.getBoundingClientRect().height + state.tightenedBy) + "px";
    if (copy.children.length === 2) {
        state.tightenedBy = Math.min(4, gap);
        undertext.style.marginTop = (gap - state.tightenedBy) + "px";
    }
    return undertext;
}

module.exports = { createWindowTitle, setWindowUndertext };
