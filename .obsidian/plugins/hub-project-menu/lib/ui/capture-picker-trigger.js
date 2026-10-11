"use strict";
const { setHubIcon } = require("./icons");

// Shared presentation only: each form keeps its own destination provider/state.
function createCapturePickerTrigger(host, { label, title, subtitle, icon, onOpen, disabled = false, renderIcon }) {
    const button = host.createEl("button", { cls: "hub-capture-picker-trigger", attr: {
        type: "button", "aria-label": label, "aria-haspopup": "dialog"
    } });
    button.disabled = disabled;
    const graphic = renderIcon ? null : button.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } });
    if (renderIcon) renderIcon(button);
    const copy = button.createSpan({ cls: "hub-capture-picker-copy" });
    const name = copy.createSpan();
    let detail = null;
    setHubIcon(button.createSpan({ cls: "hub-capture-icon", attr: { "aria-hidden": "true" } }), "chevron-down");
    const update = ({ title, subtitle, icon }) => {
        name.textContent = title ?? "";
        if (subtitle) {
            if (!detail) detail = copy.createSpan({ cls: "hub-capture-muted" });
            detail.textContent = subtitle;
        } else { detail?.remove(); detail = null; }
        if (graphic && icon) setHubIcon(graphic, icon);
        button.title = [title, subtitle].filter(Boolean).join(" · ");
    };
    update({ title, subtitle, icon });
    button.addEventListener("click", () => onOpen());
    return { button, update };
}
module.exports = { createCapturePickerTrigger };
