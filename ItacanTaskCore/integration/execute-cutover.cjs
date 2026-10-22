"use strict";
// Deliberate offline entry point. No implicit approval, restore, resume or launch.
const fs = require("node:fs/promises"), path = require("node:path"), C = require("./controlled-cutover.cjs"), R = require("../../.obsidian/plugins/hub-project-menu/lib/services/native-task-activation");
async function main() {
    const [folder, flag, approval, quiescence] = process.argv.slice(2);
    if (!folder || flag !== "--approve-exact-plan" || !/^[a-f0-9]{64}$/.test(approval ?? "") || quiescence !== "--obsidian-and-other-source-writers-closed") throw Error("Exact package, plan digest and explicit writer-quiescence confirmation required.");
    const plan = JSON.parse(await fs.readFile(path.join(folder, "PLAN.json"), "utf8"));
    if (R.checksum(R.verify(plan)) !== approval) throw Error("Reviewed plan differs.");
    const result = await C.execute(plan, { staged: path.join(folder, "candidate"), approval, quiescenceConfirmed: true, stage: async stage => process.stdout.write("Cutover stage: " + stage + "\n") });
    process.stdout.write(JSON.stringify({ state: result.state, authorityId: result.authorityId, next: "Open Itacan and verify selected Project before creating desired new tasks." }) + "\n");
}
main().catch(error => { console.error("Cutover stopped; preserve evidence and review before another attempt:", error.message); process.exitCode = 1; });
