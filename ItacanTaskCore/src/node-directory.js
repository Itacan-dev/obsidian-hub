"use strict";
// The only filesystem boundary. No inferred vault path, recursive deletion, UI,
// application settings, or application startup hooks are present here.
const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const os = require("node:os");
const { check, fail } = require("./errors");

class NodeDirectory {
    constructor(directory) {
        check(typeof directory === "string" && path.isAbsolute(directory), "An explicit absolute storage directory is required.");
        this.directory = path.resolve(directory); this.token = null;
    }
    file(name) { check(typeof name === "string" && /^[A-Za-z0-9._-]+$/.test(name) && name !== "." && name !== "..", "Invalid storage filename."); return path.join(this.directory, name); }
    async list() {
        const stat = await fs.lstat(this.directory); check(stat.isDirectory() && !stat.isSymbolicLink(), "Storage root must be an existing ordinary directory.");
        return fs.readdir(this.directory);
    }
    async read(name) {
        const file = this.file(name), stat = await fs.lstat(file);
        check(stat.isFile() && !stat.isSymbolicLink(), "Storage evidence must be an ordinary file.");
        return fs.readFile(file, "utf8");
    }
    async writeNew(name, data, hook = null) {
        const handle = await fs.open(this.file(name), "wx");
        try {
            const bytes = Buffer.from(data, "utf8"), middle = Math.floor(bytes.length / 2);
            await handle.writeFile(bytes.subarray(0, middle)); await hook?.("duringTemporaryWrite");
            await handle.writeFile(bytes.subarray(middle)); await hook?.("beforeFlush");
            await handle.sync(); await hook?.("afterFlush");
        } finally { await handle.close(); }
    }
    async publish(source, destination) {
        // Exclusive destination creation: an interrupted copy is uncommitted and
        // is never named by CURRENT. Verify and flush before publishing CURRENT.
        await fs.copyFile(this.file(source), this.file(destination), constants.COPYFILE_EXCL);
        const handle = await fs.open(this.file(destination), "r+"); try { await handle.sync(); } finally { await handle.close(); }
        await fs.unlink(this.file(source));
    }
    async replace(source, destination) {
        const waits = [0, 10, 40, 100]; let error;
        for (const milliseconds of waits) {
            if (milliseconds) await new Promise(resolve => setTimeout(resolve, milliseconds));
            try { await fs.rename(this.file(source), this.file(destination)); return; }
            catch (caught) { error = caught; if (!["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error; }
        }
        throw error;
    }
    async remove(name) { await fs.unlink(this.file(name)); }
    async syncDirectory() {
        // Windows commonly cannot open directories this way. This is best effort,
        // not a claim of power-loss durability on every filesystem/cloud client.
        let handle;
        try { handle = await fs.open(this.directory, "r"); await handle.sync(); return true; }
        catch (_) { return false; }
        finally { await handle?.close(); }
    }
    async acquire() {
        if (this.token) fail("LOCK_HELD", "Writer already held.");
        const token = randomUUID(), record = JSON.stringify({ format: "itacan-task-writer", token, pid: process.pid, host: os.hostname(), createdAt: Date.now() }) + "\n";
        let handle;
        try { handle = await fs.open(this.file("WRITER.lock"), "wx"); }
        catch (error) { if (error.code === "EEXIST") fail("LOCK_HELD", "Another writer or an abandoned lock exists. No automatic stale-lock removal is permitted."); throw error; }
        this.token = token;
        try { await handle.writeFile(record, "utf8"); await handle.sync(); }
        catch (error) { await handle.close(); await fs.unlink(this.file("WRITER.lock")); this.token = null; throw error; }
        await handle.close();
    }
    async assertWriter() {
        let record;
        try { record = JSON.parse(await this.read("WRITER.lock")); } catch (_) { fail("LOCK_LOST", "Writer lock evidence is missing or unreadable."); }
        if (!this.token || record.token !== this.token) fail("LOCK_LOST", "Writer lock ownership changed.");
    }
    async release() {
        if (!this.token) return;
        await this.assertWriter(); await this.remove("WRITER.lock"); this.token = null;
    }
}
module.exports = { NodeDirectory };
