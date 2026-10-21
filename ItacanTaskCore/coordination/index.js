"use strict";
// Private evidence entry point. This package is not an execution participant.
module.exports = Object.freeze({
    analyzeCoordinationEvidence: require("./evidence").analyzeCoordinationEvidence,
    classifyWorkflowOutcome: require("./outcomes").classifyWorkflowOutcome
});
