"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const { NodeDirectory } = require("../src/node-directory"), V = require("../src/value");
const codec = require("../src/private-storage-codec"), { inspectJsonRepository } = require("../src/json-repository");
const { check, fail } = require("../src/errors");
const { freeze } = require("../src/snapshot-read");
const admissions = new Map();
const within = (parent, child) => { const r = path.relative(parent, child); return r !== "" && r !== ".." && !r.startsWith(".." + path.sep) && !path.isAbsolute(r); };
function validateConfig(input) {
    V.jsonValue(input); V.fields(input, ["version", "scope", "storageFormat", "authorityId", "directory", "applicationContextId", "registryId"], ["version", "scope", "storageFormat", "authorityId", "directory", "applicationContextId", "registryId"]);
    check(input.version === 1 && input.scope === "inactive-disposable" && input.storageFormat === "private-v4", "Explicit inactive private host required.");
    V.uuid(input.authorityId); V.text(input.applicationContextId); V.text(input.registryId);
    check(typeof input.directory === "string" && path.isAbsolute(input.directory) && !input.directory.startsWith("\\\\"), "Explicit local absolute root required.");
    return V.clone(input);
}
async function pinRoot(directory) {
    const stat = await fs.lstat(directory, { bigint: true });
    check(stat.isDirectory() && !stat.isSymbolicLink(), "Existing ordinary root required.");
    check(stat.ino !== 0n, "Stable filesystem identity required.");
    const real = await fs.realpath(directory), temporary = await fs.realpath(os.tmpdir());
    check(within(temporary, real) && !within(process.cwd(), real) && real !== path.resolve(process.cwd()), "Only isolated OS Temp children are admitted.");
    for (const value of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) check(!within(path.resolve(value), real) && path.resolve(value) !== real, "Cloud root is not admitted.");
    return { real, dev: String(stat.dev), ino: String(stat.ino) };
}
async function admit(config, creating = false) {
    const pin = await pinRoot(config.directory), previous = admissions.get(config.authorityId);
    if (previous && (previous.dev !== pin.dev || previous.ino !== pin.ino)) fail("STORAGE_AUTHORITY_MISMATCH", "Authority already names another physical root.");
    const port = new PinnedDirectory(config.directory, pin);
    if (creating) check((await port.list()).length === 0, "Creation requires a verified empty directory.");
    else {
        // Header preflight only. Full generation/ancestry validation remains under the core lease.
        const names = await port.list();
        for (const name of ["CURRENT.json", "RECOVERY.json"]) if (names.includes(name)) {
            try { codec.decodePrivateManifest(await port.read(name), config.authorityId); }
            catch (error) { if (!["INTEGRITY", "VALIDATION"].includes(error.code)) throw error; }
        }
        check(names.some(n => ["CURRENT.json", "RECOVERY.json"].includes(n)), "Existing repository evidence required.");
    }
    admissions.set(config.authorityId, pin); return port;
}
class PinnedDirectory extends NodeDirectory {
    constructor(directory, pin) { super(directory); this.pin = pin; }
    async assertRoot() { const next = await pinRoot(this.directory); if (next.dev !== this.pin.dev || next.ino !== this.pin.ino || next.real !== this.pin.real) fail("ROOT_IDENTITY_CHANGED", "Admitted root identity changed."); }
}
for (const name of ["list", "read", "writeNew", "publish", "replace", "remove", "syncDirectory", "acquire", "assertWriter", "release"]) {
    PinnedDirectory.prototype[name] = async function (...args) { await this.assertRoot(); const result = await NodeDirectory.prototype[name].apply(this, args); await this.assertRoot(); return result; };
}
async function inspectNativeRepository(input) {
    V.fields(input, ["version", "directory", "expectedAuthorityId", "sourceFormat"], ["version", "directory", "expectedAuthorityId", "sourceFormat"]);
    check(input.version === 1, "Unsupported diagnostic contract."); V.uuid(input.expectedAuthorityId);
    const pin = await pinRoot(input.directory), port = new PinnedDirectory(input.directory, pin), names = await port.list();
    if (names.includes("WRITER.lock")) fail("LOCK_HELD", "Inspection requires a closed root.");
    if (input.sourceFormat === "stopped-e2-flat-v1") {
        const evidence = await inspectJsonRepository(input.sourceFormat && { directory: input.directory, expectedAuthorityId: input.expectedAuthorityId, sourceFormat: input.sourceFormat });
        await port.assertRoot();
        return freeze({ version: 1, authority: "diagnostic", writable: false, authoritative: false, sourceFormat: input.sourceFormat, authorityId: input.expectedAuthorityId, codes: evidence.diagnostics.map(() => "FORENSIC_INTEGRITY"), validatedHeader: evidence.snapshot !== null });
    }
    check(input.sourceFormat === "private-v4", "Explicit diagnostic format required.");
    const before = {}, codes = [];
    for (const name of ["CURRENT.json", "RECOVERY.json"]) if (names.includes(name)) { before[name] = await port.read(name); codec.decodePrivateManifest(before[name], input.expectedAuthorityId); }
    check(Object.keys(before).length > 0, "No private pointer evidence.");
    for (const [name, raw] of Object.entries(before)) if (await port.read(name) !== raw) fail("SNAPSHOT_UNSTABLE", "Diagnostic observation changed.");
    if ((await port.list()).includes("WRITER.lock")) fail("LOCK_HELD", "Inspection raced an open.");
    return freeze({ version: 1, authority: "diagnostic", writable: false, authoritative: false, sourceFormat: "private-v4", authorityId: input.expectedAuthorityId, codes, validatedHeader: true });
}
module.exports = { validateConfig, admit, inspectNativeRepository, PinnedDirectory, pinRoot };
