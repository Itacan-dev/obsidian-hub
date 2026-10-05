"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePolicy = normalizePolicy;
const target_js_1 = require("./target.js");
function normalizeEntries(input) {
    if (!Array.isArray(input))
        return null;
    const entries = [];
    for (const entry of input) {
        const hostname = (0, target_js_1.normalizeHostname)(entry);
        if (hostname === null)
            return null;
        entries.push(hostname);
    }
    return entries;
}
/** Validate the whole policy and copy its lists before making any decision. */
function normalizePolicy(input) {
    if (input === null || typeof input !== "object" || Array.isArray(input))
        return null;
    if (Object.keys(input).some((key) => key !== "whitelist" && key !== "blacklist") ||
        !Object.hasOwn(input, "whitelist") ||
        !Object.hasOwn(input, "blacklist") ||
        !("whitelist" in input) ||
        !("blacklist" in input)) {
        return null;
    }
    const whitelist = normalizeEntries(input.whitelist);
    const blacklist = normalizeEntries(input.blacklist);
    if (whitelist === null || blacklist === null)
        return null;
    return { whitelist, blacklist };
}
