"use strict";
const { appendTask, validateTaskMetadata } = require("./task-planning");

// Every task surface submits the ordinary Markdown task text and metadata.
// Routing remains the responsibility of the existing workspace/location APIs.
function taskFormValues(values = {}) {
    const text = String(values.text ?? "").trim();
    appendTask("", text);
    const steps = (values.steps ?? []).map(step => {
        const text = String(step.text ?? "").trim();
        appendTask("", text);
        return { ...step, text, completed: !!step.completed };
    });
    return { ...values, ...validateTaskMetadata(values), text, steps };
}

function validTaskForm(values) {
    try { taskFormValues(values); return true; } catch (_) { return false; }
}

module.exports = { taskFormValues, validTaskForm };
