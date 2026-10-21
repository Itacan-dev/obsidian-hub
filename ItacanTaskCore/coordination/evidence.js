"use strict";
const V = require("../src/value"), O = require("./outcomes");
function analyzeCoordinationEvidence(input) {
    try {
        V.jsonValue(input); V.fields(input, ["version", "privacy", "sourceGraphDigest", "observations"], ["version", "privacy", "sourceGraphDigest", "observations"]);
        O.contract(input.version === 1 && input.privacy === "local-private" && /^[a-f0-9]{64}$/.test(input.sourceGraphDigest) && Array.isArray(input.observations));
        const capture = V.clone(input), seen = new Set(), rows = capture.observations.map((observation, ordinal) => {
            O.contract(!seen.has(observation.id)); seen.add(observation.id);
            return { ordinal, id: observation.id, outcome: O.classifyWorkflowOutcome(observation) };
        });
        const accounting = Object.fromEntries(["prepared", "partial", "confirmed", "uncertain", "conflict", "blocked", "rejected"].map(k => [k, rows.filter(r => r.outcome.state === k).length]));
        O.contract(Object.values(accounting).reduce((a, b) => a + b, 0) === rows.length);
        return O.freeze({ version: 1, privacy: "local-private", executable: false, sourceGraphDigest: capture.sourceGraphDigest, available: rows.length > 0, reason: rows.length ? "COMPLETE_OBSERVATION_ACCOUNTING" : "NO_EVIDENCE", inputCount: rows.length, accounting, rows });
    } catch (_) { O.contract(false); }
}
module.exports = { analyzeCoordinationEvidence };
