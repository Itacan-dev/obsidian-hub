"use strict";
const I = require("./intents"), { freeze } = require("../src/snapshot-read");
function createApplicationMutationService({ taskService, adapter = null }) {
    const backend = taskService?.capabilities?.().backend;
    I.check(["native", "legacy-markdown"].includes(backend) && (!adapter || adapter.backend === backend));
    let disposed = false;
    function valid(input) { if (disposed) I.contract(); const r = I.validate(input); I.check(r.authority.backend === backend && taskService.capabilities().backend === backend); return r; }
    return Object.freeze({
        async capabilities(input) { const r = valid(input); return backend === "legacy-markdown" ? freeze({ version: 1, state: "legacy-only", code: "LEGACY_AUTHORITY_SELECTED" }) : adapter ? adapter.capabilities(r) : freeze({ version: 1, state: "authority-unavailable", code: "MUTATION_PORT_MISSING" }); },
        async mutate(input, signal) { const r = valid(input); return backend === "legacy-markdown" || !adapter ? freeze({ version: 1, privacy: "local-private", operationId: r.operationId, authority: r.authority, status: "unsupported", code: backend === "legacy-markdown" ? "LEGACY_AUTHORITY_SELECTED" : "MUTATION_PORT_MISSING", attempt: "not-started", priorOutcome: "not-checked" }) : adapter.mutate(r, signal); },
        dispose() { if (disposed) return; disposed = true; adapter?.dispose(); }
    });
}
module.exports = Object.freeze({ createApplicationMutationService });
