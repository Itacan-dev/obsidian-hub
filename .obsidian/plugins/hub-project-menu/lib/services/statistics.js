"use strict";

const { findProjectForPath, findResourceForPath } = require("../domain/contexts");
const { isStatisticsNote, prepareStatistics } = require("../domain/statistics");
const snapshotRecords = records => Array.isArray(records) ? records.map(record => record && typeof record === "object" ? { ...record } : record) : records;

// Snapshot once per opening. Range and workspace filter changes only query in-memory
// aggregates; no Dataview parsing, file reads, or persistence is needed.
async function readStatistics(plugin, now = Date.now(), completionFeed = null) {
    const wizard = plugin.projectWizard;
    const projects = wizard.getProjectRecords(), resources = wizard.getResourceTypes();
    const workspaces = snapshotRecords([...projects, ...resources]);
    const dashboardPaths = new Set(workspaces.map(workspace => workspace.path));
    const notes = plugin.app.vault.getMarkdownFiles().filter(file => isStatisticsNote(file.path, {
        dashboardPaths, frontmatter: plugin.app.metadataCache.getFileCache(file)?.frontmatter
    })).map(file => {
        const owner = findProjectForPath(projects, file.path) ?? findResourceForPath(resources, file.path);
        return { path: file.path, createdAt: file.stat?.ctime, projectId: owner?.projectId, contextKind: owner?.contextKind };
    });
    const oaths = snapshotRecords(Object.values(wizard.data.oathsByDevice ?? {}).flatMap(bucket => Array.isArray(bucket?.history) ? bucket.history : []))
        .map(record => record?.workspace && typeof record.workspace === "object" ? { ...record, workspace: { ...record.workspace } } : record);
    // Bind the existing independent providers to this opening before awaiting
    // History; an unrelated edit while loading must not alter the snapshot.
    const activity = snapshotRecords(wizard.activityLog);
    const reports = snapshotRecords([...wizard.getProgressReports(), ...wizard.getProgressReports({ kind: "resource" })]);
    const completions = (await (completionFeed ?? plugin.nativeTaskHost.completionFeed).read()).completions;
    return prepareStatistics({ workspaces, notes, oaths, activity, completions, reports }, now);
}

module.exports = { readStatistics };
