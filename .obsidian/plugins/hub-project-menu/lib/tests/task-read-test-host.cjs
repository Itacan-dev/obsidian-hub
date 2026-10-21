"use strict";
// Adapt older isolated service fixtures to the same real facade/adapter. Their
// existing synthetic task-data, metadata, source and assertions remain in use.
const { TaskService } = require("../services/task-service");
const { LegacyTaskAdapter } = require("../services/task-service-legacy");
const { readTaskSnapshot, taskMetadata } = require("../domain/task-planning");
function attachLegacyFacade(plugin) {
    if (plugin.taskService) return plugin.taskService;
    plugin.taskData.subscribe ??= () => () => {};
    const readPages = plugin.taskData.readPages.bind(plugin.taskData);
    plugin.taskData.readPages = (...args) => readPages(...args).map(page => ({ ...page,
        file: { ...page.file, tasks: page.file.tasks.map(task => ({ ...task, steps: (task.steps ?? []).map((step, index) => ({
            ...step, path: step.path ?? task.path, line: step.line ?? task.line + index + 1, parent: step.parent ?? task.line
        })) })) } }));
    plugin.taskEditor ??= { metadata: () => ({}) };
    plugin.taskEditor.read ??= async task => {
        const file = plugin.app.vault.getAbstractFileByPath(task.path);
        if (!file) throw Error("Synthetic source missing");
        const snapshot = readTaskSnapshot(await plugin.app.vault.read(file), task);
        return { ...snapshot, ...taskMetadata(plugin.taskEditor.metadata(snapshot.hubTaskId)), file };
    };
    return plugin.taskService = new TaskService(new LegacyTaskAdapter({ plugin, dataview: () => {
        const api = plugin.oath.api(); return api.pages ? api : { pages() {} };
    } }));
}
module.exports = { attachLegacyFacade };
