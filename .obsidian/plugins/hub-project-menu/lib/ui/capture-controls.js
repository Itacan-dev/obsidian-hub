"use strict";
const { ownNoticeColors } = require("./color-system");

const { Notice } = require("obsidian");
const { setHubIcon } = require("./icons");
const { setHubTooltip } = require("./tooltips");
const { browserViewState } = require("../domain/navigation");
const { QuickAddModal } = require("./quick-add");
const { InboxModal } = require("./inbox");

function currentSource(plugin) {
    const leaf = plugin.app.workspace.activeLeaf;
    const filePath = leaf?.view?.file?.path;
    const context = filePath ? plugin.projectWizard.getContextForPath(filePath) : plugin.workspaceModes?.currentContext();
    const browser = browserViewState(leaf?.getViewState?.());
    return { origin: browser ? "Atlas" : "Quick Add",
        ...(context ? { workspaceId: context.projectId, workspaceName: context.name } : {}),
        ...(browser ?? {}),
        ...(!browser && leaf?.view?.file?.path ? { path: leaf.view.file.path } : {}) };
}

function mountCaptureControls(plugin, service, host) {
    let quick = null, inbox = null, disposed = false;
    const button = (label, icon, cls) => {
        const button = host.createEl("button", { cls: "hub-oath-button " + cls,
            attr: { type: "button", "aria-label": label, "aria-haspopup": "dialog" } });
        setHubIcon(button.createSpan({ cls: "hub-oath-icon", attr: { "aria-hidden": "true" } }), icon);
        button.createSpan({ text: label }); setHubTooltip(button, label, "top"); return button;
    };
    const quickButton = button("Quick Add", "zap", "hub-quick-add-button");
    const inboxButton = button("Inbox", "inbox", "hub-inbox-button");
    const badge = inboxButton.createSpan({ cls: "hub-inbox-badge", attr: { "aria-hidden": "true" } });
    const update = () => {
        badge.hidden = !service.count; badge.textContent = String(service.count);
        const blocked = !!plugin.oath?.active;
        inboxButton.disabled = blocked;
        setHubTooltip(inboxButton, blocked ? "Inbox is unavailable during an active Oath" : service.count ? `Inbox · ${service.count} unresolved Captures` : "Inbox", "top");
        if (blocked) inbox?.close();
    };
    const openQuickAdd = () => {
        if (disposed) return;
        if (quick) { quick.input?.focus(); return; }
        if (host.ownerDocument.querySelector(".modal-container")) return;
        quick = new QuickAddModal(plugin.app, service, { source: currentSource(plugin),
            returnFocus: host.ownerDocument.activeElement, onClose: () => { quick = null; } });
        quick.open();
    };
    const openLink = async url => {
        const browser = browserViewState({ type: "webviewer", state: { url } });
        if (!browser) throw Error("This link is unavailable.");
        if (plugin.app.internalPlugins?.getEnabledPluginById?.("webviewer")) {
            const leaf = plugin.app.workspace.getLeaf(true);
            await leaf.setViewState({ type: "webviewer", state: browser });
            plugin.app.workspace.setActiveLeaf?.(leaf, { focus: true });
        } else await plugin.app.workspace.openLinkText(browser.url, "", true);
    };
    const openInbox = () => {
        if (disposed) return;
        if (plugin.oath?.active) { ownNoticeColors(new Notice("Inbox is unavailable during an active Oath.")); return; }
        if (inbox) { inbox.filterButtons[0].button.focus(); return; }
        if (host.ownerDocument.querySelector(".modal-container")) return;
        inbox = new InboxModal(plugin.app, service, { openLink, workspaceId: plugin.workspaceModes?.currentContext()?.projectId,
            returnFocus: host.ownerDocument.activeElement, onClose: () => { inbox = null; } });
        inbox.open();
    };
    plugin.registerDomEvent(quickButton, "click", openQuickAdd);
    plugin.registerDomEvent(inboxButton, "click", openInbox);
    const stop = service.onChange(update), stopOath = plugin.oath?.onChange(update); update();
    return { quickButton, inboxButton, openQuickAdd, openInbox,
        destroy() { disposed = true; stop(); stopOath?.(); quick?.close(); inbox?.close(); quickButton.remove(); inboxButton.remove(); } };
}
module.exports = { mountCaptureControls, currentSource };
