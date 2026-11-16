"use strict";

const { Menu, Notice } = require("obsidian");
const { ownMenuColors, ownNoticeColors } = require("./color-system");

// Full-view menus deliberately omit Obsidian's file-menu contribution hook.
// Existing callbacks route structural actions through the Itacan coordinator.
function createExplorerHost(plugin, { FolderPicker, confirm }) {
    const app = plugin.app;
    const error = value => ownNoticeColors(new Notice(value?.message ?? String(value)));
    function populate(menu, entries, rootMenu = menu) {
        for (const entry of entries) {
            if (!entry) { menu.addSeparator(); continue; }
            menu.addItem(item => {
                item.setTitle(entry.title).setDisabled(!!entry.disabled);
                if (entry.icon) item.setIcon(entry.icon);
                if (entry.checked !== undefined) item.setChecked(entry.checked);
                if (entry.warning) item.setWarning(true);
                if (entry.items && typeof item.setSubmenu === "function") populate(item.setSubmenu(), entry.items, rootMenu);
                else if (entry.items) item.onClick(() => {
                    const bounds = rootMenu.dom?.getBoundingClientRect(); rootMenu.hide();
                    const submenu = ownMenuColors(new Menu()); populate(submenu, entry.items);
                    submenu.showAtPosition({ x: bounds?.left ?? 0, y: bounds?.top ?? 0 });
                });
                else item.onClick(() => { rootMenu.hide(); void Promise.resolve().then(entry.run).catch(error); });
            });
        }
    }
    function desktop() {
        try {
            const base = app.vault.adapter.getBasePath?.();
            const shell = require("electron").shell;
            return base && typeof shell?.showItemInFolder === "function" ? { base, shell } : null;
        } catch (_) { return null; }
    }
    return {
        showMenu(event, entries, { compactSort = false } = {}) {
            event.preventDefault?.(); event.stopPropagation?.();
            const menu = ownMenuColors(new Menu()); populate(menu, entries);
            if (compactSort) menu.dom?.classList.add("hub-explorer-sort-menu");
            let anchorObserver = null;
            const trigger = event.currentTarget?.closest?.("button") ?? event.target?.closest?.("button");
            if (trigger) {
                trigger.setAttribute("aria-expanded", "true");
                menu.onHide(() => {
                    trigger.setAttribute("aria-expanded", "false");
                    anchorObserver?.disconnect();
                });
            }
            const target = event.currentTarget?.getBoundingClientRect?.() ?? event.target?.getBoundingClientRect?.();
            if (event.type === "click" && target) {
                menu.showAtPosition({ x: target.left, y: target.bottom });
                if (compactSort && menu.dom) {
                    const anchor = trigger ?? event.currentTarget ?? event.target;
                    const centerMenu = () => {
                        if (menu.dom.isConnected === false) return;
                        const button = anchor.getBoundingClientRect();
                        const bounds = menu.dom.getBoundingClientRect();
                        const viewport = menu.dom.ownerDocument.defaultView.innerWidth;
                        const centered = button.left + button.width / 2 - bounds.width / 2;
                        const left = Math.max(0, Math.min(centered, viewport - bounds.width));
                        const scale = bounds.width / menu.dom.offsetWidth;
                        menu.dom.style.left = (parseFloat(menu.dom.style.left) + (left - bounds.left) / scale) + "px";
                    };
                    centerMenu();
                    const ResizeObserver = menu.dom.ownerDocument.defaultView.ResizeObserver;
                    if (ResizeObserver && trigger?.parentElement) {
                        anchorObserver = new ResizeObserver(centerMenu);
                        anchorObserver.observe(trigger.parentElement);
                    }
                    // Native positioning and zoom styles finish on the next frame.
                    menu.dom.ownerDocument.defaultView.requestAnimationFrame?.(centerMenu);
                }
            } else menu.showAtMouseEvent(event);
            return menu;
        },
        canReveal: () => !!desktop(),
        reveal(path, openFolder = false) {
            const host = desktop();
            if (!host || !app.vault.getAbstractFileByPath(path)) throw Error("System explorer is unavailable for this location.");
            const fullPath = require("path").join(host.base, path);
            if (openFolder && host.shell.openPath) return host.shell.openPath(fullPath).then(message => { if (message) throw Error(message); });
            host.shell.showItemInFolder(fullPath);
        },
        copyPaths: paths => navigator.clipboard.writeText(paths.join("\n")),
        addToPlan: (paths, context) => window.hubPlan?.files(paths, context),
        renameFile: path => plugin.renameProjectFile(app.vault.getAbstractFileByPath(path)),
        deleteFile: path => plugin.deleteProjectFile(app.vault.getAbstractFileByPath(path)),
        duplicateFile: path => plugin.duplicateProjectFile(app.vault.getAbstractFileByPath(path)),
        openWindow: path => app.workspace.getLeaf("window").openFile(app.vault.getAbstractFileByPath(path)),
        async renameFolder(name, run) {
            const api = app.plugins.plugins.quickadd?.api;
            if (!api) throw Error("QuickAdd is not enabled.");
            let value; try { value = await api.inputPrompt("Folder name", "", name); } catch (_) { return; }
            if (value) await run(value);
        },
        async deleteFolder(name, run) {
            if (await confirm(app, "Delete folder?", `Delete "${name}" and everything inside it?`)) await run();
        },
        moveTo(run) { new FolderPicker(app, async target => { try { await run(target); } catch (value) { error(value); } }).open(); }
    };
}

module.exports = { createExplorerHost };
