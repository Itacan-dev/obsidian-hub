"use strict";
const { WIP_IMAGE_PATH, RESOURCE_TYPES } = require("../config");

// Use the same source as the workspace cover, without its large-card mask or
// editable placement. Capture selectors deliberately use a simple square crop.
function workspaceImagePath(plugin, workspace) {
    if (workspace.contextKind === "resource") return workspace.image;
    const category = plugin.projectWizard.getCategories?.().find(item =>
        item.id === workspace.categoryId || item.name === workspace.categoryId);
    const frontmatter = workspace.path && plugin.app.metadataCache?.getFileCache?.(
        plugin.app.vault.getAbstractFileByPath(workspace.path))?.frontmatter;
    return workspace.cover || frontmatter?.cover || category?.image || WIP_IMAGE_PATH;
}
function mountWorkspaceThumbnail(host, plugin, workspace) {
    const resource = workspace.contextKind === "resource";
    const type = RESOURCE_TYPES.find(item => item.id === String(workspace.resourceType ?? workspace.id ?? workspace.projectId ?? "").replace(/^resource:/, ""));
    const paths = [...new Set([workspaceImagePath(plugin, workspace), resource ? type?.image : WIP_IMAGE_PATH])];
    const image = host.createEl("img", { cls: "hub-capture-workspace-thumbnail", attr: { alt: "", "aria-hidden": "true" } });
    let index = 0, fallback = null;
    const loadNext = () => {
        while (index < paths.length) {
            const path = paths[index++];
            if (typeof path !== "string" || !path.trim()) continue;
            try {
                const file = plugin.app.vault.getAbstractFileByPath(path);
                if (file?.children) continue;
                const url = file ? plugin.app.vault.getResourcePath(file) : /^(?:https?:\/\/|data:image\/|blob:)/i.test(path) ? path : null;
                if (typeof url !== "string" || !url) continue;
                image.src = url; return;
            } catch (_) { /* Invalid paths fall through to the established imagery. */ }
        }
        image.removeEventListener("error", loadNext);
        fallback = host.createSpan({ cls: "hub-capture-workspace-thumbnail hub-capture-icon", attr: { "aria-hidden": "true" } });
        require("./icons").setHubIcon(fallback, resource ? workspace.icon ?? type?.icon ?? "library" : "folder");
        image.replaceWith(fallback);
    };
    image.addEventListener("error", loadNext);
    loadNext();
    return fallback ?? image;
}
module.exports = { workspaceImagePath, mountWorkspaceThumbnail };
