"use strict";
// Memory-only, closed codes and scalar counts. Never copy messages, paths,
// URLs, tokens, exceptions or saved authority into diagnostics.
const causes = Object.freeze({ EBUSY: "BUSY", EAGAIN: "BUSY", EINTR: "INTERRUPTED", EIO: "IO_ERROR",
    ENOSPC: "CAPACITY", EDQUOT: "CAPACITY", EACCES: "ACCESS_DENIED", EPERM: "ACCESS_DENIED", EROFS: "READ_ONLY",
    EMFILE: "RESOURCE_LIMIT", ENFILE: "RESOURCE_LIMIT", ENOENT: "MISSING_DATA",
    ATLAS_OWNER_LOST: "OWNERSHIP", ATLAS_INVALID_DATA: "INVALID_DATA", ATLAS_EXTERNAL_WRITE: "EXTERNAL_WRITE",
    ATLAS_JOURNAL_CHANGED: "JOURNAL_CHANGED", ATLAS_AUTHORITY_MISMATCH: "AUTHORITY_MISMATCH" });
function cause(error) {
    try { const code = error?.code; return Object.hasOwn(causes, code) ? causes[code] : error instanceof SyntaxError ? "INVALID_DATA" : "OTHER"; }
    catch (_) { return "OTHER"; }
}
const coded = code => Object.assign(new Error(code), { code });
const increment = value => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
function createStorageDiagnostics() {
    const counts = { initializeAttempts: 0, initialized: 0, loadAttempts: 0, verifiedLoads: 0, writeAttempts: 0, committedWrites: 0, failedWrites: 0,
        notWrittenWrites: 0, unknownWrites: 0, conflicts: 0, resolveAttempts: 0, resolvedCommits: 0, migrations: 0, cleanupFailures: 0 };
    let sequence = 0, lastFailure = null;
    return {
        bump(key) { if (Object.hasOwn(counts, key)) counts[key] = increment(counts[key]); },
        fail(operation, stage, error, outcome) {
            sequence = increment(sequence); lastFailure = Object.freeze({ sequence, operation, stage, cause: cause(error), outcome });
        },
        view() { return Object.freeze({ ...counts, lastFailure }); }
    };
}
module.exports = { cause, coded, increment, createStorageDiagnostics };
