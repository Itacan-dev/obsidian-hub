"use strict";
// Inactive, allocation-free evidence API. Never imported by the core or plugin.
const evidence = require("./evidence");
module.exports = { ...Object.fromEntries(["HISTORY_DECISION", "HISTORY_POLICIES", "evidenceDigest", "historyRowKey", "validateHistoryCapture", "analyzeHistoryCapture", "proposeImportBundle"].map(key => [key, evidence[key]])), ...require("./projection") };
