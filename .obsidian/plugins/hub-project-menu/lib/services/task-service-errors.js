"use strict";

class TaskServiceError extends Error {
    constructor(code, message, details = {}, cause) {
        super(message);
        this.name = "TaskServiceError";
        this.code = code;
        this.details = details;
        if (cause) this.cause = cause;
    }
}

function requireTaskValue(condition, message) {
    if (!condition) throw new TaskServiceError("VALIDATION", message);
}

function unsupported(operation, reason) {
    throw new TaskServiceError("UNSUPPORTED", reason ?? `${operation} is not supported by this backend.`, { operation });
}

// Preserve the original Error as cause. These are actual legacy service messages,
// not claims that an arbitrary I/O failure was rolled back successfully.
function legacyError(error, writing = false) {
    if (error instanceof TaskServiceError) return error;
    const message = error?.message ?? String(error);
    let code = writing ? "WRITE_FAILED" : "READ_FAILED";
    if (error?.code === "HUB_STATE_CONFLICT") code = "STATE_CONFLICT";
    else if (/could not be saved and .*note also changed/.test(message)) code = "PARTIAL_FAILURE";
    else if (/copied|uniquely/.test(message)) code = "AMBIGUOUS_REFERENCE";
    else if (/source note is no longer available|Task file not found/.test(message)) code = "SOURCE_MISSING";
    else if (/metadata changed/.test(message)) code = "STATE_CONFLICT";
    else if (/moved|changed|Reopen|reopen/.test(message)) code = "STALE_REFERENCE";
    else if (/Choose|Enter task|one line|identity marker|valid date|valid time|Due must|Step changed|Close the open|phase is no longer available/.test(message)) code = "VALIDATION";
    return new TaskServiceError(code, message, {
        backend: "legacy-markdown",
        ...(writing ? { persistence: "not-transactional; inspect canonical state before retry" } : {})
    }, error);
}

module.exports = { TaskServiceError, requireTaskValue, unsupported, legacyError };
