"use strict";
const { appendTask, validateTaskMetadata } = require("./task-planning");

const TASK_FORM_ORDER = Object.freeze(["text", "destination", "necessity", "dates", "steps", "phase"]);
const TASK_FIELD_LABELS = Object.freeze({ text: "Task", workspace: "Save to", location: "Location",
    necessity: "Necessity", should: "Should do", must: "Must do", fromDate: "Start date", dueDate: "Due date",
    steps: "Steps", phase: "Project phase", noPhase: "No phase" });

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
    const canonical = { ...values, ...validateTaskMetadata(values), text, steps };
    delete canonical.linkedProjectId; // Retired task association; never re-submit legacy data.
    return canonical;
}

function validTaskForm(values) {
    try { taskFormValues(values); return true; } catch (_) { return false; }
}

module.exports = { TASK_FORM_ORDER, TASK_FIELD_LABELS, taskFormValues, validTaskForm };
