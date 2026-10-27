"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID, createHash } = require("crypto");
const { validateAtlasSnapshot, migrateAtlasSnapshotV1 } = require("../core/index");
const { initialApplication, validateApplication, transitionApplication, validateDestinations } = require("./application");

const { coded, createStorageDiagnostics } = require("./storage-diagnostics");
const { createOwnershipRepair } = require("./ownership-recovery");
const digest = text => createHash("sha256").update(text).digest("hex");
const token = value => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,256}$/.test(value);
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// All filesystem mutations finish synchronously IN THE MAIN PROCESS. A failed
// acknowledgement cannot leave a deferred write that later applies on recovery.
/** @typedef {import('../core/index').AtlasRepository} AtlasRepository */
/** @implements {AtlasRepository} */
class AtlasFileRepository {
    /** @param {string} directory
     * @param {{io?: typeof fs, configuration?: import('../core/index').AtlasConfiguration}} options */
    constructor(directory, { io = fs, configuration } = {}) {
        this.directory = path.resolve(directory);
        this.io = io;
        this.configuration = configuration;
        this.lockId = randomUUID();
        this.locked = false;
        this.issue = null;
        this.lastBytes = null;
        this.pending = null;
        this.diagnostics = createStorageDiagnostics();
        this.ownershipRepair = createOwnershipRepair(this);
    }
    getDiagnostics() { return this.diagnostics.view(); }
    reviewOwnershipRepair() { return this.ownershipRepair.preview(); }
    repairOwnership(input) { return this.ownershipRepair.repair(input); }
    file(name) { return path.join(this.directory, name); }
    read(name) {
        try { return this.io.readFileSync(this.file(name), "utf8"); }
        catch (error) { if (error.code === "ENOENT") return null; throw error; }
    }
    flushFile(name, contents, flags = "wx") {
        const fd = this.io.openSync(this.file(name), flags, 0o600);
        try { this.io.writeFileSync(fd, contents, "utf8"); this.io.fsyncSync(fd); }
        finally { this.io.closeSync(fd); }
    }
    flushDirectory() {
        // Windows does not support Node directory fsync. File flush precedes
        // same-volume atomic rename; do not claim physical power-loss durability.
        if (process.platform === "win32") return;
        const fd = this.io.openSync(this.directory, "r");
        try { this.io.fsyncSync(fd); } finally { this.io.closeSync(fd); }
    }
    acquire() {
        if (!this.ownershipRepair.completeCleanup()) return false;
        if (this.locked) return true;
        this.io.mkdirSync(this.directory, { recursive: true });
        const lock = { machine: os.hostname(), pid: process.pid, id: this.lockId };
        try { this.flushFile("owner.lock", JSON.stringify(lock)); }
        catch (error) {
            if (error.code !== "EEXIST") throw error;
            const own = JSON.stringify({ machine: os.hostname(), pid: process.pid, id: this.lockId });
            if (this.read("owner.lock") === own) {
                // Complete an interrupted acknowledgement of THIS instance's
                // own lock. Never adopt or remove a different owner.
                const fd = this.io.openSync(this.file("owner.lock"), "r+");
                try { this.io.fsyncSync(fd); } finally { this.io.closeSync(fd); }
                if (this.read("owner.lock") !== own) throw coded("ATLAS_OWNER_LOST");
                this.flushDirectory(); this.locked = true; return true;
            }
            // Serialize stale-owner reclamation too. Two new processes must
            // never both remove an owner that the other just established.
            try { this.flushFile("reclaim.lock", JSON.stringify(lock)); }
            catch (_) { this.issue = "STORAGE_LOCKED"; return false; }
            try {
                const priorText = this.read("owner.lock"), prior = JSON.parse(priorText);
                let dead = false;
                if (exact(prior, ["machine", "pid", "id"]) && prior.machine === lock.machine &&
                    Number.isSafeInteger(prior.pid) && prior.pid > 0 && token(prior.id)) {
                    try { process.kill(prior.pid, 0); }
                    catch (probe) { dead = probe.code === "ESRCH"; }
                }
                if (!dead || this.read("owner.lock") !== priorText) {
                    this.issue = exact(prior, ["machine", "pid", "id"]) && prior.machine !== lock.machine ? "FOREIGN_OWNER" : "STORAGE_LOCKED"; return false;
                }
                this.io.unlinkSync(this.file("owner.lock"));
                this.flushFile("owner.lock", JSON.stringify(lock));
            } finally { this.io.unlinkSync(this.file("reclaim.lock")); }
        }
        this.flushDirectory();
        this.locked = true;
        return true;
    }
    assertOwner() {
        const owner = JSON.parse(this.read("owner.lock"));
        if (!this.locked || owner?.id !== this.lockId || owner.pid !== process.pid || owner.machine !== os.hostname()) {
            throw coded("ATLAS_OWNER_LOST");
        }
    }
    envelope(text) {
        const data = JSON.parse(text);
        if (!(exact(data, ["schemaVersion", "storageVersion", "lastCommitId", "snapshot"]) ||
            exact(data, ["schemaVersion", "storageVersion", "lastCommitId", "snapshot", "application"])) ||
            ![1, 2].includes(data.schemaVersion) || !token(data.storageVersion) ||
            !(data.lastCommitId === null || token(data.lastCommitId))) throw coded("ATLAS_INVALID_DATA");
        if (data.schemaVersion === 2) {
            const validated = validateAtlasSnapshot(data.snapshot);
            if (!validated.ok) throw coded("ATLAS_INVALID_DATA");
            if (Object.hasOwn(data, "application") && !validateApplication(data.application, validated.snapshot)) throw coded("ATLAS_INVALID_DATA");
            return { ...data, snapshot: validated.snapshot };
        }
        return data;
    }
    journal() {
        const text = this.read("pending.json");
        if (text === null) return null;
        const data = JSON.parse(text);
        if (!exact(data, ["commitId", "beforeHash", "afterHash", "storageVersion"]) ||
            !token(data.commitId) || !token(data.storageVersion) ||
            !/^[a-f0-9]{64}$/.test(data.beforeHash) || !/^[a-f0-9]{64}$/.test(data.afterHash)) {
            throw coded("ATLAS_INVALID_DATA");
        }
        return data;
    }
    inspectSettlement(journal) {
        this.assertOwner();
        const bytes = this.read("authority.json");
        /** @type {{result: import("../core/index").AtlasCommitResolution, bytes: string | null, envelope: any}} */
        const unknown = { result: { type: "UNKNOWN", commitId: journal.commitId }, bytes: null, envelope: null };
        if (bytes === null) return unknown;
        const envelope = this.envelope(bytes), hash = digest(bytes);
        /** @type {import("../core/index").AtlasCommitResolution} */
        let result;
        if (hash === journal.afterHash && envelope.lastCommitId === journal.commitId && envelope.storageVersion === journal.storageVersion)
            result = { type: "COMMITTED", commitId: journal.commitId, storageVersion: envelope.storageVersion };
        else if (hash === journal.beforeHash) result = { type: "NOT_WRITTEN", commitId: journal.commitId };
        else { this.issue = "JOURNAL_AUTHORITY_MISMATCH"; return unknown; }
        return { result, bytes, envelope };
    }
    /** @returns {import("../core/index").AtlasCommitResolution} */
    settled(journal) { return this.inspectSettlement(journal).result; }
    clearJournal(expected = this.pending) {
        const current = this.journal();
        if (current !== null) {
            if (!expected || ["commitId", "beforeHash", "afterHash", "storageVersion"].some(k => current[k] !== expected[k])) throw coded("ATLAS_JOURNAL_CHANGED");
            this.io.unlinkSync(this.file("pending.json"));
        }
        this.flushDirectory(); this.pending = null;
    }
    /** @returns {Promise<import('../core/index').AtlasLoadResult>} */
    async load() {
        this.diagnostics.bump("loadAttempts"); let stage = "OWNER";
        try {
            if (!this.acquire()) return { type: "UNAVAILABLE" };
            this.assertOwner();
            stage = "JOURNAL_READ"; const journal = this.journal();
            if (journal !== null) { this.pending = journal; this.issue = "COMMIT_UNRESOLVED"; return { type: "UNRESOLVED", commitId: journal.commitId }; }
            stage = "AUTHORITY_READ"; let text = this.read("authority.json");
            if (text === null) {
                if (this.read("initialized") === null) { this.issue = null; return { type: "UNINITIALIZED" }; }
                return { type: "READY", envelope: null }; // Core reports corruption; never setup.
            }
            if (this.read("initialized") === null) return { type: "READY", envelope: null };
            stage = "VALIDATE"; let value = this.envelope(text);
            // Core retains revision/time guards. Also reject any unexpected disk
            // edit in this repository lifetime, even if a writer forges a version.
            if (this.lastBytes !== null && text !== this.lastBytes) {
                this.issue = "EXTERNAL_WRITE"; return { type: "UNAVAILABLE" };
            }
            if (value.schemaVersion === 1 || !Object.hasOwn(value, "application") || value.application.schemaVersion === 1) {
                const converted = value.schemaVersion === 1 ? migrateAtlasSnapshotV1(value.snapshot, this.configuration) : validateAtlasSnapshot(value.snapshot);
                if (!converted.ok) return { type: "READY", envelope: null };
                const next = { schemaVersion: 2, snapshot: converted.snapshot, application: value.application ? validateApplication(value.application, converted.snapshot) : initialApplication(converted.snapshot.policy) };
                this.lastBytes = text;
                stage = "MIGRATE"; this.diagnostics.bump("migrations"); const commitId = `migration:${randomUUID()}`;
                const receipt = await this.replace(value.storageVersion, commitId, next, "MIGRATE");
                if (receipt.type === "UNKNOWN") return { type: "UNRESOLVED", commitId };
                if (receipt.type !== "COMMITTED") return { type: "UNAVAILABLE" };
                text = this.lastBytes; value = this.envelope(text);
            }
            // Cache exactly the bytes we validated. A second read could hide
            // an external change and defeat the next write's CAS byte fence.
            this.lastBytes = text;
            // Core's closed envelope stays unchanged. Application data never
            // enters its schema or its permission-changing operations.
            const { application: _application, ...envelope } = value;
            this.issue = null; this.diagnostics.bump("verifiedLoads");
            return { type: "READY", envelope };
        } catch (error) { this.diagnostics.fail("LOAD", stage, error, "UNAVAILABLE"); this.issue = "STORAGE_UNAVAILABLE"; return { type: "UNAVAILABLE" }; }
    }
    async initialize(snapshot, application = initialApplication(snapshot.policy)) {
        this.diagnostics.bump("initializeAttempts");
        const validated = validateAtlasSnapshot(snapshot);
        if (!validated.ok || !validateApplication(application, validated.snapshot)) return false;
        const loaded = await this.load();
        if (loaded.type !== "UNINITIALIZED") return false;
        try {
            this.assertOwner();
            // The durable sentinel precedes the first authority write. Interrupted
            // setup is unavailable, rather than being mistaken for fresh setup.
            this.flushFile("initialized", "Atlas schema 2\n");
            this.flushDirectory();
            const value = { schemaVersion: 2, storageVersion: randomUUID(), lastCommitId: null, snapshot: validated.snapshot, application };
            const bytes = JSON.stringify(value);
            const temporary = `.authority-${randomUUID()}.tmp`;
            this.flushFile(temporary, bytes);
            this.io.renameSync(this.file(temporary), this.file("authority.json"));
            this.flushDirectory();
            this.lastBytes = bytes; this.diagnostics.bump("initialized");
            return true;
        } catch (error) { this.diagnostics.fail("INITIALIZE", "INITIAL_WRITE", error, "UNAVAILABLE"); this.issue = "INITIALIZATION_FAILED"; return false; }
    }
    /** @returns {Promise<import('../core/index').AtlasCommitResult>} */
    async replace(expectedStorageVersion, commitId, next, operation = "PRESENTATION") {
        this.diagnostics.bump("writeAttempts"); let stage = "OWNER", temporary = null;
        /** @param {'UNKNOWN' | 'CONFLICT' | 'NOT_WRITTEN'} type */
        const receipt = (type, error = null) => {
            this.diagnostics.bump("failedWrites"); this.diagnostics.bump(type === "NOT_WRITTEN" ? "notWrittenWrites" : type === "UNKNOWN" ? "unknownWrites" : "conflicts");
            this.diagnostics.fail(operation, stage, error, type); return { type, commitId };
        };
        try {
            this.assertOwner();
            if (this.journal() !== null) return receipt("UNKNOWN");
            stage = "AUTHORITY_READ"; const before = this.read("authority.json"), current = this.envelope(before);
            if (current.storageVersion !== expectedStorageVersion || before !== this.lastBytes) return receipt("CONFLICT", coded("ATLAS_EXTERNAL_WRITE"));
            stage = "VALIDATE"; const validated = validateAtlasSnapshot(next.snapshot);
            if (next.schemaVersion !== 2 || !validated.ok || !token(commitId)) return receipt("NOT_WRITTEN", coded("ATLAS_INVALID_DATA"));
            const storageVersion = randomUUID();
            const application = next.application ?? transitionApplication(current.application ?? initialApplication(current.snapshot.policy),
                current.snapshot, validated.snapshot, this.stagedApplication);
            if (!validateApplication(application, validated.snapshot)) return receipt("NOT_WRITTEN", coded("ATLAS_INVALID_DATA"));
            const after = JSON.stringify({ schemaVersion: 2, storageVersion, lastCommitId: commitId, snapshot: validated.snapshot, application });
            const journal = { commitId, beforeHash: digest(before), afterHash: digest(after), storageVersion };
            temporary = `.authority-${randomUUID()}.tmp`;
            stage = "CANDIDATE_WRITE"; this.flushFile(temporary, after);
            stage = "JOURNAL_WRITE"; this.flushFile("pending.json", JSON.stringify(journal));
            this.pending = journal; this.flushDirectory();
            this.assertOwner();
            if (this.read("authority.json") !== before) return receipt("UNKNOWN");
            stage = "RENAME"; this.io.renameSync(this.file(temporary), this.file("authority.json"));
            this.flushDirectory();
            stage = "VERIFY"; const result = this.settled(journal);
            if (result.type !== "COMMITTED") return receipt("UNKNOWN");
            this.previousEnvelope = current;
            this.lastBytes = after;
            stage = "CLEANUP"; this.clearJournal(journal);
            this.issue = null; this.diagnostics.bump("committedWrites");
            return result;
        } catch (error) {
            // A journal keeps acknowledgement-loss conservative. No automatic
            // rollback or confirmation retry occurs, even after an applied write.
            try {
                if (this.pending || this.journal()) return receipt("UNKNOWN", error);
                this.assertOwner();
                if (this.read("authority.json") === this.lastBytes) {
                    // Only this attempt's unjournaled candidate is disposable.
                    if (temporary) { try { this.io.unlinkSync(this.file(temporary)); } catch (cleanup) { if (cleanup.code !== "ENOENT") this.diagnostics.bump("cleanupFailures"); } }
                    return receipt("NOT_WRITTEN", error);
                }
            } catch (_) { /* unavailable storage proves no outcome */ }
            return receipt("UNKNOWN", error);
        }
    }
    /** @param {import('../core/index').AtlasCommitRequest} request */
    commit(request) { return this.replace(request.expectedStorageVersion, request.commitId, request.next, "COMMIT"); }
    application(storageVersion = undefined) {
        if (!this.lastBytes) return null;
        const envelope = this.envelope(this.lastBytes);
        if (storageVersion === undefined || envelope.storageVersion === storageVersion) return envelope.application ?? null;
        return this.previousEnvelope?.storageVersion === storageVersion ? this.previousEnvelope.application ?? null : null;
    }
    stageApplication(destinations) {
        const valid = validateDestinations(destinations);
        if (!valid) throw new Error("Invalid Atlas destination draft");
        this.stagedApplication = valid;
    }
    clearApplicationStage() { this.stagedApplication = null; }
    // Operational cache uses the same owner and atomic replacement, separately
    // from authority and the Core journal. Failed publication keeps prior data.
    loadManagedCache() { this.acquire(); this.assertOwner(); const text = this.read("managed-cache.json"); return text === null ? null : JSON.parse(text); }
    saveManagedCache(value) {
        try {
            this.assertOwner(); const name = `.managed-${randomUUID()}.tmp`;
            this.flushFile(name, JSON.stringify(value)); this.io.renameSync(this.file(name), this.file("managed-cache.json")); this.flushDirectory(); return true;
        } catch (_) { return false; }
    }
    /** @returns {Promise<import('../core/index').AtlasCommitResolution>} */
    async resolveCommit(commitId) {
        this.diagnostics.bump("resolveAttempts");
        try {
            this.assertOwner();
            const journal = this.journal() ?? this.pending;
            if (!journal || journal.commitId !== commitId) return { type: "UNKNOWN", commitId };
            const proof = this.inspectSettlement(journal), result = proof.result;
            if (result.type !== "UNKNOWN") {
                if (this.lastBytes) this.previousEnvelope = this.envelope(this.lastBytes);
                this.lastBytes = proof.bytes;
                this.clearJournal(journal); this.diagnostics.bump("resolvedCommits");
                this.issue = null;
            }
            return result;
        } catch (error) { this.diagnostics.fail("RESOLVE", "VERIFY_OR_CLEANUP", error, "UNKNOWN"); return { type: "UNKNOWN", commitId }; }
    }
    close() {
        if (!this.locked) return;
        try { this.assertOwner(); this.io.unlinkSync(this.file("owner.lock")); }
        finally { this.locked = false; }
    }
}

module.exports = { AtlasFileRepository };
