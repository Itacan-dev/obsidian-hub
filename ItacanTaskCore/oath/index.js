"use strict";
// Separate inactive entry point. No registration, storage, subscription or allocation.
const { DECISION, READINESS, analyzeOathEvidence } = require("./evidence");
const { resolveCommitmentTarget, assessMigrationProtection } = require("./resolution");
const { assessCompletionEligibility } = require("./completion");
const { PRIVATE_CLASSES, classifyTaskSharing } = require("./privacy");
module.exports = { DECISION, READINESS, PRIVATE_CLASSES, analyzeOathEvidence, resolveCommitmentTarget, assessMigrationProtection, assessCompletionEligibility, classifyTaskSharing };
