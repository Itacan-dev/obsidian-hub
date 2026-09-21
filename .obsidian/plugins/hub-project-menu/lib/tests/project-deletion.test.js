"use strict";
const assert = require("assert");
const { ProjectDeletionGuard, isProjectDeletionCancelled } = require("../services/project-deletion");

async function run() {
    const files = new Map(), projects = [], calls = [], prompts = [];
    const vault = {
        getMarkdownFiles: () => [...files.values()].filter(file => file.path.endsWith(".md")),
        getAbstractFileByPath: path => files.get(path)
    };
    const app = { vault, metadataCache: { getFileCache: file => ({ frontmatter: file.frontmatter }) },
        fileManager: { async trashFile(...args) { calls.push({ args, receiver: this }); return "trashed"; } } };
    const original = app.fileManager.trashFile;
    for (const status of ["active", "future", "shelved"]) {
        const folder = { path: `Projects/${status}`, children: [] };
        const file = { path: `${folder.path}/${status}.md`, basename: status, frontmatter: { type: "project", status } };
        files.set(folder.path, folder); files.set(file.path, file); folder.children.push(file);
        projects.push({ folder, file });
    }
    let allow = false;
    const guard = new ProjectDeletionGuard(app, async (name, path) => { prompts.push({ name, path }); return allow; });
    for (const { folder, file } of projects) {
        await assert.rejects(app.fileManager.trashFile(folder), isProjectDeletionCancelled);
        await assert.rejects(app.fileManager.trashFile(file), isProjectDeletionCancelled);
    }
    assert.equal(calls.length, 0, "All statuses, folders and project files require approval");
    allow = true;
    for (const { folder, file } of projects) {
        assert.equal(await app.fileManager.trashFile(folder, "extra"), "trashed");
        await app.fileManager.trashFile(file);
    }
    assert.equal(calls.length, 6);
    assert.equal(calls[0].args[1], "extra", "Keep trash method arguments and return value");
    assert.equal(calls[0].receiver, app.fileManager);
    const ordinary = { path: "Projects/active/Note.md", basename: "Note", frontmatter: {} };
    files.set(ordinary.path, ordinary);
    const resource = { path: "Resources/Knowledge.md", basename: "Knowledge", frontmatter: { type: "resource" } };
    files.set(resource.path, resource);
    const before = prompts.length;
    await app.fileManager.trashFile(ordinary); await app.fileManager.trashFile(resource);
    assert.equal(prompts.length, before, "Ordinary notes and Resources unchanged");
    const parent = { path: "Projects", children: projects.map(item => item.folder) }; files.set(parent.path, parent);
    await app.fileManager.trashFile(parent);
    assert.equal(prompts.length, before + 3, "Ancestor folder requires every contained project name");
    allow = false;
    let approved = false;
    await assert.rejects(guard.trash(projects[0].folder, { requiredProject: projects[0].file, onApproved: () => { approved = true; } }), isProjectDeletionCancelled);
    assert.equal(approved, false, "No dashboard removal before approval");
    allow = true;
    await guard.trash(projects[0].folder, { requiredProject: projects[0].file, onApproved: () => { approved = true; } });
    assert.equal(approved, true);
    await assert.rejects(guard.trash(ordinary, { requiredProject: projects[0].file }), isProjectDeletionCancelled);
    guard.destroy();
    assert.equal(app.fileManager.trashFile, original, "Restore native method on unload");

    let answer;
    const pending = new ProjectDeletionGuard(app, () => new Promise(resolve => { answer = resolve; }));
    const target = projects[0].folder;
    const result = app.fileManager.trashFile(target);
    await Promise.resolve();
    target.path = "Projects/Renamed";
    answer(true);
    await assert.rejects(result, isProjectDeletionCancelled, "Renaming during confirmation invalidates approval");
    target.path = "Projects/active";
    const closing = app.fileManager.trashFile(target);
    await Promise.resolve();
    pending.destroy(); answer(true);
    await assert.rejects(closing, isProjectDeletionCancelled, "Unload cannot authorize a pending deletion");

    const fs = require("fs"), path = require("path");
    const source = fs.readFileSync(path.resolve(__dirname, "../../plugin.js"), "utf8");
    const cardDelete = source.slice(source.indexOf("async deleteProject(file, dashboard)"), source.indexOf("async openAppShortcut("));
    assert.ok(cardDelete.includes("this.projectDeletion.trash(target, { onApproved, requiredProject: file })"));
    assert.ok(!cardDelete.includes("confirmAction("), "Project cards have one shared strong confirmation, not the old dialog");
    assert.ok(source.includes("this.projectDeletion?.destroy()") && source.includes("this.projectDeletionModal?.close()"));
    console.log("Project deletion tests passed: all statuses, card/file/folder/ancestor targets, shared trash boundary, cancellation, unchanged ordinary files, arguments, path changes and unload.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
