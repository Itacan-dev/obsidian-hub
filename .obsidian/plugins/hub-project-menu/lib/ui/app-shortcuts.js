"use strict";
const { setIcon, Notice } = require("obsidian");
const { APP_SHORTCUTS } = require("../config");

function mountAppShortcuts(plugin, left) {
    const bar = left.parentElement;
    const group = bar.createDiv({ cls: "hub-shell-shortcuts hub-button-scope", attr: { role: "group", "aria-label": "App shortcuts" } });
    left.after(group);
    let signature = "", disposed = false;
    const render = () => {
        if (disposed) return;
        const leaf = plugin.app.workspace.activeLeaf;
        const container = leaf?.view?.containerEl;
        const dashboard = container?.matches?.(".project-dashboard") ? container : container?.querySelector(".project-dashboard");
        const file = leaf?.view?.file ?? plugin.app.workspace.getActiveFile();
        const owner = dashboard?.dataset.hubContextId ? plugin.projectWizard.getProjectById(dashboard.dataset.hubContextId) ??
            plugin.projectWizard.getResourceById(dashboard.dataset.hubContextId) : file ? plugin.projectWizard.getContextForPath(file.path) : null;
        const category = owner?.contextKind === "project" ? plugin.projectWizard.categories.find(item => item.id === owner.categoryId || item.name === owner.categoryId) : null;
        // Home retains its global shortcuts; workspaces retain category configuration.
        const selected = owner ? (category?.shortcuts ?? []) : APP_SHORTCUTS.map(item => item.id);
        const strict = plugin.oath?.active && plugin.oath?.isStrict;
        const shortcuts = strict ? [
            { id: "strict-host", label: "Return to Itacan", focus: true },
            ...plugin.oath.current.policy.applications.map(executable => ({ id: executable, executable, label: "Open " + executable.split("\\").pop() }))
        ] : selected.map(id => APP_SHORTCUTS.find(item => item.id === id)).filter(Boolean);
        const next = (strict ? "strict:" : "ordinary:") + shortcuts.map(item => item.id).join("|");
        if (next === signature && group.childElementCount === shortcuts.length) return;
        signature = next; group.empty(); group.hidden = !shortcuts.length;
        for (const shortcut of shortcuts) {
            const button = group.createEl("button", { cls: "hub-shell-shortcut", attr: { type: "button", title: shortcut.label, "aria-label": shortcut.label } });
            const icon = button.createSpan({ cls: "hub-shell-shortcut-icon" });
            const file = shortcut.icon && plugin.app.vault.getAbstractFileByPath(shortcut.icon);
            if (file) icon.createEl("img", { attr: { src: plugin.app.vault.getResourcePath(file), alt: "" } });
            else setIcon(icon, shortcut.iconName ?? (shortcut.type === "website" ? "globe" : "app-window"));
            button.createSpan({ cls: "hub-shell-shortcut-label", text: shortcut.label });
            button.addEventListener("click", async event => {
                if (button.disabled || event.detail > 1) return;
                button.disabled = true;
                try {
                    if (shortcut.focus) plugin.oath.strict.host.focus();
                    else if (shortcut.executable) await plugin.oath.launchStrictApplication(shortcut.executable);
                    else await plugin.openAppShortcut(shortcut.id);
                }
                catch (error) { new Notice(error.message || "Could not open app shortcut."); }
                finally { button.disabled = false; }
            });
        }
        measure();
    };
    // Keep native status items in their original flex order. Only show centered
    // shortcuts in the actual free span, never on top of shell controls/status.
    const measure = () => {
        if (disposed || group.hidden) return;
        const bounds = bar.getBoundingClientRect(), leftEdge = left.getBoundingClientRect().right - bounds.left;
        let rightEdge = bounds.width;
        for (const item of bar.children) {
            if (item === left || item === group || item.getBoundingClientRect().width === 0) continue;
            rightEdge = Math.min(rightEdge, item.getBoundingClientRect().left - bounds.left);
        }
        const center = bounds.width / 2;
        const centered = Math.max(0, Math.min(center - leftEdge - 12, rightEdge - center - 12) * 2);
        group.classList.remove("is-compact");
        group.classList.toggle("is-compact", centered < group.scrollWidth);
        group.style.maxWidth = centered + "px";
        group.style.visibility = centered < 26 ? "hidden" : "";
    };
    const resize = new ResizeObserver(measure); resize.observe(bar);
    for (const item of bar.children) if (item !== group) resize.observe(item);
    const mutation = new MutationObserver(() => { for (const item of bar.children) if (item !== group) resize.observe(item); measure(); });
    mutation.observe(bar, { childList: true });
    plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", render));
    plugin.registerEvent(plugin.app.workspace.on("file-open", render));
    plugin.registerEvent(plugin.app.metadataCache.on("changed", render));
    plugin.registerEvent(plugin.app.workspace.on("layout-change", render));
    group.hidden = true; render();
    const stopOath = plugin.oath?.onChange(render);
    return { refresh: render, destroy() { disposed = true; stopOath?.(); resize.disconnect(); mutation.disconnect(); group.remove(); } };
}
module.exports = { mountAppShortcuts };
