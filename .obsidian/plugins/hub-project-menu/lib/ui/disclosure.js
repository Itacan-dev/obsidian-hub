"use strict";
function disclosureIcons(button) {
    const { setIcon } = require("obsidian");
    button.classList.add("hub-disclosure");
    // Both icons follow the aria-expanded state owned by the menu, including
    // outside clicks, Escape, selection, resize and view disposal.
    for (const [state, name] of [["closed", "chevron-right"], ["open", "chevron-down"]]) {
        const icon = button.createEl("span", { cls: `hub-presets-chevron is-${state}` });
        icon.setAttribute("aria-hidden", "true");
        setIcon(icon, name);
    }
}
module.exports = { disclosureIcons };
