"use strict";
const assert = require("assert");
const { workspaceImagePath, mountWorkspaceThumbnail } = require("../ui/workspace-thumbnail");
const { WIP_IMAGE_PATH } = require("../config");

const files = new Map(["custom.jpg", "category.jpg", "resource.jpg", WIP_IMAGE_PATH, "Projects/Test/Test.md"].map(path => [path, { path }]));
const plugin = {
    projectWizard: { getCategories: () => [{ id: "thesis", name: "Master's thesis", image: "category.jpg" }] },
    app: {
        vault: { getAbstractFileByPath: path => files.get(path), getResourcePath: file => "vault:" + file.path },
        metadataCache: { getFileCache: file => file?.path === "Projects/Test/Test.md" ? { frontmatter: { cover: "custom.jpg" } } : null }
    }
};
const project = { contextKind: "project", categoryId: "thesis" };
assert.equal(workspaceImagePath(plugin, { ...project, cover: "custom.jpg" }), "custom.jpg");
assert.equal(workspaceImagePath(plugin, { ...project, path: "Projects/Test/Test.md" }), "custom.jpg", "Project records obtain their user cover from canonical frontmatter");
assert.equal(workspaceImagePath(plugin, project), "category.jpg");
assert.equal(workspaceImagePath(plugin, { ...project, categoryId: "Master's thesis" }), "category.jpg");
assert.equal(workspaceImagePath(plugin, { contextKind: "project" }), WIP_IMAGE_PATH);
const resource = { contextKind: "resource", image: "resource.jpg", categoryId: "thesis" };
assert.equal(workspaceImagePath(plugin, resource), "resource.jpg", "Resources always use their own image");
const host = {
    createEl(tag, options) {
        const events = new Map();
        return { tag, ...options, set src(value) { this.attr.src = value; },
            addEventListener(type, listener) { events.set(type, listener); },
            removeEventListener(type) { events.delete(type); },
            fail() { events.get("error")?.(); }, replaceWith(element) { this.replacement = element; } };
    },
    createSpan(options) { return this.createEl("span", options); }
};
for (const workspace of [project, resource, { contextKind: "project" }]) {
    const thumbnail = mountWorkspaceThumbnail(host, plugin, workspace);
    assert.equal(thumbnail.tag, "img");
    assert.equal(thumbnail.cls, "hub-capture-workspace-thumbnail");
    assert.equal(thumbnail.attr.src, "vault:" + workspaceImagePath(plugin, workspace));
    assert.equal(thumbnail.attr.alt, "");
}
const snapshot = JSON.stringify(project);
for (const cover of ["missing.jpg", {}, 42]) {
    assert.equal(mountWorkspaceThumbnail(host, plugin, { ...project, cover }).attr.src, "vault:" + WIP_IMAGE_PATH);
}
const failed = mountWorkspaceThumbnail(host, plugin, { ...project, cover: "custom.jpg" });
failed.fail(); assert.equal(failed.attr.src, "vault:" + WIP_IMAGE_PATH, "Load failure uses the built-in Project placeholder");
// Exhausted imagery uses the shared icon boundary, without loading Obsidian in this unit fixture.
require.cache[require.resolve("../ui/icons")] = { exports: { setHubIcon(element, name) { element.icon = name; } } };
failed.fail(); assert.equal(failed.replacement.icon, "folder");
const replacement = failed.replacement; failed.fail(); assert.equal(failed.replacement, replacement, "Terminal error handler is removed");
const placeholder = mountWorkspaceThumbnail(host, plugin, { contextKind: "project" });
placeholder.fail(); assert.equal(placeholder.replacement.icon, "folder", "Identical fallback source is not retried");
const { RESOURCE_TYPES } = require("../config");
files.set(RESOURCE_TYPES[0].image, { path: RESOURCE_TYPES[0].image });
const resourceFailure = mountWorkspaceThumbnail(host, plugin, { contextKind: "resource", resourceType: RESOURCE_TYPES[0].id, image: "custom.jpg" });
resourceFailure.fail(); assert.equal(resourceFailure.attr.src, "vault:" + RESOURCE_TYPES[0].image);
resourceFailure.fail(); assert.equal(resourceFailure.replacement.icon, RESOURCE_TYPES[0].icon);
assert.equal(JSON.stringify(project), snapshot);
console.log("Workspace thumbnails passed: covers, frontmatter, category/Resource images, missing/invalid paths, bounded load failures, terminal icons and unchanged metadata.");
