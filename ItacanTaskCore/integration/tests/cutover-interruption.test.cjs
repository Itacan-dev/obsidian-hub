"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { spawn } = require("node:child_process"), { fs, path, R, A } = require("./cutover-support.cjs");
for (const stage of ["prepared", "retired"]) test("actual process death after " + stage + ": incomplete cutover reconstructs blocked without task recreation", { timeout: 45000 }, async t => {
    const args = [...process.execArgv, path.join(__dirname, "cutover-crash-worker.cjs"), stage];
    const child = spawn(process.execPath, args, { env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = "", stderr = "";
    child.stdout.on("data", b => { stdout += b; }); child.stderr.on("data", b => { stderr += b; });
    const death = new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })));
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let paused;
    for (let n = 0; n < 1000; n++) { if (stdout.includes("\n")) { paused = JSON.parse(stdout.split("\n")[0]); break; } assert.equal(child.exitCode, null, stderr); await new Promise(r => setTimeout(r, 20)); }
    assert(paused, stderr); assert.equal(paused.pid, child.pid); child.kill(); const exit = await death;
    const e = JSON.parse(await fs.readFile(path.join(paused.root, "death-evidence.json"), "utf8"));
    let readable = false; for (let n = 0; n < 400; n++) { try { const h = await fs.open(path.join(e.vault, e.source), "r+"); await h.close(); readable = true; break; } catch (_) { await new Promise(r => setTimeout(r, 25)); } }
    assert(readable, "Source worker must release its exact exclusive handle on parent death.");
    const before = { APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA }; process.env.APPDATA = e.roaming; process.env.LOCALAPPDATA = e.local; t.after(() => Object.assign(process.env, before));
    const p = { projectId: A.PROJECT, root: e.plan.projectRoot, path: e.plan.dashboard, status: "active" }, plugin = { app: { vault: { adapter: { getBasePath: () => e.vault } } }, dataStore: { deviceId: e.deviceId }, projectWizard: { getProjectById: () => p } };
    assert((await R.loadActivation(plugin)).blocked); await assert.rejects(fs.stat(path.join(R.location(e.local, e.plan.vaultId), "ACTIVATION-v1.json")), { code: "ENOENT" });
    const actual = A.digest(await fs.readFile(path.join(e.vault, e.source))); assert.equal(actual, stage === "retired" ? e.plan.sources[0].proposedHash : e.plan.sources[0].sourceHash);
    assert(!(await fs.readdir(e.plan.options.config.directory)).includes("WRITER.lock"));
    await fs.writeFile(path.join(paused.root, "parent-result.json"), JSON.stringify({ args, pid: child.pid, ...exit, stdout, stderr, sourceHandleReleased: readable, sourceHash: actual, nativeLockMovement: "none" }, null, 2));
});
