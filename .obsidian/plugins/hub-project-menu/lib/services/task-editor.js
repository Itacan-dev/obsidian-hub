"use strict";
const { processTaskWrite } = require("./task-writes");
const { randomUUID } = require("crypto");
const { taskMetadata, validateTaskMetadata, readTaskSnapshot, saveTaskSnapshot, appendTask } = require("../domain/task-planning");
const { taskLocations } = require("./task-locations");
const { validLocation } = require("../domain/task-views");
const { taskIdentity, taskLineDetails, normalizedTaskText } = require("../domain/tasks");

class HubTaskEditor {
    constructor(plugin) { this.plugin = plugin; this.app = plugin.app; }
    metadata(id) { return taskMetadata(id ? this.plugin.projectWizard.data.taskMetadata?.[id] : {}); }
    context(path) { return this.plugin.projectWizard.getContextForPath(path); }
    currentContext() {
        return this.plugin.workspaceModes?.currentContext ? this.plugin.workspaceModes.currentContext() :
            this.context(this.app.workspace?.getActiveFile?.()?.path) ?? null;
    }
    locations(root) { return taskLocations(this.plugin, root ? this.plugin.taskData?.currentPath(root) ?? root : root); }
    phases(path) {
        const owner = this.context(path);
        return owner && owner.contextKind !== "resource" ? this.plugin.planning?.phases(owner.projectId) ?? [] : [];
    }
    file(path) {
        const current = this.plugin.taskData?.currentPath(path) ?? path;
        const file = this.app.vault.getAbstractFileByPath(current);
        if (file?.extension !== "md") throw Error("The task's source note is no longer available.");
        return file;
    }
    async destination(path, workspace) {
        const current = this.plugin.taskData?.currentPath(path) ?? path;
        const target = this.app.vault.getAbstractFileByPath(current);
        const owner = workspace ?? this.context(current);
        if (!target || !validLocation(current, owner)) throw Error("Choose a location inside this workspace.");
        if (target.extension === "md") return target;
        if (!Array.isArray(target.children)) throw Error("Choose a note or folder.");
        const taskPath = current + "/Tasks.md";
        // Resolve again immediately before creation; never pre-create folder notes.
        const existing = this.app.vault.getAbstractFileByPath(taskPath);
        if (existing) return this.file(taskPath);
        try { return await this.app.vault.create(taskPath, "# Tasks\n"); }
        catch (error) {
            if (this.app.vault.getAbstractFileByPath(taskPath)) return this.file(taskPath);
            throw error;
        }
    }
    checkedMetadata(values, workspace, previous = {}) {
        const metadata = validateTaskMetadata({ ...values,
            ...(values.description === undefined && previous.description !== undefined ? { description: previous.description } : {}),
            ...(values.captureSource === undefined && previous.captureSource ? { captureSource: previous.captureSource } : {}) });
        if (metadata.phaseId && (!workspace || workspace.contextKind === "resource")) {
            throw Error("Choose a phase in the task's Project.");
        }
        if (metadata.phaseId && !this.phases(workspace?.root).some(phase => phase.id === metadata.phaseId)) {
            throw Error("This phase is no longer available in the task's Project.");
        }
        return metadata;
    }
    async read(task) {
        const file = this.file(task.path);
        const snapshot = readTaskSnapshot(await this.app.vault.read(file), { ...task, path: file.path });
        if (task.identityConflict) {
            throw Error("This task was copied with its Hub ID. Remove the hidden hub-task comment from the copied task in Markdown, then reopen it.");
        }
        return { ...snapshot, ...this.metadata(snapshot.hubTaskId), file };
    }
    async rollback(writes) {
        for (const write of [...writes].reverse()) {
            await processTaskWrite(this.plugin, write.file, current => {
                if (current !== write.written) throw Error("The note also changed. Check the task's locations before retrying.");
                return write.original;
            });
        }
    }
    async write(file, transform, writes) {
        const write = { file };
        await processTaskWrite(this.plugin, file, content => {
            write.original = content; write.written = transform(content); return write.written;
        });
        writes.push(write);
    }
    async saveMetadata(id, metadata, deleting) {
        if (!id) return;
        const data = this.plugin.projectWizard.data, previous = data.taskMetadata;
        data.taskMetadata = { ...previous };
        if (deleting || !Object.values(metadata).some(Boolean)) delete data.taskMetadata[id];
        else data.taskMetadata[id] = metadata;
        try { await this.plugin.dataStore.save(data); }
        catch (error) { data.taskMetadata = previous; throw error; }
    }
    async record(edit, context, timestamp) {
        try {
            if (await this.plugin.projectWizard.recordTaskMutation(edit, context, timestamp)) this.plugin.notifyCompletedTasksChanged?.();
        } catch (error) {
            console.error("Could not update task History", error);
            new (require("obsidian").Notice)("Task saved, but its History could not be updated.");
        }
    }
    save(snapshot, values) {
        const actionTimestamp = Date.now();
        return this.plugin.enqueueTaskMutation(async () => {
            const deleting = values.operation === "delete";
            const file = this.file(snapshot.file.path), owner = this.context(file.path);
            const location = values.location ?? file.path;
            const moving = !deleting && location !== file.path;
            const targetOwner = moving ? this.context(this.plugin.taskData?.currentPath(location) ?? location) : owner;
            const metadata = deleting ? taskMetadata() : this.checkedMetadata(values, targetOwner, snapshot);
            const id = snapshot.hubTaskId ?? (!deleting && (moving || Object.values(metadata).some(Boolean)) ? randomUUID() : null);
            const request = { ...snapshot, path: file.path };
            if (snapshot.hubTaskId && JSON.stringify(this.metadata(snapshot.hubTaskId)) !== JSON.stringify(taskMetadata(snapshot))) {
                throw Error("This task's metadata changed in another editor. Reopen the task before saving.");
            }
            const withoutPhase = value => { const { phaseId, ...other } = taskMetadata(value); return other; };
            const phaseOnly = !deleting && !moving && (metadata.phaseId ?? null) !== (snapshot.phaseId ?? null) &&
                (values.completed ?? snapshot.completed) === snapshot.completed &&
                values.text === snapshot.text && JSON.stringify(withoutPhase(metadata)) === JSON.stringify(withoutPhase(snapshot)) &&
                (values.steps ?? snapshot.steps).length === snapshot.steps.length &&
                (values.steps ?? snapshot.steps).every((step, index) => step.line === snapshot.steps[index].line &&
                    step.text === snapshot.steps[index].text && step.completed === snapshot.steps[index].completed && !step.completedAt);
            const writes = [];
            let edit;
            try {
                const target = moving ? await this.destination(location, targetOwner) : file;
                if (target === file || target.path === file.path) {
                    await this.write(file, content => {
                        const result = saveTaskSnapshot(content, request, { ...values, ...metadata }, id, randomUUID);
                        edit = result.edit; return result.content;
                    }, writes);
                } else {
                    // Validate the whole original block before writing either note.
                    const original = await this.app.vault.read(file);
                    const result = saveTaskSnapshot(original, request, { ...values, ...metadata }, id, randomUUID);
                    const updated = result.edit.tasks[0];
                    const block = updated.block.split("\n");
                    const indentation = block[0].match(/^[ \t]*/)[0];
                    const movedBlock = block.map(line => line.startsWith(indentation) ? line.slice(indentation.length) : line).join("\n");
                    let saved;
                    await this.write(target, content => {
                        // Reuse append validation for unfinished fences/Properties.
                        appendTask(content, values.text);
                        const eol = content.includes("\r\n") ? "\r\n" : "\n";
                        const prefix = content + (content.endsWith("\n") || !content ? "" : eol) + eol;
                        const next = prefix + movedBlock.replace(/\n/g, eol) + eol;
                        saved = readTaskSnapshot(next, { path: target.path, line: prefix.split(/\r?\n/).length - 1, text: values.text, hubTaskId: id });
                        return next;
                    }, writes);
                    await this.write(file, content => {
                        const removed = saveTaskSnapshot(content, request, { operation: "delete" });
                        edit = { ...removed.edit, operation: "edit", movedTo: { path: target.path, line: saved.line }, destinationContext: targetOwner,
                            tasks: [{ ...saved, ...metadata }], completed: saved.completed,
                            progressTransitions: (result.edit.progressTransitions ?? []).map(event => ({ ...event,
                                line: saved.line + event.line - updated.line,
                                ...(event.lookupLine != null ? { lookupLine: saved.line + event.lookupLine - updated.line } : {}) })) };
                        return removed.content;
                    }, writes);
                }
                await this.saveMetadata(id, metadata, deleting);
            } catch (error) {
                try { await this.rollback(writes); }
                catch (_) { throw Error("The task could not be saved and a note also changed. Check its source and destination before retrying."); }
                throw error;
            }
            if (!phaseOnly) await this.record(edit, edit.movedTo ? targetOwner : owner, actionTimestamp);
            for (const write of writes) {
                if (!phaseOnly) this.plugin.markProjectChangedByPath(write.file.path);
                if (write.original === write.written) this.plugin.taskData?.invalidate(write.file.path);
            }
            if (!phaseOnly) this.plugin.oath?.changed(edit);
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
    async createdWithIdentity(id, text, owner) {
        const files = this.app.vault.getMarkdownFiles?.() ??
            this.app.vault.getAllLoadedFiles().filter(file => file.extension === "md");
        const matches = [];
        for (const file of files) {
            const content = await this.app.vault.read(file);
            if (!content.includes("<!-- hub-task:" + id + " -->")) continue;
            let fence = null;
            for (const line of content.split(/\r?\n/)) {
                const token = line.trim().match(/^(`{3,}|~{3,})/);
                if (token) { if (!fence) fence = token[1][0]; else if (fence === token[1][0]) fence = null; continue; }
                if (fence) continue;
                if (taskLineDetails(line) && taskIdentity(line) === id) matches.push({ file, line });
            }
        }
        if (!matches.length) return null;
        if (matches.length !== 1 || normalizedTaskText(taskLineDetails(matches[0].line).text) !== normalizedTaskText(text) ||
            !validLocation(matches[0].file.path, owner)) {
            throw Error("This task's saved identity changed or was copied. Check its existing task before retrying.");
        }
        return matches[0].file;
    }
    create(path, text, values = {}) {
        const actionTimestamp = Date.now();
        return this.plugin.enqueueTaskMutation(async () => {
            const owner = this.context(path);
            // Inbox receipts supply their persisted ID so a destination write
            // followed by a failed receipt save can be retried without adding a
            // second ordinary task. Existing callers retain their normal IDs.
            const requestedId = values.hubTaskId;
            if (requestedId != null && (typeof requestedId !== "string" || !/^[a-zA-Z0-9-]+$/.test(requestedId))) {
                throw Error("Choose a valid task identity.");
            }
            if (requestedId) {
                appendTask("", text); // Validate retries through the ordinary title rule too.
                const existing = await this.createdWithIdentity(requestedId, text, owner);
                if (existing) return existing;
            }
            const metadata = this.checkedMetadata(values, owner);
            // Keep legacy callers that supply an existing note working unchanged.
            const file = this.app.vault.getAbstractFileByPath(path)?.extension === "md" ?
                this.file(path) : await this.destination(path, owner);
            if (owner?.root && !validLocation(file.path, owner)) throw Error("Choose a location inside this workspace.");
            const id = requestedId ?? (Object.values(metadata).some(Boolean) ? randomUUID() : null);
            const writes = [];
            let edit;
            try {
                await this.write(file, content => {
                    const appended = appendTask(content, text);
                    const line = content.split(/\r?\n/).length + (content.endsWith("\n") || !content ? -1 : 0);
                    const snapshot = readTaskSnapshot(appended, { path: file.path, line: line + 1, text });
                    const result = saveTaskSnapshot(appended, snapshot, { ...values, ...metadata, text, completed: values.completed === true, steps: values.steps ?? [] }, id, randomUUID);
                    edit = { ...result.edit, operation: "add", insertionLine: snapshot.line,
                        removedLines: 0, lineDelta: result.content.split(/\r?\n/).length - content.split(/\r?\n/).length };
                    return result.content;
                }, writes);
                await this.saveMetadata(edit.tasks[0].hubTaskId, metadata, false);
            } catch (error) {
                try { await this.rollback(writes); }
                catch (_) { throw Error("The task could not be saved and the note also changed. Reopen its location before retrying."); }
                throw error;
            }
            await this.record(edit, owner, actionTimestamp);
            this.plugin.markProjectChangedByPath(file.path);
            return file;
        });
    }
}
module.exports = { HubTaskEditor };
