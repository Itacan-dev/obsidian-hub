"use strict";
const test = require("node:test");
const S = require("./support.cjs");
const { SharedProjectStore } = require(S.services + "/shared-projects");
const KEY = "obsidian-hub::device-id";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function storage(t, descriptor) {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    t.after(() => original ? Object.defineProperty(globalThis, "localStorage", original) : delete globalThis.localStorage);
    if (descriptor) Object.defineProperty(globalThis, "localStorage", { configurable: true, ...descriptor });
    else delete globalThis.localStorage;
}
function memory(t, initial) {
    const values = new Map(initial), reads = [], writes = [];
    storage(t, { value: {
        getItem(key) { reads.push(key); return values.get(key) ?? null; },
        setItem(...args) { writes.push(args); values.set(String(args[0]), String(args[1])); }
    } });
    return { values, reads, writes };
}
const plugin = () => ({ app: { vault: { adapter: { getBasePath: () => S.os.tmpdir() } } } });
// Execute the actual frozen pre-C1-A implementation as the comparison, not a model.
for (const [label, api] of [["current", S.api], ["frozen pre-C1-A", S.frozen()]]) {
    test(label + ": new UUID is persisted with exactly key/value and reused", t => {
        const m = memory(t), first = new api.HubDataStore(plugin());
        S.assert.match(first.deviceId, uuid);
        S.assert.deepEqual(m.writes, [[KEY, first.deviceId]]);
        const second = new api.HubDataStore(plugin());
        S.assert.equal(second.deviceId, first.deviceId);
        S.assert.deepEqual(m.reads, [KEY, KEY]);
        S.assert.deepEqual(m.writes, [[KEY, first.deviceId]]);
    });
    test(label + ": existing nonempty ID and ordinary initialization are preserved", async t => {
        const m = memory(t, [[KEY, "existing-device-value"]]), host = plugin();
        const store = new api.HubDataStore(host);
        S.assert.equal(store.deviceId, "existing-device-value");
        S.assert.deepEqual(m.writes, []);
        S.assert.equal(store.plugin, host);
        S.assert(store.writeQueue instanceof Promise);
        S.assert.equal(await store.writeQueue, undefined);
        S.assert.equal(store.lastRevision, 0);
        S.assert.equal(store.lastDiskSignature, null);
        S.assert(store.sharedProjects instanceof SharedProjectStore);
        S.assert.equal(store.sharedProjects.vaultRoot, S.os.tmpdir());
        S.assert.equal(store.sharedProjects.filePath, S.path.join(S.os.tmpdir(), "System/Hub-shared-projects.json"));
        S.assert.equal(store.sharedProjects.lastText, null);
    });
    for (const failure of ["absent", "getter", "getItem", "setItem"]) {
        test(label + ": " + failure + " storage preserves UUID fallback", t => {
            let writes = 0;
            const fail = () => { throw Error("synthetic storage failure"); };
            if (failure === "absent") storage(t);
            else if (failure === "getter") storage(t, { get: fail });
            else storage(t, { value: {
                getItem: failure === "getItem" ? fail : () => null,
                setItem(...args) { writes++; S.assert.equal(args.length, 2); S.assert.equal(args[0], KEY); S.assert.match(args[1], uuid); fail(); }
            } });
            S.assert.match(new api.HubDataStore(plugin()).deviceId, uuid);
            S.assert.equal(writes, failure === "setItem" ? 1 : 0);
        });
    }
}
test("both factory entry points remain available; managed construction is opt-in and touches no storage or Vault", async t => {
    const index = require(S.services + "/application-storage");
    S.assert.equal(index.createTransactionalApplicationStore, S.api.createTransactionalApplicationStore);
    let accesses = 0;
    storage(t, { get() { accesses++; throw Error("localStorage forbidden"); } });
    const directory = await S.root(), cfg = S.config(directory);
    S.assert.deepEqual(await S.fs.readdir(directory), []);
    for (const create of [S.api.createTransactionalApplicationStore, index.createTransactionalApplicationStore]) {
        const store = create(cfg);
        S.assert(store instanceof S.api.HubDataStore);
        for (const field of ["plugin", "deviceId", "writeQueue", "lastRevision", "lastDiskSignature", "sharedProjects"]) S.assert.equal(store[field], undefined);
        S.assert.throws(() => store.pluginDirectoryPath(), { code: "MANAGED_TRANSACTIONS_REQUIRED" });
        await store.close();
    }
    S.assert.equal(accesses, 0);
    S.assert.deepEqual(await S.fs.readdir(directory), []);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "ordinary" } });
    const ordinary = new S.api.HubDataStore(plugin());
    S.assert.throws(() => ordinary.create({}), /not explicitly constructed/);
});
