"use strict";

const PROJECT_STATUSES = [
    "active",
    "future",
    "shelved"
];

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? {}));
}

function isRecord(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function uniqueStrings(values) {
    return [
        ...new Set(
            (Array.isArray(values) ? values : [])
                .map(String)
                .filter(Boolean)
        )
    ];
}

function issue(code, message, count, repairable = true) {
    return {
        code,
        message,
        count,
        repairable
    };
}

function auditHubData(
    data,
    {
        projects = [],
        resourceTypes = [],
        existingResourceFolderPaths = null,
        makeId = () => `repaired-${Date.now()}`,
        now = new Date().toISOString()
    } = {}
) {
    const repairedData = cloneJson(data);
    const issues = [];
    let changed = false;

    const projectIds = new Set(
        projects
            .map(project => project?.projectId)
            .filter(Boolean)
    );
    const projectStatus = new Map(
        projects
            .filter(project => project?.projectId)
            .map(project => [
                project.projectId,
                project.status
            ])
    );
    const resourceIds = new Set(
        resourceTypes
            .map(resource => resource?.id)
            .filter(Boolean)
    );

    const sourceFolders = isRecord(repairedData.resourceFolders)
        ? repairedData.resourceFolders
        : {};
    const repairedFolders = {};
    const seenFolderPaths = new Set();
    let invalidFolderRecords = 0;
    let mismatchedFolderIds = 0;
    let duplicateFolderPaths = 0;

    for (const [key, sourceRecord] of Object.entries(sourceFolders)) {
        if (!isRecord(sourceRecord)) {
            invalidFolderRecords++;
            changed = true;
            continue;
        }

        const record = { ...sourceRecord };
        const path = typeof record.path === "string"
            ? record.path
            : "";

        if (
            !path ||
            !resourceIds.has(record.resourceType) ||
            (
                existingResourceFolderPaths instanceof Set &&
                !existingResourceFolderPaths.has(path)
            )
        ) {
            invalidFolderRecords++;
            changed = true;
            continue;
        }

        if (seenFolderPaths.has(path)) {
            duplicateFolderPaths++;
            changed = true;
            continue;
        }

        seenFolderPaths.add(path);

        if (record.id !== key) {
            mismatchedFolderIds++;
            record.id = key;
            changed = true;
        }

        repairedFolders[key] = record;
    }

    if (invalidFolderRecords) {
        issues.push(issue(
            "invalid-resource-folder-records",
            `${invalidFolderRecords} invalid or missing Resource folder record${invalidFolderRecords === 1 ? "" : "s"}`,
            invalidFolderRecords
        ));
    }

    if (mismatchedFolderIds) {
        issues.push(issue(
            "mismatched-resource-folder-ids",
            `${mismatchedFolderIds} Resource folder ID did not match its registry key`,
            mismatchedFolderIds
        ));
    }

    if (duplicateFolderPaths) {
        issues.push(issue(
            "duplicate-resource-folder-paths",
            `${duplicateFolderPaths} duplicated Resource folder path${duplicateFolderPaths === 1 ? "" : "s"}`,
            duplicateFolderPaths
        ));
    }

    repairedData.resourceFolders = repairedFolders;
    const validFolderIds = new Set(Object.keys(repairedFolders));

    const categories = Array.isArray(repairedData.categories)
        ? repairedData.categories
        : [];
    const seenCategoryIds = new Set();
    let duplicateCategoryIds = 0;
    let invalidCategoryFolderReferences = 0;

    repairedData.categories = categories.map(sourceCategory => {
        const category = isRecord(sourceCategory)
            ? { ...sourceCategory }
            : {};

        let categoryId = String(category.id ?? "").trim();

        if (!categoryId || seenCategoryIds.has(categoryId)) {
            duplicateCategoryIds++;

            do {
                categoryId = String(makeId("category"));
            } while (seenCategoryIds.has(categoryId));

            category.id = categoryId;
            changed = true;
        }

        seenCategoryIds.add(categoryId);

        const originalReferences = uniqueStrings(
            category.resourceFolders
        );
        const validReferences = originalReferences.filter(
            id => validFolderIds.has(id)
        );

        invalidCategoryFolderReferences +=
            originalReferences.length - validReferences.length;

        if (validReferences.length !== originalReferences.length) {
            category.resourceFolders = validReferences;
            changed = true;
        }

        return category;
    });

    if (duplicateCategoryIds) {
        issues.push(issue(
            "duplicate-category-ids",
            `${duplicateCategoryIds} missing or duplicated category ID${duplicateCategoryIds === 1 ? "" : "s"}`,
            duplicateCategoryIds
        ));
    }

    if (invalidCategoryFolderReferences) {
        issues.push(issue(
            "invalid-category-resource-references",
            `${invalidCategoryFolderReferences} invalid Resource folder reference${invalidCategoryFolderReferences === 1 ? "" : "s"} in project templates`,
            invalidCategoryFolderReferences
        ));
    }

    const sourceOrder = isRecord(repairedData.projectCardOrder)
        ? repairedData.projectCardOrder
        : {};
    const repairedOrder = {};
    let staleOrderEntries = 0;

    for (const status of PROJECT_STATUSES) {
        const original = uniqueStrings(sourceOrder[status]);
        const valid = original.filter(projectId =>
            projectIds.has(projectId) &&
            projectStatus.get(projectId) === status
        );

        staleOrderEntries += original.length - valid.length;
        repairedOrder[status] = valid;
    }

    if (staleOrderEntries) {
        issues.push(issue(
            "stale-project-card-order",
            `${staleOrderEntries} orphaned or outdated project-card order entr${staleOrderEntries === 1 ? "y" : "ies"}`,
            staleOrderEntries
        ));
        changed = true;
    }

    repairedData.projectCardOrder = repairedOrder;

    const archive = isRecord(repairedData.hubAuditArchive)
        ? { ...repairedData.hubAuditArchive }
        : {};

    function archiveOrphanedProgress(
        ratingsKey,
        logsKey,
        validIds,
        archiveKey,
        code,
        label
    ) {
        const ratings = isRecord(repairedData[ratingsKey])
            ? { ...repairedData[ratingsKey] }
            : {};
        const logs = isRecord(repairedData[logsKey])
            ? { ...repairedData[logsKey] }
            : {};
        const orphanedIds = [
            ...new Set([
                ...Object.keys(ratings),
                ...Object.keys(logs)
            ])
        ].filter(id => !validIds.has(id));

        if (!orphanedIds.length) {
            return;
        }

        const archived = isRecord(archive[archiveKey])
            ? { ...archive[archiveKey] }
            : {};

        for (const id of orphanedIds) {
            archived[id] = {
                ratings: cloneJson(ratings[id] ?? {}),
                logs: cloneJson(logs[id] ?? {}),
                archivedAt: now
            };

            delete ratings[id];
            delete logs[id];
        }

        archive[archiveKey] = archived;
        repairedData[ratingsKey] = ratings;
        repairedData[logsKey] = logs;
        changed = true;
        issues.push(issue(
            code,
            `${orphanedIds.length} deleted or unknown ${label} progress record${orphanedIds.length === 1 ? "" : "s"} (preserved in the audit archive)`,
            orphanedIds.length
        ));
    }

    archiveOrphanedProgress(
        "projectWorkRatings",
        "projectWorkLogs",
        projectIds,
        "orphanedProjectProgress",
        "orphaned-project-progress",
        "project"
    );
    archiveOrphanedProgress(
        "resourceWorkRatings",
        "resourceWorkLogs",
        resourceIds,
        "orphanedResourceProgress",
        "orphaned-resource-progress",
        "Resource"
    );

    if (Object.keys(archive).length) {
        repairedData.hubAuditArchive = archive;
    }

    const dirtyContexts = isRecord(repairedData.dirtyContexts)
        ? repairedData.dirtyContexts
        : {};
    const repairedDirtyContexts = {};
    let staleDirtyContexts = 0;

    for (const [date, value] of Object.entries(dirtyContexts)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRecord(value)) {
            staleDirtyContexts++;
            changed = true;
            continue;
        }

        const originalProjects = uniqueStrings(value.projects);
        const originalResources = uniqueStrings(value.resources)
            .map(id => id.replace(/^resource:/, ""));
        const validProjects = originalProjects.filter(id =>
            projectIds.has(id)
        );
        const validResources = originalResources.filter(id =>
            resourceIds.has(id)
        );

        staleDirtyContexts +=
            originalProjects.length - validProjects.length +
            originalResources.length - validResources.length;

        const resolvedAt =
            Number(value.resolvedAt) || 0;

        if (
            validProjects.length ||
            validResources.length ||
            resolvedAt > 0
        ) {
            repairedDirtyContexts[date] = {
                projects: validProjects,
                resources: validResources,
                resolvedAt,
                updatedAt: value.updatedAt ?? null
            };
        }
    }

    if (staleDirtyContexts) {
        issues.push(issue(
            "stale-dirty-contexts",
            `${staleDirtyContexts} stale saved work-context reference${staleDirtyContexts === 1 ? "" : "s"}`,
            staleDirtyContexts
        ));
        changed = true;
    }

    repairedData.dirtyContexts = repairedDirtyContexts;

    return {
        changed,
        issues,
        repairedData
    };
}

