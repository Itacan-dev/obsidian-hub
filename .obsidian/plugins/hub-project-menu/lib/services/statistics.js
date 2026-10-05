"use strict";

const { findProjectForPath, findResourceForPath } = require("../domain/contexts");
const { isStatisticsNote, prepareStatistics } = require("../domain/statistics");

// Snapshot once per opening. Range and workspace filter changes only query in-memory
// aggregates; no Dataview parsing, file reads, or persistence is needed.
function readStatistics(plugin, now = Date.now()) {
    const wizard = plugin.projectWizard;
    const projects = wizard.getProjectRecords(), resources = wizard.getResourceTypes();
    const workspaces = [...projects, ...resources];
    const dashboardPaths = new Set(workspaces.map(workspace => workspace.path));
    const notes = plugin.app.vault.getMarkdownFiles().filter(file => isStatisticsNote(file.path, {
        dashboardPaths, frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter
    })).map(file => {
        const owner = findProjectForPath(projects, file.path) ?? findResourceForPath(resources, file.path);
        return { path: file.path, createdAt: file.stat?.ctime, projectId: owner?.projectId, contextKind: owner?.contextKind };
    });
    const oaths = Object.values(wizard.data.oathsByDevice ?? {}).flatMap(bucket => Array.isArray(bucket?.history) ? bucket.history : []);
    return prepareStatistics({ workspaces, notes, oaths, activity: wizard.activityLog,
        completions: wizard.completedTaskHistory,
        reports: [...wizard.getProgressReports(), ...wizard.getProgressReports({ kind: "resource" })] }, now);
}

module.exports = { readStatistics };
