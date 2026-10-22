"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), C = require("../controlled-cutover.cjs"), P = require("../../../.obsidian/plugins/hub-project-menu/lib/services/native-cutover-preparation"), R = require("../../../.obsidian/plugins/hub-project-menu/lib/services/native-task-activation"), A = require("../../host/private-authority");
async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "itacan-m1f-test-")), vault = path.join(root, "vault"), local = path.join(root, "local"), roaming = path.join(root, "roaming"), staged = path.join(root, "staged"), packageRoot = path.join(vault, ".obsidian/plugins/hub-project-menu"), projectRoot = "Projects/Pulsed Optomechanics", dashboard = projectRoot + "/Pulsed Optomechanics.md", source = projectRoot + "/Meta/Tasks.md", vaultId = "0123456789abcdef", deviceId = crypto.randomUUID();
    const before = { LOCALAPPDATA: process.env.LOCALAPPDATA, APPDATA: process.env.APPDATA }; process.env.LOCALAPPDATA = local; process.env.APPDATA = roaming;
    t.after(() => Object.assign(process.env, before));
    const write = async (base, name, text) => { const f = path.join(base, name); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, text); };
    await fs.mkdir(local); await fs.mkdir(staged); await write(roaming, "obsidian/obsidian.json", JSON.stringify({ vaults: { [vaultId]: { path: vault } } }));
    await write(vault, dashboard, "---\ntype: project\nprojectId: " + A.PROJECT + "\nstatus: active\n---\n# Keep\n");
    await write(vault, source, "\uFEFF# Tasks\r\n\r\n- [ ] Retain this text\r\n\r\nProse $x$.\r\n");
    await write(vault, "Projects/Other/Other.md", "---\ntype: project\nprojectId: other\nstatus: active\n---\n"); await write(vault, "Projects/Other/Tasks.md", "- [ ] Other legacy\n");
    await write(vault, "Resources/Knowledge/Tasks.md", "- [ ] Resource legacy\n");
    await write(packageRoot, "data.json", JSON.stringify({ completedTaskHistory: [{ id: 17, text: "Original history", timestamp: 1 }], taskMetadata: {} }));
    for (const name of C.ASSETS) { await write(packageRoot, name, "before:" + name); await write(staged, name, (name === "main.js" ? "after:" : "before:") + name); }
    const archive = (await P.captureArchive({ vaultRoot: vault, localDataRoot: local, archivesRoot: path.join(local, "archives"), vaultId })).archive;
    const plan = await C.prepare({ archive, deviceId, localDataRoot: local, staged, packageRoot });
    const project = { projectId: A.PROJECT, root: projectRoot, path: dashboard, contextKind: "project", status: "active" };
    const plugin = { app: { vault: { adapter: { getBasePath: () => vault } } }, dataStore: { deviceId }, projectWizard: { getProjectById: () => project } };
    const savedPackage = await C.stagePackage(plan, staged, path.join(local, "prepared-package"));
    const folder = R.location(local, vaultId), execute = extra => C.execute(plan, { staged: path.join(savedPackage, "candidate"), approval: R.checksum(R.verify(plan)), quiescenceConfirmed: true, ...extra });
    return { root, vault, local, roaming, staged, packageRoot, projectRoot, dashboard, source, vaultId, deviceId, plan, plugin, folder, write, execute, savedPackage };
}
module.exports = { fixture, fs, path, crypto, C, P, R, A };
