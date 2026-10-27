"use strict";
// Explicit recovery for an independent local copy or a stopped former owner.
// This is never called by ordinary RECOVER or automatic storage recovery.
const os = require("os"), path = require("path"), { randomUUID, createHash } = require("crypto");
const { validateAtlasSnapshot, migrateAtlasSnapshotV1 } = require("../core/index");
const { coded } = require("./storage-diagnostics");
const { validateApplication } = require("./application");
const names = ["owner.lock", "initialized", "authority.json", "pending.json"];
const hash = value => createHash("sha256").update(value).digest("hex");
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const token = value => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,256}$/.test(value);
const rejected = reason => ({ type: "REJECTED", reason: "STORAGE_REPAIR_" + reason });
function createOwnershipRepair(repository) {
    let review = null, pendingCleanup = null;
    function readExact(name) {
        let bytes;
        try { bytes = repository.io.readFileSync(repository.file(name)); }
        catch (error) { if (error.code === "ENOENT") return null; throw error; }
        const text = bytes.toString("utf8");
        if (!Buffer.from(text, "utf8").equals(bytes)) throw coded("STORAGE_REPAIR_INVALID_STATE");
        return text;
    }
    const capture = () => Object.fromEntries(names.map(name => [name, readExact(name)]));
    const same = (a, b) => names.every(name => a[name] === b[name]);
    function inspect() {
        if (repository.locked || repository.lastBytes !== null || repository.issue !== "FOREIGN_OWNER") throw coded("STORAGE_REPAIR_NOT_AVAILABLE");
        if (repository.read("reclaim.lock") !== null) throw coded("STORAGE_REPAIR_BUSY");
        const records = capture(), owner = JSON.parse(records["owner.lock"]);
        if (!exact(owner, ["machine", "pid", "id"]) || typeof owner.machine !== "string" || !owner.machine.trim() ||
            owner.machine.length > 255 || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || !token(owner.id)) throw coded("STORAGE_REPAIR_INVALID_STATE");
        if (owner.machine === os.hostname()) throw coded("STORAGE_REPAIR_NOT_FOREIGN");
        const text = records["authority.json"], initialized = records.initialized;
        let snapshot = null, application = null;
        const journal = repository.journal();
        if (text === null && initialized === null && journal === null) {
            // A copied lock can exist before first setup. Repair ownership only;
            // Core still requires the user's explicit initial policy selection.
        } else {
            if (text === null || initialized === null) throw coded("STORAGE_REPAIR_INVALID_STATE");
            const envelope = repository.envelope(text);
            const validated = envelope.schemaVersion === 1 ? migrateAtlasSnapshotV1(envelope.snapshot, repository.configuration) : validateAtlasSnapshot(envelope.snapshot);
            if (!validated.ok) throw coded("STORAGE_REPAIR_INVALID_STATE");
            snapshot = validated.snapshot;
            application = envelope.application === undefined ? null : validateApplication(envelope.application, snapshot);
            if (envelope.application !== undefined && !application) throw coded("STORAGE_REPAIR_INVALID_STATE");
            if (journal && !(hash(text) === journal.beforeHash || hash(text) === journal.afterHash &&
                envelope.lastCommitId === journal.commitId && envelope.storageVersion === journal.storageVersion)) throw coded("STORAGE_REPAIR_INVALID_STATE");
        }
        if (!same(records, capture()) || repository.read("reclaim.lock") !== null) throw coded("STORAGE_REPAIR_CHANGED");
        return { records, snapshot, application, journal };
    }
    const failure = error => {
        const reason = typeof error?.code === "string" && /^STORAGE_REPAIR_(NOT_AVAILABLE|NOT_FOREIGN|BUSY|INVALID_STATE|CHANGED|EXPIRED|STALE)$/.test(error.code)
            ? error.code.slice("STORAGE_REPAIR_".length) : error instanceof SyntaxError || error?.code === "ATLAS_INVALID_DATA" ? "INVALID_STATE" : "FAILED";
        repository.diagnostics.fail("OWNERSHIP_REPAIR", "REVIEW_OR_REPAIR", error, "UNAVAILABLE");
        return rejected(reason);
    };
    function preview() {
        review = null;
        try {
            const state = inspect(), createdAt = Date.now();
            if (!Number.isSafeInteger(createdAt) || createdAt < 0 || !Number.isSafeInteger(createdAt + 300000)) return rejected("NOT_AVAILABLE");
            review = { id: randomUUID(), records: state.records, createdAt, expiresAt: createdAt + 300000 };
            return { type: "STORAGE_OWNERSHIP_REVIEW", repairId: review.id, expiresAt: review.expiresAt,
                authorityPresent: state.snapshot !== null, policyRevision: state.snapshot?.policyRevision ?? null,
                configurationRevision: state.snapshot?.configurationRevision ?? null,
                destinationCount: state.application?.destinations?.length ?? 0, journalPending: state.journal !== null };
        } catch (error) { return failure(error); }
    }
    function flushAbsolute(file, bytes) {
        const fd = repository.io.openSync(file, "wx", 0o600);
        try { repository.io.writeFileSync(fd, bytes, "utf8"); repository.io.fsyncSync(fd); }
        finally { repository.io.closeSync(fd); }
    }
    function flushAbsoluteDirectory(directory) {
        if (process.platform === "win32") return;
        const fd = repository.io.openSync(directory, "r");
        try { repository.io.fsyncSync(fd); } finally { repository.io.closeSync(fd); }
    }
    function repair(input) {
        if (input?.localCopyConfirmed !== true) return rejected("CONFIRMATION_REQUIRED");
        if (!review || input.repairId !== review.id) return rejected("STALE");
        const selected = review; review = null; // one explicit attempt, including a failed attempt
        const now = Date.now();
        if (!Number.isSafeInteger(now) || now < selected.createdAt || now >= selected.expiresAt) return rejected("EXPIRED");
        let reclaim = null, temporary = null, repaired = false, caught = null;
        try {
            const current = inspect();
            if (!same(current.records, selected.records)) throw coded("STORAGE_REPAIR_CHANGED");
            // Serialize with all existing cooperative ownership reclamation.
            // A foreign machine cannot be probed: the user's attestation is
            // mandatory and does not establish distributed-lock guarantees.
            reclaim = JSON.stringify({ machine: os.hostname(), pid: process.pid, id: repository.lockId });
            repository.flushFile("reclaim.lock", reclaim); repository.flushDirectory();
            if (!same(capture(), selected.records)) throw coded("STORAGE_REPAIR_CHANGED");
            const backups = repository.file("ownership-backups"), backup = path.join(backups, selected.id);
            repository.io.mkdirSync(backups, { recursive: true }); repository.io.mkdirSync(backup);
            for (const name of names) if (selected.records[name] !== null) flushAbsolute(path.join(backup, name), selected.records[name]);
            flushAbsoluteDirectory(backup); flushAbsoluteDirectory(backups); repository.flushDirectory();
            // Backups must themselves be read back before touching ownership.
            for (const name of names) if (selected.records[name] !== null &&
                repository.io.readFileSync(path.join(backup, name), "utf8") !== selected.records[name]) throw coded("STORAGE_REPAIR_INVALID_STATE");
            if (repository.read("reclaim.lock") !== reclaim || !same(capture(), selected.records)) throw coded("STORAGE_REPAIR_CHANGED");
            const own = JSON.stringify({ machine: os.hostname(), pid: process.pid, id: repository.lockId });
            temporary = ".owner-" + selected.id + ".tmp";
            repository.flushFile(temporary, own);
            if (repository.read("reclaim.lock") !== reclaim || !same(capture(), selected.records)) throw coded("STORAGE_REPAIR_CHANGED");
            repository.io.renameSync(repository.file(temporary), repository.file("owner.lock")); temporary = null;
            repository.flushDirectory();
            // Complete the same instance's lock acknowledgement, then let Core
            // validate/reconcile the unchanged authority and journal.
            if (!repository.acquire()) throw coded("STORAGE_REPAIR_FAILED");
            repository.assertOwner(); repaired = true;
        } catch (error) { caught = error; }
        finally {
            if (temporary) { try { repository.io.unlinkSync(repository.file(temporary)); } catch (_) { /* never delete another record */ } }
            if (reclaim !== null) {
                try {
                    if (repository.read("reclaim.lock") === reclaim) { repository.io.unlinkSync(repository.file("reclaim.lock")); repository.flushDirectory(); }
                    else if (repaired) { pendingCleanup = reclaim; caught = coded("STORAGE_REPAIR_CHANGED"); repaired = false; }
                } catch (error) { pendingCleanup = reclaim; caught = error; repaired = false; }
            }
        }
        if (!repaired) {
            // A lost acknowledgement after owner replacement is still a failure;
            // ordinary explicit recovery may complete this instance's own lock.
            try { if (JSON.parse(repository.read("owner.lock"))?.id === repository.lockId) repository.issue = "STORAGE_UNAVAILABLE"; } catch (_) { /* retain current diagnosis */ }
            return failure(caught);
        }
        repository.issue = null;
        return { type: "STORAGE_OWNERSHIP_REPAIRED" };
    }
    function completeCleanup() {
        if (pendingCleanup === null) return true;
        try {
            const current = repository.read("reclaim.lock");
            if (current !== null && current !== pendingCleanup) { repository.issue = "STORAGE_LOCKED"; return false; }
            if (current !== null) repository.io.unlinkSync(repository.file("reclaim.lock"));
            repository.flushDirectory(); pendingCleanup = null; return true;
        } catch (error) {
            repository.issue = "STORAGE_LOCKED";
            repository.diagnostics.fail("OWNERSHIP_REPAIR", "RECLAIM_CLEANUP", error, "UNAVAILABLE"); return false;
        }
    }
    return { preview, repair, completeCleanup };
}
module.exports = { createOwnershipRepair };
