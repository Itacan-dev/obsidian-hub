"use strict";
const { fail, check } = require("./errors");
const { clone } = require("./value");
const { validateState } = require("./domain");
const { initialState, TaskRepository } = require("./repository");
const capabilities = new WeakMap();

// Reuse this backing object across close/open to exercise the exact contract.
class MemoryStorage {
    constructor() { this.state = null; this.leased = false; capabilities.set(this, { version: undefined, recovered: false }); }
    atomicTaskCapability() { return capabilities.get(this).version === 1; }
    atomicTaskRecoveryKnown() { const c = capabilities.get(this); if (c.version === 1 && (this.recurrenceFence || this.recovery)) c.recovered = true; return c.version === 1 && c.recovered; }
    async assertAllWritable() { if (this.atomicTaskRecoveryKnown()) fail("ATOMIC_TASK_RECOVERY_FENCED", "Every mutation and replay is blocked after known atomic-root recovery."); }
    acquire() { if (this.leased) fail("LOCK_HELD", "Memory store already has a writer."); this.leased = true; }
    async load() { check(this.leased, "Memory writer is not held."); if (!this.state) fail("RECOVERY_REQUIRED", "Memory store is uninitialized."); return clone(this.state); }
    async commit(state, expectedRevisionId) {
        check(this.leased, "Memory writer is not held."); await this.assertAllWritable(); validateState(state);
        if (!this.atomicTaskCapability() && state.receipts.some(r => Object.hasOwn(r.result, "atomicTask"))) fail("ATOMIC_TASK_CAPABILITY_REQUIRED", "Atomic task effects require explicit creation capability.");
        if (this.state && this.state.revisionId !== expectedRevisionId) fail("REPOSITORY_CONFLICT", "Memory generation changed.");
        this.state = clone(state);
    }
    async close() { this.leased = false; }
}
async function createMemoryRepository(options) {
    const storage = options.storage ?? new MemoryStorage(); storage.acquire();
    try {
        check(typeof options.idFactory === "function", "An injected UUID factory is required.");
        if (storage.state) fail("ALREADY_EXISTS", "Memory store is already initialized.");
        check(options.taskMutationVersion === undefined || options.taskMutationVersion === 1, "Unsupported atomic memory creation capability.");
        capabilities.get(storage).version = options.taskMutationVersion;
        const state = initialState(options.partitions, options.storeId ?? options.idFactory(), options.idFactory);
        await storage.commit(state, null); return new TaskRepository(storage, state, options);
    } catch (error) { await storage.close(); throw error; }
}
async function openMemoryRepository(options) {
    check(options.taskMutationVersion === undefined, "Opening cannot enable or replace memory capability.");
    const storage = options.storage; check(storage instanceof MemoryStorage, "An explicit MemoryStorage is required."); storage.acquire();
    try { return new TaskRepository(storage, await storage.load(), options); } catch (error) { await storage.close(); throw error; }
}
module.exports = { MemoryStorage, createMemoryRepository, openMemoryRepository };
