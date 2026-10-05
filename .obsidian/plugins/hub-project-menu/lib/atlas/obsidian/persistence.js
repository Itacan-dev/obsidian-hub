"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID, createHash } = require("crypto");
const { validateAtlasSnapshot, migrateAtlasSnapshotV1 } = require("../core/index");

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
    }
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
        if (this.locked) return true;
        this.io.mkdirSync(this.directory, { recursive: true });
        const lock = { machine: os.hostname(), pid: process.pid, id: this.lockId };
        try { this.flushFile("owner.lock", JSON.stringify(lock)); }
        catch (error) {
            if (error.code !== "EEXIST") throw error;
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
                    this.issue = "STORAGE_LOCKED"; return false;
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
            throw new Error("Atlas owner lost");
        }
    }
    envelope(text) {
        const data = JSON.parse(text);
        if (!exact(data, ["schemaVersion", "storageVersion", "lastCommitId", "snapshot"]) ||
            ![1, 2].includes(data.schemaVersion) || !token(data.storageVersion) ||
            !(data.lastCommitId === null || token(data.lastCommitId))) throw new Error("Invalid Atlas envelope");
        if (data.schemaVersion === 2) {
            const validated = validateAtlasSnapshot(data.snapshot);
            if (!validated.ok) throw new Error("Invalid Atlas snapshot");
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
            throw new Error("Invalid Atlas journal");
        }
        return data;
    }
    /** @returns {import('../core/index').AtlasCommitResolution} */
    settled(journal) {
        this.assertOwner();
        const text = this.read("authority.json");
        if (text === null) return { type: "UNKNOWN", commitId: journal.commitId };
        const value = this.envelope(text), hash = digest(text);
        if (hash === journal.afterHash && value.lastCommitId === journal.commitId &&
            value.storageVersion === journal.storageVersion) {
            return { type: "COMMITTED", commitId: journal.commitId, storageVersion: value.storageVersion };
        }
        if (hash === journal.beforeHash) return { type: "NOT_WRITTEN", commitId: journal.commitId };
        return { type: "UNKNOWN", commitId: journal.commitId };
    }
    clearJournal() {
        if (this.read("pending.json") !== null) this.io.unlinkSync(this.file("pending.json"));
        this.flushDirectory(); this.pending = null;
    }
    /** @returns {Promise<import('../core/index').AtlasLoadResult>} */
    async load() {
        try {
            if (!this.acquire()) return { type: "UNAVAILABLE" };
            this.assertOwner();
            const journal = this.journal();
            if (journal !== null) { this.pending = journal; return { type: "UNRESOLVED", commitId: journal.commitId }; }
            const text = this.read("authority.json");
            if (text === null) {
                return this.read("initialized") === null ? { type: "UNINITIALIZED" }
                    : { type: "READY", envelope: null }; // Core reports corruption; never setup.
            }
            if (this.read("initialized") === null) return { type: "READY", envelope: null };
            let value = this.envelope(text);
            // Core retains revision/time guards. Also reject any unexpected disk
            // edit in this repository lifetime, even if a writer forges a version.
            if (this.lastBytes !== null && text !== this.lastBytes) {
                this.issue = "EXTERNAL_WRITE"; return { type: "UNAVAILABLE" };
            }
            if (value.schemaVersion === 1) {
                const converted = migrateAtlasSnapshotV1(value.snapshot, this.configuration);
                if (!converted.ok) return { type: "READY", envelope: null };
                const next = { schemaVersion: 2, snapshot: converted.snapshot };
                this.lastBytes = text;
                const receipt = await this.replace(value.storageVersion, `migration:${randomUUID()}`, next);
                if (receipt.type !== "COMMITTED") return { type: "UNAVAILABLE" };
                value = this.envelope(this.lastBytes);
            }
            this.lastBytes = this.read("authority.json");
            return { type: "READY", envelope: value };
        } catch (_) { this.issue = "STORAGE_UNAVAILABLE"; return { type: "UNAVAILABLE" }; }
    }
    async initialize(snapshot) {
        const validated = validateAtlasSnapshot(snapshot);
        if (!validated.ok) return false;
        const loaded = await this.load();
        if (loaded.type !== "UNINITIALIZED") return false;
        try {
            this.assertOwner();
            // The durable sentinel precedes the first authority write. Interrupted
            // setup is unavailable, rather than being mistaken for fresh setup.
            this.flushFile("initialized", "Atlas schema 2\n");
            this.flushDirectory();
            const value = { schemaVersion: 2, storageVersion: randomUUID(), lastCommitId: null, snapshot: validated.snapshot };
            const bytes = JSON.stringify(value);
            const temporary = `.authority-${randomUUID()}.tmp`;
            this.flushFile(temporary, bytes);
            this.io.renameSync(this.file(temporary), this.file("authority.json"));
            this.flushDirectory();
            this.lastBytes = bytes;
            return true;
        } catch (_) { this.issue = "INITIALIZATION_FAILED"; return false; }
    }
    /** @returns {Promise<import('../core/index').AtlasCommitResult>} */
    async replace(expectedStorageVersion, commitId, next) {
        /** @param {'UNKNOWN' | 'CONFLICT' | 'NOT_WRITTEN'} type */
        const receipt = type => ({ type, commitId });
        try {
            this.assertOwner();
            if (this.journal() !== null) return receipt("UNKNOWN");
            const before = this.read("authority.json"), current = this.envelope(before);
            if (current.storageVersion !== expectedStorageVersion || before !== this.lastBytes) return receipt("CONFLICT");
            const validated = validateAtlasSnapshot(next.snapshot);
            if (next.schemaVersion !== 2 || !validated.ok || !token(commitId)) return receipt("NOT_WRITTEN");
            const storageVersion = randomUUID();
            const after = JSON.stringify({ schemaVersion: 2, storageVersion, lastCommitId: commitId, snapshot: validated.snapshot });
            const journal = { commitId, beforeHash: digest(before), afterHash: digest(after), storageVersion };
            const temporary = `.authority-${randomUUID()}.tmp`;
            this.flushFile(temporary, after);
            this.flushFile("pending.json", JSON.stringify(journal));
            this.pending = journal; this.flushDirectory();
            this.assertOwner();
            if (this.read("authority.json") !== before) return receipt("UNKNOWN");
            this.io.renameSync(this.file(temporary), this.file("authority.json"));
            this.flushDirectory();
            const result = this.settled(journal);
            if (result.type !== "COMMITTED") return receipt("UNKNOWN");
            this.lastBytes = after;
            this.clearJournal();
            this.issue = null;
            return result;
        } catch (_) {
            // A journal keeps acknowledgement-loss conservative. No automatic
            // rollback or confirmation retry occurs, even after an applied write.
            try {
                if (this.pending || this.journal()) return receipt("UNKNOWN");
                this.assertOwner();
                if (this.read("authority.json") === this.lastBytes) return receipt("NOT_WRITTEN");
            } catch (_) { /* unavailable storage proves no outcome */ }
            return receipt("UNKNOWN");
        }
    }
    /** @param {import('../core/index').AtlasCommitRequest} request */
    commit(request) { return this.replace(request.expectedStorageVersion, request.commitId, request.next); }
    /** @returns {Promise<import('../core/index').AtlasCommitResolution>} */
    async resolveCommit(commitId) {
        try {
            this.assertOwner();
            const journal = this.journal() ?? this.pending;
            if (!journal || journal.commitId !== commitId) return { type: "UNKNOWN", commitId };
            const result = this.settled(journal);
            if (result.type !== "UNKNOWN") {
                this.lastBytes = this.read("authority.json");
                this.clearJournal();
            }
            return result;
        } catch (_) { return { type: "UNKNOWN", commitId }; }
    }
    close() {
        if (!this.locked) return;
        try { this.assertOwner(); this.io.unlinkSync(this.file("owner.lock")); }
        finally { this.locked = false; }
    }
}

module.exports = { AtlasFileRepository };
