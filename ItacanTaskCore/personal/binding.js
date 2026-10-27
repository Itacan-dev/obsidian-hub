"use strict";
const V = require("../src/value"), M = require("./membership"), { check } = require("../src/errors");
const collaborative = new Set(["4b597e3b-b588-4a29-969b-70db3a684112", "9325047c-eb3d-43e7-92f2-a9bf630afe13"]);
function validate(value) {
    if(value?.version===2)return require("./profile").validate(value);
    V.jsonValue(value); M.exact(value, ["format", "version", "spaceId", "root", "owners", "protocol"]);
    check(value.format === "itacan-personal-binding" && value.version === 1, "Personal binding version required."); V.uuid(value.spaceId);
    M.exact(value.root, ["replicaId", "publicKey"]); V.uuid(value.root.replicaId); M.publicKey(value.root.publicKey);
    check(V.canonical(value.protocol) === V.canonical({ packet: 1, frame: 1, enrollment: 1, membership: 1, retention: 3, capability: "personal-sync-proofs-v1" }), "Unsupported personal capabilities.");
    check(Array.isArray(value.owners) && value.owners.length > 0 && value.owners.length <= 64, "Explicit personal owners required.");
    const owners = new Set(), authorities = new Set(), roots = [];
    for (const o of value.owners) {
        M.exact(o, ["owner", "authorityId", "partitionId", "kind", "root", "dashboard", "seedDigest"]);
        require("../src/domain").workspace(o.owner); V.uuid(o.authorityId); V.referenceId(o.partitionId);
        check(!collaborative.has(o.owner.id) && o.partitionId === "private" && o.kind === (o.owner.type === "resource" ? "resource" : "private-project"), "Personal partition differs.");
        check(!owners.has(V.canonical(o.owner)) && !authorities.has(o.authorityId), "Duplicate personal authority/owner.");
        owners.add(V.canonical(o.owner)); authorities.add(o.authorityId);
        for (const p of [o.root, o.dashboard]) check(typeof p === "string" && p.length > 0 && !p.includes("\\") && !p.startsWith("/") && !/^[a-z]:/i.test(p) && p.split("/").every(x => x && x !== "." && x !== ".."), "Portable personal root required.");
        check(o.dashboard.startsWith(o.root + "/") && /^[a-f0-9]{64}$/.test(o.seedDigest), "Personal source/seed binding differs.");
        check(!roots.some(r => r === o.root || r.startsWith(o.root + "/") || o.root.startsWith(r + "/")), "Overlapping physical personal owners."); roots.push(o.root);
    }
    return V.clone(value);
}
function fingerprint(binding) { return M.hash(validate(binding)); }
function confirm(binding, expectedFingerprint) {
    check(typeof expectedFingerprint === "string" && fingerprint(binding) === expectedFingerprint, "Personal pairing fingerprint differs.");
    return Object.freeze({ version: binding.version, spaceId: (binding.base??binding).spaceId, bindingDigest: expectedFingerprint, ...(binding.version===2?{profileDigest:binding.profile.digest}:{}) });
}
module.exports = { validate, fingerprint, confirm };
