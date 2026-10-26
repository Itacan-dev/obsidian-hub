"use strict";
// A terminal non-execution proof, never a task receipt or replay permission.
const V = require("../src/value"), G = require("../src/git-shared"), P = require("../writer/policy");
const { check } = require("../src/errors"), { registryDigest } = require("./registry");
async function prove({ config, record, observation, packet, writerPolicy }) {
    check(config.scope === "device-private-git-project" && record.format === "itacan-native-shared-request" && record.version === 2 && record.intent.kind === "git-receive", "Only a bound bootstrap receive can be concluded.");
    const r = record.writerRequest, original = V.clone(observation.registry);
    check(original.owners.length === 1 && original.owners[0].locations.length > 0 && observation.identityPin === null && r.scope.identityPin === null, "Bootstrap identity/catalog unavailable.");
    original.owners[0].locations = []; original.digest = registryDigest(original);
    check(original.digest === r.scope.ownerContextPin && r.command.expectedRepositoryRevision === 0 && r.scope.partitions.length === 1 && r.scope.partitions[0].expectedRevision === 0 && P.same(r.scope.partitions[0].owner, original.owners[0].owner) && r.scope.partitions[0].id === original.owners[0].partitionId, "Original bootstrap guards differ.");
    check(r.scope.inventoryPin === P.hash(writerPolicy.inventory) && r.scope.phasePin === P.hash(writerPolicy.phases), "Original reservation/Phase guards differ.");
    check(packet.head === null && packet.frames.length === 0 && packet.genesis.authorityId === config.authorityId && packet.genesis.partition.id === record.partitionId && P.same(packet.genesis.partition.owner, record.owner), "Intact original genesis required.");
    check(r.command.payload.authorityId === config.authorityId && r.command.payload.projectId === record.owner.id && r.command.payload.partitionId === record.partitionId && r.command.payload.packetDigest === G.hash(record.intent.prepared.packet), "Original packet binding differs.");
    const incoming = await require("../src/serialization").deserializeSharedPacketV3(V.canonical(record.intent.prepared.packet), packet.genesis);
    const { accepted, taskHeads, conflicts, ...native } = G.graph(G.namespace(packet)).current;
    const prior = { ...native, gitShared: G.namespace(packet) };
    let rejected = false;
    try { await G.applyReceive(V.clone(prior), r.command, { sharedPacket: incoming, resolvers: { location: () => null, phase: () => null } }); }
    catch (e) { if (e.code !== "VALIDATION" || e.message !== "Location is missing or belongs to another workspace.") throw e; rejected = true; }
    check(rejected, "Original receive is not the empty-catalog defect.");
    const candidate = V.clone(prior), owner = observation.registry.owners[0];
    await G.applyReceive(candidate, r.command, { sharedPacket: incoming, resolvers: { location: ref => owner.locations.some(l => P.same(l, ref)) ? { ...ref, owner: owner.owner } : null, phase: () => null } });
    P.candidate(r, candidate, prior, writerPolicy.inventory);
    return { version: 1, kind: "bootstrap-empty-location-catalog", code: "REJECTED_BEFORE_COMMIT", genesis: V.clone(packet.genesis), originalOwnerContextPin: r.scope.ownerContextPin, reviewedOwnerContextPin: observation.ownerContextPin, inventoryPin: r.scope.inventoryPin, phasePin: r.scope.phasePin };
}
module.exports = { prove };
