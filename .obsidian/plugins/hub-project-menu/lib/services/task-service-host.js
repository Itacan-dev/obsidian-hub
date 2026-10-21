"use strict";
const { TaskService } = require("./task-service");
const { LegacyTaskAdapter } = require("./task-service-legacy");

function createLegacyTaskService(plugin) {
    const service = new TaskService(new LegacyTaskAdapter({ plugin,
        dataview: () => plugin.app.plugins.getPlugin?.("dataview")?.api ?? plugin.app.plugins.plugins?.dataview?.api,
        onSubscriberError: error => console.error("Task service refresh failed", error)
    }));
    plugin.register(() => { void service.close().catch(error => console.error("Task service cleanup failed", error)); });
    return service;
}
module.exports = { createLegacyTaskService };
