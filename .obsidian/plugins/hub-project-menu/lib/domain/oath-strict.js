"use strict";
const path = require("path");
const STRICT_CONFIRMATION_VERSION = 4;
const STRICT_TERMS = "Strict Oath keeps Itacan fullscreen and removes ordinary early exit until the timer or selected tasks fulfill it. Permitted desktop applications remain ordinary windows; Alt+Tab is available. Detected windows are possible non-permitted applications with unverified Alt+Tab switchability. Overlays and system components can appear. Resolve candidates or explicitly choose manual application review for this Oath. Application detection and returning focus are best effort; websites, notifications and Windows controls are not restricted. After about three observed seconds in a known non-permitted foreground application, a centered, non-movable Oath Reminder appears without automatically taking focus. It hides when permitted work resumes. This applies in automatic and manual review. Unknown identity or observer failure can prevent reminders. Development recovery releases restrictions after two minutes in this prototype. A scheduled Oath uses its confirmed application-check mode and may activate without another confirmation.";
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
    const applicationCheckMode = draft.applicationCheckMode ?? "automatic";
    if (!["automatic", "manual-review"].includes(applicationCheckMode)) throw Error("Unknown application check mode.");
    if (applicationCheckMode === "manual-review" && draft.manualApplicationReviewAcknowledged !== true)
        throw Error("Check Alt+Tab and acknowledge manual application review before confirming.");
    return { mode: "strict", applicationCheckMode, confirmationVersion: STRICT_CONFIRMATION_VERSION,
        applications: applications(draft.applications === undefined ? defaults : draft.applications) };
}
function validPolicy(policy) {
    if (policy?.mode !== "strict" || ![1, 2, 3, STRICT_CONFIRMATION_VERSION].includes(policy.confirmationVersion)) return false;
    if (policy.confirmationVersion === 1 && policy.applicationCheckMode != null && policy.applicationCheckMode !== "automatic") return false;
    if (policy.confirmationVersion >= 2 && !["automatic", "manual-review"].includes(policy.applicationCheckMode)) return false;
    try { return JSON.stringify(policy.applications) === JSON.stringify(applications(policy.applications)); } catch { return false; }
}
function windowHandle(value) {
    if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
    const integer = BigInt(value);
    if (integer < -(1n << 63n) || integer >= (1n << 64n)) return null;
    const handle = BigInt.asUintN(64, integer);
    return handle === 0n ? null : handle.toString();
}
function classifyWindows(observation, policy, host) {
    // Legacy injected arrays have no corroboration and therefore cannot block.
    const records = Array.isArray(observation) ? observation : observation?.records;
    if (!Array.isArray(records)) throw Error("Application observation unavailable.");
    const sources = observation?.sources;
    const sourceHandles = new Map();
    let invalidSources = false;
    for (const source of sources?.status === "ok" ? sources.records : []) {
        const match = /^window:(-?\d+):[01]$/.exec(source.id);
        const handle = match && windowHandle(match[1]);
        if (handle) sourceHandles.set(handle, source);
        else invalidSources = true;
    }
    const allowed = new Set(policy.applications), candidates = [], unknown = [], uncertain = [];
    const observed = new Set();
    const isHost = handle => handle && (handle === windowHandle(host?.handle) || handle === windowHandle(host?.dockHandle) || handle === windowHandle(host?.reminderHandle));
    for (const record of records) {
        const handle = windowHandle(record.handle);
        if (handle) observed.add(handle);
        if (record.pid === host?.pid && isHost(handle)) continue;
        let executable;
        try { executable = applications([record.executable])[0]; } catch { unknown.push(record); continue; }
        if (allowed.has(executable)) continue;
        if (sourceHandles.has(handle)) candidates.push({ ...record, executable, switchability: "unverified" });
        else uncertain.push({ ...record, executable });
    }
    for (const [handle, source] of sourceHandles) {
        if (!observed.has(handle) && !isHost(handle)) unknown.push({ handle, title: source.title, sourceOnly: true });
    }
    const manual = policy.confirmationVersion >= 2 && policy.applicationCheckMode === "manual-review";
    const blockers = manual ? [] : candidates;
    const coverageLimited = manual || sources?.status !== "ok" || invalidSources || !!observation?.warnings?.length;
    return { blockers, candidates, unknown, uncertain, coverageLimited, warnings: [
        "Window checks approximate switchable applications. Only one process window has executable identity; minimized windows, dialogs, packaged apps and virtual desktops may be incomplete.",
        ...(observation?.warnings ?? []),
        ...(candidates.length ? ["Possible non-permitted applications were detected. Their Alt+Tab switchability is unverified; overlays and system components can appear."] : []),
        ...(policy.confirmationVersion === 4 ? ["The Oath Reminder follows known non-permitted foreground activity after three observed seconds. It does not automatically take focus."] : []),
        ...(policy.confirmationVersion === 3 ? ["Newly observed application paths may trigger a bounded return-to-Itacan attempt after two checks. Baseline paths are suppressed, with at most three attempts, 60 seconds apart, per Oath."] : []),
        ...(manual && policy.confirmationVersion === 2 ? ["This legacy manual-review Oath does not trigger application focus nudges."] : []),
        ...(manual ? ["Manual application review applies to this entire Oath, including applications opened later. Application findings are advisory for activation."] : []),
        ...(sources?.status !== "ok" ? ["Window source checks are unavailable. Switchability is uncertain; these findings do not prevent starting."] : []),
        ...(invalidSources ? ["Some window source identifiers could not be read."] : []),
        ...(unknown.length ? ["Some application identities could not be read."] : []),
        ...(uncertain.length ? ["Some windows could not be confirmed as switchable. You may start after acknowledging these limits."] : [])] };
}
module.exports = { applications, strictPolicy, validPolicy, classifyWindows, windowHandle, STRICT_CONFIRMATION_VERSION, STRICT_TERMS };