function auditWorkspaceState(
    state,
    {
        validProjectIds = new Set(),
        validResourceIds = new Set(),
        pathExists = () => true
    } = {}
) {
    const repairedState = cloneJson(state);
    const issues = [];
    let staleReferences = 0;

    const validContextIds = new Set([
        ...validProjectIds,
        ...[...validResourceIds].map(id => `resource:${id}`)
    ]);

    if (
        repairedState.currentMode != null &&
        !["home", "project", "resource", "note"].includes(
            repairedState.currentMode
        )
    ) {
        repairedState.currentMode = null;
        staleReferences++;
    }

    if (
        repairedState.lastProjectId &&
        !validProjectIds.has(repairedState.lastProjectId)
    ) {
        repairedState.lastProjectId = null;
        staleReferences++;
    }

    if (
        repairedState.lastResourceId &&
        !validResourceIds.has(repairedState.lastResourceId)
    ) {
        repairedState.lastResourceId = null;
        staleReferences++;
    }

    const projects = isRecord(repairedState.projects)
        ? repairedState.projects
        : {};
    const repairedProjects = {};

    for (const [contextId, sourceValue] of Object.entries(projects)) {
        if (!validContextIds.has(contextId)) {
            staleReferences++;
            continue;
        }

        const value = isRecord(sourceValue)
            ? { ...sourceValue }
            : {};

        if (value.lastNotePath && !pathExists(value.lastNotePath)) {
            delete value.lastNotePath;
            staleReferences++;
        }

        repairedProjects[contextId] = value;
    }

    repairedState.projects = repairedProjects;

    const lastFile = repairedState.lastFile;
    const lastFileContextId = lastFile?.contextKind === "resource"
        ? `resource:${lastFile.contextId}`
        : lastFile?.contextId;

    if (
        lastFile &&
        (
            !lastFile.path ||
            !pathExists(lastFile.path) ||
            !validContextIds.has(lastFileContextId)
        )
    ) {
        repairedState.lastFile = null;
        staleReferences++;
    }

    if (staleReferences) {
        issues.push(issue(
            "stale-workspace-state",
            `${staleReferences} stale workspace-navigation reference${staleReferences === 1 ? "" : "s"}`,
            staleReferences
        ));
    }

    return {
        changed: staleReferences > 0,
        issues,
        repairedState
    };
}

module.exports = {
    PROJECT_STATUSES,
    auditHubData,
    auditWorkspaceState,
    cloneJson,
    uniqueStrings
};
