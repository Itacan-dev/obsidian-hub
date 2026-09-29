"use strict";

const { isStatisticsNote, prepareStatistics } = require("../domain/statistics");

// Snapshot once per opening. Range and local filter changes only query in-memory
// aggregates; no Dataview parsing, file reads, or persistence is needed.
function readStatistics(plugin, now = Date.now()) {
    const wizard = plugin.projectWizard;
    const workspaces = [...wizard.getProjectRecords(), ...wizard.getResourceTypes()];
    const dashboardPaths = new Set(workspaces.map(workspace => workspace.path));
    const notes = plugin.app.vault.getMarkdownFiles().filter(file => isStatisticsNote(file.path, {
        dashboardPaths, frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter
    })).map(file => ({ path: file.path, createdAt: file.stat?.ctime }));
    const oaths = Object.values(wizard.data.oathsByDevice ?? {}).flatMap(bucket => Array.isArray(bucket?.history) ? bucket.history : []);
    return prepareStatistics({ workspaces, notes, oaths, activity: wizard.activityLog,
        completions: wizard.completedTaskHistory }, now);
}

module.exports = { readStatistics };
