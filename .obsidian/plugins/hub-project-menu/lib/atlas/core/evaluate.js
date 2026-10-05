"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluate = evaluate;
const policy_js_1 = require("./policy.js");
const target_js_1 = require("./target.js");
/** Pure evaluation of plain input data. No state, time, storage, or side effects. */
function evaluate(requestedSite, currentPolicy) {
    const policy = (0, policy_js_1.normalizePolicy)(currentPolicy);
    if (policy === null)
        return { outcome: "DENY", reason: "INVALID_POLICY" };
    const target = (0, target_js_1.normalizeTarget)(requestedSite);
    if (target === null)
        return { outcome: "DENY", reason: "INVALID_TARGET" };
    if (policy.blacklist.includes(target.hostname)) {
        return { outcome: "DENY", reason: "BLACKLISTED", target };
    }
    if (policy.whitelist.includes(target.hostname)) {
        return { outcome: "ALLOW", reason: "WHITELISTED", target };
    }
    return { outcome: "GREYLIST", reason: "UNLISTED", target };
}
