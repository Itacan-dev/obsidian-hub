"use strict";
const { locationLabel, validLocation } = require("../domain/task-views");

function taskWorkspaces(plugin) {
    return [...(plugin.projectWizard.getProjectRecords?.() ?? []), ...(plugin.projectWizard.getResourceTypes?.() ?? [])];
}
function taskLocations(plugin, root) {
    const workspaces = taskWorkspaces(plugin).filter(workspace => root ? workspace.root === root : workspace.contextKind === "resource" || workspace.status === "active");
    const entries = plugin.app.vault.getAllLoadedFiles?.() ?? plugin.app.vault.getMarkdownFiles();
    return workspaces.flatMap(workspace => entries.filter(file => (Array.isArray(file.children) || file.extension === "md") && validLocation(file.path, workspace))
        .map(file => ({ path: file.path, file, workspace, folder: Array.isArray(file.children),
            label: locationLabel(file.path, workspace, !root) })))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}
module.exports = { taskWorkspaces, taskLocations };
