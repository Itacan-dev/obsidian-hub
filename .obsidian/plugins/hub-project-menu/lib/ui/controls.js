"use strict";

const { Menu } = require("obsidian");
const { ownMenuColors } = require("./color-system");
const { setHubIcon } = require("./icons");
const { setHubTooltip } = require("./tooltips");
const { bindMenuToggle } = require("./menu-toggle");
const { disclosureIcons } = require("./disclosure");

function createIconAction(host, label, icon, action) {
    const button = host.createEl("button", { cls: "hub-button-plain hub-icon-action hub-control-icon",
        attr: { type: "button", "aria-label": label } });
    setHubIcon(button.createSpan({ cls: "hub-icon-action-glyph", attr: { "aria-hidden": "true" } }), icon);
    setHubTooltip(button, label);
    if (action) button.addEventListener("click", action);
    return button;
}

function createPanelAction(host, label, action) {
    const button = host.createEl("button", { cls: "hub-panel-action hub-panel-add",
        attr: { type: "button", "aria-label": "Add " + label.toLowerCase(), "aria-haspopup": "dialog" } });
    setHubIcon(button.createSpan({ attr: { "aria-hidden": "true" } }), "plus");
    button.createSpan({ text: label });
    button.addEventListener("click", action);
    return button;
}

const projectStatuses = [["active", "Active"], ["future", "Future"], ["shelved", "Shelved"]];

function projectStatusLabels(projects) {
    return projectStatuses.map(([status, label]) =>
        label + " (" + projects.filter(project => !project.deleted && project.status === status).length + ")");
}

// These members may live in different panels or in different dashboards.
function sizeDashboardButton(button, group, projects = []) {
    if (!button) return;
    const labels = group === "top-actions"
        ? [["Today"], ["Planner"], ["Task", "plus"]]
        : [...projectStatusLabels(projects).map(label => [label]), ["Project", "plus"], ["Report", "plus"]];
    let content = button.querySelector(":scope > .hub-button-width-label");
    if (!content) {
        content = button.ownerDocument.createElement("span");
        content.className = "hub-button-width-label";
        content.append(...button.childNodes);
        button.append(content);
        button.classList.add("hub-button-width-member");
    }
    const key = JSON.stringify(labels);
    if (button.dataset.hubWidthLabels === key) return;
    button.dataset.hubWidthLabels = key;
    for (const old of button.querySelectorAll(":scope > .hub-button-width-probe")) old.remove();
    for (const [label, icon] of labels) {
        const probe = button.createSpan({ cls: "hub-button-width-probe", attr: { "aria-hidden": "true", inert: "" } });
        if (icon) setHubIcon(probe.createSpan(), icon);
        probe.createSpan({ text: label });
    }
}

function bindChoiceMenu(trigger, { options, selected, choose, label }) {
    let menu;
    const stopToggle = bindMenuToggle(trigger, { isOpen: () => !!menu, close: () => menu?.hide() });
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-expanded", "false");
    if (label) disclosureIcons(trigger);
    function open() {
        if (menu) { menu.hide(); return; }
        const active = menu = ownMenuColors(new Menu());
        for (const [id, title] of options) {
            active.addItem(item => item.setTitle(title).setChecked(id === selected()).onClick(() => {
                choose(id);
                if (label) label.textContent = title;
            }));
        }
        active.onHide(() => {
            if (menu !== active) return;
            menu = null;
            trigger.setAttribute("aria-expanded", "false");
            const focused = trigger.ownerDocument.activeElement;
            if (trigger.isConnected && (focused === trigger.ownerDocument.body || active.dom?.contains(focused))) {
                trigger.focus({ preventScroll: true });
            }
        });
        trigger.setAttribute("aria-expanded", "true");
        const bounds = trigger.getBoundingClientRect();
        active.showAtPosition({ x: bounds.left, y: bounds.bottom });
    }
    trigger.addEventListener("click", open);
    return () => {
        trigger.removeEventListener("click", open);
        stopToggle();
        menu?.hide();
    };
}

module.exports = { createIconAction, createPanelAction, bindChoiceMenu, projectStatusLabels, sizeDashboardButton };
