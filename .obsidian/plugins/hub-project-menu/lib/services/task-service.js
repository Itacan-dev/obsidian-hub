"use strict";
const { TaskServiceError, requireTaskValue, unsupported } = require("./task-service-errors");

// One explicitly injected authority, for this facade's entire lifetime. There is
// no backend discovery, startup registration, native import or failure fallback.
const TASK_SERVICE_OPERATIONS = Object.freeze([
    "getTask", "queryOwned", "queryVisible", "queryDisplay", "queryStructured", "resolveOathWork", "resolveLegacyAction", "resolveSavedTarget", "readSteps", "readEditable", "releaseEditable",
    "queryHistory", "resolveReveal", "createTask", "saveEditable", "setCompleted",
    "addStep", "editStep", "deleteStep", "reorderSteps", "setStepCompleted",
    "changeAssociations", "deleteTask", "archiveTask", "clearCompleted"
]);

class TaskService {
    #adapter;
    #closed = false;
    constructor(adapter) {
        requireTaskValue(adapter && typeof adapter.capabilities === "function" && typeof adapter.subscribe === "function" &&
            typeof adapter.close === "function", "Inject one task-service adapter.");
        this.#adapter = adapter;
    }
    capabilities() { this.#open(); return this.#adapter.capabilities(); }
    readiness(required = []) { this.#open(); return require("./task-read-contract").taskReadiness(this.#adapter, required); }
    read(request) { this.#open(); return require("./task-read-contract").readTaskContract(this.#adapter, request); }
    subscribeReads(listener) { this.#open(); return require("./task-read-contract").subscribeTaskReads(this.#adapter, listener); }
    #open() { if (this.#closed) throw new TaskServiceError("CLOSED", "The task service is closed."); }
    async invoke(operation, ...args) {
        this.#open();
        if (!TASK_SERVICE_OPERATIONS.includes(operation)) unsupported(operation);
        const method = this.#adapter[operation];
        if (typeof method !== "function") unsupported(operation);
        return method.apply(this.#adapter, args);
    }
    subscribe(listener) {
        this.#open();
        requireTaskValue(typeof listener === "function", "A task-change listener is required.");
        return this.#adapter.subscribe(listener);
    }
    async close() {
        if (this.#closed) return;
        this.#closed = true;
        await this.#adapter.close();
    }
}
for (const operation of TASK_SERVICE_OPERATIONS) {
    Object.defineProperty(TaskService.prototype, operation, {
        value: function(...args) { return this.invoke(operation, ...args); }
    });
}

module.exports = { TaskService, TASK_SERVICE_OPERATIONS };
