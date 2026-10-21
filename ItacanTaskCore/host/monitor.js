"use strict";
const fs = require("node:fs");
// Advisory invalidation only. Every accepted read independently checks the lease and bytes.
function monitorRoot(directory, invalidate, unavailable) {
    let active = true;
    const watcher = fs.watch(directory, { persistent: false }, () => { if (active) invalidate(); });
    watcher.on("error", () => { if (active) { active = false; watcher.close(); unavailable(); } });
    watcher.on("close", () => { if (active) { active = false; unavailable(); } });
    return () => { if (active) { active = false; watcher.close(); } };
}
module.exports = { monitorRoot };
