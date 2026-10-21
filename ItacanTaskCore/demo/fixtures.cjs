"use strict";
const { randomUUID } = require("node:crypto");
const { registryDigest } = require("../host"), P = require("../writer/policy");
const V = require("../src/value");
const labels = ["Itacan · demo", "Obsidian Hub · demo", "Personal · demo", "Knowledge", "Research", "Explorations", "Inspiration"];
function configuration(authorityId) {
    const owners = ["itacan", "hub", "private", "study", "literature", "references", "inspiration"].map((id, i) => ({ owner: { type: i < 3 ? "project" : "resource", id }, partitionId: id,
        root: "Synthetic/" + id, dashboard: "Synthetic/" + id + "/Dashboard.md", status: "active", available: true, shared: false, shareApproval: null, locations: [], mounts: [] }));
    const registry = { version: 1, registryId: "disposable-demo-registry", applicationContextId: "disposable-demo-" + authorityId, revision: "1", owners };
    registry.digest = registryDigest(registry);
    const policy = P.policy({ version: 1, owners: owners.map(o => ({ owner: o.owner, partitionId: o.partitionId })), commands: ["task.create", "task.createMany", "task.createRich", "task.save", "task.complete", "task.delete"], inventory: { version: 1, revision: "empty-demo-inventory-v1", ids: [] }, phases: { version: 1, revision: "no-demo-phases-v1", values: [] } });
    return { registry, policy, labels: labels.map((label, i) => ({ label, owner: owners[i].owner, partitionId: owners[i].partitionId })) };
}
function richDraft(patch = {}) { return { version: 1, metadata: { title: "", description: "", importance: null, start: null, due: null, location: null, phase: null }, continuation: "", steps: [], initial: { completed: false, completedAt: null }, ...V.clone(patch) }; }
function deepSteps() { const ids = Array.from({ length: 4 }, randomUUID); return ids.map((id, i) => ({ id, parentStepId: i ? ids[i - 1] : null, order: 0, title: "Review", body: ["Outline the question.", "Read the evidence.", "Write a small example.", "Check the result."][i], initial: { completed: i === 3, ...(i === 3 ? {} : { completedAt: null }) } })); }
function bulk(count, owner) { return Array.from({ length: count }, (_, i) => ({ id: randomUUID(), owner: V.clone(owner), title: "Synthetic task " + String(i + 1).padStart(5, "0"), description: "Generated for disposable performance testing.", importance: i % 3 === 0 ? "must" : i % 3 === 1 ? "should" : null, start: null, due: { date: "2026-11-" + String(i % 28 + 1).padStart(2, "0"), time: i % 2 ? null : "09:00" }, steps: i % 10 ? [] : [{ id: randomUUID(), parentStepId: null, order: 0, title: "A small next step" }] })); }
module.exports = { configuration, richDraft, deepSteps, bulk };
