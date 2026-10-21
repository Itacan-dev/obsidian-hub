"use strict";
// Portable, instance-bound admission. Neither gate nor permit carries an issuer.
const V = require("./value"), { fail } = require("./errors");
const gates = new WeakMap(), tickets = new WeakMap(), permits = new WeakMap(), ports = new WeakMap(), leases = new Map(), repositories = new WeakMap();
const denied = () => fail("WRITER_ADMISSION_REQUIRED", "Writer admission is required.");
const lookup = (map, key) => key && typeof key === "object" ? map.get(key) : undefined;
function createGate(hooks) {
    const gate = Object.freeze({ version: 1 });
    gates.set(gate, { hooks: Object.freeze({ ...hooks }), bootstrap: null });
    return Object.freeze({ gate, start(creating) { gates.get(gate).bootstrap = creating ? { digest: null } : null; }, finish() { gates.get(gate).bootstrap = null; }, issue(command, request, authorization) {
        const ticket = Object.freeze({ version: 1 });
        tickets.set(ticket, { gate, payload: V.canonical(command), request: V.clone(request), authorization, used: false });
        return ticket;
    } });
}
function storageGate(port, requested) {
    validateGate(requested);
    const bound = ports.get(port) ?? (port.token ? leases.get(port.token) : undefined);
    if (bound && requested && bound !== requested) denied();
    const gate = bound ?? requested;
    if (gate) { ports.set(port, gate); if (port.token) leases.set(port.token, gate); }
    return gate;
}
function repositoryGate(storage, requested) {
    validateGate(requested); const bound = repositories.get(storage);
    if (bound && requested && bound !== requested) denied();
    const gate = bound ?? requested; if (gate) repositories.set(storage, gate); return gate;
}
function validateGate(gate) { if (gate !== undefined && !lookup(gates, gate)) denied(); return gate; }
async function begin(gate, ticket, command, state) {
    if (gate === undefined) { if (ticket !== undefined) denied(); return null; }
    const record = lookup(gates, gate), hooks = record?.hooks, t = lookup(tickets, ticket);
    if (!hooks || !t || t.gate !== gate || t.used || t.payload !== V.canonical(command)) denied();
    t.used = true;
    await hooks.admit(t.request, t.authorization, state);
    const permit = Object.freeze({ version: 1 }); permits.set(permit, { ...t, digest: null }); return permit;
}
async function fresh(gate, permit, state) {
    if (gate === undefined) return;
    const p = lookup(permits, permit); if (!p || p.gate !== gate) denied();
    await gates.get(gate).hooks.fresh(p.request, p.authorization, state);
}
async function seal(gate, permit, state, prior) {
    if (gate === undefined) return;
    const p = lookup(permits, permit); if (!p || p.gate !== gate || p.digest !== null) denied();
    await gates.get(gate).hooks.candidate(p.request, state, prior);
    p.digest = V.canonical(state);
}
async function publication(gate, intent, state, initial = false) {
    if (gate === undefined) return;
    // Explicit construction alone may publish the empty initial authority.
    if (initial && state.revision === 0 && state.tasks.length === 0 && state.history.length === 0 && state.receipts.length === 0) {
        const b = gates.get(gate)?.bootstrap, digest = V.canonical(state);
        if (!b || state.storeId !== gates.get(gate).hooks.authorityId || b.digest !== null && b.digest !== digest) denied();
        b.digest = digest; return;
    }
    const p = lookup(permits, intent?.admission);
    if (!p || p.gate !== gate || p.digest !== V.canonical(state) || p.payload !== V.canonical(intent.command)) denied();
    await gates.get(gate).hooks.admit(p.request, p.authorization, intent.priorState);
    await fresh(gate, intent.admission, intent.priorState);
}
module.exports = Object.freeze({ createGate, validateGate, storageGate, repositoryGate, begin, fresh, seal, publication });
