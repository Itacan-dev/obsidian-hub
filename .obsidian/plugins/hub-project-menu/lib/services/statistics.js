"use strict";

const { findProjectForPath, findResourceForPath } = require("../domain/contexts");
const { isStatisticsNote, prepareStatistics } = require("../domain/statistics");
const { TaskServiceError } = require("./task-service-errors");
const snapshotRecords = records => Array.isArray(records) ? records.map(record =>
    record && typeof record === "object" ? { ...record } : record) : records;

// Recorded event identity/kind/time/owner evidence, never canonical task fields
// or the History dashboard's private focus keys. No sorting or deduplication.
function statisticsCompletions(query) {
    if (query?.consistency !== "legacy-recorded" || !Array.isArray(query.rows))
        throw new TaskServiceError("HISTORY_UNAVAILABLE", "Statistics completion History is unavailable.");
    const relevant = new Set(["id", "kind", "projectId", "projectName", "project", "targetKind", "contextKind", "resourceType", "path"]);
    return query.rows.map(row => {
        if (row.unavailableFields?.some(field => relevant.has(field)))
            throw new TaskServiceError("HISTORY_UNAVAILABLE", "Statistics cannot interpret some recorded completion evidence safely.");
        const recorded = row.fact?.recorded ?? row.recorded;
        if (!recorded) throw new TaskServiceError("HISTORY_UNAVAILABLE", "Statistics completion evidence is incomplete.");
        return { ...recorded };
    });
}

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
    const completions = completionFeed ? (await completionFeed.read()).completions : statisticsCompletions(await plugin.taskService.queryHistory({ projection: "recorded" }));
    return prepareStatistics({ workspaces, notes, oaths, activity, completions, reports }, now);
}

module.exports = { readStatistics, statisticsCompletions };
