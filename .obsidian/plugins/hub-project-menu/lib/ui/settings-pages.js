"use strict";

// Page definitions and renderers are presentation only. A future settings store
// can be wired to individual controls without replacing the window/navigation.
const SETTINGS_PAGES = [
    ["general", "General", "Core application preferences."],
    ["appearance", "Appearance", "Customize the visual presentation of Itacan."],
    ["homepage", "Homepage", "Your starting point in Itacan."],
    ["workspaces", "Workspaces", "Workspace presentation and organization."],
    ["notes", "Notes & Editor", "Your note-writing environment."],
    ["tasks", "Tasks", "Task presentation and planning preferences."],
    ["atlas", "Atlas", "Your browsing workspace."],
    ["oath", "The Oath", "Preferences for focused work."],
    ["daily-brief", "Daily brief", "Your daily orientation."],
    ["history", "History", "Your work history and reports."],
    ["integrations", "Integrations", "Connections to other tools."],
    ["files", "Files & Data", "Files and application data."],
    ["shortcuts", "Shortcuts", "Keyboard shortcuts and quick actions."],
    ["advanced", "Advanced", "Additional application preferences."],
    ["about", "About", "About Itacan."]
].filter(([id]) => id !== "daily-brief" ||
    typeof process !== "undefined" && process.env?.ITACAN_DEVELOPMENT === "1")
    .map(([id, title, description]) => ({ id, title, description }));

function row(parent, label, description) {
    const el = parent.createDiv({ cls: "hub-settings-row" });
    const text = el.createDiv({ cls: "hub-settings-row-copy" });
    text.createDiv({ cls: "hub-settings-label", text: label });
    if (description) text.createDiv({ cls: "hub-settings-description", text: description });
    return el.createDiv({ cls: "hub-settings-row-control", attr: { "aria-label": label } });
}
function select(parent, label, value) {
    const control = parent.createEl("select", { cls: "dropdown", attr: { "aria-label": label, disabled: "" } });
    control.createEl("option", { text: value });
}
function segments(parent, label, values, selected) {
    const group = parent.createDiv({ cls: "hub-settings-segments", attr: { role: "group", "aria-label": label } });
    for (const value of values) group.createEl("button", {
        text: value, cls: value === selected ? "is-selected" : "",
        attr: { type: "button", disabled: "", "aria-pressed": String(value === selected) }
    });
}
function section(parent, title) {
    const el = parent.createEl("section", { cls: "hub-settings-section" });
    el.createEl("h3", { text: title });
    return el;
}
function renderAppearance(parent) {
    parent.createEl("p", { cls: "hub-settings-preview-note", text: "Preview only. Controls are not active yet." });
    let group = section(parent, "Theme");
    select(row(group, "Theme pack", "A coordinated visual style, with individual options below."), "Theme pack", "Default");
    group = section(parent, "Color");
    const colors = row(group, "Accent color");
    const swatches = colors.createDiv({ cls: "hub-settings-swatches", attr: { role: "group", "aria-label": "Accent color preview" } });
    for (const [name, color] of [["Purple", "#8B5CF6"], ["Blue", "#528DD7"], ["Green", "#549D7A"], ["Amber", "#BB914A"], ["Gray", "#90949C"]]) {
        const swatch = swatches.createEl("button", { cls: "hub-settings-swatch" + (name === "Purple" ? " is-selected" : ""),
            attr: { type: "button", disabled: "", "aria-label": name, "aria-pressed": String(name === "Purple") } });
        swatch.style.backgroundColor = color;
    }
    swatches.createEl("button", { cls: "hub-settings-custom-color", text: "+", attr: { type: "button", disabled: "", "aria-label": "Custom color" } });
    const defaults = row(group, "Interface colors", "Use theme pack defaults");
    defaults.createDiv({ cls: "checkbox-container is-enabled hub-settings-toggle", attr: { role: "switch", "aria-label": "Use theme pack defaults", "aria-checked": "true", "aria-disabled": "true" } });
    group = section(parent, "Theme mode");
    segments(row(group, "Theme mode"), "Theme mode", ["System", "Light", "Dark"], "Dark");
    group = section(parent, "Typography");
    select(row(group, "Interface font"), "Interface font", "Default (system)");
    select(row(group, "Editor font"), "Editor font", "Default (monospace)");
    segments(row(group, "Interface text size"), "Interface text size", ["Small", "Default", "Large"], "Default");
    group = section(parent, "Interface");
    segments(row(group, "Interface density"), "Interface density", ["Comfortable", "Default", "Compact"], "Default");
    select(row(group, "Corner style"), "Corner style", "Default");
    segments(row(group, "Animations"), "Animations", ["Full", "Reduced"], "Full");
}
function renderSettingsPage(parent, page, plugin) {
    parent.createEl("h2", { text: page.title });
    parent.createEl("p", { cls: "hub-settings-description", text: page.description });
    if (page.id === "appearance") return renderAppearance(parent);
    if (page.id === "atlas" && plugin?.atlas) return require("../atlas/obsidian/ui").mountAtlasOverview(parent, plugin.atlas);
    parent.createEl("p", { cls: "hub-settings-preview-note", text: "No options available in this preview." });
    for (let i = 0; i < 2; i++) parent.createDiv({ cls: "hub-settings-empty-section", attr: { "aria-hidden": "true" } });
}
module.exports = { SETTINGS_PAGES, renderSettingsPage };
