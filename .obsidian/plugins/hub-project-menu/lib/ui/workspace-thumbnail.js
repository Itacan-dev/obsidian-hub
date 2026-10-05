"use strict";
const { WIP_IMAGE_PATH } = require("../config");

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
    const path = workspaceImagePath(plugin, workspace);
    const file = path && plugin.app.vault.getAbstractFileByPath(path);
    return host.createEl("img", { cls: "hub-capture-workspace-thumbnail", attr: {
        src: file ? plugin.app.vault.getResourcePath(file) : path,
        alt: "", "aria-hidden": "true"
    } });
}
module.exports = { workspaceImagePath, mountWorkspaceThumbnail };
