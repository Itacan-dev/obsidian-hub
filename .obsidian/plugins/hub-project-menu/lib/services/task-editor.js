"use strict";
const { randomUUID } = require("crypto");
const { taskMetadata, validateTaskMetadata, readTaskSnapshot, saveTaskSnapshot, appendTask } = require("../domain/task-planning");

class HubTaskEditor {
    constructor(plugin) { this.plugin = plugin; this.app = plugin.app; }
    metadata(id) { return taskMetadata(id ? this.plugin.projectWizard.data.taskMetadata?.[id] : {}); }
    file(path) {
        const current = this.plugin.taskData?.currentPath(path) ?? path;
        const file = this.app.vault.getAbstractFileByPath(current);
        if (file?.extension !== "md") throw Error("The task's source note is no longer available.");
        return file;
    }
    async read(task) {
        const file = this.file(task.path);
        const snapshot = readTaskSnapshot(await this.app.vault.read(file), { ...task, path: file.path });
        if (task.identityConflict) {
            throw Error("This task was copied with its Hub ID. Remove the hidden hub-task comment from the copied task in Markdown, then reopen it.");
        }
        return { ...snapshot, ...this.metadata(snapshot.hubTaskId), file };
    }
    save(snapshot, values) {
        return this.plugin.enqueueTaskMutation(async () => {
            const deleting = values.operation === "delete";
            const metadata = deleting ? taskMetadata() : validateTaskMetadata(values);
            const id = snapshot.hubTaskId ?? (!deleting && Object.values(metadata).some(Boolean) ? randomUUID() : null);
            // Retain the vault object so an open editor follows a note rename.
            const file = this.file(snapshot.file.path);
            const request = { ...snapshot, path: file.path };
            const data = this.plugin.projectWizard.data;
            const previous = data.taskMetadata;
            if (snapshot.hubTaskId && JSON.stringify(this.metadata(snapshot.hubTaskId)) !== JSON.stringify(taskMetadata(snapshot))) {
                throw Error("This task's metadata changed in another editor. Reopen the task before saving.");
            }
            let original, written, edit;
            await this.app.vault.process(file, content => {
                original = content;
                const result = saveTaskSnapshot(content, request, values, id);
                written = result.content; edit = result.edit;
                return written;
            });
            if (id) {
                data.taskMetadata = { ...previous };
                if (deleting || !Object.values(metadata).some(Boolean)) delete data.taskMetadata[id];
                else data.taskMetadata[id] = metadata;
                try { await this.plugin.dataStore.save(data); }
                catch (error) {
                    data.taskMetadata = previous;
                    // Metadata and Markdown cannot share one transaction. Undo
                    // our source write only if nothing else has edited the note.
                    try {
                        await this.app.vault.process(file, current => {
                            if (current !== written) throw Error("Source changed during metadata save.");
                            return original;
                        });
                    } catch (_) {
                        throw Error("Metadata could not be saved. The note also changed; check its task text and reopen the editor.");
                    }
                    throw error;
                }
            }
            try {
                await this.plugin.projectWizard.recordTaskMutation(edit, this.plugin.projectWizard.getContextForPath(file.path));
            } catch (error) {
                console.error("Could not update task History", error);
                new (require("obsidian").Notice)("Task saved, but its History could not be updated.");
            }
            this.plugin.markProjectChangedByPath(file.path);
            if (original === written) this.plugin.taskData?.invalidate(file.path);
            this.plugin.oath?.changed(edit);
            return edit;
        });
    }
    async forget(ids) {
        const data = this.plugin.projectWizard.data;
        const previous = data.taskMetadata;
        if (!ids.some(id => id && previous?.[id])) return;
        data.taskMetadata = { ...previous };
        for (const id of ids) delete data.taskMetadata[id];
        try { await this.plugin.dataStore.save(data); }
        catch (error) { data.taskMetadata = previous; throw error; }
    }
    create(path, text) {
        return this.plugin.enqueueTaskMutation(async () => {
            const file = this.file(path);
            await this.app.vault.process(file, data => appendTask(data, text));
            this.plugin.markProjectChangedByPath(file.path);
            // The shared index event supplies the created task after import.
            return file;
        });
    }
}
module.exports = { HubTaskEditor };
