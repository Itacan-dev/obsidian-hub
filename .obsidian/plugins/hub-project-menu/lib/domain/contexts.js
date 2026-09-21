"use strict";

function findProjectById(projects, projectId) {
    return (
        (Array.isArray(projects) ? projects : []).find(
            project => project?.projectId === projectId
        ) ?? null
    );
}

function findProjectForPath(projects, path) {
    const target = String(path ?? "");

    if (!target.startsWith("Projects/")) {
        return null;
    }

    let bestMatch = null;

    for (const project of Array.isArray(projects) ? projects : []) {
        if (!project?.root) {
            continue;
        }

        const belongs =
            target === project.root ||
            target === project.path ||
            target.startsWith(`${project.root}/`);

        if (
            belongs &&
            (
                !bestMatch ||
                project.root.length > bestMatch.root.length
            )
        ) {
            bestMatch = project;
        }
    }

    return bestMatch;
}

function findResourceByReference(resourceTypes, reference) {
    const value = String(reference ?? "");

    return (
        resourceTypes.find(resource =>
            resource.id === value ||
            `resource:${resource.id}` === value ||
            resource.hubPath === value ||
            resource.root === value ||
            resource.legacyRoots?.some(legacy =>
                legacy.root === value ||
                `${legacy.root}/${legacy.hubName}` === value
            )
        ) ?? null
    );
}

function findResourceForPath(resourceTypes, path) {
    const target = String(path ?? "");

    return (
        resourceTypes.find(resource =>
            target === resource.root ||
            target === resource.hubPath ||
            target.startsWith(`${resource.root}/`) ||
            resource.legacyRoots?.some(legacy =>
                target === legacy.root ||
                target === `${legacy.root}/${legacy.hubName}` ||
                target.startsWith(`${legacy.root}/`)
            )
        ) ?? null
    );
}

function replacePathRoot(path, oldRoot, newRoot) {
    if (typeof path !== "string") {
        return path;
    }

    if (path === oldRoot) {
        return newRoot;
    }

    if (!path.startsWith(`${oldRoot}/`)) {
        return path;
    }

    return `${newRoot}${path.slice(oldRoot.length)}`;
}

module.exports = {
    findProjectById,
    findProjectForPath,
    findResourceByReference,
    findResourceForPath,
    replacePathRoot
};
