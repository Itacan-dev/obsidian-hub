"use strict";

function planFeedback(plan) {
    const message = plan.status;
    if (message && message !== "Saved" && message !== "Saving...") return message;
    if (plan.error) return plan.error.message;
    if (plan.deferredInput) return "A Plan note edit was preserved locally.";
    return "";
}

function showPlanFeedback(element, message) {
    if (element.textContent !== message) element.textContent = message;
    element.hidden = !message;
}

module.exports = { planFeedback, showPlanFeedback };
