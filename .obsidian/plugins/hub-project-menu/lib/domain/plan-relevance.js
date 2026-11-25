"use strict";

const { taskKey, oathTaskOrder } = require("./oath-workspace");

const workspaceKey = ref => JSON.stringify([ref?.type, ref?.id]);
const sameOrInside = (path, folder) => path === folder || path.startsWith(folder + "/");

function derivePlanRelevance(plan, items, oath, { fileOwner, intendedProject, taskLocation } = {}) {
    const workspaces = new Map(), paths = new Map(), planned = new Map();
    const locations = new Set();
    const selected = oathTaskOrder(oath);
    function add(index, key, reason) {
        if (!key) return;
        if (!index.has(key)) index.set(key, { direct: false, files: 0, tasks: 0, attached: 0 });
        const result = index.get(key);
        if (reason === "direct") result.direct = true;
        else result[reason]++;
    }
    function addAncestors(path, reason) {
        for (let slash = path.lastIndexOf("/"); slash >= 0; slash = path.lastIndexOf("/", slash - 1)) {
            add(paths, path.slice(0, slash), reason);
            if (slash === 0) break;
        }
    }
    for (const [position, entry] of (plan?.content.entries ?? []).entries()) {
        if (entry.kind === "task") planned.set(taskKey(entry.reference), position);
    }
    for (const { entry, availability, file, task } of items) {
        if (availability !== "current") continue;
        if (entry.kind === "workspace") {
            add(workspaces, workspaceKey(entry.reference), "direct");
        } else if (entry.kind === "file") {
            const path = file.path;
            locations.add(path);
            const owner = fileOwner(path);
            const intended = intendedProject(entry.intendedContext, path);
            add(paths, path, "direct");
            addAncestors(path, "files");
            if (owner) add(workspaces, workspaceKey(owner), "files");
            if (intended && workspaceKey(intended) !== workspaceKey(owner)) add(workspaces, workspaceKey(intended), "attached");
        } else if (task && !task.completed) {
            const owner = task.nativeReference.owner;
            add(workspaces, workspaceKey(owner), "tasks");
            const location = taskLocation(task);
            if (location) {
                locations.add(location.path);
                add(paths, location.path, "tasks");
                addAncestors(location.path, "tasks");
            }
        }
    }

    const describe = value => {
        if (!value) return null;
        if (value.direct) return { level: "direct", description: "Explicitly included in the active Plan" };
        const reasons = [];
        if (value.files) reasons.push(value.files === 1 ? "1 planned file" : value.files + " planned files");
        if (value.tasks) reasons.push(value.tasks === 1 ? "1 unfinished planned task" : value.tasks + " unfinished planned tasks");
        if (value.attached) reasons.push(value.attached === 1 ? "1 planned file in an attached folder" : value.attached + " planned files in attached folders");
        return { level: "indirect", description: "Leads to " + reasons.join(" and ") };
    };
    const task = item => {
        const value = item.task && typeof item.task === "object" ? item.task : item;
        if (value.completed) return null;
        const key = taskKey(value), position = planned.get(key);
        return position === undefined ? null : { position, oath: selected.has(key) };
    };
    function order(tasks) {
        return tasks.map(value => ({ value, focus: task(value) })).sort((a, b) =>
            Number(!a.focus?.oath) - Number(!b.focus?.oath) ||
            (a.focus?.position ?? Number.MAX_SAFE_INTEGER) - (b.focus?.position ?? Number.MAX_SAFE_INTEGER)
        ).map(item => item.value);
    }
    function partition(tasks) {
        const prioritized = [], ordinary = [];
        for (const value of tasks) (task(value) ? prioritized : ordinary).push(value);
        return { prioritized: order(prioritized), ordinary };
    }
    return {
        planId: plan?.id ?? null,
        locations: Object.freeze([...locations]),
        signature: JSON.stringify([plan?.id, [...planned], [...planned.keys()].filter(key => selected.has(key)), [...workspaces], [...paths], [...locations]]),
        workspace: ref => describe(workspaces.get(workspaceKey(ref))),
        workspaceRank(ref) {
            const value = workspaces.get(workspaceKey(ref));
            return value?.direct ? 0 : value ? 1 : 2;
        },
        path: path => describe(paths.get(path)),
        task, order, partition
    };
}

module.exports = { derivePlanRelevance, sameOrInside };
