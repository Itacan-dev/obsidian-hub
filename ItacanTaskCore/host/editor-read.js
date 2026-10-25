"use strict";
const V = require("../src/value"), D = require("../src/domain"), P = require("../writer/policy"), { freeze } = require("../src/snapshot-read"), { check } = require("../src/errors");
function createNativeEditorReadPort(host, options) {
    const policy = P.policy(options.writerPolicy);
    const inventoryPin = P.hash(policy.inventory), phasePin = P.hash(policy.phases);
    return Object.freeze({ async read(input, signal) {
        V.jsonValue(input); V.fields(input, ["version", "authorityId", "owner", "partitionId", "taskId"], ["version", "authorityId", "owner", "partitionId", "taskId"]);
        check(input.version === 1, "Unsupported editor request."); V.uuid(input.authorityId); V.uuid(input.taskId); D.workspace(input.owner); V.referenceId(input.partitionId);
        const r = V.clone(input);
        const fail = code => freeze({ version: 1, state: "unavailable", code });
        if (host.info().authorityId !== r.authorityId) return fail("AUTHORITY_MISMATCH");
        if (!policy.owners.some(p => p.partitionId === r.partitionId && P.same(p.owner, r.owner))) return fail("OWNER_MISMATCH");
        const result = await host.readScoped({ version: 2, authorityId: r.authorityId, selection: "editor", ...(options.allowUnavailableLocations === true ? { locationEvidence: "report-unavailable" } : {}), owners: [r.owner], targets: [{ taskId: r.taskId, owner: r.owner, partitionId: r.partitionId }] }, signal);
        if (result.status !== "ok") return freeze({ version: 1, state: result.state, code: result.code, retry: result.retry });
        const info = result.info;
        if (info.readiness.state !== "ready") return fail("AUTHORITY_NOT_READY");
        if (result.snapshot.editor.state !== "available") return freeze({ ...result.snapshot.editor });
        const e = result.snapshot.editor;
        if (e.draft.metadata.phase && !policy.phases.values.some(p => P.same(p, e.draft.metadata.phase))) return fail("PHASE_CONTEXT_UNAVAILABLE");
        return freeze({ version: 1, status: "ok", privacy: "local-private", stamp: result.stamp, editor: { ...e, ...(options.allowUnavailableLocations === true ? { locationUnavailable: result.locationFacts?.some(f => f.taskId === r.taskId && f.state === "unavailable") === true } : {}),
            authority: { backend: "native", authorityId: r.authorityId, applicationContextId: info.applicationContextId },
            guard: { expectedRepositoryRevision: result.stamp.head.repositoryRevision, ownerContextPin: result.stamp.ownerContextPin, identityPin: result.stamp.identityPin, inventoryPin, phasePin, partitions: [{ id: e.partitionId, owner: e.owner, expectedRevision: e.expectedPartitionRevision }] } } });
    } });
}
module.exports = { createNativeEditorReadPort };
