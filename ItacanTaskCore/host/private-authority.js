"use strict";
// Admission only. Does not create directories, acquire a lease, or alter storage.
const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto");
const V = require("../src/value"), { check } = require("../src/errors");
const PROJECT = "70927a62-591c-4df9-81a1-27585c903563";
const digest = v => crypto.createHash("sha256").update(v).digest("hex");
const inside = (a, b) => { const r = path.relative(a, b); return !!r && r !== ".." && !r.startsWith(".." + path.sep) && !path.isAbsolute(r); };
async function ordinaryPath(target) {
    const absolute = path.resolve(target); let p = absolute;
    while (true) {
        try { const s = await fs.lstat(p); check(!s.isSymbolicLink(), "Links are not admitted."); }
        catch (e) { if (e.code !== "ENOENT") throw e; }
        const parent = path.dirname(p); if (parent === p) break; p = parent;
    }
    let ancestor = absolute; while (true) { try { await fs.lstat(ancestor); break; } catch (e) { if (e.code !== "ENOENT") throw e; ancestor = path.dirname(ancestor); } }
    return path.resolve(await fs.realpath(ancestor), path.relative(ancestor, absolute));
}
async function registration(vaultRoot) {
    const vault = await fs.realpath(vaultRoot), data = JSON.parse(await fs.readFile(path.join(process.env.APPDATA, "obsidian/obsidian.json"), "utf8"));
    const ids = []; for (const [id, v] of Object.entries(data.vaults ?? {})) if (typeof v.path === "string") {
        try { if (path.relative(await fs.realpath(v.path), vault) === "") ids.push(id); } catch (e) { if (e.code !== "ENOENT") throw e; }
    }
    check(ids.length === 1 && /^[a-f0-9]{16}$/.test(ids[0]), "Exactly one registered vault identity required."); return ids[0];
}
function bindingOwner(b) { return b.version === 1 ? { type: "project", id: b.projectId } : b.owner; }
function bindingKind(b) { return bindingOwner(b).type === "resource" ? "resource" : "private-project"; }
function repositoryPath(b) { return path.join(b.localDataRoot, "Itacan/NativeTasks/v1", ...[b.vaultId, b.deviceId, b.version === 1 ? b.projectId : V.canonical(b.owner)].map(v => digest(v).slice(0, 24)), "repository"); }
async function validateBinding(b, directory) {
    const fields = ["version", "vaultRoot", "vaultId", "deviceId", "localDataRoot", ...(b.version === 1 ? ["projectId"] : ["owner", "ownerRoot", "dashboard"])];
    V.fields(b, fields, fields);
    check(b.version === 1 && b.projectId === PROJECT || b.version === 2, "Unsupported private authority binding."); V.text(b.deviceId);
    if (b.version === 2) {
        require("../src/domain").workspace(b.owner);
        const { projectHeader } = require("../../.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation");
        // Physical identity is checked against the registered vault, never a display label.
        if (b.owner.type === "project") {
            check(/^Projects\/[^/]+$/.test(b.ownerRoot) && b.dashboard.startsWith(b.ownerRoot + "/") && b.dashboard.split("/").length === 3, "Registered Project root required.");
            const matches = [], projectRoot = path.join(b.vaultRoot, "Projects");
            for (const dir of await fs.readdir(projectRoot, { withFileTypes: true })) if (dir.isDirectory() && !dir.isSymbolicLink()) {
                for (const file of await fs.readdir(path.join(projectRoot, dir.name), { withFileTypes: true })) if (file.isFile() && !file.isSymbolicLink() && file.name.endsWith(".md")) {
                    const name = "Projects/" + dir.name + "/" + file.name, p = projectHeader(await fs.readFile(path.join(b.vaultRoot, name), "utf8"), name);
                    if (p && !p.ambiguous && p.projectId === b.owner.id) matches.push(p);
                }
            }
            check(matches.length === 1 && !matches[0].shared && ["active", "future", "shelved"].includes(matches[0].status) && matches[0].root === b.ownerRoot && matches[0].path === b.dashboard, "Private Project identity mismatch.");
        } else {
            const resource = require("../../.obsidian/plugins/hub-project-menu/lib/config").RESOURCE_TYPES.find(r => r.id === b.owner.id);
            check(resource && resource.root === b.ownerRoot && resource.hubPath === b.dashboard, "Resource identity mismatch.");
            const dashboard = path.join(b.vaultRoot, b.dashboard);
            check(await ordinaryPath(dashboard) === await fs.realpath(dashboard) && (await fs.stat(dashboard)).isFile(), "Resource dashboard unavailable.");
        }
    }
    const local = await fs.realpath(process.env.LOCALAPPDATA), vault = await fs.realpath(b.vaultRoot), real = await ordinaryPath(directory);
    check(await registration(vault) === b.vaultId && path.relative(local, await fs.realpath(b.localDataRoot)) === "", "Vault/device-private location mismatch.");
    check(path.relative(await ordinaryPath(repositoryPath(b)), real) === "" && inside(local, real) && !inside(vault, real) && !inside(real, vault) && real !== vault && !directory.startsWith("\\\\"), "Private authority path mismatch.");
    for (const cloud of [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean)) { const c = await ordinaryPath(cloud); check(c !== real && !inside(c, real), "Cloud authority rejected."); }
    for (let p = real; ; p = path.dirname(p)) {
        try { await fs.lstat(path.join(p, ".git")); check(false, "Git authority rejected."); } catch (e) { if (e.code !== "ENOENT") throw e; }
        if (p === path.dirname(p)) break;
    }
    return real;
}
module.exports = { PROJECT, digest, inside, ordinaryPath, registration, repositoryPath, bindingOwner, bindingKind, validateBinding };
