"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readVaultTiming = readVaultTiming;
exports.readConfiguration = readConfiguration;
exports.sameConfiguration = sameConfiguration;
const access_state_js_1 = require("./access-state.js");
const journey_state_js_1 = require("./journey-state.js");
function readVaultTiming(input) {
    if (!(0, journey_state_js_1.hasJourneyFields)(input, ['waitMs', 'confirmationWindowMs'])
        || !(0, access_state_js_1.positiveInteger)(input.waitMs) || !(0, access_state_js_1.positiveInteger)(input.confirmationWindowMs))
        return null;
    return { waitMs: input.waitMs, confirmationWindowMs: input.confirmationWindowMs };
}
function readConfiguration(input) {
    if (!(0, journey_state_js_1.hasJourneyFields)(input, ['accessTiming', 'vaultTiming', 'journeyLimits']))
        return null;
    const accessTiming = (0, access_state_js_1.readTiming)(input.accessTiming);
    const vaultTiming = readVaultTiming(input.vaultTiming);
    const journeyLimits = (0, journey_state_js_1.readJourneyLimits)(input.journeyLimits);
    return accessTiming && vaultTiming && journeyLimits ? { accessTiming, vaultTiming, journeyLimits } : null;
}
/** Readers produce these fields in a fixed order; caller objects need not have that order. */
function sameConfiguration(left, right) {
    return JSON.stringify(readConfiguration(left)) === JSON.stringify(readConfiguration(right));
}
