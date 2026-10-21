"use strict";
const { check, fail } = require("./errors");
const { canonical, clone, fields, uuid } = require("./value");
const { TASK_FIELDS, validateTask, validatePartition, sameOwner } = require("./domain");
const PUBLIC_TASK_FIELDS = Object.freeze(TASK_FIELDS.filter(key => !["migration", "captureSource"].includes(key)));

function validateSharedPacket(packet) {
    fields(packet, ["format", "schemaVersion", "partition", "tasks", "completionRefs"], ["format", "schemaVersion", "partition", "tasks", "completionRefs"]);
    check(packet.format === "itacan-task-partition", "Invalid partition format.");
    if (packet.schemaVersion !== 1) fail("UNSUPPORTED_SCHEMA", "Unsupported partition format version.");
    validatePartition(packet.partition);
    if (packet.partition.kind !== "git-project") fail("PARTITION_PRIVATE", "Only explicitly eligible Project partitions can be exported.");
    check(Array.isArray(packet.tasks), "Invalid partition tasks."); const identities = new Set();
    for (const task of packet.tasks) {
        fields(task, PUBLIC_TASK_FIELDS, PUBLIC_TASK_FIELDS); validateTask({ ...task, migration: null, captureSource: null });
        check(task.partitionId === packet.partition.id && sameOwner(task.owner, packet.partition.owner), "Task ownership does not match shared partition.");
        check(task.revision <= packet.partition.revision, "Task revision exceeds its partition revision.");
        for (const id of [task.id, ...task.steps.map(step => step.id)]) { check(!identities.has(id), "Duplicate exported identity."); identities.add(id); }
    }
    check(Array.isArray(packet.completionRefs), "Invalid shared completion references.");
    const completed = new Map(), referenced = new Set(), events = new Set();
    for (const task of packet.tasks) if (task.deletedAt === null) for (const target of [task, ...task.steps]) if (target.completed) completed.set(target.id, task.id);
    for (const ref of packet.completionRefs) {
        fields(ref, ["taskId", "stepId", "eventId"], ["taskId", "stepId", "eventId"]); uuid(ref.taskId); uuid(ref.eventId); if (ref.stepId !== null) uuid(ref.stepId);
        const id = ref.stepId ?? ref.taskId;
        check(completed.get(id) === ref.taskId && !referenced.has(id) && !events.has(ref.eventId), "Invalid or duplicate shared completion reference.");
        referenced.add(id); events.add(ref.eventId);
    }
    check(referenced.size === completed.size, "Missing shared completion identity.");
    return packet;
}
function serializeSharedPartition({ partition, tasks, completionRefs = [] }) {
    validatePartition(partition);
    if (tasks.some(task => require("./history-import").importedTask(task))) fail("UNSUPPORTED_OPERATION", "Import-dependent task transport requires N4; private provenance cannot be stripped.");
    const packet = { format: "itacan-task-partition", schemaVersion: 1, partition: clone(partition), tasks: tasks.map(task => {
        validateTask(task);
        const result = Object.fromEntries(PUBLIC_TASK_FIELDS.map(key => [key, clone(task[key])]));
        result.steps.sort((a, b) => a.id.localeCompare(b.id)); return result;
    }).sort((a, b) => a.id.localeCompare(b.id)), completionRefs: clone(completionRefs).sort((a, b) => (a.stepId ?? a.taskId).localeCompare(b.stepId ?? b.taskId)) };
    validateSharedPacket(packet); return canonical(packet) + "\n";
}
function deserializeSharedPartition(serialized, expectedPartition = null) {
    check(typeof serialized === "string", "Partition must be serialized JSON.");
    let packet; try { packet = JSON.parse(serialized); } catch (_) { fail("VALIDATION", "Invalid partition JSON."); }
    validateSharedPacket(packet);
    if (expectedPartition !== null) {
        validatePartition(expectedPartition);
        check(packet.partition.id === expectedPartition.id && packet.partition.kind === expectedPartition.kind && sameOwner(packet.partition.owner, expectedPartition.owner), "Unexpected partition identity/classification.");
    }
    return clone(packet);
}
function comparePartitionHeads(local, remote) {
    validatePartition(local); validatePartition(remote);
    check(local.id === remote.id && local.kind === remote.kind && sameOwner(local.owner, remote.owner), "Cannot compare unrelated partitions.");
    if (local.head === remote.head) { check(local.revision === remote.revision && local.parentHead === remote.parentHead, "Conflicting revision metadata for the same head."); return "same"; }
    if (remote.revision === local.revision + 1 && remote.parentHead === local.head) return "remote-direct-child";
    if (local.revision === remote.revision + 1 && local.parentHead === remote.head) return "local-direct-child";
    // Additional ancestry or explicit conflict resolution is required. Never LWW.
    return "conflict-or-unproven-ancestry";
}
module.exports = { PUBLIC_TASK_FIELDS, serializeSharedPartition, deserializeSharedPartition, validateSharedPacket, comparePartitionHeads };
