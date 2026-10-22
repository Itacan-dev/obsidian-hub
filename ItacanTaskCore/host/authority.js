"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os");
const { NodeDirectory } = require("../src/node-directory"), V = require("../src/value");
const codec = require("../src/private-storage-codec"), { inspectJsonRepository } = require("../src/json-repository");
const { check, fail } = require("../src/errors");
const { freeze } = require("../src/snapshot-read");
const admissions = new Map();
// Only admit() can enroll a physical port. Public properties/flags cannot forge it.
const privateCreations = new WeakMap();
const within = (parent, child) => { const r = path.relative(parent, child); return r !== "" && r !== ".." && !r.startsWith(".." + path.sep) && !path.isAbsolute(r); };
function validateConfig(input) {
    const fields = ["version", "scope", "storageFormat", "authorityId", "directory", "applicationContextId", "registryId", ...(input?.scope === "device-private-project" ? ["binding"] : [])];
    V.jsonValue(input); V.fields(input, fields, fields);
    check(input.version === 1 && ["inactive-disposable", "device-private-project"].includes(input.scope) && input.storageFormat === "private-v4", "Explicit private host required.");
    V.uuid(input.authorityId); V.text(input.applicationContextId); V.text(input.registryId);
    check(typeof input.directory === "string" && path.isAbsolute(input.directory) && !input.directory.startsWith("\\\\"), "Explicit local absolute root required.");
    return V.clone(input);
}
async function rootIdentity(directory) {
    const stat = await fs.lstat(directory, { bigint: true });
    check(stat.isDirectory() && !stat.isSymbolicLink(), "Existing ordinary root required.");
    check(stat.ino !== 0n, "Stable filesystem identity required.");
    return { real: await fs.realpath(directory), dev: String(stat.dev), ino: String(stat.ino) };
}
async function pinRoot(directory, config = null) {
    const pin = await rootIdentity(directory), real = pin.real, temporary = await fs.realpath(os.tmpdir());
    if (config?.scope === "device-private-project") await require("./private-authority").validateBinding(config.binding, directory);
    else check(within(temporary, real) && !within(process.cwd(), real) && real !== path.resolve(process.cwd()), "Only isolated OS Temp children are admitted.");
    for (const value of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) check(!within(path.resolve(value), real) && path.resolve(value) !== real, "Cloud root is not admitted.");
    return pin;
}
async function admit(config, creating = false) {
    const pin = await pinRoot(config.directory, config), previous = admissions.get(config.authorityId);
    if (previous && (previous.dev !== pin.dev || previous.ino !== pin.ino)) fail("STORAGE_AUTHORITY_MISMATCH", "Authority already names another physical root.");
    const port = new PinnedDirectory(config.directory, pin, config);
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
    if (creating && config.scope === "device-private-project") privateCreations.set(port, { config: V.clone(config), pin: { ...pin } });
    admissions.set(config.authorityId, pin); return port;
}
async function assertPrivateAtomicCreation(port, options) {
    const admitted = privateCreations.get(port); if (!admitted) return false;
    const { config, pin } = admitted;
    check(options.storageFormat === "private-v4" && options.taskMutationVersion === 1 && options.storeId === config.authorityId && (options.expectedAuthorityId === undefined || options.expectedAuthorityId === config.authorityId), "Atomic authority differs from admission.");
    check(path.resolve(options.directory) === path.resolve(config.directory) && path.resolve(port.directory) === path.resolve(config.directory), "Atomic directory differs from admission.");
    const partitions = options.partitions;
    check(Array.isArray(partitions) && partitions.length === 1 && partitions[0].id === "private" && partitions[0].kind === require("./private-authority").bindingKind(config.binding) && V.canonical(partitions[0].owner) === V.canonical(require("./private-authority").bindingOwner(config.binding)), "Atomic owner differs from admission.");
    const now = await pinRoot(config.directory, config);
    check(now.real === pin.real && now.dev === pin.dev && now.ino === pin.ino, "Atomic root identity changed.");
    return true;
}
class PinnedDirectory extends NodeDirectory {
    constructor(directory, pin, config = null) { super(directory); this.pin = pin; this.admissionConfig = config; }
    async assertRoot() {
        // The permanent location is validated at admission. Every consumer cut,
        // writer admission and publication also revalidates activation/context.
        // Individual IO retains the physical root checks, without rereading the
        // application registry for every generation-file access.
        const next = this.admissionConfig?.scope === "device-private-project" ? await rootIdentity(this.directory) : await pinRoot(this.directory);
        if (next.dev !== this.pin.dev || next.ino !== this.pin.ino || next.real !== this.pin.real) fail("ROOT_IDENTITY_CHANGED", "Admitted root identity changed.");
    }
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
module.exports = { validateConfig, admit, inspectNativeRepository, PinnedDirectory, pinRoot, assertPrivateAtomicCreation };
