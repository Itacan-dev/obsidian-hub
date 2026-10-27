"use strict";
// Shared causal whole-task reconciliation. Profile wrappers validate all evidence.
const V = require("./value"), { check } = require("./errors");
const same = (a,b) => V.canonical(a) === V.canonical(b);
const hash = v => require("./source-content").sha256(V.canonical(v));
const sorted = values => [...values].sort();
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const view = state => Object.fromEntries(["tasks","history","bindings","retiredStepIds"].map(k => [k,V.clone(state[k])]));
function merge(local, remote, frames, read, changes = id => frames.get(id).receipt.result.change.taskIds, retirements = id => frames.get(id).receipt.result.atomicTask?.retiredStepIds ?? []) {
    // A conflicted branch is evidence even when its effects were not accepted.
    // Propagate both heads to new replicas; acceptance alone would hide the
    // unaccepted side and incorrectly make the target writable again.
    const all = new Set([...local.accepted, ...remote.accepted, ...local.conflicts.flatMap(c => c.origins), ...remote.conflicts.flatMap(c => c.origins)]), accepted = new Set(local.accepted), taskHeads = new Map(local.taskHeads), conflicts = V.clone(local.conflicts), value = view(local);
    const candidates = new Map();
    for (const id of all) for (const taskId of changes(id)) { if (!candidates.has(taskId)) candidates.set(taskId, []); candidates.get(taskId).push(id); }
    const conflicting = new Set();
    for (const [taskId, ids] of candidates) {
        const heads = ids.filter(id => !ids.some(other => id !== other && read(frames.get(other).parent).accepted.has(id))).sort();
        if (heads.length > 1) {
            conflicting.add(taskId); const body = { taskId, origins: heads }, conflict = { ...body, digest: hash(body) };
            if (!conflicts.some(x => x.digest === conflict.digest)) conflicts.push(conflict);
        } else if (heads.length === 1) taskHeads.set(taskId, heads[0]);
    }
    for (const id of remote.accepted) if (!changes(id).some(taskId => conflicting.has(taskId))) accepted.add(id);
    for (const [taskId, head] of taskHeads) {
        if (conflicting.has(taskId)) { if (local.taskHeads.has(taskId)) taskHeads.set(taskId, local.taskHeads.get(taskId)); else taskHeads.delete(taskId); continue; }
        const source = read(head), task = source.tasks.find(t => t.id === taskId);
        check(task, "Origin task snapshot missing.");
        value.tasks = value.tasks.filter(t => t.id !== taskId).concat(V.clone(task));
        value.history = value.history.filter(e => e.taskId !== taskId).concat(V.clone(source.history.filter(e => e.taskId === taskId)));
        value.bindings = value.bindings.filter(e => e.taskId !== taskId).concat(V.clone(source.bindings.filter(e => e.taskId === taskId)));
    }
    // Retired identities are permanent reservations, even if their task is no
    // longer live. Unaccepted conflict branches do not become accepted effects.
    value.retiredStepIds = sorted(new Set([...accepted].flatMap(id => retirements(id))));
    value.tasks.sort((a, b) => compare(a.id, b.id)); value.history.sort((a, b) => compare(a.id, b.id)); value.bindings.sort((a, b) => compare(a.stepId ?? a.taskId, b.stepId ?? b.taskId)); value.retiredStepIds.sort();
    conflicts.sort((a, b) => compare(a.digest, b.digest));
    return { view: value, accepted, taskHeads, conflicts, summary: { version: 1, acceptedOrigins: sorted([...accepted].filter(id => !local.accepted.has(id))), conflicts } };
}
module.exports = { merge };
