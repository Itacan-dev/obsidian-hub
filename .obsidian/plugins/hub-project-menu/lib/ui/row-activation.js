"use strict";

// Keep embedded Markdown links and controls independent of their history row.
const interactiveDescendant = "a, input, textarea, button, select, summary, [contenteditable]:not([contenteditable=false]), [role=button], [role=link], [tabindex], .home-task-location, .project-task-location";

function makeActionableRow(row, activate) {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.classList.add("hub-actionable-row");
    row.addEventListener("click", event => {
        const control = event.target.closest?.(interactiveDescendant);
        if (control && control !== row && row.contains(control)) return;
        activate(event);
    });
    row.addEventListener("keydown", event => {
        if (event.target !== row || event.altKey || event.ctrlKey || event.metaKey || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) row.click();
    });
}

module.exports = { makeActionableRow };
