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
const host = { createEl: (tag, options) => ({ tag, ...options }) };
for (const workspace of [project, resource, { contextKind: "project" }]) {
    const thumbnail = mountWorkspaceThumbnail(host, plugin, workspace);
    assert.equal(thumbnail.tag, "img");
    assert.equal(thumbnail.cls, "hub-capture-workspace-thumbnail");
    assert.equal(thumbnail.attr.src, "vault:" + workspaceImagePath(plugin, workspace));
    assert.equal(thumbnail.attr.alt, "");
}
console.log("Workspace thumbnails passed: user covers, canonical frontmatter, category images, placeholders and Resource images.");
