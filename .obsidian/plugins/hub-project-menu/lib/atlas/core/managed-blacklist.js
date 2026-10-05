"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileManagedBlacklist = compileManagedBlacklist;
exports.isManagedBlacklist = isManagedBlacklist;
exports.managedBlacklistContains = managedBlacklistContains;
const target_js_1 = require("./target.js");
const contents = new WeakMap();
function compileManagedBlacklist(input) {
    if (!Array.isArray(input))
        return null;
    const domains = new Set();
    for (const entry of input) {
        const hostname = (0, target_js_1.normalizeHostname)(entry);
        if (hostname === null)
            return null;
        domains.add(hostname);
    }
    const compiled = Object.freeze({ size: domains.size });
    contents.set(compiled, domains);
    return compiled;
}
function isManagedBlacklist(input) {
    return input !== null && typeof input === "object" && contents.has(input);
}
/** Callers normalize a single target. Invalid compiled authority is never an empty list. */
function managedBlacklistContains(input, hostname) {
    return isManagedBlacklist(input) ? contents.get(input).has(hostname) : null;
}
