"use strict";
const { validateTaskMetadata } = require("./task-planning");

const TASK_FORM_ORDER = Object.freeze(["text", "destination", "necessity", "dates", "steps", "phase"]);
const TASK_FIELD_LABELS = Object.freeze({ text: "Task", workspace: "Save to", location: "Location",
    necessity: "Necessity", should: "Should do", must: "Must do", fromDate: "Start date", dueDate: "Due date",
    steps: "Steps", phase: "Project phase", noPhase: "No phase" });

// All task forms submit native field values. Titles are never parsed as note blocks.
function validateTaskTitle(value) { if (typeof value!=="string"||!value.trim()) throw Error("Give the task or Step a title.");return value.trim(); }
function taskFormValues(values = {}) {
    const text = String(values.text ?? "").trim();
    validateTaskTitle(text);
    const steps = (values.steps ?? []).map(step => {
        const text = String(step.text ?? "").trim();
        validateTaskTitle(text);
        return { ...step, text, completed: !!step.completed };
    });
    const canonical = { ...values, ...validateTaskMetadata(values), text, steps };
    return canonical;
}

function validTaskForm(values) {
    try { taskFormValues(values); return true; } catch (_) { return false; }
}

module.exports = { TASK_FORM_ORDER, TASK_FIELD_LABELS, taskFormValues, validTaskForm, validateTaskTitle };
