"use strict";
// Personal identities only. Keys never enter a packet, seed or membership record.
const crypto = require("node:crypto"), V = require("../src/value"), { check } = require("../src/errors");
const hash = value => crypto.createHash("sha256").update(V.canonical(value)).digest("hex");
const exact = (v, fields) => V.fields(v, fields, fields);
const text = v => Buffer.from(V.canonical(v), "utf8");
function publicKey(value) {
    check(typeof value === "string", "Personal public key required.");
    const key = crypto.createPublicKey({ key: Buffer.from(value, "base64"), type: "spki", format: "der" });
    check(key.asymmetricKeyType === "ed25519" && key.export({ type: "spki", format: "der" }).toString("base64") === value, "Canonical Ed25519 key required.");
    return key;
}
function identity(replicaId = crypto.randomUUID()) {
    V.uuid(replicaId); const pair = crypto.generateKeyPairSync("ed25519");
    return { replicaId, publicKey: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64"),
        sign: value => crypto.sign(null, text(value), pair.privateKey).toString("base64"),
        exportPrivate: () => pair.privateKey.export({ type: "pkcs8", format: "der" }) };
}
function restore(replicaId, privateBytes) {
    V.uuid(replicaId); const key = crypto.createPrivateKey({ key: privateBytes, type: "pkcs8", format: "der" });
    check(key.asymmetricKeyType === "ed25519", "Personal key type differs.");
    return { replicaId, publicKey: crypto.createPublicKey(key).export({ type: "spki", format: "der" }).toString("base64"), sign: v => crypto.sign(null, text(v), key).toString("base64") };
}
function verify(key, value, signature) {
    check(typeof signature === "string" && Buffer.from(signature, "base64").length === 64 && Buffer.from(signature, "base64").toString("base64") === signature && crypto.verify(null, text(value), publicKey(key), Buffer.from(signature, "base64")), "Personal signature differs.");
}
function seal(body, signer) { V.jsonValue(body); const digest = hash(body); return { body: V.clone(body), digest, signer: signer.replicaId, signature: signer.sign(["itacan-personal-signature-v1", digest]) }; }
function open(record, key, replicaId) {
    V.jsonValue(record); exact(record, ["body", "digest", "signer", "signature"]); V.uuid(record.signer);
    check(record.digest === hash(record.body) && record.signer === replicaId, "Personal signed identity differs.");
    verify(key, ["itacan-personal-signature-v1", record.digest], record.signature); return V.clone(record.body);
}
function certify(binding, signer, member, parent = null) {
    binding=binding.version===2?binding.base:binding;
    return seal({ format: "itacan-personal-member", version: 1, spaceId: binding.spaceId, bindingDigest: hash(binding), parent,
        replicaId: member.replicaId, publicKey: member.publicKey }, signer);
}
function members(binding, records) {
    binding=binding.version===2?binding.base:binding;
    check(Array.isArray(records) && records.length <= 32, "Bounded personal membership required.");
    publicKey(binding.root.publicKey); V.uuid(binding.root.replicaId);
    const result = new Map([[binding.root.replicaId, binding.root.publicKey]]), pending = new Map();
    for (const r of records) { check(!pending.has(r.digest), "Duplicate member certificate."); pending.set(r.digest, r); }
    const accepted = new Set();
    while (pending.size) {
        let progress = false;
        for (const [id, r] of pending) {
            if (!result.has(r.signer) || r.body.parent !== null && !accepted.has(r.body.parent)) continue;
            const b = open(r, result.get(r.signer), r.signer);
            exact(b, ["format", "version", "spaceId", "bindingDigest", "parent", "replicaId", "publicKey"]);
            check(b.format === "itacan-personal-member" && b.version === 1 && b.spaceId === binding.spaceId && b.bindingDigest === hash(binding), "Foreign membership.");
            if (b.parent === null) check(r.signer === binding.root.replicaId, "Non-root membership requires its issuer certificate.");
            else check(records.find(x => x.digest === b.parent)?.body.replicaId === r.signer, "Membership parent is not the issuer.");
            V.uuid(b.replicaId); publicKey(b.publicKey);
            check(!result.has(b.replicaId) || result.get(b.replicaId) === b.publicKey, "Replica key equivocation.");
            result.set(b.replicaId, b.publicKey); accepted.add(id); pending.delete(id); progress = true;
        }
        check(progress, "Untrusted or cyclic personal membership.");
    }
    check(new Set(result.values()).size === result.size, "Replica keys must be distinct."); return result;
}
module.exports = { hash, exact, publicKey, identity, restore, verify, seal, open, certify, members };
