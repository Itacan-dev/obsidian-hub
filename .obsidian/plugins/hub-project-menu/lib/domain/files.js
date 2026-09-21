"use strict";

function isFolderLike(item) {
    return Array.isArray(item?.children);
}

function directFiles(folder) {
    return (folder?.children ?? []).filter(
        item => !isFolderLike(item)
    );
}

function directFolders(folder) {
    return (folder?.children ?? []).filter(isFolderLike);
}

function projectChildPath(parentPath, name) {
    const parent = String(parentPath ?? "").replace(
        /^\/+|\/+$/g,
        ""
    );

    return parent ? `${parent}/${name}` : name;
}

function projectItemPath(parentPath, kind, rawName) {
    let name = String(rawName ?? "").trim();

    if (kind === "note") {
        name = name.replace(/\.md$/i, "").trim();
    }

    if (!name || /[\\/:*?"<>|]/.test(name)) {
        throw new Error(`Enter a valid ${kind} name.`);
    }

    return (
        `${parentPath}/${name}` +
        (kind === "note" ? ".md" : "")
    );
}

function selectedRootPaths(paths) {
    const sorted = [...new Set(paths)].sort(
        (a, b) => a.length - b.length
    );

    return sorted.filter((path, index) =>
        !sorted
            .slice(0, index)
            .some(parent => path.startsWith(`${parent}/`))
    );
}

function createFileDomain({ getByPath }) {
    if (typeof getByPath !== "function") {
        throw new Error("A vault path lookup function is required.");
    }

    function availableExternalFilePath(folderPath, fileName) {
        const dotIndex = fileName.lastIndexOf(".");
        const hasExtension = dotIndex > 0;
        const stem = hasExtension
            ? fileName.slice(0, dotIndex)
            : fileName;
        const extension = hasExtension
            ? fileName.slice(dotIndex)
            : "";

        let path = projectChildPath(folderPath, fileName);
        let number = 2;

        while (getByPath(path)) {
            path = projectChildPath(
                folderPath,
                `${stem} ${number}${extension}`
            );
            number++;
        }

        return path;
    }

    return Object.freeze({
        availableExternalFilePath,
        directFiles,
        directFolders,
        isFolder: isFolderLike,
        projectChildPath,
        projectItemPath,
        selectedRootPaths
    });
}

module.exports = {
    createFileDomain,
    directFiles,
    directFolders,
    isFolderLike,
    projectChildPath,
    projectItemPath,
    selectedRootPaths
};
