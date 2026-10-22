"use strict";
// Owner-specific startup admission. No setting, source writer or repository creation.
const fs = require("node:fs/promises"), path = require("node:path");
const A = require("../../../../../ItacanTaskCore/host/private-authority");
const V = require("../../../../../ItacanTaskCore/src/value");
const check = (ok, message) => { if (!ok) throw Error(message); };
const checksum = value => A.digest(V.canonical(value));
function seal(body) { return { ...body, checksum: checksum(body) }; }
function verify(value) { V.jsonValue(value); const { checksum: actual, ...body } = value; check(actual === checksum(body), "Cutover evidence checksum mismatch."); return body; }
function location(local, vaultId) { return path.join(local, "Itacan/NativeActivation/v1", A.digest(vaultId).slice(0, 24)); }
async function readOrdinary(file) { check(!(await fs.lstat(file)).isSymbolicLink(), "Activation link rejected."); return JSON.parse(await fs.readFile(file, "utf8")); }
async function readPlan(file) {
    const p = verify(await readOrdinary(file));
    const fields = ["version", "kind", "vaultId", "deviceId", "deviceEvidence", "owner", "projectRoot", "dashboard", "archive", "archiveHash", "sources", "registryFiles", "historyDigest", "metadataDigest", "options", "assets"];
    V.fields(p, fields, fields);
    check(p.version === 1 && p.kind === "itacan-owner-cutover" && p.owner.type === "project" && p.owner.id === A.PROJECT && p.options.owner.id === A.PROJECT && p.options.creating === false && p.options.config.scope === "device-private-project", "Unsupported cutover owner/format.");
    check(p.projectRoot === "Projects/Pulsed Optomechanics" && p.dashboard === p.projectRoot + "/Pulsed Optomechanics.md" && p.options.projectRoot === p.projectRoot && p.options.dashboard === p.dashboard && p.options.partitionId === "private", "Cutover physical owner differs.");
    check(p.sources.length === 1 && p.sources[0].path === p.projectRoot + "/Meta/Tasks.md" && p.options.config.binding.projectId === A.PROJECT && p.options.config.binding.deviceId === p.deviceId && p.options.config.binding.vaultId === p.vaultId, "Cutover bindings differ.");
    return p;
}
async function assertActive(p, folder) {
    const plan = await readPlan(path.join(folder, "CUTOVER-v1.json")); check(checksum(plan) === checksum(p), "Cutover plan changed.");
    const active = verify(await readOrdinary(path.join(folder, "ACTIVATION-v1.json")));
    V.fields(active, ["version", "kind", "state", "planDigest", "authorityId"], ["version", "kind", "state", "planDigest", "authorityId"]);
    check(active.version === 1 && active.kind === "itacan-owner-activation" && active.state === "active" && active.planDigest === checksum(p) && active.authorityId === p.options.config.authorityId, "Cutover is incomplete.");
    await A.validateBinding(p.options.config.binding, p.options.config.directory);
    for (const s of p.sources) { const file = path.join(p.options.config.binding.vaultRoot, s.path); check(await A.ordinaryPath(file) === await fs.realpath(file) && A.digest(await fs.readFile(file)) === s.proposedHash, "Retired source changed; owner unavailable."); }
}
async function loadActivation(plugin) {
    // Called by actual onload after the ordinary device identity is initialized.
    const vault = await fs.realpath(plugin.app.vault.adapter.getBasePath()); let id, folder;
    const p = plugin.projectWizard.getProjectById(A.PROJECT), stat = await fs.stat(vault, { bigint: true });
    const reserved = { owner: { type: "project", id: A.PROJECT }, projectRoot: p?.root ?? "Projects/Pulsed Optomechanics", dashboard: p?.path ?? "Projects/Pulsed Optomechanics/Pulsed Optomechanics.md", partitionId: "private", config: {}, blocked: true, vaultPin: { real: vault, dev: String(stat.dev), ino: String(stat.ino) } };
    try {
        id = await A.registration(vault); folder = location(process.env.LOCALAPPDATA, id); await fs.lstat(folder);
    } catch (_) {
        // A changed registry ID must not hide an earlier cutover for this owner.
        // No authority is opened while looking for its original private marker.
        if (!p) return null;
        try {
            const names = await fs.readdir(path.join(process.env.LOCALAPPDATA, "Itacan/NativeActivation/v1"));
            return names.length ? reserved : null;
        } catch (e) { if (e.code === "ENOENT") return null; return reserved; }
    }
    try {
        check(path.relative(await A.ordinaryPath(folder), await fs.realpath(folder)) === "", "Activation directory changed.");
        try { await fs.lstat(path.join(folder, "CUTOVER-v1.json")); } catch (e) { if (e.code !== "ENOENT") throw e; const files = await fs.readdir(folder); if (!files.some(f => ["ACTIVATION-v1.json", "CONTINUATION-v1.json"].includes(f))) return null; throw e; }
        const plan = await readPlan(path.join(folder, "CUTOVER-v1.json"));
        check(plan.vaultId === id && plan.deviceId === plugin.dataStore.deviceId && path.relative(await fs.realpath(plan.options.config.binding.vaultRoot), vault) === "", "Activation vault/device mismatch.");
        check(plan.projectRoot === p?.root && plan.dashboard === p?.path && !p?.shared && p?.status === "active", "Activation owner changed.");
        await assertActive(plan, folder);
        return { ...plan.options, vaultPin: reserved.vaultPin, assertActivation: () => assertActive(plan, folder) };
    } catch (_) { return reserved; } // Evidence remains intact; never reactivate legacy writes.
}
function ownerKey(owner) {
    require("../../../../../ItacanTaskCore/src/domain").workspace(owner);
    check(owner.type === "project" ? /^[a-f0-9-]{36}$/.test(owner.id) : ["study", "literature", "references", "inspiration"].includes(owner.id), "Unsupported activation identity.");
    return owner.type + "-" + owner.id;
}
function ownerFolder(local, vaultId, owner) { return path.join(location(local, vaultId), "owners", ownerKey(owner)); }
async function readOwnerPlan(file) {
    const p = verify(await readOrdinary(file));
    const fields = ["version", "kind", "vaultId", "deviceId", "owner", "projectRoot", "dashboard", "archive", "archiveHash", "sources", "historyDigest", "metadataDigest", "options", "deviceEvidence"];
    V.fields(p, fields, fields);
    const b = p.options?.config?.binding;
    check(p.version === 2 && p.kind === "itacan-owner-cutover" && b?.version === 2 && p.options.config.scope === "device-private-project" && p.options.creating === false && p.options.partitionId === "private", "Unsupported owner cutover.");
    ownerKey(p.owner);
    check(V.canonical(p.owner) === V.canonical(p.options.owner) && V.canonical(p.owner) === V.canonical(b.owner) && b.vaultId === p.vaultId && b.deviceId === p.deviceId && b.ownerRoot === p.projectRoot && b.dashboard === p.dashboard && p.options.projectRoot === p.projectRoot && p.options.dashboard === p.dashboard, "Owner cutover bindings differ.");
    check(Array.isArray(p.sources) && new Set(p.sources.map(s => s.path)).size === p.sources.length && p.sources.every(s => typeof s.path === "string" && s.path.startsWith(p.projectRoot + "/") && !s.path.split("/").some(x => !x || x === "." || x === "..") && !s.path.includes("\\") && /^[a-f0-9]{64}$/.test(s.proposedHash) && /^[a-f0-9]{64}$/.test(s.sourceHash)), "Invalid retired source scope.");
    return p;
}
async function assertOwnerActive(p, folder) {
    check(checksum(await readOwnerPlan(path.join(folder, "CUTOVER-v1.json"))) === checksum(p), "Owner cutover changed.");
    const a = verify(await readOrdinary(path.join(folder, "ACTIVATION-v1.json")));
    V.fields(a, ["version", "kind", "state", "planDigest", "authorityId"], ["version", "kind", "state", "planDigest", "authorityId"]);
    check(a.version === 2 && a.kind === "itacan-owner-activation" && a.state === "active" && a.planDigest === checksum(p) && a.authorityId === p.options.config.authorityId, "Owner cutover incomplete.");
    await A.validateBinding(p.options.config.binding, p.options.config.directory);
    for (const source of p.sources) {
        const file = path.join(p.options.config.binding.vaultRoot, source.path);
        check(await A.ordinaryPath(file) === await fs.realpath(file) && A.digest(await fs.readFile(file)) === source.proposedHash, "Retired source changed.");
    }
}
async function loadActivations(plugin, onlyOwner = null) {
    const old = !onlyOwner || onlyOwner.type === "project" && onlyOwner.id === A.PROJECT ? await loadActivation(plugin) : null, result = old ? [old] : [];
    const vault = await fs.realpath(plugin.app.vault.adapter.getBasePath()), stat = await fs.stat(vault, { bigint: true });
    const vaultPin = { real: vault, dev: String(stat.dev), ino: String(stat.ino) };
    let id; try { id = await A.registration(vault); } catch (_) { return result; } const base = path.join(location(process.env.LOCALAPPDATA, id), "owners");
    let names; try { names = await fs.readdir(base); } catch (e) { if (e.code === "ENOENT") return result; throw e; }
    for (const name of names.sort()) {
        const match = /^(project|resource)-(.+)$/.exec(name); check(match, "Unknown owner activation evidence.");
        const owner = { type: match[1], id: match[2] }; if (onlyOwner && (owner.type !== onlyOwner.type || owner.id !== onlyOwner.id)) continue; check(ownerKey(owner) === name, "Owner activation directory mismatch.");
        const current = owner.type === "resource" ? plugin.projectWizard.getResourceById(owner.id) : plugin.projectWizard.getProjectById(owner.id);
        const reserved = { owner, projectRoot: current?.root ?? null, dashboard: current?.path ?? null, partitionId: "private", config: {}, blocked: true, vaultPin };
        const folder = path.join(base, name);
        try {
            check(await A.ordinaryPath(folder) === await fs.realpath(folder), "Activation directory changed.");
            const p = await readOwnerPlan(path.join(folder, "CUTOVER-v1.json"));
            check(V.canonical(p.owner) === V.canonical(owner) && p.vaultId === id && p.deviceId === plugin.dataStore.deviceId && path.relative(await fs.realpath(p.options.config.binding.vaultRoot), vault) === "", "Activation vault/device mismatch.");
            Object.assign(reserved, { projectRoot: p.projectRoot, dashboard: p.dashboard });
            check(current?.root === p.projectRoot && current?.path === p.dashboard && (owner.type === "resource" ? current.contextKind === "resource" && current.resourceType === owner.id : current.contextKind !== "resource" && !current.shared && ["active", "future", "shelved"].includes(current.status)), "Activation physical owner changed.");
            await assertOwnerActive(p, folder);
            result.push({ ...p.options, vaultPin, assertActivation: () => assertOwnerActive(p, folder) });
        } catch (_) { result.push(reserved); }
    }
    return result;
}
module.exports = { seal, verify, checksum, location, readPlan, assertActive, loadActivation, ownerKey, ownerFolder, readOwnerPlan, assertOwnerActive, loadActivations };
