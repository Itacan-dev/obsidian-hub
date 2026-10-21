"use strict";
const { canonical } = require("./value");
const { workspaceKey } = require("./domain");
const add = (map, key, id) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(id); };
function buildIndexes(state) {
    const tasks = new Map(), owner = new Map(), completed = new Map(), start = new Map(), due = new Map(), phase = new Map(), location = new Map();
    const historyByTask = new Map(), historyByStep = new Map(), history = new Map(), receipts = new Map();
    for (const task of state.tasks) {
        tasks.set(task.id, task); add(owner, workspaceKey(task.owner), task.id); add(completed, task.completed, task.id);
        if (task.start) add(start, task.start.date, task.id);
        if (task.due) add(due, task.due.date, task.id);
        if (task.phase) add(phase, canonical(task.phase), task.id);
        add(location, canonical(task.location), task.id);
    }
    for (const record of state.history) {
        history.set(record.id, record); if (record.taskId !== null) add(historyByTask, record.taskId, record.id);
        if (record.stepId !== null) add(historyByStep, record.stepId, record.id);
    }
    for (const receipt of state.receipts) receipts.set(receipt.operationId, receipt);
    return { tasks, owner, completed, start, due, phase, location, history, historyByTask, historyByStep, receipts,
        startDays: [...start.keys()].sort(), dueDays: [...due.keys()].sort() };
}
module.exports = { buildIndexes };
