"use strict";

class RepositoryError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = "RepositoryError";
        this.code = code;
        this.details = details;
    }
}
function fail(code, message, details) { throw new RepositoryError(code, message, details); }
function check(condition, message, details) { if (!condition) fail("VALIDATION", message, details); }
module.exports = { RepositoryError, fail, check };
