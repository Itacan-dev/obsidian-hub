"use strict";
// Portable entry point: deliberately does not load the Node filesystem adapter.
module.exports = {
    HISTORY_IMPORT_COMMANDS: require("./history-import").HISTORY_IMPORT_COMMANDS,
    ...require("./errors"), ...require("./domain"), ...require("./memory-repository"),
    ...require("./serialization"),
    ...require("./recurrence-calendar"),
    ...Object.fromEntries(["RECURRENCE_COMMANDS", "RECURRENCE_GENERATION_COMMANDS", "RECURRENCE_STATES", "validateExternalReservations", "validateRuleInput", "validateRuleRevision", "validateTemplateRevision", "validateSeries", "validateMembership", "validateGenerationGraph", "generationKey"]
        .map(key => [key, require("./recurrence")[key]])),
    ...Object.fromEntries(["CONTENT_DECISION", "captureSourceEnvelope", "validateEnvelope", "originalBytes", "verifySourceEnvelope", "currentSearchProjection"]
        .map(key => [key, require("./source-content")[key]]))
};
