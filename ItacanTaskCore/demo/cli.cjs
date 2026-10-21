"use strict";
const { initProfile, openRuntime, seedExamples } = require("./runtime.cjs"), { createDemoServer } = require("./server.cjs");
async function main(args = process.argv.slice(2)) {
    const [command, ...rest] = args;
    if (command === "init") {
        if (rest.length > 1) throw Error("Usage: init [existing-empty-Temp-directory]");
        const directory = await initProfile(rest[0]); const runtime = await openRuntime(directory);
        try { await seedExamples(runtime); } finally { await runtime.close(); }
        process.stdout.write(JSON.stringify({ profile: directory, scope: "disposable-native-demo", next: "serve " + JSON.stringify(directory) }) + "\n"); return;
    }
    if (command !== "serve" || !rest[0] || rest.slice(1).some(x => x !== "--browser-tests")) throw Error("Usage: serve <existing-profile-directory> [--browser-tests]");
    const runtime = await openRuntime(rest[0]), server = await createDemoServer(runtime, { browserTests: rest.includes("--browser-tests") });
    process.stdout.write(JSON.stringify({ scope: "disposable-native-demo", url: server.url, profile: rest[0], pid: process.pid }) + "\n");
    let stopping = false; const stop = async () => { if (stopping) return; stopping = true; try { await server.close(); process.exitCode = 0; } catch (_) { process.exitCode = 1; } };
    process.on("SIGINT", stop); process.on("SIGTERM", stop); return { server, stop };
}
if (require.main === module) main().catch(e => { process.stderr.write("Disposable demo: " + (e.code || e.message) + "\n"); process.exitCode = 1; });
module.exports = { main };
