"use strict";
const { setIcon } = require("obsidian");

const headers = new WeakMap();
// Keep native heading/undertext styles while moving their outer margins to the
// shared grid. Reading the existing styles also preserves the user's theme.
function createWindowTitle(parent, text, icon, options = {}) {
    const { date, ...titleOptions } = options;
    const title = parent.createEl("h2", { ...titleOptions, text });
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
    if (date) {
        const row = copy.createEl("div", { cls: "hub-window-title-row" });
        row.append(title);
        const dateEl = row.createEl("time", { cls: "hub-window-header-date",
            text: date.label, attr: { datetime: date.value } });
        // Reuse the native/theme heading typography already read for this title.
        dateEl.style.font = style.font;
        dateEl.style.color = color;
    }
    title.classList.add("hub-window-title");
    title.style.margin = "0";
    headers.set(title, { header, copy, bottomMargin: margins[2] });
    return title;
}

function setWindowUndertext(title, undertext) {
    const state = headers.get(title);
    const { header, copy, bottomMargin } = state;
    const style = undertext.ownerDocument.defaultView.getComputedStyle(undertext);
    // All first subtitles use Quick Add's shared gap; subsequent status lines
    // retain their intentional spacing.
    const firstUndertext = copy.children.length === 1;
    const gap = firstUndertext
        ? parseFloat(header.ownerDocument.defaultView.getComputedStyle(header).getPropertyValue("--hub-window-subtitle-gap")) || 6
        : Math.max(parseFloat(bottomMargin), parseFloat(style.marginTop));
    state.bottomMargin = style.marginBottom;
    header.style.marginBottom = style.marginBottom;
    undertext.style.margin = "0";
    undertext.style.marginTop = gap + "px";
    undertext.classList.add("hub-window-undertext");
    copy.append(undertext);
    // Center the icon on the complete text group.
    header.style.minHeight = Math.max(32, copy.getBoundingClientRect().height) + "px";
    return undertext;
}

// Keep native chrome and existing form ownership; only the middle region scrolls.
function layoutModal(modal, { container = modal.contentEl, headerEnd, footer, body, bodyClass = "" } = {}) {
    const root = modal.contentEl;
    headerEnd ??= root.querySelector(":scope > .hub-window-header, :scope > h2, :scope > .hub-statistics-header");
    if (headerEnd?.nextElementSibling?.classList.contains("hub-project-advancement-divider"))
        headerEnd = headerEnd.nextElementSibling;
    footer ??= container.querySelector(":scope > .hub-capture-actions, :scope > .hub-task-dialog-actions, :scope > .hub-oath-actions, :scope > .hub-project-advancement-actions, :scope > .hub-project-wizard-actions");
    if (!body) {
        const children = [...container.children];
        const start = container === root && headerEnd ? children.indexOf(headerEnd) + 1 : 0;
        const contents = children.slice(start).filter(child => child !== footer);
        body = container.createDiv();
        container.insertBefore(body, contents[0] ?? footer ?? null);
        body.append(...contents);
    }
    body.classList.add("hub-modal-body");
    if (bodyClass) body.classList.add(bodyClass);
    root.classList.add("hub-modal-layout");
    modal.modalEl.classList.add("hub-modal-window");
    if (container !== root) container.classList.add("hub-modal-form");
    return body;
}

module.exports = { createWindowTitle, setWindowUndertext, layoutModal };
