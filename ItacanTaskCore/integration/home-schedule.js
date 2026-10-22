"use strict";
// Rehearsal-only composition. No storage, task mutation or second pending queue.
const V = require("../src/value"), { check } = require("../src/errors");
const same = (a, b) => V.canonical(a) === V.canonical(b);
function taskKey(task) {
    const r = task.nativeReference;
    return r ? V.canonical([r.authorityId, r.owner, r.taskId]) : task.hubTaskId ?? `${task.path}\0${task.line}`;
}
function homeOwner(context, resolve) {
    const owner = resolve(context.owner);
    check(owner && (context.owner.type === "resource" ? owner.contextKind === "resource" && owner.resourceType === context.owner.id : owner.contextKind !== "resource" && owner.projectId === context.owner.id) &&
        owner.root === context.root && owner.path === context.dashboard && (owner.status ?? "active") === context.status && !owner.deleted,
        "Native Home owner context is unavailable.");
    return owner;
}
function mergeHome(legacy, native, owner, context, resolve) {
    const wrapper = homeOwner(context, resolve), rows = [], keys = new Set();
    let inserted = false;
    const add = () => { if (inserted) return; inserted = true;
        for (const task of native) {
            check(task.nativeReference && same(task.nativeReference.owner, owner), "Native Home task owner differs.");
            const key = taskKey(task); check(!keys.has(key), "Duplicate native Home identity."); keys.add(key);
            rows.push({ task, owner: wrapper, phaseLabel: null });
        }
    };
    for (const item of legacy) {
        // Presentation references and Resource mounts are never authority selectors.
        if (item.task.nativeReference && same(item.task.nativeReference.owner, owner) || item.task.homePhysicalOwner && same(item.task.homePhysicalOwner, owner)) add();
        else rows.push(item);
    }
    add(); return rows;
}
module.exports = { taskKey, homeOwner, mergeHome };
