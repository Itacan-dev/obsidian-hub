"use strict";
const { setIcon } = require("obsidian");
const { setHubTooltip } = require("./tooltips");

// This is part of the existing global footer, not any dashboard or workspace leaf.
function mountDailyBriefControl(plugin, service, host) {
    const button = host.createEl("button", { cls: "hub-oath-button hub-daily-brief-button",
        attr: { type: "button", "aria-label": "Daily brief", "aria-haspopup": "dialog" } });
    setIcon(button.createSpan({ cls: "hub-oath-icon", attr: { "aria-hidden": "true" } }), "newspaper"); // Lucide Newspaper
    button.createSpan({ text: "Daily brief" });
    const update = () => {
        const { available, reason } = service.availability();
        // aria-disabled retains keyboard focus so the unavailable reason is discoverable.
        button.setAttribute("aria-disabled", String(!available));
        setHubTooltip(button, reason ? `Daily brief: ${reason}` : "Daily brief", "top");
    };
    plugin.registerDomEvent(button, "click", () => {
        service.refreshAvailability();
        if (service.availability().available) void service.openManual();
    });
    plugin.registerDomEvent(button, "pointerenter", () => service.refreshAvailability());
    plugin.registerDomEvent(button, "focus", () => service.refreshAvailability());
    const stop = service.onChange(update);
    update();
    return { button, destroy() { stop(); button.remove(); } };
}
module.exports = { mountDailyBriefControl };
