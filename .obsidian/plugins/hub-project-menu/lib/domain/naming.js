"use strict";

function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function validVaultName(value) {
    return (
        value.trim().length > 0 &&
        !/[\\/:*?"<>|]/.test(value)
    );
}

function projectFileTitleFromPath(path) {
    const name = String(path ?? "").split("/").pop() ?? "";

    return /\.md$/i.test(name)
        ? name.replace(/\.md$/i, "")
        : name;
}

function isProvisionalNoteTitle(title) {
    return /^Untitled(?: \d+)?$/i.test(
        String(title ?? "").trim()
    );
}

module.exports = {
    isProvisionalNoteTitle,
    projectFileTitleFromPath,
    slugify,
    validVaultName
};
