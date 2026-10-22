"use strict";
// Offline, one-owner execution tool. Never imported by ordinary plugin startup.
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), { spawn } = require("node:child_process");
const A = require("../host/private-authority"), P = require("../../.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation"), R = require("../../.obsidian/plugins/hub-project-menu/lib/services/native-task-activation");
const ASSETS = ["main.js", "atlas-native.cjs", "strict-oath-assets.json", "lib/services/oath-strict-host.js", "lib/services/oath-strict.js", "lib/services/oath-process-observer.js", "lib/services/oath-dock.js", "lib/domain/oath-strict.js", "lib/ui/oath-dock/preload.cjs", "lib/ui/oath-dock/index.html", "lib/ui/oath-dock/dock.js", "lib/ui/oath-dock/dock.css"];
const check = (ok, message) => { if (!ok) throw Error(message); };
async function writeNew(file, value) { const h = await fs.open(file, "wx", 0o600); try { await h.writeFile(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + "\n"); await h.sync(); } finally { await h.close(); } }
async function dependencies(vault, root, identities = []) {
    const data = JSON.parse(await fs.readFile(path.join(vault, ".obsidian/plugins/hub-project-menu/data.json"), "utf8"));
    const references = v => typeof v === "string" ? v === A.PROJECT || v === root || v.startsWith(root + "/") || identities.includes(v) : Array.isArray(v) ? v.some(references) : v && typeof v === "object" ? Object.values(v).some(references) : false;
    check(!Object.values(data.oathsByDevice ?? {}).some(b => ["active", "scheduled"].includes(b.current?.state) && references(b.current)), "Active Oath references selected legacy owner.");
    check(!references(data.inbox), "Inbox references selected legacy owner; review required.");
    return { oath: "no-active-reference", inbox: "no-reference" };
}
async function verifyDevice(plan) {
    const e = plan.deviceEvidence, b = plan.options.config.binding;
    if (e === null) {
        const temp = await fs.realpath(os.tmpdir()); check(A.inside(temp, await fs.realpath(b.vaultRoot)) && A.inside(temp, await fs.realpath(b.localDataRoot)), "Real cutover requires existing local device evidence."); return;
    }
    check(e.version === 1 && e.deviceId === plan.deviceId && path.relative(await fs.realpath(path.join(process.env.APPDATA, "obsidian/Local Storage/leveldb")), await fs.realpath(e.source)) === "", "Local device evidence differs.");
    const names = await fs.readdir(e.source); check(JSON.stringify(names.sort()) === JSON.stringify(Object.keys(e.hashes).sort()), "Local identity observation changed.");
    for (const [name, hash] of Object.entries(e.hashes)) { check(/^[A-Za-z0-9._-]+$/.test(name) && !(await fs.lstat(path.join(e.source, name))).isSymbolicLink(), "Unsafe identity evidence."); check(A.digest(await fs.readFile(path.join(e.source, name))) === hash, "Local identity observation changed; recapture after shutdown."); }
}
async function prepare({ archive, deviceId, deviceEvidence = null, localDataRoot, staged, packageRoot }) {
    const manifest = await P.verifyArchive(archive), owner = { type: "project", id: A.PROJECT }, preview = await P.previewRetirement({ archive, owner });
    check(preview.previewSafe && preview.files.length === 1 && preview.files[0].edits.length === 1, "Exact one-task retirement required.");
    check(manifest.sources.filter(s => s.owner?.id === A.PROJECT).every(s => s.tasks === 1 && s.steps === 0), "Selected inventory changed.");
    const project = manifest.candidates.find(p => p.projectId === A.PROJECT);
    await dependencies(manifest.vaultRoot, project.root);
    const binding = { version: 1, vaultRoot: manifest.vaultRoot, vaultId: manifest.vaultId, deviceId, projectId: A.PROJECT, localDataRoot: await fs.realpath(localDataRoot) };
    const prepared = await P.prepareAuthority({ ...binding }); await A.validateBinding(binding, prepared.directory);
    check(path.relative(await fs.realpath(packageRoot), path.join(manifest.vaultRoot, ".obsidian/plugins/hub-project-menu")) === "", "Exact installed plugin required.");
    const assets = []; for (const name of ASSETS) {
        const before = await fs.readFile(path.join(packageRoot, name)), built = await fs.readFile(path.join(staged, name));
        const eolOnly = /\.(?:js|cjs)$/.test(name) && before.toString("utf8").replace(/\r\n/g, "\n") === built.toString("utf8").replace(/\r\n/g, "\n");
        assets.push({ name, before: A.digest(before), after: A.digest(eolOnly ? before : built), buildHash: A.digest(built) });
    }
    const authorityId = crypto.randomUUID();
    const plan = R.seal({ version: 1, kind: "itacan-owner-cutover", vaultId: binding.vaultId, deviceId, deviceEvidence, owner, projectRoot: project.root, dashboard: project.path, archive, archiveHash: A.digest(await fs.readFile(path.join(archive, "MANIFEST.json"))),
        sources: preview.files.map(f => ({ path: f.path, stamp: manifest.sources.find(s => s.path === f.path).stamp, sourceHash: f.sourceHash, proposedHash: f.proposedHash, proposedBase64: f.proposedBytes.toString("base64") })), registryFiles: manifest.registryFiles, historyDigest: manifest.application.historyDigest, metadataDigest: manifest.application.metadataDigest,
        options: { version: 1, owner, projectRoot: project.root, dashboard: project.path, partitionId: "private", rehearsalId: crypto.randomUUID(), creating: false,
            config: { version: 1, scope: "device-private-project", storageFormat: "private-v4", authorityId, directory: prepared.directory, applicationContextId: "cutover-" + authorityId, registryId: "project-" + A.PROJECT, binding } }, assets });
    await verifyDevice(plan); return plan;
}
async function stagePackage(plan, staged, destination) {
    R.verify(plan); const b = plan.options.config.binding;
    await P.validatePrivateLocation(destination, { vaultRoot: b.vaultRoot, localDataRoot: b.localDataRoot });
    await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.mkdir(destination); await fs.mkdir(path.join(destination, "previous")); await fs.mkdir(path.join(destination, "candidate"));
    for (const asset of plan.assets) {
        check(ASSETS.includes(asset.name), "Unknown installation asset.");
        for (const [kind, base, expected] of [["previous", path.join(b.vaultRoot, ".obsidian/plugins/hub-project-menu"), asset.before], ["candidate", staged, asset.after]]) {
            let bytes = await fs.readFile(path.join(base, asset.name));
            if (kind === "candidate") {
                check(A.digest(bytes) === asset.buildHash, "Staged build changed.");
                if (asset.after === asset.before) {
                    const installed = await fs.readFile(path.join(b.vaultRoot, ".obsidian/plugins/hub-project-menu", asset.name));
                    check(A.digest(installed) === asset.before && (bytes.equals(installed) || /\.(?:js|cjs)$/.test(asset.name) && bytes.toString("utf8").replace(/\r\n/g, "\n") === installed.toString("utf8").replace(/\r\n/g, "\n")), "Unchanged asset differs from build."); bytes = installed;
                }
            }
            check(A.digest(bytes) === expected, "Installation input changed.");
            const target = path.join(destination, kind, asset.name); await fs.mkdir(path.dirname(target), { recursive: true }); await writeNew(target, bytes); check(A.digest(await fs.readFile(target)) === expected, "Installation backup failed.");
        }
    }
    await writeNew(path.join(destination, "PLAN.json"), plan); return destination;
}
async function verifyInputs(plan, staged) {
    R.verify(plan); const b = plan.options.config.binding;
    check(plan.owner.id === A.PROJECT && plan.assets.length === ASSETS.length && new Set(plan.assets.map(a => a.name)).size === ASSETS.length && plan.assets.every(a => ASSETS.includes(a.name)), "Cutover package differs.");
    check(await A.registration(b.vaultRoot) === b.vaultId, "Registered vault changed."); await A.validateBinding(b, plan.options.config.directory);
    await P.prepareAuthority(b); // Recheck occupancy before installation or activation evidence.
    await verifyDevice(plan);
    const manifest = await P.verifyArchive(plan.archive); check(A.digest(await fs.readFile(path.join(plan.archive, "MANIFEST.json"))) === plan.archiveHash && manifest.vaultId === b.vaultId, "Archive changed.");
    await dependencies(b.vaultRoot, plan.projectRoot);
    const preview = await P.previewRetirement({ archive: plan.archive, owner: plan.owner });
    check(preview.previewSafe && preview.files.length === plan.sources.length && preview.files.every((f, i) => f.path === plan.sources[i].path && f.sourceHash === plan.sources[i].sourceHash && f.proposedHash === plan.sources[i].proposedHash && f.proposedBytes.equals(Buffer.from(plan.sources[i].proposedBase64, "base64"))), "Retirement prerequisites changed.");
    for (const a of plan.assets) { check(A.digest(await fs.readFile(path.join(staged, a.name))) === a.after, "Staged build changed."); check(A.digest(await fs.readFile(path.join(b.vaultRoot, ".obsidian/plugins/hub-project-menu", a.name))) === a.before, "Installed build changed."); }
    return preview;
}
async function prepareRepository(plan) {
    const { registryDigest } = require("../host/registry"), { policy } = require("../writer/policy"), { openProjectRuntime } = require("./project-runtime"); const o = plan.options;
    const body = { version: 1, registryId: o.config.registryId, applicationContextId: o.config.applicationContextId, revision: JSON.stringify([plan.owner.id, plan.projectRoot, plan.dashboard, "active", false]), owners: [{ owner: plan.owner, partitionId: "private", root: plan.projectRoot, dashboard: plan.dashboard, status: "active", available: true, shared: false, shareApproval: null, locations: [], mounts: [] }] };
    const registry = { read: async () => ({ ...body, digest: registryDigest(body) }), subscribe: () => () => {} };
    const writerPolicy = policy({ version: 1, owners: [{ owner: plan.owner, partitionId: "private" }], commands: ["task.createRich", "task.save", "task.complete", "step.complete", "task.delete"], inventory: { version: 1, revision: "synthetic-empty", ids: [] }, phases: { version: 1, revision: "no-phases", values: [] } });
    await fs.mkdir(o.config.directory, { recursive: true }); await A.validateBinding(o.config.binding, o.config.directory); check(!(await fs.readdir(o.config.directory)).length, "Occupied native authority; review required.");
    const runtime = await openProjectRuntime(o.config, { owner: plan.owner, registry, writerPolicy, rehearsalId: o.rehearsalId, creating: true });
    try { check(!(await runtime.list()).tasks.length, "Native starts empty."); } finally { await runtime.close(); }
}
async function sourceLock(plan) {
    const source = plan.sources[0], file = path.join(plan.options.config.binding.vaultRoot, source.path);
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "cutover-source-lock.ps1"), "-Source", file, "-ExpectedHash", source.sourceHash, "-ProposedHash", source.proposedHash, "-ProposedBase64", source.proposedBase64], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", error = "", done = false, code = null; child.stdout.on("data", b => { output += b; }); child.stderr.on("data", b => { error += b; }); child.on("exit", c => { done = true; code = c; }); child.on("error", e => { error += e.message; done = true; });
    async function wait(token) { for (let i = 0; i < 600; i++) { if (output.includes(token)) return; if (done) throw Error("Exclusive source worker failed: " + error); await new Promise(r => setTimeout(r, 25)); } throw Error("Exclusive source worker timed out."); }
    try {
        await wait("LOCKED"); const s = await fs.stat(file, { bigint: true });
        check(source.stamp && ["dev", "ino", "size", "mtimeNs", "ctimeNs"].every(key => String(s[key]) === source.stamp[key]), "Source identity/write stamp changed before exclusive acquisition.");
    } catch (e) { child.stdin.end(); if (!done) await new Promise(r => child.once("close", r)); throw e; }
    return { pid: child.pid, async retire() { child.stdin.write("RETIRE\n"); await wait("RETIRED"); }, async close() { child.stdin.end(); for (let i = 0; i < 600 && !done; i++) await new Promise(r => setTimeout(r, 25)); check(done && code === 0, "Source lock did not close cleanly."); } };
}
async function assertObsidianClosed() {
    const c = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "if(Get-Process -Name Obsidian -ErrorAction SilentlyContinue){exit 1}"], { windowsHide: true, stdio: "ignore" });
    const code = await new Promise((r, reject) => { c.on("error", reject); c.on("exit", r); }); check(code === 0, "Close everyday Obsidian before source retirement.");
}
async function execute(plan, { staged, approval, quiescenceConfirmed, stage = async () => {} }) {
    check(approval === R.checksum(R.verify(plan)) && quiescenceConfirmed === true, "Explicit exact-plan approval and writer quiescence required.");
    await assertObsidianClosed(); await verifyInputs(plan, staged);
    for (const a of plan.assets) check(A.digest(await fs.readFile(path.join(staged, "../previous", a.name))) === a.before, "Durable rollback backup unavailable.");
    const folder = R.location(plan.options.config.binding.localDataRoot, plan.vaultId);
    // mkdir is exclusive: incomplete attempts are never silently resumed or erased.
    await fs.mkdir(path.dirname(folder), { recursive: true });
    const lock = await sourceLock(plan);
    try {
        await fs.mkdir(folder); await writeNew(path.join(folder, "CUTOVER-v1.json"), plan); await stage("incomplete", { sourceLockPid: lock.pid });
        const b = plan.options.config.binding;
        for (const a of plan.assets) if (a.before !== a.after) {
            const dest = path.join(b.vaultRoot, ".obsidian/plugins/hub-project-menu", a.name), next = dest + ".cutover-new";
            check(A.digest(await fs.readFile(dest)) === a.before, "Installation changed during cutover."); await writeNew(next, await fs.readFile(path.join(staged, a.name))); await fs.rename(next, dest); check(A.digest(await fs.readFile(dest)) === a.after, "Installation failed.");
        }
        await stage("installed", { sourceLockPid: lock.pid }); await prepareRepository(plan); await stage("prepared", { sourceLockPid: lock.pid });
        await assertObsidianClosed(); await lock.retire(); await stage("retired", { sourceLockPid: lock.pid });
        await writeNew(path.join(folder, "ACTIVATION-v1.json"), R.seal({ version: 1, kind: "itacan-owner-activation", state: "active", planDigest: R.checksum(R.verify(plan)), authorityId: plan.options.config.authorityId }));
        await stage("active", { sourceLockPid: lock.pid }); return { state: "active", folder, authorityId: plan.options.config.authorityId };
    } finally { await lock.close(); }
}
async function continueCutover(original, current, { staged, approval, quiescenceConfirmed, stage = async () => {} }) {
    const old = R.verify(original), next = R.verify(current);
    check(approval === R.checksum(next) && quiescenceConfirmed === true, "Explicit continuation approval/quiescence required.");
    check(R.checksum(old.options) === R.checksum(next.options) && old.owner.id === A.PROJECT && next.owner.id === A.PROJECT && old.projectRoot === next.projectRoot && old.dashboard === next.dashboard, "Continuation cannot replace authority or owner.");
    check(old.sources.length === 1 && next.sources.length === 1 && ["path", "sourceHash", "proposedHash", "proposedBase64"].every(k => old.sources[0][k] === next.sources[0][k]) && old.historyDigest === next.historyDigest && old.metadataDigest === next.metadataDigest, "Continuation changes original source or History.");
    check(next.assets.every(a => { const prior = old.assets.find(p => p.name === a.name); return prior && a.before === prior.after && (a.name === "main.js" || a.after === prior.after); }), "Continuation changes unrelated installation assets.");
    await assertObsidianClosed();
    const folder = R.location(old.options.config.binding.localDataRoot, old.vaultId), saved = await R.readPlan(path.join(folder, "CUTOVER-v1.json"));
    check(R.checksum(saved) === R.checksum(old), "Original incomplete evidence differs.");
    check((await fs.readdir(folder)).length === 1, "Unexpected cutover evidence; explicit review required.");
    await P.verifyArchive(old.archive);
    await verifyInputs(current, staged); // Requires empty authority, exact current source and refreshed observations.
    for (const a of next.assets) check(A.digest(await fs.readFile(path.join(staged, "../previous", a.name))) === a.before, "Continuation rollback copy unavailable.");
    const lock = await sourceLock(current);
    try {
        await writeNew(path.join(folder, "CONTINUATION-v1.json"), R.seal({ version: 1, kind: "itacan-cutover-continuation", parentDigest: R.checksum(old), authorityId: old.options.config.authorityId, plan: current }));
        await stage("continuing", { sourceLockPid: lock.pid });
        for (const a of next.assets) if (a.before !== a.after) {
            check(a.name === "main.js", "Only main.js may be installed."); const dest = path.join(old.options.config.binding.vaultRoot, ".obsidian/plugins/hub-project-menu/main.js");
            check(A.digest(await fs.readFile(dest)) === a.before, "Installed asset changed."); await writeNew(dest + ".cutover-new", await fs.readFile(path.join(staged, a.name))); await fs.rename(dest + ".cutover-new", dest); check(A.digest(await fs.readFile(dest)) === a.after, "Corrected installation failed.");
        }
        await stage("installed", { sourceLockPid: lock.pid }); await prepareRepository(current); await stage("prepared", { sourceLockPid: lock.pid });
        await assertObsidianClosed(); await lock.retire(); await stage("retired", { sourceLockPid: lock.pid });
        await writeNew(path.join(folder, "ACTIVATION-v1.json"), R.seal({ version: 1, kind: "itacan-owner-activation", state: "active", planDigest: R.checksum(old), authorityId: old.options.config.authorityId }));
        // The caller verifies the retired source after finally releases its
        // exclusive handle; reading it here would conflict with that handle.
        await stage("active", { sourceLockPid: lock.pid });
        return { state: "active", folder, authorityId: old.options.config.authorityId };
    } finally { await lock.close(); }
}
module.exports = { ASSETS, prepare, stagePackage, verifyInputs, prepareRepository, execute, continueCutover, sourceLock, assertObsidianClosed, dependencies, verifyDevice };
