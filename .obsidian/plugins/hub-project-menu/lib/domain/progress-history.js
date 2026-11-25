"use strict";
const { sameWorkspace } = require("./oath-workspace");

const oathMode = record => record.policy?.mode === "strict" ? "Strict" : "Regular";
const oathOutcome = record => ({
    fulfilled: "Fulfilled",
    broken: "Broken",
    interrupted: "Interrupted",
    invalid: "Unavailable"
})[record.state] ?? "Ended";
const planOutcome = record => record.status === "finished" ? "Plan finished" :
    record.archiveReason === "never-activated" ? "Plan never activated" : "Time ran out";

function planWorkspaces(entries) {
    return entries.flatMap(entry => {
        if (entry.kind === "workspace") return [entry.reference];
        if (entry.kind === "task") return [entry.reference?.ownerHint];
        if (entry.kind === "file") return [entry.reference?.sourceWorkspace, entry.intendedContext];
        return [];
    });
}

function lifecycleHistory({ plans = [], oathsByDevice = {}, workspace = null }) {
    const records = [];
    const matches = refs => !workspace || refs.some(ref => sameWorkspace(ref, workspace));
    const seen = new Set();
    for (const bucket of Object.values(oathsByDevice ?? {})) {
        const history = Array.isArray(bucket?.history) ? bucket.history : [];
        for (const oath of [...history, bucket?.current]) {
            if (!oath?.id || seen.has(oath.id) || oath.state === "active" || oath.state === "scheduled") continue;
            const at = typeof oath.completedAt === "number" ? oath.completedAt : Date.parse(oath.completedAt);
            if (!Number.isFinite(at)) continue;
            const owners = [...(oath.workspaces ?? []), oath.workspace, ...(oath.tasks ?? []).map(task => task.owner)];
            if (!matches(owners)) continue;
            seen.add(oath.id);
            records.push({ key: "oath:" + oath.id, kind: "oath", at, record: oath });
        }
    }
    for (const plan of plans) {
        const at = Date.parse(plan.endedAt);
        if (plan.snapshot && Number.isFinite(at) && matches(planWorkspaces(plan.snapshot.entries))) {
            records.push({ key: "plan:" + plan.id, kind: "plan", at, record: plan });
        }
    }
    return records.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}

module.exports = { lifecycleHistory, oathMode, oathOutcome, planOutcome };
