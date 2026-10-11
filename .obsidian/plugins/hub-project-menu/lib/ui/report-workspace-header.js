"use strict";
const { mountWorkspaceThumbnail } = require("./workspace-thumbnail");

function renderReportWorkspaceHeader(parent, record, plugin) {
    const id = record.projectId || "";
    const resource = record.contextKind === "resource" || !!record.resourceType || id.startsWith("resource:");
    const wizard = plugin?.projectWizard;
    const workspace = (resource
        ? wizard?.getResourceById?.(record.resourceType || id.slice(9))
        : wizard?.getProjectById?.(id)) || record;
    const category = wizard?.getCategories?.().find(item =>
        item.id === workspace.categoryId || item.name === workspace.categoryId);
    const heading = parent.createDiv({ cls: "hub-report-heading" });
    if (plugin) mountWorkspaceThumbnail(heading, plugin, {
        ...workspace, contextKind: resource ? "resource" : "project"
    });
    const copy = heading.createDiv({ cls: "hub-report-workspace-copy" });
    copy.createEl("h3", { cls: "hub-project-advancement-name", text: record.projectName || record.name });
    copy.createDiv({ cls: "hub-report-workspace-subtitle", text: resource ? "Resource" : category?.name || workspace.categoryId || "Project" });
    return heading;
}

module.exports = { renderReportWorkspaceHeader };
