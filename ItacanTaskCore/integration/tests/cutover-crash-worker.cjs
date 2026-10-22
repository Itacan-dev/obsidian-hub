"use strict";
const os = require("node:os"), { fixture, fs, path } = require("./cutover-support.cjs");
(async () => {
    const f = await fixture({ after() {} }), target = process.argv[2];
    await f.execute({ stage: async (stage, info) => {
        if (stage !== target) return;
        const evidence = { stage, pid: process.pid, host: os.hostname(), ...info, root: f.root, vault: f.vault, local: f.local, roaming: f.roaming, deviceId: f.deviceId, source: f.source, plan: f.plan, nativeLock: "absent: repository creation closed before this stage" };
        await fs.writeFile(path.join(f.root, "death-evidence.json"), JSON.stringify(evidence, null, 2));
        process.stdout.write(JSON.stringify({ root: f.root, pid: process.pid, stage }) + "\n"); await new Promise(() => setInterval(() => {}, 1000));
    } });
})().catch(e => { console.error(e); process.exitCode = 1; });
