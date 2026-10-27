"use strict";
// An explicitly trusted, validated existing native checkpoint; not invented origin replay.
const V = require("../src/value"), M = require("./membership"), { check } = require("../src/errors");
const SOURCE = "private-native-storage-v1", ATOMIC = "atomic-task-mutations-v1";
function validateSource(state, capability) {
    require("../src/domain").validateState(state);
    check(state.schemaVersion === 1 && !state.gitShared && !state.personalShared && !state.recurrence && !state.historyImport && state.partitions.length === 1, "Only supported native private state may enroll.");
    const p = state.partitions[0];
    check(p.id === "private" && p.kind === (p.owner.type === "resource" ? "resource" : "private-project"), "Personal physical partition differs.");
    check(V.canonical(capability) === V.canonical({ storageFormat: "private-v4", barrierVersion: 2, logicalSchemaVersion: 1, requiredCapabilities: [SOURCE, ATOMIC] }), "Unsupported enrollment source capability.");
    check(state.receipts.every(r => ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"].includes(JSON.parse(r.payload).type)), "Unsupported historical private command.");
    // Exercise the authoritative event/receipt projection, including reopening and deleted targets.
    require("../src/history-read").projectHistory(state, { version: 4, authorityId: state.storeId, owners: [p.owner], selection: "history" }, { fenced: false, info: null });
    return state;
}
function prepare({ spaceId, state, capability, signer }) {
    V.uuid(spaceId); validateSource(state, capability);
    const body = { format: "itacan-personal-enrollment", version: 1, spaceId, authorityId: state.storeId, owner: V.clone(state.partitions[0].owner),
        partition: V.clone(state.partitions[0]), sourceCapability: V.clone(capability), sourceRevision: state.revision, sourceRevisionId: state.revisionId,
        state: V.clone(state) };
    return M.seal(body, signer);
}
function validate(seed, binding) {
    require("./binding").validate(binding); binding=require("./profile").base(binding);
    const b = M.open(seed, binding.root.publicKey, binding.root.replicaId);
    M.exact(b, ["format", "version", "spaceId", "authorityId", "owner", "partition", "sourceCapability", "sourceRevision", "sourceRevisionId", "state"]);
    const owner = binding.owners.find(o => o.authorityId === b.authorityId);
    check(b.format === "itacan-personal-enrollment" && b.version === 1 && b.spaceId === binding.spaceId && owner && owner.seedDigest === seed.digest && V.canonical(owner.owner) === V.canonical(b.owner), "Enrollment identity differs.");
    check(b.state.storeId === b.authorityId && b.state.revision === b.sourceRevision && b.state.revisionId === b.sourceRevisionId && V.canonical(b.partition) === V.canonical(b.state.partitions[0]) && b.partition.id === owner.partitionId && b.partition.kind === owner.kind && V.canonical(b.partition.owner) === V.canonical(b.owner), "Enrollment source head differs.");
    validateSource(b.state, b.sourceCapability); return b;
}
module.exports = { validateSource, prepare, validate };
