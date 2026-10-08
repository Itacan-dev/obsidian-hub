"use strict";
const path = require("path");
const STRICT_CONFIRMATION_VERSION = 1;
const STRICT_TERMS = "Strict Oath keeps Itacan fullscreen and removes ordinary early exit until the timer or selected tasks fulfill it. Permitted desktop applications remain ordinary windows; Alt+Tab is available. Close detected unpermitted applications yourself. Application detection and returning focus are best effort; websites, notifications and Windows controls are not restricted. A scheduled Oath waits for detected blockers to clear and may then activate without another confirmation.";
function applications(values) {
    if (!Array.isArray(values)) throw Error("Applications must be a list of absolute executable paths.");
    const result = new Set();
    for (const value of values) {
        if (typeof value !== "string" || !/^[a-z]:[\\/]/i.test(value) || !/\.exe$/i.test(value) || /[\0\r\n]/.test(value))
            throw Error("Select a local Windows .exe file using its absolute path.");
        result.add(path.win32.normalize(value).toLowerCase());
    }
    return [...result].sort();
}
function strictPolicy(draft, defaults = []) {
    if (draft.mode != null && !["ordinary", "strict"].includes(draft.mode)) throw Error("Unknown Oath mode.");
    if (draft.mode !== "strict") return { mode: "ordinary" };
    return { mode: "strict", confirmationVersion: STRICT_CONFIRMATION_VERSION,
        applications: applications(draft.applications === undefined ? defaults : draft.applications) };
}
function validPolicy(policy) {
    if (policy?.mode !== "strict" || policy.confirmationVersion !== STRICT_CONFIRMATION_VERSION) return false;
    try { return JSON.stringify(policy.applications) === JSON.stringify(applications(policy.applications)); } catch { return false; }
}
function classifyWindows(records, policy, host) {
    if (!Array.isArray(records)) throw Error("Application observation unavailable.");
    const allowed = new Set(policy.applications), blockers = [], unknown = [];
    for (const record of records) {
        if (record.pid === host?.pid && (String(record.handle) === String(host?.handle) || host?.dockHandle && String(record.handle) === String(host.dockHandle))) continue;
        let executable;
        try { executable = applications([record.executable])[0]; } catch { unknown.push(record); continue; }
        if (!allowed.has(executable)) blockers.push({ ...record, executable });
    }
    return { blockers, unknown, warnings: ["Only one main window per process is observed; some dialogs, packaged apps and inaccessible windows may be missed.",
        ...(unknown.length ? ["Some application identities could not be read."] : [])] };
}
module.exports = { applications, strictPolicy, validPolicy, classifyWindows, STRICT_CONFIRMATION_VERSION, STRICT_TERMS };
